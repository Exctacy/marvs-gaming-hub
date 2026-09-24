import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, canManageBranches } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { branchUpdateSchema } from "@/lib/api-schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageBranches(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = branchUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid branch data", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
  if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;
  if (body.active !== undefined) data.active = !!body.active;

  const branch = await prisma.branch.update({ where: { id }, data });

  await writeAuditLog({
    user,
    action: "UPDATE_BRANCH",
    entity: "Branch",
    entityId: id,
    description: `Updated branch ${branch.name}`,
  });

  return NextResponse.json({ branch });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageBranches(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft-deactivate instead of hard delete to preserve report history
  await prisma.branch.update({
    where: { id },
    data: { active: false },
  });

  await writeAuditLog({
    user,
    action: "DEACTIVATE_BRANCH",
    entity: "Branch",
    entityId: id,
    description: `Deactivated branch ${existing.name}`,
  });

  return NextResponse.json({ success: true });
}
