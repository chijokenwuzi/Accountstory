"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import {
  clearSession,
  getUserEmail,
  isSignedIn,
  onSessionChange,
  syncSessionCookieFromStorage
} from "../lib/client";
import { canAccessFounderPortal } from "../lib/founder-access";

export function TopNav() {
  const [authState, setAuthState] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const [email, setEmail] = useState("");
  const [canAccessPortal, setCanAccessPortal] = useState(false);

  useLayoutEffect(() => {
    const sync = () => {
      syncSessionCookieFromStorage();
      const active = isSignedIn();
      const nextEmail = getUserEmail();
      setAuthState(active ? "signed-in" : "signed-out");
      setEmail(nextEmail);
      setCanAccessPortal(active && canAccessFounderPortal(nextEmail));
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    const cleanup = onSessionChange(sync);
    return () => {
      cleanup();
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const signedIn = authState === "signed-in";
  const signedOut = authState === "signed-out";

  function logout() {
    clearSession();
    window.location.href = "/";
  }

  return (
    <nav className="flex items-center gap-4 text-sm text-slate-300">
      {signedOut && <Link href="/login">Login</Link>}
      {signedOut && <Link href="/signup">Get Started</Link>}
      <Link href="/dashboard">{signedIn ? "Dashboard" : "Example Dashboard"}</Link>
      {canAccessPortal && <Link href="/ad-production-portal">Ad Production Portal</Link>}
      {signedIn && (
        <>
          <span className="hidden text-xs text-slate-400 md:inline">{email}</span>
          <button type="button" className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={logout}>
            Logout
          </button>
        </>
      )}
    </nav>
  );
}
