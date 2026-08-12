import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Award, BookOpen, Calendar, ChevronLeft, ChevronRight, Gift, LayoutDashboard, LogOut, Menu, Paperclip, Settings, Shield, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/manus/hooks/useAuth";
import { getLoginUrl } from "@/manus/const";
import AdminPreviewBar from "@/manus/components/admin/AdminPreviewBar";
import NotificationsBell from "@/manus/components/NotificationsBell";
import UserAvatar from "@/manus/components/UserAvatar";
import BackNav from "@/manus/components/BackNav";
import { useMyProfile } from "@/manus/hooks/usePublicContent";
import "@/manus/styles/official-render.css";

interface MemberLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

type NavItem = { label: string; href: string; icon: typeof BookOpen };

const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Courses", href: "/mycourses", icon: BookOpen },
  { label: "Master Guides", href: "/materials", icon: Paperclip },
  { label: "Certificates", href: "/certificates", icon: Award },
  { label: "Expert Masterclasses", href: "/live-workshops", icon: Calendar },
  { label: "Community", href: "/community", icon: Users },
];

const discoveryNav: NavItem[] = [
  { label: "The Reading Room", href: "/magazine", icon: BookOpen },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "Supplier List", href: "/suppliers", icon: Gift },
  { label: "Exclusive Deals", href: "/deals", icon: Sparkles },
];

export default function MemberLayout({ children, requireAuth = true }: MemberLayoutProps) {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("member:sidebar:collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("member:sidebar:collapsed", sidebarCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [sidebarCollapsed]);
  const { data: myProfile } = useMyProfile(user?.id);
  const displayName = myProfile?.display_name || myProfile?.full_name || user?.name || user?.email || "Alchemist";
  const avatarPath = myProfile?.avatar_path ?? null;

  const handleLogout = async () => {
    await logout();
    window.location.assign("/login");
  };

  if (loading) {
    return (
      <div className="aa-member-shell flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
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
          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">Sign in to continue your courses, track progress and access the Alchemy community.</p>
          <a href={getLoginUrl()} className="mt-6 inline-flex"><Button className="btn-gold">Sign in</Button></a>
        </div>
      </div>
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `aa-member-nav-link ${isActive ? "is-active bg-accent" : ""}`;

  const links = (items: NavItem[], mobile = false) =>
    items.map(({ label, href, icon: Icon }) => (
      mobile || !sidebarCollapsed ? (
        <NavLink key={href} to={href} end className={navClass} onClick={mobile ? () => setMobileOpen(false) : undefined}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ) : (
        <Tooltip key={href}>
          <TooltipTrigger asChild>
            <NavLink to={href} end className={navClass} aria-label={label}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">{label}</span>
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      )
    ));

  return (
    <div className="aa-member-shell">
      <AdminPreviewBar />
      <header className="aa-mobile-header lg:hidden">
        <Link to="/dashboard" onClick={() => setMobileOpen(false)}><img src="/img/logo.png" alt="Alchemy Academy" /></Link>
        <div className="flex items-center gap-2">
          {isAuthenticated ? <NotificationsBell /> : null}
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
        </div>
      </header>

      {mobileOpen && (
        <nav id="member-mobile-menu" className="aa-mobile-menu lg:hidden" aria-label="Member navigation">
          <p className="aa-member-nav-label text-foreground/45">Learn</p>
          {isAdmin && <NavLink to="/admin" end className={navClass} onClick={() => setMobileOpen(false)}><Shield className="h-4 w-4" /><span>Admin Center</span></NavLink>}
          {links(primaryNav, true)}
          <p className="aa-member-nav-label text-foreground/45">Discover</p>
          {links(discoveryNav, true)}
          <p className="aa-member-nav-label text-foreground/45">Account</p>
          <NavLink to="/profile" end className={navClass} onClick={() => setMobileOpen(false)}><Settings className="h-4 w-4" /><span>Profile</span></NavLink>
          <button type="button" onClick={handleLogout} className="aa-member-nav-link mt-1 w-full text-left"><LogOut className="h-4 w-4" /><span>Sign out</span></button>
        </nav>
      )}

      <div className="aa-member-layout">
        <aside className={`aa-member-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="Member sidebar">
          <div className="aa-member-brand"><Link to="/dashboard"><img src="/img/logo.png" alt="Alchemy Academy" /></Link></div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="aa-member-collapse-btn"
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <nav className="aa-member-nav" aria-label="Member navigation">
            {isAdmin && <>
              {!sidebarCollapsed && <p className="aa-member-nav-label">Administration</p>}
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink to="/admin" end className={navClass} aria-label="Admin Center"><Shield className="h-4 w-4" /><span className="sr-only">Admin Center</span></NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">Admin Center</TooltipContent>
                </Tooltip>
              ) : (
                <NavLink to="/admin" end className={navClass}><Shield className="h-4 w-4" /><span>Admin Center</span></NavLink>
              )}
            </>}
            {!sidebarCollapsed && <p className="aa-member-nav-label">Learn</p>}
            {links(primaryNav)}
            {!sidebarCollapsed && <p className="aa-member-nav-label">Discover</p>}
            {links(discoveryNav)}
            {!sidebarCollapsed && <p className="aa-member-nav-label">Account</p>}
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink to="/profile" end className={navClass} aria-label="Profile"><Settings className="h-4 w-4" /><span className="sr-only">Profile</span></NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">Profile</TooltipContent>
              </Tooltip>
            ) : (
              <NavLink to="/profile" end className={navClass}><Settings className="h-4 w-4" /><span>Profile</span></NavLink>
            )}
          </nav>
          {!sidebarCollapsed && <div className="aa-member-profile">
            <div className="aa-member-profile-card">
              <div className="mb-3 flex items-center gap-3">
                <UserAvatar name={displayName} avatarPath={avatarPath} size="sm" />
                <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{isAdmin ? "Administrator" : "Member"}</p><p className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</p><p className="truncate text-[11px] text-sidebar-foreground/50">{user?.email}</p></div>
                {isAuthenticated ? <NotificationsBell /> : null}
              </div>
              <button type="button" onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/72 transition hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><LogOut className="h-3.5 w-3.5" />Sign out</button>
            </div>
          </div>}
          {sidebarCollapsed && (
            <div className="aa-member-profile" style={{ padding: "0.75rem", display: "flex", justifyContent: "center" }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={handleLogout} className="aa-member-nav-link" aria-label="Sign out" style={{ width: "auto" }}>
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          )}
        </aside>
        <main className="aa-member-main" id="main-content">
          <BackNav variant="top" />
          {children}
          <BackNav variant="bottom" />
        </main>
      </div>
    </div>
  );
}
