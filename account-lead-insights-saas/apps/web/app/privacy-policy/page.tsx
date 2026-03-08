export default function PrivacyPolicyPage() {
  const updatedOn = "March 8, 2026";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-700 bg-panel p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Legal</p>
        <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-slate-300">Last updated: {updatedOn}</p>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">1. Information We Collect</h2>
        <p>
          We collect information you provide directly, including your name, email address, phone number, company
          details, and lead-generation campaign inputs.
        </p>
        <p>
          We also collect technical and usage data such as IP address, browser type, pages visited, and interactions
          with our application.
        </p>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">2. How We Use Information</h2>
        <ul className="list-disc space-y-2 pl-6 text-slate-300">
          <li>Provide and improve the Account Lead Insights platform.</li>
          <li>Set up and manage onboarding, campaigns, and reporting workflows.</li>
          <li>Respond to support requests and service inquiries.</li>
          <li>Maintain security, detect abuse, and comply with legal obligations.</li>
          <li>Send transactional communications related to your account and services.</li>
        </ul>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">3. Sharing and Disclosure</h2>
        <p>
          We do not sell your personal information. We may share information with service providers that help us
          operate our platform (for example, hosting, analytics, payments, and communications).
        </p>
        <p>
          We may also disclose information when required by law, to enforce our terms, or to protect rights, safety,
          and security.
        </p>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">4. Data Retention</h2>
        <p>
          We retain information for as long as needed to provide services, meet contractual and legal obligations,
          resolve disputes, and enforce agreements.
        </p>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">5. Security</h2>
        <p>
          We use reasonable administrative, technical, and organizational safeguards to protect personal information.
          No method of transmission or storage is completely secure.
        </p>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">6. Your Choices</h2>
        <p>
          You may request access, correction, or deletion of your personal information, subject to legal and
          operational requirements.
        </p>
      </section>

      <section className="card space-y-4 text-slate-200">
        <h2 className="text-2xl font-bold">7. Contact</h2>
        <p>
          For privacy-related questions, contact{" "}
          <a className="text-blue-300 hover:text-blue-200" href="mailto:help@accountleadgen.com">
            help@accountleadgen.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
