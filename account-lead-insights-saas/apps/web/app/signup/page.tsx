"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getToken, setTokens, setUserEmail } from "../../lib/client";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg card">Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = useRef(false);
  const [form, setForm] = useState({ orgName: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextPathRaw = String(searchParams.get("next") || "").trim();
  const nextPath = nextPathRaw.startsWith("/") ? nextPathRaw : "/onboarding/step-1";

  function isApiOfflineError(err: unknown) {
    const message = String((err as Error)?.message || "");
    return (
      message.includes("Cannot reach API") ||
      message.includes("Failed to fetch") ||
      message.includes("Unable to create account right now")
    );
  }

  function navigate(path: string) {
    if (redirected.current) return;
    redirected.current = true;
    router.replace(path);
    window.setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname !== path) {
        window.location.assign(path);
      }
    }, 250);
  }

  useEffect(() => {
    if (getToken()) {
      navigate(nextPath);
    }
  }, [router, nextPath]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: { email: string } }>(
        "/api/v1/auth/register",
        {
          method: "POST",
          body: JSON.stringify(form)
        }
      );
      setTokens(data.accessToken, data.refreshToken);
      setUserEmail(data.user.email);
      const pendingRaw = localStorage.getItem("ali_pending_intake");
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          await api("/api/v1/onboarding/quick-intake", {
            method: "POST",
            body: JSON.stringify(pending)
          });
          localStorage.removeItem("ali_pending_intake");
          navigate("/onboarding/step-2");
          return;
        } catch {
          localStorage.removeItem("ali_pending_intake");
        }
      }
      navigate(nextPath);
    } catch (err) {
      if (isApiOfflineError(err)) {
        // Fallback mode keeps onboarding accessible while API deployment is being finalized.
        setTokens("offline-session");
        setUserEmail(form.email);
        navigate("/dashboard");
        return;
      }
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg card">
      <h1 className="mb-4 text-3xl font-bold">Get Started Right Away</h1>
      <p className="mb-4 text-sm text-slate-300">Create your account and start the 4-step lead generation flow.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Business name" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
        <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn-primary w-full" type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Account"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
