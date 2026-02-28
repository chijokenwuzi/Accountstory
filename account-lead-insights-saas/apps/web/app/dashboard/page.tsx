"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  clearSession,
  getToken,
  getUserEmail,
  isSignedIn,
  syncSessionCookieFromStorage
} from "../../lib/client";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Link from "next/link";
import { canAccessFounderPortal } from "../../lib/founder-access";

type DashboardData = {
  kpis: {
    totalSpend: number;
    leads: number;
    cpl: number;
    bookedCalls: number;
    costPerBookedCall: number;
  };
  trends: Array<{ weekStart: string; leads: number }>;
  bySource: Array<{ source: string; leads: number }>;
  channelPerformance?: Array<{ channel: string; spend: number; entries: number }>;
};

type CampaignRow = {
  channel: string;
  campaign: string;
  spend: number;
  leads: number;
  bookedCalls: number;
  cpl: number;
};

type LeadRow = {
  id: string;
  source: string;
  channel: string;
  campaign: string;
  contactName: string | null;
  status: "NEW" | "CONTACTED" | "BOOKED" | "LOST";
  createdAt: string;
};

const DEMO_DASHBOARD: DashboardData = {
  kpis: {
    totalSpend: 3000,
    leads: 42,
    cpl: 71.43,
    bookedCalls: 12,
    costPerBookedCall: 250
  },
  trends: [
    { weekStart: "W1", leads: 4 },
    { weekStart: "W2", leads: 6 },
    { weekStart: "W3", leads: 7 },
    { weekStart: "W4", leads: 8 },
    { weekStart: "W5", leads: 9 },
    { weekStart: "W6", leads: 8 }
  ],
  bySource: [
    { source: "google:search", leads: 20 },
    { source: "facebook:leadform", leads: 14 },
    { source: "website:organic", leads: 8 }
  ],
  channelPerformance: [
    { channel: "Google", spend: 1700, entries: 18 },
    { channel: "Facebook", spend: 1100, entries: 14 },
    { channel: "Website", spend: 200, entries: 5 }
  ]
};

const DEMO_CAMPAIGNS: CampaignRow[] = [
  { channel: "Google", campaign: "HVAC Emergency Repair", spend: 1200, leads: 16, bookedCalls: 5, cpl: 75 },
  { channel: "Facebook", campaign: "Free Service Estimate", spend: 950, leads: 14, bookedCalls: 4, cpl: 67.86 },
  { channel: "Google", campaign: "Seasonal Tune-Up", spend: 650, leads: 8, bookedCalls: 2, cpl: 81.25 }
];

const DEMO_LEADS: LeadRow[] = [
  { id: "d1", source: "signup-form", channel: "Google", campaign: "HVAC Emergency Repair", contactName: "Maya R.", status: "NEW", createdAt: new Date().toISOString() },
  { id: "d2", source: "lead-form", channel: "Facebook", campaign: "Free Service Estimate", contactName: "James T.", status: "CONTACTED", createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString() },
  { id: "d3", source: "website", channel: "Google", campaign: "Seasonal Tune-Up", contactName: "Chris B.", status: "BOOKED", createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString() },
  { id: "d4", source: "lead-form", channel: "Facebook", campaign: "Free Service Estimate", contactName: "Taylor G.", status: "LOST", createdAt: new Date(Date.now() - 3600 * 1000 * 32).toISOString() }
];

const EMPTY_TRENDS = [
  { weekStart: "W1", leads: 0 },
  { weekStart: "W2", leads: 0 },
  { weekStart: "W3", leads: 0 },
  { weekStart: "W4", leads: 0 },
  { weekStart: "W5", leads: 0 },
  { weekStart: "W6", leads: 0 }
];

