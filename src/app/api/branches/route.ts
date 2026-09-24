import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, canManageBranches, canManageStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { branchCreateSchema } from "@/lib/api-schemas";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Staff managers and branch switchers need the list
  if (!canManageStaff(user.role) && !["super_admin", "management"].includes(user.role)) {
    // still allow reading active branches for selector users
  }

  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ branches });
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageBranches(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = branchCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid branch data", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const name = body.name;
  const code = String(body.code || "").trim().toUpperCase();
  const address = body.address ? String(body.address).trim() : null;

  if (!name || !code) {
    return NextResponse.json({ error: "Name and code required" }, { status: 400 });
  }

  const branch = await prisma.branch.create({
    data: { name, code, address, active: true },
  });

  await writeAuditLog({
    user,
    action: "CREATE_BRANCH",
    entity: "Branch",
    entityId: branch.id,
    description: `Created branch ${name} (${code})`,
  });

  return NextResponse.json({ branch });
}
