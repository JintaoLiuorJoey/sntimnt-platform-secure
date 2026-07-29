import { Link } from "react-router";

const LAST_UPDATED = "April 18, 2026";

type Section = {
  id: string;
  number: number;
  title: string;
  body: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "acceptance",
    number: 1,
    title: "Acceptance of Terms",
    body: (
      <p>
        By accessing or using the SNTIMNT.AI investor platform (the
        "Platform"), you agree to be bound by these Terms of Service (the
        "Terms"). If you do not agree to these Terms, you may not access or
        use the Platform.
      </p>
    ),
  },
  {
    id: "eligibility",
    number: 2,
    title: "Eligibility and Accredited Investor Status",
    body: (
      <p>
        The Platform is restricted to natural persons and entities that
        qualify as "accredited investors" as defined in Rule 501 of
        Regulation D under the Securities Act of 1933, as amended. You
        represent and warrant that you meet this standard at the time of
        registration and on each subsequent date you access the Platform.
      </p>
    ),
  },
  {
    id: "services",
    number: 3,
    title: "Description of Services",
    body: (
      <p>
        SNTIMNT.AI operates a private investment platform that provides
        accredited investors with access to quantitative crypto investment
        strategies, portfolio reporting, and capital activity management. The
        Platform does not provide tax, legal, or personalized investment
        advice.
      </p>
    ),
  },
  {
    id: "risk",
    number: 4,
    title: "Investment Risk Disclosures",
    body: (
      <p>
        Investments offered through the Platform involve a high degree of
        risk, including the potential loss of all invested capital. Crypto
        assets are volatile, and past performance is not indicative of
        future results. You should carefully review all offering documents
        before investing.
      </p>
    ),
  },
  {
    id: "account",
    number: 5,
    title: "Account Registration and Security",
    body: (
      <p>
        You agree to provide accurate, current, and complete information
        during registration and to maintain the confidentiality of your
        account credentials. You are responsible for all activity that occurs
        under your account. Notify us immediately of any unauthorized use.
      </p>
    ),
  },
  {
    id: "fees",
    number: 6,
    title: "Deposits, Withdrawals, and Fees",
    body: (
      <>
        <p>
          Subscription, redemption, and fee terms are governed by the
          applicable offering documents. In summary:
        </p>
        <ul className="list-disc pl-6 mt-3 space-y-2">
          <li>
            <span className="font-semibold">Management fee:</span> 2% per
            annum, assessed monthly on end-of-month net asset value (NAV).
          </li>
          <li>
            <span className="font-semibold">Performance fee:</span> 20% of net
            new profits, assessed quarterly and subject to a high-water mark.
          </li>
        </ul>
        <p className="mt-3">
          <span className="font-semibold">Early Redemption Fee:</span>{" "}
          Investor-initiated account closure prior to the completion of the
          twelve (12) month minimum commitment period is subject to an early
          redemption fee of 2.0% of account Net Asset Value at the time of
          approved closure, except in qualifying exception circumstances as
          defined in the Investment Management Agreement. This fee is assessed
          in addition to any accrued management and performance fees.
        </p>
      </>
    ),
  },
  {
    id: "prohibited",
    number: 7,
    title: "Prohibited Conduct",
    body: (
      <p>
        You may not use the Platform for any unlawful purpose, attempt to
        access the Platform through unauthorized means, interfere with the
        operation of the Platform, or misrepresent your identity or
        eligibility status.
      </p>
    ),
  },
  {
    id: "ip",
    number: 8,
    title: "Intellectual Property",
    body: (
      <p>
        All content, software, and materials available on the Platform are
        the property of SNTIMNT.AI, Inc. or its licensors and are protected
        by intellectual property laws. You receive a limited, revocable,
        non-transferable license to access the Platform for your personal,
        non-commercial use.
      </p>
    ),
  },
  {
    id: "warranties",
    number: 9,
    title: "Disclaimer of Warranties",
    body: (
      <p>
        THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS,
        WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT.
      </p>
    ),
  },
  {
    id: "liability",
    number: 10,
    title: "Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by law, SNTIMNT.AI, Inc. and its
        affiliates shall not be liable for any indirect, incidental,
        special, consequential, or punitive damages arising out of or
        related to your use of the Platform.
      </p>
    ),
  },
  {
    id: "indemnification",
    number: 11,
    title: "Indemnification",
    body: (
      <p>
        You agree to indemnify and hold harmless SNTIMNT.AI, Inc., its
        affiliates, officers, directors, employees, and agents from any
        claims, liabilities, damages, losses, and expenses arising out of
        your use of the Platform or your breach of these Terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    number: 12,
    title: "Governing Law and Dispute Resolution",
    body: (
      <p>
        These Terms are governed by the laws of the State of Florida,
        without regard to its conflict of laws principles. Any dispute
        arising out of or relating to these Terms shall be resolved through
        binding arbitration administered in Florida. You waive any right
        to participate in a class action.
      </p>
    ),
  },
  {
    id: "modifications",
    number: 13,
    title: "Modifications to Terms",
    body: (
      <p>
        We may modify these Terms at any time by posting the revised version
        on the Platform. Material changes will be communicated via email or
        in-platform notice. Continued use of the Platform after changes
        constitutes acceptance.
      </p>
    ),
  },
  {
    id: "termination",
    number: 14,
    title: "Termination",
    body: (
      <p>
        We reserve the right to suspend or terminate your access to the
        Platform at any time, with or without cause, including upon loss of
        accredited investor status or breach of these Terms.
      </p>
    ),
  },
  {
    id: "contact",
    number: 15,
    title: "Contact",
    body: (
      <p>
        Questions about these Terms may be directed to{" "}
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

const Terms = () => {
  return (
    <main className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="w-full bg-midnight py-10 px-6 text-center">
        <h1 className="font-wordmark text-clarity text-3xl tracking-brand">
          SNTIMNT.AI
        </h1>
        <p className="mt-3 text-white font-bold text-xl tracking-brand">
          Terms of Service
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

export default Terms;
