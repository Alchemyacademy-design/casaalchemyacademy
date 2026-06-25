import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/manus/hooks/useAuth";
import { getLoginUrl } from "@/manus/const";
import "@/manus/styles/official-render.css";

interface MemberLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const primaryNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/mycourses", icon: BookOpen },
  { label: "Live Workshops", href: "/live-workshops", icon: Calendar },
  { label: "Community", href: "/community", icon: Users },
];

const discoveryNav = [
  { label: "Magazine", href: "/magazine", icon: BookOpen },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Supplier List", href: "/suppliers", icon: Gift },
];

export default function MemberLayout({ children, requireAuth = true }: MemberLayoutProps) {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.assign("/login");
  };

  if (loading) {
    return (
      <div className="aa-member-shell flex min-h-screen items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <Sparkles className="mx-auto mb-4 h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Preparing your academy…</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return (
      <div className="aa-member-shell flex min-h-screen items-center justify-center px-5">
        <div className="aa-panel max-w-md p-8 text-center">
          <Sparkles className="mx-auto mb-5 h-10 w-10 text-accent" />
          <p className="aa-eyebrow">Private learning space</p>
          <h1 className="font-serif text-4xl text-primary">Members only</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
            Sign in to continue your courses, track your progress and access the Alchemy community.
          </p>
          <a href={getLoginUrl()} className="mt-6 inline-flex">
            <Button className="btn-gold">Sign in</Button>
          </a>
        </div>
      </div>
    );
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `aa-member-nav-link ${isActive ? "is-active" : ""}`;

  const renderLinks = (items: typeof primaryNav, closeOnClick = false) =>
    items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.href}
          to={item.href}
          end
          className={navLinkClass}
          onClick={closeOnClick ? () => setMobileOpen(false) : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      );
    });

  return (
    <div className="aa-member-shell">
      <header className="aa-mobile-header lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <img src="/img/logo.png" alt="Alchemy Academy" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="rounded-lg border border-border bg-card p-2.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="member-mobile-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen ? (
        <nav id="member-mobile-menu" className="aa-mobile-menu lg:hidden" aria-label="Member navigation">
          <p className="aa-member-nav-label text-foreground/45">Learn</p>
          {isAdmin ? (
            <NavLink to="/admin" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
              <Shield className="h-4 w-4" />
              <span>Admin Center</span>
            </NavLink>
          ) : null}
          {renderLinks(primaryNav, true)}
          <p className="aa-member-nav-label text-foreground/45">Discover</p>
          {renderLinks(discoveryNav, true)}
          <p className="aa-member-nav-label text-foreground/45">Account</p>
          <NavLink to="/profile" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <Settings className="h-4 w-4" />
            <span>Profile</span>
          </NavLink>
          <button type="button" onClick={handleLogout} className="aa-member-nav-link mt-1 w-full text-left">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </nav>
      ) : null}

      <div className="aa-member-layout">
        <aside className="aa-member-sidebar" aria-label="Member sidebar">
          <div className="aa-member-brand">
            <Link to="/dashboard" className="transition-opacity hover:opacity-80">
              <img src="/img/logo.png" alt="Alchemy Academy" />
            </Link>
          </div>

          <nav className="aa-member-nav" aria-label="Member navigation">
            {isAdmin ? (
              <>
                <p className="aa-member-nav-label">Administration</p>
                <NavLink to="/admin" end className={navLinkClass}>
                  <Shield className="h-4 w-4" />
                  <span>Admin Center</span>
                </NavLink>
              </>
            ) : null}

            <p className="aa-member-nav-label">Learn</p>
            {renderLinks(primaryNav)}
            <p className="aa-member-nav-label">Discover</p>
            {renderLinks(discoveryNav)}
            <p className="aa-member-nav-label">Account</p>
            <NavLink to="/profile" end className={navLinkClass}>
              <Settings className="h-4 w-4" />
              <span>Profile</span>
            </NavLink>
          </nav>

          <div className="aa-member-profile">
            <div className="aa-member-profile-card">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 font-serif text-lg text-sidebar-foreground">
                  {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                    {isAdmin ? "Administrator" : "Member"}
                  </p>
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{user?.name || "Alchemist"}</p>
                  <p className="truncate text-[11px] text-sidebar-foreground/50">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/72 transition hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="aa-member-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
