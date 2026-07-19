import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { runtimeConfig } from "@/config/runtime";

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

const Login = () => {
  const location = useLocation();
  const [closureBanner, setClosureBanner] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("closureBanner") === "1") {
        sessionStorage.removeItem("closureBanner");
        setClosureBanner(true);
        const t = setTimeout(() => setClosureBanner(false), 5000);
        return () => clearTimeout(t);
      }
    } catch {
      // sessionStorage may be unavailable in restricted browser contexts.
    }
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!runtimeConfig.isApi) {
      setAuthMessage(
        "Secure authentication is not connected in demo mode. No local account or role will be created.",
      );
      return;
    }

    const params = new URLSearchParams(location.search);
    const returnTo = safeReturnTo(params.get("returnTo"));
    const loginUrl = `${runtimeConfig.apiBaseUrl}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.assign(loginUrl);
  };

  return (
    <main className="min-h-screen w-full bg-midnight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="bg-card rounded-[14px] px-10 py-12 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
          <div className="text-center mb-10">
            <h1 className="font-wordmark text-clarity text-3xl tracking-brand">
              SNTIMNT.AI
            </h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-midnight tracking-brand">
              Welcome!
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Continue to the secure identity provider to sign in.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Passwords and roles are never validated or stored by this page. Authentication must be
              completed by the backend identity flow.
            </div>

            {authMessage && (
              <div
                role="alert"
                className="rounded-lg border border-emotive/30 bg-emotive/5 p-3 text-sm text-emotive"
              >
                {authMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors"
            >
              Continue to secure sign in
            </button>
          </form>

          <div className="mt-5 text-right">
            <Link
              to="/forgot-password"
              className="text-xs text-clarity hover:underline font-medium tracking-brand"
            >
              Forgot password?
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/create-account"
              className="text-clarity font-medium hover:underline"
            >
              Create account
            </Link>
          </p>
        </div>
        {closureBanner && (
          <div className="mt-4 text-center text-xs text-white/70">
            Your account closure request has been submitted. Check your email for next steps.
          </div>
        )}
      </div>
    </main>
  );
};

export default Login;
