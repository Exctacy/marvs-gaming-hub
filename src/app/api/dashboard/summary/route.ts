import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, resolveBranchId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchId = resolveBranchId(user, new URL(req.url).searchParams.get("branchId"));
  if (!branchId) return NextResponse.json({ error: "Branch required" }, { status: 400 });

  const baseWhere = { branchId };
  const [totalReports, draftCount, submittedCount, openFollowUps, recent] = await Promise.all([
    prisma.gamingReport.count({ where: baseWhere }),
    prisma.gamingReport.count({ where: { ...baseWhere, status: "draft" } }),
    prisma.gamingReport.count({ where: { ...baseWhere, status: "submitted" } }),
    prisma.gamingReport.count({ where: { ...baseWhere, followUp: { not: null } } }),
    prisma.gamingReport.findMany({
      where: baseWhere,
      orderBy: { reportDate: "desc" },
      take: 5,
      select: {
        id: true,
        shift: true,
        reportDate: true,
        status: true,
        createdByName: true,
      },
    }),
  ]);

  return NextResponse.json({
    totalReports,
    draftCount,
    submittedCount,
    openFollowUps,
    recent,
  });
}