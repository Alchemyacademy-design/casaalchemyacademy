import MemberLayout from "@/manus/components/MemberLayout";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";
import { Lock, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const MODULES_DATA = [
  { number: 1, title: "The path to a COLOURFUL life", tagline: "Discover how to use the same intricate colour techniques designers rely on, broken down into simple steps, to create a unique space with a clear, intentional outcome.", lessonCount: 7, available: true, courseId: 1, thumbnail: "/img/course-colour.jpg" },
  { number: 2, title: "The sacred BEDROOM", tagline: "Create a bedroom that feels intentional, not accidental — learn the overlooked techniques that designers use to bring everything together.", lessonCount: 6, available: true, comingSoon: true, thumbnail: "/img/course-bedroom.jpg" },
  { number: 3, title: "The alchemic KITCHEN", tagline: "The most expensive space to get wrong is your kitchen — discover the intentional design choices that increase value and make everyday life easier.", lessonCount: 8, available: true, comingSoon: true, thumbnail: "/img/course-kitchen.jpg" },
  { number: 4, title: "The elemental BATHROOM", tagline: "When every element is permanent, every decision matters — learn how to design a bathroom that feels beautiful, functions effortlessly, and adds lasting value to your home.", lessonCount: 6, available: false, comingSoon: true, thumbnail: "/img/course-bathroom.jpg" },
  { number: 5, title: "The soulful LIVING ROOM", tagline: "Furniture is the most consequential decision in a living room — and the most misunderstood. Discover how designers approach every element so the whole room finally makes sense.", lessonCount: 7, available: true, comingSoon: true, thumbnail: "/img/course-living.jpg" },
  { number: 6, title: "The crafted DINING ROOM", tagline: "A dining room should be beautiful enough to linger in and practical enough to live in. You don't have to choose between the two.", lessonCount: 3, available: true, comingSoon: true, thumbnail: "/img/course-dining.jpg" },
  { number: 7, title: "Catalyst WORKSPACE", tagline: "A home office shouldn't be an afterthought. Create a designated space that works for your life and looks considered on camera.", lessonCount: 4, available: true, comingSoon: true, thumbnail: "/img/course-workspace.jpg" },
  { number: 9, title: "Enchanted OUTDOORS", tagline: "Your outdoor space should be the most lived-in room in the house. Discover how to create an environment that's social, intentional, and well within reach.", lessonCount: 5, available: true, comingSoon: true, thumbnail: "/img/course-outdoors.jpg" },
  { number: 10, title: "Knowledgeable CHEAT SHEETS", tagline: "See your home the way a designer does — understanding light, proportion, styling and the invisible rules that make a space feel right.", lessonCount: 8, available: true, comingSoon: true, thumbnail: "/img/course-design.jpg" },
];

export default function Modules() {
  const { user } = useAuth();
  const { data: progress = [] } = trpc.lessons.progress.useQuery({ lessonId: 0 });

  const tier = (user as { membershipTier?: string } | null)?.membershipTier ?? "guest";
  const isFullMember = tier === "annual_member" || user?.role === "admin";

  const getProgress = (moduleNumber: number, lessonCount: number) => {
    if (!progress || lessonCount === 0) return 0;
    const done = (progress as Array<{ moduleId: number; completed: boolean }>).filter((p) => p.moduleId === moduleNumber && p.completed).length;
    return Math.round((done / lessonCount) * 100);
  };

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Header */}
        <div className="mb-10">
          <p className="section-label mb-2">The Curriculum</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Courses Available
          </h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            {isFullMember
              ? "You have full access to all modules. Work through them at your own pace."
              : "You have access to Module 1. Upgrade to unlock the full curriculum."}
          </p>
        </div>

        {/* Upgrade banner */}
        {!isFullMember && (
          <div className="mb-8 p-4 rounded-lg border border-border/50" style={{ backgroundColor: "var(--aa-gold-light)" }}>
            <p className="text-sm" style={{ color: "var(--aa-olive-dark)" }}>
              Upgrade to access all modules and unlock the complete curriculum.
            </p>
          </div>
        )}

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES_DATA.map((mod) => {
            const pct = getProgress(mod.number, mod.lessonCount);
            const locked = !mod.available && !isFullMember;

            return (
              <div
                key={mod.number}
                className="p-6 rounded-lg border border-border/50 hover:border-border transition flex flex-col relative overflow-hidden group"
                style={{
                  backgroundColor: "white",
                  backgroundImage: mod.thumbnail ? `url(${mod.thumbnail})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition" />
                {/* Content wrapper */}
                <div className="relative z-10">
                <div className="mb-4">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: mod.thumbnail ? "white" : "var(--aa-gold)",
                      fontFamily: "'DM Sans', sans-serif",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {String(mod.number).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {mod.comingSoon && (
                      <span className="text-xs px-2 py-0.5" style={{ backgroundColor: mod.thumbnail ? "rgba(255,255,255,0.3)" : "var(--aa-olive-light)", color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em" }}>
                        Soon
                      </span>
                    )}
                    {locked && !mod.comingSoon && (
                      <Lock size={14} style={{ color: "var(--aa-text-light)" }} />
                    )}
                    {pct === 100 && !locked && (
                      <CheckCircle size={14} style={{ color: "var(--aa-gold)" }} />
                    )}
                  </div>
                </div>

                <h3 className="font-serif text-xl mb-2" style={{ color: mod.thumbnail ? "white" : "var(--aa-olive-dark)", fontWeight: 400 }}>
                  {mod.title}
                </h3>
                <p className="text-xs mb-4 flex-1 leading-relaxed" style={{ color: mod.thumbnail ? "rgba(255,255,255,0.9)" : "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                  {mod.tagline}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: mod.thumbnail ? "rgba(255,255,255,0.8)" : "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                    {mod.lessonCount} lessons {pct > 0 ? `· ${pct}% done` : ""}
                  </span>
                  {!locked && !mod.comingSoon && (
                    <Link href={mod.courseId ? `/courses/${mod.courseId}` : `/mycourses/${mod.number}`}>
                      <span className="flex items-center gap-1 text-xs" style={{ color: mod.thumbnail ? "white" : "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, letterSpacing: "0.08em" }}>
                        {pct > 0 ? "Continue" : "Start"} <ArrowRight size={12} />
                      </span>
                    </Link>
                  )}
                  {locked && (
                    <Link href="/#pricing">
                      <span className="flex items-center gap-1 text-xs" style={{ color: mod.thumbnail ? "white" : "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em" }}>
                        Unlock <ArrowRight size={12} />
                      </span>
                    </Link>
                  )}
                </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">
            ← Back
          </a>
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">
            Exit
          </a>
        </div>
      </div>
    </MemberLayout>
  );
}
