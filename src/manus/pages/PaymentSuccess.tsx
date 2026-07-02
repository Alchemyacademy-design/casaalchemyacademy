import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/manus/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { isMember, isAdmin, activeEntitlements, refresh } = useAuth();
  const destination = isAdmin || isMember ? "/dashboard" : activeEntitlements.length > 0 ? "/mycourses" : "/plans";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get("session_id"));
  }, []);

  const [attempts, setAttempts] = useState(0);
  const { data: status, isLoading, refetch: refresh } = trpc.stripe.getPaymentStatus.useQuery(
    { sessionId: sessionId || undefined },
    {
      enabled: !!sessionId,
      refetchInterval: (query) => {
        if (query.state.data?.accessConfirmed) return false;
        // Cap polling at ~2 minutes (40 x 3s) to avoid runaway requests.
        return attempts < 40 ? 3000 : false;
      },
    }
  );
  useEffect(() => {
    if (!isLoading) setAttempts((n) => n + 1);
  }, [isLoading]);

  // When Stripe confirms, refresh auth entitlements so the destination CTA reflects
  // the newly granted access immediately.
  useEffect(() => {
    if (status?.accessConfirmed) { void refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.accessConfirmed]);

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Thank you for your payment</h1>
            <p className="text-gray-600 mb-6">
              Your Stripe checkout completed. Access will be released automatically as soon as the webhook confirms your payment.
            </p>
            <div className="space-y-2">
              <Button onClick={() => navigate(destination)} className="w-full">Continue</Button>
              <Button onClick={() => navigate("/plans")} variant="outline" className="w-full">View plans</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p>Confirming your access...</p>
        </div>
      </div>
    );
  }

  const accessConfirmed = Boolean(status?.accessConfirmed);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Card className="p-8 max-w-md shadow-lg">
        <div className="text-center">
          {accessConfirmed ? (
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : (
            <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          )}

          <h1 className="text-3xl font-bold mb-2">
            {accessConfirmed ? "Access Confirmed" : "Payment Received"}
          </h1>
          <p className="text-gray-600 mb-6">
            {accessConfirmed
              ? "Your access has been confirmed by Stripe and Supabase."
              : "We are confirming your access. This usually finishes in a moment."}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Checkout:</span>
                <span className="font-semibold capitalize">{status?.checkoutSession?.status ?? "pending"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment:</span>
                <span className="font-semibold capitalize">{status?.checkoutSession?.payment_status ?? "pending"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Access:</span>
                <span className={accessConfirmed ? "font-semibold text-green-600" : "font-semibold text-amber-600"}>
                  {accessConfirmed ? "confirmed" : "processing"}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            This page does not grant access directly. Access is released only after the Stripe webhook confirms a paid invoice.
          </p>

          <div className="space-y-2">
            <Button onClick={() => navigate(destination)} className="w-full" size="lg" disabled={!accessConfirmed}>
              {accessConfirmed ? (destination === "/dashboard" ? "Go to Dashboard" : destination === "/mycourses" ? "Access Your Courses" : "Choose a Plan") : "Waiting for confirmation…"}
            </Button>
            <Button onClick={() => refresh()} variant="outline" className="w-full">Check again</Button>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Return to Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

