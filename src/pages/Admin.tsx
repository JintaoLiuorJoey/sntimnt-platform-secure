import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell, { AdminNavKey } from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import {
  ALL_SIGNAL_ROWS,
  signalTone,
  regimePill,
  actionPill,
} from "@/lib/signals";

// Hardcoded admin gate (placeholder until backend roles)
const ADMIN_EMAIL = "admin@example.invalid";
const getCurrentUserEmail = (): string => {
  if (typeof window === "undefined") return ADMIN_EMAIL;
  return localStorage.getItem("currentUserEmail") || ADMIN_EMAIL;
};

interface PendingApp {
  id: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  accredited: boolean;
}

const initialPending: PendingApp[] = [
  {
    id: "app-1",
    date: "Apr 17, 2026",
    name: "Demo Investor 01",
    email: "investor01@example.invalid",
    phone: "(312) 555-0184",
    accredited: true,
  },
  {
    id: "app-2",
    date: "Apr 16, 2026",
    name: "Marcus Thompson",
    email: "investor02@example.invalid",
    phone: "(786) 555-0923",
    accredited: true,
  },
];

interface Investor {
  name: string;
  email: string;
  value: number;
  mtd: string;
  join: string;
  depositDate: string;
  totalDeposited: number;
}

const investors: Investor[] = [
  { name: "Demo Administrator", email: "admin@example.invalid", value: 124350, mtd: "+3.2%", join: "Apr 2026", depositDate: "Apr 2026", totalDeposited: 120000 },
  { name: "Demo Investor 03", email: "investor03@example.invalid", value: 150000, mtd: "+3.1%", join: "Mar 2026", depositDate: "Mar 2026", totalDeposited: 150000 },
  { name: "Demo Investor 04", email: "investor04@example.invalid", value: 98500, mtd: "+2.8%", join: "Mar 2026", depositDate: "Mar 2026", totalDeposited: 95000 },
  { name: "Demo Investor 05", email: "investor05@example.invalid", value: 114400, mtd: "+3.4%", join: "Feb 2026", depositDate: "Feb 2026", totalDeposited: 110000 },
];

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const fmtMoneyShort = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

type Toast = { id: number; type: "success" | "error"; message: string };

const SECTION_TITLES: Record<AdminNavKey, { title: string; subtitle?: string }> = {
  overview: { title: "Admin Overview" },
  pending: { title: "Pending Applications", subtitle: "Review and action investor applications" },
  investors: { title: "Investors", subtitle: "All active investor accounts" },
  operations: { title: "Fund Operations", subtitle: "Live system status and trading overview" },
};

