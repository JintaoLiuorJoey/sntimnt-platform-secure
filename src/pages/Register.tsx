import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  const [accredited, setAccredited] = useState(false);
  const [agreedTos, setAgreedTos] = useState(false);

  const canSubmit = accredited && agreedTos;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    navigate("/pending-approval");
  };

  const inputClass =
    "w-full h-11 px-3.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-clarity focus:ring-2 focus:ring-clarity/20 transition";

  const labelClass =
    "block text-xs font-medium text-foreground tracking-brand";

  return (
    <main className="min-h-screen w-full bg-midnight flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[560px]">
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
              Create your account
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              For accredited investors only. Your application will be reviewed
              before access is granted.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="name" className={labelClass}>
                  Full legal name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="phone" className={labelClass}>
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  placeholder="+1 (555) 123-4567"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className={labelClass}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            {/* Password + Confirm */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••••"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className={labelClass}>
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  placeholder="••••••••••"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accredited}
                  onChange={(e) => setAccredited(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-clarity focus:ring-clarity/30 accent-clarity cursor-pointer"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  I confirm I am an accredited investor (SEC definition:
                  $200,000+ annual income or $1,000,000+ net worth excluding
                  primary residence)
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTos}
                  onChange={(e) => setAgreedTos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-clarity focus:ring-clarity/30 accent-clarity cursor-pointer"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  I agree to the{" "}
                  <Link to="/terms" className="text-clarity hover:underline font-medium">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-clarity hover:underline font-medium">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 rounded-lg bg-midnight text-clarity font-bold text-sm tracking-brand hover:bg-midnight/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-midnight"
            >
              Create account
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-clarity font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
};

export default Register;
