import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, canManageStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStaff(user.role) && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  const where: any = {};
  // Branch admins only see their branch logs (+ global null branch)
  if (user.role === "admin" && user.branchId) {
    where.OR = [{ branchId: user.branchId }, { branchId: null }];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      ...l,
      user_name: l.userName,
      created_date: l.createdAt,
    })),
  });
}
