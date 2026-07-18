import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Placeholder investor lookup (mirrors the list in Admin.tsx)
const investorsData = [
  {
    name: "Demo Administrator",
    email: "admin@example.invalid",
    portfolioValue: 124350,
    totalDeposited: 120000,
    mtd: "+3.2%",
    memberSince: "April 2026",
  },
  {
    name: "Demo Investor 03",
    email: "investor03@example.invalid",
    portfolioValue: 150000,
    totalDeposited: 150000,
    mtd: "+3.1%",
    memberSince: "March 2026",
  },
  {
    name: "Demo Investor 04",
    email: "investor04@example.invalid",
    portfolioValue: 98500,
    totalDeposited: 95000,
    mtd: "+2.8%",
    memberSince: "March 2026",
  },
  {
    name: "Demo Investor 05",
    email: "investor05@example.invalid",
    portfolioValue: 114400,
    totalDeposited: 110000,
    mtd: "+3.4%",
    memberSince: "February 2026",
  },
];

interface DepositRow {
  id: string;
  date: string;
  declared: number;
  confirmed: number | null;
  status: "Confirmed" | "Pending";
}

const initialDeposits: DepositRow[] = [
  { id: "d-1", date: "Apr 18, 2026", declared: 5000, confirmed: null, status: "Pending" },
  { id: "d-2", date: "Apr 14, 2026", declared: 1500, confirmed: 1800, status: "Confirmed" },
  { id: "d-3", date: "Apr 2, 2026", declared: 120000, confirmed: 120000, status: "Confirmed" },
];

interface RecurringRow {
  id: string;
  frequency: string;
  amount: number;
  startDate: string;
  nextDue: string | null;
  depositsMade: number;
  status: "Active" | "Cancelled";
}

const initialRecurring: RecurringRow[] = [
  {
    id: "r-1",
    frequency: "Monthly",
    amount: 5000,
    startDate: "Apr 14, 2026",
    nextDue: "May 14, 2026",
    depositsMade: 1,
    status: "Active",
  },
  {
    id: "r-2",
    frequency: "Quarterly",
    amount: 10000,
    startDate: "Jan 1, 2026",
    nextDue: null,
    depositsMade: 1,
    status: "Cancelled",
  },
];

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

type OpenForm =
  | { kind: "none" }
  | { kind: "confirm"; depositId: string }
  | { kind: "withdraw" }
  | { kind: "return" }
  | { kind: "banking" }
  | { kind: "cancel-recurring"; recurringId: string };

