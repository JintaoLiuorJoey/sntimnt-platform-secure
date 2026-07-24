import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AgreementModal from "@/components/AgreementModal";

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[10px] border border-[#E5E5E5] bg-white p-6 ${className}`}>{children}</div>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-base font-bold text-midnight border-b border-[#E5E5E5] pb-3 mb-5">
    {children}
  </h2>
);

const SaveButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <Button
    onClick={onClick}
    className="bg-midnight text-clarity hover:bg-midnight/90 font-bold"
  >
    {children}
  </Button>
);

const fieldLabel = "text-xs font-semibold text-[#666] uppercase tracking-wide";

type NotifKey =
  | "trades"
  | "regime"
  | "weekly"
  | "deposits"
  | "withdrawals"
  | "account";

type BankingForm = "bank" | "deposit" | "recurring" | "withdrawal" | null;

const Profile = () => {
  // Personal info
  const [fullName, setFullName] = useState("Demo Administrator");
  const [email, setEmail] = useState("admin@example.invalid");
  const [phone, setPhone] = useState("+1 (407) 000-0000");
  const [personalSaved, setPersonalSaved] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>({
    trades: true,
    regime: true,
    weekly: true,
    deposits: true,
    withdrawals: true,
    account: true,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  // Security
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  // Banking
  const [activeBankingForm, setActiveBankingForm] = useState<BankingForm>(null);
  const openBankingForm = (form: Exclude<BankingForm, null>) => {
    setShowClosureForm(false);
    setShowPwForm(false);
    setActiveBankingForm((prev) => (prev === form ? null : form));
  };
  const closeBankingForm = () => setActiveBankingForm(null);

  // Bank update form
  const [bankStep, setBankStep] = useState<1 | 2 | 3>(1);
  const [bankPw, setBankPw] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [routingNum, setRoutingNum] = useState("");
  const [accountNum, setAccountNum] = useState("");
  const [accountType, setAccountType] = useState("checking");

  // Deposit form
  const [depositAmount, setDepositAmount] = useState("");

  // Agreement modal
  const [agreementOpen, setAgreementOpen] = useState(false);

  // Recurring form
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringFreq, setRecurringFreq] = useState("monthly");
  const [recurringStart, setRecurringStart] = useState("");

  // Withdrawal form
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  // Account closure
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [showTenureWarning, setShowTenureWarning] = useState(false);
  const [closureReason, setClosureReason] = useState("");
  const [closureSubmitted, setClosureSubmitted] = useState(false);
  const [showClosureOverlay, setShowClosureOverlay] = useState(false);
  // Early closure request (under 12 months)
  const [showEarlyForm, setShowEarlyForm] = useState(false);
  const [earlyReason, setEarlyReason] = useState("");
  const [earlySubmitted, setEarlySubmitted] = useState(false);
  const navigate = useNavigate();

  // Placeholder join date — April 2026
  const joinDate = new Date(2026, 3, 1);
  const monthsActive = Math.max(
    0,
    Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
  );
  const isUnder12Months = monthsActive < 12;

  const openClosureForm = () => {
    setActiveBankingForm(null);
    setShowPwForm(false);
    if (isUnder12Months) {
      setShowTenureWarning(true);
      setShowClosureForm(false);
    } else {
      setShowTenureWarning(false);
      setShowClosureForm(true);
    }
  };
  const handleSendEarlyRequest = () => {
    if (!earlyReason.trim()) return;
    // Placeholder — Resend email to info@sntimnt.ai will be wired by Yuheng
    setShowEarlyForm(false);
    setEarlyReason("");
    setEarlySubmitted(true);
  };
  const handleConfirmClosure = () => {
    setShowClosureForm(false);
    setClosureReason("");
    setShowClosureOverlay(true);
  };

  useEffect(() => {
    if (!showClosureOverlay) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem("closureBanner", "1");
      } catch {
        // Continue logout flow even when sessionStorage is unavailable.
      }
      navigate("/login");
    }, 3000);
    return () => clearTimeout(t);
  }, [showClosureOverlay, navigate]);

  const scrollToBanking = () => {
    document
      .getElementById("banking-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  const resetBankForm = () => {
    setBankStep(1);
    setBankPw("");
    setBankCode("");
    setRoutingNum("");
    setAccountNum("");
    setAccountType("checking");
  };

  const flash = (setter: (b: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 2500);
  };

  const handlePersonalSave = () => flash(setPersonalSaved);
  const handleNotifSave = () => flash(setNotifSaved);

  const handlePwSave = () => {
    flash(setPwSaved);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setShowPwForm(false);
  };

  const notifList: { key: NotifKey; label: string; subtext: string }[] = [
    {
      key: "trades",
      label: "Trade Executions",
      subtext: "Get notified when the algorithm executes a buy or sell",
    },
    {
      key: "regime",
      label: "Regime Changes",
      subtext: "Get notified when the model detects a market regime shift",
    },
    {
      key: "weekly",
      label: "Weekly Performance Summary",
      subtext: "Receive a weekly summary of your portfolio performance every Friday",
    },
    {
      key: "deposits",
      label: "Deposit Confirmations",
      subtext: "Get notified when a deposit is received and your account is updated",
    },
    {
      key: "withdrawals",
      label: "Withdrawal Updates",
      subtext: "Get notified when a withdrawal request is initiated and completed",
    },
    {
      key: "account",
      label: "Account Alerts",
      subtext: "Security and account activity notifications",
    },
  ];

  const StatusPill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(var(--success-brand))] text-white">
      {children}
    </span>
  );

  const InfoRow = ({
    label,
    subtext,
    right,
  }: {
    label: string;
    subtext?: string;
    right: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-4 border-b border-[#E5E5E5] last:border-b-0">
      <div>
        <div className="text-sm font-semibold text-midnight">{label}</div>
        {subtext && <div className="text-xs text-[#888] mt-0.5">{subtext}</div>}
      </div>
      <div>{right}</div>
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-midnight">Profile Settings</h1>
        </div>

        {/* SECTION 1 — Personal Information */}
        <Card>
          <SectionHeading>Personal Information</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className={fieldLabel}>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 bg-white text-midnight"
              />
            </div>
            <div>
              <Label className={fieldLabel}>Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-white text-midnight"
              />
            </div>
            <div>
              <Label className={fieldLabel}>Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 bg-white text-midnight"
              />
            </div>
            <div>
              <Label className={fieldLabel}>Member Since</Label>
              <Input
                value="April 2026"
                readOnly
                className="mt-1.5 bg-offwhite text-[#666] cursor-not-allowed"
              />
            </div>
          </div>
          <div className="flex flex-col items-end mt-6 gap-2">
            <SaveButton onClick={handlePersonalSave}>Save Changes</SaveButton>
            {personalSaved && (
              <span className="text-xs font-semibold text-[hsl(var(--success-brand))]">
                Changes saved.
              </span>
            )}
          </div>
        </Card>

        {/* SECTION 2 — Notification Preferences */}
        <Card>
          <SectionHeading>Notification Preferences</SectionHeading>
          <p className="text-xs text-[#888] -mt-3 mb-4">
            Choose which updates you receive by email.
          </p>
          <div>
            {notifList.map((n) => (
              <div
                key={n.key}
                className="flex items-center justify-between py-4 border-b border-[#E5E5E5] last:border-b-0"
              >
                <div className="pr-6">
                  <div className="text-sm font-semibold text-midnight">{n.label}</div>
                  <div className="text-xs text-[#888] mt-0.5">{n.subtext}</div>
                </div>
                <Switch
                  checked={notifs[n.key]}
                  onCheckedChange={(v) =>
                    setNotifs((prev) => ({ ...prev, [n.key]: v }))
                  }
                  className="data-[state=checked]:bg-clarity data-[state=unchecked]:bg-[#CCCCCC]"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col items-end mt-6 gap-2">
            <SaveButton onClick={handleNotifSave}>Save Preferences</SaveButton>
            {notifSaved && (
              <span className="text-xs font-semibold text-[hsl(var(--success-brand))]">
                Preferences saved.
              </span>
            )}
          </div>
        </Card>

        {/* SECTION 3 — Banking and Deposits */}
        <div id="banking-section" />
        <Card>
          <SectionHeading>Banking and Deposits</SectionHeading>


          {/* Bank on File */}
          <InfoRow
            label="Bank on File"
            subtext="Chase Bank ···· 0000"
            right={
              <Button
                variant="outline"
                onClick={() => {
                  resetBankForm();
                  openBankingForm("bank");
                }}
                className="border-[#E5E5E5] bg-white text-midnight hover:bg-offwhite hover:text-midnight"
              >
                Update Banking Info
              </Button>
            }
          />
          {activeBankingForm === "bank" && (
            <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 my-3 space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        bankStep === s
                          ? "bg-midnight text-clarity"
                          : bankStep > s
                          ? "bg-[hsl(var(--success-brand))] text-white"
                          : "bg-[#E5E5E5] text-[#888]"
                      }`}
                    >
                      {s}
                    </div>
                    {s < 3 && <div className="w-8 h-px bg-[#E5E5E5]" />}
                  </div>
                ))}
                <span className="ml-2 text-xs font-semibold text-[#666]">
                  Step {bankStep} of 3
                </span>
              </div>

              {bankStep === 1 && (
                <div>
                  <Label className={fieldLabel}>Current Password</Label>
                  <Input
                    type="password"
                    value={bankPw}
                    onChange={(e) => setBankPw(e.target.value)}
                    className="mt-1.5 bg-white"
                  />
                </div>
              )}

              {bankStep === 2 && (
                <div>
                  <Label className={fieldLabel}>Email Verification Code</Label>
                  <Input
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="mt-1.5 bg-white"
                  />
                  <p className="text-xs text-[#888] mt-1.5">
                    We sent a code to admin@example.invalid.
                  </p>
                </div>
              )}

              {bankStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label className={fieldLabel}>Routing Number</Label>
                    <Input
                      value={routingNum}
                      onChange={(e) => setRoutingNum(e.target.value)}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label className={fieldLabel}>Account Number</Label>
                    <Input
                      value={accountNum}
                      onChange={(e) => setAccountNum(e.target.value)}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label className={fieldLabel}>Account Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger className="mt-1.5 bg-white text-midnight">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-4 pt-1">
                <button
                  onClick={() => {
                    closeBankingForm();
                    resetBankForm();
                  }}
                  className="text-xs font-semibold text-[#666] hover:text-midnight"
                >
                  Cancel
                </button>
                {bankStep < 3 ? (
                  <SaveButton
                    onClick={() => setBankStep(((bankStep + 1) as 1 | 2 | 3))}
                  >
                    Continue
                  </SaveButton>
                ) : (
                  <SaveButton
                    onClick={() => {
                      closeBankingForm();
                      resetBankForm();
                    }}
                  >
                    Save Banking Info
                  </SaveButton>
                )}
              </div>
            </div>
          )}

          {/* Make a Deposit */}
          <InfoRow
            label="Make a Deposit"
            subtext="Minimum $1,000 per deposit"
            right={
              <SaveButton onClick={() => openBankingForm("deposit")}>
                Deposit Funds
              </SaveButton>
            }
          />
          {activeBankingForm === "deposit" && (
            <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 my-3 space-y-4">
              <div>
                <Label className={fieldLabel}>Deposit Amount</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#666]">
                    $
                  </span>
                  <Input
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="1,000"
                    className="bg-white pl-7"
                  />
                </div>
                <p className="text-xs text-[#888] mt-1.5">
                  Funds will be wired to your account on file.
                </p>
              </div>
              <div className="flex items-center justify-end gap-4 pt-1">
                <button
                  onClick={() => {
                    closeBankingForm();
                    setDepositAmount("");
                  }}
                  className="text-xs font-semibold text-[#666] hover:text-midnight"
                >
                  Cancel
                </button>
                <Button
                  onClick={() => {
                    closeBankingForm();
                    setDepositAmount("");
                  }}
                  className="bg-[hsl(var(--success-brand))] text-white hover:bg-[hsl(var(--success-brand))]/90 font-bold"
                >
                  Submit Deposit Request
                </Button>
              </div>
            </div>
          )}

          {/* Recurring Deposits */}
          <InfoRow
            label="Recurring Deposits"
            subtext="No recurring deposit set up"
            right={
              <Button
                variant="outline"
                onClick={() => openBankingForm("recurring")}
                className="border-[#E5E5E5] bg-white text-midnight hover:bg-offwhite hover:text-midnight"
              >
                Set Up Recurring
              </Button>
            }
          />
          {activeBankingForm === "recurring" && (
            <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 my-3 space-y-4">
              <div>
                <Label className={fieldLabel}>Amount</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#666]">
                    $
                  </span>
                  <Input
                    value={recurringAmount}
                    onChange={(e) => setRecurringAmount(e.target.value)}
                    placeholder="1,000"
                    className="bg-white pl-7"
                  />
                </div>
              </div>
              <div>
                <Label className={fieldLabel}>Frequency</Label>
                <Select value={recurringFreq} onValueChange={setRecurringFreq}>
                  <SelectTrigger className="mt-1.5 bg-white text-midnight">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={fieldLabel}>Start Date</Label>
                <Input
                  type="date"
                  value={recurringStart}
                  onChange={(e) => setRecurringStart(e.target.value)}
                  className="mt-1.5 bg-white text-midnight"
                />
              </div>
              <div className="flex items-center justify-end gap-4 pt-1">
                <button
                  onClick={() => {
                    closeBankingForm();
                    setRecurringAmount("");
                    setRecurringStart("");
                  }}
                  className="text-xs font-semibold text-[#666] hover:text-midnight"
                >
                  Cancel
                </button>
                <SaveButton
                  onClick={() => {
                    closeBankingForm();
                    setRecurringAmount("");
                    setRecurringStart("");
                  }}
                >
                  Save Recurring
                </SaveButton>
              </div>
            </div>
          )}

          {/* Withdrawals */}
          <InfoRow
            label="Request Withdrawal"
            subtext="Withdrawals are processed within 3–5 business days"
            right={
              <Button
                variant="outline"
                onClick={() => openBankingForm("withdrawal")}
                className="border-emotive bg-white text-emotive hover:bg-emotive/5 hover:text-emotive"
              >
                Request Withdrawal
              </Button>
            }
          />
          {activeBankingForm === "withdrawal" && (
            <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 my-3 space-y-4">
              <div>
                <Label className={fieldLabel}>Withdrawal Amount</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#666]">
                    $
                  </span>
                  <Input
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-white pl-7"
                  />
                </div>
                <p className="text-xs text-[#888] mt-1.5">
                  Funds will be returned to your bank on file.
                </p>
              </div>
              <div className="flex items-center justify-end gap-4 pt-1">
                <button
                  onClick={() => {
                    closeBankingForm();
                    setWithdrawalAmount("");
                  }}
                  className="text-xs font-semibold text-[#666] hover:text-midnight"
                >
                  Cancel
                </button>
                <Button
                  onClick={() => {
                    closeBankingForm();
                    setWithdrawalAmount("");
                  }}
                  className="bg-emotive text-white hover:bg-emotive/90 font-bold"
                >
                  Submit Withdrawal Request
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 4 — Security */}
        <Card>
          <SectionHeading>Security</SectionHeading>

          <InfoRow
            label="Password"
            subtext="Last changed: Never"
            right={
              <Button
                variant="outline"
                onClick={() => {
                  setActiveBankingForm(null);
                  setShowClosureForm(false);
                  setShowPwForm((s) => !s);
                }}
                className="border-[#E5E5E5] bg-white text-midnight hover:bg-offwhite hover:text-midnight"
              >
                Change Password
              </Button>
            }
          />

          {showPwForm && (
            <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 my-3 space-y-4">
              <div>
                <Label className={fieldLabel}>Current Password</Label>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className={fieldLabel}>New Password</Label>
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className={fieldLabel}>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="mt-1.5 bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-4 pt-1">
                <button
                  onClick={() => setShowPwForm(false)}
                  className="text-xs font-semibold text-[#666] hover:text-midnight"
                >
                  Cancel
                </button>
                <SaveButton onClick={handlePwSave}>Save Password</SaveButton>
              </div>
            </div>
          )}

          {pwSaved && (
            <div className="text-xs font-semibold text-[hsl(var(--success-brand))] my-2 text-right">
              Password updated.
            </div>
          )}

          <InfoRow
            label="Two-Factor Authentication"
            subtext="Not enabled"
            right={
              <Button variant="outline" className="border-[#E5E5E5] bg-white text-midnight hover:bg-offwhite hover:text-midnight">
                Enable
              </Button>
            }
          />

          <InfoRow
            label="Active Sessions"
            subtext="1 active session"
            right={
              <Button
                variant="outline"
                className="border-[#E5E5E5] bg-white text-emotive hover:bg-emotive/5 hover:text-emotive"
              >
                Sign Out All Devices
              </Button>
            }
          />
        </Card>

        {/* SECTION 4 — Account */}
        <Card>
          <SectionHeading>Account</SectionHeading>

          <InfoRow label="Account Status" right={<StatusPill>Active</StatusPill>} />
          <InfoRow
            label="Accredited Investor Status"
            right={<StatusPill>Verified</StatusPill>}
          />
          <InfoRow
            label="Investment Agreement"
            right={
              <button
                type="button"
                onClick={() => setAgreementOpen(true)}
                className="text-sm font-semibold text-clarity hover:underline"
              >
                View Agreement
              </button>
            }
          />
          <InfoRow
            label="Minimum Deposit"
            right={<span className="text-sm text-[#666]">$1,000</span>}
          />
          <InfoRow
            label="Management Fee"
            right={<span className="text-sm text-[#666]">2.0% annually</span>}
          />
          <InfoRow
            label="Performance Fee"
            right={
              <span className="text-sm text-[#666]">
                20% of net profits, assessed quarterly subject to high-water mark
              </span>
            }
          />

          {/* Closure success message */}
          {closureSubmitted && (
            <div className="mt-5 text-xs text-[#888]">
              Your closure request has been received. Our team will be in touch within 1–2 business days.
            </div>
          )}

          {/* Danger zone */}
          <div className="mt-5 pt-5 border-t border-[#E5E5E5]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-midnight">Close Account</div>
                <div className="text-xs text-[#888] mt-1">
                  Closing your account will initiate the offboarding process. This cannot be undone.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={openClosureForm}
                className="border-emotive bg-white text-emotive hover:bg-emotive/5 hover:text-emotive"
              >
                Request Account Closure
              </Button>
            </div>

            {earlySubmitted && (
              <div className="mt-4 text-sm font-semibold text-clarity">
                Your request has been sent. We'll review your circumstances and get back to you within 1–2 business days.
              </div>
            )}

            {showTenureWarning && (
              <>
                <div
                  className="mt-4 p-4 border-l-4"
                  style={{
                    background: "#FAEEDA",
                    borderLeftColor: "#FFB703",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  <div className="text-sm font-bold text-midnight">Early account closure</div>
                  <p className="text-sm text-[#3A3A3A] mt-2">
                    Your account has been active for {monthsActive} {monthsActive === 1 ? "month" : "months"}. Per your Investment Management Agreement, a minimum commitment of 12 months is required. Early closure may be subject to additional terms. Please contact us at info@sntimnt.ai to discuss your options before submitting a request.
                  </p>
                  <div className="flex items-center gap-5 mt-3">
                    <a
                      href="mailto:info@sntimnt.ai"
                      className="text-sm font-semibold text-clarity hover:underline"
                    >
                      Contact Us
                    </a>
                    <Button
                      variant="outline"
                      onClick={() => setShowEarlyForm(true)}
                      className="border-clarity bg-white text-clarity hover:bg-clarity/5 hover:text-clarity"
                    >
                      Submit Early Closure Request
                    </Button>
                  </div>
                </div>

                {showEarlyForm && (
                  <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 mt-3 space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-midnight">
                        Reason for early closure request
                      </Label>
                      <Textarea
                        value={earlyReason}
                        onChange={(e) => setEarlyReason(e.target.value)}
                        placeholder="Please describe your circumstances. Our team will review your request and respond within 1–2 business days."
                        required
                        className="mt-1.5 bg-white"
                      />
                      <p className="text-xs text-[#888] mt-1.5">
                        Per your Investment Management Agreement, early account closure outside of qualifying exceptions is subject to a 2% early redemption fee on your account balance at the time of closure.
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEarlyForm(false);
                          setEarlyReason("");
                        }}
                        className="text-xs font-semibold text-[#666] hover:text-midnight"
                      >
                        Cancel
                      </button>
                      <Button
                        onClick={handleSendEarlyRequest}
                        disabled={!earlyReason.trim()}
                        className="bg-midnight text-clarity hover:bg-midnight/90 font-bold disabled:opacity-50"
                      >
                        Send Request
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {showClosureForm && (
              <div className="bg-offwhite border border-[#E5E5E5] rounded-md p-5 mt-4 space-y-4">
                <p className="text-sm text-emotive">
                  Closing your account will initiate the offboarding process. Your remaining balance will be returned to your bank on file within 30 days, net of applicable fees. This action cannot be undone.
                </p>

                <div>
                  <div className="text-xs font-bold text-midnight">
                    Your remaining balance will be returned to:
                  </div>
                  <div
                    className="mt-2 rounded-lg border"
                    style={{
                      background: "#F7F8FA",
                      borderColor: "#E5E5E5",
                      padding: "12px 16px",
                    }}
                  >
                    <div className="text-sm font-semibold text-midnight">Chase Bank</div>
                    <div className="text-sm text-[#3A3A3A] mt-0.5">Checking ···· 0000</div>
                  </div>
                  <p className="text-[11px] text-[#888] mt-1.5">
                    If this is not correct, please update your banking information in the{" "}
                    <button
                      type="button"
                      onClick={scrollToBanking}
                      className="text-clarity hover:underline"
                    >
                      Banking and Deposits
                    </button>{" "}
                    section before closing your account.
                  </p>
                </div>

                <div>
                  <Label className={fieldLabel}>Reason for closing (optional)</Label>
                  <Textarea
                    value={closureReason}
                    onChange={(e) => setClosureReason(e.target.value)}
                    placeholder="Let us know why you're leaving..."
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div className="flex items-center justify-end gap-4 pt-1">
                  <button
                    onClick={() => {
                      setShowClosureForm(false);
                      setClosureReason("");
                    }}
                    className="text-xs font-semibold text-[#666] hover:text-midnight"
                  >
                    Keep My Account
                  </button>
                  <Button
                    onClick={handleConfirmClosure}
                    className="bg-emotive text-white hover:bg-emotive/90 font-bold"
                  >
                    Confirm Account Closure Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      <AgreementModal open={agreementOpen} onClose={() => setAgreementOpen(false)} />

      {showClosureOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(13,27,42,0.95)" }}
        >
          <div
            className="w-full text-center"
            style={{
              background: "rgba(13,27,42,1)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "40px",
              maxWidth: "480px",
            }}
          >
            <div className="font-wordmark text-clarity text-2xl mb-6">SNTIMNT.AI</div>
            <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>
              Your request has been received.
            </h2>
            <p className="text-white/70 text-sm mt-3 leading-relaxed">
              We'll be in touch within 1–2 business days to complete the process. A confirmation email is on its way to you now.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Profile;
