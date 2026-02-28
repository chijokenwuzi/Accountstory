"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isSignedIn, syncSessionCookieFromStorage } from "../../../lib/client";

type StepRow = {
  stepName: string;
  status: string;
  dataJson?: Record<string, unknown>;
};

type ChannelKey = "google-ads" | "facebook-ads" | "local-services-ads" | "seo";

type Allocation = {
  key: ChannelKey;
  label: string;
  percent: number;
};

const CHANNEL_CONFIG: Record<
  ChannelKey,
  { label: string; cpl: number; budgetChannel?: "GOOGLE" | "FACEBOOK" }
> = {
  "google-ads": { label: "Google Ads", cpl: 180, budgetChannel: "GOOGLE" },
  "facebook-ads": { label: "Facebook Ads", cpl: 135, budgetChannel: "FACEBOOK" },
  "local-services-ads": { label: "Local Service Ads", cpl: 95 },
  seo: { label: "SEO", cpl: 95 }
};

function normalizeTo100(values: number[]) {
  const raw = values.map((value) => Math.max(0, Number(value) || 0));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    const equal = Math.floor(100 / Math.max(1, raw.length));
    const remainder = 100 - equal * Math.max(1, raw.length);
    return raw.map((_, index) => equal + (index < remainder ? 1 : 0));
  }

  const scaled = raw.map((value) => (value / sum) * 100);
  const floored = scaled.map((value) => Math.floor(value));
  let remainder = 100 - floored.reduce((acc, value) => acc + value, 0);
  const order = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  let pointer = 0;
  while (remainder > 0 && order.length) {
    floored[order[pointer % order.length].index] += 1;
    pointer += 1;
    remainder -= 1;
  }
  return floored;
}

function rebalanceAllocations(allocations: Allocation[], changedKey: ChannelKey, nextPercent: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(nextPercent) || 0)));
  const updated = allocations.map((entry) => ({ ...entry }));
  const target = updated.find((entry) => entry.key === changedKey);
  if (!target) return updated;

  const others = updated.filter((entry) => entry.key !== changedKey);
  if (!others.length) {
    target.percent = 100;
    return updated;
  }

  const remaining = 100 - clamped;
  const otherCurrent = others.map((entry) => entry.percent);
  const normalizedOthers = normalizeTo100(otherCurrent.length ? otherCurrent : others.map(() => 1)).map((v) =>
    Math.round((v / 100) * remaining)
  );

  target.percent = clamped;
  others.forEach((entry, index) => {
    entry.percent = normalizedOthers[index] ?? 0;
  });

  const finalPercents = normalizeTo100(updated.map((entry) => entry.percent));
  return updated.map((entry, index) => ({ ...entry, percent: finalPercents[index] ?? 0 }));
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US")}`;
}

