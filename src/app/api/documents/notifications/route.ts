import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadDocument } from "@/lib/staff-documents";
import { documentBody, documentFailure, documentUser, DocumentError } from "@/lib/staff-documents-server";

export async function GET(req: NextRequest) {
  try {
    const user = await documentUser(req);
    const notices = await prisma.documentNotice.findMany({ where: { staffId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 50, include: { document: { select: { createdById: true, recipientId: true, branchId: true, status: true } } } });
    return NextResponse.json({ notices: notices.filter((n) => canReadDocument(user, n.document)).map(({ document: _document, ...notice }) => notice) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return documentFailure(e); }
}
export async function PATCH(req: NextRequest) {
  try {
    const user = await documentUser(req, true);
    const body = await documentBody(req);
    if (!Array.isArray(body?.ids) || body.ids.length > 50 || !body.ids.every((id: unknown) => typeof id === "string")) throw new DocumentError(400, "Choose notifications to mark as read.");
    await prisma.documentNotice.updateMany({ where: { staffId: user.id, id: { in: body.ids }, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (e) { return documentFailure(e); }
}
