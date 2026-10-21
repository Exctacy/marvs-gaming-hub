import { createHash } from "crypto";
import { inflateSync } from "zlib";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionFromRequest, type SessionUser } from "./auth";
import { prisma } from "./prisma";
import { isGlobalDocumentManager } from "./staff-documents";

export class DocumentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function documentUser(req: NextRequest, mutation = false) {
  const user = await getSessionFromRequest(req);
  if (!user) throw new DocumentError(401, "Please sign in.");
  if (user.mustChangePassword) throw new DocumentError(403, "Change your temporary password before accessing staff documents.");
  if (mutation) {
    const origin = req.headers.get("origin");
    if ((origin && origin !== req.nextUrl.origin) || req.headers.get("sec-fetch-site") === "cross-site") {
      throw new DocumentError(403, "This request must come from the portal.");
    }
    const length = Number(req.headers.get("content-length") || 0);
    if (length > 300000) throw new DocumentError(413, "Document request is too large.");
  }
  return user;
}
export async function documentBody(req: NextRequest) {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > 300000) throw new DocumentError(413, "Document request is too large.");
  try { return JSON.parse(raw); } catch { throw new DocumentError(400, "Invalid JSON request."); }
}
export function documentFailure(error: unknown) {
  if (error instanceof DocumentError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
    return NextResponse.json({ error: "This document changed. Refresh and try again." }, { status: 409 });
  }
  console.error("Staff document operation failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "Unable to process staff documents. Please try again." }, { status: 500 });
}
export function documentBranch(user: SessionUser, requested?: string | null) {
  const id = isGlobalDocumentManager(user.role) ? requested || user.branchId : user.branchId;
  if (!id) throw new DocumentError(400, "Select a branch before continuing.");
  if (!isGlobalDocumentManager(user.role) && requested && requested !== id) throw new DocumentError(403, "You can only access your home branch.");
  return id;
}
export async function validateDocumentRecipient(tx: Prisma.TransactionClient, branchId: string, recipientId: string, authorId: string) {
  const [branch, recipient] = await Promise.all([
    tx.branch.findUnique({ where: { id: branchId } }), tx.staffProfile.findUnique({ where: { id: recipientId } }),
  ]);
  if (!branch?.active) throw new DocumentError(400, "Choose an active branch.");
  if (!recipient || recipient.status !== "active" || recipient.branchId !== branchId) throw new DocumentError(400, "Choose an active staff member in this branch.");
  if (recipient.id === authorId) throw new DocumentError(400, "You cannot issue a document to yourself.");
  return { branch, recipient };
}
export async function validateDocumentParticipants(tx: Prisma.TransactionClient, branchId: string, staffIds: string[], authorId: string) {
  const branch = await tx.branch.findUnique({ where: { id: branchId } });
  if (!branch?.active) throw new DocumentError(400, "Choose an active branch.");
  if (!staffIds.length || staffIds.length > 50 || new Set(staffIds).size !== staffIds.length || staffIds.includes(authorId)) throw new DocumentError(400, "Select 1-50 distinct staff members other than the initiator.");
  const staff = await tx.staffProfile.findMany({ where: { id: { in: staffIds }, branchId, status: "active" }, select: { id: true, fullName: true } });
  if (staff.length !== staffIds.length) throw new DocumentError(400, "Every participant must be active and belong to this branch.");
  const participants = staffIds.map((id) => { const person = staff.find((s) => s.id === id)!; return { staffId: person.id, staffName: person.fullName }; });
  return { branch, participants };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function documentHash(doc: {
  id: string; kind: string; title: string; branchId: string; branchName: string; recipientId: string;
  recipientName: string; createdById: string; preparedByName: string; contentVersion: number; content: unknown; revision: number;
  workflowVersion?: number; initiatedByRole?: string; participants?: { staffId: string; staffName: string }[];
}) {
  const { id, kind, title, branchId, branchName, recipientId, recipientName, createdById, preparedByName, contentVersion, content, revision } = doc;
  const legacy = { id, kind, title, branchId, branchName, recipientId, recipientName, createdById, preparedByName, contentVersion, content, revision };
  const value = (doc.workflowVersion || 1) >= 2 ? { ...legacy, workflowVersion: doc.workflowVersion, initiatedByRole: doc.initiatedByRole, participants: (doc.participants || []).map(({ staffId, staffName }) => ({ staffId, staffName })).sort((a, b) => a.staffId.localeCompare(b.staffId)) } : legacy;
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function participantResponseHash(contentHash: string, staffId: string, explanation: string, note: string, reportHash?: string | null) {
  return createHash("sha256").update(canonical({ contentHash, staffId, explanation, note, ...(reportHash ? { reportHash } : {}) })).digest("hex");
}
export function sharedReportHash(contentHash: string, details: unknown, submittedById: string, submittedByName: string) {
  return createHash("sha256").update(canonical({ contentHash, details, submittedById, submittedByName })).digest("hex");
}
export function verifyParticipantResponses(doc: { kind?: string; workflowVersion?: number; contentHash: string | null; contentVersion: number; incidentReport?: { details: unknown; submittedById: string; submittedByName: string; reportHash: string } | null; participants: { staffId: string; explanation: string; responseNote: string }[]; signatures: { contentVersion: number; purpose: string; signerId: string; responseHash: string | null; reportHash?: string | null }[] }) {
  if (!doc.contentHash) return;
  const report = doc.incidentReport;
  if (report && (sharedReportHash(doc.contentHash, report.details, report.submittedById, report.submittedByName) !== report.reportHash || !doc.participants.some((p) => p.staffId === report.submittedById))) throw new DocumentError(409, "The shared incident report failed its integrity check.");
  for (const sig of doc.signatures) {
    if (sig.contentVersion !== doc.contentVersion || sig.purpose !== "acknowledged") continue;
    if (doc.kind === "IR" && doc.workflowVersion === 3 && (!report || sig.reportHash !== report.reportHash || !sig.responseHash)) throw new DocumentError(409, "A staff signature does not match the shared incident report.");
    if (!sig.responseHash) continue;
    const participant = doc.participants.find((p) => p.staffId === sig.signerId);
    if (!participant || sig.responseHash !== participantResponseHash(doc.contentHash, sig.signerId, participant.explanation, participant.responseNote, sig.reportHash)) throw new DocumentError(409, "A staff response failed its signature integrity check. Contact management.");
  }
}
export function validateSignature(image: string | undefined) {
  if (!image) throw new DocumentError(400, "Draw your signature before continuing.");
  const bytes = Buffer.from(image.split(",")[1], "base64");
  if (bytes.length < 100 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new DocumentError(400, "A valid PNG signature is required.");
  }
  if (bytes.readUInt32BE(16) !== 400 || bytes.readUInt32BE(20) !== 140) throw new DocumentError(400, "Use the signature pad to sign this document.");
  // Bound decompression and reject truncated/invalid PNG payloads before storing a signature.
  try {
    if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[28] !== 0) throw new Error("Unsupported PNG");
    const channels = bytes[25] === 6 ? 4 : 3;
    const expected = (400 * channels + 1) * 140;
    const chunks: Buffer[] = [];
    let offset = 8, ended = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      if (length > bytes.length - offset - 12) throw new Error("Truncated PNG");
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      if (type === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
      if (type === "IEND") { ended = true; break; }
    }
    if (!ended || !chunks.length) throw new Error("Incomplete PNG");
    const pixels = inflateSync(Buffer.concat(chunks), { maxOutputLength: expected });
    if (pixels.length !== expected) throw new Error("Invalid PNG pixels");
    for (let row = 0; row < 140; row++) if (pixels[row * (400 * channels + 1)] > 4) throw new Error("Invalid PNG filter");
  } catch { throw new DocumentError(400, "The signature image is invalid. Clear the pad and sign again."); }
  return image;
}
export async function documentEvent(tx: Prisma.TransactionClient, user: SessionUser, doc: { id: string; branchId: string; contentVersion: number }, action: string, note = "") {
  await tx.documentEvent.create({ data: { documentId: doc.id, actorId: user.id, actorName: user.fullName, action, note: note || null, version: doc.contentVersion } });
  await tx.auditLog.create({ data: { branchId: doc.branchId, userId: user.id, userName: user.fullName, role: user.role, action: `DOCUMENT_${action}`, entity: "StaffDocument", entityId: doc.id, description: `Staff document ${action.toLowerCase().replaceAll("_", " ")}` } });
}
export async function documentNotices(tx: Prisma.TransactionClient, documentId: string, staffIds: string[], message: string) {
  const ids = [...new Set(staffIds)];
  if (ids.length) await tx.documentNotice.createMany({ data: ids.map((staffId) => ({ documentId, staffId, message })) });
}
