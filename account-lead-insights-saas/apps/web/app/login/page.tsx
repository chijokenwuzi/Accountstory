"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, canUseOfflineFallback, setTokens, setUserEmail } from "../../lib/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md card">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("owner@acme.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const nextPathRaw = String(searchParams.get("next") || "").trim();
  const nextPath = nextPathRaw.startsWith("/") ? nextPathRaw : "/onboarding/step-1";

  function isApiOfflineError(err: unknown) {
    const message = String((err as Error)?.message || "");
    return (
      message.includes("Cannot reach API") ||
      message.includes("Failed to fetch") ||
      message.includes("Unable to log in right now")
    );
  }

  function navigate(path: string) {
    router.replace(path);
    window.setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname !== path) {
        window.location.assign(path);
      }
    }, 250);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: { email: string } }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
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
      if (isApiOfflineError(err) && canUseOfflineFallback()) {
        // Fallback mode keeps the product usable while API deployment is being finalized.
        setTokens("offline-session");
        setUserEmail(email);
        navigate("/dashboard");
        return;
      }
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-md card">
      <h1 className="mb-4 text-3xl font-bold">Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
        <button className="btn-primary w-full" type="submit">Login</button>
      </form>
      <p className="mt-3 text-sm text-slate-300">
        Need an account? <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="underline">Get Started Right Away</Link>
      </p>
      {error && <p className="mt-3 text-red-300">{error}</p>}
    </div>
  );
}
