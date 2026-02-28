import { describe, expect, it } from "vitest";
import { NoAiAssetGenerator } from "../lib/ai";

describe("asset pack no-ai deterministic generation", () => {
  it("returns deterministic output for same input", async () => {
    const gen = new NoAiAssetGenerator();
    const input = {
      businessName: "Acme HVAC",
      tradeType: "HVAC",
      serviceAreas: ["Phoenix"],
      offer: "Free estimate",
      differentiators: ["Fast response"],
      tone: "direct",
      noAiMode: true
    };

    const a = await gen.generate(input);
    const b = await gen.generate(input);
    expect(a.output).toEqual(b.output);
  });
});
