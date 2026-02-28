import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "ADMIN", "OPERATOR"]);

export const quickIntakeSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email(),
  preferredCommMethod: z.enum(["PHONE", "SMS", "EMAIL"]),
  availability: z.string().min(2)
});

export const businessProfileSchema = z.object({
  tradeType: z.string().min(2),
  serviceAreas: z.array(z.string().min(2)).min(1),
  targetZips: z.array(z.string().min(3)).default([]),
  offer: z.string().min(4),
  hours: z.string().min(2),
  callRoutingNumber: z.string().min(7)
});

export const adAssetInputSchema = z.object({
  businessName: z.string().min(2),
  tradeType: z.string().min(2),
  serviceAreas: z.array(z.string()).min(1),
  offer: z.string().min(4),
  differentiators: z.array(z.string()).default([]),
  tone: z.string().default("direct"),
  noAiMode: z.boolean().default(false)
});

export const adAssetOutputSchema = z.object({
  headlines: z.array(z.string()).min(5),
  primaryText: z.array(z.string()).min(3),
  descriptions: z.array(z.string()).min(4),
  keywordThemes: z.array(z.string()).min(5),
  negativeKeywords: z.array(z.string()).min(5),
  landingPageBlocks: z.array(z.object({
    title: z.string(),
    body: z.string()
  })).min(3),
  ctaVariants: z.array(z.string()).min(3)
});

export type AdAssetInput = z.infer<typeof adAssetInputSchema>;
export type AdAssetOutput = z.infer<typeof adAssetOutputSchema>;

export const budgetPlanSchema = z.object({
  month: z.string().min(7),
  allocations: z.array(z.object({
    channel: z.enum(["GOOGLE", "FACEBOOK"]),
    budget: z.number().positive(),
    targetCpl: z.number().positive(),
    expectedLeadShare: z.number().min(0).max(1)
  })).min(1),
  targetCpl: z.number().positive(),
  phoneMix: z.number().min(0).max(1)
});

export const publicLeadSchema = z.object({
  orgSlug: z.string().min(2),
  source: z.string().min(2),
  channel: z.string().min(2),
  campaign: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  location: z.string().optional(),
  captchaToken: z.string().min(4)
});

export const spendUploadRowSchema = z.object({
  date: z.string(),
  channel: z.string(),
  campaign: z.string(),
  spend: z.number().nonnegative()
});

export const dashboardFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  channel: z.string().optional(),
  campaign: z.string().optional(),
  location: z.string().optional()
});

export const promptTemplateVersion = "asset-pack-v1";