export default function Step4Page() {
  const router = useRouter();
  const [summary, setSummary] = useState("Draft intake");
  const [businessName, setBusinessName] = useState("Acme HVAC");
  const [quickIntake, setQuickIntake] = useState<{
    name: string;
    phone: string;
    email: string;
    preferredCommMethod: "PHONE" | "SMS" | "EMAIL";
    availability: string;
  } | null>(null);

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState(3000);
  const [targetCpl, setTargetCpl] = useState(75);
  const [phoneMix, setPhoneMix] = useState(0.6);
  const [allocations, setAllocations] = useState<Allocation[]>([
    { key: "google-ads", label: CHANNEL_CONFIG["google-ads"].label, percent: 50 },
    { key: "facebook-ads", label: CHANNEL_CONFIG["facebook-ads"].label, percent: 50 }
  ]);

  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [testimonialFiles, setTestimonialFiles] = useState<string[]>([]);
  const [blogFiles, setBlogFiles] = useState<string[]>([]);
  const [testimonialText, setTestimonialText] = useState("");
  const [contentLinks, setContentLinks] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const forecast = useMemo(() => {
    const expected = allocations.reduce((sum, entry) => {
      const channelBudget = (monthlyBudgetUsd * entry.percent) / 100;
      return sum + channelBudget / CHANNEL_CONFIG[entry.key].cpl;
    }, 0);
    const rounded = Math.max(1, Math.round(expected));
    return {
      expected: rounded,
      low: Math.max(1, Math.floor(rounded * 0.8)),
      high: Math.max(1, Math.ceil(rounded * 1.2))
    };
  }, [allocations, monthlyBudgetUsd]);

  const allocationTotal = useMemo(
    () => allocations.reduce((sum, entry) => sum + Number(entry.percent || 0), 0),
    [allocations]
  );

  useEffect(() => {
    syncSessionCookieFromStorage();
    if (!isSignedIn()) {
      router.replace("/signup");
      return;
    }

    api<{ steps: StepRow[] }>("/api/v1/onboarding/steps")
      .then((payload) => {
        const quick = payload.steps.find(
          (step) => step.stepName === "quick-intake" && step.status === "COMPLETE"
        );
        const step2 = payload.steps.find(
          (step) => step.stepName === "business-profile" && step.status === "COMPLETE"
        );
        const step3 = payload.steps.find(
          (step) => step.stepName === "asset-pack" && step.status === "COMPLETE"
        );

        if (!quick) {
          router.replace("/onboarding/step-1");
          return;
        }
        if (!step2) {
          router.replace("/onboarding/step-2");
          return;
        }
        if (!step3) {
          router.replace("/onboarding/step-3");
          return;
        }

        const quickData = quick.dataJson || {};
        setQuickIntake({
          name: String(quickData.name || ""),
          phone: String(quickData.phone || ""),
          email: String(quickData.email || ""),
          preferredCommMethod:
            quickData.preferredCommMethod === "SMS" || quickData.preferredCommMethod === "EMAIL"
              ? quickData.preferredCommMethod
              : "PHONE",
          availability: String(quickData.availability || "")
        });

        const businessData = step2.dataJson || {};
        const channels = Array.isArray(businessData.channels)
          ? (businessData.channels as string[]).filter(
              (entry): entry is ChannelKey => entry in CHANNEL_CONFIG
            )
          : [];
        const normalizedChannels: ChannelKey[] = channels.length
          ? channels
          : ["google-ads", "facebook-ads"];

        const initialAllocation = normalizeTo100(normalizedChannels.map(() => 1)).map((percent, index) => {
          const key = normalizedChannels[index];
          return {
            key,
            label: CHANNEL_CONFIG[key].label,
            percent
          };
        });

        setBusinessName(String(businessData.businessName || "Acme HVAC"));
        setSummary(
          `${String(businessData.businessName || "Draft intake")} · Channels: ${normalizedChannels
            .map((key) => CHANNEL_CONFIG[key].label)
            .join(", ")}`
        );
        setMonthlyBudgetUsd(Number(businessData.monthlyBudgetUsd || 3000));
        setAllocations(initialAllocation);

        const step4 = payload.steps.find(
          (step) => step.stepName === "budget-plan" && step.status === "COMPLETE"
        );
        if (step4?.dataJson) {
          const step4Data = step4.dataJson as Record<string, unknown>;
          if (typeof step4Data.month === "string") setMonth(step4Data.month);
          if (typeof step4Data.targetCpl === "number") setTargetCpl(step4Data.targetCpl);
          if (typeof step4Data.phoneMix === "number") setPhoneMix(step4Data.phoneMix);
          if (typeof step4Data.monthlyBudgetUsd === "number") setMonthlyBudgetUsd(step4Data.monthlyBudgetUsd);

          if (step4Data.channelAllocations && typeof step4Data.channelAllocations === "object") {
            const allocationMap = step4Data.channelAllocations as Record<string, number>;
            const restored = normalizeTo100(
              normalizedChannels.map((channel) => Number(allocationMap[channel] || 0))
            ).map((percent, index) => ({
              key: normalizedChannels[index],
              label: CHANNEL_CONFIG[normalizedChannels[index]].label,
              percent
            }));
            setAllocations(restored);
          }

          if (step4Data.assets && typeof step4Data.assets === "object") {
            const assets = step4Data.assets as Record<string, unknown>;
            if (Array.isArray(assets.imageFiles)) setImageFiles(assets.imageFiles.map(String));
            if (Array.isArray(assets.testimonialFiles)) setTestimonialFiles(assets.testimonialFiles.map(String));
            if (Array.isArray(assets.blogFiles)) setBlogFiles(assets.blogFiles.map(String));
            if (typeof assets.testimonialText === "string") setTestimonialText(assets.testimonialText);
            if (typeof assets.contentLinks === "string") setContentLinks(assets.contentLinks);
          }
        }
      })
      .catch(() => {
        setError("Could not load saved progress. You can still complete this final step now.");
      });
  }, [router]);

  function onPercentChange(channel: ChannelKey, percent: number) {
    setAllocations((current) => rebalanceAllocations(current, channel, percent));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const normalized = normalizeTo100(allocations.map((entry) => entry.percent));
      const normalizedAllocations = allocations.map((entry, index) => ({
        ...entry,
        percent: normalized[index] ?? 0
      }));

      const channelAllocations = normalizedAllocations.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.key] = entry.percent;
        return acc;
      }, {});

      const googlePercent = Number(channelAllocations["google-ads"] || 0);
      const facebookPercent = Number(channelAllocations["facebook-ads"] || 0);
      const paidTotal = googlePercent + facebookPercent;

      const allocationsPayload =
        paidTotal > 0
          ? [
              googlePercent > 0
                ? {
                    channel: "GOOGLE" as const,
                    budget: (monthlyBudgetUsd * googlePercent) / 100,
                    targetCpl,
                    expectedLeadShare: googlePercent / paidTotal
                  }
                : null,
              facebookPercent > 0
                ? {
                    channel: "FACEBOOK" as const,
                    budget: (monthlyBudgetUsd * facebookPercent) / 100,
                    targetCpl,
                    expectedLeadShare: facebookPercent / paidTotal
                  }
                : null
            ].filter((row): row is { channel: "GOOGLE" | "FACEBOOK"; budget: number; targetCpl: number; expectedLeadShare: number } =>
              Boolean(row)
            )
          : [
              {
                channel: "GOOGLE" as const,
                budget: monthlyBudgetUsd,
                targetCpl,
                expectedLeadShare: 1
              }
            ];

      await api("/api/v1/onboarding/budget-plan", {
        method: "POST",
        body: JSON.stringify({
          month,
          allocations: allocationsPayload,
          targetCpl,
          phoneMix
        })
      });

      await api("/api/v1/onboarding/step", {
        method: "POST",
        body: JSON.stringify({
          stepName: "budget-plan",
          status: "COMPLETE",
          data: {
            month,
            monthlyBudgetUsd,
            targetCpl,
            phoneMix,
            channelAllocations,
            forecast,
            assets: {
              imageFiles,
              testimonialFiles,
              blogFiles,
              testimonialText,
              contentLinks
            }
          }
        })
      });

      if (quickIntake?.name && quickIntake?.email && quickIntake?.phone) {
        await api("/api/v1/leads/signup-intake", {
          method: "POST",
          body: JSON.stringify({
            orgName: businessName,
            name: quickIntake.name,
            phone: quickIntake.phone,
            email: quickIntake.email,
            bestMethod: quickIntake.preferredCommMethod,
            availability: quickIntake.availability
          })
        });
      }

      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Unable to finish setup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Step 4 of 4</p>
      <h1 className="text-3xl font-bold">Service Assets + Budget Allocation</h1>
      <p className="text-slate-300">{summary}</p>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-3 rounded border border-slate-700 bg-slate-900/40 p-3">
          <h2 className="text-xl font-semibold">Upload service assets and proof</h2>

          <label className="block space-y-1 text-sm text-slate-300">
            Pictures / creative assets
            <input
              type="file"
              multiple
              accept="image/*"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              onChange={(e) => setImageFiles(Array.from(e.target.files || []).map((file) => file.name))}
            />
          </label>
          {imageFiles.length > 0 && <p className="text-xs text-slate-400">{imageFiles.join(", ")}</p>}

          <label className="block space-y-1 text-sm text-slate-300">
            Testimonials (documents, screenshots, or video)
            <input
              type="file"
              multiple
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              onChange={(e) => setTestimonialFiles(Array.from(e.target.files || []).map((file) => file.name))}
            />
          </label>
          {testimonialFiles.length > 0 && <p className="text-xs text-slate-400">{testimonialFiles.join(", ")}</p>}

          <label className="block space-y-1 text-sm text-slate-300">
            Blogs / articles / PDFs
            <input
              type="file"
              multiple
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
              onChange={(e) => setBlogFiles(Array.from(e.target.files || []).map((file) => file.name))}
            />
          </label>
          {blogFiles.length > 0 && <p className="text-xs text-slate-400">{blogFiles.join(", ")}</p>}

          <textarea
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            rows={3}
            placeholder="Testimonial text (optional)"
            value={testimonialText}
            onChange={(e) => setTestimonialText(e.target.value)}
          />

          <textarea
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            rows={3}
            placeholder="Links to existing content (optional)"
            value={contentLinks}
            onChange={(e) => setContentLinks(e.target.value)}
          />
        </div>

        <div className="space-y-3 rounded border border-slate-700 bg-slate-900/40 p-3">
          <h2 className="text-xl font-semibold">Budget + Lead Plan</h2>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="YYYY-MM"
            />
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
              type="number"
              min={1000}
              value={monthlyBudgetUsd}
              onChange={(e) => setMonthlyBudgetUsd(Number(e.target.value) || 0)}
              placeholder="Monthly budget"
            />
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
              type="number"
              min={1}
              value={targetCpl}
              onChange={(e) => setTargetCpl(Number(e.target.value) || 1)}
              placeholder="Target CPL"
            />
          </div>

          <label className="block space-y-1 text-sm text-slate-300">
            Phone vs form mix (0-1)
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={phoneMix}
              onChange={(e) => setPhoneMix(Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>

          <div className="space-y-3">
            {allocations.map((entry) => (
              <div key={entry.key} className="rounded border border-slate-700 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <strong>{entry.label}</strong>
                  <span>{entry.percent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={entry.percent}
                  className="w-full"
                  onChange={(e) => onPercentChange(entry.key, Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {money((monthlyBudgetUsd * entry.percent) / 100)} allocated
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-300">Total allocation: {allocationTotal}%</p>
          <p className="text-sm text-slate-300">
            Expected leads: {forecast.low}-{forecast.high} / month (best estimate {forecast.expected})
          </p>
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.push("/onboarding/step-3")}>Back</button>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : "Finish Setup"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
