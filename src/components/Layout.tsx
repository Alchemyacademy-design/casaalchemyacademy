import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/mycourses", label: "Meus Cursos" },
  { to: "/community", label: "Comunidade" },
  { to: "/events", label: "Eventos" },
  { to: "/magazine", label: "Revista" },
  { to: "/suppliers", label: "Fornecedores" },
  { to: "/plans", label: "Planos" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { me, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/dashboard" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl tracking-[0.18em] text-primary">ALCHEMY</span>
            <span className="font-serif text-2xl italic text-accent-foreground/70">academy</span>
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `text-sm uppercase tracking-[0.18em] transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="hidden text-sm uppercase tracking-[0.18em] text-muted-foreground hover:text-primary md:inline"
            >
              {me?.user.name ?? me?.user.email ?? "Perfil"}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-border/60 py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-xs uppercase tracking-[0.22em] text-muted-foreground md:flex-row">
          <span>© Alchemy Academy</span>
          <span className="italic normal-case tracking-normal">Lovable Preview · Frontend only</span>
        </div>
      </footer>
    </div>
  );
}
