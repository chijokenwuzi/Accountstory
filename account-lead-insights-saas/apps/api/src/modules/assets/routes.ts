import { Router } from "express";
import { adAssetInputSchema, adAssetOutputSchema } from "@ali/shared";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { getAssetGenerator } from "../../lib/ai";
import { writeAuditLog } from "../../lib/audit";

export const assetsRouter = Router();
assetsRouter.use(requireAuth);

assetsRouter.post("/generate", requireRole(["OWNER", "ADMIN", "OPERATOR"]), async (req, res) => {
  const input = adAssetInputSchema.parse(req.body);
  const generator = getAssetGenerator();

  const attempt = async () => generator.generate(input);
  let result;
  try {
    result = await attempt();
  } catch {
    result = await attempt();
  }

  const parsed = adAssetOutputSchema.parse(result.output);
  const latest = await prisma.assetPack.findFirst({ where: { orgId: req.auth!.orgId }, orderBy: { version: "desc" } });
  const version = (latest?.version || 0) + 1;

  const pack = await prisma.assetPack.create({
    data: {
      orgId: req.auth!.orgId,
      version,
      promptVersion: result.promptVersion,
      status: "DRAFT",
      contentJson: parsed as any
    }
  });

  await prisma.aiUsage.create({
    data: {
      orgId: req.auth!.orgId,
      feature: "asset-pack-builder",
      model: result.model,
      promptTokens: result.tokens?.prompt || 0,
      completionTokens: result.tokens?.completion || 0,
      estimatedCostUsd: ((result.tokens?.prompt || 0) * 0.000001 + (result.tokens?.completion || 0) * 0.000002).toFixed(5) as any
    }
  });

  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "ASSET_PACK_GENERATED", afterJson: { id: pack.id, version } });
  res.status(201).json({ pack });
});

assetsRouter.post("/:id/approve", requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  const before = await prisma.assetPack.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const pack = await prisma.assetPack.update({ where: { id: req.params.id }, data: { status: "APPROVED" } });
  await writeAuditLog({ orgId: req.auth!.orgId, actorUserId: req.auth!.userId, action: "ASSET_PACK_APPROVED", beforeJson: before, afterJson: pack });
  res.json({ pack });
});

assetsRouter.get("", async (req, res) => {
  const packs = await prisma.assetPack.findMany({ where: { orgId: req.auth!.orgId }, orderBy: { createdAt: "desc" } });
  res.json({ packs });
});

assetsRouter.get("/:id/export/pdf", async (req, res) => {
  const pack = await prisma.assetPack.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!pack) return res.status(404).json({ error: "Not found" });
  const body = Buffer.from(`Account Lead Insights Asset Pack\nVersion: ${pack.version}\n${JSON.stringify(pack.contentJson, null, 2)}`);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=asset-pack-${pack.version}.pdf`);
  res.send(body);
});
