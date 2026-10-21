import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { defaultDocumentContent, defaultSharedIncident } from "../src/lib/staff-documents";

test("document API enforces identity, branch, approval, locking, signatures, and revisions", async () => {
  process.env.JWT_SECRET = "staff-document-tests-only-32-character-secret";
  const { prisma } = require("../src/lib/prisma") as typeof import("../src/lib/prisma");
  const collection = require("../src/app/api/documents/route") as typeof import("../src/app/api/documents/route");
  const detail = require("../src/app/api/documents/[id]/route") as typeof import("../src/app/api/documents/[id]/route");
  const actions = require("../src/app/api/documents/[id]/actions/route") as typeof import("../src/app/api/documents/[id]/actions/route");
  const pdfRoute = require("../src/app/api/documents/[id]/pdf/route") as typeof import("../src/app/api/documents/[id]/pdf/route");
  const { documentHash } = require("../src/lib/staff-documents-server") as typeof import("../src/lib/staff-documents-server");
  const people = [
    { id: "tl", role: "team_leader", branchId: "a" }, { id: "staff", role: "counter_admin", branchId: "a" },
    { id: "admin", role: "admin", branchId: "a" }, { id: "outsider", role: "admin", branchId: "b" },
    { id: "other", role: "computer_tech", branchId: "a" }, { id: "management", role: "management", branchId: "a" },
  ].map((p) => ({ ...p, username: p.id, fullName: p.id, status: "active", mustChangePassword: false }));
  type TestDocument = Record<string, any>;
  const db = { docs: [] as TestDocument[], signatures: [] as TestDocument[], events: [] as TestDocument[], notices: [] as TestDocument[], audits: [] as TestDocument[] };
  let currentUser = people[0];
  let failAudit = false;
  const match = (row: TestDocument, where: TestDocument) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    branch: { findUnique: async ({ where }: TestDocument) => ({ id: where.id, name: `Branch ${where.id}`, active: true }) },
    staffProfile: {
      findUnique: async ({ where }: TestDocument) => people.find((p) => p.id === where.id) || null,
      findMany: async ({ where }: TestDocument) => where.id?.in ? people.filter((p) => where.id.in.includes(p.id) && p.branchId === where.branchId && p.status === "active") : people.filter((p) => p.role === "admin" && p.branchId === "a" && !where.id?.notIn?.includes(p.id)),
    },
    staffDocument: {
      create: async ({ data }: TestDocument) => {
        const doc = { id: `doc-${db.docs.length + 1}`, status: "draft", contentVersion: 1, lockVersion: 1, revision: 1, contentHash: null, supersedesId: null, incidentReport: null, createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
        doc.participants = (data.participants?.create || []).map((p: TestDocument, index: number) => ({ id: `${doc.id}-participant-${index}`, documentId: doc.id, status: "pending", explanation: "", responseNote: "", respondedAt: null, ...p }));
        db.docs.push(doc); return structuredClone(doc);
      },
      findUnique: async ({ where, include }: TestDocument) => {
        const doc = db.docs.find((d) => d.id === where.id); if (!doc) return null;
        const result = structuredClone(doc);
        if (include?.revisedBy) result.revisedBy = structuredClone(db.docs.find((d) => d.supersedesId === doc.id) || null);
        if (include?.signatures) result.signatures = structuredClone(db.signatures.filter((s) => s.documentId === doc.id));
        if (include?.events) result.events = structuredClone(db.events.filter((e) => e.documentId === doc.id));
        return result;
      },
      updateMany: async ({ where, data }: TestDocument) => {
        const doc = db.docs.find((d) => match(d, where)); if (!doc) return { count: 0 };
        for (const [key, value] of Object.entries(data)) doc[key] = value && typeof value === "object" && "increment" in value ? doc[key] + (value as { increment: number }).increment : value;
        return { count: 1 };
      },
      update: async ({ where, data }: TestDocument) => { const doc = db.docs.find((d) => d.id === where.id)!; Object.assign(doc, data); return doc; },
    },
    sharedIncidentReport: {
      create: async ({ data }: TestDocument) => { const doc = db.docs.find((d) => d.id === data.documentId)!; if (doc.incidentReport) throw new Error("Duplicate shared report"); const report = { id: "report-" + doc.id, submittedAt: new Date(), ...structuredClone(data) }; doc.incidentReport = report; return report; },
    },
    documentParticipant: {
      deleteMany: async ({ where }: TestDocument) => { db.docs.find((d) => d.id === where.documentId)!.participants = []; },
      createMany: async ({ data }: TestDocument) => { for (const p of data) { const d = db.docs.find((d) => d.id === p.documentId)!; d.participants.push({ id: d.id + "-participant-" + d.participants.length, status: "pending", explanation: "", responseNote: "", respondedAt: null, ...p }); } },
      update: async ({ where, data }: TestDocument) => { const p = db.docs.flatMap((d) => d.participants).find((p) => p.id === where.id)!; Object.assign(p, data); return p; },
    },
    documentSignature: {
      findFirst: async ({ where }: TestDocument) => db.signatures.find((s) => Object.entries(where).every(([key, value]) => typeof value === "object" && value !== null && "in" in value ? (value as { in: string[] }).in.includes(s[key]) : s[key] === value)) || null,
      create: async ({ data }: TestDocument) => { const sig = { id: `sig-${db.signatures.length}`, signedAt: new Date(), ...data }; db.signatures.push(sig); return sig; },
      findUnique: async ({ where }: TestDocument) => db.signatures.find((s) => match(s, where.documentId_contentVersion_purpose)) || null,
    },
    documentEvent: { create: async ({ data }: TestDocument) => { db.events.push({ id: `event-${db.events.length}`, createdAt: new Date(), ...data }); } },
    auditLog: { create: async ({ data }: TestDocument) => { if (failAudit) throw new Error("Simulated audit failure"); db.audits.push(data); } },
    documentNotice: { createMany: async ({ data }: TestDocument) => { db.notices.push(...data); }, updateMany: async () => ({ count: 1 }) },
  };
  const originalTransaction = prisma.$transaction;
  const originalFind = prisma.staffDocument.findUnique;
  const originalFindMany = prisma.staffDocument.findMany;
  const originalCount = prisma.staffDocument.count;
  let lastListWhere: TestDocument = {};
  const originalSession = prisma.staffSession.findUnique;
  (prisma as any).$transaction = async (fn: (client: typeof tx) => unknown) => {
    const snapshot = structuredClone(db);
    try { return await fn(tx); } catch (error) { Object.assign(db, snapshot); throw error; }
  };
  (prisma.staffDocument as any).findUnique = tx.staffDocument.findUnique;
  (prisma.staffDocument as any).findMany = async ({ where }: TestDocument) => { lastListWhere = where; return []; };
  (prisma.staffDocument as any).count = async () => 0;
  (prisma.staffSession as any).findUnique = async () => ({ staffId: currentUser.id, expiresAt: new Date(Date.now() + 60000), staff: currentUser });
  const token = async () => new SignJWT({ staffId: currentUser.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const req = async (method: string, body?: unknown, origin = "http://localhost:3000") => new NextRequest("http://localhost:3000/api/documents", { method, headers: { cookie: `marvs_session=${await token()}`, origin, "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const context = (id = "doc-1") => ({ params: Promise.resolve({ id }) });
  const ir = defaultDocumentContent("IR");
  const reportDetails = { ...defaultSharedIncident(), witnesses: "Staff Two", personsInvolved: "None", whatHappened: "Keyboard damaged", howHappened: "It stopped responding during the shift", equipment: "PC-07 keyboard", actionsTaken: "Spare keyboard installed" };
  const input = { kind: "IR", title: "Incident test", branchId: "a", participantIds: ["staff"], content: ir };
  const signImage = (() => {
    // Real PNG validates signature decoding and PDF embedding without a browser canvas.
    const pixels = new Uint8ClampedArray(400 * 140 * 4); for (let x = 80; x < 280; x++) { const offset = (70 * 400 + x) * 4; pixels[offset + 3] = 255; }
    // PNG encoder using Node zlib keeps this test independent of browser canvas.
    const { deflateSync } = require("node:zlib");
    const crc = (bytes: Buffer) => { let c = 0xffffffff; for (const byte of bytes) { c ^= byte; for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type: string, data: Buffer) => { const name = Buffer.from(type), len = Buffer.alloc(4), checksum = Buffer.alloc(4); len.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([len, name, data, checksum]); };
    const header = Buffer.alloc(13); header.writeUInt32BE(400); header.writeUInt32BE(140, 4); header[8] = 8; header[9] = 6;
    const scan = Buffer.alloc((400 * 4 + 1) * 140); for (let y = 0; y < 140; y++) Buffer.from(pixels.buffer, y * 400 * 4, 400 * 4).copy(scan, y * (400 * 4 + 1) + 1);
    return `data:image/png;base64,${Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(scan)), chunk("IEND", Buffer.alloc(0))]).toString("base64")}`;
  })();
  const action = async (name: string, extra: TestDocument = {}, id = "doc-1") => {
    const doc = db.docs.find((d) => d.id === id)!;
    return actions.POST(await req("POST", { action: name, lockVersion: doc.lockVersion, confirmed: true, signature: signImage, explanation: "The issue occurred during my shift; I reported it immediately.", ...extra }), context(id));
  };
  try {
    assert.equal((await collection.POST(await req("POST", input, "https://other.example"))).status, 403);
    currentUser.mustChangePassword = true;
    assert.equal((await collection.POST(await req("POST", input))).status, 403); currentUser.mustChangePassword = false;
    currentUser = people[1]; assert.equal((await collection.POST(await req("POST", input))).status, 403);
    currentUser = people[0];
    assert.equal((await collection.POST(await req("POST", { ...input, branchId: "b" }))).status, 403);
    assert.equal((await collection.POST(await req("POST", { ...input, participantIds: ["outsider"] }))).status, 400);
    assert.equal((await collection.POST(await req("POST", { ...input, content: { ...ir, howHappened: "Initiator supplied reason" } }))).status, 400);
    assert.equal((await collection.POST(await req("POST", input))).status, 201);
    assert.equal(db.audits.length, 1);
    assert.equal((await collection.GET(new NextRequest("http://localhost:3000/api/documents?branchId=b", { headers: { cookie: `marvs_session=${await token()}` } }))).status, 403);
    assert.equal((await collection.GET(new NextRequest("http://localhost:3000/api/documents?branchId=a", { headers: { cookie: `marvs_session=${await token()}` } }))).status, 200);
    assert.equal(lastListWhere.createdById, "tl"); assert.equal(lastListWhere.branchId, "a");
    currentUser = people[3]; assert.equal((await detail.GET(await req("GET"), context())).status, 404);
    currentUser = people[1]; assert.equal((await detail.GET(await req("GET"), context())).status, 404);
    assert.equal((await collection.GET(await req("GET"))).status, 200);
    assert.equal(lastListWhere.participants.some.staffId, "staff"); assert.deepEqual(lastListWhere.status.in, ["awaiting_acknowledgment", "completed", "declined"]);
    currentUser = people[0];
    assert.equal((await action("submit", { signature: "data:image/png;base64,AAAA" })).status, 400);
    assert.equal(db.docs[0].status, "draft");
    assert.equal((await action("submit")).status, 200);
    assert.equal(db.docs[0].contentHash, documentHash(db.docs[0] as any));
    assert.equal(db.notices[0].staffId, "admin");
    assert.equal((await action("approve")).status, 403);
    currentUser = people[2];
    assert.equal((await action("approve", { lockVersion: 1 })).status, 409);
    assert.equal((await action("return", { note: "Clarify the event" })).status, 200);
    currentUser = people[0];
    assert.equal((await action("submit")).status, 400);
    assert.equal((await detail.PUT(await req("PUT", { ...input, lockVersion: db.docs[0].lockVersion }), context())).status, 200);
    assert.equal((await action("submit")).status, 200);
    currentUser = people[2];
    failAudit = true;
    const originalError = console.error; console.error = () => {};
    try { assert.equal((await action("approve")).status, 500); } finally { console.error = originalError; failAudit = false; }
    assert.equal(db.docs[0].status, "pending_review");
    assert.equal(db.signatures.some((s) => s.purpose === "approved"), false);
    assert.equal((await action("approve")).status, 200);
    currentUser = people[4]; assert.equal((await action("acknowledge")).status, 404);
    currentUser = people[1];
    assert.equal((await detail.GET(await req("GET"), context())).status, 200);
    assert.equal((await action("acknowledge")).status, 400);
    assert.equal((await action("submit_report", { incidentDetails: reportDetails })).status, 200);
    assert.equal((await action("acknowledge", { confirmed: false })).status, 400);
    assert.equal((await action("acknowledge", { note: "Received with explanation" })).status, 200);
    assert.equal(db.docs[0].status, "completed");
    assert.equal((await action("acknowledge")).status, 403);
    const response = await pdfRoute.GET(await req("GET"), context());
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/pdf");
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    currentUser = people[0];
    assert.equal((await detail.PUT(await req("PUT", { ...input, lockVersion: db.docs[0].lockVersion }), context())).status, 403);
    const revised = await action("revise"); assert.equal(revised.status, 200);
    assert.equal(db.docs[1].supersedesId, "doc-1"); assert.equal(db.docs[1].revision, 2);
    assert.equal(db.signatures.some((s) => s.documentId === db.docs[1].id), false);
    assert.equal((await action("revise")).status, 409);
    // The second template follows the same approval path and supports a recorded refusal.
    assert.equal((await collection.POST(await req("POST", { ...input, kind: "MEMO", title: "Equipment memo", content: defaultDocumentContent("MEMO") }))).status, 201);
    assert.equal((await action("submit", {}, "doc-3")).status, 200);
    currentUser = people[2]; assert.equal((await action("approve", {}, "doc-3")).status, 200);
    currentUser = people[1];
    assert.equal((await action("decline", { note: "" }, "doc-3")).status, 400);
    assert.equal((await action("decline", { note: "Equipment list needs correction" }, "doc-3")).status, 200);
    assert.equal(db.docs[2].status, "declined");
    assert.equal(db.signatures.some((s) => s.documentId === "doc-3" && s.purpose === "acknowledged"), false);

    // Management initiates with exactly one official signature, and each participant responds independently.
    currentUser = people[5];
    assert.equal((await collection.POST(await req("POST", { ...input, participantIds: ["staff", "other"] }))).status, 201);
    assert.equal((await action("submit", {}, "doc-4")).status, 200);
    assert.equal(db.docs[3].status, "awaiting_acknowledgment");
    assert.equal(db.signatures.filter((s) => s.documentId === "doc-4").length, 1);
    assert.equal(db.signatures.find((s) => s.documentId === "doc-4")!.purpose, "initiated_approved");
    assert.equal((await action("acknowledge", {}, "doc-4")).status, 403);
    currentUser = people[1];
    assert.equal((await action("acknowledge", { explanation: "" }, "doc-4")).status, 400);
    assert.equal((await action("acknowledge", { staffId: "other" }, "doc-4")).status, 400);
    currentUser = people[5];
    assert.equal((await action("submit_report", { incidentDetails: reportDetails }, "doc-4")).status, 403);
    currentUser = people[1];
    assert.equal((await action("submit_report", { incidentDetails: { ...reportDetails, witnesses: ["invalid"] } }, "doc-4")).status, 400);
    assert.equal((await action("submit_report", { incidentDetails: reportDetails, confirmed: false }, "doc-4")).status, 400);
    assert.equal((await action("submit_report", { incidentDetails: reportDetails }, "doc-4")).status, 200);
    assert.equal(db.docs[3].incidentReport.submittedById, "staff");
    assert.equal((await action("acknowledge", { explanation: "" }, "doc-4")).status, 200);
    assert.equal(db.docs[3].status, "awaiting_acknowledgment");
    assert.equal(db.docs[3].participants.find((p: TestDocument) => p.staffId === "other").explanation, "");
    assert.equal((await action("acknowledge", {}, "doc-4")).status, 403);
    currentUser = people[4];
    assert.equal((await action("submit_report", { incidentDetails: { ...reportDetails, whatHappened: "Overwritten" } }, "doc-4")).status, 409);
    assert.equal(db.docs[3].incidentReport.details.whatHappened, reportDetails.whatHappened);
    assert.equal((await action("acknowledge", { lockVersion: 2 }, "doc-4")).status, 409);
    assert.equal((await action("acknowledge", { explanation: "A different participant's account" }, "doc-4")).status, 200);
    assert.equal(db.docs[3].status, "completed");
    assert.equal(db.signatures.filter((s) => s.documentId === "doc-4" && s.purpose === "acknowledged").length, 2);
    assert.ok(db.signatures.find((s) => s.documentId === "doc-4" && s.signerId === "staff")!.responseHash);
    assert.equal(db.signatures.find((s) => s.documentId === "doc-4" && s.signerId === "staff")!.reportHash, db.signatures.find((s) => s.documentId === "doc-4" && s.signerId === "other")!.reportHash);
    assert.equal((await pdfRoute.GET(await req("GET"), context("doc-4"))).status, 200);
    const preview = await pdfRoute.GET(new NextRequest("http://localhost:3000/api/documents/doc-4/pdf?preview=1", { headers: { cookie: `marvs_session=${await token()}` } }), context("doc-4"));
    assert.equal(preview.status, 200); assert.match(preview.headers.get("content-disposition") || "", /^inline;/);
    db.docs[3].incidentReport.details.witnesses = "Tampered after signing";
    assert.equal((await pdfRoute.GET(await req("GET"), context("doc-4"))).status, 409);
    assert.equal((await detail.GET(await req("GET"), context("doc-4"))).status, 409);
    currentUser = people[5];
    await tx.staffDocument.create({ data: { ...db.docs[3], id: "doc-5", status: "draft", contentHash: null, signatures: [], initiatedByRole: "management", workflowVersion: 2, content: { ...reportDetails, whatHappened: "" }, incidentReport: null, participants: { create: [{ staffId: "staff", staffName: "staff" }] } } });
    assert.equal((await action("submit", {}, "doc-5")).status, 200);
    assert.equal(db.docs[4].workflowVersion, 3);
    assert.deepEqual(db.docs[4].content, { instructions: "" });
    assert.ok(db.events.some((e) => e.documentId === "doc-5" && e.action === "IR_DRAFT_UPGRADED"));
    await tx.staffDocument.create({ data: { ...db.docs[4], id: "doc-6", status: "awaiting_acknowledgment", workflowVersion: 2, content: reportDetails, incidentReport: null, participants: { create: [{ staffId: "staff", staffName: "staff" }] } } });
    db.docs[5].contentHash = documentHash(db.docs[5] as any);
    db.signatures.push({ documentId: "doc-6", contentVersion: db.docs[5].contentVersion, contentHash: db.docs[5].contentHash, purpose: "approved", signerId: "management" });
    currentUser = people[1];
    assert.equal((await action("acknowledge", {}, "doc-6")).status, 200);
    assert.equal(db.docs[5].workflowVersion, 2);
    assert.equal(db.docs[5].incidentReport, null);
    currentUser = people[3]; assert.equal((await pdfRoute.GET(await req("GET"), context())).status, 404);
    currentUser = people[1]; db.docs[0].title = "Tampered";
    assert.equal((await pdfRoute.GET(await req("GET"), context())).status, 409);
  } finally {
    prisma.$transaction = originalTransaction; prisma.staffDocument.findUnique = originalFind; prisma.staffDocument.findMany = originalFindMany; prisma.staffDocument.count = originalCount; prisma.staffSession.findUnique = originalSession;
  }
});
