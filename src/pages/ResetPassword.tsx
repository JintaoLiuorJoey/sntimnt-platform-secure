import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Clock } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "true";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "w-full h-11 px-3.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-clarity focus:ring-2 focus:ring-clarity/20 transition";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm || password.length === 0) {
      setError(true);
      return;
    }
    setError(false);
    setSuccess(true);
  };

  const requirements = [
    "At least 8 characters",
    "At least one uppercase letter",
    "At least one number",
  ];

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

          {expired ? (
            <div className="flex flex-col items-center text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
                style={{ backgroundColor: "#FCEBEB" }}
              >
                <Clock
                  className="w-6 h-6"
                  strokeWidth={2.5}
                  style={{ color: "#D8315B" }}
                />
              </div>
              <h2 className="text-2xl font-bold text-midnight tracking-brand">
                This link has expired.
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Password reset links are only valid for 30 minutes. Return to
                the sign in screen and request a new one.
              </p>

              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="mt-8 w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors"
              >
                Request a new link
              </button>

              <Link
                to="/login"
                className="mt-5 text-sm text-clarity font-medium hover:underline tracking-brand"
              >
                Back to sign in
              </Link>
            </div>
          ) : !success ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-midnight tracking-brand">
                  Set a new password.
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Choose something strong. You'll use this to sign in going
                  forward.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-medium text-foreground tracking-brand"
                  >
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    placeholder="New password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(false);
                    }}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm-new-password"
                    className="block text-xs font-medium text-foreground tracking-brand"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    required
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      if (error) setError(false);
                    }}
                    className={`${inputClass} ${
                      error ? "border-emotive focus:border-emotive focus:ring-emotive/20" : ""
                    }`}
                  />
                  {error && (
                    <p className="text-xs font-medium text-emotive mt-1.5">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                <ul className="space-y-1 pt-1">
                  {requirements.map((req) => (
                    <li
                      key={req}
                      className="text-xs leading-relaxed"
                      style={{ color: "#888888" }}
                    >
                      · {req}
                    </li>
                  ))}
                </ul>

                <button
                  type="submit"
                  className="w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors"
                >
                  Update password
                </button>
              </form>
            </>
          ) : (
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
                Password updated.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your password has been changed successfully. You can now sign
                in with your new credentials.
              </p>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-8 w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default ResetPassword;
