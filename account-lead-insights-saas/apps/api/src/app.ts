import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { logger } from "./lib/logger";
import { openApiSpec } from "./openapi/spec";
import { healthRouter } from "./modules/health/routes";
import { authRouter } from "./modules/auth/routes";
import { onboardingRouter } from "./modules/onboarding/routes";
import { assetsRouter } from "./modules/assets/routes";
import { leadsRouter } from "./modules/leads/routes";
import { dashboardRouter } from "./modules/dashboard/routes";
import { adminRouter } from "./modules/admin/routes";
import { billingRouter } from "./modules/billing/routes";
import { integrationsRouter } from "./modules/integrations/routes";
import { orgRateLimit } from "./middleware/rate-limit";
import { requireActiveSubscription } from "./middleware/subscription";

export function buildApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/onboarding", orgRateLimit, onboardingRouter);
  app.use("/api/v1/assets", orgRateLimit, requireActiveSubscription, assetsRouter);
  app.use("/api/v1/leads", leadsRouter);
  app.use("/api/v1/dashboard", orgRateLimit, dashboardRouter);
  app.use("/api/v1/admin", orgRateLimit, adminRouter);
  app.use("/api/v1/billing", billingRouter);
  app.use("/api/v1/integrations", orgRateLimit, integrationsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
