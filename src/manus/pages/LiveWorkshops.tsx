import MemberLayout from "@/manus/components/MemberLayout";
import { Calendar, Clock } from "lucide-react";

export default function LiveWorkshops() {
  // Sample upcoming workshops
  const upcomingWorkshops = [
    {
      id: 1,
      title: "Color Theory Masterclass",
      date: "June 15, 2026",
      time: "2:00 PM - 3:30 PM",
      instructor: "Lorena Couto",
    },
    {
      id: 2,
      title: "Sustainable Design Practices",
      date: "June 22, 2026",
      time: "3:00 PM - 4:30 PM",
      instructor: "Design Expert",
    },
    {
      id: 3,
      title: "Lighting Design Workshop",
      date: "July 1, 2026",
      time: "2:00 PM - 3:30 PM",
      instructor: "Lorena Couto",
    },
  ];

  // Sample past workshops
  const pastWorkshops = [
    { id: 1, title: "Space Planning Essentials", date: "May 25, 2026" },
    { id: 2, title: "Material Selection Guide", date: "May 18, 2026" },
    { id: 3, title: "Furniture Arrangement Tips", date: "May 11, 2026" },
  ];

  return (
    <MemberLayout>
      <div
        className="p-6 md:p-10 min-h-screen"
        style={{
          backgroundImage: 'url(/img/workshop-1.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for better text readability */}
        <div
          className="absolute inset-0 bg-black/40"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1,
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="font-serif text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
              Live Workshops
            </h1>
            <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              Join our expert-led workshops and connect with fellow Alchemists
            </p>
          </div>

          {/* Coming Up Section */}
          <div className="mb-12">
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Coming Up
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {upcomingWorkshops.slice(0, 1).map((workshop, index) => (
                <div
                  key={workshop.id}
                  className="rounded-lg hover:shadow-lg transition overflow-hidden"
                  style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}
                >
                  <div className="p-6">
                    {/* Thumbnail - small square with photo background */}
                    {index === 0 && (
                      <div
                        style={{
                          width: "120px",
                          height: "120px",
                          backgroundImage: 'url(/img/workshop-2.jpg)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          display: 'block',
                        }}
                      />
                    )}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={16} style={{ color: "var(--aa-gold)" }} />
                        <span className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                          {workshop.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} style={{ color: "var(--aa-gold)" }} />
                        <span className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                          {workshop.time}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                      {workshop.title}
                    </h3>
                    <p className="text-xs mb-4" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      with {workshop.instructor}
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
                </div>
              ))}
            </div>
          </div>

          {/* Past Workshops Section */}
          <div className="mb-12">
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
              Past Workshops
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {pastWorkshops.slice(0, 1).map((workshop, index) => (
                <div
                  key={workshop.id}
                  className="rounded-lg hover:shadow-lg transition overflow-hidden"
                  style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}
                >
                  <div className="p-6">
                    {/* Thumbnail - small square with photo background */}
                    {index === 0 && (
                      <div
                        style={{
                          width: "120px",
                          height: "120px",
                          backgroundImage: 'url(/img/workshop-2.jpg)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          display: 'block',
                        }}
                      />
                    )}
                    <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                      {workshop.title}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      {workshop.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4 justify-between mt-12 pt-6 border-t" style={{ borderColor: "var(--aa-cream-dark)" }}>
            <a href="/dashboard" className="px-6 py-2 rounded text-sm font-medium transition" style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-text-dark)", fontFamily: "'DM Sans', sans-serif" }}>
              ← Back
            </a>
            <a href="/dashboard" className="px-6 py-2 rounded text-sm font-medium transition" style={{ backgroundColor: "var(--aa-olive-dark)", color: "var(--aa-white)", fontFamily: "'DM Sans', sans-serif" }}>
              Exit
            </a>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
