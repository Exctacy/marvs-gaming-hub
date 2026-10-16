import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPrepareDocuments, isGlobalDocumentManager } from "@/lib/staff-documents";
import { DocumentError, documentBranch, documentFailure, documentUser } from "@/lib/staff-documents-server";

export async function GET(req: NextRequest) {
  try {
    const user = await documentUser(req);
    if (!canPrepareDocuments(user.role)) throw new DocumentError(403, "Forbidden");
    const branchId = documentBranch(user, req.nextUrl.searchParams.get("branchId"));
    const [branches, staff] = await Promise.all([
      prisma.branch.findMany({ where: { active: true, ...(!isGlobalDocumentManager(user.role) ? { id: user.branchId || "" } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.staffProfile.findMany({ where: { branchId, status: "active", id: { not: user.id } }, select: { id: true, fullName: true, role: true }, orderBy: { fullName: "asc" } }),
    ]);
    return NextResponse.json({ branches, staff }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return documentFailure(e); }
}
