import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PaymentSuccess() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-editorial px-6">
      <div className="max-w-lg text-center animate-fade-up">
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Pagamento confirmado</p>
        <h1 className="mt-4 font-serif text-5xl text-primary">Bem-vindo ao ateliê.</h1>
        <p className="mt-4 text-muted-foreground">
          Sua assinatura foi ativada. Em instantes você terá acesso ao acervo completo.
        </p>
        <div className="divider-gold my-10" />
        <Button asChild className="bg-primary text-primary-foreground hover:bg-olive-deep">
          <Link to="/dashboard">Ir para o dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
