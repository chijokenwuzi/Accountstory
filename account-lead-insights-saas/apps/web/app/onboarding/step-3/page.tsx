"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isSignedIn, syncSessionCookieFromStorage } from "../../../lib/client";

type StepRow = {
  stepName: string;
  status: string;
  dataJson?: Record<string, unknown>;
};

export default function Step3Page() {
  const router = useRouter();
  const [summary, setSummary] = useState("Draft intake");
  const [mode, setMode] = useState<"upload" | "done-for-you">("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    syncSessionCookieFromStorage();
    if (!isSignedIn()) {
      router.replace("/signup");
      return;
    }

    api<{ steps: StepRow[] }>("/api/v1/onboarding/steps")
      .then((payload) => {
        const step2 = payload.steps.find(
          (step) => step.stepName === "business-profile" && step.status === "COMPLETE"
        );
        if (!step2) {
          router.replace("/onboarding/step-2");
          return;
        }

        const businessName = String(step2.dataJson?.businessName || "Draft intake");
        const channels = Array.isArray(step2.dataJson?.channels)
          ? (step2.dataJson?.channels as string[])
          : [];
        setSummary(
          `${businessName} · Channels: ${channels.length ? channels.join(", ") : "google-ads"}`
        );

        const step3 = payload.steps.find(
          (step) => step.stepName === "asset-pack" && step.status === "COMPLETE"
        );
        const savedVsl = (step3?.dataJson?.vslWorkflow || {}) as Record<string, unknown>;
        if (savedVsl.mode === "done-for-you" || savedVsl.mode === "upload") {
          setMode(savedVsl.mode);
        }
        if (typeof savedVsl.videoUrl === "string") setVideoUrl(savedVsl.videoUrl);
        if (typeof savedVsl.notes === "string") setNotes(savedVsl.notes);
        if (typeof savedVsl.uploadedFileName === "string") setUploadedFileName(savedVsl.uploadedFileName);
      })
      .catch(() => {
        setError("Could not load saved progress. You can still complete this step now.");
      });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api("/api/v1/onboarding/step", {
        method: "POST",
        body: JSON.stringify({
          stepName: "asset-pack",
          status: "COMPLETE",
          data: {
            vslWorkflow: {
              mode,
              videoUrl,
              notes,
              uploadedFileName
            }
          }
        })
      });

      router.push("/onboarding/step-4");
    } catch (err) {
      setError((err as Error).message || "Unable to save creative direction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Step 3 of 4</p>
      <h1 className="text-3xl font-bold">Ad Messaging Setup</h1>
      <p className="text-slate-300">{summary}</p>

      <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
        <h2 className="text-xl font-semibold">How to prepare high-converting home service ads</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Open with urgent homeowner pain (leak, no heat/AC, outage, roof damage).</li>
          <li>Show response speed, trust signals, and warranty or guarantee.</li>
          <li>Use one proof point: rating, review count, or before/after result.</li>
          <li>State the offer clearly: service, price point, and service area.</li>
          <li>Use one CTA: Call now, Book today, or Request same-day service.</li>
        </ol>
      </div>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 rounded border border-slate-700 bg-slate-900/40 p-3">
          <p className="mb-2 text-sm text-slate-300">Creative production choice</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "upload"}
                onChange={() => setMode("upload")}
              />
              Upload Existing Creative
            </label>
            <label className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "done-for-you"}
                onChange={() => setMode("done-for-you")}
              />
              Ask Us To Create Creative
            </label>
          </div>
        </div>

        <label className="md:col-span-2 space-y-1 text-sm text-slate-300">
          Upload video or creative file (optional)
          <input
            type="file"
            accept="video/*,image/*"
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            onChange={(e) => {
              const name = e.target.files?.[0]?.name || "";
              setUploadedFileName(name);
            }}
          />
          {uploadedFileName && <span className="text-xs text-slate-400">Selected: {uploadedFileName}</span>}
        </label>

        <input
          className="md:col-span-2 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          placeholder="Existing creative URL (optional)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />

        <textarea
          className="md:col-span-2 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          rows={4}
          placeholder="Creative instructions / notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="md:col-span-2 flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.push("/onboarding/step-2")}>Back</button>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : "Continue to Assets + Budget"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
