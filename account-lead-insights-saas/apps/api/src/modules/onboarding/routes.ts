import { Router } from "express";
import { budgetPlanSchema, businessProfileSchema, quickIntakeSchema } from "@ali/shared";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../lib/audit";
import { notificationsQueue } from "../../jobs/queues";

const genericStepSchema = z.object({
  stepName: z.enum(["quick-intake", "business-profile", "asset-pack", "budget-plan"]),
  data: z.record(z.any()),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]).default("IN_PROGRESS")
});

export const onboardingRouter = Router();

onboardingRouter.use(requireAuth);

onboardingRouter.get("/steps", async (req, res) => {
  const rows = await prisma.onboardingStep.findMany({ where: { orgId: req.auth!.orgId }, orderBy: { updatedAt: "desc" } });
  res.json({ steps: rows });
});

onboardingRouter.post("/quick-intake", async (req, res) => {
  const data = quickIntakeSchema.parse(req.body);
  const step = await prisma.onboardingStep.upsert({
    where: { orgId_stepName: { orgId: req.auth!.orgId, stepName: "quick-intake" } },
    update: { dataJson: data, status: "COMPLETE" },
    create: { orgId: req.auth!.orgId, stepName: "quick-intake", dataJson: data, status: "COMPLETE" }
  });
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "ONBOARDING_QUICK_INTAKE_SAVED", afterJson: data });
  await notificationsQueue.add("onboarding-step-complete", { orgId: req.auth!.orgId, stepName: "quick-intake" });
  res.status(201).json(step);
});

onboardingRouter.post("/business-profile", async (req, res) => {
  const data = businessProfileSchema.parse(req.body);
  const step = await prisma.onboardingStep.upsert({
    where: { orgId_stepName: { orgId: req.auth!.orgId, stepName: "business-profile" } },
    update: { dataJson: data, status: "COMPLETE" },
    create: { orgId: req.auth!.orgId, stepName: "business-profile", dataJson: data, status: "COMPLETE" }
  });
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "ONBOARDING_BUSINESS_PROFILE_SAVED", afterJson: data });
  await notificationsQueue.add("onboarding-step-complete", { orgId: req.auth!.orgId, stepName: "business-profile" });
  res.status(201).json(step);
});

onboardingRouter.post("/budget-plan", async (req, res) => {
  const data = budgetPlanSchema.parse(req.body);
  await prisma.budgetPlan.deleteMany({ where: { orgId: req.auth!.orgId, month: data.month } });
  await Promise.all(
    data.allocations.map((row) =>
      prisma.budgetPlan.create({
        data: {
          orgId: req.auth!.orgId,
          month: data.month,
          channel: row.channel,
          budget: row.budget as any,
          targetCpl: row.targetCpl as any,
          forecastLeads: Math.round((row.budget / row.targetCpl) * row.expectedLeadShare)
        }
      })
    )
  );
  const step = await prisma.onboardingStep.upsert({
    where: { orgId_stepName: { orgId: req.auth!.orgId, stepName: "budget-plan" } },
    update: { dataJson: data, status: "COMPLETE" },
    create: { orgId: req.auth!.orgId, stepName: "budget-plan", dataJson: data, status: "COMPLETE" }
  });
  await writeAuditLog({
    orgId: req.auth!.orgId,
    actorUserId: req.auth!.userId,
    action: "BUDGET_PLAN_SAVED",
    afterJson: data
  });
  await notificationsQueue.add("onboarding-step-complete", { orgId: req.auth!.orgId, stepName: "budget-plan" });
  res.status(201).json(step);
});

onboardingRouter.post("/step", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const data = genericStepSchema.parse(req.body);
  const step = await prisma.onboardingStep.upsert({
    where: { orgId_stepName: { orgId: req.auth!.orgId, stepName: data.stepName } },
    update: { dataJson: data.data, status: data.status },
    create: { orgId: req.auth!.orgId, stepName: data.stepName, dataJson: data.data, status: data.status }
  });
  await notificationsQueue.add("onboarding-step-complete", { orgId: req.auth!.orgId, stepName: data.stepName });
  res.status(201).json(step);
});

onboardingRouter.post("/ready-to-launch", requireRole(["ADMIN", "OPERATOR"]), async (req, res) => {
  const step = await prisma.onboardingStep.upsert({
    where: { orgId_stepName: { orgId: req.auth!.orgId, stepName: "ready-to-launch" } },
    update: { dataJson: { markedBy: req.auth!.userId }, status: "COMPLETE" },
    create: { orgId: req.auth!.orgId, stepName: "ready-to-launch", dataJson: { markedBy: req.auth!.userId }, status: "COMPLETE" }
  });
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "ONBOARDING_READY_TO_LAUNCH" });
  res.status(201).json(step);
});
