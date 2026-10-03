import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromRequest,
  canDeleteAnyReport,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { reportUpdateSchema } from "@/lib/api-schemas";
import { safeJsonParse } from "@/lib/json";

function parseReport(r: any) {
  return {
    ...r,
    reportData: typeof r.reportData === "string" ? safeJsonParse(r.reportData, {}) : r.reportData,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.gamingReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Branch lock
  if (user.branchId && report.branchId !== user.branchId && !["super_admin", "management"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ report: parseReport(report) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.gamingReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canAccessAllBranches = ["super_admin", "management"].includes(user.role);
  const isSameBranch = user.branchId === existing.branchId;
  if (!isSameBranch && !canAccessAllBranches) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // For submitted reports, only admins can edit
  if (existing.status === "submitted") {
    if (!canDeleteAnyReport(user.role)) {
      return NextResponse.json({ error: "Only admins can edit submitted reports" }, { status: 403 });
    }
  } else {
    // Drafts can be edited by their creator, a branch admin, or selected staff.
    const isOwner = existing.createdById === user.id;
    const isBranchAdmin = canDeleteAnyReport(user.role);
    const isSelectedStaff = user.branchId === existing.branchId &&
      ["admin", "computer_tech"].includes(user.role) &&
      [existing.adminName, existing.techName].includes(user.fullName);
    if (!isOwner && !isBranchAdmin && !isSelectedStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const parsed = reportUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report data", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const updated = await prisma.gamingReport.update({
    where: { id },
    data: {
      reportDate: body.reportDate ? new Date(body.reportDate) : undefined,
      shift: body.shift,
      adminName: body.adminName === undefined ? undefined : body.adminName,
      techName: body.techName === undefined ? undefined : body.techName,
      status: body.status || "draft",
      changes: body.changes === undefined ? undefined : body.changes,
      followUp: body.followUp === undefined ? undefined : body.followUp,
      reportData: body.reportData ? JSON.stringify(body.reportData) : undefined,
    },
  });

  await writeAuditLog({
    user,
    action: body.status === "submitted" ? "SUBMIT_REPORT" : "UPDATE_DRAFT",
    entity: "GamingReport",
    entityId: id,
    description: `${body.status === "submitted" ? "Submitted" : "Updated draft"} ${body.shift || existing.shift} report`,
    branchId: existing.branchId,
  });

  return NextResponse.json(parseReport(updated));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.gamingReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = existing.createdById === user.id;
  const isAdmin = canDeleteAnyReport(user.role);

  if (existing.status === "submitted" && !isAdmin) {
    return NextResponse.json({ error: "Only admins can delete submitted reports" }, { status: 403 });
  }
  if (existing.status === "draft" && !isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.gamingReport.delete({ where: { id } });

  await writeAuditLog({
    user,
    action: "DELETE_REPORT",
    entity: "GamingReport",
    entityId: id,
    description: `Deleted ${existing.status} ${existing.shift} report`,
    branchId: existing.branchId,
  });

  return NextResponse.json({ success: true });
}
