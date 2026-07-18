import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import {
  ALL_SIGNAL_ROWS as ALL_ROWS,
  signalTone,
  regimePill,
  actionPill,
} from "@/lib/signals";

const ASSETS = ["All", "BTCO", "ETHW", "XRPT"] as const;
type Asset = (typeof ASSETS)[number];

const REGIMES = ["All Regimes", "Bull Market", "Transitional", "Bear Market"] as const;
const ACTIONS = ["All Actions", "Buy", "Sell", "Hold", "No Action"] as const;


const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[10px] border border-[#E5E5E5] bg-white ${className}`}>{children}</div>
);

const SignalLog = () => {
  const [asset, setAsset] = useState<Asset>("All");
  const [regime, setRegime] = useState<string>(REGIMES[0]);
  const [action, setAction] = useState<string>(ACTIONS[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const clearFilters = () => {
    setAsset("All");
    setRegime(REGIMES[0]);
    setAction(ACTIONS[0]);
    setFrom("");
    setTo("");
  };

  const filteredRows = useMemo(() => {
    return ALL_ROWS.filter((r) => {
      if (asset !== "All" && r.asset !== asset) return false;
      if (regime !== "All Regimes" && r.regime !== regime) return false;
      if (action !== "All Actions" && r.action !== action) return false;
      if (from && r.isoDate < from) return false;
      if (to && r.isoDate > to) return false;
      return true;
    });
  }, [asset, regime, action, from, to]);

  const tradesExecuted = filteredRows.filter(
    (r) => r.action === "Buy" || r.action === "Sell",
  ).length;

  const stats = [
    { label: "Total Signals", value: String(filteredRows.length), tone: "text-midnight" },
    { label: "Trades Executed", value: String(tradesExecuted), tone: "text-midnight" },
    {
      label: "Signals Acted On",
      value: filteredRows.length
        ? `${Math.round((tradesExecuted / filteredRows.length) * 100)}%`
        : "0%",
      tone: "text-clarity",
    },
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-midnight">Signal Log</h1>
          <Button
            variant="outline"
            className="border-[#E5E5E5] text-[#666] hover:text-midnight"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <div className="text-xs uppercase tracking-wider text-[#888] font-semibold mb-2">
                {s.label}
              </div>
              <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
            </Card>
          ))}
        </div>

        {/* Filter bar */}
        <Card className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Asset pills */}
            <div className="inline-flex items-center bg-white border border-[#E5E5E5] rounded-full p-1">
              {ASSETS.map((a) => {
                const active = a === asset;
                return (
                  <button
                    key={a}
                    onClick={() => setAsset(a)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      active ? "bg-midnight text-clarity" : "text-[#888] hover:text-midnight"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>

            <Select value={regime} onValueChange={setRegime}>
              <SelectTrigger className="w-[170px] bg-white text-midnight font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[160px] bg-white text-midnight font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-[160px] bg-white text-midnight font-semibold"
              />
              <span className="text-xs text-[#888]">to</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-[160px] bg-white text-midnight font-semibold"
              />
            </div>

            <button
              onClick={clearFilters}
              className="ml-auto text-xs font-semibold text-clarity hover:underline"
            >
              Clear filters
            </button>
          </div>
        </Card>

        {/* Signal log table */}
        <Card className="p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-midnight">All Signals</div>
              <div className="text-xs text-[#888] mt-1">
                {filteredRows.length} signals · {tradesExecuted} trades executed
              </div>
            </div>
          </div>

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
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#888]">
                      No signals match the selected filters.
                    </td>
                  </tr>
                )}
                {filteredRows.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-offwhite"}>
                    <td className="px-4 py-3 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 font-semibold text-midnight">{r.asset}</td>
                    <td className={`px-4 py-3 ${signalTone(r.signal)}`}>{r.signal}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${regimePill(
                          r.regime,
                        )}`}
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
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${actionPill(
                          r.action,
                        )}`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        r.result === "—"
                          ? "text-[#888]"
                          : "text-[hsl(var(--success-brand))]"
                      }`}
                    >
                      {r.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[#888]">
              {filteredRows.length === 0
                ? "0 signals"
                : `1–${filteredRows.length} of ${filteredRows.length} signals`}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-[#E5E5E5] text-[#666]">
                Previous
              </Button>
              <Button variant="outline" size="sm" className="border-[#E5E5E5] text-midnight">
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default SignalLog;
