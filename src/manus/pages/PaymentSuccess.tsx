import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";
import { useCheckoutAccessStatus } from "@/manus/hooks/useCheckoutAccessStatus";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = !user;
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get("session_id"));
  }, []);

  const {
    state,
    copy,
    accessConfirmed,
    checkoutStatus,
    paymentStatus,
    destination,
    isChecking,
    refresh,
  } = useCheckoutAccessStatus({ sessionId, poll: true });

  const heading = accessConfirmed
    ? "Access released"
    : state === "guest"
      ? "Payment received"
      : state === "none"
        ? "Payment received — access pending"
        : "Payment received";

  const description = accessConfirmed
    ? "Your payment is confirmed and your access is now active."
    : state === "guest"
      ? "Your payment went through. Sign in with the email you used at checkout to unlock your access."
      : state === "none"
        ? "Stripe has your payment, but we have not received the confirmation yet. It can take a couple of minutes — use “Check again” or contact us if it persists."
        : "We are confirming your access with Stripe. This usually finishes in a moment.";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50 px-4 py-12">
      <Card className="p-8 max-w-md w-full shadow-lg">
        <div className="text-center">
          {accessConfirmed ? (
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          )}

          <h1 className="text-3xl font-bold mb-2">{heading}</h1>
          <p className="text-gray-600 mb-6">{description}</p>

          {isGuest && (
            <div
              className="rounded-lg p-4 mb-6 text-left"
              style={{ backgroundColor: "rgba(196,160,90,0.08)", border: "1px solid rgba(196,160,90,0.3)" }}
            >
              <p className="text-sm font-semibold mb-1">Check your email to set your password</p>
              <p className="text-sm text-gray-700">
                We created your Casa Alchemy Academy account with the email you used at checkout and sent you a link to
                set your password. Once you sign in, your access will already be active.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => navigate("/login")} size="sm" variant="outline">Go to sign in</Button>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Checkout:</span>
                <span className="font-semibold capitalize">{checkoutStatus ?? "pending"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment:</span>
                <span className="font-semibold capitalize">{paymentStatus ?? "pending"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Access:</span>
                <span className={accessConfirmed ? "font-semibold text-green-600" : "font-semibold text-amber-600"}>
                  {copy.label}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            This page does not grant access directly. Access is released only after Stripe confirms the payment.
          </p>

          <div className="space-y-2">
            <Button
              onClick={() => destination && navigate(destination)}
              className="w-full"
              size="lg"
              disabled={!destination}
            >
              {!destination
                ? "Confirming your access…"
                : destination === "/dashboard"
                  ? "Go to Dashboard"
                  : destination === "/mycourses"
                    ? "Access your courses"
                    : "Choose a plan"}
            </Button>
            <Button onClick={() => void refresh()} variant="outline" className="w-full" disabled={isChecking}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Checking…" : "Check again"}
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Return to home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
