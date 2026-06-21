import MemberLayout from "@/manus/components/MemberLayout";
import { Calendar, MapPin, Users } from "lucide-react";

const UPCOMING_EVENTS = [
  {
    id: 1,
    title: "Interior Design Workshop",
    date: "June 15, 2026",
    time: "2:00 PM - 4:00 PM",
    location: "Virtual Event",
    attendees: 24,
    description: "Join us for an interactive workshop on modern interior design principles.",
  },
  {
    id: 2,
    title: "Colour Theory Masterclass",
    date: "June 22, 2026",
    time: "3:00 PM - 5:00 PM",
    location: "Virtual Event",
    attendees: 18,
    description: "Deep dive into colour theory and how to apply it to your home.",
  },
  {
    id: 3,
    title: "Member Networking Event",
    date: "July 5, 2026",
    time: "6:00 PM - 8:00 PM",
    location: "Virtual Event",
    attendees: 32,
    description: "Connect with fellow members and share your design journey.",
  },
];

const PAST_EVENTS = [
  {
    id: 4,
    title: "Bedroom Design Essentials",
    date: "May 20, 2026",
    time: "2:00 PM - 4:00 PM",
    location: "Virtual Event",
    attendees: 28,
    description: "Learned the key principles for creating a beautiful bedroom space.",
  },
  {
    id: 5,
    title: "Kitchen Planning 101",
    date: "May 10, 2026",
    time: "3:00 PM - 5:00 PM",
    location: "Virtual Event",
    attendees: 35,
    description: "Explored functional and aesthetic kitchen design strategies.",
  },
];

export default function Events() {
  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Header */}
        <div className="mb-10">
          <p className="section-label mb-2">Community</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Events
          </h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Join our community events to connect with other members and deepen your design knowledge.
          </p>
        </div>

        {/* Upcoming Events */}
        <div className="mb-12">
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Upcoming Events
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {UPCOMING_EVENTS.map((event) => (
              <div
                key={event.id}
                className="p-6 rounded-lg border border-border/50 hover:border-border transition"
                style={{ backgroundColor: "white" }}
              >
                <div className="mb-4">
                  <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)" }}>
                    {event.title}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                    {event.description}
                  </p>
                </div>

                <div className="space-y-3 border-t border-border/30 pt-4">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <Calendar size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <Calendar size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <MapPin size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <Users size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.attendees} attendees</span>
                  </div>
                </div>

                <button
                  className="w-full mt-4 px-4 py-2 rounded-lg transition text-sm font-medium"
                  style={{
                    backgroundColor: "var(--aa-olive-dark)",
                    color: "white",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Register
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Past Events */}
        <div>
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Past Events
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PAST_EVENTS.map((event) => (
              <div
                key={event.id}
                className="p-6 rounded-lg border border-border/50 opacity-75"
                style={{ backgroundColor: "white" }}
              >
                <div className="mb-4">
                  <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)" }}>
                    {event.title}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                    {event.description}
                  </p>
                </div>

                <div className="space-y-3 border-t border-border/30 pt-4">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <Calendar size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <Calendar size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <MapPin size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                    <Users size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{event.attendees} attendees</span>
                  </div>
                </div>

                <button
                  className="w-full mt-4 px-4 py-2 rounded-lg transition text-sm font-medium"
                  style={{
                    backgroundColor: "var(--aa-text-light)",
                    color: "var(--aa-text-mid)",
                  }}
                  disabled
                >
                  Event Ended
                </button>
              </div>
            ))}
          </div>
        </div>
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
    </MemberLayout>
  );
}
