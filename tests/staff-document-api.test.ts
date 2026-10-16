import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { defaultDocumentContent } from "../src/lib/staff-documents";

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
    { id: "other", role: "computer_tech", branchId: "a" },
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
      findMany: async () => people.filter((p) => p.role === "admin" && p.branchId === "a"),
    },
    staffDocument: {
      create: async ({ data }: TestDocument) => {
        const doc = { id: `doc-${db.docs.length + 1}`, status: "draft", contentVersion: 1, lockVersion: 1, revision: 1, contentHash: null, supersedesId: null, createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
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
    documentSignature: {
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
  const ir = { ...defaultDocumentContent("IR"), whatHappened: "Keyboard damaged", howHappened: "Reported after shift", actionsTaken: "Spare keyboard installed" };
  const input = { kind: "IR", title: "Incident test", branchId: "a", recipientId: "staff", content: ir };
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
    return actions.POST(await req("POST", { action: name, lockVersion: doc.lockVersion, confirmed: true, signature: signImage, ...extra }), context(id));
  };
  try {
    assert.equal((await collection.POST(await req("POST", input, "https://other.example"))).status, 403);
    currentUser.mustChangePassword = true;
    assert.equal((await collection.POST(await req("POST", input))).status, 403); currentUser.mustChangePassword = false;
    currentUser = people[1]; assert.equal((await collection.POST(await req("POST", input))).status, 403);
    currentUser = people[0];
    assert.equal((await collection.POST(await req("POST", { ...input, branchId: "b" }))).status, 403);
    assert.equal((await collection.POST(await req("POST", { ...input, recipientId: "outsider" }))).status, 400);
    assert.equal((await collection.POST(await req("POST", input))).status, 201);
    assert.equal(db.audits.length, 1);
    assert.equal((await collection.GET(new NextRequest("http://localhost:3000/api/documents?branchId=b", { headers: { cookie: `marvs_session=${await token()}` } }))).status, 403);
    assert.equal((await collection.GET(new NextRequest("http://localhost:3000/api/documents?branchId=a", { headers: { cookie: `marvs_session=${await token()}` } }))).status, 200);
    assert.equal(lastListWhere.createdById, "tl"); assert.equal(lastListWhere.branchId, "a");
    currentUser = people[3]; assert.equal((await detail.GET(await req("GET"), context())).status, 404);
    currentUser = people[1]; assert.equal((await detail.GET(await req("GET"), context())).status, 404);
    assert.equal((await collection.GET(await req("GET"))).status, 200);
    assert.equal(lastListWhere.recipientId, "staff"); assert.deepEqual(lastListWhere.status.in, ["awaiting_acknowledgment", "completed", "declined"]);
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
    currentUser = people[3]; assert.equal((await pdfRoute.GET(await req("GET"), context())).status, 404);
    currentUser = people[1]; db.docs[0].title = "Tampered";
    assert.equal((await pdfRoute.GET(await req("GET"), context())).status, 409);
  } finally {
    prisma.$transaction = originalTransaction; prisma.staffDocument.findUnique = originalFind; prisma.staffDocument.findMany = originalFindMany; prisma.staffDocument.count = originalCount; prisma.staffSession.findUnique = originalSession;
  }
});
