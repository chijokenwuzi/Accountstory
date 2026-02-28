"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, clearSession, getUserEmail, isSignedIn, syncSessionCookieFromStorage } from "../../../lib/client";
import { canAccessFounderPortal, founderEmail } from "../../../lib/founder-access";

type AccessResponse = { admins: string[] };

export default function PortalAdminListPage() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdmin, setNewAdmin] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    syncSessionCookieFromStorage();
    if (!isSignedIn()) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    if (!canAccessFounderPortal(getUserEmail())) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    api<AccessResponse>("/api/v1/admin/access")
      .then((access) => {
        setAllowed(true);
        setAdmins(access.admins || []);
        setMessage("");
      })
      .catch((err) => {
        const msg = String((err as Error)?.message || "");
        const isAuthError =
          msg.toLowerCase().includes("invalid token") ||
          msg.toLowerCase().includes("unauthorized") ||
          msg.includes("(401)");
        if (isAuthError) {
          clearSession();
          setSignedIn(false);
          setMessage("");
          return;
        }
        setMessage(msg || "Unable to load admin list.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function addAdmin(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const data = await api<{ admins: string[] }>("/api/v1/admin/operators", {
        method: "POST",
        body: JSON.stringify({ email: newAdmin })
      });
      setAdmins(data.admins || []);
      setNewAdmin("");
      setMessage("Admin added.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  if (loading) return <p>Loading admin list...</p>;
  if (!signedIn) return <p className="text-slate-300">Please sign in first.</p>;
  if (!allowed) {
    return (
      <div className="card space-y-3">
        <h1 className="text-3xl font-bold">Admin List</h1>
        <p className="text-slate-300">
          Access is restricted. Only <strong>{founderEmail()}</strong> can view this screen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin List</h1>
        <Link href="/ad-production-portal" className="btn-secondary">
          Back to Portal
        </Link>
      </div>

      <div className="card space-y-3">
        <p className="text-sm text-slate-300">Allowed emails for backend admin list.</p>
        <ul className="space-y-1 text-sm">
          {admins.map((admin) => (
            <li key={admin}>{admin}</li>
          ))}
        </ul>
        <form onSubmit={addAdmin} className="flex gap-2">
          <input
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Add admin email"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
          />
          <button className="btn-primary" type="submit">
            Add
          </button>
        </form>
        {message && <p className="text-sm text-slate-300">{message}</p>}
      </div>
    </div>
  );
}
