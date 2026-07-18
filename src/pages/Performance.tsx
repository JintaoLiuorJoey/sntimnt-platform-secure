import { useState } from "react";
import AppShell from "@/components/AppShell";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { CURRENT_PORTFOLIO_VALUE } from "@/lib/portfolio";

const PERIODS = ["1M", "3M", "6M", "YTD", "All"] as const;
type Period = (typeof PERIODS)[number];

// All-time data (used for "All") — final AI Portfolio point pinned to shared CURRENT_PORTFOLIO_VALUE
const equityAll = [
  { month: "Sep '25", ai: 100000, btc: 100000, eth: 100000, xrp: 100000 },
  { month: "Oct", ai: 102800, btc: 98600, eth: 97800, xrp: 100900 },
  { month: "Nov", ai: 101570, btc: 90420, eth: 88900, xrp: 96360 },
  { month: "Dec", ai: 108070, btc: 94670, eth: 93520, xrp: 99540 },
  { month: "Jan '26", ai: 111420, btc: 92020, eth: 90340, xrp: 98440 },
  { month: "Feb", ai: 110530, btc: 78950, eth: 75620, xrp: 89870 },
  { month: "Mar", ai: 113730, btc: 79980, eth: 76230, xrp: 92030 },
  { month: "Apr", ai: CURRENT_PORTFOLIO_VALUE, btc: 78460, eth: 74630, xrp: 92580 },
];

// All periods are lookback windows ending today — every AI series ends at CURRENT_PORTFOLIO_VALUE.

// YTD: Jan–Apr 2026
const equityYTD = [
  { month: "Jan 1", ai: 116000, btc: 92000, eth: 90000, xrp: 95000 },
  { month: "Jan 15", ai: 117500, btc: 91000, eth: 88500, xrp: 94200 },
  { month: "Feb 1", ai: 118300, btc: 89000, eth: 86000, xrp: 93000 },
  { month: "Feb 15", ai: 116900, btc: 81500, eth: 77800, xrp: 87900 },
  { month: "Mar 1", ai: 118100, btc: 80200, eth: 76300, xrp: 88500 },
  { month: "Mar 15", ai: 120800, btc: 81700, eth: 77600, xrp: 90300 },
  { month: "Apr 1", ai: 122900, btc: 80900, eth: 76200, xrp: 90800 },
  { month: "Apr 18", ai: CURRENT_PORTFOLIO_VALUE, btc: 79800, eth: 74900, xrp: 91300 },
];

// 6M: ~last 180 days
const equity6M = [
  { month: "Nov 1", ai: 111800, btc: 95000, eth: 94000, xrp: 96000 },
  { month: "Nov 15", ai: 112700, btc: 91300, eth: 89800, xrp: 94000 },
  { month: "Dec 1", ai: 114700, btc: 92700, eth: 91300, xrp: 95300 },
  { month: "Dec 15", ai: 117200, btc: 93200, eth: 90400, xrp: 95900 },
  { month: "Jan 1", ai: 119200, btc: 91700, eth: 88700, xrp: 95100 },
  { month: "Jan 15", ai: 121000, btc: 90400, eth: 87300, xrp: 93800 },
  { month: "Feb 1", ai: 119800, btc: 83400, eth: 79200, xrp: 89200 },
  { month: "Feb 15", ai: 118300, btc: 82000, eth: 77100, xrp: 87800 },
  { month: "Mar 1", ai: 121500, btc: 83600, eth: 78600, xrp: 89800 },
  { month: "Mar 15", ai: 123300, btc: 85000, eth: 79700, xrp: 91100 },
  { month: "Apr 1", ai: 124200, btc: 83700, eth: 78100, xrp: 91400 },
  { month: "Apr 18", ai: CURRENT_PORTFOLIO_VALUE, btc: 82500, eth: 77000, xrp: 91700 },
];

