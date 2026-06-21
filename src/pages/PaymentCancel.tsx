import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PaymentCancel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-editorial px-6">
      <div className="max-w-lg text-center animate-fade-up">
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Pagamento cancelado</p>
        <h1 className="mt-4 font-serif text-5xl text-primary">Nada foi cobrado.</h1>
        <p className="mt-4 text-muted-foreground">
          Você pode retomar quando quiser. Estamos aqui quando o momento for o seu.
        </p>
        <div className="divider-gold my-10" />
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/plans">Ver planos</Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-olive-deep">
            <Link to="/dashboard">Voltar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
