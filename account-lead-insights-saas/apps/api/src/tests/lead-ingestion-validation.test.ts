import { describe, expect, it } from "vitest";
import { publicLeadSchema } from "@ali/shared";

describe("lead ingestion validation", () => {
  it("rejects invalid captcha token", () => {
    expect(() =>
      publicLeadSchema.parse({
        orgSlug: "Acme",
        source: "website",
        channel: "Google",
        captchaToken: "x"
      })
    ).toThrow();
  });

  it("accepts valid payload", () => {
    const parsed = publicLeadSchema.parse({
      orgSlug: "Acme",
      source: "website",
      channel: "Google",
      campaign: "Spring",
      captchaToken: "token-ok"
    });
    expect(parsed.channel).toBe("Google");
  });
});
