import { Router } from "express";
import Stripe from "stripe";
import { env } from "../../config/env";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

export const billingRouter = Router();

billingRouter.post("/webhook", async (req, res) => {
  // For baseline, accept parsed JSON in dev. In production use raw body + signature verification.
  const event = req.body;
  const type = String(event?.type || "");
  const data = event?.data?.object || {};

  if (type === "checkout.session.completed") {
    const orgId = String(data?.metadata?.orgId || "");
    if (orgId) {
      await prisma.subscription.upsert({
        where: { orgId },
        update: {
          status: "ACTIVE",
          stripeCustomerId: data.customer,
          stripeSubscriptionId: data.subscription
        },
        create: {
          orgId,
          status: "ACTIVE",
          stripeCustomerId: data.customer,
          stripeSubscriptionId: data.subscription,
          plan: "starter"
        }
      });
    }
  }

  if (type === "customer.subscription.deleted") {
    const subId = String(data?.id || "");
    await prisma.subscription.updateMany({ where: { stripeSubscriptionId: subId }, data: { status: "CANCELED" } });
  }

  res.json({ received: true });
});

billingRouter.use(requireAuth);

billingRouter.get("/status", async (req, res) => {
  const sub = await prisma.subscription.findFirst({ where: { orgId: req.auth!.orgId } });
  res.json({ subscription: sub || { status: "TRIAL", plan: "starter" } });
});

billingRouter.post("/checkout", requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  if (!stripe || !env.stripeStarterPriceId) {
    return res.status(400).json({ error: "Stripe not configured" });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env.stripeStarterPriceId, quantity: 1 }],
    success_url: String(req.body?.successUrl || "http://localhost:3000/billing/success"),
    cancel_url: String(req.body?.cancelUrl || "http://localhost:3000/billing/cancel"),
    metadata: { orgId: req.auth!.orgId }
  });
  res.json({ url: session.url });
});
