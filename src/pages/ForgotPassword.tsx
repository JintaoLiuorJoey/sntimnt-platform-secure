import { FormEvent, useState } from "react";
import { Link } from "react-router";
import { Check } from "lucide-react";

const ForgotPassword = () => {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const inputClass =
    "w-full h-11 px-3.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-clarity focus:ring-2 focus:ring-clarity/20 transition";

  const labelClass =
    "block text-xs font-medium text-foreground tracking-brand";

  return (
    <main className="min-h-screen w-full bg-midnight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-[14px] px-10 py-12 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
          {/* Wordmark */}
          <div className="text-center mb-10">
            <h1 className="font-wordmark text-clarity text-3xl tracking-brand">
              SNTIMNT.AI
            </h1>
          </div>

          {!submitted ? (
            <>
              {/* Headings */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-midnight tracking-brand">
                  Forgot your password?
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter the email address associated with your account and
                  we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="email" className={labelClass}>
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors"
                >
                  Send reset link
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-muted-foreground">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="text-clarity font-medium hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* Confirmation state */}
              <div className="flex flex-col items-center text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
                  style={{ backgroundColor: "rgba(15, 110, 86, 0.12)" }}
                >
                  <Check
                    className="w-6 h-6"
                    strokeWidth={3}
                    style={{ color: "#0F6E56" }}
                  />
                </div>
                <h2 className="text-2xl font-bold text-midnight tracking-brand">
                  Check your inbox.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  If an account exists for that email address, a reset link
                  is on its way. Check your spam folder if you don't see it
                  within a few minutes.
                </p>

                <Link
                  to="/login"
                  className="mt-8 text-sm text-clarity font-medium hover:underline tracking-brand"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default ForgotPassword;
