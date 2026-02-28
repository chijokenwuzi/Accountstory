import dotenv from "dotenv";
import path from "path";
import { Worker } from "bullmq";
import pino from "pino";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const logger = pino({ level: process.env.NODE_ENV === "production" ? "info" : "debug" });
const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL || "redis://localhost:6379" };

new Worker(
  "notifications",
  async (job) => {
    if (job.name === "lead-created") {
      const lead = await prisma.lead.findUnique({ where: { id: String(job.data.leadId) } });
      if (!lead) return;
      logger.info({ leadId: lead.id, orgId: lead.orgId }, "Dispatching lead notifications (email/sms adapters)");
    }
    if (job.name === "onboarding-step-complete") {
      logger.info({ orgId: job.data.orgId, stepName: job.data.stepName }, "Notify operator: onboarding step completed");
    }
  },
  { connection }
);

new Worker(
  "sync",
  async (job) => {
    logger.info({ job: job.name, data: job.data }, "Running data sync job");
  },
  { connection }
);

logger.info("Worker started");
