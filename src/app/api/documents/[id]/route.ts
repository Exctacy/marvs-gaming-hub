import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadDocument, canEditDocument, documentInputSchema } from "@/lib/staff-documents";
import { DocumentError, documentBody, documentEvent, documentFailure, documentUser, validateDocumentParticipants, documentHash, verifyParticipantResponses } from "@/lib/staff-documents-server";

type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const user = await documentUser(req);
    const { id } = await params;
    const document = await prisma.staffDocument.findUnique({ where: { id }, include: { incidentReport: true, participants: { orderBy: { id: "asc" } }, signatures: { orderBy: { signedAt: "asc" } }, events: { orderBy: { createdAt: "asc" } }, revisedBy: { select: { id: true, revision: true } } } });
    if (!document || !canReadDocument(user, document)) throw new DocumentError(404, "Document not found.");
    if (document.contentHash && document.contentHash !== documentHash(document)) throw new DocumentError(409, "Document integrity check failed. Contact management.");
    verifyParticipantResponses(document);
    return NextResponse.json({ document }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return documentFailure(e); }
}
export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const user = await documentUser(req, true);
    const { id } = await params;
    const raw = await documentBody(req);
    const { lockVersion, ...input } = raw || {};
    if (!Number.isInteger(lockVersion) || lockVersion < 1) throw new DocumentError(400, "Missing document version.");
    const parsed = documentInputSchema.safeParse(input);
    if (!parsed.success) throw new DocumentError(400, parsed.error.issues[0]?.message || "Invalid document.");
    const body = parsed.data;
    await prisma.$transaction(async (tx) => {
      const doc = await tx.staffDocument.findUnique({ where: { id }, include: { participants: true } });
      if (!doc || !canReadDocument(user, doc)) throw new DocumentError(404, "Document not found.");
      if (!canEditDocument(user, doc)) throw new DocumentError(403, "Only the preparer can edit a draft or returned document.");
      if (body.branchId !== doc.branchId || body.kind !== doc.kind) throw new DocumentError(400, "Document type and branch cannot change.");
      const { participants } = await validateDocumentParticipants(tx, doc.branchId, body.participantIds, user.id);

      const result = await tx.staffDocument.updateMany({ where: { id, lockVersion, status: doc.status }, data: { title: body.title, workflowVersion: body.kind === "IR" ? 3 : 2, initiatedByRole: user.role, recipientId: participants[0].staffId, recipientName: participants.map((p) => p.staffName).join(", "), content: body.content, contentHash: null, contentVersion: { increment: 1 }, lockVersion: { increment: 1 } } });
      if (!result.count) throw new DocumentError(409, "This document changed. Refresh before editing.");
      await tx.documentParticipant.deleteMany({ where: { documentId: id } });
      await tx.documentParticipant.createMany({ data: participants.map((p) => ({ ...p, documentId: id })) });
      await documentEvent(tx, user, { ...doc, contentVersion: doc.contentVersion + 1 }, "DRAFT_SAVED");
    });
    return NextResponse.json({ success: true });
  } catch (e) { return documentFailure(e); }
}