const EMPTY_DASHBOARD: DashboardData = {
  kpis: {
    totalSpend: 0,
    leads: 0,
    cpl: 0,
    bookedCalls: 0,
    costPerBookedCall: 0
  },
  trends: EMPTY_TRENDS,
  bySource: [],
  channelPerformance: []
};

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function exportApiCandidates() {
  const envBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  if (typeof window === "undefined") return [envBase];
  const out = [envBase];
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    out.push("http://localhost:4000");
    out.push("http://127.0.0.1:4000");
  }
  return Array.from(new Set(out));
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [canAccessPortal, setCanAccessPortal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [campaignLimit, setCampaignLimit] = useState(20);
  const [leadLimit, setLeadLimit] = useState(10);

  useEffect(() => {
    syncSessionCookieFromStorage();
    setCanAccessPortal(canAccessFounderPortal(getUserEmail()));
    setError("");
    setSessionNotice("");
    const active = isSignedIn();
    if (!active) {
      setIsDemo(true);
      setData(DEMO_DASHBOARD);
      setCampaigns(DEMO_CAMPAIGNS);
      setLeads(DEMO_LEADS);
      setLastUpdated(new Date().toLocaleString());
      return;
    }

    setIsDemo(false);

    Promise.all([
      api<DashboardData>("/api/v1/dashboard"),
      api<{ rows: CampaignRow[] }>("/api/v1/dashboard/campaigns"),
      api<{ leads: LeadRow[] }>("/api/v1/leads?limit=200")
    ])
      .then(([dashboard, campaignRows, leadRows]) => {
        setIsDemo(false);
        setSessionNotice("");
        setData(dashboard);
        setCampaigns(campaignRows.rows || []);
        setLeads(leadRows.leads || []);
        setLastUpdated(new Date().toLocaleString());
      })
      .catch((e) => {
        const message = String(e?.message || "");
        const token = getToken();
        const isOfflineSession = token === "offline-session";
        const isAuthError =
          message.toLowerCase().includes("invalid token") ||
          message.toLowerCase().includes("unauthorized") ||
          message.includes("(401)");
        if (isAuthError && !isOfflineSession) {
          clearSession();
          setIsDemo(false);
          setSessionNotice("Session expired. Please log in again.");
          setData(EMPTY_DASHBOARD);
          setCampaigns([]);
          setLeads([]);
          setLastUpdated(new Date().toLocaleString());
          return;
        }
        const isApiOffline =
          isOfflineSession ||
          message.includes("Cannot reach API") ||
          message.toLowerCase().includes("unable to log in right now") ||
          message.toLowerCase().includes("unable to create account right now");
        if (isApiOffline) {
          setIsDemo(false);
          setSessionNotice("API is offline. Showing your dashboard in zero-state until data is available.");
          setData(EMPTY_DASHBOARD);
          setCampaigns([]);
          setLeads([]);
          setLastUpdated(new Date().toLocaleString());
          return;
        }
        setError(message || "Unable to load dashboard");
        setData(EMPTY_DASHBOARD);
        setCampaigns([]);
        setLeads([]);
        setLastUpdated(new Date().toLocaleString());
      });
  }, []);

  const normalizedData = useMemo(() => {
    const source = data || (isDemo ? DEMO_DASHBOARD : EMPTY_DASHBOARD);
    return {
      ...source,
      kpis: {
        totalSpend: Number(source?.kpis?.totalSpend || 0),
        leads: Number(source?.kpis?.leads || 0),
        cpl: Number(source?.kpis?.cpl || 0),
        bookedCalls: Number(source?.kpis?.bookedCalls || 0),
        costPerBookedCall: Number(source?.kpis?.costPerBookedCall || 0)
      },
      trends: Array.isArray(source.trends) && source.trends.length ? source.trends : EMPTY_TRENDS,
      bySource: Array.isArray(source.bySource) ? source.bySource : [],
      channelPerformance: Array.isArray(source.channelPerformance) ? source.channelPerformance : []
    };
  }, [data, isDemo]);

  const hasRealData =
    Number(normalizedData.kpis.leads || 0) > 0 || Number(normalizedData.kpis.totalSpend || 0) > 0;

  const pipeline = useMemo(() => {
    const base = { NEW: 0, CONTACTED: 0, BOOKED: 0, LOST: 0 };
    leads.forEach((lead) => {
      if (lead.status in base) base[lead.status as keyof typeof base] += 1;
    });
    return base;
  }, [leads]);

  const recentLeads = useMemo(
    () =>
      [...leads]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [leads]
  );

  const sourceTotal = normalizedData.bySource.reduce((sum, row) => sum + Number(row.leads || 0), 0);

  async function exportLeadsCsv() {
    setExporting(true);
    setError("");
    try {
      const token = getToken();
      if (!token) {
        setError("Please sign in to export real lead data.");
        return;
      }

      let networkError: Error | null = null;
      for (const base of exportApiCandidates()) {
        try {
          const response = await fetch(`${base}/api/v1/dashboard/export.csv`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.error || `Export failed (${response.status})`);
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "leads.csv";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          return;
        } catch (err) {
          const message = String((err as Error)?.message || "");
          const isNetwork = message.includes("Failed to fetch") || message.includes("NetworkError");
          if (isNetwork) {
            networkError = err as Error;
            continue;
          }
          throw err;
        }
      }
      if (networkError) throw networkError;
    } catch (e) {
      setError(String((e as Error)?.message || "Unable to export CSV"));
    } finally {
      setExporting(false);
    }
  }

  if (error && !data) return <p className="text-red-300">{error}</p>;
  if (!data && !isDemo) return <p>Loading dashboard...</p>;

  const k = normalizedData.kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{isDemo ? "Example Owner Lead Dashboard" : "Owner Lead Dashboard"}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={exportLeadsCsv} disabled={exporting}>
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          {!isDemo && canAccessPortal && (
            <Link className="btn-secondary" href="/ad-production-portal/ad-manager">
              Open Ad Manager
            </Link>
          )}
          <Link className="btn-primary" href="/onboarding/step-1">Start New Campaign</Link>
        </div>
      </div>
      <p className="text-xs text-slate-400">Last updated: {lastUpdated || "Loading..."}</p>

      {!isDemo && !hasRealData && (
        <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
          No campaign data yet. Create your first campaign and this dashboard will start filling in.
        </div>
      )}
      {isDemo && (
        <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
          Demo view only. Sign in to see your real dashboard (starts at zero for new accounts).
        </div>
      )}
      {sessionNotice && (
        <div className="rounded border border-amber-600/60 bg-amber-900/20 p-3 text-sm text-amber-200">
          {sessionNotice}
        </div>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-3 md:grid-cols-5">
        <div className="card"><p>Total Spend</p><h2 className="text-2xl font-bold">{formatMoney(k.totalSpend)}</h2></div>
        <div className="card"><p>Leads</p><h2 className="text-2xl font-bold">{k.leads}</h2></div>
        <div className="card"><p>CPL</p><h2 className="text-2xl font-bold">{formatMoney(k.cpl)}</h2></div>
        <div className="card"><p>Booked Calls</p><h2 className="text-2xl font-bold">{k.bookedCalls}</h2></div>
        <div className="card"><p>Cost / Booked Call</p><h2 className="text-2xl font-bold">{formatMoney(k.costPerBookedCall)}</h2></div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-300">Pipeline: New</p>
          <p className="text-2xl font-bold">{pipeline.NEW}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-300">Pipeline: Contacted</p>
          <p className="text-2xl font-bold">{pipeline.CONTACTED}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-300">Pipeline: Booked</p>
          <p className="text-2xl font-bold">{pipeline.BOOKED}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-300">Pipeline: Lost</p>
          <p className="text-2xl font-bold">{pipeline.LOST}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card h-72">
          <h3 className="mb-3 text-xl font-semibold">6-Week Lead Trend</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={normalizedData.trends}>
              <XAxis dataKey="weekStart" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="leads" stroke="#9ab7ff" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card h-72">
          <h3 className="mb-3 text-xl font-semibold">Spend by Channel</h3>
          {normalizedData.channelPerformance.length ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={normalizedData.channelPerformance}>
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="spend" fill="#9ab7ff" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[85%] items-center justify-center text-sm text-slate-400">
              No channel spend yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 text-xl font-semibold">Source Performance</h3>
          <div className="space-y-2">
            {normalizedData.bySource.length === 0 && <p className="text-sm text-slate-400">No sources yet.</p>}
            {normalizedData.bySource.map((row) => {
              const share = sourceTotal ? Math.round((row.leads / sourceTotal) * 100) : 0;
              return (
                <div key={row.source} className="flex items-center justify-between rounded border border-slate-700 p-2 text-sm">
                  <span>{row.source}</span>
                  <span>{row.leads} leads ({share}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-2 text-xl font-semibold">Channel Performance</h3>
          <div className="space-y-2">
            {normalizedData.channelPerformance.length === 0 && <p className="text-sm text-slate-400">No channel rows yet.</p>}
            {normalizedData.channelPerformance.map((row) => (
              <div key={row.channel} className="flex items-center justify-between rounded border border-slate-700 p-2 text-sm">
                <span>{row.channel}</span>
                <span>{formatMoney(row.spend)} across {row.entries} entries</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-2 text-xl font-semibold">Campaign Detail</h3>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-slate-300">
            <tr>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Campaign</th>
              <th className="py-2 pr-3">Spend</th>
              <th className="py-2 pr-3">Leads</th>
              <th className="py-2 pr-3">CPL</th>
              <th className="py-2 pr-3">Booked</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td className="py-2 text-slate-400" colSpan={6}>No campaigns yet.</td>
              </tr>
            )}
            {campaigns.slice(0, campaignLimit).map((row) => (
              <tr key={`${row.channel}-${row.campaign}`} className="border-t border-slate-800">
                <td className="py-2 pr-3">{row.channel}</td>
                <td className="py-2 pr-3">{row.campaign}</td>
                <td className="py-2 pr-3">{formatMoney(row.spend)}</td>
                <td className="py-2 pr-3">{row.leads}</td>
                <td className="py-2 pr-3">{formatMoney(row.cpl)}</td>
                <td className="py-2 pr-3">{row.bookedCalls}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns.length > campaignLimit && (
          <div className="pt-3">
            <button type="button" className="btn-secondary" onClick={() => setCampaignLimit((n) => n + 20)}>
              Show 20 more campaigns
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-2 text-xl font-semibold">Recent Leads</h3>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-slate-300">
            <tr>
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Campaign</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentLeads.length === 0 && (
              <tr>
                <td className="py-2 text-slate-400" colSpan={5}>No leads yet.</td>
              </tr>
            )}
            {recentLeads.slice(0, leadLimit).map((lead) => (
              <tr key={lead.id} className="border-t border-slate-800">
                <td className="py-2 pr-3">{new Date(lead.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">{lead.contactName || "Unknown"}</td>
                <td className="py-2 pr-3">{lead.source}</td>
                <td className="py-2 pr-3">{lead.campaign || "(none)"}</td>
                <td className="py-2 pr-3">{lead.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentLeads.length > leadLimit && (
          <div className="pt-3">
            <button type="button" className="btn-secondary" onClick={() => setLeadLimit((n) => n + 10)}>
              Show 10 more leads
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
