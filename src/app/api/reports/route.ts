import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, resolveBranchId, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { reportSchema } from "@/lib/api-schemas";
import { safeJsonParse } from "@/lib/json";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedBranch = searchParams.get("branchId");
  const branchId = resolveBranchId(user, requestedBranch);
  if (!branchId) return NextResponse.json({ error: "Branch required" }, { status: 400 });

  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const includeData = searchParams.get("includeData") === "1";
  const limit = Math.min(includeData ? 500 : 100, Math.max(1, parseInt(searchParams.get("limit") || "5") || 5));
  const status = searchParams.get("status");
  const shift = searchParams.get("shift");
  const date = searchParams.get("date");
  const query = searchParams.get("q")?.trim();
  const skip = (page - 1) * limit;

  const where: any = { branchId };
  if (status) where.status = status;
  if (shift) where.shift = shift;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.reportDate = { gte: start, lt: end };
  }
  if (query) {
    where.OR = [
      { shift: { contains: query } },
      { adminName: { contains: query } },
      { techName: { contains: query } },
      { followUp: { contains: query } },
    ];
  }

  const select = {
    id: true,
    branchId: true,
    reportDate: true,
    shift: true,
    adminName: true,
    techName: true,
    status: true,
    changes: true,
    followUp: true,
    createdByName: true,
    createdAt: true,
    updatedAt: true,
    ...(includeData ? { reportData: true } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.gamingReport.findMany({
      where,
      orderBy: { reportDate: "desc" },
      skip,
      take: limit,
      select,
    }),
    prisma.gamingReport.count({ where }),
  ]);

  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      ...(includeData && "reportData" in r
        ? { reportData: safeJsonParse(r.reportData as string, {}) }
        : {}),
    })),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = reportSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report data", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const branchId = resolveBranchId(user, body.branchId);
  if (!branchId) return NextResponse.json({ error: "Branch required" }, { status: 400 });

  const report = await prisma.gamingReport.create({
    data: {
      branchId,
      reportDate: new Date(body.reportDate),
      shift: body.shift,
      adminName: body.adminName || null,
      techName: body.techName || null,
      status: body.status || "draft",
      changes: body.changes || null,
      followUp: body.followUp || null,
      reportData: JSON.stringify(body.reportData || {}),
      createdByName: user.fullName,
      createdById: user.id,
    },
  });

  await writeAuditLog({
    user,
    action: body.status === "submitted" ? "SUBMIT_REPORT" : "CREATE_DRAFT",
    entity: "GamingReport",
    entityId: report.id,
    description: `${body.status === "submitted" ? "Submitted" : "Created draft"} ${body.shift} report for ${body.reportDate}`,
    branchId,
  });

  return NextResponse.json({
    ...report,
    reportData: safeJsonParse(report.reportData, {}),
  });
}
