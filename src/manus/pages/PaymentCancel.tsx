import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import BackNav from "@/manus/components/BackNav";
import { useCheckoutAccessStatus } from "@/manus/hooks/useCheckoutAccessStatus";

export default function PaymentCancel() {
  const navigate = useNavigate();
  // No polling here: nothing is expected to change, but we still read the
  // current entitlement so the message never contradicts the user's real access.
  const { state, copy, accessConfirmed, destination, isChecking, refresh, signedIn } = useCheckoutAccessStatus({
    poll: false,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <BackNav variant="top" />
      <div className="flex items-center justify-center px-4 py-12">
        <Card className="p-8 max-w-md w-full shadow-lg">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />

            <h1 className="text-3xl font-bold mb-2">Payment cancelled</h1>
            <p className="text-gray-600 mb-6">Your payment was cancelled. No charges were made to your account.</p>

            {signedIn && (
              <div className="bg-white/70 border rounded-lg p-4 mb-6 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Current access:</span>
                  <span
                    className={`text-sm font-semibold ${
                      accessConfirmed ? "text-green-600" : state === "pending" ? "text-amber-600" : "text-gray-700"
                    }`}
                  >
                    {copy.label}
                  </span>
                </div>
                {accessConfirmed && (
                  <p className="text-sm text-gray-700 mt-2 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    You already have an active plan — nothing was lost by cancelling this checkout.
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-600 mb-6">
              If you'd like to try again or have any questions, please don't hesitate to contact us.
            </p>

            <div className="space-y-2">
              {accessConfirmed && destination ? (
                <Button onClick={() => navigate(destination)} className="w-full" size="lg">
                  Continue where you left off
                </Button>
              ) : (
                <Button onClick={() => navigate("/plans")} className="w-full" size="lg">
                  Choose a plan
                </Button>
              )}
              {signedIn && (
                <Button onClick={() => void refresh()} variant="outline" className="w-full" disabled={isChecking}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                  {isChecking ? "Checking…" : "Refresh access status"}
                </Button>
              )}
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Return to home
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <BackNav variant="bottom" />
    </div>
  );
}
