import "./globals.css";
import type { ReactNode } from "react";
import { TopNav } from "../components/top-nav";
import { BrandLink } from "../components/brand-link";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base text-slate-100">
        <div className="flex min-h-screen flex-col">
        <header className="border-b border-slate-800 bg-black/30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <BrandLink />
            <TopNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="mt-10 border-t border-slate-700 bg-[#2d356b]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-100">Account Lead Insights</h2>
            <div className="space-y-1 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200/80">Contact</p>
              <a className="text-xl font-semibold text-blue-300 hover:text-blue-200" href="mailto:help@accountleadgen.com">
                help@accountleadgen.com
              </a>
            </div>
          </div>
        </footer>
        </div>
      </body>
    </html>
  );
}
