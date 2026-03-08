"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getUserEmail, isSignedIn, syncSessionCookieFromStorage } from "../../../lib/client";
import { canAccessFounderPortal, founderEmail } from "../../../lib/founder-access";

const LEGACY_BACKEND_URL =
  "/founderbackend/index.html";
const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_PORTAL_BASE_URL || "";

export default function PortalAdManagerPage() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const run = async () => {
      syncSessionCookieFromStorage();
      const ok = isSignedIn();
      setSignedIn(ok);
      if (!ok) {
        setChecked(true);
        return;
      }

      const localEmail = getUserEmail();
      if (!canAccessFounderPortal(localEmail)) {
        setAllowed(false);
        setChecked(true);
        return;
      }

      try {
        await api("/api/v1/admin/access");
        setAllowed(true);
        const legacyHealth = await fetch("/founderbackend/api/health", { cache: "no-store" });
        if (!legacyHealth.ok) {
          throw new Error(`Legacy backend health check failed (${legacyHealth.status})`);
        }
        const baseUrl = PORTAL_BASE_URL.trim() || window.location.origin;
        const target = new URL(LEGACY_BACKEND_URL, window.location.origin);
        target.searchParams.set("returnTo", `${baseUrl}/ad-production-portal`);
        window.location.assign(target.toString());
      } catch {
        setAllowed(true);
        setOffline(true);
        setChecked(true);
      }
    };
    run();
  }, []);

  if (!checked && !offline) return <p className="text-slate-300">Opening Ad Manager...</p>;
  if (!signedIn) return <p className="text-slate-300">Please sign in first.</p>;
  if (!allowed) {
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Ad Manager</h1>
        <p className="text-slate-300">
          Access is restricted. Only <strong>{founderEmail()}</strong> can open Ad Manager.
        </p>
        <Link href="/dashboard" className="btn-secondary inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (offline) {
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Ad Manager Unavailable</h1>
        <p className="text-slate-300">
          The Ad Manager backend is not reachable right now.
        </p>
        {isLocal ? (
          <p className="text-slate-300">
            Start dev with <code>npm run dev</code> from <code>account-lead-insights-saas</code>, then try again.
          </p>
        ) : (
          <p className="text-slate-300">
            The main portal is still available. Retry later after the legacy backend is deployed.
          </p>
        )}
        <div className="flex gap-2">
          <Link href="/ad-production-portal" className="btn-secondary">
            Back to Portal
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <p className="text-slate-300">Redirecting to Ad Manager...</p>;
}
