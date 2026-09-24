import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const staff = await prisma.staffProfile.findUnique({ where: { id: user.id } });
  if (!staff) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.mustChangePassword) {
    if (!currentPassword || !verifyPassword(currentPassword, staff.passwordHash, staff.salt)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
  }

  const { hash, salt } = hashPassword(newPassword);
  await prisma.staffProfile.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      salt,
      mustChangePassword: false,
    },
  });

  await writeAuditLog({
    user,
    action: "CHANGE_PASSWORD",
    entity: "StaffProfile",
    entityId: user.id,
    description: `Password changed for ${user.fullName}`,
  });

  return NextResponse.json({ success: true });
}
