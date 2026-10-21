import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canPrepareDocuments, canApproveDocuments, documentInputSchema } from "@/lib/staff-documents";
import { DocumentError, documentBody, documentBranch, documentEvent, documentFailure, documentUser, validateDocumentParticipants } from "@/lib/staff-documents-server";

export async function GET(req: NextRequest) {
  try {
    const user = await documentUser(req);
    const params = req.nextUrl.searchParams;
    const mine = params.get("view") === "mine" || (!canPrepareDocuments(user.role) && !canApproveDocuments(user.role));
    const where: Prisma.StaffDocumentWhereInput = mine
      ? { participants: { some: { staffId: user.id } }, status: { in: ["awaiting_acknowledgment", "completed", "declined"] } }
      : { branchId: documentBranch(user, params.get("branchId")), ...(!canApproveDocuments(user.role) ? { createdById: user.id } : {}) };
    const status = params.get("status");
    if (status) where.AND = [{ status }];
    const q = params.get("q")?.trim().slice(0, 160);
    if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { recipientName: { contains: q, mode: "insensitive" } }];
    const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
    if (!Number.isInteger(page)) throw new DocumentError(400, "Invalid page.");
    const [documents, total, awaitingSignature] = await Promise.all([
      prisma.staffDocument.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20,
        select: { id: true, kind: true, title: true, branchName: true, recipientName: true, preparedByName: true, status: true, revision: true, createdAt: true } }),
      prisma.staffDocument.count({ where }),
      prisma.staffDocument.count({ where: { participants: { some: { staffId: user.id, status: "pending" } }, status: "awaiting_acknowledgment" } }),
    ]);
    return NextResponse.json({ documents, total, page, awaitingSignature }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return documentFailure(e); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await documentUser(req, true);
    if (!canPrepareDocuments(user.role)) throw new DocumentError(403, "Only Team Leaders and managers can prepare staff documents.");
    const parsed = documentInputSchema.safeParse(await documentBody(req));
    if (!parsed.success) throw new DocumentError(400, parsed.error.issues[0]?.message || "Invalid document.");
    const body = parsed.data;
    const branchId = documentBranch(user, body.branchId);
    const document = await prisma.$transaction(async (tx) => {
      const { branch, participants } = await validateDocumentParticipants(tx, branchId, body.participantIds, user.id);

      const doc = await tx.staffDocument.create({ data: { kind: body.kind, title: body.title, branchId, branchName: branch.name, recipientId: participants[0].staffId, recipientName: participants.map((p) => p.staffName).join(", "), initiatedByRole: user.role, workflowVersion: body.kind === "IR" ? 3 : 2, participants: { create: participants }, createdById: user.id, preparedByName: user.fullName, content: body.content } });
      await documentEvent(tx, user, doc, "CREATED");
      return doc;
    });
    return NextResponse.json({ id: document.id }, { status: 201 });
  } catch (e) { return documentFailure(e); }
}
