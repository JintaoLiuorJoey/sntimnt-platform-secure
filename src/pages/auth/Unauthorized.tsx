import { Link, useLocation } from "react-router";
import { buildLoginPagePath, safeInternalReturnTo } from "@/auth/auth-navigation";

type UnauthorizedLocationState = {
  from?: unknown;
  reason?: "authentication-required" | "session-error";
};

export default function Unauthorized() {
  const location = useLocation();
  const state = (location.state ?? {}) as UnauthorizedLocationState;
  const returnTo = safeInternalReturnTo(typeof state.from === "string" ? state.from : undefined);
  const sessionError = state.reason === "session-error";

  return (
    <main className="min-h-screen bg-midnight flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-emotive">401</p>
        <h1 className="mt-2 text-2xl font-bold text-midnight">
          {sessionError ? "We could not verify your session" : "Sign in required"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {sessionError
            ? "For your protection, access was denied. Please sign in again."
            : "You must have a verified session to view this page."}
        </p>
        <Link
          to={buildLoginPagePath(returnTo)}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-midnight px-5 text-sm font-semibold text-clarity hover:bg-midnight/90"
        >
          Continue to sign in
        </Link>
      </section>
    </main>
  );
}
