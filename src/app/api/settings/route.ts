import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        id: "default",
        businessName: "MARVS Gaming Hub",
        systemName: "Gaming Hub Management System",
      },
    });
  }

  return NextResponse.json({
    settings: {
      id: settings.id,
      business_name: settings.businessName,
      system_name: settings.systemName,
      logo_url: settings.logoUrl || "",
    },
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const settings = await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {
      businessName: body.business_name ?? body.businessName,
      systemName: body.system_name ?? body.systemName,
      logoUrl: body.logo_url ?? body.logoUrl ?? null,
    },
    create: {
      id: "default",
      businessName: body.business_name || "MARVS Gaming Hub",
      systemName: body.system_name || "Gaming Hub Management System",
      logoUrl: body.logo_url || null,
    },
  });

  await writeAuditLog({
    user,
    action: "UPDATE_SETTINGS",
    entity: "SystemSettings",
    entityId: "default",
    description: "Updated system settings",
  });

  return NextResponse.json({
    settings: {
      id: settings.id,
      business_name: settings.businessName,
      system_name: settings.systemName,
      logo_url: settings.logoUrl || "",
    },
  });
}