// 3M
const equity3M = [
  { month: "Jan 17", ai: 116500, btc: 88500, eth: 86200, xrp: 92000 },
  { month: "Jan 31", ai: 117900, btc: 87300, eth: 84500, xrp: 91200 },
  { month: "Feb 14", ai: 119500, btc: 81800, eth: 77200, xrp: 87700 },
  { month: "Feb 28", ai: 120400, btc: 77700, eth: 72600, xrp: 85200 },
  { month: "Mar 14", ai: 122100, btc: 79000, eth: 73800, xrp: 86600 },
  { month: "Mar 28", ai: 123100, btc: 80300, eth: 75000, xrp: 87200 },
  { month: "Apr 11", ai: 123800, btc: 78900, eth: 73300, xrp: 87800 },
  { month: "Apr 18", ai: CURRENT_PORTFOLIO_VALUE, btc: 78100, eth: 72500, xrp: 88200 },
];

// 1M: last ~30 days
const equity1M = [
  { month: "Mar 18", ai: 123100, btc: 80800, eth: 75500, xrp: 89300 },
  { month: "Mar 25", ai: 123600, btc: 80500, eth: 74900, xrp: 89400 },
  { month: "Apr 1", ai: 124000, btc: 79800, eth: 74100, xrp: 89700 },
  { month: "Apr 8", ai: 123400, btc: 78900, eth: 73100, xrp: 89100 },
  { month: "Apr 15", ai: 124100, btc: 79400, eth: 73600, xrp: 89500 },
  { month: "Apr 18", ai: CURRENT_PORTFOLIO_VALUE, btc: 79100, eth: 73400, xrp: 89700 },
];

const annotations = [
  { x: "Nov", label: "Regime Shift" },
  { x: "Feb", label: "Bear Entry" },
  { x: "Mar", label: "Rebalance" },
];

type StatSet = {
  totalReturn: string;
  sharpe: string;
  drawdown: string;
  winRate: string;
};

const periodData: Record<Period, { equity: typeof equityAll; stats: StatSet }> = {
  "1M": {
    equity: equity1M,
    stats: { totalReturn: "+1.0%", sharpe: "1.21", drawdown: "-2.1%", winRate: "61%" },
  },
  "3M": {
    equity: equity3M,
    stats: { totalReturn: "+6.8%", sharpe: "1.38", drawdown: "-3.4%", winRate: "64%" },
  },
  "6M": {
    equity: equity6M,
    stats: { totalReturn: "+11.2%", sharpe: "1.44", drawdown: "-4.8%", winRate: "65%" },
  },
  YTD: {
    equity: equityYTD,
    stats: { totalReturn: "+7.2%", sharpe: "1.48", drawdown: "-5.1%", winRate: "66%" },
  },
  All: {
    equity: equityAll,
    stats: { totalReturn: "+18.4%", sharpe: "1.53", drawdown: "-5.7%", winRate: "67%" },
  },
};

const buildStatCards = (s: StatSet) => [
  { label: "Total Return", value: s.totalReturn, tone: "text-[hsl(var(--success-brand))]" },
  { label: "Sharpe Ratio", value: s.sharpe, tone: "text-midnight" },
  { label: "Max Drawdown", value: s.drawdown, tone: "text-emotive" },
  { label: "Win Rate", value: s.winRate, tone: "text-midnight" },
];

const monthlyReturns = [
  { month: "Sep 2025", ai: 4.2, btc: 6.1, eth: 3.8, xrp: 2.1 },
  { month: "Oct 2025", ai: 2.8, btc: -1.4, eth: -2.2, xrp: 0.9 },
  { month: "Nov 2025", ai: -1.2, btc: -8.3, eth: -9.1, xrp: -4.5 },
  { month: "Dec 2025", ai: 6.4, btc: 4.7, eth: 5.2, xrp: 3.3 },
  { month: "Jan 2026", ai: 3.1, btc: -2.8, eth: -3.4, xrp: -1.1 },
  { month: "Feb 2026", ai: -0.8, btc: -14.2, eth: -16.3, xrp: -8.7 },
  { month: "Mar 2026", ai: 2.9, btc: 1.3, eth: 0.8, xrp: 2.4 },
  { month: "Apr 2026", ai: 1.0, btc: -1.9, eth: -2.1, xrp: 0.6 },
];

const colors = {
  ai: "#2EC4B6",
  btc: "#F7931A",
  eth: "#627EEA",
  xrp: "#00AAE4",
};

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const pctTone = (n: number) =>
  n > 0
    ? "text-[hsl(var(--success-brand))]"
    : n < 0
    ? "text-emotive"
    : "text-[hsl(var(--body-text))]";

