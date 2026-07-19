import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, LineChart, ListOrdered, User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/auth/auth-context";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: BarChart3 },
  { label: "Performance", to: "/performance", icon: LineChart },
  { label: "Signal Log", to: "/signals", icon: ListOrdered, alts: ["/signal-log"] },
  { label: "Profile", to: "/profile", icon: UserIcon },
];

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-offwhite text-[hsl(var(--body-text))]">
      <aside className="fixed top-0 left-0 z-30 w-64 h-screen bg-midnight text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <span className="font-wordmark text-2xl text-clarity">SNTIMNT.AI</span>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map(({ label, to, icon: Icon, alts }) => {
            const active = pathname === to || (alts ?? []).includes(pathname);
            return (
              <Link
                key={label}
                to={to}
                className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "text-clarity bg-white/5 font-semibold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-clarity rounded-r" />
                )}
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-sm font-semibold text-white">{user?.displayName ?? "Account"}</div>
          <div className="text-xs text-white/50 mb-3">
            {user?.roles.includes("investor") ? "Investor" : "Authenticated user"}
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-clarity"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </aside>

      <main className="ml-64 p-8 min-h-screen">{children}</main>
    </div>
  );
};

export default AppShell;
