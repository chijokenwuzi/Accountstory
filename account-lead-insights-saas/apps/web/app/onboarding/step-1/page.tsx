"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isSignedIn, syncSessionCookieFromStorage } from "../../../lib/client";

export default function Step1Page() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", preferredCommMethod: "PHONE", availability: "Weekdays 9-5" });

  useEffect(() => {
    syncSessionCookieFromStorage();
    if (!isSignedIn()) {
      router.replace("/signup");
      return;
    }
    api<{ steps: Array<{ stepName: string; status: string; dataJson?: Record<string, unknown> }> }>("/api/v1/onboarding/steps")
      .then((d) => {
        const step = d.steps.find((s) => s.stepName === "quick-intake" && s.status === "COMPLETE");
        if (!step) return;
        const nextAction = typeof step.dataJson?.nextAction === "string" ? step.dataJson.nextAction : "";
        if (nextAction === "WAIT_FOR_CALL") {
          router.replace("/dashboard");
          return;
        }
        router.replace("/onboarding/step-2");
      })
      .catch(() => {
        setError("Could not load saved progress. You can still complete Step 1 now.");
      });
  }, [router]);

  async function submit(nextAction: "START_NOW" | "WAIT_FOR_CALL") {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await api("/api/v1/onboarding/quick-intake", { method: "POST", body: JSON.stringify(form) });
      await api("/api/v1/onboarding/step", {
        method: "POST",
        body: JSON.stringify({
          stepName: "quick-intake",
          status: "COMPLETE",
          data: { ...form, nextAction }
        })
      });
      if (nextAction === "WAIT_FOR_CALL") {
        setMessage("Saved. We will call you and your dashboard is ready when you return.");
        router.push("/dashboard");
        return;
      }
      setMessage("Saved. Continuing setup.");
      router.push("/onboarding/step-2");
    } catch (err) {
      setError((err as Error).message || "Unable to save intake.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <h1 className="text-3xl font-bold">Step 1: Quick Intake Form</h1>
      <form className="grid gap-3 md:grid-cols-2">
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select className="rounded border border-slate-700 bg-slate-900 px-3 py-2" value={form.preferredCommMethod} onChange={(e) => setForm({ ...form, preferredCommMethod: e.target.value })}>
          <option value="PHONE">Phone</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
        </select>
        <textarea className="md:col-span-2 rounded border border-slate-700 bg-slate-900 px-3 py-2" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} />
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            type="button"
            disabled={loading}
            onClick={() => submit("START_NOW")}
          >
            Get Started Now
          </button>
          <button
            className="btn-secondary"
            type="button"
            disabled={loading}
            onClick={() => submit("WAIT_FOR_CALL")}
          >
            Wait for Call
          </button>
        </div>
      </form>
      <div className="flex justify-between"><Link href="/" className="text-slate-400">Back</Link><span>{message}</span></div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