const AdminInvestor = () => {
  const navigate = useNavigate();
  const { email } = useParams();

  const investor = useMemo(
    () =>
      investorsData.find((i) => i.email === decodeURIComponent(email || "")) ||
      investorsData[0],
    [email],
  );

  const [deposits, setDeposits] = useState<DepositRow[]>(initialDeposits);
  const [recurring, setRecurring] = useState<RecurringRow[]>(initialRecurring);
  const [recurringCancelMsg, setRecurringCancelMsg] = useState(false);
  const [openForm, setOpenForm] = useState<OpenForm>({ kind: "none" });

  // Derived: Total Deposited = sum of confirmed amounts on confirmed deposits.
  // Portfolio Value mirrors this until backend PnL is wired.
  const totalDeposited = useMemo(
    () =>
      deposits
        .filter((d) => d.status === "Confirmed" && d.confirmed !== null)
        .reduce((sum, d) => sum + (d.confirmed || 0), 0),
    [deposits],
  );

  // Confirm deposit form fields
  const [confirmAmount, setConfirmAmount] = useState<string>("");

  // Withdraw form fields
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("Investor Request");
  const [withdrawNotes, setWithdrawNotes] = useState("");

  // Return form
  const [returnNotes, setReturnNotes] = useState("");

  // Banking gate
  const [adminPassword, setAdminPassword] = useState("");
  const [bankingUnlocked, setBankingUnlocked] = useState(false);

  // Notes
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<{ date: string; text: string; italic?: boolean }[]>([
    { date: "Apr 18, 2026", text: "Account approved by Demo Administrator", italic: true },
  ]);
  const [noteSaved, setNoteSaved] = useState(false);

  const handleSaveNote = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    setNotes((prev) => [{ date: today, text: trimmed }, ...prev]);
    setNote("");
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const overpaymentDeposit = deposits.find(
    (d) => d.confirmed !== null && d.confirmed > d.declared,
  );

  const openConfirmForm = (d: DepositRow) => {
    setConfirmAmount(d.declared.toFixed(2));
    setOpenForm({ kind: "confirm", depositId: d.id });
  };

  const handleConfirmDeposit = (id: string) => {
    const amount = parseFloat(confirmAmount) || 0;
    setDeposits((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, confirmed: amount, status: "Confirmed" as const } : d,
      ),
    );
    setOpenForm({ kind: "none" });
  };

  const closeForm = () => setOpenForm({ kind: "none" });

  return (
    <AdminShell active="investors" onNavigate={() => navigate("/admin")}>
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate("/admin")}
        className="inline-flex items-center gap-1.5 text-xs text-[#666] hover:text-midnight transition mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Investors
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-bold text-midnight tracking-tight">
              {investor.name}
            </h1>
            <span className="inline-block bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))] text-xs font-semibold rounded-full px-2.5 py-0.5">
              Active
            </span>
          </div>
          <p className="text-[13px] text-[#888] mt-1">{investor.email}</p>
        </div>
      </div>

      {/* Section 1 — Account Summary (derived from deposits state) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Portfolio Value"
          value={fmtMoney(totalDeposited)}
          valueClass="text-midnight"
        />
        <StatCard
          label="Total Deposited"
          value={fmtMoney(totalDeposited)}
          valueClass="text-midnight"
        />
        <StatCard
          label="MTD Return"
          value={investor.mtd}
          valueClass="text-[hsl(var(--success-brand))]"
        />
        <StatCard
          label="Member Since"
          value={investor.memberSince}
          valueClass="text-midnight"
        />
      </div>

      {/* Section 2 — Deposit History */}
      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <h2 className="text-base font-bold text-midnight mb-4">Deposit History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#666] border-b border-[#E5E5E5]">
                <Th>Date</Th>
                <Th>Declared Amount</Th>
                <Th>Confirmed Amount</Th>
                <Th>Difference</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => {
                const diff =
                  d.confirmed !== null ? d.confirmed - d.declared : null;
                const isOpen =
                  openForm.kind === "confirm" && openForm.depositId === d.id;
                const enteredAmount = parseFloat(confirmAmount) || 0;
                const enteredDiff = enteredAmount - d.declared;
                return (
                  <Fragment key={d.id}>
                    <tr className="border-b border-[#E5E5E5] last:border-b-0">
                      <Td className="text-[#3A3A3A]">{d.date}</Td>
                      <Td className="text-midnight font-medium">
                        {fmtMoney(d.declared)}
                      </Td>
                      <Td className="text-midnight font-medium">
                        {d.confirmed !== null ? fmtMoney(d.confirmed) : "—"}
                      </Td>
                      <Td>
                        {diff === null || diff === 0 ? (
                          <span className="text-[#888]">—</span>
                        ) : diff > 0 ? (
                          <span className="text-[#FFB703] font-semibold">
                            +{fmtMoney(diff)}
                          </span>
                        ) : (
                          <span className="text-emotive font-semibold">
                            {fmtMoney(diff)}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {d.status === "Confirmed" ? (
                          <span className="inline-block bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))] text-xs font-semibold rounded-full px-2.5 py-0.5">
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-block bg-[#FFB703]/15 text-[#8a6200] text-xs font-semibold rounded-full px-2.5 py-0.5">
                            Pending
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {d.status === "Pending" ? (
                          <button
                            type="button"
                            onClick={() => openConfirmForm(d)}
                            className="bg-midnight text-clarity text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className="text-[#888]">—</span>
                        )}
                      </Td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[#E5E5E5] last:border-b-0">
                        <td colSpan={6} className="bg-offwhite px-4 py-4">
                          <div className="max-w-xl">
                            <div className="text-xs font-semibold text-midnight uppercase tracking-wide mb-3">
                              Confirm received amount
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs text-[#666] mb-1">
                                  Declared
                                </label>
                                <Input
                                  value={fmtMoney(d.declared)}
                                  readOnly
                                  className="bg-white border-[#E5E5E5] text-[#888]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-[#666] mb-1">
                                  Amount received
                                </label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={confirmAmount}
                                  onChange={(e) => setConfirmAmount(e.target.value)}
                                  className="bg-white border-[#E5E5E5]"
                                />
                              </div>
                            </div>
                            {enteredDiff !== 0 && !isNaN(enteredDiff) && (
                              <div className="text-xs text-[#8a6200] bg-[#FFB703]/10 rounded-md px-3 py-2 mb-3">
                                Difference: {enteredDiff > 0 ? "+" : ""}
                                {fmtMoney(enteredDiff)} — consider overpayment return
                                if investor requests it
                              </div>
                            )}
                            <div className="flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={closeForm}
                                className="text-sm text-[#666] hover:text-midnight"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmDeposit(d.id)}
                                className="bg-[hsl(var(--success-brand))] text-white text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                              >
                                Confirm Deposit
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recurring Schedules subsection */}
        <div className="mt-6 pt-6 border-t border-[#E5E5E5]">
          <div
            className="text-[9px] font-bold uppercase mb-3"
            style={{ letterSpacing: "0.08em", color: "#bbbbbb" }}
          >
            Recurring Schedules
          </div>

          {recurringCancelMsg && (
            <div className="text-xs text-[#888] mb-2">Recurring schedule cancelled.</div>
          )}

          {recurring.length === 0 ? (
            <div className="text-xs text-[#888] italic">
              No recurring deposit schedules.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[#E5E5E5]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-offwhite text-midnight">
                    {[
                      "Frequency",
                      "Amount",
                      "Start Date",
                      "Next Due",
                      "Deposits Made",
                      "Status",
                      "Actions",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`font-bold px-4 py-3 ${
                          i === 6 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((r, i) => {
                    const isCancelOpen =
                      openForm.kind === "cancel-recurring" &&
                      openForm.recurringId === r.id;
                    const rowBg = i % 2 === 0 ? "bg-white" : "bg-offwhite";
                    return (
                      <Fragment key={r.id}>
                        <tr className={rowBg}>
                          <td className="px-4 py-3 text-[#3A3A3A]">{r.frequency}</td>
                          <td className="px-4 py-3 text-midnight font-medium">
                            {fmtMoney(r.amount)}
                          </td>
                          <td className="px-4 py-3 text-[#3A3A3A]">{r.startDate}</td>
                          <td className="px-4 py-3 text-[#3A3A3A]">
                            {r.nextDue || "—"}
                          </td>
                          <td className="px-4 py-3 text-[#3A3A3A]">{r.depositsMade}</td>
                          <td className="px-4 py-3">
                            {r.status === "Active" ? (
                              <span className="inline-block bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))] text-xs font-semibold rounded-full px-2.5 py-0.5">
                                Active
                              </span>
                            ) : (
                              <span className="inline-block bg-[#E5E5E5] text-[#666] text-xs font-semibold rounded-full px-2.5 py-0.5">
                                Cancelled
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.status === "Active" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenForm({
                                    kind: "cancel-recurring",
                                    recurringId: r.id,
                                  })
                                }
                                className="border border-emotive text-emotive bg-white text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-emotive/5 transition"
                              >
                                Cancel Schedule
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {isCancelOpen && (
                          <tr className={rowBg}>
                            <td colSpan={7} className="px-4 py-4 bg-emotive/5">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="text-sm text-emotive">
                                  Cancelling this schedule will stop future deposit
                                  reminders. This cannot be undone.
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={closeForm}
                                    className="text-sm text-[#666] hover:text-midnight"
                                  >
                                    Keep Schedule
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRecurring((prev) =>
                                        prev.map((row) =>
                                          row.id === r.id
                                            ? {
                                                ...row,
                                                status: "Cancelled" as const,
                                                nextDue: null,
                                              }
                                            : row,
                                        ),
                                      );
                                      closeForm();
                                      setRecurringCancelMsg(true);
                                      setTimeout(
                                        () => setRecurringCancelMsg(false),
                                        3000,
                                      );
                                    }}
                                    className="bg-emotive text-white text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                                  >
                                    Cancel Schedule
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Section 3 — Withdrawals & Returns */}
      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <h2 className="text-base font-bold text-midnight">Withdrawals and Returns</h2>
        <p className="text-sm text-[#888] mt-1 mb-4">
          Initiate withdrawals or overpayment returns on behalf of this investor
        </p>

        {/* Initiate Withdrawal */}
        <div className="border border-[#E5E5E5] rounded-md p-4 mb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-bold text-midnight">Initiate Withdrawal</div>
              <div className="text-xs text-[#888] mt-0.5">
                Process a withdrawal from this investor's account.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setOpenForm(
                  openForm.kind === "withdraw" ? { kind: "none" } : { kind: "withdraw" },
                )
              }
              className="border border-midnight text-midnight bg-white text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-midnight/5 transition"
            >
              Initiate Withdrawal
            </button>
          </div>
          {openForm.kind === "withdraw" && (
            <div className="mt-4 pt-4 border-t border-[#E5E5E5] space-y-3">
              <div>
                <label className="block text-xs text-[#666] mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#888]">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7 bg-white border-[#E5E5E5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#666] mb-1">Reason</label>
                <select
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#E5E5E5] bg-white px-3 text-sm text-midnight focus:outline-none focus:ring-2 focus:ring-clarity/40"
                >
                  <option>Investor Request</option>
                  <option>Overpayment Return</option>
                  <option>Account Closure</option>
                  <option>Fee Adjustment</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#666] mb-1">
                  Notes (optional)
                </label>
                <Textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className="bg-white border-[#E5E5E5]"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-sm text-[#666] hover:text-midnight"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="bg-emotive text-white text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                >
                  Submit Withdrawal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Overpayment Detected */}
        {overpaymentDeposit && (
          <div className="border border-[#FFB703]/40 bg-[#FFB703]/5 rounded-md p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-bold text-[#8a6200]">
                  Overpayment Detected
                </div>
                <div className="text-xs text-[#3A3A3A] mt-0.5">
                  {overpaymentDeposit.date.replace(/, \d{4}/, "")} deposit received{" "}
                  {fmtMoney(
                    (overpaymentDeposit.confirmed || 0) - overpaymentDeposit.declared,
                  )}{" "}
                  over declared amount.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setOpenForm(
                    openForm.kind === "return" ? { kind: "none" } : { kind: "return" },
                  )
                }
                className="border border-[#FFB703] text-[#8a6200] bg-white text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-[#FFB703]/10 transition"
              >
                Return Overpayment
              </button>
            </div>
            {openForm.kind === "return" && (
              <div className="mt-4 pt-4 border-t border-[#FFB703]/30 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#666] mb-1">
                      Return amount
                    </label>
                    <Input
                      readOnly
                      value={fmtMoney(
                        (overpaymentDeposit.confirmed || 0) -
                          overpaymentDeposit.declared,
                      )}
                      className="bg-white border-[#E5E5E5] text-[#888]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#666] mb-1">Destination</label>
                    <Input
                      readOnly
                      value="Chase Bank ···· 0000"
                      className="bg-white border-[#E5E5E5] text-[#888]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#666] mb-1">Notes</label>
                  <Textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="bg-white border-[#E5E5E5]"
                  />
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="text-sm text-[#666] hover:text-midnight"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="bg-[#FFB703] text-midnight text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
                  >
                    Process Return
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 4 — Banking Details */}
      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6 mb-4">
        <h2 className="text-base font-bold text-midnight">Banking Details</h2>
        <p className="text-sm text-[#888] mt-1 mb-4">
          Decrypted details are required for processing wire returns. Admin password
          required.
        </p>

        {!bankingUnlocked && openForm.kind !== "banking" && (
          <div className="flex items-center justify-between gap-4 flex-wrap border border-dashed border-[#E5E5E5] rounded-md p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-offwhite flex items-center justify-center">
                <Lock className="h-4 w-4 text-[#666]" />
              </div>
              <div className="text-sm text-[#3A3A3A]">
                Banking details are hidden for security.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenForm({ kind: "banking" })}
              className="border border-midnight text-midnight bg-white text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-midnight/5 transition"
            >
              View Banking Details
            </button>
          </div>
        )}

        {openForm.kind === "banking" && !bankingUnlocked && (
          <div className="border border-[#E5E5E5] rounded-md p-4 space-y-3">
            <label className="block text-xs text-[#666]">
              Confirm your admin password
            </label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="bg-white border-[#E5E5E5]"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setAdminPassword("");
                  closeForm();
                }}
                className="text-sm text-[#666] hover:text-midnight"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setBankingUnlocked(true);
                  setAdminPassword("");
                  closeForm();
                }}
                className="bg-midnight text-clarity text-xs font-semibold rounded-md px-3 py-1.5 hover:opacity-90 transition"
              >
                Unlock
              </button>
            </div>
          </div>
        )}

        {bankingUnlocked && (
          <div className="border border-[#E5E5E5] rounded-md p-4">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <DetailRow label="Bank" value="Chase Bank" />
              <DetailRow label="Account holder" value="Demo Administrator" />
              <DetailRow label="Account type" value="Checking" />
              <DetailRow label="Routing number" value="···· 0001" />
              <DetailRow label="Account number" value="···· 0000" />
            </dl>
            <p className="text-xs text-[#888] italic mt-4">
              Full account details available to admin only via secure backend
              decryption
            </p>
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => setBankingUnlocked(false)}
                className="text-xs text-clarity hover:underline"
              >
                Hide Details
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 5 — Account Notes */}
      <section className="rounded-[10px] border border-[#E5E5E5] bg-white p-6">
        <h2 className="text-base font-bold text-midnight mb-4">Account Notes</h2>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this investor..."
          className="bg-white border-[#E5E5E5] min-h-[80px] mb-3"
        />
        <div className="text-right">
          <button
            type="button"
            onClick={handleSaveNote}
            className="border border-midnight text-midnight bg-white text-xs font-semibold rounded-md px-3 py-1.5 hover:bg-midnight/5 transition"
          >
            Save Note
          </button>
          {noteSaved && (
            <div className="mt-2 text-xs font-semibold text-[#0F6E56]">Note saved.</div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-[#E5E5E5] divide-y divide-[#E5E5E5]">
          {notes.map((n, i) => (
            <div key={i} className="flex gap-4 py-2 first:pt-0 last:pb-0">
              <div className="text-xs font-bold text-midnight whitespace-nowrap min-w-[90px]">
                {n.date}
              </div>
              <div className={`text-xs text-[#666] ${n.italic ? "italic" : ""}`}>{n.text}</div>
            </div>
          ))}
        </div>
      </section>
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
    <div className="text-xs font-semibold text-[#666] uppercase tracking-wide">
      {label}
    </div>
    <div className={`mt-2 text-2xl font-bold tracking-tight ${valueClass}`}>{value}</div>
  </div>
);

const Th = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <th className={`py-3 px-3 font-semibold ${className}`}>{children}</th>;

const Td = ({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) => <td className={`py-3 px-3 align-middle ${className}`}>{children}</td>;

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-[#888] uppercase tracking-wide">{label}</dt>
    <dd className="text-sm text-midnight font-medium mt-0.5">{value}</dd>
  </div>
);

export default AdminInvestor;
