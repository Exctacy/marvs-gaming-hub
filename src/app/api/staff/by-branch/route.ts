import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchId = req.nextUrl.searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json({ error: "branchId required" }, { status: 400 });
  }

  // Branch lock: user can only view staff from their own branch (except super_admin/management)
  if (user.branchId && branchId !== user.branchId && !["super_admin", "management"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await prisma.staffProfile.findMany({
    where: {
      branchId,
      status: "active",
      role: {
        in: ["admin", "computer_tech", "team_leader", "management"],
      },
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
