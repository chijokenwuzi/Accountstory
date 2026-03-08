import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { checkRedisHealth } from "./lib/redis";

const app = buildApp();

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandledRejection");
});

app.listen(env.port, () => {
  logger.info({ port: env.port }, "API listening");

  void (async () => {
    const redisHealth = await checkRedisHealth();
    if (!redisHealth.ok) {
      logger.error(
        { reason: redisHealth.reason, policy: redisHealth.policy, redisUrl: env.redisUrl },
        'Redis not ready or policy invalid. Expected policy "noeviction".'
      );
      return;
    }

    if (redisHealth.policy && redisHealth.policy !== "noeviction") {
      logger.warn({ policy: redisHealth.policy }, 'Redis policy is not "noeviction"');
      return;
    }

    logger.info({ policy: redisHealth.policy || "unknown" }, "Redis is healthy");
  })();
});
