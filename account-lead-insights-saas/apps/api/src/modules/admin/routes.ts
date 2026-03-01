import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../lib/audit";
import { addOperatorAdmin, getOperatorAdmins, removeOperatorAdmin } from "../../lib/operator-admins";
import { decryptPII } from "../../lib/crypto";

export const adminRouter = Router();
const FOUNDER_PORTAL_EMAIL = (process.env.FOUNDER_PORTAL_EMAIL || "chijokenwuzi@gmail.com").toLowerCase();
const INTERNAL_TOKEN = String(process.env.TEAM_OPS_INTERNAL_TOKEN || "").trim();

async function buildSignupRows() {
  const rows = await prisma.lead.findMany({
    where: { source: "signup-form" },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const orgIds = Array.from(new Set(rows.map((entry) => entry.orgId)));
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true }
  });
  const orgMap = new Map(orgs.map((entry) => [entry.id, entry.name]));

  const signupEvents = await prisma.webhookEvent.findMany({
    where: { type: "signup_intake", orgId: { in: orgIds } },
    orderBy: { createdAt: "desc" },
    take: 800
  });
  const eventByLeadId = new Map<string, (typeof signupEvents)[number]>();
  const eventsByOrg = new Map<string, (typeof signupEvents)>();
  for (const event of signupEvents) {
    const payload = (event.payloadJson || {}) as Record<string, unknown>;
    const leadId = typeof payload.leadId === "string" ? payload.leadId : "";
    if (leadId && !eventByLeadId.has(leadId)) {
      eventByLeadId.set(leadId, event);
    }
    const list = eventsByOrg.get(event.orgId) || [];
    list.push(event);
    eventsByOrg.set(event.orgId, list);
  }

  return rows
    .map((row) => {
    const byLeadIdEvent = eventByLeadId.get(row.id);
    const fallbackEvent = (eventsByOrg.get(row.orgId) || []).find((event) => {
      const payload = (event.payloadJson || {}) as Record<string, unknown>;
      const payloadName = typeof payload.name === "string" ? payload.name.trim().toLowerCase() : "";
      const rowName = String(row.contactName || "").trim().toLowerCase();
      return Boolean(payloadName) && payloadName === rowName;
    });
    const event = byLeadIdEvent || fallbackEvent;
    if (!event) return null;
    const payload = ((event?.payloadJson as Record<string, unknown>) || {}) as Record<string, unknown>;

    const bestMethod = typeof payload.bestMethod === "string" ? payload.bestMethod : "";
    const availability = typeof payload.availability === "string" ? payload.availability : "";
    const formSource = typeof payload.source === "string" ? payload.source : "";
    const orgNameFromForm = typeof payload.orgName === "string" ? payload.orgName : "";

    return {
      id: row.id,
      orgId: row.orgId,
      orgName: orgNameFromForm || orgMap.get(row.orgId) || row.orgId,
      name: row.contactName || "",
      phone: decryptPII(row.phoneEnc) || "",
      email: decryptPII(row.emailEnc) || "",
      bestMethod,
      availability,
      source: row.source || "",
      campaign: row.campaign || "",
      location: row.location || "",
      formSource,
      webhookCapturedAt: event?.createdAt || null,
      createdAt: row.createdAt,
      formPayload: payload
    };
  })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

adminRouter.get("/internal/signups", async (req, res) => {
  const providedToken =
    String(req.headers["x-internal-token"] || req.query.token || "").trim();
  if (!INTERNAL_TOKEN || providedToken !== INTERNAL_TOKEN) {
    return res.status(403).json({ error: "Forbidden: internal token required." });
  }
  const signups = await buildSignupRows();
  return res.json({ signups });
});

adminRouter.use(requireAuth, requireRole(["ADMIN", "OPERATOR", "OWNER"]));
adminRouter.use((req, res, next) => {
  const email = String(req.auth?.email || "").toLowerCase();
  if (email !== FOUNDER_PORTAL_EMAIL) {
    return res.status(403).json({ error: "Forbidden: founder portal access only." });
  }
  next();
});

adminRouter.get("/access", async (req, res) => {
  const admins = await getOperatorAdmins();
  res.json({ allowed: true, email: req.auth!.email, admins, founderEmail: FOUNDER_PORTAL_EMAIL });
});

adminRouter.get("/operators", async (_req, res) => {
  const admins = await getOperatorAdmins();
  res.json({ admins });
});

