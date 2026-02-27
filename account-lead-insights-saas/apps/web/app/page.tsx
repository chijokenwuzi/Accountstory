"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignedIn, syncSessionCookieFromStorage } from "../lib/client";

export default function HomePage() {
  const router = useRouter();
  const startPath = "/login?next=%2Fonboarding%2Fstep-1";
  const [authState, setAuthState] = useState<"checking" | "signed-in" | "signed-out">("checking");

  useLayoutEffect(() => {
    syncSessionCookieFromStorage();
    const active = isSignedIn();
    if (active) {
      setAuthState("signed-in");
      router.replace("/dashboard");
      return;
    }
    setAuthState("signed-out");
  }, [router]);

  if (authState === "checking") {
    return <p className="text-slate-300">Loading...</p>;
  }

  if (authState === "signed-in") {
    return <p className="text-slate-300">Opening dashboard...</p>;
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-2xl border border-slate-700 bg-panel p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Lead Generation</p>
        <h1 className="text-5xl font-extrabold md:text-7xl">Get Leads Fast for your Home Service Business</h1>
        <p className="mx-auto max-w-4xl text-xl text-slate-300">
          HVAC companies, plumbers, roofers, electricians, and solar installers trust our process to get qualified
          leads quickly and easily.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={startPath} className="btn-primary">
            Get Started Right Away
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Example Dashboard
          </Link>
          <Link href="/login" className="btn-secondary">
            Login
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Typical Setup Window", value: "3-5 Days" },
          { label: "Suggested Starting Budget", value: "$3,000/mo" },
          { label: "Primary Channels", value: "Google + Facebook" },
          { label: "Owner Time Needed", value: "< 30 min/week" }
        ].map((item) => (
          <article key={item.label} className="card text-center">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-3xl font-bold">Lead Generation Flow</h2>
        <p className="text-slate-300">Start with intake, then choose to keep moving now or wait for a call.</p>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            "Step 1 Quick Intake Form",
            "Step 2 Business + Service Area Intake",
            "Step 3 Ad Asset Pack Builder",
            "Step 4 Budget + Lead Plan"
          ].map((item) => (
            <div key={item} className="card text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card space-y-3">
          <h2 className="text-2xl font-bold">What You Get</h2>
          <ul className="space-y-2 text-slate-300">
            <li>Channel-ready ad inputs for Google and Facebook.</li>
            <li>Owner dashboard showing spend, leads, CPL, and booked calls.</li>
            <li>Ad production portal for campaign operations and handoff.</li>
            <li>Simple intake-to-launch workflow your team can repeat.</li>
          </ul>
        </article>
        <article className="card space-y-3">
          <h2 className="text-2xl font-bold">Who This Is Best For</h2>
          <ul className="space-y-2 text-slate-300">
            <li>HVAC, plumbing, roofing, electrical, and solar businesses.</li>
            <li>Teams already closing jobs but needing more qualified volume.</li>
            <li>Owners who want visibility without managing every ad detail.</li>
            <li>Operators who want a clean, repeatable delivery workflow.</li>
          </ul>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-700 bg-panel p-8">
        <h2 className="text-3xl font-bold">How Delivery Works</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Phase 1</p>
            <h3 className="text-xl font-semibold">Intake + Positioning</h3>
            <p className="mt-2 text-slate-300">
              We capture business details, service area, offer angle, and practical constraints.
            </p>
          </article>
          <article className="rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Phase 2</p>
            <h3 className="text-xl font-semibold">Asset + Plan Build</h3>
            <p className="mt-2 text-slate-300">
              Campaign assets and budget plans are generated and packaged for execution.
            </p>
          </article>
          <article className="rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Phase 3</p>
            <h3 className="text-xl font-semibold">Launch + Tracking</h3>
            <p className="mt-2 text-slate-300">
              Campaigns go live and results appear in the owner dashboard for ongoing optimization.
            </p>
          </article>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-3xl font-bold">Common Questions</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="card">
            <h3 className="text-lg font-semibold">Do I need ad accounts already set up?</h3>
            <p className="mt-2 text-slate-300">No. You can start with intake first and connect accounts when ready.</p>
          </article>
          <article className="card">
            <h3 className="text-lg font-semibold">Can I start and wait for a call?</h3>
            <p className="mt-2 text-slate-300">Yes. Step 1 lets you submit intake and choose `Wait for Call`.</p>
          </article>
          <article className="card">
            <h3 className="text-lg font-semibold">Will I still see progress if I am brand new?</h3>
            <p className="mt-2 text-slate-300">Yes. The dashboard shows a clear zero-state and updates as soon as data arrives.</p>
          </article>
          <article className="card">
            <h3 className="text-lg font-semibold">Can my internal team use this too?</h3>
            <p className="mt-2 text-slate-300">Yes. The ad production portal is designed for operators and founder workflows.</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-panel p-8 text-center space-y-4">
        <h2 className="text-3xl font-bold">Ready to Start?</h2>
        <p className="mx-auto max-w-3xl text-slate-300">
          Sign in first, then continue through the full lead generation flow. You can still request a call if preferred.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={startPath} className="btn-primary">
            Get Started Right Away
          </Link>
          <Link href="/free-call" className="btn-secondary">
            Request a Call
          </Link>
        </div>
      </section>

    </div>
  );
}
