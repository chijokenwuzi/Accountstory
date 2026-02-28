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

type SignupRow = {
  id: string;
  orgName: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  bestMethod?: string;
  availability?: string;
  source?: string;
  campaign?: string;
  location?: string;
  formSource?: string;
  webhookCapturedAt?: string | null;
  createdAt: string;
  formPayload?: Record<string, unknown>;
};

export default function PortalSignupListPage() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<SignupRow[]>([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    syncSessionCookieFromStorage();
    const active = isSignedIn();
    if (!active) {
      setSignedIn(false);
      setAllowed(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);

    const localEmail = getUserEmail();
    if (!canAccessFounderPortal(localEmail)) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    Promise.all([
      api("/api/v1/admin/access"),
      api<{ signups: SignupRow[] }>("/api/v1/admin/signups")
    ])
      .then(([, data]) => {
        setRows(data.signups || []);
        setAllowed(true);
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
          setRows([]);
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

        setError(message || "Unable to load signups.");
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rows]
  );

  if (loading) return <p>Loading sign up list...</p>;
  if (!signedIn) return <p className="text-slate-300">Please sign in first.</p>;

  if (!allowed) {
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Sign Up List</h1>
        <p className="text-slate-300">
          This screen is restricted. Only <strong>{founderEmail()}</strong> can view full intake form data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Sign Up List</h1>
        <Link href="/ad-production-portal" className="btn-secondary">
          Back to Portal
        </Link>
      </div>

      <div className="card space-y-3">
        <p className="text-sm text-slate-300">
          Click <strong>View Full Form</strong> to see every captured field from the intake form.
        </p>
        {error && <p className="text-sm text-amber-300">{error}</p>}
        {sortedRows.length === 0 && <p className="text-slate-400">No signups yet.</p>}

        {sortedRows.map((row) => {
          const open = expandedId === row.id;
          return (
            <div key={row.id} className="rounded border border-slate-700 p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-lg">{row.name || "Unnamed"}</p>
                  <p>{row.orgName}</p>
                  <p>{row.email}</p>
                  <p>{row.phone}</p>
                  <p className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setExpandedId(open ? null : row.id)}
                >
                  {open ? "Hide Full Form" : "View Full Form"}
                </button>
              </div>

              {open && (
                <div className="rounded border border-slate-700 bg-slate-900/40 p-3 space-y-2">
                  <h2 className="text-base font-semibold">Full Intake Form Details</h2>
                  <div className="grid gap-2 md:grid-cols-2">
                    <p><span className="text-slate-400">Business:</span> {row.orgName || "-"}</p>
                    <p><span className="text-slate-400">Name:</span> {row.name || "-"}</p>
                    <p><span className="text-slate-400">Email:</span> {row.email || "-"}</p>
                    <p><span className="text-slate-400">Phone:</span> {row.phone || "-"}</p>
                    <p><span className="text-slate-400">Best method:</span> {row.bestMethod || "-"}</p>
                    <p><span className="text-slate-400">Availability:</span> {row.availability || "-"}</p>
                    <p><span className="text-slate-400">Lead source:</span> {row.source || "-"}</p>
                    <p><span className="text-slate-400">Form source:</span> {row.formSource || "-"}</p>
                    <p><span className="text-slate-400">Campaign:</span> {row.campaign || "-"}</p>
                    <p><span className="text-slate-400">Location:</span> {row.location || "-"}</p>
                    <p><span className="text-slate-400">Submitted at:</span> {new Date(row.createdAt).toLocaleString()}</p>
                    <p>
                      <span className="text-slate-400">Webhook captured:</span>{" "}
                      {row.webhookCapturedAt ? new Date(row.webhookCapturedAt).toLocaleString() : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-slate-400">Raw Form Payload</p>
                    <pre className="overflow-auto rounded bg-slate-950 p-2 text-xs">
                      {JSON.stringify(row.formPayload || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
