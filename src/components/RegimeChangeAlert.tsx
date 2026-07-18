import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

type Regime = "Bull Market" | "Transitional" | "Bear Market";

interface RegimeChangeAlertProps {
  previousRegime: Regime;
  newRegime: Regime;
  detectedDate: string;
  detectedTime: string;
}

const regimeStyles: Record<
  Regime,
  { bg: string; border: string; pillBg: string; pillText: string }
> = {
  "Bull Market": {
    bg: "#E1F5EE",
    border: "#0F6E56",
    pillBg: "#0F6E56",
    pillText: "#FFFFFF",
  },
  Transitional: {
    bg: "#FAEEDA",
    border: "#FFB703",
    pillBg: "#FFB703",
    pillText: "#0D1B2A",
  },
  "Bear Market": {
    bg: "#FCEBEB",
    border: "#D8315B",
    pillBg: "#D8315B",
    pillText: "#FFFFFF",
  },
};

const RegimeChangeAlert = ({
  previousRegime,
  newRegime,
  detectedDate,
  detectedTime,
}: RegimeChangeAlertProps) => {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("regime-alert-dismissed") === "true";
  });

  if (dismissed) return null;

  const styles = regimeStyles[newRegime];

  const handleDismiss = () => {
    sessionStorage.setItem("regime-alert-dismissed", "true");
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4"
      style={{
        backgroundColor: styles.bg,
        borderLeft: `4px solid ${styles.border}`,
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      <div className="flex-1 min-w-0">
        <span
          className="inline-block font-bold uppercase rounded-full"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            backgroundColor: styles.pillBg,
            color: styles.pillText,
            padding: "3px 8px",
          }}
        >
          {newRegime}
        </span>
        <div className="mt-2 text-[14px] font-bold text-midnight">
          Regime shift detected
        </div>
        <div className="mt-1 text-[12px] text-[#666]">
          The model has shifted from {previousRegime} to {newRegime} · Detected{" "}
          {detectedDate} at {detectedTime}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 pt-1">
        <Link
          to="/performance"
          className="text-[12px] text-clarity hover:underline whitespace-nowrap"
        >
          View details
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className="text-[#888] hover:text-midnight transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default RegimeChangeAlert;
