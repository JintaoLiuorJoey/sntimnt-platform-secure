import AppShell from "@/components/AppShell";
import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const SignalLog = () => (
  <AppShell>
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-midnight">
          Signal Log
        </h1>
        <p className="mt-1 text-sm text-[#666]">
          Signal history and execution results must come from an authorized,
          auditable server-side data source.
        </p>
      </header>

      <BusinessDataUnavailable
        title="Signal history unavailable"
        description="Signal records, model scores, trade actions, outcomes, filters, and exports remain disabled until an authenticated signal-history API is connected. The frontend does not display embedded fallback signal or trading records."
        capability="Authorized signal-history and export APIs"
      />
    </div>
  </AppShell>
);

export default SignalLog;
