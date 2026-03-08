import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { checkRedisHealth } from "../../lib/redis";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", timestamp: new Date().toISOString() });
});

healthRouter.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "api", timestamp: new Date().toISOString() });
});

healthRouter.get("/ready", async (_req, res) => {
  let dbReady = false;
  let redisReady = false;
  let redisPolicy: string | undefined;
  let redisReason: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }

  const redisHealth = await checkRedisHealth();
  redisReady = redisHealth.ok;
  redisPolicy = redisHealth.policy;
  redisReason = redisHealth.reason;

  if (dbReady && redisReady) {
    return res.json({ ready: true, db: true, redis: { ok: true, policy: redisPolicy } });
  }

  res.status(503).json({
    ready: false,
    db: dbReady,
    redis: { ok: redisReady, policy: redisPolicy, reason: redisReason }
  });
});
