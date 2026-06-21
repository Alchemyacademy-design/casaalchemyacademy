import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  ListChecks,
  Users,
  Upload,
  BarChart3,
  Settings,
  LogOut,
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
  { title: "Visão geral", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Cursos", url: "/admin/courses", icon: BookOpen },
  { title: "Aulas (lote)", url: "/admin/lessons", icon: ListChecks },
  { title: "Alunos", url: "/admin/students", icon: Users },
  { title: "Importar conteúdo", url: "/admin/import", icon: Upload },
  { title: "Métricas", url: "/admin/analytics", icon: BarChart3 },
];

function AdminSidebarInner() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <Link to="/admin" className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded flex items-center justify-center font-serif text-base"
            style={{ background: "var(--aa-gold)", color: "var(--aa-olive-dark)" }}
          >
            A
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-serif text-sm tracking-[0.18em]">CASA ALCHEMY</div>
              <div className="text-[10px] uppercase tracking-[0.15em] opacity-70">Central ADM</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.exact}
                      className={({ isActive }) =>
                        `flex items-center gap-2 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`
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
      <SidebarFooter className="px-2 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Voltar à plataforma">
              <NavLink to="/dashboard" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Voltar à plataforma</span>
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
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebarInner />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/60 bg-card/70 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <nav className="flex items-center gap-1 text-xs text-foreground/60">
              <Link to="/admin" className="hover:text-foreground">Central ADM</Link>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
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
                <LogOut className="w-4 h-4 mr-1" /> Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 px-6 py-6 max-w-[1400px] w-full">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
              <div>
                <h1 className="font-serif text-3xl" style={{ color: "var(--aa-olive-dark)" }}>{title}</h1>
                {description && <p className="text-sm text-foreground/70 mt-1 max-w-2xl">{description}</p>}
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
