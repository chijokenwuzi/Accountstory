import { PrismaClient } from "@prisma/client";

export async function getDashboardMetrics(prisma: PrismaClient, orgId: string, from?: Date, to?: Date) {
  const dateWhere = from || to ? { gte: from, lte: to } : undefined;

  const [spendRows, leads, bookedCalls] = await Promise.all([
    prisma.spendSnapshot.findMany({ where: { orgId, date: dateWhere } }),
    prisma.lead.findMany({ where: { orgId, createdAt: dateWhere } }),
    prisma.appointment.count({ where: { orgId, createdAt: dateWhere } })
  ]);

  const spend = spendRows.reduce((acc, row) => acc + Number(row.spend), 0);
  const leadCount = leads.length;
  const cpl = leadCount ? spend / leadCount : 0;
  const cpBooked = bookedCalls ? spend / bookedCalls : 0;

  const bySource = Object.values(
    leads.reduce<Record<string, { source: string; leads: number }>>((acc, lead) => {
      const key = `${lead.source}:${lead.channel}`;
      if (!acc[key]) acc[key] = { source: key, leads: 0 };
      acc[key].leads += 1;
      return acc;
    }, {})
  );

  const trends = Array.from({ length: 6 }).map((_, idx) => {
    const current = new Date();
    current.setDate(current.getDate() - (5 - idx) * 7);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekLeads = leads.filter((lead) => lead.createdAt >= current && lead.createdAt <= weekEnd).length;
    return { weekStart: current.toISOString().slice(0, 10), leads: weekLeads };
  });

  return {
    kpis: {
      totalSpend: spend,
      leads: leadCount,
      cpl,
      bookedCalls,
      costPerBookedCall: cpBooked
    },
    bySource,
    trends
  };
}
