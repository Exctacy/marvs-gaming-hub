import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, resolveBranchId, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { configSchema } from "@/lib/api-schemas";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branchId = resolveBranchId(user, new URL(req.url).searchParams.get("branchId"));
  if (!branchId) return NextResponse.json({ error: "Branch required" }, { status: 400 });

  let config = await prisma.gamingHubConfig.findUnique({ where: { branchId } });
  if (!config) {
    config = await prisma.gamingHubConfig.create({
      data: { branchId },
    });
  }

  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canEdit = isAdminRole(user.role) || user.role === "computer_tech";
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = configSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid configuration", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const branchId = resolveBranchId(user, body.branchId);
  if (!branchId) return NextResponse.json({ error: "Branch required" }, { status: 400 });

  const data: any = {};
  if (body.standardPcs !== undefined) data.standardPcs = JSON.stringify(body.standardPcs);
  if (body.vipPcs !== undefined) data.vipPcs = JSON.stringify(body.vipPcs);
  if (body.games !== undefined) data.games = JSON.stringify(body.games);
  if (body.gameStatuses !== undefined) data.gameStatuses = JSON.stringify(body.gameStatuses);
  if (body.shiftPcs !== undefined) data.shiftPcs = JSON.stringify(body.shiftPcs);
  if (body.spareTypes !== undefined) data.spareTypes = JSON.stringify(body.spareTypes);
  if (body.peripheralBrands !== undefined) data.peripheralBrands = JSON.stringify(body.peripheralBrands);

  const config = await prisma.gamingHubConfig.upsert({
    where: { branchId },
    update: data,
    create: { branchId, ...data },
  });

  await writeAuditLog({
    user,
    action: "UPDATE_CONFIG",
    entity: "GamingHubConfig",
    entityId: config.id,
    description: `Updated gaming hub config for branch`,
    branchId,
  });

  return NextResponse.json({ config });
}
