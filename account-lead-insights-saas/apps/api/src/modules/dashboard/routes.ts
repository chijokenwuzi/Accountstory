import { Router } from "express";
import { dashboardFilterSchema } from "@ali/shared";
import { requireAuth } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { getDashboardMetrics } from "./service";
import { stringify } from "csv-stringify/sync";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("", async (req, res) => {
  const filter = dashboardFilterSchema.parse(req.query);
  const metrics = await getDashboardMetrics(
    prisma,
    req.auth!.orgId,
    filter.from ? new Date(filter.from) : undefined,
    filter.to ? new Date(filter.to) : undefined
  );

  const channelTable = await prisma.spendSnapshot.groupBy({ by: ["channel"], where: { orgId: req.auth!.orgId }, _sum: { spend: true }, _count: { channel: true } });

  res.json({
    ...metrics,
    channelPerformance: channelTable.map((row) => ({
      channel: row.channel,
      spend: Number(row._sum.spend || 0),
      entries: row._count.channel
    }))
  });
});

dashboardRouter.get("/campaigns", async (req, res) => {
  const spendByCampaign = await prisma.spendSnapshot.groupBy({
    by: ["campaign", "channel"],
    where: { orgId: req.auth!.orgId },
    _sum: { spend: true }
  });

  const leads = await prisma.lead.groupBy({ by: ["campaign", "channel", "status"], where: { orgId: req.auth!.orgId }, _count: { _all: true } });

  const map = new Map<string, any>();
  spendByCampaign.forEach((row) => {
    const key = `${row.channel}:${row.campaign || "(none)"}`;
    map.set(key, {
      channel: row.channel,
      campaign: row.campaign || "(none)",
      spend: Number(row._sum.spend || 0),
      leads: 0,
      bookedCalls: 0,
      cpl: 0
    });
  });

  leads.forEach((row) => {
    const key = `${row.channel}:${row.campaign || "(none)"}`;
    if (!map.has(key)) {
      map.set(key, { channel: row.channel, campaign: row.campaign || "(none)", spend: 0, leads: 0, bookedCalls: 0, cpl: 0 });
    }
    const item = map.get(key)!;
    item.leads += row._count._all;
    if (row.status === "BOOKED") item.bookedCalls += row._count._all;
  });

  const rows = Array.from(map.values()).map((row) => ({ ...row, cpl: row.leads ? row.spend / row.leads : 0 }));
  res.json({ rows });
});

dashboardRouter.get("/export.csv", async (req, res) => {
  const leads = await prisma.lead.findMany({ where: { orgId: req.auth!.orgId }, orderBy: { createdAt: "desc" } });
  const csv = stringify(
    leads.map((lead) => ({ id: lead.id, source: lead.source, channel: lead.channel, campaign: lead.campaign, status: lead.status, createdAt: lead.createdAt.toISOString() })),
    { header: true }
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  res.send(csv);
});
