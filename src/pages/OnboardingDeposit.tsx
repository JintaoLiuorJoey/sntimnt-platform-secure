import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Lock, BarChart3, LineChart, ListOrdered, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Step = 1 | 2 | 3;

const PLACEHOLDER_WIRE = {
  bankName: "[PLACEHOLDER BANK NAME]",
  routing: "[PLACEHOLDER ROUTING]",
  account: "[PLACEHOLDER ACCOUNT]",
};

const navItems = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "Performance", icon: LineChart },
  { label: "Signal Log", icon: ListOrdered },
  { label: "Profile", icon: UserIcon },
];

const ProgressIndicator = ({ step }: { step: Step }) => {
  const steps = ["Banking Info", "Deposit Amount", "Wire Instructions"];
  return (
    <ol className="flex items-center gap-4 mb-10">
      {steps.map((label, i) => {
        const idx = (i + 1) as Step;
        const isActive = idx === step;
        const isComplete = idx < step;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                isActive || isComplete
                  ? "bg-clarity text-midnight"
                  : "bg-[#E5E5E5] text-[#888]"
              }`}
            >
              {isComplete ? <Check className="h-4 w-4" /> : idx}
            </span>
            <span
              className={`text-sm font-medium ${
                isActive ? "text-midnight" : isComplete ? "text-clarity" : "text-[#888]"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="ml-2 h-px w-8 bg-[#E5E5E5]" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
};

const OnboardingDeposit = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  const [bankName, setBankName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState("");

  const [amountStr, setAmountStr] = useState("");
  const amount = Number(amountStr.replace(/[,\s]/g, "")) || 0;

  const step1Valid =
    bankName.trim() && holderName.trim() && routing.trim() && account.trim() && accountType;

  const amountError =
    amountStr !== "" && amount < 1000 ? "Minimum deposit is $1,000." : "";
  const step2Valid = amount >= 1000;

  const formatUsd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const annualFee = amount * 0.02;

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  return (
    <div className="min-h-screen flex bg-offwhite text-[hsl(var(--body-text))]">
      {/* Sidebar */}
      <aside className="w-64 bg-midnight text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <span className="font-wordmark text-2xl text-clarity">SNTIMNT.AI</span>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              disabled
              className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/30 cursor-not-allowed"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-6 py-4 text-xs text-white/40 border-t border-white/10">
          Locked until deposit is confirmed
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-white">
        <div className="max-w-2xl mx-auto px-10 py-12">
          <ProgressIndicator step={step} />

          {step === 1 && (
            <section>
              <h1 className="text-3xl font-bold text-midnight mb-2">
                Let's get your account funded.
              </h1>
              <p className="text-[hsl(var(--body-text))] mb-8">
                To activate your account and begin investing, we need your banking details and
                initial deposit amount. Minimum deposit is $1,000.
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="mt-1.5 bg-white text-midnight font-semibold placeholder:font-normal placeholder:text-[#888]"
                  />
                </div>
                <div>
                  <Label htmlFor="holderName">Account holder name</Label>
                  <Input
                    id="holderName"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="mt-1.5 bg-white text-midnight font-semibold placeholder:font-normal placeholder:text-[#888]"
                  />
                </div>
                <div>
                  <Label htmlFor="routing">Routing number</Label>
                  <Input
                    id="routing"
                    inputMode="numeric"
                    value={routing}
                    onChange={(e) => setRouting(e.target.value.replace(/\D/g, ""))}
                    className="mt-1.5 bg-white text-midnight font-semibold placeholder:font-normal placeholder:text-[#888]"
                  />
                </div>
                <div>
                  <Label htmlFor="account">Account number</Label>
                  <Input
                    id="account"
                    inputMode="numeric"
                    value={account}
                    onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))}
                    className="mt-1.5 bg-white text-midnight font-semibold placeholder:font-normal placeholder:text-[#888]"
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Account type</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger
                      id="accountType"
                      className="mt-1.5 bg-white text-midnight font-semibold data-[placeholder]:font-normal data-[placeholder]:text-[#888]"
                    >
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#E5E5E5] bg-offwhite px-4 py-3">
                <Lock className="h-4 w-4 mt-0.5 text-midnight" />
                <p className="text-sm text-[hsl(var(--body-text))]">
                  Your banking information is encrypted and stored securely. We use it solely to
                  process your wire transfer.
                </p>
              </div>

              <Button
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="w-full mt-8 bg-midnight text-clarity hover:bg-midnight/90 font-bold"
              >
                Continue
              </Button>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-3xl font-bold text-midnight mb-2">
                How much would you like to deposit?
              </h1>
              <p className="text-[hsl(var(--body-text))] mb-8">
                Minimum deposit is $1,000. There is no maximum.
              </p>

              <div className="my-10">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-semibold text-midnight">$</span>
                  <input
                    inputMode="numeric"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,]/g, ""))}
                    placeholder="1,000"
                    className="w-64 bg-transparent text-center text-4xl font-semibold text-midnight placeholder:font-normal placeholder:text-[#888] focus:outline-none border-b-2 border-[#E5E5E5] focus:border-clarity pb-2"
                  />
                </div>
                <p className="text-center text-sm text-[#888] mt-3">Minimum: $1,000</p>
                {amountError && (
                  <p className="text-center text-sm text-emotive mt-2">{amountError}</p>
                )}
              </div>

              <div className="rounded-lg border border-[#E5E5E5] bg-offwhite p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#888]">Bank</span>
                  <span className="font-medium text-midnight">{bankName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">Account type</span>
                  <span className="font-medium text-midnight capitalize">
                    {accountType || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">Deposit amount</span>
                  <span className="font-medium text-midnight">
                    {amount > 0 ? formatUsd(amount) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">Annual management fee</span>
                  <span className="font-medium text-midnight">
                    2.0% {amount > 0 && `(~${formatUsd(annualFee)} per year)`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setStep(1)}
                className="mt-6 text-sm text-[#888] hover:text-midnight"
              >
                ← Back
              </button>

              <Button
                disabled={!step2Valid}
                onClick={() => setStep(3)}
                className="w-full mt-6 bg-midnight text-clarity hover:bg-midnight/90 font-bold"
              >
                Continue
              </Button>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="text-3xl font-bold text-midnight mb-2">Send your wire transfer.</h1>
              <p className="text-[hsl(var(--body-text))] mb-8">
                Use the details below to initiate your wire transfer from your bank. Your account
                will be activated within 1–3 business days of receiving your funds.
              </p>

              <div className="rounded-[10px] bg-midnight p-6 text-white space-y-3 font-mono text-sm">
                {[
                  { label: "Bank Name", value: PLACEHOLDER_WIRE.bankName },
                  { label: "Routing Number", value: PLACEHOLDER_WIRE.routing },
                  { label: "Account Number", value: PLACEHOLDER_WIRE.account },
                  {
                    label: "Reference",
                    value: `${holderName || "Investor name"} + SNTIMNT deposit`,
                  },
                  { label: "Amount", value: formatUsd(amount) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-white/50 font-sans">
                        {label}
                      </div>
                      <div className="truncate">{value}</div>
                    </div>
                    <button
                      onClick={() => copy(label, value)}
                      className="flex items-center gap-1 text-clarity hover:text-clarity/80 text-xs font-sans"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 rounded-r-lg px-4 py-3 text-sm text-[hsl(var(--body-text))]"
                style={{ background: "#FAEEDA", borderLeft: "4px solid #FFB703" }}
              >
                Always verify wire details directly with your bank before sending. SNTIMNT.AI will
                never ask you to change wire instructions via email or phone.
              </div>

              <p className="mt-6 text-sm text-[hsl(var(--body-text))]">
                Once you've initiated the transfer, you're all set. We'll notify you by email when
                your funds are confirmed and your dashboard is unlocked.
              </p>

              <Button
                onClick={() => navigate("/onboarding/pending-funding")}
                className="w-full mt-8 font-bold text-white hover:opacity-90"
                style={{ background: "hsl(var(--success-brand))" }}
              >
                I've initiated my wire transfer
              </Button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default OnboardingDeposit;
