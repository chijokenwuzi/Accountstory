"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "../../lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api("/api/v1/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setRequested(true);
      setMessage("If this email exists, a 6-digit code has been sent.");
    } catch (err) {
      setError(String((err as Error).message || "Unable to request code right now."));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword })
      });
      setMessage("Password updated. You can now log in with your new password.");
      setCode("");
      setNewPassword("");
    } catch (err) {
      setError(String((err as Error).message || "Unable to reset password right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg card">
      <h1 className="mb-4 text-3xl font-bold">Forgot Password</h1>
      <p className="mb-4 text-sm text-slate-300">Request a reset code by email, then enter the code to set a new password.</p>

      <form onSubmit={requestCode} className="space-y-3">
        <input
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Code"}
        </button>
      </form>

      {requested && (
        <form onSubmit={confirmReset} className="mt-4 space-y-3 border-t border-slate-700 pt-4">
          <input
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            pattern="\d{6}"
            required
          />
          <input
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            minLength={8}
            required
          />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-slate-300">
        Back to <Link className="underline" href="/login">Login</Link>
      </p>
      {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
