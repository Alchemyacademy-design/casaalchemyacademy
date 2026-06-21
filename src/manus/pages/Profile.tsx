import MemberLayout from "@/manus/components/MemberLayout";
import { useAuth } from "@/manus/hooks/useAuth";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Back Button */}
        <Link href="/dashboard">
          <a className="flex items-center gap-2 mb-8 text-sm" style={{ color: "var(--aa-text-mid)" }}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </a>
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Profile Settings
          </h1>
          <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Manage your account information and preferences.
          </p>
        </div>

        <div className="max-w-2xl">
          {/* Profile Information */}
          <div className="p-8 mb-6" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Account Information
            </h2>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={user?.profile?.full_name || user?.name || ""}
                  disabled
                  className="w-full px-4 py-2 text-sm"
                  style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-text-mid)", border: "1px solid var(--aa-cream-dark)" }}
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-4 py-2 text-sm"
                  style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-text-mid)", border: "1px solid var(--aa-cream-dark)" }}
                />
              </div>

              {/* Membership Plan */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Current Plan
                </label>
                <div
                  className="px-4 py-2 text-sm"
                  style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", border: "1px solid var(--aa-cream-dark)", fontWeight: 500 }}
                >
                  {isAdmin ? "Administrator — full access" : (user?.membershipTier || "Free")}
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="p-8 mb-6" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Security
            </h2>

            <div className="space-y-4">
              <button
                onClick={() => setIsEditingPassword(!isEditingPassword)}
                className="w-full px-4 py-3 text-left text-sm"
                style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", border: "1px solid var(--aa-cream-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
              >
                Change Password
              </button>
              {isEditingPassword && (
                <div className="p-4" style={{ backgroundColor: "var(--aa-cream-dark)" }}>
                  <p className="text-xs" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                    Use the secure password reset flow to change your password.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Section */}
          <div className="p-8" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Subscription
            </h2>

            <div className="space-y-4">
              <button
                className="w-full px-4 py-3 text-left text-sm"
                style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", border: "1px solid var(--aa-cream-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
              >
                Cancel Subscription
              </button>
              <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                You can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}

