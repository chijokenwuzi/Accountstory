"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  clearSession,
  getUserEmail,
  isSignedIn,
  syncSessionCookieFromStorage
} from "../../lib/client";
import { canAccessFounderPortal, founderEmail } from "../../lib/founder-access";

type AccessResponse = { email: string; allowed?: boolean };

type SignupRow = {
  id: string;
  orgName: string;
  name: string;
  email: string;
  phone: string;
  bestMethod?: string;
  availability?: string;
  source?: string;
  formSource?: string;
  createdAt: string;
};

export default function AdProductionPortalHome() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<SignupRow[]>([]);

  useEffect(() => {
    syncSessionCookieFromStorage();
    const active = isSignedIn();
    if (!active) {
      setSignedIn(false);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const localEmail = getUserEmail();
    setSignedIn(true);
    setEmail(localEmail);

    if (!canAccessFounderPortal(localEmail)) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    Promise.all([
      api<AccessResponse>("/api/v1/admin/access"),
      api<{ signups: SignupRow[] }>("/api/v1/admin/signups")
    ])
      .then(([access, signupData]) => {
        setEmail(access.email || localEmail);
        setAllowed(true);
        setRows(signupData.signups || []);
        setError("");
      })
      .catch((err) => {
        const message = String((err as Error)?.message || "");
        const isAuthError =
          message.toLowerCase().includes("invalid token") ||
          message.toLowerCase().includes("unauthorized") ||
          message.includes("(401)");
        const isForbidden = message.toLowerCase().includes("forbidden") || message.includes("(403)");

        if (isAuthError) {
          clearSession();
          setSignedIn(false);
          setAllowed(false);
          setError("");
          return;
        }

        if (isForbidden) {
          setAllowed(false);
          setError("");
          return;
        }

        setAllowed(true);
        setError(message || "Unable to load portal tools right now.");
      })
      .finally(() => setLoading(false));
  }, []);

  const latestRows = useMemo(() => rows.slice(0, 5), [rows]);

  if (loading) return <p>Loading Ad Production Portal...</p>;

  if (!signedIn) {
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Ad Production Portal</h1>
        <p className="text-slate-300">Sign in first to access the backend tools.</p>
        <Link href="/login" className="btn-primary inline-block">
          Login
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Ad Production Portal</h1>
        <p className="text-slate-300">
          This area is restricted. Only <strong>{founderEmail()}</strong> can open Ad Manager and Sign Up List.
        </p>
        <p className="text-sm text-slate-400">Current account: {email || "Unknown"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h1 className="text-3xl font-bold">Ad Production Portal</h1>
        <p className="text-sm text-slate-300">
          Logged in as {email || "your account"}. Open a section below.
        </p>
        {error && <p className="text-sm text-amber-300">{error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/ad-production-portal/sign-up-list" className="card block space-y-2 hover:border-slate-500">
          <h2 className="text-xl font-semibold">Sign Up List</h2>
          <p className="text-sm text-slate-300">View full intake form details submitted from the funnel.</p>
        </Link>

        <Link href="/ad-production-portal/ad-manager" className="card block space-y-2 hover:border-slate-500">
          <h2 className="text-xl font-semibold">Ad Manager</h2>
          <p className="text-sm text-slate-300">Open the legacy ad manager workspace.</p>
        </Link>

        <Link href="/ad-production-portal/admin-list" className="card block space-y-2 hover:border-slate-500">
          <h2 className="text-xl font-semibold">Admin List</h2>
          <p className="text-sm text-slate-300">Manage the backend admin email list.</p>
        </Link>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Recent Intake Forms</h2>
          <Link href="/ad-production-portal/sign-up-list" className="btn-secondary">
            Open Full Sign Up List
          </Link>
        </div>

        {latestRows.length === 0 && <p className="text-slate-400">No intake forms yet.</p>}

        {latestRows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 p-3 text-sm">
            <p className="font-semibold">{row.name || "Unnamed"}</p>
            <p>{row.orgName || "Unknown business"}</p>
            <p>{row.email || "No email"}</p>
            <p>{row.phone || "No phone"}</p>
            <p className="text-slate-300">
              Best method: {row.bestMethod || "Not provided"} | Availability: {row.availability || "Not provided"}
            </p>
            <p className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
