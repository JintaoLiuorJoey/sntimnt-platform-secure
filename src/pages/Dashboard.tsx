import { useAuth } from "@/auth/auth-context";
import AppShell from "@/components/AppShell";
import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-midnight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#666]">
            {user
              ? `Signed in as ${user.displayName}.`
              : "No validated session identity is available."}
          </p>
        </header>

        <BusinessDataUnavailable
          title="Investment account data unavailable"
          description="Portfolio balances, returns, positions, and account activity are not displayed until they are loaded from authenticated APIs with ownership authorization. The frontend does not use embedded fallback investment records."
          capability="GET /api/me and GET /api/me/investment-accounts"
        />
      </div>
    </AppShell>
  );
};

export default Dashboard;
