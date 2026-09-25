import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, canManageStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import { staffCreateSchema } from "@/lib/api-schemas";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: any = {};
  // Branch admins only see their branch
  if (user.role === "admin" && user.branchId) {
    where.OR = [
      { branchId: user.branchId },
      // also show themselves even if edge case
      { id: user.id },
    ];
  }

  const profiles = await prisma.staffProfile.findMany({
    where,
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      branchId: true,
      status: true,
      mustChangePassword: true,
      activatedAt: true,
      deactivatedAt: true,
      createdAt: true,
      createdByName: true,
    },
  });

  // Normalize status to uppercase for UI compatibility
  return NextResponse.json({
    profiles: profiles.map((p) => ({
      ...p,
      status: (p.status || "active").toUpperCase(),
      branch_id: p.branchId,
      full_name: p.fullName,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = staffCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff data", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const username = String(body.username || "")
    .toLowerCase()
    .trim();
  const fullName = String(body.full_name || body.fullName || "").trim();
  const role = String(body.role || "counter_admin");
  let branchId = body.branch_id || body.branchId || null;

  if (!username || !fullName) {
    return NextResponse.json(
      { error: "Username and full name are required" },
      { status: 400 }
    );
  }

  const isGlobal = role === "super_admin" || role === "management";
  if (isGlobal) branchId = null;

  // Branch admin constraints
  if (user.role === "admin") {
    const allowed = ["counter_admin", "computer_tech", "team_leader"];
    if (!allowed.includes(role)) {
      return NextResponse.json(
        { error: "Branch admins can only create counter, tech, or team leader accounts" },
        { status: 403 }
      );
    }
    branchId = user.branchId;
  }

  const existing = await prisma.staffProfile.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 400 });
  }

  const { hash, salt } = hashPassword("123");
  const profile = await prisma.staffProfile.create({
    data: {
      username,
      fullName,
      role,
      branchId,
      passwordHash: hash,
      salt,
      mustChangePassword: true,
      status: "active",
      activatedAt: new Date(),
      createdById: user.id,
      createdByName: user.fullName,
    },
  });

  await writeAuditLog({
    user,
    action: "CREATE_STAFF",
    entity: "StaffProfile",
    entityId: profile.id,
    description: `Created staff ${fullName} (${username}) as ${role}`,
    branchId,
  });

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      role: profile.role,
    },
  });
}
