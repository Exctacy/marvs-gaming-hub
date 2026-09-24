import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!staff || staff.status !== "active") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = verifyPassword(password, staff.passwordHash, staff.salt);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSession(staff.id);
    const cookie = setSessionCookie(token);

    await writeAuditLog({
      user: {
        id: staff.id,
        username: staff.username,
        fullName: staff.fullName,
        role: staff.role as any,
        branchId: staff.branchId,
        mustChangePassword: staff.mustChangePassword,
      },
      action: "LOGIN",
      entity: "StaffSession",
      description: `Staff ${staff.fullName} logged in`,
      branchId: staff.branchId,
    });

    const res = NextResponse.json({
      success: true,
      mustChangePassword: staff.mustChangePassword,
      fullName: staff.fullName,
      role: staff.role,
    });
    res.cookies.set(cookie);
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
