import { prisma } from "./prisma";

export async function writeAuditLog(params: {
  orgId: string;
  actorUserId?: string;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      orgId: params.orgId,
      actorUserId: params.actorUserId,
      action: params.action,
      beforeJson: params.beforeJson as any,
      afterJson: params.afterJson as any
    }
  });
}
