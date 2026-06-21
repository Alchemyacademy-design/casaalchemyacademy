interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}
export default function PageHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <section className="border-b border-border/60 bg-gradient-editorial">
      <div className="container py-16 md:py-24">
        {eyebrow && (
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-accent-foreground/80">{eyebrow}</p>
        )}
        <h1 className="font-serif text-5xl leading-[1.05] text-primary md:text-6xl">{title}</h1>
        {subtitle && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
