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

const CHANNEL_CPL: Record<ChannelKey, number> = {
  "google-ads": 180,
  "facebook-ads": 135,
  "local-services-ads": 95,
  seo: 95
};

const CHANNEL_OPTIONS: Array<{ key: ChannelKey; label: string }> = [
  { key: "google-ads", label: "Google Ads" },
  { key: "facebook-ads", label: "Facebook Ads" },
  { key: "local-services-ads", label: "Local Service Ads" },
  { key: "seo", label: "SEO" }
];

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US")}`;
}

export default function Step2Page() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    industry: "HVAC",
    productName: "",
    monthlyBudgetUsd: 3000,
    channels: ["google-ads", "facebook-ads"] as ChannelKey[],
    offer: "",
    serviceAreas: "Phoenix, Scottsdale",
    targetZips: "85001, 85002",
    audience: "",
    differentiators: "",
    objective: "Generate booked service calls",
    tone: "Confident",
    landingPage: "",
    hours: "8am-6pm",
    callRoutingNumber: ""
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const leadEstimate = useMemo(() => {
    const selected: ChannelKey[] = form.channels.length ? form.channels : ["google-ads"];
    const channelBudget = form.monthlyBudgetUsd / selected.length;
    const expected = selected.reduce((sum, key) => sum + channelBudget / CHANNEL_CPL[key], 0);
    const rounded = Math.max(1, Math.round(expected));
    return {
      expected: rounded,
      low: Math.max(1, Math.floor(rounded * 0.8)),
      high: Math.max(1, Math.ceil(rounded * 1.2))
    };
  }, [form.channels, form.monthlyBudgetUsd]);

  useEffect(() => {
    syncSessionCookieFromStorage();
    if (!isSignedIn()) {
      router.replace("/signup");
      return;
    }

    api<{ steps: StepRow[] }>("/api/v1/onboarding/steps")
      .then((payload) => {
        const quickIntake = payload.steps.find(
          (step) => step.stepName === "quick-intake" && step.status === "COMPLETE"
        );
        if (!quickIntake) {
          router.replace("/onboarding/step-1");
          return;
        }

        const saved = payload.steps.find(
          (step) => step.stepName === "business-profile" && step.status === "COMPLETE"
        );
        if (!saved?.dataJson) return;

        const channels = Array.isArray(saved.dataJson.channels)
          ? (saved.dataJson.channels.filter((c): c is ChannelKey => CHANNEL_OPTIONS.some((opt) => opt.key === c)) as ChannelKey[])
          : [];

        setForm((prev) => ({
          ...prev,
          businessName: String(saved.dataJson?.businessName || prev.businessName),
          industry: String(saved.dataJson?.industry || saved.dataJson?.tradeType || prev.industry),
          productName: String(saved.dataJson?.productName || prev.productName),
          monthlyBudgetUsd: Number(saved.dataJson?.monthlyBudgetUsd || prev.monthlyBudgetUsd),
          channels: channels.length ? channels : prev.channels,
          offer: String(saved.dataJson?.offer || prev.offer),
          serviceAreas: Array.isArray(saved.dataJson?.serviceAreas)
            ? String((saved.dataJson.serviceAreas as string[]).join(", "))
            : String(saved.dataJson?.serviceAreas || prev.serviceAreas),
          targetZips: Array.isArray(saved.dataJson?.targetZips)
            ? String((saved.dataJson.targetZips as string[]).join(", "))
            : String(saved.dataJson?.targetZips || prev.targetZips),
          audience: String(saved.dataJson?.audience || prev.audience),
          differentiators: Array.isArray(saved.dataJson?.differentiators)
            ? String((saved.dataJson.differentiators as string[]).join("\n"))
            : String(saved.dataJson?.differentiators || prev.differentiators),
          objective: String(saved.dataJson?.objective || prev.objective),
          tone: String(saved.dataJson?.tone || prev.tone),
          landingPage: String(saved.dataJson?.landingPage || prev.landingPage),
          hours: String(saved.dataJson?.hours || prev.hours),
          callRoutingNumber: String(saved.dataJson?.callRoutingNumber || prev.callRoutingNumber)
        }));
      })
      .catch(() => {
        setError("Could not load saved progress. You can continue and resave this step.");
      });
  }, [router]);

  function toggleChannel(channel: ChannelKey) {
    setForm((prev) => {
      const exists = prev.channels.includes(channel);
      if (exists) {
        return { ...prev, channels: prev.channels.filter((key) => key !== channel) };
      }
      return { ...prev, channels: [...prev.channels, channel] };
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (!form.offer.trim()) {
      setError("Offer is required.");
      return;
    }
    if (!form.callRoutingNumber.trim()) {
      setError("Call routing number is required.");
      return;
    }

    const serviceAreas = form.serviceAreas
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const targetZips = form.targetZips
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (form.channels.length === 0) {
      setError("Choose at least one channel.");
      return;
    }
    if (serviceAreas.length === 0) {
      setError("Enter at least one service area.");
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/v1/onboarding/business-profile", {
        method: "POST",
        body: JSON.stringify({
          tradeType: form.industry,
          serviceAreas,
          targetZips,
          offer: form.offer,
          hours: form.hours,
          callRoutingNumber: form.callRoutingNumber
        })
      });

      await api("/api/v1/onboarding/step", {
        method: "POST",
        body: JSON.stringify({
          stepName: "business-profile",
          status: "COMPLETE",
          data: {
            ...form,
            serviceAreas,
            targetZips,
            differentiators: form.differentiators
              .split(/\n|,/) 
              .map((v) => v.trim())
              .filter(Boolean)
          }
        })
      });

      router.push("/onboarding/step-3");
    } catch (err) {
      setError((err as Error).message || "Unable to save business + channel intake.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Step 2 of 4</p>
      <h1 className="text-3xl font-bold">Business + Channel Intake</h1>
      <p className="text-slate-300">
        This is the legacy intake step: set your business context, channels, and budget before creative setup.
      </p>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Business name"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Industry"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Product / service"
          value={form.productName}
          onChange={(e) => setForm({ ...form, productName: e.target.value })}
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Call routing number"
          value={form.callRoutingNumber}
          onChange={(e) => setForm({ ...form, callRoutingNumber: e.target.value })}
        />

        <label className="md:col-span-2 space-y-2 rounded border border-slate-700 bg-slate-900/40 px-3 py-3 text-sm">
          <span className="text-slate-300">Monthly budget (USD)</span>
          <input
            type="range"
            min={1000}
            max={50000}
            step={500}
            value={form.monthlyBudgetUsd}
            onChange={(e) => setForm({ ...form, monthlyBudgetUsd: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <strong>{money(form.monthlyBudgetUsd)} / month</strong>
            <span className="text-slate-300">
              Estimated leads: {leadEstimate.low}-{leadEstimate.high} / month
            </span>
          </div>
        </label>

        <div className="md:col-span-2 rounded border border-slate-700 bg-slate-900/40 px-3 py-3">
          <p className="mb-2 text-sm text-slate-300">Choose channels</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNEL_OPTIONS.map((option) => (
              <label key={option.key} className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.channels.includes(option.key)}
                  onChange={() => toggleChannel(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Service areas (comma-separated)"
          value={form.serviceAreas}
          onChange={(e) => setForm({ ...form, serviceAreas: e.target.value })}
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="ZIP codes (comma-separated)"
          value={form.targetZips}
          onChange={(e) => setForm({ ...form, targetZips: e.target.value })}
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Offer"
          value={form.offer}
          onChange={(e) => setForm({ ...form, offer: e.target.value })}
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Hours"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
        />

        <textarea
          className="md:col-span-2 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          rows={3}
          placeholder="Audience"
          value={form.audience}
          onChange={(e) => setForm({ ...form, audience: e.target.value })}
        />
        <textarea
          className="md:col-span-2 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          rows={3}
          placeholder="Differentiators (one per line)"
          value={form.differentiators}
          onChange={(e) => setForm({ ...form, differentiators: e.target.value })}
        />

        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Objective"
          value={form.objective}
          onChange={(e) => setForm({ ...form, objective: e.target.value })}
        />
        <select
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
        >
          <option value="Confident">Confident</option>
          <option value="Direct response">Direct response</option>
          <option value="Consultative">Consultative</option>
        </select>

        <input
          className="md:col-span-2 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Landing page URL (optional)"
          value={form.landingPage}
          onChange={(e) => setForm({ ...form, landingPage: e.target.value })}
        />

        <button className="btn-primary md:col-span-2" disabled={submitting}>
          {submitting ? "Saving..." : "Continue to Ad Messaging"}
        </button>
      </form>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
