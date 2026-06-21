import { useState } from "react";
import SubscribeModal from "@/manus/components/SubscribeModal";
import { getLoginUrl } from "@/manus/const";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/manus/hooks/useAuth";
import lorenaPhoto from "@/assets/lorena-couto.jpg.asset.json";

// Organogram-based module structure from reference
const MODULES = [
  {
    id: 1, title: "The path to a COLOURFUL life", tagline: "Discover how to use the same intricate colour techniques designers rely on, broken down into simple steps, to create a unique space with a clear, intentional outcome.",
    lessons: ["Top Colours 2026", "Colour drenching explained", "Tone on tone and how to master it", "The 60-30-10 rule", "The psychology of colours", "Monochrome like a master", "Not every white is the same"],
    available: true,
    thumbnail: "/img/course-colour.jpg",
  },
  {
    id: 2, title: "The sacred BEDROOM", tagline: "Create a bedroom that feels intentional, not accidental — learn the overlooked techniques that designers use to bring everything together.",
    lessons: ["Bedroom Master Guide", "Bed Master Guide: Hotel Bed Revealed", "Minimalist x Maximalist", "Mixing prints", "Learning to layer", "Understanding fabrics"],
    available: false,
    thumbnail: "/img/course-bedroom.jpg",
  },
  {
    id: 3, title: "The alchemic KITCHEN", tagline: "The most expensive space to get wrong is your kitchen — discover the intentional design choices that increase value and make everyday life easier.",
    lessons: ["Layout styles", "Do's and Don'ts of an efficient kitchen", "Types of storage", "Style communication", "Ergonomics", "Lighting: task x atmosphere", "Special sinks", "Integrated appliances"],
    available: false,
    thumbnail: "/img/course-kitchen.jpg",
  },
  {
    id: 4, title: "The elemental BATHROOM", tagline: "When every element is permanent, every decision matters — learn how to design a bathroom that feels beautiful, functions effortlessly, and adds lasting value to your home.",
    lessons: ["The poetic licence of the powder room", "Shower layouts", "Bathtub guide", "Fixtures", "Spa logic", "Materials you should know about"],
    available: false,
    thumbnail: "/img/course-bathroom.jpg",
  },
  {
    id: 5, title: "The soulful LIVING ROOM", tagline: "Furniture is the most consequential decision in a living room — and the most misunderstood. Discover how designers approach every element so the whole room finally makes sense.",
    lessons: ["Fireplaces master guide", "Rugs: materials and proportions", "Artwork and other decorative matters", "Lighting: layers and zones", "Open plan living: zoning without walls", "Sofa guide", "Weight, proportion and harmony"],
    available: false,
    thumbnail: "/img/course-living.jpg",
  },
  {
    id: 6, title: "The crafted DINING ROOM", tagline: "A dining room should be beautiful enough to linger in and practical enough to live in. You don't have to choose between the two.",
    lessons: ["The perfect chair", "How to pair table x chairs x pendant", "Copa"],
    available: false,
    thumbnail: "/img/course-dining.jpg",
  },
  {
    id: 7, title: "Catalyst WORKSPACE", tagline: "A home office shouldn't be an afterthought. Create a designated space that works for your life and looks considered on camera.",
    lessons: ["6 steps to quickly put it together", "Storage ideas", "Acoustics matter", "Background as a branding opportunity"],
    available: false,
    thumbnail: "/img/course-workspace.jpg",
  },
  {
    id: 8, title: "Enchanted OUTDOORS", tagline: "Your outdoor space should be the most lived-in room in the house. Discover how to create an environment that's social, intentional, and well within reach.",
    lessons: ["Privacy, shade, shelter", "Make it fun", "Indoor-outdoor connection", "Landscaping principals", "Alfrescos"],
    available: false,
    thumbnail: "/img/course-outdoors.jpg",
  },
  {
    id: 9, title: "Knowledgeable CHEAT SHEETS", tagline: "See your home the way a designer does — understanding light, proportion, styling and the invisible rules that make a space feel right.",
    lessons: ["Biophilic design", "Lighting temperature", "Circadian design", "Visual weight and balance", "Negative space", "Aging with grace", "Clutter and cognitive load", "What's your style?"],
    available: false,
    thumbnail: "/img/course-design.jpg",
  },
];

