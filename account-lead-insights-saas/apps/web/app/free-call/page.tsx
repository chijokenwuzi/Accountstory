"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/client";

export default function FreeCallPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    orgName: "Acme HVAC",
    name: "",
    phone: "",
    email: "",
    bestMethod: "PHONE",
    availability: "Weekdays 9am-5pm"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/v1/leads/public/signups", {
        method: "POST",
        body: JSON.stringify(form)
      });
      const pendingIntake = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        preferredCommMethod: form.bestMethod,
        availability: form.availability
      };
      localStorage.setItem("ali_pending_intake", JSON.stringify(pendingIntake));
      setMessage("Intake received. Continuing to setup flow...");
      window.setTimeout(() => {
        router.push("/signup?continue=1");
      }, 450);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl card">
      <h1 className="mb-4 text-3xl font-bold">Free Call to Learn More</h1>
      <p className="mb-4 text-sm text-slate-300">Submit this quick intake and your signup will appear in backend Sign Up List.</p>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Business name" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select className="rounded border border-slate-700 bg-slate-900 px-3 py-2" value={form.bestMethod} onChange={(e) => setForm({ ...form, bestMethod: e.target.value as "PHONE" | "SMS" | "EMAIL" })}>
          <option value="PHONE">Phone</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
        </select>
        <input className="rounded border border-slate-700 bg-slate-900 px-3 py-2" placeholder="Availability" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} />
        <button className="btn-primary md:col-span-2" type="submit">Submit Intake</button>
      </form>
      {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