adminRouter.post("/operators", async (req, res) => {
  const input = z.object({ email: z.string().email() }).parse(req.body);
  const admins = await addOperatorAdmin(input.email);
  res.status(201).json({ admins });
});

adminRouter.delete("/operators", async (req, res) => {
  const input = z.object({ email: z.string().email() }).parse(req.body);
  const admins = await removeOperatorAdmin(input.email);
  res.json({ admins });
});

adminRouter.get("/signups", async (_req, res) => {
  const signups = await buildSignupRows();
  res.json({ signups });
});

adminRouter.get("/organizations", async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    include: {
      onboardingSteps: true,
      leads: { select: { id: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const rows = await Promise.all(
    orgs.map(async (org) => {
      const spend = await prisma.spendSnapshot.aggregate({ where: { orgId: org.id }, _sum: { spend: true } });
      return {
        id: org.id,
        name: org.name,
        onboardingComplete: org.onboardingSteps.filter((s) => s.status === "COMPLETE").length,
        leadVolume: org.leads.length,
        spend: Number(spend._sum.spend || 0)
      };
    })
  );

  res.json({ organizations: rows });
});

adminRouter.get("/anomalies", async (_req, res) => {
  const orgs = await prisma.organization.findMany();
  const anomalies: Array<{ orgId: string; type: string; message: string }> = [];
  for (const org of orgs) {
    const spend = await prisma.spendSnapshot.aggregate({ where: { orgId: org.id }, _sum: { spend: true } });
    const leads = await prisma.lead.count({ where: { orgId: org.id } });
    if (Number(spend._sum.spend || 0) > 0 && leads === 0) {
      anomalies.push({ orgId: org.id, type: "NO_LEADS", message: "Spend > 0 but 0 leads" });
    }
    if (leads > 0) {
      const appointments = await prisma.appointment.count({ where: { orgId: org.id } });
      const cpl = Number(spend._sum.spend || 0) / leads;
      if (cpl > 300) anomalies.push({ orgId: org.id, type: "CPL_SPIKE", message: `CPL high at $${cpl.toFixed(2)}` });
      if (appointments === 0) anomalies.push({ orgId: org.id, type: "NO_BOOKINGS", message: "Leads present but no booked calls" });
    }
  }
  res.json({ anomalies });
});

adminRouter.post("/notes", async (req, res) => {
  const input = z.object({ orgId: z.string(), content: z.string().min(2) }).parse(req.body);
  const note = await prisma.operatorNote.create({ data: { orgId: input.orgId, authorId: req.auth!.userId, content: input.content } });
  await writeAuditLog({ orgId: input.orgId, actorUserId: req.auth!.userId, action: "OPERATOR_NOTE_CREATED", afterJson: note });
  res.status(201).json({ note });
});

adminRouter.post("/tasks", async (req, res) => {
  const input = z.object({ orgId: z.string(), title: z.string().min(2), assignedTo: z.string().optional() }).parse(req.body);
  const task = await prisma.operatorTask.create({ data: { orgId: input.orgId, title: input.title, assignedTo: input.assignedTo } });
  res.status(201).json({ task });
});

adminRouter.post("/view-as/:orgId", async (req, res) => {
  const orgId = req.params.orgId;
  const token = Buffer.from(JSON.stringify({ orgId, readonly: true, iat: Date.now() })).toString("base64url");
  await writeAuditLog({ orgId, actorUserId: req.auth!.userId, action: "VIEW_AS_OWNER_TOKEN_ISSUED" });
  res.json({ viewToken: token });
});

adminRouter.get("/org/:orgId/export", requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const orgId = req.params.orgId;
  const [org, users, leads, spend, appointments, packs, steps] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.user.findMany({ where: { orgId }, select: { id: true, email: true, role: true, createdAt: true } }),
    prisma.lead.findMany({ where: { orgId } }),
    prisma.spendSnapshot.findMany({ where: { orgId } }),
    prisma.appointment.findMany({ where: { orgId } }),
    prisma.assetPack.findMany({ where: { orgId } }),
    prisma.onboardingStep.findMany({ where: { orgId } })
  ]);
  res.json({ org, users, leads, spend, appointments, packs, steps });
});

adminRouter.delete("/org/:orgId", requireRole(["OWNER"]), async (req, res) => {
  const orgId = req.params.orgId;
  await prisma.organization.delete({ where: { id: orgId } });
  res.json({ ok: true });
});
