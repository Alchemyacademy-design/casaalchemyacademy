import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";

interface LegalPageLayoutProps {
  title: string;
  description: string;
  updatedAt?: string;
  children: ReactNode;
}

const legalNav = [
  { label: "Início", href: "/" },
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  { label: "Termos de Uso", href: "/termos-de-uso" },
  { label: "Suporte", href: "/suporte" },
  { label: "Exclusão de Dados", href: "/exclusao-de-dados" },
];

export default function LegalPageLayout({ title, description, updatedAt, children }: LegalPageLayoutProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${title} — Casa Alchemy Academy`;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? "";
    if (meta) meta.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      if (meta) meta.setAttribute("content", prevDesc);
    };
  }, [title, description]);

  return (
    <div className="min-h-screen" style={{ background: "var(--aa-page)" }}>
      <header
        className="public-header"
        style={{
          borderBottom: "1px solid var(--aa-cream-dark)",
          padding: "1.25rem 0",
        }}
      >
        <div className="container flex items-center justify-between">
          <Link to="/" className="brand" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.5rem", color: "var(--aa-olive-dark)", letterSpacing: "0.05em" }}>
            Casa Alchemy Academy
          </Link>
          <nav className="hidden md:flex gap-6" aria-label="Navegação legal">
            {legalNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.85rem",
                  color: "var(--aa-text-mid)",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container" style={{ maxWidth: "760px", padding: "3rem 1.25rem 4rem" }}>
        <p className="aa-eyebrow" style={{ marginBottom: "0.75rem" }}>Casa Alchemy Academy</p>
        <h1 style={{ fontSize: "2.5rem", lineHeight: 1.15, marginBottom: "0.75rem" }}>{title}</h1>
        {updatedAt && (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: "var(--aa-text-light)", marginBottom: "2rem" }}>
            Última atualização: {updatedAt}
          </p>
        )}
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "1rem",
            lineHeight: 1.7,
            color: "var(--aa-text-dark)",
          }}
          className="legal-content"
        >
          {children}
        </div>
      </main>

      <footer style={{ backgroundColor: "#1F0A03", padding: "3rem 0 2rem" }}>
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {legalNav.slice(1).map((item) => (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  color: "rgba(245,240,232,0.75)",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.875rem",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem", textAlign: "center" }}>
            <p style={{ color: "rgba(245,240,232,0.5)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem" }}>
              © {new Date().getFullYear()} Casa Alchemy Academy. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        .legal-content h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.65rem; color: var(--aa-olive-dark); margin: 2.5rem 0 0.75rem; font-weight: 400; }
        .legal-content h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.25rem; color: var(--aa-olive-dark); margin: 1.75rem 0 0.5rem; font-weight: 500; }
        .legal-content p { margin-bottom: 1rem; }
        .legal-content ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .legal-content li { margin-bottom: 0.5rem; }
        .legal-content a { color: var(--aa-gold); text-decoration: underline; }
        .legal-content strong { color: var(--aa-olive-dark); }
        .legal-callout { background: var(--aa-muted-surface); border-left: 3px solid var(--aa-gold); padding: 1rem 1.25rem; margin: 1.5rem 0; border-radius: 0.15rem; }
      `}</style>
    </div>
  );
}