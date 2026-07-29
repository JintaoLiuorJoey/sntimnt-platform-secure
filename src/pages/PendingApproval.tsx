import { Link } from "react-router";
import { Hourglass } from "lucide-react";

const PendingApproval = () => {
  return (
    <main className="min-h-screen w-full bg-midnight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        <div className="bg-card rounded-[14px] px-10 py-12 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
          {/* Wordmark */}
          <div className="text-center">
            <h1 className="font-wordmark text-clarity text-3xl tracking-brand">
              SNTIMNT.AI
            </h1>
            <div className="mt-4 mx-auto h-px w-16 bg-clarity" />
          </div>

          {/* Icon */}
          <div className="mt-8 flex justify-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(46, 196, 182, 0.12)" }}
            >
              <Hourglass
                className="w-7 h-7 text-clarity"
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Headings */}
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold text-midnight tracking-brand">
              You're in the queue.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Your application has been received. Our team reviews every
              account manually — we'll reach out within 1–2 business days
              with next steps.
            </p>
          </div>

          {/* Info box */}
          <div className="mt-8 rounded-lg bg-secondary border border-border p-4">
            <ul className="space-y-2.5">
              {[
                "We verify accredited investor status before granting access",
                "You'll receive an email at the address you registered with",
                <>
                  Questions? Reach us at{" "}
                  <a
                    href="mailto:info@sntimnt.ai"
                    className="text-clarity font-medium hover:underline"
                  >
                    info@sntimnt.ai
                  </a>
                </>,
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-clarity flex-shrink-0" />
                  <span className="text-xs text-foreground leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center">
            <Link
              to="/login"
              className="text-xs text-clarity font-medium hover:underline tracking-brand"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default PendingApproval;
