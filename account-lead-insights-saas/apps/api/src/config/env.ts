import dotenv from "dotenv";
import path from "path";

const rootEnvPath = path.resolve(__dirname, "../../../../.env");
dotenv.config({ path: rootEnvPath });

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.API_PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev_access",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh",
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || "30d",
  encryptionKeyHex: process.env.ENCRYPTION_KEY_HEX || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeStarterPriceId: process.env.STRIPE_STARTER_PRICE_ID || "",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
  openAiEnabled: process.env.OPENAI_ENABLED === "true",
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFrom: process.env.RESEND_FROM || "noreply@example.com",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || "",
  hcaptchaSecret: process.env.HCAPTCHA_SECRET || "",
  sentryDsn: process.env.SENTRY_DSN || "",
  teamOpsInternalToken: process.env.TEAM_OPS_INTERNAL_TOKEN || ""
};
