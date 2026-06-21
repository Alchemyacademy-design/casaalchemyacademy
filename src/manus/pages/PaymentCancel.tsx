import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <Card className="p-8 max-w-md shadow-lg">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          
          <h1 className="text-3xl font-bold mb-2">Payment Cancelled</h1>
          <p className="text-gray-600 mb-6">Your payment was cancelled. No charges were made to your account.</p>

          <p className="text-sm text-gray-600 mb-6">
            If you'd like to try again or have any questions, please don't hesitate to contact us.
          </p>

          <div className="space-y-2">
            <Button onClick={() => navigate("/courses")} className="w-full" size="lg">
              Browse Courses
            </Button>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Return to Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
