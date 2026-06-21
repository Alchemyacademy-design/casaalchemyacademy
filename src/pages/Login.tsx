import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { resolveLanding } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await auth.signIn(email, password);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const me = await auth.me();
    setLoading(false);
    await refresh();
    navigate(resolveLanding(me));
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-olive-deep p-12 text-primary-foreground lg:flex">
        <Link to="/" className="font-serif text-2xl tracking-[0.18em]">ALCHEMY <span className="italic opacity-70">academy</span></Link>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-gold">Editorial · 2026</p>
          <h2 className="mt-4 font-serif text-5xl leading-tight">
            O ofício de transformar<br /><em className="text-gold-soft">conhecimento</em> em arte.
          </h2>
          <div className="divider-gold mt-10 w-32" />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] opacity-60">Lovable preview</p>
      </aside>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md animate-fade-up">
          <p className="text-xs uppercase tracking-[0.4em] text-accent-foreground/80">Entrar</p>
          <h1 className="mt-3 font-serif text-4xl text-primary">Bem-vindo de volta.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesse seu acervo, cursos e comunidade.</p>
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-olive-deep">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="mt-8 text-sm text-muted-foreground">
            Ainda não tem conta? <Link to="/signup" className="text-accent underline-offset-4 hover:underline">Cadastre-se</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
