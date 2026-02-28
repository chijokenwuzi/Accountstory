import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "Unauthorized" });
  const sub = await prisma.subscription.findFirst({ where: { orgId: req.auth.orgId } });
  if (!sub) return res.status(402).json({ error: "No subscription found" });
  if (sub.status === "ACTIVE" || sub.status === "TRIAL") return next();
  return res.status(402).json({ error: "Subscription inactive" });
}
