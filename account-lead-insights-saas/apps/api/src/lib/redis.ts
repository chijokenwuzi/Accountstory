import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

redis.on("error", (error) => {
  logger.error({ err: error }, "Redis connection error");
});

type RedisHealth = {
  ok: boolean;
  policy?: string;
  reason?: string;
};

export async function checkRedisHealth(): Promise<RedisHealth> {
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") return { ok: false, reason: "Redis ping failed" };

    const config = await redis.config("GET", "maxmemory-policy");
    const policy = Array.isArray(config) ? config[1] : undefined;
    if (!policy) return { ok: false, reason: "Unable to read Redis eviction policy" };

    if (policy !== "noeviction" && env.redisRequireNoeviction) {
      return { ok: false, policy, reason: 'Redis eviction policy must be "noeviction"' };
    }

    return { ok: true, policy };
  } catch (error) {
    logger.error({ err: error }, "Redis health check failed");
    return { ok: false, reason: "Redis unavailable" };
  }
}
