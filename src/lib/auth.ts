import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { NextRequest } from "next/server";

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production");
}
const SECRET = new TextEncoder().encode(
  configuredSecret || "local-development-secret-change-this-before-deploying"
);
const SESSION_COOKIE = "marvs_session";
const SESSION_HOURS = 12;

export type StaffRole =
  | "super_admin"
  | "admin"
  | "management"
  | "counter_admin"
  | "computer_tech"
  | "team_leader";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: StaffRole;
  branchId: string | null;
  mustChangePassword: boolean;
}

export async function createSession(staffId: string): Promise<string> {
  const token = await new SignJWT({ staffId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(SECRET);

  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await prisma.staffSession.create({
    data: { staffId, token, expiresAt },
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const staffId = payload.staffId as string;

    const session = await prisma.staffSession.findUnique({
      where: { token },
      include: { staff: true },
    });

    if (
      !session ||
      session.staffId !== staffId ||
      session.expiresAt < new Date() ||
      session.staff.status !== "active"
    ) {
      return null;
    }

    return {
      id: session.staff.id,
      username: session.staff.username,
      fullName: session.staff.fullName,
      role: session.staff.role as StaffRole,
      branchId: session.staff.branchId,
      mustChangePassword: session.staff.mustChangePassword,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const staffId = payload.staffId as string;

    const session = await prisma.staffSession.findUnique({
      where: { token },
      include: { staff: true },
    });

    if (
      !session ||
      session.staffId !== staffId ||
      session.expiresAt < new Date() ||
      session.staff.status !== "active"
    ) {
      return null;
    }

    return {
      id: session.staff.id,
      username: session.staff.username,
      fullName: session.staff.fullName,
      role: session.staff.role as StaffRole,
      branchId: session.staff.branchId,
      mustChangePassword: session.staff.mustChangePassword,
    };
  } catch {
    return null;
  }
}

export async function destroySession(token: string) {
  await prisma.staffSession.deleteMany({ where: { token } });
}

export function setSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function canSwitchBranch(role: StaffRole): boolean {
  return role === "super_admin" || role === "management";
}

export function isBranchLocked(role: StaffRole): boolean {
  return ["counter_admin", "computer_tech", "team_leader", "admin"].includes(role);
}

export function isAdminRole(role: StaffRole): boolean {
  return ["super_admin", "admin", "management"].includes(role);
}

export function canManageStaff(role: StaffRole): boolean {
  return ["super_admin", "admin", "management"].includes(role);
}

export function canManageBranches(role: StaffRole): boolean {
  return role === "super_admin";
}

export function canDeleteAnyReport(role: StaffRole): boolean {
  return ["super_admin", "admin", "management"].includes(role);
}

export function resolveBranchId(
  user: SessionUser,
  requestedBranchId?: string | null
): string | null {
  if (isBranchLocked(user.role) && user.branchId) {
    return user.branchId;
  }
  if (canSwitchBranch(user.role) && requestedBranchId) {
    return requestedBranchId;
  }
  return user.branchId;
}
