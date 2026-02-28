import { describe, expect, it } from "vitest";
import { persistOnboardingStep } from "../modules/onboarding/service";

describe("onboarding persistence", () => {
  it("upserts by org + step", async () => {
    const calls: any[] = [];
    const prisma = {
      onboardingStep: {
        upsert: async (args: any) => {
          calls.push(args);
          return args.create;
        }
      }
    };

    const result = await persistOnboardingStep(prisma as any, "org1", "quick-intake", { name: "A" }, "COMPLETE");
    expect(calls).toHaveLength(1);
    expect(calls[0].where.orgId_stepName).toEqual({ orgId: "org1", stepName: "quick-intake" });
    expect(result.status).toBe("COMPLETE");
  });
});
