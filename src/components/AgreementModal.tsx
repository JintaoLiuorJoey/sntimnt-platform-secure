import { useEffect } from "react";
import { X } from "lucide-react";

type Section = { heading: string; body: string };

const sections: Section[] = [
  {
    heading: "1. Appointment",
    body: "Investor hereby appoints SNTIMNT.AI, Inc. as discretionary investment manager for the purpose of trading digital asset exchange-traded funds (ETFs) and other permitted digital asset instruments pursuant to Manager's proprietary quantitative strategies.",
  },
  {
    heading: "2. Custody and Ownership",
    body: "Investor retains full beneficial ownership of all contributed capital and any resulting profits or losses at all times. Investor funds are held in a segregated account maintained by Manager's designated trading platform provider. Manager maintains accurate internal records reflecting each Investor's account balance, transaction history, and performance.",
  },
  {
    heading: "3. Permitted Instruments",
    body: "For Version 1 of the platform, Manager will trade exclusively in BTCO (Invesco Bitcoin ETF), ETHW (Bitwise Ethereum ETF), and XRPT (ProShares XRP ETF).",
  },
  {
    heading: "4. Fees",
    body: "Management fee: 2.0% per annum assessed monthly on end-of-month NAV. Performance fee: 20% of Net New Profits assessed quarterly, subject to a High-Water Mark. Net New Profits are calculated after all trading costs, slippage, infrastructure expenses, and management fees. Early redemption fee: 2.0% of account NAV for investor-initiated closure before the 12-month commitment period ends, outside of qualifying exceptions (material breach, regulatory requirement, mutual consent, or Manager insolvency).",
  },
  {
    heading: "5. Minimum Investment",
    body: "Minimum initial investment: $1,000. Minimum subsequent deposit: $1,000.",
  },
  {
    heading: "6. Minimum Commitment Period",
    body: "Investor agrees to maintain participation for a minimum of twelve (12) months from the Effective Date, except in cases of material breach, regulatory requirement, insolvency, or mutual written consent.",
  },
  {
    heading: "7. Termination",
    body: "Following the commitment period, either party may terminate with thirty (30) days written notice. Investor funds will be returned within thirty (30) days of termination, net of applicable fees.",
  },
  {
    heading: "8. Risk Acknowledgment",
    body: "Investor acknowledges that digital asset markets are volatile and speculative and that losses, including total loss of capital, are possible. Past performance does not guarantee future results.",
  },
  {
    heading: "9. Governing Law",
    body: "This Agreement is governed by the laws of the State of Florida. Disputes are resolved through binding arbitration. Class action waiver applies.",
  },
];

interface AgreementModalProps {
  open: boolean;
  onClose: () => void;
}

const AgreementModal = ({ open, onClose }: AgreementModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(13, 27, 42, 0.7)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] max-h-[80vh] flex flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl"
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between bg-white border-b"
          style={{ padding: "20px 24px", borderColor: "#E5E5E5" }}
        >
          <h2
            id="agreement-title"
            className="font-bold text-midnight"
            style={{ fontSize: "16px" }}
          >
            Investment Management Agreement
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[#888] hover:text-midnight transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ padding: "24px" }}>
          <div className="space-y-5">
            {sections.map((s) => (
              <div key={s.heading}>
                <h3 className="text-sm font-bold text-midnight mb-1.5">
                  {s.heading}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#3A3A3A" }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 z-10 flex justify-end bg-white border-t"
          style={{ padding: "16px 24px", borderColor: "#E5E5E5" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="bg-midnight text-clarity hover:bg-midnight/90 font-bold text-sm rounded-md px-4 py-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgreementModal;
