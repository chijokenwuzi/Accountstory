"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSignedIn, onSessionChange, syncSessionCookieFromStorage } from "../lib/client";

export function BrandLink() {
  const [href, setHref] = useState("/");

  useEffect(() => {
    const sync = () => {
      syncSessionCookieFromStorage();
      setHref(isSignedIn() ? "/dashboard" : "/");
    };
    sync();
    const cleanup = onSessionChange(sync);
    return cleanup;
  }, []);

  return (
    <Link href={href} className="text-2xl font-bold">
      Account Lead Insights
    </Link>
  );
}
