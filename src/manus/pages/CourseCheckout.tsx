import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Loader2, Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePublishedCourses } from "@/manus/hooks/usePublicContent";
import { useAuth } from "@/manus/hooks/useAuth";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

const FALLBACK_PAYMENT_LINK = "https://buy.stripe.com/8x2cN64Bj74z6A56H0aZi03";

const INCLUDED = [
  "Every lesson of the course you choose — videos and written guides",
  "Downloadable support materials for that course",
  "Quizzes and the completion certificate in your name",
  "3 months of access from the moment your payment is confirmed",
  "Your own member account, with progress tracking",
];

function breakOutAndGo(url: string) {
  setTimeout(() => {
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url;
        return;
      }
    } catch {
      /* cross-origin frame — fall through */
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = url;
  }, 300);
}

export default function CourseCheckout() {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = usePublishedCourses();
  const { isAuthenticated, user } = useAuth();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [step, setStep] = useState<"choose" | "account">("choose");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => courses.find((c) => Number(c.id) === selectedId) ?? null,
    [courses, selectedId],
  );

  const goToPayment = async (courseId: number) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout-session", {
        body: { offer_key: "individual_course", course_id: courseId },
      });
      const url = (data as { checkout_url?: string } | null)?.checkout_url;
      if (url) {
        toast.success("Redirecting to secure Stripe checkout…");
        breakOutAndGo(url);
        return;
      }
      if (fnError) console.error("create-checkout-session failed", fnError);
    } catch (err) {
      console.error("checkout error", err);
    }

    // Fallback: hosted Payment Link, carrying the buyer's identity so the
    // webhook can still resolve the account and the course after payment.
    const link = new URL(FALLBACK_PAYMENT_LINK);
    const { data: sessionData } = await supabase.auth.getSession();
    const current = sessionData.session?.user;
    if (current?.email) {
      link.searchParams.set("prefilled_email", current.email);
      link.searchParams.set("client_reference_id", current.id);
    } else if (email) {
      link.searchParams.set("prefilled_email", email.trim().toLowerCase());
    }
    link.searchParams.set("utm_content", `course_${courseId}`);
    link.searchParams.set("utm_source", "course_checkout");
    toast.success("Redirecting to secure Stripe checkout…");
    breakOutAndGo(link.toString());
  };

  const handleContinueToAccount = () => {
    if (!selectedId) return;
    setError(null);
    if (isAuthenticated) {
      setBusy(true);
      void goToPayment(selectedId).finally(() => setBusy(false));
      return;
    }
    setStep("account");
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || busy) return;
    setError(null);
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInError) {
          setError("We could not sign you in. Check your password or reset it.");
          setBusy(false);
          return;
        }
      } else {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setBusy(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName, selected_course_id: selectedId },
          },
        });
        if (signUpError) {
          const msg = (signUpError.message ?? "").toLowerCase();
          const code = (signUpError as { code?: string }).code ?? "";
          if (msg.includes("already") || code === "user_already_exists") {
            setMode("login");
            setError("This email already has an account. Enter your password to continue to payment.");
            setBusy(false);
            return;
          }
          setError(signUpError.message);
          setBusy(false);
          return;
        }
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (signInError) {
            setError("Account created. Please log in to continue to payment.");
            setBusy(false);
            return;
          }
        }
      }

      await goToPayment(selectedId);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--aa-cream)", color: "var(--aa-text-dark)" }}>
      <header style={{ borderBottom: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
        <div className="container flex items-center justify-between py-5">
          <Link to="/">
            <div className="font-serif text-xl tracking-widest" style={{ color: "var(--aa-olive-dark)", letterSpacing: "0.2em" }}>
              ALCHEMY ACADEMY
            </div>
            <div className="text-xs tracking-widest mt-0.5" style={{ color: "var(--aa-text-light)", letterSpacing: "0.15em" }}>
              by Casa Alchemy
            </div>
          </Link>
          <button onClick={() => navigate("/")} className="text-xs tracking-widest uppercase" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
            ← Back
          </button>
        </div>
      </header>

      <div className="container py-12 md:py-16 max-w-5xl">
        <div className="max-w-3xl mb-10">
          <p className="section-label mb-3">One course · AUD 159 · One-time payment</p>
          <h1 className="font-serif text-3xl md:text-5xl mb-5" style={{ color: "var(--aa-olive-dark)", fontWeight: 300, lineHeight: 1.15 }}>
            Choose the room you want to get right — and stop guessing.
          </h1>
          <p className="text-base md:text-lg leading-relaxed mb-4" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            One wrong tile, one wrong sofa, one wrong paint colour can cost you thousands — and years of looking at
            something you never loved. For less than the price of a single design consultation, you get the exact
            method Lorena uses with private clients, for the one space that matters to you right now.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
            Pick your course below. You'll create your account in the next step and your course is attached to it
            automatically — access is released the moment Stripe confirms your payment.
          </p>
        </div>

        <div className="flex items-center gap-3 mb-8 text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--aa-text-light)" }}>
          <span style={{ color: step === "choose" ? "var(--aa-gold)" : "var(--aa-text-light)", fontWeight: 700 }}>1. Choose your course</span>
          <span>›</span>
          <span style={{ color: step === "account" ? "var(--aa-gold)" : "var(--aa-text-light)", fontWeight: 700 }}>2. Create account &amp; pay</span>
        </div>

        {step === "choose" && (
          <>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Loading courses…</div>
            ) : courses.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>No courses are available for individual purchase right now.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((course) => {
                  const id = Number(course.id);
                  const active = selectedId === id;
                  const cover = resolveAssetUrl((course as { cover_image_path?: string | null }).cover_image_path) ?? null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className="text-left transition-all"
                      style={{
                        backgroundColor: "var(--aa-white)",
                        border: `1px solid ${active ? "var(--aa-gold)" : "var(--aa-cream-dark)"}`,
                        boxShadow: active ? "0 10px 30px -14px rgba(145,69,33,0.55)" : "none",
                        transform: active ? "translateY(-2px)" : "none",
                      }}
                    >
                      <div style={{ height: "140px", backgroundColor: "var(--aa-cream-dark)", backgroundImage: cover ? `url(${cover})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-serif text-xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 400, lineHeight: 1.2 }}>{course.title}</h3>
                          {active && <Check size={18} style={{ color: "var(--aa-gold)", flexShrink: 0 }} />}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                          {(course as { short_description?: string | null }).short_description ?? course.subtitle ?? course.description ?? ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-10 p-6" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
              <p className="section-label mb-4">What's included with your course</p>
              <ul className="grid sm:grid-cols-2 gap-2 mb-6">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                    <Check size={15} style={{ color: "var(--aa-gold)", marginTop: 3, flexShrink: 0 }} />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleContinueToAccount}
                disabled={!selectedId || busy}
                className="btn-gold w-full sm:w-auto inline-flex items-center justify-center gap-2"
                style={{ opacity: selectedId && !busy ? 1 : 0.45 }}
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {selected ? `Continue with ${selected.title}` : "Select a course to continue"}
                {!busy && <ArrowRight size={15} />}
              </button>
              <p className="text-xs mt-3" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                Prefer everything? The Annual Membership unlocks all courses, the community, live workshops, events and
                exclusive deals for AUD 59/month billed annually.{" "}
                <Link to="/" style={{ color: "var(--aa-gold)" }}>Compare plans</Link>
              </p>
            </div>
          </>
        )}

        {step === "account" && selected && (
          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
            <form onSubmit={handleSubmitAccount} className="p-6" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
              <p className="section-label mb-2">{mode === "login" ? "Sign in and pay" : "Create your account and pay"}</p>
              <h2 className="font-serif text-2xl mb-5" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
                One step. Your account and your course, together.
              </h2>

              {error && (
                <div className="mb-5 p-3 flex gap-2 text-sm" style={{ backgroundColor: "rgba(159,58,56,0.08)", border: "1px solid rgba(159,58,56,0.25)", color: "#9f3a38", fontFamily: "'DM Sans', sans-serif" }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
              )}

              {mode === "signup" && (
                <label className="block mb-4">
                  <span className="block text-sm font-medium mb-2">Full name</span>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Your name"
                    className="w-full px-3 py-2 rounded-md" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-cream)" }} />
                </label>
              )}
              <label className="block mb-4">
                <span className="block text-sm font-medium mb-2">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-md" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-cream)" }} />
              </label>
              <label className="block mb-5">
                <span className="block text-sm font-medium mb-2">Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-md" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-cream)" }} />
              </label>

              <button type="submit" disabled={busy} className="btn-gold w-full inline-flex items-center justify-center gap-2" style={{ opacity: busy ? 0.5 : 1 }}>
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? "Creating your account…" : mode === "login" ? "Sign in & continue to payment" : "Create account & continue to payment"}
              </button>
              <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                <ShieldCheck size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                Your account is created first, then we send you to Stripe with your details already filled in. Access to
                your course unlocks automatically once payment is confirmed.
              </p>
              <button type="button" onClick={() => { setStep("choose"); setError(null); }} className="text-xs mt-4 underline" style={{ color: "var(--aa-text-mid)" }}>
                ← Choose a different course
              </button>
            </form>

            <aside className="p-6" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-gold)" }}>
              <p className="section-label mb-3">Your order</p>
              <h3 className="font-serif text-2xl mb-1" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{selected.title}</h3>
              <p className="text-xs mb-5" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                {(selected as { short_description?: string | null }).short_description ?? selected.subtitle ?? ""}
              </p>
              <div className="font-serif mb-5" style={{ fontSize: "2.25rem", color: "var(--aa-olive-dark)", fontWeight: 300, lineHeight: 1 }}>
                AUD 159 <span className="text-xs uppercase tracking-widest" style={{ color: "var(--aa-text-light)" }}>one-time</span>
              </div>
              <ul className="space-y-2">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                    <Check size={13} style={{ color: "var(--aa-gold)", marginTop: 3, flexShrink: 0 }} />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] mt-5 flex items-start gap-1.5" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                <Lock size={12} style={{ marginTop: 1, flexShrink: 0 }} /> Secure payment handled by Stripe. We never see your card details.
              </p>
              {isAuthenticated && user?.email && (
                <p className="text-[11px] mt-3" style={{ color: "var(--aa-text-light)" }}>Signed in as {user.email}</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}