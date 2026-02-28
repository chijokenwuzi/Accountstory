import { Queue } from "bullmq";
import { env } from "../config/env";

const connection = { url: env.redisUrl };

export const notificationsQueue = new Queue("notifications", { connection });
export const syncQueue = new Queue("sync", { connection });
