import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, canSwitchBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchId = req.nextUrl.searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  // Only global managers may request staff from another branch.
  if (!canSwitchBranch(user.role) && (!user.branchId || branchId !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await prisma.staffProfile.findMany({
    where: {
      branchId,
      status: "active",
    },
    select: {
      id: true,
      fullName: true,
      role: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ staff });
}
