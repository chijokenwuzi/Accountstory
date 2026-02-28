import { describe, expect, it } from "vitest";
import { getDashboardMetrics } from "../modules/dashboard/service";

describe("dashboard aggregation", () => {
  it("computes kpis from spend + leads + booked", async () => {
    const now = new Date();
    const prisma = {
      spendSnapshot: {
        findMany: async () => [{ spend: 100 }, { spend: 150 }]
      },
      lead: {
        findMany: async () => [
          { source: "web", channel: "Google", createdAt: now },
          { source: "web", channel: "Google", createdAt: now },
          { source: "meta", channel: "Facebook", createdAt: now }
        ]
      },
      appointment: {
        count: async () => 1
      }
    } as any;

    const metrics = await getDashboardMetrics(prisma, "org1");
    expect(metrics.kpis.totalSpend).toBe(250);
    expect(metrics.kpis.leads).toBe(3);
    expect(metrics.kpis.bookedCalls).toBe(1);
    expect(metrics.kpis.cpl).toBeCloseTo(83.33, 1);
  });
});
