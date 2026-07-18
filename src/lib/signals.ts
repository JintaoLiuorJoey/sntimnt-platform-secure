export type SignalRow = {
  date: string;
  isoDate: string;
  asset: "BTCO" | "ETHW" | "XRPT";
  signal: string;
  regime: "Bull Market" | "Transitional" | "Bear Market";
  score: number;
  action: "Buy" | "Sell" | "Hold" | "No Action";
  result: string;
};

export const ALL_SIGNAL_ROWS: SignalRow[] = [
  { date: "Apr 17 09:31", isoDate: "2026-04-17", asset: "BTCO", signal: "Strong Bullish", regime: "Bull Market", score: 0.84, action: "Buy", result: "+2.3%" },
  { date: "Apr 17 09:31", isoDate: "2026-04-17", asset: "ETHW", signal: "Weak Bearish", regime: "Transitional", score: -0.41, action: "Hold", result: "—" },
  { date: "Apr 17 09:31", isoDate: "2026-04-17", asset: "XRPT", signal: "Neutral", regime: "Bear Market", score: -0.12, action: "No Action", result: "—" },
  { date: "Apr 16 09:30", isoDate: "2026-04-16", asset: "BTCO", signal: "Strong Bullish", regime: "Bull Market", score: 0.91, action: "Buy", result: "+1.8%" },
  { date: "Apr 16 09:30", isoDate: "2026-04-16", asset: "ETHW", signal: "Moderate Bearish", regime: "Bear Market", score: -0.63, action: "Sell", result: "+3.1%" },
  { date: "Apr 15 09:30", isoDate: "2026-04-15", asset: "BTCO", signal: "Moderate Bullish", regime: "Bull Market", score: 0.72, action: "Buy", result: "+0.9%" },
  { date: "Apr 15 09:30", isoDate: "2026-04-15", asset: "XRPT", signal: "Neutral", regime: "Transitional", score: 0.08, action: "No Action", result: "—" },
  { date: "Apr 14 09:30", isoDate: "2026-04-14", asset: "ETHW", signal: "Strong Bullish", regime: "Bull Market", score: 0.81, action: "Buy", result: "+2.7%" },
  { date: "Apr 14 09:30", isoDate: "2026-04-14", asset: "BTCO", signal: "Weak Bullish", regime: "Transitional", score: 0.34, action: "Hold", result: "—" },
  { date: "Apr 11 09:30", isoDate: "2026-04-11", asset: "XRPT", signal: "Moderate Bullish", regime: "Bull Market", score: 0.67, action: "Buy", result: "+1.4%" },
  { date: "Apr 11 09:30", isoDate: "2026-04-11", asset: "ETHW", signal: "Weak Bearish", regime: "Bear Market", score: -0.38, action: "Hold", result: "—" },
  { date: "Apr 10 09:30", isoDate: "2026-04-10", asset: "BTCO", signal: "Strong Bearish", regime: "Bear Market", score: -0.79, action: "Sell", result: "+4.2%" },
];

export const signalTone = (s: string) => {
  if (s.includes("Bullish") && (s.startsWith("Strong") || s.startsWith("Moderate")))
    return "text-[hsl(var(--success-brand))] font-semibold";
  if (s.includes("Bearish") && (s.startsWith("Strong") || s.startsWith("Moderate")))
    return "text-emotive font-semibold";
  return "text-[#888] font-semibold";
};

export const regimePill = (r: string) => {
  switch (r) {
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

export const actionPill = (a: string) => {
  switch (a) {
    case "Buy":
      return "bg-[hsl(var(--success-brand))]/10 text-[hsl(var(--success-brand))]";
    case "Sell":
      return "bg-emotive/10 text-emotive";
    case "Hold":
      return "bg-[#FFB703]/15 text-[#8a6300]";
    default:
      return "bg-[#E5E5E5] text-[#666]";
  }
};
