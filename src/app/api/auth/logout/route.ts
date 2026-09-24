import { NextRequest, NextResponse } from "next/server";
import { destroySession, clearSessionCookie, getSessionFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("marvs_session")?.value;
  const user = await getSessionFromRequest(req);

  if (token) {
    await destroySession(token);
  }

  if (user) {
    await writeAuditLog({
      user,
      action: "LOGOUT",
      entity: "StaffSession",
      description: `Staff ${user.fullName} logged out`,
    });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(clearSessionCookie());
  return res;
}
