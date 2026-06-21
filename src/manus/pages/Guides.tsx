import { getLoginUrl } from "@/manus/const";
import { trpc } from "@/manus/lib/trpc";
import { ArrowRight, CheckCircle, Lock } from "lucide-react";
import { useState } from "react";
import SubscribeModal from "@/manus/components/SubscribeModal";
import { Link } from "react-router-dom";

const MODULES = [
  { number: 1, title: "Colour", tagline: "Discover how to use the same intricate colour techniques designers rely on, broken down into simple steps, to create a unique space with a clear, intentional outcome." },
  { number: 2, title: "Bedroom", tagline: "Create a bedroom that feels intentional, not accidental — learn the overlooked techniques that designers use to bring everything together." },
  { number: 3, title: "Kitchen", tagline: "The most expensive space to get wrong is your kitchen — discover the intentional design choices that increase value and make everyday life easier." },
  { number: 4, title: "Bathrooms", tagline: "When every element is permanent, every decision matters — learn how to design a bathroom that feels beautiful, functions effortlessly, and adds lasting value to your home." },
  { number: 5, title: "Living", tagline: "Furniture is the most consequential decision in a living room — and the most misunderstood. Discover how designers approach every element so the whole room finally makes sense." },
  { number: 6, title: "Dining", tagline: "A dining room should be beautiful enough to linger in and practical enough to live in. You don't have to choose between the two." },
  { number: 7, title: "Home Office", tagline: "A home office shouldn't be an afterthought. Create a designated space that works for your life and looks considered on camera." },
  { number: 8, title: "Kids", tagline: "Design a space that works with how kids actually live — not against it." },
  { number: 9, title: "Outdoors", tagline: "Your outdoor space should be the most lived-in room in the house. Discover how to create an environment that's social, intentional, and well within reach." },
  { number: 10, title: "All Things Design", tagline: "See your home the way a designer does — understanding light, proportion, styling and the invisible rules that make a space feel right." },
];

const INCLUDED = [
  "Full module content — all lessons",
  "Lesson-by-lesson written guides",
  "Video lessons (when available)",
  "1 year access to this guide",
  "Access via your member account",
];

export default function Guides() {
  const [selected, setSelected] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const selectedModule = selected !== null ? MODULES[selected] : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--aa-cream)", color: "var(--aa-text-dark)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
        <div className="container flex items-center justify-between py-5">
          <Link to="/">
            <div className="cursor-pointer">
              <div className="font-serif text-xl tracking-widest" style={{ color: "var(--aa-olive-dark)", letterSpacing: "0.2em" }}>
                ALCHEMY ACADEMY
              </div>
              <div className="text-xs tracking-widest mt-0.5" style={{ color: "var(--aa-text-light)", letterSpacing: "0.15em" }}>
                by Casa Alchemy
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/">
              <span className="text-xs tracking-widest uppercase" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                ← Back
              </span>
            </Link>
            <a href={getLoginUrl()}>
              <button className="btn-outline-gold text-xs">Login</button>
            </a>
          </div>
        </div>
      </header>

      <div className="container py-16 max-w-5xl">
        {/* Hero */}
        <div className="mb-14 max-w-2xl">
          <p className="section-label mb-4">Casa Consult</p>
          <h1 className="font-serif text-4xl md:text-5xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 300, lineHeight: 1.2 }}>
            Access a single design guide.{" "}
            <span style={{ color: "var(--aa-gold)" }}>$59. One-off payment.</span>
          </h1>
          <p className="text-sm leading-loose" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Not ready for a full membership? Purchase a single module guide for 1 year. No subscription, no recurring charges — just the knowledge you need, when you need it.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Module selector */}
          <div className="lg:col-span-3">
            <h2 className="font-serif text-xl mb-5" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Select a module
            </h2>
            <div className="space-y-2">
              {MODULES.map((mod, idx) => (
                <button key={idx} onClick={() => setSelected(idx)}
                  className="w-full text-left p-4 flex items-center gap-4 transition-all module-card-hover"
                  style={{
                    border: `1px solid ${selected === idx ? "var(--aa-gold)" : "var(--aa-cream-dark)"}`,
                    backgroundColor: selected === idx ? "var(--aa-white)" : "var(--aa-cream)",
                  }}>
                  <span className="font-serif text-lg flex-shrink-0 w-8"
                    style={{ color: "var(--aa-gold)", opacity: selected === idx ? 1 : 0.5 }}>
                    {String(mod.number).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: selected === idx ? 500 : 400 }}>
                      {mod.title}
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                      {mod.tagline}
                    </div>
                  </div>
                  {selected === idx && <CheckCircle size={16} style={{ color: "var(--aa-gold)", flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Purchase panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <div className="p-6 mb-4" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
                <h3 className="font-serif text-lg mb-1" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  {selectedModule ? selectedModule.title : "Select a module"}
                </h3>
                {selectedModule && (
                  <p className="text-xs mb-4" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                    {selectedModule.tagline}
                  </p>
                )}
                <div className="gold-divider" />
                <p className="section-label mb-3">What's included</p>
                <ul className="space-y-2 mb-6">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                      <CheckCircle size={12} style={{ color: "var(--aa-gold)", marginTop: "2px", flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline gap-2 mb-5">
                  <span className="font-serif text-3xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>$59</span>
                  <span className="text-xs" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif" }}>per guide · 1 year access</span>
                </div>
                <button
                  onClick={() => selectedModule && setShowModal(true)}
                  className={`btn-gold w-full flex items-center justify-center gap-2 ${!selectedModule ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={!selectedModule}>
                  {selectedModule ? (
                    <>Get Casa Consult — $59 <ArrowRight size={14} /></>
                  ) : (
                    <><Lock size={14} /> Select a module first</>
                  )}
                </button>
                <p className="text-xs mt-2 text-center" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                  Secure payment via Stripe
                </p>
              </div>

              {/* Upsell */}
              <div className="p-5" style={{ backgroundColor: "var(--aa-olive-dark)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em" }}>
                  Better value
                </p>
                <p className="font-serif text-base mb-2" style={{ color: "var(--aa-cream)", fontWeight: 300 }}>
                  Want access to everything?
                </p>
                <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                  Join the full Academy from $39.50/month and unlock all modules, community, events, and supplier directory.
                </p>
                <Link to="/#pricing">
                  <button className="btn-cream text-xs py-2 px-4 w-full flex items-center justify-center gap-2">
                    View Membership Plans <ArrowRight size={12} />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && <SubscribeModal type="guide" onClose={() => setShowModal(false)} />}
      {/* Footer */}
      <footer className="py-8" style={{ borderTop: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-serif text-sm tracking-widest" style={{ color: "var(--aa-olive-dark)", letterSpacing: "0.2em" }}>
            ALCHEMY ACADEMY
          </div>
          <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
            © Casa Alchemy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
