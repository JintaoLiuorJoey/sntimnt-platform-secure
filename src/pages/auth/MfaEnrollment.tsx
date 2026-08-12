import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import QRCode from "qrcode";
import { useAuth } from "@/auth/auth-context";
import { safeInternalReturnTo } from "@/auth/auth-navigation";
import {
  completeTotpEnrollment,
  SessionApiError,
  startTotpEnrollment,
} from "@/auth/session-api";
import { notifySessionExpired } from "@/auth/session-events";

type EnrollmentState = {
  secret: string;
  qrCodeDataUrl: string;
};

type LocationState = {
  from?: unknown;
};

const ISSUER = "SNTIMNT.AI";

function enrollmentError(error: unknown): string {
  if (!(error instanceof SessionApiError)) {
    return "MFA enrollment is temporarily unavailable. Please try again.";
  }

  if (error.status === 403 && error.message.includes("Recent authentication")) {
    return "For your security, sign out and sign in again before setting up MFA.";
  }
  if (error.status === 409) {
    return "Your secure session must be refreshed. Refresh it, then try again.";
  }

  return error.message;
}

const MfaEnrollment = () => {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [userCode, setUserCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy key");

  const returnTo = useMemo(() => {
    const state = (location.state ?? {}) as LocationState;
    const candidate = typeof state.from === "string" ? state.from : "/admin";
    const safe = safeInternalReturnTo(candidate);
    return safe === "/mfa/enroll" ? "/admin" : safe;
  }, [location.state]);

  const loadEnrollment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEnrollment(null);

    try {
      const secret = await startTotpEnrollment();
      const label = `${ISSUER}:${auth.user?.email ?? "administrator"}`;
      const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(
        secret,
      )}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
      const qrCodeDataUrl = await QRCode.toDataURL(uri, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 240,
      });
      setEnrollment({ secret, qrCodeDataUrl });
    } catch (caught) {
      if (caught instanceof SessionApiError && caught.status === 401) {
        notifySessionExpired();
        return;
      }
      setError(enrollmentError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [auth.user?.email]);

  useEffect(() => {
    void loadEnrollment();
  }, [loadEnrollment]);

  const handleCopy = async () => {
    if (!enrollment) return;

    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy key"), 2_000);
    } catch {
      setCopyLabel("Copy unavailable");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(userCode) || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await completeTotpEnrollment(userCode);
      await auth.refreshSession();
      navigate(returnTo, { replace: true });
    } catch (caught) {
      if (caught instanceof SessionApiError && caught.status === 401) {
        notifySessionExpired();
        return;
      }
      setError(enrollmentError(caught));
      setUserCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-midnight px-4 py-12">
      <div className="mx-auto w-full max-w-xl rounded-[14px] bg-card px-6 py-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] sm:px-10 sm:py-10">
        <p className="text-sm font-semibold uppercase tracking-brand text-emotive">
          Required security setup
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-brand text-midnight">
          Set up multi-factor authentication
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Administrator access stays locked until you connect an authenticator app.
          Complete setup during this recently authenticated session.
        </p>

        {isLoading && (
          <div role="status" className="mt-8 rounded-lg border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            Preparing your one-time setup key…
          </div>
        )}

        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-emotive/30 bg-emotive/5 p-4 text-sm text-emotive">
            {error}
          </div>
        )}

        {!isLoading && !enrollment && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadEnrollment()} className="h-11 rounded-lg bg-midnight px-5 text-sm font-semibold text-clarity hover:bg-midnight/90">
              Try again
            </button>
            <button type="button" onClick={() => void auth.logout()} className="h-11 rounded-lg border border-border px-5 text-sm font-semibold text-midnight hover:bg-muted/50">
              Sign out
            </button>
          </div>
        )}

        {enrollment && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            <section aria-labelledby="scan-heading">
              <h2 id="scan-heading" className="text-lg font-semibold text-midnight">
                1. Scan this QR code
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use a trusted TOTP authenticator such as 1Password, Google Authenticator, or Microsoft Authenticator.
              </p>
              <div className="mt-4 flex justify-center rounded-xl border border-border bg-white p-4 sm:justify-start">
                <img src={enrollment.qrCodeDataUrl} alt="Authenticator setup QR code" width={240} height={240} />
              </div>
            </section>

            <section aria-labelledby="manual-heading">
              <h2 id="manual-heading" className="text-lg font-semibold text-midnight">
                Or enter the setup key manually
              </h2>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-semibold tracking-wider text-midnight">
                  {enrollment.secret.match(/.{1,4}/g)?.join(" ")}
                </code>
                <button type="button" onClick={() => void handleCopy()} className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-midnight hover:bg-muted/50">
                  {copyLabel}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Type: time-based · 6 digits · 30-second period
              </p>
            </section>

            <section aria-labelledby="verify-heading">
              <label id="verify-heading" htmlFor="mfa-code" className="text-lg font-semibold text-midnight">
                2. Verify a code
              </label>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the current six-digit code from your authenticator app.
              </p>
              <input
                id="mfa-code"
                name="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={userCode}
                onChange={(event) => setUserCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-3 h-12 w-full rounded-lg border border-border bg-background px-4 text-center text-xl font-semibold tracking-[0.4em] text-midnight outline-none focus:border-emotive focus:ring-2 focus:ring-emotive/20"
                aria-describedby={error ? "mfa-submit-error" : undefined}
                autoFocus
              />
              {error && <span id="mfa-submit-error" className="sr-only">{error}</span>}
            </section>

            <button
              type="submit"
              disabled={userCode.length !== 6 || isSubmitting}
              className="h-12 w-full rounded-lg bg-midnight text-sm font-bold tracking-brand text-clarity transition-colors hover:bg-midnight/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Verifying…" : "Complete MFA setup"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

export default MfaEnrollment;
