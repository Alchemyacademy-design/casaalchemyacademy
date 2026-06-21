import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await auth.signUp(email, password, name);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro recebido. Verifique seu e-mail para confirmar.");
    navigate("/login");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center px-6 py-16 order-2 lg:order-1">
        <div className="w-full max-w-md animate-fade-up">
          <p className="text-xs uppercase tracking-[0.4em] text-accent-foreground/80">Criar conta</p>
          <h1 className="mt-3 font-serif text-4xl text-primary">Comece sua jornada.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Crie sua conta para acessar planos e cursos.</p>
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-olive-deep">
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="mt-8 text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-accent underline-offset-4 hover:underline">Entrar</Link>
          </p>
        </div>
      </section>
      <aside className="hidden flex-col justify-between bg-olive-deep p-12 text-primary-foreground lg:flex order-1 lg:order-2">
        <Link to="/" className="font-serif text-2xl tracking-[0.18em]">ALCHEMY <span className="italic opacity-70">academy</span></Link>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-gold">Manifesto</p>
          <h2 className="mt-4 font-serif text-5xl leading-tight">
            Cada aluno é um <em className="text-gold-soft">artesão</em><br />em formação contínua.
          </h2>
          <div className="divider-gold mt-10 w-32" />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] opacity-60">Lovable preview</p>
      </aside>
    </div>
  );
}
