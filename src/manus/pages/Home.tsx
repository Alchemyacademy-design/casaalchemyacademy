import { useEffect, useState } from "react";
import SubscribeModal from "@/manus/components/SubscribeModal";
import { getLoginUrl } from "@/manus/const";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/manus/hooks/useAuth";
import { useHomeCourses } from "@/manus/hooks/usePublicContent";
import CourseCard, { type CourseCardData } from "@/manus/components/learning/CourseCard";
import LeadMagnetDialog from "@/manus/components/LeadMagnetDialog";
import LeadMagnetForm from "@/manus/components/LeadMagnetForm";
import freeLessonBanner from "@/assets/how-to-mix-prints-banner.png.asset.json";
const lorenaPhoto = { url: "/img/lorena.jpg" };




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
  { title: "EXPERT MASTERCLASSES", desc: "Learn and interact with Lorena Couto and special guests during monthly live sessions." },
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
  const { user, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    // Signed-in visitors bypass the marketing landing page.
    if (isAuthenticated && !isAdmin) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, isAdmin, navigate]);
  const [subscribeModal, setSubscribeModal] = useState<"annual" | "monthly" | "guide" | null>(null);
  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  // Admins see drafts on the real Home (behind an Admin Preview badge); the
  // hook still filters archived rows and RLS remains the authority.
  const coursesQuery = useHomeCourses({ includeDrafts: isAdmin });
  // P0 hardening: never let an unexpected query payload crash the landing.
  const dbCourses = Array.isArray(coursesQuery.data) ? coursesQuery.data : [];
  const coursesFailed = coursesQuery.isError;

  type DisplayModule = {
    id: number;
    title: string;
    tagline: string;
    lessonCount?: number;
    available: boolean;
    thumbnail: string | null;
    href?: string;
    comingSoon?: boolean;
    isDraft?: boolean;
    isAdminPreview?: boolean;
    number: number | string;
  };
  // Prefer DB courses; fall back to the static curriculum copy when DB is
  // empty OR the query failed.
  const displayModules: DisplayModule[] = (dbCourses.length > 0
    ? dbCourses.map((c, i): DisplayModule => {
        const row = (c ?? {}) as {
          id?: number;
          title?: string | null;
          subtitle?: string | null;
          short_description?: string | null;
          tagline?: string | null;
          description?: string | null;
          status?: string | null;
          sort_order?: number | null;
          lesson_count?: number;
          cover_image_path?: string | null;
          cover_image_url?: string | null;
          thumbnail_url?: string | null;
        };
        const isPublished = row.status === "published";
        const isDraft = !isPublished;
        // Only fall back to a static thumbnail when the exact same course
        // (matched by title) exists in the legacy copy — never by index, which
        // used to attach the wrong artwork to newly created courses.
        const normalized = (row.title ?? "").trim().toLowerCase();
        const fallback =
          MODULES.find((m) => m.title.trim().toLowerCase() === normalized)?.thumbnail ?? null;
        return {
          id: row.id ?? i + 1,
          title: row.title ?? "Untitled",
          tagline: row.subtitle ?? row.tagline ?? row.short_description ?? row.description ?? "",
          lessonCount: typeof row.lesson_count === "number" ? row.lesson_count : undefined,
          available: isPublished || isAdmin,
          thumbnail: row.cover_image_path ?? row.cover_image_url ?? row.thumbnail_url ?? fallback,
          href: `/courses/${row.id}`,
          isDraft,
          isAdminPreview: isAdmin && isDraft,
          number: row.sort_order ?? i + 1,
        };
      })
    : MODULES.map((m, i): DisplayModule => ({
        id: m.id,
        title: m.title,
        tagline: m.tagline,
        lessonCount: m.lessons.length,
        available: m.available,
        thumbnail: m.thumbnail,
        href: undefined,
        number: i + 1,
      }))
  );



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
          opacity: 0.85,
        }} />
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }} />


        <div className="relative container flex items-center" style={{ minHeight: "92vh" }}>
          <div className="max-w-2xl">
            <p className="section-label mb-6" style={{ color: "rgba(245,240,232,0.7)" }}>Interior Design Education</p>
            <h1 className="font-serif mb-6" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", color: "var(--aa-cream)", lineHeight: 1.1, fontWeight: 300 }}>
              Welcome,<br />Alchemist!
            </h1>
            <p className="mb-8 max-w-lg" style={{ color: "rgba(245,240,232,0.85)", fontSize: "1.05rem", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Embark on a journey to redefine your relationship with your home through the joys of learning interior design. Our platform connects enthusiasts with essential theories, allowing you to train your eyes and mind to design your own life.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <a href="#offers" className="btn-cream w-full sm:w-auto justify-center">
                See our plans
              </a>
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
          <div className="mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            <a href="#offers" className="btn-cream w-full sm:w-auto justify-center">
              See our plans
            </a>
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
            <p style={{ color: "var(--aa-text-mid)", fontFamily: "'Manrope', sans-serif", fontWeight: 300 }}>
              Each area takes you to a new path of knowledge. Explore them all with a subscription or take a slow walk by acquiring them individually.
            </p>
          </div>
          {coursesFailed ? (
            <div role="status" className="mb-6" style={{ padding: "0.75rem 1rem", border: "1px solid var(--aa-cream-dark)", background: "rgba(0,0,0,0.03)", fontFamily: "'Manrope', sans-serif", fontSize: "0.85rem", color: "var(--aa-text-mid)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <span>The latest course catalogue could not load. Showing the standard curriculum below.</span>
              <button type="button" onClick={() => coursesQuery.refetch()} style={{ background: "transparent", border: "1px solid var(--aa-text-mid)", padding: "0.25rem 0.75rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer" }}>Retry</button>
            </div>
          ) : null}
          <div data-testid="our-courses-grid" data-aa-grid="landing" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-5">
            {displayModules.map((mod, idx) => {
              const card: CourseCardData = {
                id: typeof mod.id === "number" ? mod.id : idx + 1,
                title: mod.title,
                subtitle: mod.tagline,
                number: mod.number ?? idx + 1,
                thumbnail: mod.thumbnail,
                lessonCount: mod.lessonCount,
                published: !mod.isDraft,
                adminPreview: !!mod.isAdminPreview,
                // While Stripe is deferred (pré-lançamento), every course
                // that is not explicitly available shows Coming Soon and
                // never opens a financial checkout flow.
                comingSoon: !mod.available,
                href: mod.available ? mod.href : undefined,
              };
              return <CourseCard key={mod.id} course={card} variant="landing" />;
            })}



            {/* Membership Perks Card */}
            <div
              className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4"
              style={{
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
              }}
            >
              <div className="absolute inset-0 bg-black/60" />
              <div className="relative z-10">
                <h3 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-cream)", fontWeight: 400, textAlign: "center", textTransform: "uppercase" }}>Membership Perks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  <ul className="space-y-3">
                    {[
                      "Access to all courses available",
                      "The A Tribe - Community Forum",
                      "Expert Masterclasses",
                    ].map((perk) => (
                      <li key={perk} className="flex items-start gap-2" style={{ color: "var(--aa-cream)", fontFamily: "'Manrope', sans-serif", fontSize: "0.95rem", fontWeight: 300 }}>
                        <span style={{ color: "var(--aa-gold)", flexShrink: 0, marginTop: "2px" }}>✓</span> {perk}
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-3">
                    {[
                      "Events",
                      "Exclusive Deals",
                      "Access to The Reading Room and suppliers directory",
                    ].map((perk) => (
                      <li key={perk} className="flex items-start gap-2" style={{ color: "var(--aa-cream)", fontFamily: "'Manrope', sans-serif", fontSize: "0.95rem", fontWeight: 300 }}>
                        <span style={{ color: "var(--aa-gold)", flexShrink: 0, marginTop: "2px" }}>✓</span> {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="relative z-10 mt-4">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("open-lead-magnet"))}
                  style={{ background: "var(--aa-gold)", color: "var(--aa-olive-dark)", cursor: "pointer", fontSize: "0.75rem", fontFamily: "'Manrope', sans-serif", fontWeight: 500, padding: "0.65rem 1rem", display: "block", width: "100%", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "none", border: 0 }}
                >
                  Watch a Free Lesson
                </button>
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
          <div className="overflow-x-auto max-w-5xl mx-auto pricing-shell">
            <style>{`
              @keyframes slideInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes highlightPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(218, 180, 105, 0.7); }
                50% { box-shadow: 0 0 0 14px rgba(218, 180, 105, 0); }
              }
              @keyframes priceGlow {
                0%, 100% { text-shadow: 0 0 0 rgba(218, 180, 105, 0); }
                50% { text-shadow: 0 0 18px rgba(218, 180, 105, 0.35); }
              }
              @keyframes subscribePulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(218, 180, 105, 0.65); }
                50% { box-shadow: 0 0 0 16px rgba(218, 180, 105, 0); }
              }
              .pricing-table { animation: slideInUp 0.6s ease-out; }
              .pricing-table thead th { transition: all 0.3s ease; }
              .pricing-table tbody tr { transition: all 0.3s ease; }
              .pricing-table tbody tr:hover { background-color: rgba(218, 180, 105, 0.05); }
              .pricing-highlight { animation: highlightPulse 2s infinite; }
              .cta-cell { padding: 1.5rem !important; text-align: center; vertical-align: bottom; }
              .cta-price { color: var(--aa-olive-dark); font-family: 'DM Sans', sans-serif; font-weight: 600; margin-bottom: 1rem; line-height: 1.2; }
              .cta-price .cur { font-size: 0.72rem; letter-spacing: 0.14em; font-weight: 700; color: var(--aa-gold); display: inline-block; margin-right: 0.35rem; vertical-align: 0.35em; }
              .cta-price .amt { font-family: 'Instrument Serif', serif; font-size: 2.4rem; font-weight: 400; letter-spacing: -0.01em; }
              .cta-price .per { font-size: 0.75rem; font-weight: 500; color: var(--aa-text-mid); text-transform: uppercase; letter-spacing: 0.12em; margin-left: 0.25rem; }
              .cta-price .sub { display: block; font-size: 0.75rem; font-weight: 300; color: var(--aa-text-mid); margin-top: 0.4rem; }
              .cta-price .save { display: inline-block; font-size: 0.7rem; font-weight: 700; color: var(--aa-gold); letter-spacing: 0.08em; margin-top: 0.35rem; text-transform: uppercase; }
              .cta-annual-highlight { position: relative; background: linear-gradient(180deg, rgba(145,69,33,0.06), rgba(145,69,33,0.02)); border-top: 3px solid var(--aa-gold); }
              .cta-best-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--aa-gold); color: var(--aa-cream); font-family: 'Manrope', sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; box-shadow: 0 4px 12px -2px rgba(145,69,33,0.45); white-space: nowrap; }
              .cta-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 56px; padding: 1rem 1.5rem; border: 0; border-radius: 12px; cursor: pointer; font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--aa-cream); background: linear-gradient(180deg, #e8c478 0%, #c9a05f 100%); box-shadow: 0 8px 22px -7px rgba(145,69,33,0.6), inset 0 1px 0 rgba(255,255,255,0.2); transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, background .18s ease, letter-spacing .25s ease; position: relative; overflow: hidden; }
              .cta-btn::after { content: ""; position: absolute; top: 0; left: -120%; width: 60%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.5), transparent); transform: skewX(-18deg); transition: left .55s ease; pointer-events: none; }
              .cta-btn:hover { transform: translateY(-3px); filter: brightness(1.08); box-shadow: 0 14px 30px -9px rgba(145,69,33,0.7), inset 0 1px 0 rgba(255,255,255,0.25); letter-spacing: 0.21em; }
              .cta-btn:hover::after { left: 130%; }
              .cta-btn:active { transform: translateY(0); filter: brightness(0.98); box-shadow: 0 5px 14px -5px rgba(145,69,33,0.55); }
              .cta-btn:focus-visible { outline: 3px solid var(--aa-gold-light); outline-offset: 3px; }
              .cta-btn-primary { font-size: 0.95rem; letter-spacing: 0.2em; min-height: 64px; box-shadow: 0 12px 30px -9px rgba(145,69,33,0.75), inset 0 1px 0 rgba(255,255,255,0.25); animation: subscribePulse 2.2s infinite; }
              .cta-btn-primary:hover { animation: none; }
              .cta-btn .arrow { transition: transform .25s ease; }
              .cta-btn:hover .arrow { transform: translateX(4px); }
              .currency-note { text-align: center; color: var(--aa-cream); opacity: 0.6; font-family: 'DM Sans', sans-serif; font-size: 0.72rem; letter-spacing: 0.06em; margin-top: 1.25rem; }
              .plan-details { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin-top: 2.5rem; }
              .plan-detail-card { background: var(--aa-white); border: 1px solid var(--aa-cream-dark); border-top: 3px solid var(--aa-gold); padding: 1.5rem; text-align: left; transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; display: flex; flex-direction: column; }
              .plan-detail-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px -18px rgba(145,69,33,0.55); }
              .plan-detail-card.is-best { border-top-width: 5px; box-shadow: 0 14px 34px -16px rgba(145,69,33,0.6); transform: scale(1.02); }
              .plan-detail-card.is-best:hover { transform: scale(1.02) translateY(-5px); }
              .plan-detail-name { font-family: 'Manrope', sans-serif; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--aa-gold); margin-bottom: 0.5rem; }
              .plan-detail-price { font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 600; color: var(--aa-olive-dark); margin-bottom: 0.75rem; }
              .plan-detail-intro { font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 300; color: var(--aa-text-mid); line-height: 1.6; margin-bottom: 1rem; }
              .plan-detail-card ul { list-style: none; margin: 0; padding: 0; flex: 1; }
              .plan-detail-card li { position: relative; padding-left: 1.1rem; margin-bottom: 0.55rem; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 300; color: var(--aa-text-mid); line-height: 1.55; }
              .plan-detail-card li::before { content: "✓"; position: absolute; left: 0; top: 0; color: var(--aa-gold); font-size: 0.78rem; }
              .plan-detail-cta { display: block; margin-top: auto; padding-top: 1.25rem; }
              .plan-detail-badge { display: inline-block; background: var(--aa-gold); color: var(--aa-cream); font-family: 'Manrope', sans-serif; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; margin-bottom: 0.75rem; box-shadow: 0 3px 10px -2px rgba(145,69,33,0.35); }
              .plan-card-price { margin: 0 0 1.1rem; text-align: left; }
              .plan-card-price .cur { font-size: 0.72rem; letter-spacing: 0.16em; font-weight: 700; color: var(--aa-gold); display: inline-block; margin-right: 0.35rem; vertical-align: 0.4em; }
              .plan-card-price .amt { font-family: 'Instrument Serif', serif; font-size: 2.8rem; font-weight: 400; color: var(--aa-olive-dark); letter-spacing: -0.02em; animation: priceGlow 3s ease-in-out infinite; }
              .plan-card-price .per { font-size: 0.78rem; font-weight: 600; color: var(--aa-text-mid); text-transform: uppercase; letter-spacing: 0.12em; margin-left: 0.25rem; }
              .plan-card-price .sub { display: block; font-size: 0.8rem; font-weight: 300; color: var(--aa-text-mid); margin-top: 0.45rem; }
              .plan-card-price .save { display: inline-block; font-size: 0.72rem; font-weight: 700; color: var(--aa-gold); letter-spacing: 0.1em; margin-top: 0.45rem; text-transform: uppercase; background: rgba(218,180,105,0.12); padding: 3px 8px; border-radius: 6px; }
              .pricing-shell { display: flex; flex-direction: column; }
              .plan-details { order: 1; margin-top: 0; }
              .mobile-table-note { order: 2; display: block; text-align: center; color: var(--aa-cream); opacity: .7; font-family: 'DM Sans', sans-serif; font-size: .75rem; letter-spacing: .06em; margin: 2.5rem 0 .75rem; }
              .pricing-table-scroll { order: 3; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; }
              .currency-note { order: 4; }
              @media (max-width: 900px) { .plan-details { grid-template-columns: 1fr; } .plan-detail-card.is-best { transform: none; } .plan-detail-card.is-best:hover { transform: translateY(-5px); } }
              @media (max-width: 767px) {
                .plan-details { gap: 1.25rem; }
                table.pricing-table { display: table; min-width: 660px; }
                table.pricing-table th, table.pricing-table td { padding: .85rem .7rem !important; font-size: .76rem; }
                .currency-note { order: 4; margin-top: 1rem; }
                .plan-detail-card { padding: 1.5rem; border-radius: 14px; position: relative; }
                .plan-detail-card.is-best { transform: scale(1.01); }
                .plan-detail-price { font-size: 1rem; }
                .plan-card-price .amt { font-size: 2.4rem; }
                .plan-detail-cta .cta-btn { min-height: 54px; font-size: 0.82rem; }
                .cta-btn-primary { min-height: 58px; font-size: 0.88rem; }
              }
              @media (max-width: 640px) {
                .cta-cell { padding: 1rem !important; }
                .cta-price .amt { font-size: 2rem; }
                .cta-btn { font-size: 0.78rem; letter-spacing: 0.14em; padding: 0.95rem 1rem; }
                .cta-btn-primary { font-size: 0.84rem; letter-spacing: 0.16em; }
              }
            `}</style>
            <p className="mobile-table-note">Visual comparison — swipe to see all plans</p>
            <div className="pricing-table-scroll">
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
                  { feature: "Full course library — every course, every lesson", annual: "All courses", monthly: "All courses", selected: "1 course of your choice" },
                  { feature: "Length of access", annual: "12 months", monthly: "Renews monthly", selected: "3 months" },
                  { feature: "Video lessons + written guides", annual: "check", monthly: "check", selected: "For the chosen course" },
                  { feature: "Downloadable support materials", annual: "check", monthly: "check", selected: "For the chosen course" },
                  { feature: "Quizzes + completion certificate", annual: "check", monthly: "check", selected: "check" },
                  { feature: "New courses & lessons added regularly", annual: "check", monthly: "check", selected: "" },
                  { feature: "The A Tribe — private community forum", annual: "check", monthly: "check", selected: "" },
                  { feature: "Live Workshops with Lorena", annual: "check", monthly: "check", selected: "" },
                  { feature: "Members-only events", annual: "check", monthly: "", selected: "" },
                  { feature: "Digital magazine issues", annual: "check", monthly: "check", selected: "" },
                  { feature: "Suppliers directory", annual: "check", monthly: "check", selected: "" },
                  { feature: "Exclusive supplier deals & discounts", annual: "check", monthly: "", selected: "" },
                  { feature: "Cancel anytime", annual: "Renews yearly", monthly: "check", selected: "One-time payment" },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--aa-cream-dark)" }}>
                    <td style={{ padding: "1.25rem 1.5rem", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>{row.feature}</td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>{row.annual === "check" ? "✓" : row.annual}</td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>{row.monthly === "check" ? "✓" : row.monthly}</td>
                    <td style={{ padding: "1.25rem 1.5rem", textAlign: "center", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}>{row.selected === "check" ? "✓" : row.selected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="currency-note">All prices are in US Dollars (USD).</p>
            <div className="plan-details">
              {[
                {
                  name: "Annual Member",
                  price: "USD 708 billed once a year (USD 59/month)",
                  best: true,
                  amount: "59",
                  per: "/ month",
                  sub: "USD 708 billed annually",
                  save: "Save USD 480",
                  cta: "Subscribe Now",
                  action: () => setSubscribeModal("annual"),
                  intro: "The complete academy for 12 months — everything we make, plus the parts that are members-only.",
                  items: [
                    "Unlimited access to every course in the library for 12 months, including all courses released during your year",
                    "All video lessons, written guides and downloadable support materials",
                    "Quizzes and a completion certificate for every course you finish",
                    "The A Tribe private community forum",
                    "Live Workshops with Lorena",
                    "Members-only events and invitations",
                    "Every digital magazine issue",
                    "Suppliers directory and exclusive supplier deals",
                    "Save USD 480 compared with paying monthly",
                  ],
                },
                {
                  name: "Monthly Member",
                  price: "USD 99 per month, no lock-in",
                  best: false,
                  amount: "99",
                  per: "/ month",
                  sub: "Billed monthly",
                  save: "No commitment",
                  cta: "Subscribe Now",
                  action: () => setSubscribeModal("monthly"),
                  intro: "Full library access, month by month. Cancel whenever you want.",
                  items: [
                    "Unlimited access to every course while your subscription is active",
                    "All video lessons, written guides and downloadable support materials",
                    "Quizzes and completion certificates",
                    "The A Tribe private community forum",
                    "Live Workshops with Lorena",
                    "Digital magazine issues and the suppliers directory",
                    "Does not include members-only events or exclusive supplier deals",
                    "Cancel anytime — access runs to the end of the paid month",
                  ],
                },
                {
                  name: "Individual Course",
                  price: "USD 159 one-time, per course",
                  best: false,
                  amount: "159",
                  per: "",
                  sub: "One-time payment",
                  save: "No commitment",
                  cta: "Choose Course",
                  action: () => navigate("/choose-course"),
                  intro: "One course, chosen by you. Perfect when there is a single room or project you need to get right.",
                  items: [
                    "Full access to the one course you select, for 3 months",
                    "All lessons of that course: videos, written guides and worksheets",
                    "Downloadable support materials for that course",
                    "Quiz and completion certificate in your name",
                    "Your own member account with progress tracking",
                    "Does not include the community, live workshops, events, magazine or deals",
                    "You can upgrade to a membership at any time",
                  ],
                },
              ].map((plan) => (
                <div key={plan.name} className={`plan-detail-card${plan.best ? " is-best" : ""}`}>
                  {plan.best && <span className="plan-detail-badge">Best value</span>}
                  <p className="plan-detail-name">{plan.name}</p>
                  <p className="plan-card-price">
                    <span className="cur">USD</span><span className="amt">{plan.amount}</span>
                    {plan.per && <span className="per">{plan.per}</span>}
                    <span className="sub">{plan.sub}</span>
                    <span className="save">{plan.save}</span>
                  </p>
                  <p className="plan-detail-intro">{plan.intro}</p>
                  <ul>
                    {plan.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <div className="plan-detail-cta">
                    <button onClick={plan.action} className={`cta-btn${plan.best ? " cta-btn-primary" : ""}`}>
                      {plan.cta}
                      <span className="arrow" aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                  src="/img/casa-logo.png"
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
                  src="/img/lighthouse-logo.png"
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
        <div className="aa-lorena-grid">
          {/* Photo */}
          <div style={{ overflow: "hidden" }}>
            <img
              src={lorenaPhoto.url}
              alt="Lorena Couto, founder of Casa Alchemy"
              className="aa-lorena-photo"
            />
          </div>
          {/* Text */}
          <div className="aa-lorena-text" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>

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

      {!isAuthenticated && (
        <section id="free-lesson-cta" style={{ backgroundColor: "var(--aa-muted-surface)", padding: "clamp(3rem, 8vw, 5rem) 0" }}>
          <div className="container">
            <div className="max-w-5xl mx-auto mb-8 md:mb-10 overflow-hidden" style={{ border: "1px solid var(--aa-cream-dark)", borderRadius: "8px" }}>
              <img
                src={freeLessonBanner.url}
                alt="Free lesson: How to Mix Prints, with Lorena Couto — Casa Alchemy"
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center max-w-5xl mx-auto">
              <div>
                <p style={{ textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.75rem", color: "var(--aa-olive-mid)", marginBottom: "0.75rem", fontFamily: "'DM Sans', sans-serif" }}>
                  Get the free lesson
                </p>
                <h2 className="font-serif" style={{ color: "var(--aa-olive-dark)", fontSize: "2.5rem", lineHeight: 1.15, marginBottom: "1rem", fontWeight: 400 }}>
                  Get our latest lesson, free.
                </h2>
                <p style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7, marginBottom: "1rem" }}>
                  Subscribe and watch <em>How to Mix Prints</em> straight away — a full lesson with Lorena Couto: real projects, real principles, and the professional knowledge you need to design your own home with confidence.
                </p>
                <p style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>
                  No waiting. The lesson starts playing the moment you subscribe.
                </p>
              </div>
              <div style={{ background: "var(--aa-white)", padding: "2rem", border: "1px solid var(--aa-cream-dark)", borderRadius: "8px" }}>
                <LeadMagnetForm source="popup" placement="footer" ctaLabel="Watch the Free Lesson" />
              </div>
            </div>
          </div>
        </section>
      )}

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
                  { label: "Join the Academy", href: "https://buy.stripe.com/cNi4gAaZH2OjbUpe9saZi06" },
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
                {[
                  { label: "Privacy Policy", href: "/privacy-policy" },
                  { label: "Terms of Use", href: "/terms-of-use" },
                  { label: "Support", href: "/support" },
                  { label: "Data Deletion", href: "/data-deletion" },
                ].map((item) => (
                  <li key={item.href}>
                    <a href={item.href} style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem" }}>{item.label}</a>
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
      {!isAuthenticated && <LeadMagnetDialog />}
    </div>
  );
}
