import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  ListChecks,
  Users,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  Calendar,
  Video,
  Newspaper,
  Building2,
  Tag,
  CreditCard,
  Award,
  FileQuestion,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/manus/hooks/useAuth";

interface Crumb {
  label: string;
  to?: string;
}

const NAV = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Courses", url: "/admin/courses", icon: BookOpen },
  { title: "Lessons (bulk)", url: "/admin/lessons", icon: ListChecks },
  { title: "Events", url: "/admin/events", icon: Calendar },
  { title: "Live workshops", url: "/admin/workshops", icon: Video },
  { title: "Magazine", url: "/admin/magazine", icon: Newspaper },
  { title: "Suppliers", url: "/admin/suppliers", icon: Building2 },
  { title: "Supplier categories", url: "/admin/supplier-categories", icon: Tag },
  { title: "Deals", url: "/admin/deals", icon: Tag },
  { title: "Plans", url: "/admin/plans", icon: CreditCard },
  { title: "Certificates", url: "/admin/certificates", icon: Award },
  { title: "Students", url: "/admin/students", icon: Users },
  { title: "Diagnostics", url: "/admin/diagnostics", icon: Activity },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

function AdminSidebarInner() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={`border-b border-sidebar-border/60 ${collapsed ? "px-0 py-3" : "px-4 py-5"}`}>
        <Link
          to="/admin"
          className={`flex items-center min-w-0 ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <img
            src="/img/logo.png"
            alt="Casa Alchemy Academy"
            className={`object-contain shrink-0 ${collapsed ? "h-8 w-8" : "h-10 w-10"}`}
          />
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <div className="font-serif text-base tracking-[0.16em] text-sidebar-foreground truncate">CASA ALCHEMY</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/65 truncate">Admin Center</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/55 uppercase tracking-[0.18em] text-[10px]">Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.exact}
                      className={({ isActive }) =>
                        `flex items-center gap-2 border-l-2 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground border-[var(--aa-gold)]"
                            : "border-transparent"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2 pb-3 border-t border-sidebar-border/60 pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to platform">
              <NavLink to="/dashboard" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Back to platform</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminShell({
  title,
  description,
  crumbs = [],
  actions,
  children,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className="aa-admin-shell min-h-screen flex w-full bg-background">
        <AdminSidebarInner />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b border-border bg-card/90 backdrop-blur px-5 sticky top-0 z-30">
            <SidebarTrigger />
            <nav className="flex items-center gap-1 text-xs text-foreground/60">
              <Link to="/admin" className="hover:text-foreground">Admin Center</Link>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-[var(--aa-gold)]" />
                  {c.to ? (
                    <Link to={c.to} className="hover:text-foreground">{c.label}</Link>
                  ) : (
                    <span className="text-foreground">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" /> Sign out
              </Button>
            </div>
          </header>
          <main className="flex-1 px-6 py-8 lg:px-10 max-w-[1400px] w-full">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-8 pb-5 border-b border-border">
              <div>
                <p className="section-label mb-2">Administration</p>
                <h1 className="font-serif text-4xl md:text-5xl" style={{ color: "var(--aa-olive-dark)" }}>{title}</h1>
                {description && <p className="text-sm text-foreground/70 mt-2 max-w-2xl">{description}</p>}
              </div>
              {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
            </div>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