const sum = (k: keyof (typeof monthlyReturns)[number]) =>
  monthlyReturns.reduce((a, r) => a + (r[k] as number), 0);

const PeriodToggle = ({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) => (
  <div className="inline-flex items-center bg-white border border-[#E5E5E5] rounded-full p-1">
    {PERIODS.map((p) => {
      const active = p === value;
      return (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            active ? "bg-midnight text-clarity" : "text-[#888] hover:text-midnight"
          }`}
        >
          {p}
        </button>
      );
    })}
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[10px] border border-[#E5E5E5] bg-white ${className}`}>{children}</div>
);

const Performance = () => {
  const [period, setPeriod] = useState<Period>("All");
  const { equity: equityData, stats: periodStats } = periodData[period];
  const stats = buildStatCards(periodStats);
  const showAnnotations = period === "All";

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-midnight">Performance</h1>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <div className="text-xs uppercase tracking-wider text-[#888] font-semibold mb-2">
                {s.label}
              </div>
              <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
            </Card>
          ))}
        </div>

        {/* Multi-line equity curve */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div>
              <div className="text-sm font-bold text-midnight">
                Equity Curves — AI Portfolio vs. Benchmarks
              </div>
              <div className="text-xs text-[#888] mt-1">
                Comparing SNTIMNT.AI performance against BTC, ETH, and XRP buy-and-hold strategies
              </div>
            </div>
            <PeriodToggle value={period} onChange={setPeriod} />
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#888", fontSize: 11 }}
                  axisLine={{ stroke: "#E5E5E5" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#888", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={60}
                  domain={["dataMin - 5000", "dataMax + 5000"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0D1B2A",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `$${v.toLocaleString()}`}
                />
                {showAnnotations &&
                  annotations.map((a) => (
                    <ReferenceLine
                      key={a.label}
                      x={a.x}
                      stroke="#888"
                      strokeDasharray="4 4"
                      label={{
                        value: a.label,
                        position: "top",
                        fill: "#666",
                        fontSize: 10,
                      }}
                    />
                  ))}
                <Line
                  type="monotone"
                  dataKey="ai"
                  name="AI Portfolio"
                  stroke={colors.ai}
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="btc"
                  name="BTC Benchmark"
                  stroke={colors.btc}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="eth"
                  name="ETH Benchmark"
                  stroke={colors.eth}
                  strokeWidth={1.75}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="xrp"
                  name="XRP Benchmark"
                  stroke={colors.xrp}
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs">
            {[
              { color: colors.ai, label: "AI Portfolio" },
              { color: colors.btc, label: "BTC Benchmark" },
              { color: colors.eth, label: "ETH Benchmark" },
              { color: colors.xrp, label: "XRP Benchmark" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-0.5 rounded-full"
                  style={{ background: l.color }}
                />
                <span className="text-[#666] font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Monthly Returns */}
        <Card className="p-6">
          <div className="text-sm font-bold text-midnight mb-4">Monthly Returns</div>
          <div className="overflow-hidden rounded-md border border-[#E5E5E5]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-offwhite text-midnight">
                  {["Month", "AI Portfolio", "BTC", "ETH", "XRP"].map((h, i) => (
                    <th
                      key={h}
                      className={`font-bold px-4 py-3 ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyReturns.map((r, i) => (
                  <tr key={r.month} className={i % 2 === 0 ? "bg-white" : "bg-offwhite"}>
                    <td className="px-4 py-3 font-semibold text-midnight">{r.month}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctTone(r.ai)}`}>
                      {fmtPct(r.ai)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctTone(r.btc)}`}>
                      {fmtPct(r.btc)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctTone(r.eth)}`}>
                      {fmtPct(r.eth)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pctTone(r.xrp)}`}>
                      {fmtPct(r.xrp)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-midnight text-white">
                  <td className="px-4 py-3 font-bold">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-clarity">
                    {fmtPct(sum("ai"))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{fmtPct(sum("btc"))}</td>
                  <td className="px-4 py-3 text-right font-bold">{fmtPct(sum("eth"))}</td>
                  <td className="px-4 py-3 text-right font-bold">{fmtPct(sum("xrp"))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default Performance;