const Admin = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<AdminNavKey>("overview");
  const [pending, setPending] = useState<PendingApp[]>(initialPending);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const [investorSearch, setInvestorSearch] = useState("");

  // Route protection
  useEffect(() => {
    const email = getCurrentUserEmail();
    if (email !== ADMIN_EMAIL) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const totalAUM = useMemo(
    () => investors.reduce((acc, i) => acc + i.value, 0),
    []
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const pushToast = (type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleApprove = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
    setRejectingId((prev) => (prev === id ? null : prev));
    pushToast("success", "Account approved. Investor will receive an email notification.");
  };

  const handleConfirmReject = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
    setRejectingId(null);
    pushToast("error", "Application rejected.");
  };

  // Reusable Pending Applications table
  const renderPendingTable = (rows: PendingApp[], includeNotes: boolean) => {
    const colCount = includeNotes ? 7 : 6;
    if (rows.length === 0) {
      return (
        <div className="text-sm text-[#888] py-6 text-center border border-dashed border-[#E5E5E5] rounded-md">
          No pending applications.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#666] border-b border-[#E5E5E5]">
              <Th>Date Applied</Th>
              <Th>Full Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Accredited Investor</Th>
              {includeNotes && <Th>Notes</Th>}
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-b border-[#E5E5E5] last:border-b-0">
                  <Td className="text-[#3A3A3A]">{p.date}</Td>
                  <Td className="font-semibold text-midnight">{p.name}</Td>
                  <Td className="text-[#3A3A3A]">{p.email}</Td>
                  <Td className="text-[#3A3A3A]">{p.phone}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-[hsl(var(--success-brand))] font-medium">
                      <Check className="h-3.5 w-3.5" /> Confirmed
                    </span>
                  </Td>
                  {includeNotes && <Td className="text-[#888]">—</Td>}
                  <Td className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(p.id)}
                        className="bg-[hsl(var(--success-brand))] text-white text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRejectingId((prev) => (prev === p.id ? null : p.id))
                        }
                        className="border border-emotive text-emotive text-xs font-semibold rounded-md px-3 py-1.5 bg-white hover:bg-emotive/5 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </Td>
                </tr>
                {rejectingId === p.id && (
                  <tr className="border-b border-[#E5E5E5] last:border-b-0">
                    <td colSpan={colCount} className="bg-emotive/5 px-4 py-3">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm text-[#3A3A3A]">
                          Are you sure? This will notify the investor their application was not approved.
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setRejectingId(null)}
                            className="text-sm text-[#666] hover:text-midnight"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmReject(p.id)}
                            className="bg-emotive text-white text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                          >
                            Confirm Reject
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Reusable Active Investors table
  const renderInvestorsTable = (extended: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[#666] border-b border-[#E5E5E5]">
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Account Value</Th>
            <Th>MTD Return</Th>
            <Th>Join Date</Th>
            {extended && <Th>Deposit Date</Th>}
            {extended && <Th>Total Deposited</Th>}
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {investors.map((inv) => (
            <tr key={inv.email} className="border-b border-[#E5E5E5] last:border-b-0">
              <Td className="font-semibold text-midnight">{inv.name}</Td>
              <Td className="text-[#3A3A3A]">{inv.email}</Td>
              <Td className="text-midnight font-medium">{fmtMoney(inv.value)}</Td>
              <Td className="text-[hsl(var(--success-brand))] font-medium">{inv.mtd}</Td>
              <Td className="text-[#3A3A3A]">{inv.join}</Td>
              {extended && <Td className="text-[#3A3A3A]">{inv.depositDate}</Td>}
              {extended && <Td className="text-midnight font-medium">{fmtMoneyShort(inv.totalDeposited)}</Td>}
              <Td>
                <span className="inline-block bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))] text-xs font-semibold rounded-full px-2.5 py-0.5">
                  Active
                </span>
              </Td>
              <Td className="text-right">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/investor/${encodeURIComponent(inv.email)}`)}
                  className="border border-midnight text-midnight bg-white text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-midnight/5 transition"
                >
                  View
                </button>
              </Td>
            </tr>
          ))}
          {extended && (
            <tr className="bg-midnight text-white">
              <Td className="font-bold text-white">Total AUM</Td>
              <Td />
              <Td className="font-bold text-clarity">{fmtMoney(totalAUM)}</Td>
              <Td />
              <Td />
              <Td />
              <Td />
              <Td />
              <Td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // ---------- Section renderers ----------
  const renderOverview = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total AUM" value={fmtMoney(totalAUM)} valueClass="text-midnight" />
        <StatCard label="Active Investors" value={String(investors.length)} valueClass="text-midnight" />
        <StatCard
          label="Pending Applications"
          value={String(pending.length)}
          valueClass="text-[#FFB703]"
        />
        <StatCard
          label="MTD Fund Return"
          value="+3.2%"
          valueClass="text-[hsl(var(--success-brand))]"
        />
      </div>

      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFB703]" aria-hidden />
          <h2 className="text-base font-bold text-midnight">Pending Applications</h2>
        </div>
        <p className="text-sm text-[#888] mt-1 mb-4">
          {pending.length} application{pending.length === 1 ? "" : "s"} awaiting review
        </p>
        {renderPendingTable(pending, false)}
      </section>

      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <h2 className="text-base font-bold text-midnight">Active Investors</h2>
        <p className="text-sm text-[#888] mt-1 mb-4">{investors.length} active accounts</p>
        {renderInvestorsTable(false)}
      </section>

      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6">
        <h2 className="text-base font-bold text-midnight mb-4">Fund Operations</h2>
        <div className="divide-y divide-[#E5E5E5]">
          <OpRow
            label="Live Trading Status"
            right={
              <span className="inline-block bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))] text-xs font-semibold rounded-full px-2.5 py-0.5">
                Active
              </span>
            }
          />
          <OpRow
            label="Current Regime"
            right={
              <span className="inline-block bg-[#FFB703] text-midnight text-xs font-semibold rounded-full px-2.5 py-0.5">
                Bull Market
              </span>
            }
          />
          <OpRow
            label="Last Signal"
            right={
              <span className="text-sm text-[#666]">
                <span className="text-clarity font-medium">Apr 18, 2026 09:31</span> — BTCO Buy
              </span>
            }
          />
          <OpRow
            label="Platform Version"
            right={<span className="text-sm text-[#666]">v1.0 — Live</span>}
          />
          <OpRow
            label="Management Fee"
            right={<span className="text-sm text-[#666]">2.0% per annum, assessed monthly</span>}
          />
          <OpRow
            label="Performance Fee"
            right={
              <span className="text-sm text-[#666]">
                20% of net profits, assessed quarterly — high-water mark applies
              </span>
            }
          />
        </div>
      </section>
    </>
  );

  const renderPendingSection = () => {
    const filtered = pendingSearch
      ? pending.filter(
          (p) =>
            p.name.toLowerCase().includes(pendingSearch.toLowerCase()) ||
            p.email.toLowerCase().includes(pendingSearch.toLowerCase()),
        )
      : pending;
    return (
      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6">
        <Input
          type="text"
          placeholder="Search by name or email"
          value={pendingSearch}
          onChange={(e) => setPendingSearch(e.target.value)}
          className="w-full mb-4 bg-white border-[#E5E5E5]"
        />
        {renderPendingTable(filtered, true)}
      </section>
    );
  };

  const renderInvestorsSection = () => (
    <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6">
      <Input
        type="text"
        placeholder="Search by name or email"
        value={investorSearch}
        onChange={(e) => setInvestorSearch(e.target.value)}
        className="w-full mb-4 bg-white border-[#E5E5E5]"
      />
      {renderInvestorsTable(true)}
    </section>
  );

  const renderOperationsSection = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Trading Status" value="Active" valueClass="text-[hsl(var(--success-brand))]" />
        <StatCard label="Current Regime" value="Bull Market" valueClass="text-[#FFB703]" />
        <StatCard label="Last Signal" value="Apr 18 09:31" valueClass="text-midnight" />
        <StatCard label="Platform Version" value="v1.0" valueClass="text-midnight" />
      </div>

      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <h2 className="text-base font-bold text-midnight mb-4">Fee Structure</h2>
        <div className="divide-y divide-[#E5E5E5]">
          <OpRow
            label="Management Fee"
            right={
              <span className="text-sm text-[#666]">
                2.0% per annum, assessed monthly on end-of-month NAV
              </span>
            }
          />
          <OpRow
            label="Performance Fee"
            right={
              <span className="text-sm text-[#666]">
                20% of net profits, assessed quarterly, high-water mark applies
              </span>
            }
          />
        </div>
      </section>

      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <h2 className="text-base font-bold text-midnight mb-4">Recent Signals</h2>
        <div className="overflow-hidden rounded-md border border-[#E5E5E5]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-offwhite text-midnight">
                {[
                  "Date & Time",
                  "Asset",
                  "Signal Strength",
                  "Regime",
                  "Sentiment Score",
                  "Action",
                  "Result",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`font-bold px-4 py-3 ${
                      i === 4 || i === 6 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_SIGNAL_ROWS.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-offwhite"}>
                  <td className="px-4 py-3 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-3 font-semibold text-midnight">{r.asset}</td>
                  <td className={`px-4 py-3 ${signalTone(r.signal)}`}>{r.signal}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${regimePill(r.regime)}`}
                    >
                      {r.regime}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      r.score > 0
                        ? "text-[hsl(var(--success-brand))]"
                        : r.score < 0
                        ? "text-emotive"
                        : "text-[#888]"
                    }`}
                  >
                    {r.score > 0 ? `+${r.score.toFixed(2)}` : r.score.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${actionPill(r.action)}`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      r.result === "—" ? "text-[#888]" : "text-[hsl(var(--success-brand))]"
                    }`}
                  >
                    {r.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6">
        <h2 className="text-base font-bold text-midnight mb-4">System Health</h2>
        <div className="divide-y divide-[#E5E5E5]">
          <HealthRow
            label="Monitoring Feed"
            pillText="Running"
            sub="RSS/Reddit feed active, polling every 3 hours"
          />
          <HealthRow
            label="Alpaca API"
            pillText="Connected"
            sub="Live trading pipeline active"
          />
          <HealthRow
            label="Database"
            pillText="Healthy"
            sub="AWS RDS PostgreSQL — all tables nominal"
          />
          <div className="flex items-start justify-between py-3">
            <div className="text-sm font-medium text-midnight">Last Heartbeat</div>
            <div className="text-sm text-[#666]">Apr 18, 2026 09:31:04</div>
          </div>
        </div>
      </section>
    </>
  );

  const sectionMeta = SECTION_TITLES[active];

  return (
    <AdminShell active={active} onNavigate={setActive}>
      {/* Top bar */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-midnight tracking-tight">
            {sectionMeta.title}
          </h1>
          {sectionMeta.subtitle && (
            <p className="text-sm text-[#888] mt-1">{sectionMeta.subtitle}</p>
          )}
        </div>
        {active === "overview" && <div className="text-sm text-[#888]">{today}</div>}
      </div>

      {active === "overview" && renderOverview()}
      {active === "pending" && renderPendingSection()}
      {active === "investors" && renderInvestorsSection()}
      {active === "operations" && renderOperationsSection()}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md px-4 py-3 text-sm font-medium shadow-lg text-white animate-in fade-in slide-in-from-bottom-2 ${
              t.type === "success"
                ? "bg-[hsl(var(--success-brand))]"
                : "bg-emotive"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AdminShell>
  );
};

const StatCard = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) => (
  <div className="rounded-[10px] border border-[#E5E5E5] bg-white p-5">
    <div className="text-xs font-semibold text-[#666] uppercase tracking-wide">{label}</div>
    <div className={`mt-2 text-2xl font-bold tracking-tight ${valueClass}`}>{value}</div>
  </div>
);

const Th = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`py-3 px-3 font-semibold ${className}`}>{children}</th>
);

const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <td className={`py-3 px-3 align-middle ${className}`}>{children}</td>
);

const OpRow = ({ label, right }: { label: string; right: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3">
    <div className="text-sm font-medium text-midnight">{label}</div>
    <div>{right}</div>
  </div>
);

const HealthRow = ({
  label,
  pillText,
  sub,
}: {
  label: string;
  pillText: string;
  sub: string;
}) => (
  <div className="flex items-start justify-between py-3 gap-4">
    <div>
      <div className="text-sm font-medium text-midnight">{label}</div>
      <div className="text-xs text-[#888] mt-0.5">{sub}</div>
    </div>
    <span className="inline-block bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))] text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap">
      {pillText}
    </span>
  </div>
);

export default Admin;
