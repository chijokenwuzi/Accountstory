import { Router } from "express";
import { dashboardFilterSchema, publicLeadSchema, spendUploadRowSchema } from "@ali/shared";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { decryptPII, encryptPII } from "../../lib/crypto";
import { publicRateLimit } from "../../middleware/rate-limit";
import { notificationsQueue } from "../../jobs/queues";
import { z } from "zod";
import { writeAuditLog } from "../../lib/audit";

async function verifyCaptcha(token: string) {
  if (!process.env.HCAPTCHA_SECRET) return token.length > 3;
  return token.length > 3;
}

export const leadsRouter = Router();

const publicSignupSchema = z.object({
  orgName: z.string().min(2).default("Acme HVAC"),
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email(),
  bestMethod: z.enum(["PHONE", "SMS", "EMAIL"]),
  availability: z.string().min(2)
});

const onboardingSignupSchema = z.object({
  orgName: z.string().min(2).optional(),
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email(),
  bestMethod: z.enum(["PHONE", "SMS", "EMAIL"]).default("PHONE"),
  availability: z.string().min(2).default("Weekdays 9am-5pm")
});

const leadListQuerySchema = dashboardFilterSchema.extend({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(5000).optional()
});

leadsRouter.post("/public/signups", publicRateLimit, async (req, res) => {
  const body = publicSignupSchema.parse(req.body);
  const org = await prisma.organization.findFirst({
    where: { name: { equals: body.orgName, mode: "insensitive" } }
  });
  const resolvedOrg =
    org ||
    (await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" }
    }));
  if (!resolvedOrg) return res.status(404).json({ error: "No organization available for signup intake." });

  const lead = await prisma.lead.create({
    data: {
      orgId: resolvedOrg.id,
      source: "signup-form",
      channel: "Website",
      campaign: "Free Call",
      contactName: body.name,
      phoneEnc: encryptPII(body.phone),
      emailEnc: encryptPII(body.email),
      location: ""
    }
  });

  await prisma.webhookEvent.create({
    data: {
      orgId: resolvedOrg.id,
      type: "signup_intake",
      payloadJson: {
        leadId: lead.id,
        orgName: body.orgName,
        name: body.name,
        phone: body.phone,
        email: body.email,
        bestMethod: body.bestMethod,
        availability: body.availability,
        source: "free_call_form"
      },
      status: "RECEIVED"
    }
  });
  await notificationsQueue.add("lead-created", { orgId: resolvedOrg.id, leadId: lead.id });
  return res.status(201).json({ ok: true, id: lead.id });
});

leadsRouter.post("/public", publicRateLimit, async (req, res) => {
  const body = publicLeadSchema.parse(req.body);
  const org = await prisma.organization.findFirst({ where: { name: { equals: body.orgSlug, mode: "insensitive" } } });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const captchaOk = await verifyCaptcha(body.captchaToken);
  if (!captchaOk) return res.status(400).json({ error: "Captcha failed" });

  const lead = await prisma.lead.create({
    data: {
      orgId: org.id,
      source: body.source,
      channel: body.channel,
      campaign: body.campaign,
      location: body.location,
      contactName: body.contactName,
      phoneEnc: encryptPII(body.phone),
      emailEnc: encryptPII(body.email)
    }
  });

  await notificationsQueue.add("lead-created", { orgId: org.id, leadId: lead.id });
  res.status(201).json({ id: lead.id });
});

leadsRouter.post("/webhook/:orgId", publicRateLimit, async (req, res) => {
  const orgId = req.params.orgId;
  const event = await prisma.webhookEvent.create({
    data: {
      orgId,
      type: String(req.body?.type || "external"),
      payloadJson: req.body,
      status: "RECEIVED"
    }
  });
  res.status(202).json({ eventId: event.id });
});

leadsRouter.use(requireAuth);

leadsRouter.post("/signup-intake", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const body = onboardingSignupSchema.parse(req.body);

  const existing = await prisma.lead.findFirst({
    where: {
      orgId: req.auth!.orgId,
      source: "signup-form",
      contactName: body.name,
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    return res.json({ ok: true, id: existing.id, reused: true });
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: req.auth!.orgId,
      source: "signup-form",
      channel: "Website",
      campaign: "Onboarding Flow",
      contactName: body.name,
      phoneEnc: encryptPII(body.phone),
      emailEnc: encryptPII(body.email),
      location: body.orgName || ""
    }
  });

  await prisma.webhookEvent.create({
    data: {
      orgId: req.auth!.orgId,
      type: "signup_intake",
      payloadJson: {
        leadId: lead.id,
        orgName: body.orgName || "",
        name: body.name,
        phone: body.phone,
        email: body.email,
        bestMethod: body.bestMethod,
        availability: body.availability,
        source: "onboarding_flow"
      },
      status: "RECEIVED"
    }
  });

  await notificationsQueue.add("lead-created", { orgId: req.auth!.orgId, leadId: lead.id });
  return res.status(201).json({ ok: true, id: lead.id });
});

leadsRouter.get("", async (req, res) => {
  const filter = leadListQuerySchema.parse(req.query);
  const leads = await prisma.lead.findMany({
    where: {
      orgId: req.auth!.orgId,
      channel: filter.channel || undefined,
      campaign: filter.campaign || undefined,
      location: filter.location || undefined,
      createdAt: filter.from || filter.to ? { gte: filter.from ? new Date(filter.from) : undefined, lte: filter.to ? new Date(filter.to) : undefined } : undefined
    },
    orderBy: { createdAt: "desc" },
    take: filter.limit || 200,
    skip: filter.offset || 0
  });

  res.json({
    leads: leads.map((lead) => ({ ...lead, phone: decryptPII(lead.phoneEnc), email: decryptPII(lead.emailEnc) }))
  });
});

leadsRouter.post("/:id/book", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const payload = z.object({ scheduledAt: z.string().datetime() }).parse(req.body);
  const lead = await prisma.lead.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const appointment = await prisma.appointment.create({
    data: {
      orgId: req.auth!.orgId,
      leadId: lead.id,
      scheduledAt: new Date(payload.scheduledAt),
      status: "SCHEDULED"
    }
  });
  await prisma.lead.update({ where: { id: lead.id }, data: { status: "BOOKED" } });
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "LEAD_BOOKED", afterJson: appointment });
  res.status(201).json({ appointment });
});

leadsRouter.post("/spend/upload", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const rows = z.array(spendUploadRowSchema).parse(req.body?.rows || []);
  const created = await Promise.all(
    rows.map((row) =>
      prisma.spendSnapshot.create({
        data: {
          orgId: req.auth!.orgId,
          date: new Date(row.date),
          channel: row.channel,
          campaign: row.campaign,
          spend: row.spend as any
        }
      })
    )
  );
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "SPEND_UPLOAD", afterJson: { count: created.length } });
  res.status(201).json({ count: created.length });
});
