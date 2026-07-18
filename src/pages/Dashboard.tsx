import AppShell from "@/components/AppShell";
import RegimeChangeAlert from "@/components/RegimeChangeAlert";
import { CURRENT_PORTFOLIO_VALUE, formatPortfolioValue } from "@/lib/portfolio";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const equityData = [
  { month: "Jan '25", value: 105000 },
  { month: "Feb", value: 107200 },
  { month: "Mar", value: 106400 },
  { month: "Apr", value: 109800 },
  { month: "May", value: 112500 },
  { month: "Jun", value: 111000 },
  { month: "Jul", value: 114300 },
  { month: "Aug", value: 116900 },
  { month: "Sep", value: 115400 },
  { month: "Oct", value: 118600 },
  { month: "Nov", value: 121200 },
  { month: "Dec", value: 119800 },
  { month: "Jan '26", value: 122400 },
  { month: "Feb", value: 121000 },
  { month: "Mar", value: 123500 },
  { month: "Apr", value: 124350 },
];

const stats = [
  {
    label: "Portfolio Value",
    value: formatPortfolioValue(CURRENT_PORTFOLIO_VALUE),
    sub: "Total account value",
    tone: "text-midnight",
  },
  {
    label: "All-Time Return",
    value: "+18.4%",
    sub: "Since inception",
    tone: "text-[hsl(var(--success-brand))]",
  },
  {
    label: "This Month",
    value: "+3.2%",
    sub: "Month to date",
    tone: "text-[hsl(var(--success-brand))]",
  },
  {
    label: "Max Drawdown",
    value: "-5.7%",
    sub: "Since inception",
    tone: "text-emotive",
  },
];

const positions = [
  {
    asset: "BTCO",
    direction: "Long",
    size: "12 shares",
    entry: "$82.40",
    current: "$89.15",
    pnl: "+$81.00",
    pnlTone: "text-[hsl(var(--success-brand))]",
    status: "Active",
    statusTone: "bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))]",
  },
  {
    asset: "ETHW",
    direction: "Long",
    size: "8 shares",
    entry: "$24.10",
    current: "$23.45",
    pnl: "-$5.20",
    pnlTone: "text-emotive",
    status: "Active",
    statusTone: "bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))]",
  },
  {
    asset: "XRPT",
    direction: "Flat",
    size: "—",
    entry: "—",
    current: "—",
    pnl: "—",
    pnlTone: "text-[#888]",
    status: "No Position",
    statusTone: "bg-[#E5E5E5] text-[#666]",
  },
];

const regimePill = (regime: string) => {
  switch (regime) {
    case "Bull Market":
      return "bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))]";
    case "Transitional":
      return "bg-[#FFB703]/15 text-[#8a6300]";
    case "Bear Market":
      return "bg-emotive/10 text-emotive";
    default:
      return "bg-[#E5E5E5] text-[#666]";
  }
};

const actionTone = (action: string) => {
  switch (action) {
    case "Buy":
      return "text-[hsl(var(--success-brand))] font-semibold";
    case "Hold":
      return "text-[#8a6300] font-semibold";
    default:
      return "text-[#888] font-semibold";
  }
};

const signals = [
  { date: "Apr 17", asset: "BTCO", signal: "Bullish", regime: "Bull Market", conf: "87%", action: "Buy" },
  { date: "Apr 17", asset: "ETHW", signal: "Bearish", regime: "Transitional", conf: "62%", action: "Hold" },
  { date: "Apr 16", asset: "BTCO", signal: "Bullish", regime: "Bull Market", conf: "91%", action: "Buy" },
  { date: "Apr 16", asset: "XRPT", signal: "Neutral", regime: "Bear Market", conf: "55%", action: "No Action" },
];

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[10px] border border-[#E5E5E5] bg-white ${className}`}>{children}</div>
);

const Dashboard = () => {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold text-midnight">Good morning, Chris.</h1>
          <span className="text-sm text-[#888]">{today}</span>
        </div>

        <RegimeChangeAlert
          previousRegime="Bull Market"
          newRegime="Transitional"
          detectedDate="Apr 18, 2026"
          detectedTime="09:31"
        />

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <div className="text-xs uppercase tracking-wider text-[#888] font-semibold mb-2">
                {s.label}
              </div>
              <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
              <div className="text-xs text-[#888] mt-1">{s.sub}</div>
            </Card>
          ))}
        </div>

        {/* Equity curve */}
        <Card className="p-6">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider text-midnight font-bold">
              Portfolio Performance
            </div>
            <div className="text-xs text-[#888] mt-1">AI Portfolio — since inception</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
                />
                <Tooltip
                  contentStyle={{
                    background: "#0D1B2A",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#2EC4B6" }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2EC4B6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#2EC4B6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Current Positions */}
        <Card className="p-6">
          <div className="text-sm font-bold text-midnight mb-4">Current Positions</div>
          <div className="overflow-hidden rounded-md border border-[#E5E5E5]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-offwhite text-midnight">
                  {["Asset", "Direction", "Size", "Entry Price", "Current Price", "P&L", "Status"].map(
                    (h) => (
                      <th key={h} className="text-left font-bold px-4 py-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr
                    key={p.asset}
                    className={i % 2 === 0 ? "bg-white" : "bg-offwhite"}
                  >
                    <td className="px-4 py-3 font-semibold text-midnight">{p.asset}</td>
                    <td className="px-4 py-3">{p.direction}</td>
                    <td className="px-4 py-3">{p.size}</td>
                    <td className="px-4 py-3">{p.entry}</td>
                    <td className="px-4 py-3">{p.current}</td>
                    <td className={`px-4 py-3 font-semibold ${p.pnlTone}`}>{p.pnl}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${p.statusTone}`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Signals */}
        <Card className="p-6">
          <div className="text-sm font-bold text-midnight mb-4">Recent Signals</div>
          <div className="overflow-hidden rounded-md border border-[#E5E5E5]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-offwhite text-midnight">
                  {["Date", "Asset", "Signal", "Regime", "Confidence", "Action"].map((h) => (
                    <th key={h} className="text-left font-bold px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.map((s, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-offwhite"}>
                    <td className="px-4 py-3">{s.date}</td>
                    <td className="px-4 py-3 font-semibold text-midnight">{s.asset}</td>
                    <td className="px-4 py-3">{s.signal}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${regimePill(
                          s.regime,
                        )}`}
                      >
                        {s.regime}
                      </span>
                    </td>
                    <td className="px-4 py-3">{s.conf}</td>
                    <td className={`px-4 py-3 ${actionTone(s.action)}`}>{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default Dashboard;