const BENEFITS = [
  { title: "THE A TRIBE", desc: "Connect with fellow Alchemists. Share projects, ask questions, and grow together." },
  { title: "LIVE WORKSHOPS", desc: "Learn and interact with Lorena Couto and special guests during monthly live sessions." },
  { title: "EVENTS", desc: "Access exclusive events and networking opportunities with Lorena and the community." },
  { title: "EXCLUSIVE DEALS", desc: "Exclusive discounts on furniture and accessories from curated suppliers, plus a unique package deal for private consultations with Lorena C to keep your project moving in the right direction." },
  { title: "LEARN AT YOUR OWN PACE", desc: "Video lessons, live recordings, and visual aids — learn at your own pace, track your progress. Every course is accessible individually, with full support material included. The design decisions professionals make instinctively — now structured and yours to apply." },
  { title: "KNOWLEDGE FOR A LIFETIME", desc: "Understand the purpose of your project and be confident in your decisions — whether you want to create a life-long nest or turn the numbers up in your property value." },
];

const TESTIMONIALS = [
  {
    name: "Maira Murray",
    quote: "Lorena's guidance has saved me time and money — I was about to buy a sofa that didn't fit my space! She gave me a concept that reflects my taste, is easy to implement, and was within my budget.",
  },
  {
    name: "Cibeli Nunes",
    quote: "The result has been incredible. Everyone who steps into my home comments on how warm, balanced, and welcoming the space feels. There is a grounded, loving energy that people notice straight away.",
  },
  {
    name: "Angelica R",
    quote: "We have a very challengingly narrow block and having her help on guiding us on how to use the spaces has been life-changing! She has great knowledge of suppliers and was able to match our style and needs.",
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [subscribeModal, setSubscribeModal] = useState<"annual" | "monthly" | "guide" | null>(null);
  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });

  return (
    <div style={{ backgroundColor: "var(--aa-cream)", color: "var(--aa-text-dark)" }}>

      {/* ── Navigation ── */}
      <nav style={{ backgroundColor: "var(--aa-cream)", borderBottom: "1px solid var(--aa-cream-dark)" }} className="sticky top-0 z-50">
        <div className="container flex items-center justify-between" style={{ height: "64px" }}>
          <Link to="/">
            <img src="/img/logo.png" alt="Alchemy Academy" style={{ height: "70px", width: "auto" }} />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Casa Alchemy Academy", href: "/" },
              { label: "Casa Alchemy Studio", href: "#" },
            ].map((item) => (
              <a key={item.label} href={item.href} className="text-xs tracking-widest uppercase transition-colors"
                style={{ color: "var(--aa-text-mid)", letterSpacing: "0.12em", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex flex-row gap-2 items-center">
                <Link to="/dashboard">
                  <span className="btn-gold text-xs py-2 px-5">My Academy</span>
                </Link>
                <a href={getLoginUrl()} className="btn-gold text-xs py-2 px-5">Join</a>
              </div>
            ) : (
              <>
                <a href={getLoginUrl()} className="text-xs tracking-widest uppercase"
                  style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  Log In
                </a>
                <a href={getLoginUrl()} className="btn-gold text-xs py-2 px-5">Sign Up</a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "92vh", backgroundColor: "#000000" }}>
        <div className="absolute inset-0" style={{
          backgroundImage: "url('/img/hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.5,
        }} />
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }} />

        <div className="relative container flex items-center" style={{ minHeight: "92vh" }}>
          <div className="max-w-2xl">
            <p className="section-label mb-6" style={{ color: "rgba(245,240,232,0.7)" }}>Interior Design Education</p>
            <h1 className="font-serif mb-6" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", color: "var(--aa-cream)", lineHeight: 1.1, fontWeight: 300 }}>
              Welcome,<br />Alchemist!
            </h1>
            <p className="mb-8 max-w-lg" style={{ color: "rgba(245,240,232,0.85)", fontSize: "1.05rem", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Embark on a journey to redefine your relationship with your home through the joys of learning interior design. Our platform connects enthusiasts with essential theories, allowing you to train your eyes and mind to design your own life.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={getLoginUrl()} className="btn-cream">Join the Academy</a>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div style={{ width: "1px", height: "48px", backgroundColor: "rgba(245,240,232,0.4)" }} />
        </div>
      </section>

      {/* ── Core Benefits ── */}
      <section style={{ backgroundColor: "var(--aa-olive-dark)", padding: "6rem 0" }}>
        <div className="container">
          <div className="max-w-xl mb-14">
            <p className="section-label mb-4" style={{ color: "var(--aa-gold)" }}>Why Join</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-5" style={{ color: "var(--aa-cream)", fontWeight: 300 }}>
              Core Benefits
            </h2>
            <p style={{ color: "rgba(245,240,232,0.65)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Explore our unique learning resources designed for every room in your home.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            {BENEFITS.map((b, i) => (
              <div key={i} className="p-8" style={{ backgroundColor: "var(--aa-olive-dark)" }}>
                <div className="gold-divider mb-5" />
                <h3 className="font-serif text-xl mb-3" style={{ color: "var(--aa-cream)", fontWeight: 400 }}>{b.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>{b.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <a href={getLoginUrl()} className="btn-cream">Become an Alchemist</a>
          </div>
        </div>
      </section>

      {/* ── Modules ── */}
      <section id="modules" style={{ backgroundColor: "var(--aa-cream)", padding: "6rem 0" }}>
        <div className="container">
          <div className="max-w-xl mb-14">
            <p className="section-label mb-4">The Curriculum</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-5" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
              Our Courses
            </h2>
            <p style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Each area takes you to a new path of knowledge. Explore them all with a subscription or take a slow walk by acquiring them individually.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {MODULES.filter(mod => mod.id !== 9).map((mod) => (
              <div key={mod.id} className="module-card-hover relative overflow-hidden group" style={{
                border: "1px solid var(--aa-cream-dark)",
                backgroundColor: mod.thumbnail ? "transparent" : ((mod as { comingSoon?: boolean }).comingSoon ? "var(--aa-cream-dark)" : "var(--aa-white)"),
                padding: "1.75rem",
                backgroundImage: mod.thumbnail ? `url('${mod.thumbnail}')` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight: mod.thumbnail ? "280px" : "auto",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}>
                {mod.thumbnail && <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition" />}
                <div className="relative z-10">
                  {(mod as { comingSoon?: boolean }).comingSoon === true && (
                    <div className="absolute top-3 right-3 z-20">
                      <span className="text-xs px-2 py-0.5" style={{ backgroundColor: "var(--aa-olive-light)", color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em" }}>
                        Coming Soon
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <span className="font-serif text-3xl" style={{ color: mod.thumbnail ? "var(--aa-cream)" : "var(--aa-gold)", fontWeight: 300 }}>
                      {String(mod.id).padStart(2, "0")}
                    </span>
                    {!mod.available || (mod as { comingSoon?: boolean }).comingSoon === true ? (
                      <Lock size={14} style={{ color: mod.thumbnail ? "var(--aa-cream)" : "var(--aa-olive-light)", opacity: 0.5, marginTop: "6px" }} />
                    ) : null}
                  </div>
                  <h3 className="font-serif text-xl mb-2" style={{ color: mod.thumbnail ? "var(--aa-cream)" : "var(--aa-olive-dark)", fontWeight: 400 }}>{mod.title}</h3>
                  <p className="text-xs mb-4 leading-relaxed" style={{ color: mod.thumbnail ? "var(--aa-cream)" : "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>{mod.tagline}</p>
                </div>
                <div className="relative z-10 mt-4">
                  <button onClick={() => setSubscribeModal("guide")} style={{ background: "none", border: "1px solid var(--aa-cream)", color: "var(--aa-cream)", cursor: "pointer", fontSize: "0.75rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "0.5rem 1rem", width: "100%", textTransform: "uppercase", letterSpacing: "0.05em" }}>Buy Now</button>
                </div>
              </div>
            ))}
            {/* Membership Perks Card */}
            <div style={{
              border: "1px solid var(--aa-cream-dark)",
              backgroundImage: "url('/img/perks.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              minHeight: "280px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "1.75rem",
              position: "relative",
              overflow: "hidden",
              gridColumn: "span 4",
            }}>
              <div className="absolute inset-0 bg-black/60" />
              <div className="relative z-10">
                <h3 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-cream)", fontWeight: 400, textAlign: "center", textTransform: "uppercase" }}>Membership Perks</h3>
                <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                  <ul className="space-y-3">
                    {[
                      "Access to all courses available",
                      "The A Tribe - Community Forum",
                      "Live Workshops",
                    ].map((perk) => (
                      <li key={perk} className="flex items-start gap-2" style={{ color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 300 }}>
                        <span style={{ color: "var(--aa-gold)", flexShrink: 0, marginTop: "2px" }}>✓</span> {perk}
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-3">
                    {[
                      "Events",
                      "Exclusive Deals",
                      "Access to cheat sheets and special suppliers",
                    ].map((perk) => (
                      <li key={perk} className="flex items-start gap-2" style={{ color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", fontWeight: 300 }}>
                        <span style={{ color: "var(--aa-gold)", flexShrink: 0, marginTop: "2px" }}>✓</span> {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="relative z-10 mt-4">
                <a href={getLoginUrl()} style={{ background: "var(--aa-gold)", color: "var(--aa-olive-dark)", cursor: "pointer", fontSize: "0.75rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "0.5rem 1rem", display: "block", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "none" }}>Join the Academy</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Offers ── */}
      <section id="offers" style={{ backgroundColor: "#000000", padding: "6rem 0", backgroundImage: "url('/img/offers-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.7)", zIndex: 1 }}></div>
        <div style={{ position: "relative", zIndex: 2 }}>
        <div className="container">
          <div className="max-w-xl mx-auto text-center mb-14">
            <p className="section-label mb-4">Offers</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-5" style={{ color: "var(--aa-cream)", fontWeight: 300, lineHeight: 1.2 }}>
              Access the knowledge, at the depth that suits you now.
            </h2>
          </div>
          <div className="overflow-x-auto max-w-5xl mx-auto">
            <style>{`
              @keyframes slideInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes highlightPulse {
                0%, 100% {
                  box-shadow: 0 0 0 0 rgba(218, 180, 105, 0.7);
                }
                50% {
                  box-shadow: 0 0 0 10px rgba(218, 180, 105, 0);
                }
              }
              .pricing-table {
                animation: slideInUp 0.6s ease-out;
              }
              .pricing-table thead th {
                transition: all 0.3s ease;
              }
              .pricing-table tbody tr {
                transition: all 0.3s ease;
              }
              .pricing-table tbody tr:hover {
                background-color: rgba(218, 180, 105, 0.05);
              }
              .pricing-highlight {
                animation: highlightPulse 2s infinite;
              }
            `}</style>
            <table className="pricing-table" style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--aa-olive-dark)" }}>
                  <th style={{ padding: "1.5rem", textAlign: "left", color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, borderBottom: "1px solid var(--aa-cream-dark)" }}>FEATURES</th>
                  <th style={{ padding: "1.5rem", textAlign: "center", color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, borderBottom: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-olive-dark)", position: "relative" }}>ANNUAL MEMBER<span style={{ position: "absolute", bottom: "-10px", left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)", padding: "3px 10px", borderRadius: "12px", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.05em", whiteSpace: "nowrap", zIndex: 10 }}>BEST DEAL</span></th>
                  <th className="pricing-highlight" style={{ padding: "1.5rem", textAlign: "center", color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, borderBottom: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-olive-dark)" }}>MONTHLY MEMBER</th>
                  <th style={{ padding: "1.5rem", textAlign: "center", color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, borderBottom: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-olive-dark)" }}>INDIVIDUAL COURSES</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Access to all courses available", annual: "check", monthly: "check", selected: "access to selected content" },
                  { feature: "Access to your account", annual: "1 year", monthly: "1 month", selected: "3 months" },
                  { feature: "New content added regularly", annual: "check", monthly: "check", selected: "" },
                  { feature: "The A Tribe - Community Forum", annual: "check", monthly: "check", selected: "" },
                  { feature: "Live Workshops", annual: "check", monthly: "check", selected: "" },
                  { feature: "Events", annual: "check", monthly: "", selected: "" },
                  { feature: "Exclusive Deals", annual: "check", monthly: "", selected: "" },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--aa-cream-dark)" }}>
                    <td style={{ padding: "1.25rem 1.5rem", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>{row.feature}</td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>{row.annual === "check" ? "✓" : row.annual}</td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>{row.monthly === "check" ? "✓" : row.monthly}</td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>{row.selected === "check" ? "✓" : row.selected}</td>
                  </tr>
                ))}
                <tr style={{ borderBottom: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)", fontWeight: 500 }}>
                  <td style={{ padding: "1.5rem" }}></td>
                  <td style={{ padding: "1.5rem", textAlign: "center" }}>
                    <div style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "1.1rem", marginBottom: "0.75rem" }}>$59 / MONTH<br /><span style={{ fontSize: "0.75rem", fontWeight: 300 }}>$708 billed annually</span><br /><span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--aa-gold)" }}>Save $480</span></div>
                    <button onClick={() => setSubscribeModal("annual")} style={{ background: "none", border: "none", color: "var(--aa-olive-dark)", cursor: "pointer", fontSize: "0.9rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: 0 }}>SUBSCRIBE NOW</button>
                  </td>
                   <td style={{ padding: "1.5rem", textAlign: "center" }}>
                     <div style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "1.1rem", marginBottom: "0.75rem" }}>$99 / MONTH<br /><span style={{ fontSize: "0.75rem", fontWeight: 300 }}>billed monthly</span><br /><span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--aa-gold)" }}>No lock-in</span></div>
                    <button onClick={() => setSubscribeModal("monthly")} style={{ background: "none", border: "none", color: "var(--aa-olive-dark)", cursor: "pointer", fontSize: "0.9rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: 0 }}>SUBSCRIBE NOW</button>
                  </td>
                   <td style={{ padding: "1.5rem", textAlign: "center" }}>
                     <div style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "1.1rem", marginBottom: "0.75rem" }}>$159<br /><span style={{ fontSize: "0.75rem", fontWeight: 300 }}>billed individually</span><br /><span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--aa-gold)" }}>No lock-in</span></div>
                    <button onClick={() => setSubscribeModal("guide")} style={{ background: "none", border: "none", color: "var(--aa-olive-dark)", cursor: "pointer", fontSize: "0.9rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: 0 }}>EXPLORE COURSES</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </section>

      {/* ── Giving Back to Community ── */}
      <section style={{ backgroundColor: "var(--aa-cream)", padding: "4rem 0" }}>
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <p className="section-label mb-4">Our Impact</p>
            <h2 className="font-serif text-3xl md:text-4xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
              We Give Back to the Community
            </h2>
            <p className="mb-8 leading-relaxed" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Every membership purchased automatically donates $1 to support our community partners. Together, we're making a real difference.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <a
                href="https://www.wearecasa.org.au/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-110"
                style={{ display: "flex", alignItems: "center" }}
              >
                <img
                  src="/img/casa-logo.svg"
                  alt="Casa"
                  style={{ height: "70px", objectFit: "contain" }}
                />
              </a>
              <a
                href="https://www.lighthouseforcommunity.org.au/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-110"
                style={{ display: "flex", alignItems: "center" }}
              >
                <img
                  src="/img/lighthouse-logo.svg"
                  alt="Lighthouse for the Community"
                  style={{ height: "70px", objectFit: "contain" }}
                />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── About Lorena ── */}
      <section style={{ backgroundColor: "var(--aa-olive-dark)", padding: "0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh", alignItems: "stretch" }}>
          {/* Photo - Full Height Left */}
          <div style={{ overflow: "hidden" }}>
            <img
              src={lorenaPhoto.url}
              alt="Lorena Couto, founder of Casa Alchemy"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
          {/* Text - Right Side */}
          <div style={{ padding: "6rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p className="section-label mb-5" style={{ color: "var(--aa-gold)" }}>About Lorena Couto</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-6" style={{ color: "var(--aa-cream)", fontWeight: 300, lineHeight: 1.15 }}>
              Designing with purpose, chemistry, and respect
            </h2>
            <p className="mb-5 leading-relaxed" style={{ color: "rgba(245,240,232,0.75)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              With a background in Architecture, Urbanism, and Design Thinking, Lorena has over 20 years of experience in Interior Design. With a passion for history, the arts, nature, and human connection, her ethos centres around designing with purpose and respect.
            </p>
            <p className="mb-5 leading-relaxed" style={{ color: "rgba(245,240,232,0.75)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Casa Alchemy is a residential Interior Design Studio and Academy. We specialise in creating connections between people and the spaces they live in — transforming 100+ homes across Australia, New Zealand, USA, Dubai, Germany, Portugal, and Brazil. Winner of 5 industry awards.
            </p>
            <div className="mb-8">
              <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase" }}>What we stand for</p>
              <ul className="space-y-2">
                {[
                  "No to overconsumerism, yes to understanding value",
                  "No to fitting into a style, yes to finding your unique essence",
                  "No to imposing solutions, yes to listening with kindness and offering technical advice",
                  "No to the idea that good design is a privilege — yes to making the knowledge accessible to everyone.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "rgba(245,240,232,0.7)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                    <span style={{ color: "var(--aa-gold)", marginTop: "2px", flexShrink: 0 }}>—</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-8 justify-center text-center mt-8">
              <div>
                <p className="font-serif text-5xl" style={{ color: "var(--aa-gold)", fontWeight: 300 }}>5</p>
                <p style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>Industry Awards</p>
              </div>
              <div>
                <p className="font-serif text-5xl" style={{ color: "var(--aa-gold)", fontWeight: 300 }}>100+</p>
                <p style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>Homes Transformed</p>
              </div>
              <div>
                <p className="font-serif text-5xl" style={{ color: "var(--aa-gold)", fontWeight: 300 }}>20+</p>
                <p style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>Years of Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ backgroundColor: "var(--aa-cream)", padding: "6rem 0" }}>
        <div className="container">
          <div className="max-w-xl mb-14">
            <p className="section-label mb-4">Testimonials</p>
            <h2 className="font-serif text-4xl md:text-5xl mb-5" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
              What our community says
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ backgroundColor: "var(--aa-white)", padding: "2rem", border: "1px solid var(--aa-cream-dark)" }}>
                <p className="mb-4 leading-relaxed" style={{ color: "var(--aa-text-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontStyle: "italic" }}>
                  "{t.quote}"
                </p>
                <p className="font-serif" style={{ color: "var(--aa-olive-dark)", fontWeight: 500 }}>{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ backgroundColor: "#1F0A03", padding: "4rem 0 2rem" }}>
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <img src="/img/logo.png" alt="Alchemy Academy" style={{ height: "150px", width: "auto", marginBottom: "1rem" }} />
            </div>
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Navigation</p>
              <ul className="space-y-2">
                {[
                  { label: "Home", href: "/" },
                  { label: "Join the Academy", href: "https://buy.stripe.com/4gMbJ27Nv0Gb2jP1mGaZi02" },
                  { label: "Explore Academy", href: "#modules" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Connect</p>
              <ul className="space-y-2">
                {[
                  { label: "Instagram", href: "https://www.instagram.com/casaalchemy/" },
                  { label: "Youtube", href: "https://www.youtube.com/@CasaAlchemy" },
                  { label: "Casa Alchemy", href: "https://www.casaalchemystudio.com/" },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Contact</p>
              <ul className="space-y-2">
                {["Privacy", "Terms"].map((item) => (
                  <li key={item}>
                    <a href="#" style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>{item}</a>
                  </li>
                ))}
                <li>
                  <button onClick={() => setContactModal(true)} style={{ background: "none", border: "none", color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", cursor: "pointer", padding: 0, textAlign: "left" }}>Contact Us</button>
                </li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "2rem", textAlign: "center" }}>
            <p style={{ color: "rgba(245,240,232,0.5)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem" }}>
              © 2026 Alchemy Academy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {subscribeModal && <SubscribeModal type={subscribeModal} onClose={() => setSubscribeModal(null)} />}

      {contactModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "var(--aa-cream)",
            padding: "2rem",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Get in Touch</h2>
              <button onClick={() => setContactModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--aa-olive-dark)" }}>\u00d7</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              // Send email via tRPC or API
              const emailData = {
                to: "contact@casaalchemystudio.com",
                from: contactForm.email,
                name: contactForm.name,
                message: contactForm.message,
              };
              // Log for now - would be replaced with actual API call
              console.log("Sending email:", emailData);
              // Show success message
              alert("Thank you for your message! We'll get back to you soon.");
              setContactModal(false);
              setContactForm({ name: "", email: "", message: "" });
            }}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>Name</label>
                <input type="text" required value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} style={{ width: "100%", padding: "0.75rem", border: "1px solid var(--aa-cream-dark)", borderRadius: "4px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>Email</label>
                <input type="email" required value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} style={{ width: "100%", padding: "0.75rem", border: "1px solid var(--aa-cream-dark)", borderRadius: "4px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }} />
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", fontWeight: 500 }}>Message</label>
                <textarea required value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={4} style={{ width: "100%", padding: "0.75rem", border: "1px solid var(--aa-cream-dark)", borderRadius: "4px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button type="submit" style={{ background: "var(--aa-gold)", color: "var(--aa-olive-dark)", padding: "0.75rem 1.5rem", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, flex: 1 }}>Send</button>
                <button type="button" onClick={() => setContactModal(false)} style={{ background: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", padding: "0.75rem 1.5rem", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
