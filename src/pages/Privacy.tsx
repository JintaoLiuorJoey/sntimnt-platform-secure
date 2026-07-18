import { Link } from "react-router-dom";

const LAST_UPDATED = "April 18, 2026";

type Section = {
  id: string;
  number: number;
  title: string;
  body: JSX.Element;
};

const SecurityCallout = ({ children }: { children: React.ReactNode }) => (
  <div
    className="my-5 rounded-md border-l-4 px-4 py-3 text-sm leading-relaxed"
    style={{
      backgroundColor: "#E1F5EE",
      borderLeftColor: "#2EC4B6",
      color: "#0D1B2A",
    }}
  >
    {children}
  </div>
);

const sections: Section[] = [
  {
    id: "introduction",
    number: 1,
    title: "Introduction",
    body: (
      <p>
        SNTIMNT.AI, Inc. ("SNTIMNT.AI", "we", "us") respects your privacy. This
        Privacy Policy explains how we collect, use, share, and protect your
        personal information when you use our investor platform (the
        "Platform"). By using the Platform, you agree to the practices
        described in this Policy.
      </p>
    ),
  },
  {
    id: "information-we-collect",
    number: 2,
    title: "Information We Collect",
    body: (
      <>
        <p>We collect the following categories of information:</p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <span className="font-semibold">Account registration data:</span>{" "}
            name, email, phone number, password.
          </li>
          <li>
            <span className="font-semibold">Identity verification:</span>{" "}
            government-issued ID, date of birth, address, accredited investor
            documentation.
          </li>
          <li>
            <span className="font-semibold">Banking information:</span> account
            and routing numbers, wire instructions used for subscriptions and
            redemptions.
          </li>
          <li>
            <span className="font-semibold">Usage data:</span> pages visited,
            actions taken, timestamps, session duration.
          </li>
          <li>
            <span className="font-semibold">Device data:</span> IP address,
            browser type, operating system, device identifiers.
          </li>
          <li>
            <span className="font-semibold">Broker data:</span> trading and
            account data received from the Alpaca Trading API.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use",
    number: 3,
    title: "How We Use Your Information",
    body: (
      <>
        <p>We use your information to:</p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>Manage your account and authenticate access.</li>
          <li>Operate the fund and execute capital activity.</li>
          <li>Generate performance reporting and statements.</li>
          <li>
            Communicate with you about your account, the fund, and the
            Platform.
          </li>
          <li>
            Comply with legal, regulatory, and tax obligations (including KYC
            and AML).
          </li>
          <li>Maintain security and prevent fraud.</li>
          <li>Improve the Platform and develop new features.</li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-share",
    number: 4,
    title: "How We Share Your Information",
    body: (
      <>
        <p>We share information only as necessary:</p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <span className="font-semibold">Service providers:</span> trusted
            vendors such as Alpaca (brokerage) and AWS (infrastructure) that
            process data on our behalf.
          </li>
          <li>
            <span className="font-semibold">Legal requirements:</span> when
            required by law, regulation, subpoena, or court order.
          </li>
          <li>
            <span className="font-semibold">Business transfers:</span> in
            connection with a merger, acquisition, or sale of assets.
          </li>
          <li>
            <span className="font-semibold">With your consent:</span> when you
            authorize a specific disclosure.
          </li>
        </ul>
        <p className="mt-3 font-semibold">
          We do not sell your personal information.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    number: 5,
    title: "Data Retention",
    body: (
      <p>
        We retain your personal information for as long as your account is
        active and for the period required to comply with our legal,
        regulatory, tax, accounting, and reporting obligations. Retention
        periods vary by data type and applicable law.
      </p>
    ),
  },
  {
    id: "security",
    number: 6,
    title: "Data Security",
    body: (
      <>
        <p>
          We implement administrative, technical, and physical safeguards
          designed to protect your information.
        </p>
        <SecurityCallout>
          <p className="font-semibold mb-2">Our security commitments include:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>TLS encryption for data in transit.</li>
            <li>Salted and hashed password storage.</li>
            <li>
              AWS Secrets Manager for API credentials and sensitive
              configuration.
            </li>
            <li>Role-based access controls and least-privilege provisioning.</li>
            <li>
              Two-factor verification for changes to banking information.
            </li>
            <li>Continuous monitoring and audit logging.</li>
          </ul>
        </SecurityCallout>
        <p>
          No system is perfectly secure. You are responsible for safeguarding
          your account credentials and notifying us of any suspected
          unauthorized access.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    number: 7,
    title: "Your Rights and Choices",
    body: (
      <>
        <p>Subject to applicable law, you have the right to:</p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>Access the personal information we hold about you.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion of your information.</li>
          <li>Opt out of marketing communications.</li>
          <li>Close your account.</li>
        </ul>
        <p className="mt-3">
          To exercise these rights, contact us at{" "}
          <a
            href="mailto:info@sntimnt.ai"
            className="text-clarity font-medium hover:underline"
          >
            info@sntimnt.ai
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    number: 8,
    title: "Cookies and Tracking Technologies",
    body: (
      <>
        <p>We use two categories of cookies:</p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <span className="font-semibold">Essential cookies:</span> required
            for authentication, session management, and security.
          </li>
          <li>
            <span className="font-semibold">Analytics cookies:</span> help us
            understand how the Platform is used so we can improve it.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "third-party",
    number: 9,
    title: "Third-Party Services and Links",
    body: (
      <p>
        The Platform integrates with third-party services, including Mailchimp
        for newsletter delivery. These services are governed by their own
        privacy policies, and we are not responsible for their practices.
      </p>
    ),
  },
  {
    id: "children",
    number: 10,
    title: "Children's Privacy",
    body: (
      <p>
        The Platform is not directed to individuals under the age of 18. We do
        not knowingly collect personal information from children. If you
        believe a child has provided us with personal information, contact us
        and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    number: 11,
    title: "Changes to This Policy",
    body: (
      <p>
        We may update this Policy from time to time. Material changes will be
        communicated via email or in-platform notice. The "Last updated" date
        at the top of this page reflects the most recent revision.
      </p>
    ),
  },
  {
    id: "contact",
    number: 12,
    title: "Contact",
    body: (
      <p>
        Questions about this Policy may be directed to{" "}
        <a
          href="mailto:info@sntimnt.ai"
          className="text-clarity font-medium hover:underline"
        >
          info@sntimnt.ai
        </a>{" "}
        or via{" "}
        <a
          href="https://sntimnt.ai"
          className="text-clarity font-medium hover:underline"
        >
          sntimnt.ai
        </a>
        .
      </p>
    ),
  },
];

const Privacy = () => {
  return (
    <main className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="w-full bg-midnight py-10 px-6 text-center">
        <h1 className="font-wordmark text-clarity text-3xl tracking-brand">
          SNTIMNT.AI
        </h1>
        <p className="mt-3 text-white font-bold text-xl tracking-brand">
          Privacy Policy
        </p>
        <p className="mt-2 text-xs text-white/50 tracking-brand">
          Last updated: {LAST_UPDATED} &nbsp;|&nbsp; Version 1.0
        </p>
      </header>

      {/* Card */}
      <section className="px-4 py-12">
        <article
          className="mx-auto max-w-[780px] bg-card rounded-xl shadow-[0_8px_30px_-12px_rgba(13,27,42,0.15)]"
          style={{ padding: "40px" }}
        >
          {/* Table of Contents */}
          <nav aria-label="Table of contents" className="mb-10">
            <h2 className="text-sm font-bold text-midnight uppercase tracking-brand mb-4">
              Table of Contents
            </h2>
            <ol className="space-y-2 text-sm" style={{ color: "#3A3A3A" }}>
              {sections.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="font-semibold text-midnight w-6 shrink-0">
                    {s.number}.
                  </span>
                  <a
                    href={`#${s.id}`}
                    className="text-clarity hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="pb-8 border-b last:border-b-0"
                style={{ borderColor: "#E5E5E5" }}
              >
                <h2 className="text-xl font-bold text-midnight tracking-brand mb-4 scroll-mt-24">
                  {s.number}. {s.title}
                </h2>
                <div
                  className="text-sm leading-relaxed space-y-3"
                  style={{ color: "#3A3A3A" }}
                >
                  {s.body}
                </div>
              </section>
            ))}
          </div>

          {/* Back link */}
          <div className="mt-10 pt-6 border-t" style={{ borderColor: "#E5E5E5" }}>
            <Link
              to="/register"
              className="text-sm text-clarity font-medium hover:underline tracking-brand"
            >
              ← Back to Create Account
            </Link>
          </div>
        </article>
      </section>

      {/* Footer */}
      <footer className="w-full bg-midnight py-6 px-6 text-center">
        <p className="text-xs text-white/60 tracking-brand">
          SNTIMNT.AI, Inc. &nbsp;|&nbsp; Draft v1.0
        </p>
      </footer>
    </main>
  );
};

export default Privacy;
