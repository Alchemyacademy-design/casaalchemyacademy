import { useAuth } from "@/manus/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, LogOut, LayoutDashboard, BookOpen, Calendar, Tag, Settings, Users, Gift, Shield } from "lucide-react";
import { getLoginUrl } from "@/manus/const";
import { Link, useLocation } from "wouter";
import { useState } from "react";

interface MemberLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function MemberLayout({ children, requireAuth = true }: MemberLayoutProps) {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const handleLogout = async () => {
    await logout();
    window.location.assign("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-accent mx-auto mb-4 animate-spin" />
          <p className="text-foreground/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Members Only</h2>
          <p className="text-foreground/70 mb-6">Sign in to access this area</p>
          <a href={getLoginUrl()}>
            <Button className="btn-gold">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  const navItems = [
    ...(isAdmin ? [{ label: "Admin Center", href: "/admin", icon: Shield }] : []),
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Courses", href: "/mycourses", icon: BookOpen },
    { label: "Live Workshops", href: "/live-workshops", icon: Calendar },
    { label: "Community", href: "/community", icon: Users },
    { label: "Magazine", href: "/magazine", icon: BookOpen },
    { label: "Events", href: "/events", icon: Calendar },
    { label: "Supplier List", href: "/suppliers", icon: Gift },
  ];

  const isActive = (href: string) => location === href;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <a href="/" className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="font-bold text-lg">Alchemy</span>
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 hover:bg-card rounded-lg transition"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="border-t border-border/50 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-card text-foreground"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              );
            })}

            <a
              href="/profile"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                isActive("/profile")
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-card text-foreground"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Profile
            </a>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-card text-foreground transition text-left"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-border/50 bg-card/50 sticky top-0 h-screen">
          <div className="p-6 border-b border-border/50 flex justify-center relative z-10 bg-card/50">
            <a href="/" className="hover:opacity-80 transition">
              <img src="/img/logo.png" alt="Alchemy Academy" style={{ height: "100px", width: "auto" }} />
            </a>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </a>
              );
            })}

            <a
              href="/profile"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive("/profile")
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-secondary/50"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium">Profile</span>
            </a>
          </nav>

          <div className="p-4 border-t border-border/50 space-y-3">
            <div className="px-4 py-3 rounded-lg bg-secondary/30 border border-secondary/50">
              <p className="text-xs text-foreground/70 font-semibold uppercase mb-1">{isAdmin ? "Admin" : "Member"}</p>
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-foreground/60">{user?.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition text-foreground"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

