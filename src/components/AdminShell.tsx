import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, ClipboardList, Users, Activity, LogOut } from "lucide-react";

export type AdminNavKey = "overview" | "pending" | "investors" | "operations";

interface AdminShellProps {
  active: AdminNavKey;
  onNavigate: (key: AdminNavKey) => void;
  children: ReactNode;
}

const navItems: { key: AdminNavKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "pending", label: "Pending Applications", icon: ClipboardList },
  { key: "investors", label: "Investors", icon: Users },
  { key: "operations", label: "Fund Operations", icon: Activity },
];

const AdminShell = ({ active, onNavigate, children }: AdminShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-offwhite text-[hsl(var(--body-text))]">
      <aside className="fixed top-0 left-0 z-30 w-64 h-screen bg-midnight text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <span className="font-wordmark text-2xl text-clarity">SNTIMNT.AI</span>
          <div className="mt-2">
            <span
              className="inline-block bg-clarity text-midnight font-bold rounded-full px-2 py-0.5"
              style={{ fontSize: "10px", letterSpacing: "0.04em" }}
            >
              ADMIN
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate(key)}
                className={`relative w-full text-left flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "text-clarity bg-white/5 font-semibold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-clarity rounded-r" />
                )}
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-sm font-semibold text-white">Demo Administrator</div>
          <div className="text-xs text-white/50 mb-3">Founder & CEO</div>
          <button
            onClick={() => navigate("/login")}
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

export default AdminShell;
