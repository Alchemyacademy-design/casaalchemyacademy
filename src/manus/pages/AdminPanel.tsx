import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/manus/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Users, BarChart3, Settings } from "lucide-react";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { user, loading, isAdmin, logout } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      setLocation("/");
    }
  }, [user, isAdmin, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground/70">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="container flex items-center justify-between py-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-foreground/70 mt-1">Manage Alchemy Academy</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Users Card */}
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-foreground/70 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-foreground">—</p>
              </div>
              <Users className="w-8 h-8" style={{ color: "var(--aa-gold)" }} />
            </div>
            <p className="text-xs text-foreground/50">Loading...</p>
          </Card>

          {/* Active Memberships Card */}
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-foreground/70 mb-1">Active Memberships</p>
                <p className="text-3xl font-bold text-foreground">—</p>
              </div>
              <BarChart3 className="w-8 h-8" style={{ color: "var(--aa-gold)" }} />
            </div>
            <p className="text-xs text-foreground/50">Loading...</p>
          </Card>

          {/* Revenue Card */}
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-foreground/70 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-foreground">$—</p>
              </div>
              <BarChart3 className="w-8 h-8" style={{ color: "var(--aa-gold)" }} />
            </div>
            <p className="text-xs text-foreground/50">Loading...</p>
          </Card>
        </div>

        {/* Admin Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Users Management */}
          <Card className="p-6 bg-card border-border/50">
            <h2 className="text-xl font-bold mb-4 text-foreground">Users Management</h2>
            <p className="text-foreground/70 mb-6">Manage user accounts, roles, and permissions</p>
            <Button
              disabled
              className="w-full"
              style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
            >
              Coming Soon
            </Button>
          </Card>

          {/* Memberships Management */}
          <Card className="p-6 bg-card border-border/50">
            <h2 className="text-xl font-bold mb-4 text-foreground">Memberships</h2>
            <p className="text-foreground/70 mb-6">View and manage membership plans and subscriptions</p>
            <Button
              disabled
              className="w-full"
              style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
            >
              Coming Soon
            </Button>
          </Card>

          {/* Courses Management */}
          <Card className="p-6 bg-card border-border/50">
            <h2 className="text-xl font-bold mb-4 text-foreground">Courses</h2>
            <p className="text-foreground/70 mb-6">Create, edit, and manage course content</p>
            <Button
              disabled
              className="w-full"
              style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
            >
              Coming Soon
            </Button>
          </Card>

          {/* Payments & Stripe */}
          <Card className="p-6 bg-card border-border/50">
            <h2 className="text-xl font-bold mb-4 text-foreground">Payments</h2>
            <p className="text-foreground/70 mb-6">View payment history and Stripe integration</p>
            <Button
              disabled
              className="w-full"
              style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
            >
              Coming Soon
            </Button>
          </Card>

          {/* Settings */}
          <Card className="p-6 bg-card border-border/50">
            <h2 className="text-xl font-bold mb-4 text-foreground">Settings</h2>
            <p className="text-foreground/70 mb-6">Configure system settings and integrations</p>
            <Button
              disabled
              className="w-full"
              style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
            >
              Coming Soon
            </Button>
          </Card>

          {/* Analytics */}
          <Card className="p-6 bg-card border-border/50">
            <h2 className="text-xl font-bold mb-4 text-foreground">Analytics</h2>
            <p className="text-foreground/70 mb-6">View detailed analytics and reports</p>
            <Button
              disabled
              className="w-full"
              style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
            >
              Coming Soon
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
