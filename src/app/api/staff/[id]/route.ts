import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, canManageStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { staffActionSchema } from "@/lib/api-schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = staffActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff action", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const action = body.action;

  const target = await prisma.staffProfile.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "admin" && target.branchId !== user.branchId && target.id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "reset_password") {
    const { hash, salt } = hashPassword("123");
    await prisma.staffProfile.update({
      where: { id },
      data: { passwordHash: hash, salt, mustChangePassword: true },
    });
    await writeAuditLog({
      user,
      action: "RESET_PASSWORD",
      entity: "StaffProfile",
      entityId: id,
      description: `Reset password for ${target.fullName}`,
      branchId: target.branchId,
    });
    return NextResponse.json({ success: true });
  }

  if (action === "deactivate") {
    if (target.id === user.id) {
      return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
    }
    await prisma.staffProfile.update({
      where: { id },
      data: { status: "inactive", deactivatedAt: new Date() },
    });
    await prisma.staffSession.deleteMany({ where: { staffId: id } });
    await writeAuditLog({
      user,
      action: "DEACTIVATE_STAFF",
      entity: "StaffProfile",
      entityId: id,
      description: `Deactivated ${target.fullName}`,
      branchId: target.branchId,
    });
    return NextResponse.json({ success: true });
  }

  if (action === "activate") {
    await prisma.staffProfile.update({
      where: { id },
      data: { status: "active", activatedAt: new Date(), deactivatedAt: null },
    });
    await writeAuditLog({
      user,
      action: "ACTIVATE_STAFF",
      entity: "StaffProfile",
      entityId: id,
      description: `Activated ${target.fullName}`,
      branchId: target.branchId,
    });
    return NextResponse.json({ success: true });
  }

  if (action === "change_role") {
    const newRole = body.new_role || body.newRole;
    if (!newRole) return NextResponse.json({ error: "new_role required" }, { status: 400 });
    if (user.role === "admin") {
      const allowed = ["counter_admin", "computer_tech", "team_leader"];
      if (!allowed.includes(newRole)) {
        return NextResponse.json({ error: "Forbidden role change" }, { status: 403 });
      }
    }
    const data: any = { role: newRole };
    if (newRole === "super_admin" || newRole === "management") {
      data.branchId = null;
    }
    await prisma.staffProfile.update({ where: { id }, data });
    await writeAuditLog({
      user,
      action: "CHANGE_ROLE",
      entity: "StaffProfile",
      entityId: id,
      description: `Changed role of ${target.fullName} to ${newRole}`,
      branchId: target.branchId,
    });
    return NextResponse.json({ success: true });
  }

  if (action === "change_branch") {
    if (!["super_admin", "management"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const newBranchId = body.new_branch_id || body.newBranchId || null;
    await prisma.staffProfile.update({
      where: { id },
      data: { branchId: newBranchId || null },
    });
    await writeAuditLog({
      user,
      action: "CHANGE_BRANCH",
      entity: "StaffProfile",
      entityId: id,
      description: `Changed branch of ${target.fullName}`,
      branchId: newBranchId,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
