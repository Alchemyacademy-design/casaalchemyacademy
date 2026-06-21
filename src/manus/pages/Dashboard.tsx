import MemberLayout from "@/manus/components/MemberLayout";
import { CertificateSection } from "@/manus/components/CertificateSection";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ArrowRight, BookOpen, TrendingUp, Calendar, Clock } from "lucide-react";
import { Link } from "wouter";
import type { ModuleRow, ProgressRow } from "@/manus/lib/types";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, loading, setLocation]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground/70">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) return null;
  
  const { data: progress = [] } = trpc.lessons.progress.useQuery({ lessonId: 0 });
  const { data: modules = [] } = trpc.modules.list.useQuery();

  const enrolledModules = (modules as ModuleRow[]).filter((m) => (progress as ProgressRow[]).some((p) => p.moduleId === m.id));
  const totalLessons = (modules as ModuleRow[]).reduce((sum: number, m) => sum + (m.lessonCount || 0), 0);
  const completedLessons = (progress as ProgressRow[]).filter((p) => p.completed).length;
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <MemberLayout>
      <div className="p-6 md:p-10">
        {/* Welcome Section */}
        <div className="mb-12">
          <p className="section-label mb-2">Welcome Back</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            {user?.name || "Alchemist"}
          </h1>
          <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Your membership tier: <span style={{ color: "var(--aa-gold)", fontWeight: 500 }}>{(user as { membershipTier?: string } | null)?.membershipTier || "Free"}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Overall Progress */}
          <div className="p-6" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Overall Progress
                </p>
                <p className="font-serif text-3xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
                  {overallProgress}%
                </p>
              </div>
              <TrendingUp size={24} style={{ color: "var(--aa-gold)" }} />
            </div>
            <div className="h-1 w-full" style={{ backgroundColor: "var(--aa-cream-dark)" }}>
              <div className="h-1" style={{ width: `${overallProgress}%`, backgroundColor: "var(--aa-gold)" }} />
            </div>
          </div>

          {/* Courses Completed */}
          <div className="p-6" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Courses Completed
                </p>
                <p className="font-serif text-3xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
                  {completedLessons}
                </p>
              </div>
              <BookOpen size={24} style={{ color: "var(--aa-gold)" }} />
            </div>
            <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
              of {totalLessons} total courses
            </p>
          </div>
        </div>

        {/* Coming Up Section */}
        <div className="mb-12">
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
            Coming Up
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Next Live Workshop */}
            <div className="p-6 rounded-lg hover:shadow-lg transition" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} style={{ color: "var(--aa-gold)" }} />
                  <span className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                    June 15, 2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: "var(--aa-gold)" }} />
                  <span className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                    2:00 PM - 3:30 PM
                  </span>
                </div>
              </div>
              <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                Color Theory Masterclass
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                with Lorena Couto
              </p>
              <button
                className="w-full px-4 py-2 rounded text-sm font-medium transition"
                style={{
                  backgroundColor: "var(--aa-gold)",
                  color: "var(--aa-cacao)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Register
              </button>
            </div>

            {/* Next Event */}
            <div className="p-6 rounded-lg hover:shadow-lg transition" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} style={{ color: "var(--aa-gold)" }} />
                  <span className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                    June 20, 2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: "var(--aa-gold)" }} />
                  <span className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                    6:00 PM - 8:00 PM
                  </span>
                </div>
              </div>
              <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                Alchemy Community Gathering
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                Network with fellow Alchemists
              </p>
              <button
                className="w-full px-4 py-2 rounded text-sm font-medium transition"
                style={{
                  backgroundColor: "var(--aa-gold)",
                  color: "var(--aa-cacao)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Certificate Section */}
        <div className="mb-12">
          <CertificateSection />
        </div>

        {/* Continue Learning */}
        {enrolledModules.length > 0 && (
          <div className="mb-12">
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Continue Learning
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrolledModules.slice(0, 4).map((module: ModuleRow) => {
                const moduleProgress = (progress as ProgressRow[]).filter((p) => p.moduleId === module.id);
                const lessonCount = module.lessonCount ?? 0;
                const pct = lessonCount > 0 ? Math.round((moduleProgress.length / lessonCount) * 100) : 0;

                return (
                  <div key={module.id} className="p-6 module-card-hover cursor-pointer" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }} onClick={() => window.location.href = `/mycourses/${module.number}`}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-serif text-2xl" style={{ color: "var(--aa-gold)", fontWeight: 300 }}>
                        {String(module.number).padStart(2, "0")}
                      </span>
                      <span className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                        {pct}% done
                      </span>
                    </div>
                    <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                      {module.title}
                    </h3>
                    <div className="h-1 w-full mb-3" style={{ backgroundColor: "var(--aa-cream-dark)" }}>
                      <div className="h-1" style={{ width: `${pct}%`, backgroundColor: "var(--aa-gold)" }} />
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      Continue <ArrowRight size={12} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Your Certificates */}
        <div className="p-6" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
          <h3 className="font-serif text-lg mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
            Your Certificates
          </h3>
          <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
            Complete 80% of a course and pass the quiz to earn your certificate.
          </p>
        </div>
      </div>
    </MemberLayout>
  );
}
