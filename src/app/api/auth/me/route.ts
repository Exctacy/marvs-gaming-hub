import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branch = user.branchId
    ? await prisma.branch.findUnique({ where: { id: user.branchId } })
    : null;

  return NextResponse.json({
    ...user,
    branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
  });
}
