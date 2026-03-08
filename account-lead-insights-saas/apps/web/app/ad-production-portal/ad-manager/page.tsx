"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  clearSession,
  getUserEmail,
  isSignedIn,
  syncSessionCookieFromStorage
} from "../../../lib/client";
import { canAccessFounderPortal, founderEmail } from "../../../lib/founder-access";

type AccessResponse = { email: string; allowed?: boolean };

type ClientRow = {
  id: string;
  name: string;
  onboardingComplete: number;
  leadVolume: number;
  spend: number;
};

export default function PortalAdManagerPage() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      api<{ organizations: ClientRow[] }>("/api/v1/admin/organizations")
    ])
      .then(([access, orgData]) => {
        setEmail(access.email || localEmail);
        setAllowed(true);
        setRows(orgData.organizations || []);
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
        setError(message || "Unable to load clients.");
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (b.spend || 0) - (a.spend || 0)),
    [rows]
  );

  async function deleteClient(row: ClientRow) {
    const confirmed = window.confirm(
      `Delete client "${row.name}"? This removes the organization and all related onboarding, leads, spend, notes, tasks, and users.`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    setError("");
    try {
      await api<{ ok: boolean }>(`/api/v1/admin/org/${row.id}`, { method: "DELETE" });
      setRows((current) => current.filter((entry) => entry.id !== row.id));
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to delete client."));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p className="text-slate-300">Loading Ad Manager...</p>;
  if (!signedIn) return <p className="text-slate-300">Please sign in first.</p>;

  if (!allowed) {
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Ad Manager</h1>
        <p className="text-slate-300">
          Access is restricted. Only <strong>{founderEmail()}</strong> can open Ad Manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ad Manager</h1>
          <p className="text-sm text-slate-300">Manage current clients and remove old accounts.</p>
          <p className="text-xs text-slate-400">Logged in as {email || "your account"}</p>
        </div>
        <Link href="/ad-production-portal" className="btn-secondary">
          Back to Portal
        </Link>
      </div>

      <div className="card space-y-3">
        {error && <p className="text-sm text-amber-300">{error}</p>}
        {sortedRows.length === 0 && <p className="text-slate-400">No clients found.</p>}

        {sortedRows.map((row) => (
          <div key={row.id} className="rounded border border-slate-700 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-lg font-semibold">{row.name || "Unnamed client"}</p>
                <p className="text-slate-300">Client ID: {row.id}</p>
                <p className="text-slate-300">Completed onboarding steps: {row.onboardingComplete}</p>
                <p className="text-slate-300">Lead volume: {row.leadVolume}</p>
                <p className="text-slate-300">Spend: ${Number(row.spend || 0).toFixed(2)}</p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={deletingId === row.id}
                onClick={() => void deleteClient(row)}
              >
                {deletingId === row.id ? "Deleting..." : "Delete Client"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
