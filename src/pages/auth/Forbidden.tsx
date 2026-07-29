import { Link } from "react-router";

export default function Forbidden() {
  return (
    <main className="min-h-screen bg-midnight flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-emotive">403</p>
        <h1 className="mt-2 text-2xl font-bold text-midnight">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account is signed in, but it does not have permission to view this page.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-midnight px-5 text-sm font-semibold text-clarity hover:bg-midnight/90"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
