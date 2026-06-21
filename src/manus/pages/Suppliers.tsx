import MemberLayout from "@/manus/components/MemberLayout";
import { ExternalLink } from "lucide-react";
import { trpc } from "@/manus/lib/trpc";
import { useState } from "react";

const PRICE_TIERS = ["budget", "mid", "investment"];
const ROOMS = ["living", "bedroom", "kitchen", "bathroom", "dining", "office", "outdoor"];

export default function Suppliers() {
  const { data: suppliers = [] } = trpc.suppliers.publicList.useQuery();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const filtered = suppliers.filter((s: any) => {
    if (selectedRoom && s.room !== selectedRoom) return false;
    if (selectedTier && s.priceTier !== selectedTier) return false;
    return true;
  });

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Header */}
        <div className="mb-10">
          <p className="section-label mb-2">Curated Partners</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Supplier Directory
          </h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Discover our curated selection of suppliers and furniture partners. Exclusive discounts available for members.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Room Filter */}
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>
              Filter by Room
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRoom(null)}
                className="text-xs px-3 py-2 transition-all"
                style={{
                  backgroundColor: selectedRoom === null ? "var(--aa-olive-dark)" : "var(--aa-white)",
                  color: selectedRoom === null ? "var(--aa-cream)" : "var(--aa-olive-dark)",
                  border: `1px solid ${selectedRoom === null ? "var(--aa-olive-dark)" : "var(--aa-cream-dark)"}`,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                All
              </button>
              {ROOMS.map((room) => (
                <button
                  key={room}
                  onClick={() => setSelectedRoom(room)}
                  className="text-xs px-3 py-2 transition-all capitalize"
                  style={{
                    backgroundColor: selectedRoom === room ? "var(--aa-olive-dark)" : "var(--aa-white)",
                    color: selectedRoom === room ? "var(--aa-cream)" : "var(--aa-olive-dark)",
                    border: `1px solid ${selectedRoom === room ? "var(--aa-olive-dark)" : "var(--aa-cream-dark)"}`,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                  }}
                >
                  {room}
                </button>
              ))}
            </div>
          </div>

          {/* Price Tier Filter */}
          <div>
            <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>
              Filter by Price Tier
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTier(null)}
                className="text-xs px-3 py-2 transition-all"
                style={{
                  backgroundColor: selectedTier === null ? "var(--aa-olive-dark)" : "var(--aa-white)",
                  color: selectedTier === null ? "var(--aa-cream)" : "var(--aa-olive-dark)",
                  border: `1px solid ${selectedTier === null ? "var(--aa-olive-dark)" : "var(--aa-cream-dark)"}`,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                All
              </button>
              {PRICE_TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className="text-xs px-3 py-2 transition-all capitalize"
                  style={{
                    backgroundColor: selectedTier === tier ? "var(--aa-olive-dark)" : "var(--aa-white)",
                    color: selectedTier === tier ? "var(--aa-cream)" : "var(--aa-olive-dark)",
                    border: `1px solid ${selectedTier === tier ? "var(--aa-olive-dark)" : "var(--aa-cream-dark)"}`,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
              <p>No suppliers match your filters.</p>
            </div>
          ) : (
            filtered.map((supplier: any) => (
              <div key={supplier.id} className="p-6 module-card-hover" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
                <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  {supplier.name}
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {supplier.room && (
                    <span className="text-xs px-2 py-1" style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem", textTransform: "capitalize" }}>
                      {supplier.room}
                    </span>
                  )}
                  {supplier.priceTier && (
                    <span className="text-xs px-2 py-1" style={{ backgroundColor: "var(--aa-gold)", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem", textTransform: "capitalize" }}>
                      {supplier.priceTier}
                    </span>
                  )}
                </div>
                <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                  {supplier.description}
                </p>
                {supplier.websiteUrl && (
                  <a href={supplier.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                    Visit <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))
          )}
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
