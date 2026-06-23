import { useAuth } from "@/manus/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, LogOut, LayoutDashboard, BookOpen, Calendar, Tag, Settings, Users, Gift, Shield } from "lucide-react";
import { getLoginUrl } from "@/manus/const";
import { Link, NavLink } from "react-router-dom";
import { useState } from "react";

interface MemberLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function MemberLayout({ children, requireAuth = true }: MemberLayoutProps) {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
      isActive
        ? "bg-accent text-accent-foreground"
        : "text-foreground hover:bg-secondary/50"
    }`;

  const mobileLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
      isActive
        ? "bg-accent text-accent-foreground"
        : "hover:bg-card text-foreground"
    }`;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden border-b border-border/50 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="font-bold text-lg">Alchemy</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 hover:bg-card rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="member-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <nav
            id="member-mobile-menu"
            aria-label="Member navigation"
            className="border-t border-border/50 p-4 space-y-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end
                  className={mobileLinkClasses}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}

            <NavLink
              to="/profile"
              end
              className={mobileLinkClasses}
              onClick={() => setMobileOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Profile
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-card text-foreground transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </nav>
        )}
      </div>

      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 border-r border-border/50 bg-card/50 sticky top-0 h-screen">
          <div className="p-6 border-b border-border/50 flex justify-center relative z-10 bg-card/50">
            <Link to="/" className="hover:opacity-80 transition">
              <img src="/img/logo.png" alt="Alchemy Academy" style={{ height: "100px", width: "auto" }} />
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-2" aria-label="Member navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.href} to={item.href} end className={navLinkClasses}>
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}

            <NavLink to="/profile" end className={navLinkClasses}>
              <Settings className="w-4 h-4" />
              <span className="font-medium">Profile</span>
            </NavLink>
          </nav>

          <div className="p-4 border-t border-border/50 space-y-3">
            <div className="px-4 py-3 rounded-lg bg-secondary/30 border border-secondary/50">
              <p className="text-xs text-foreground/70 font-semibold uppercase mb-1">{isAdmin ? "Admin" : "Member"}</p>
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-foreground/60">{user?.email}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
