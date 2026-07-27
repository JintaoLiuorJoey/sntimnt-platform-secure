import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const OnboardingDeposit = () => (
  <main className="min-h-screen bg-offwhite px-6 py-12 text-[hsl(var(--body-text))]">
    <div className="mx-auto max-w-4xl">
      <BusinessDataUnavailable
        title="Funding setup unavailable"
        description="Bank account collection, funding instructions, and initial deposit requests are disabled until a secure server-side funding workflow is implemented. This application does not currently collect or retain routing numbers, account numbers, or wire instructions."
        capability="Secure funding provider integration and POST /api/me/funding-requests"
      />
    </div>
  </main>
);

export default OnboardingDeposit;
