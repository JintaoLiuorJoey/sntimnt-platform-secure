import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const [closureBanner, setClosureBanner] = useState(false);

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const email = (e.currentTarget as HTMLFormElement).email.value.trim().toLowerCase();
    if (email === "admin@example.invalid") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

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

          {/* Headings */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-midnight tracking-brand">
              Welcome!
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your investor account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-foreground tracking-brand"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full h-11 px-3.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-clarity focus:ring-2 focus:ring-clarity/20 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-foreground tracking-brand"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••••"
                className="w-full h-11 px-3.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-clarity focus:ring-2 focus:ring-clarity/20 transition"
              />
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-clarity hover:underline font-medium tracking-brand"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors"
            >
              Sign in
            </button>
          </form>

          {/* Footer */}
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
