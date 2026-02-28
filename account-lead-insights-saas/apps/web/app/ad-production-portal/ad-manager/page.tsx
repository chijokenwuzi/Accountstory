"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getUserEmail, isSignedIn, syncSessionCookieFromStorage } from "../../../lib/client";
import { canAccessFounderPortal, founderEmail } from "../../../lib/founder-access";

const LEGACY_BACKEND_URL =
  process.env.NEXT_PUBLIC_LEGACY_BACKEND_URL || "http://127.0.0.1:9091/index.html";
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
        await fetch(LEGACY_BACKEND_URL, { mode: "no-cors", cache: "no-store" });
        const baseUrl = PORTAL_BASE_URL.trim() || window.location.origin;
        const target = new URL(LEGACY_BACKEND_URL);
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
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Ad Manager Offline</h1>
        <p className="text-slate-300">
          Legacy backend at <code>{LEGACY_BACKEND_URL}</code> is not reachable yet.
        </p>
        <p className="text-slate-300">
          Start dev with <code>npm run dev</code> from <code>account-lead-insights-saas</code>, then try again.
        </p>
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
