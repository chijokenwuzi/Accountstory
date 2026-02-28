import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../lib/audit";
import { syncQueue } from "../../jobs/queues";

export const integrationsRouter = Router();
integrationsRouter.use(requireAuth);

integrationsRouter.get("", async (req, res) => {
  const rows = await prisma.webhookEvent.findMany({ where: { orgId: req.auth!.orgId }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json({ webhooks: rows });
});

integrationsRouter.post("/calendly-webhook", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const leadId = String(req.body?.leadId || "");
  if (!leadId) return res.status(400).json({ error: "leadId is required" });

  const appointment = await prisma.appointment.create({
    data: {
      orgId: req.auth!.orgId,
      leadId,
      scheduledAt: new Date(req.body?.scheduledAt || new Date().toISOString()),
      status: "SCHEDULED"
    }
  });

  await prisma.lead.update({ where: { id: leadId }, data: { status: "BOOKED" } });
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "CALENDLY_WEBHOOK_BOOKED", afterJson: appointment });
  res.status(201).json({ appointment });
});

integrationsRouter.post("/oauth/:provider/connect", requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const provider = String(req.params.provider || "").toLowerCase();
  if (!["google", "meta"].includes(provider)) return res.status(400).json({ error: "Unsupported provider" });
  const tokenHint = String(req.body?.tokenHint || "");
  const event = await prisma.webhookEvent.create({
    data: {
      orgId: req.auth!.orgId,
      type: `oauth_${provider}_connected`,
      payloadJson: { provider, tokenHintPresent: Boolean(tokenHint) },
      status: "CONNECTED"
    }
  });
  await writeAuditLog({
    orgId: req.auth!.orgId,
    actorUserId: req.auth!.userId,
    action: "INTEGRATION_CONNECTED",
    afterJson: { provider }
  });
  res.status(201).json({ connected: true, eventId: event.id });
});

integrationsRouter.post("/sync/trigger", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const mode = String(req.body?.mode || "manual");
  await syncQueue.add("ads-performance-sync", { orgId: req.auth!.orgId, mode });
  res.status(202).json({ queued: true });
});
