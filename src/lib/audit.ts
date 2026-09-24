import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

export async function writeAuditLog(params: {
  user: SessionUser;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  branchId?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      branchId: params.branchId ?? params.user.branchId,
      userId: params.user.id,
      userName: params.user.fullName,
      role: params.user.role,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      description: params.description,
    },
  });
}
