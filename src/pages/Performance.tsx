import AppShell from "@/components/AppShell";
import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const Performance = () => (
  <AppShell>
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-midnight">
          Performance
        </h1>
        <p className="mt-1 text-sm text-[#666]">
          Performance results must be derived from an authorized investment
          account and a trusted server-side calculation.
        </p>
      </header>

      <BusinessDataUnavailable
        title="Performance data unavailable"
        description="Returns, equity curves, drawdown, risk statistics, benchmarks, and monthly results remain hidden until a scoped performance service is connected. No simulated performance is presented as authenticated account data."
        capability="Authorized investment-account and performance APIs"
      />
    </div>
  </AppShell>
);

export default Performance;
