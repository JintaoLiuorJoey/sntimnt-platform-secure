import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const PendingFunding = () => {
  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardContent className="p-10 text-center">
          <div className="font-wordmark text-2xl text-clarity mb-2">SNTIMNT.AI</div>
          <div className="h-px bg-clarity w-16 mx-auto mb-8" />

          <div className="flex justify-center mb-6">
            <div className="h-14 w-14 rounded-full bg-clarity/10 flex items-center justify-center">
              <Hourglass className="h-7 w-7 text-clarity" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-midnight mb-3">
            We're waiting for your wire.
          </h1>
          <p className="text-[hsl(var(--body-text))] mb-8">
            Once your funds arrive, we'll confirm by email and unlock your dashboard. This usually
            takes 1–3 business days.
          </p>

          <Link to="/login" className="text-sm text-clarity hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingFunding;
