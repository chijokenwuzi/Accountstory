import { AdAssetInput, adAssetInputSchema, adAssetOutputSchema, promptTemplateVersion } from "@ali/shared";
import { env } from "../config/env";

export interface AiAssetGenerator {
  generate(input: AdAssetInput): Promise<{ output: unknown; model: string; promptVersion: string; tokens?: { prompt: number; completion: number } }>;
}

export class NoAiAssetGenerator implements AiAssetGenerator {
  async generate(input: AdAssetInput) {
    const parsed = adAssetInputSchema.parse(input);
    const base = `${parsed.tradeType} ${parsed.serviceAreas[0]} ${parsed.offer}`;
    const output = {
      headlines: [
        `Book ${parsed.tradeType} Service Fast`,
        `${parsed.tradeType} Pros Near You`,
        `Trusted ${parsed.tradeType} Team`,
        `Same-Day ${parsed.tradeType} Help`,
        `${parsed.offer}`
      ],
      primaryText: [
        `Need ${parsed.tradeType}? We help homeowners in ${parsed.serviceAreas.join(", ")} with fast response and clear pricing.`,
        `Get qualified local leads for ${parsed.tradeType} offers with conversion-focused messaging.`,
        `Built for ${parsed.businessName}: practical ad copy that drives booked calls.`
      ],
      descriptions: [
        `Serving ${parsed.serviceAreas.join(", ")} with reliable ${parsed.tradeType} service.`,
        `Transparent pricing and quick booking.`,
        `Call now for faster scheduling.`,
        `Start with ${parsed.offer}.`
      ],
      keywordThemes: [
        `${parsed.tradeType} near me`,
        `${parsed.tradeType} repair`,
        `${parsed.tradeType} installation`,
        `${parsed.tradeType} service ${parsed.serviceAreas[0]}`,
        `${parsed.offer}`
      ],
      negativeKeywords: ["jobs", "career", "free", "diy", "wholesale"],
      landingPageBlocks: [
        { title: "Hero", body: `${base} with quick scheduling and trusted local technicians.` },
        { title: "Proof", body: `Homeowners choose ${parsed.businessName} for fast response and reliable work.` },
        { title: "CTA", body: `Call now or request service online to claim ${parsed.offer}.` }
      ],
      ctaVariants: ["Call Now", "Book Service", "Get Quote"]
    };

    return {
      output: adAssetOutputSchema.parse(output),
      model: "no-ai-stub",
      promptVersion: promptTemplateVersion,
      tokens: { prompt: 0, completion: 0 }
    };
  }
}

export class OpenAiAssetGenerator implements AiAssetGenerator {
  async generate(input: AdAssetInput) {
    const parsed = adAssetInputSchema.parse(input);
    const prompt = `Template ${promptTemplateVersion}. Return strict JSON with keys: headlines, primaryText, descriptions, keywordThemes, negativeKeywords, landingPageBlocks[{title,body}], ctaVariants. Context: ${JSON.stringify(parsed)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.openAiModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You generate high-converting local home service ad assets. Return only JSON." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status})`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    const parsedOutput = adAssetOutputSchema.parse(JSON.parse(content || "{}"));
    return {
      output: parsedOutput,
      model: env.openAiModel,
      promptVersion: promptTemplateVersion,
      tokens: {
        prompt: Number(json?.usage?.prompt_tokens || 0),
        completion: Number(json?.usage?.completion_tokens || 0)
      }
    };
  }
}

export function getAssetGenerator(): AiAssetGenerator {
  if (env.openAiEnabled && env.openAiApiKey) return new OpenAiAssetGenerator();
  return new NoAiAssetGenerator();
}
