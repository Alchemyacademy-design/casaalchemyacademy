import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "react-router-dom";
import { ExternalLink, Heart, Lock } from "lucide-react";
import { trpc } from "@/manus/lib/trpc";
import { useState } from "react";
import { useAuth } from "@/manus/hooks/useAuth";
import { useMySupplierFavorites, useToggleSupplierFavorite } from "@/manus/hooks/usePublicContent";

const PRICE_TIERS = ["budget", "mid", "investment"];
const ROOMS = ["living", "bedroom", "kitchen", "bathroom", "dining", "office", "outdoor"];

type SupplierLike = {
  id?: number | string;
  name?: string | null;
  room?: string | null;
  priceTier?: string | null;
  category?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
};

export default function Suppliers() {
  const { user, isAdmin } = useAuth();
  // Hub not activated yet — show locked overlay for non-admins.
  const SUPPLIERS_HUB_ENABLED = false;
  const locked = !SUPPLIERS_HUB_ENABLED && !isAdmin;
  const { data: suppliers = [] } = trpc.suppliers.publicList.useQuery();
  const { data: favorites = [] } = useMySupplierFavorites(user?.id ?? null);
  const toggleFav = useToggleSupplierFavorite(user?.id ?? null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavOnly, setShowFavOnly] = useState(false);

  const favSet = new Set(favorites);
  const availableCategories = Array.from(
    new Set(
      (suppliers as SupplierLike[])
        .map((s) => s.category)
        .filter((c): c is string => !!c),
    ),
  ).sort();
  const filtered = (suppliers as SupplierLike[]).filter((s) => {
    if (selectedRoom && s.room !== selectedRoom) return false;
    if (selectedTier && s.priceTier !== selectedTier) return false;
    if (selectedCategory && s.category !== selectedCategory) return false;
    if (showFavOnly && (!s.id || !favSet.has(Number(s.id)))) return false;
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



        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div className="mb-8">
            <p className="text-xs mb-3" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>
              Filter by Category
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs px-3 py-2 transition-all"
                style={{
                  backgroundColor: selectedCategory === null ? "var(--aa-olive-dark)" : "var(--aa-white)",
                  color: selectedCategory === null ? "var(--aa-cream)" : "var(--aa-olive-dark)",
                  border: `1px solid ${selectedCategory === null ? "var(--aa-olive-dark)" : "var(--aa-cream-dark)"}`,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                All
              </button>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="text-xs px-3 py-2 transition-all capitalize"
                  style={{
                    backgroundColor: selectedCategory === cat ? "var(--aa-olive-dark)" : "var(--aa-white)",
                    color: selectedCategory === cat ? "var(--aa-cream)" : "var(--aa-olive-dark)",
                    border: `1px solid ${selectedCategory === cat ? "var(--aa-olive-dark)" : "var(--aa-cream-dark)"}`,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Favourites toggle */}
        {user && (
          <div className="mb-6">
            <button
              onClick={() => setShowFavOnly((v) => !v)}
              className="text-xs px-3 py-2 inline-flex items-center gap-2"
              style={{
                backgroundColor: showFavOnly ? "var(--aa-gold)" : "var(--aa-white)",
                color: "var(--aa-olive-dark)",
                border: "1px solid var(--aa-cream-dark)",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <Heart size={12} fill={showFavOnly ? "currentColor" : "none"} /> My favourites ({favorites.length})
            </button>
          </div>
        )}

        {/* Suppliers Grid */}
        <div className="relative">
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${locked ? "blur-sm opacity-60 pointer-events-none select-none" : ""}`}
            aria-hidden={locked}
          >
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
              <p>No suppliers match your filters.</p>
            </div>
          ) : (
            filtered.map((supplier) => {
              const sid = Number(supplier.id);
              const isFav = favSet.has(sid);
              return (
                <div key={supplier.id} className="p-6 module-card-hover relative" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
                  {user && (
                    <button
                      onClick={() => toggleFav.mutate({ supplier_id: sid, currentlyFavorited: isFav })}
                      disabled={toggleFav.isPending}
                      className="absolute top-3 right-3 p-1"
                      aria-label={isFav ? "Remove favourite" : "Save favourite"}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: isFav ? "var(--aa-gold)" : "var(--aa-text-light)" }}
                    >
                      <Heart size={16} fill={isFav ? "currentColor" : "none"} />
                    </button>
                  )}
                  <h3 className="font-serif text-lg mb-2 pr-8" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
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
              );
            })
          )}
          </div>

          {locked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="max-w-md text-center px-8 py-10 backdrop-blur-md"
                style={{
                  backgroundColor: "rgba(255,255,255,0.85)",
                  border: "1px solid var(--aa-cream-dark)",
                }}
              >
                <div
                  className="inline-flex items-center justify-center mb-4"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "var(--aa-olive-dark)",
                    color: "var(--aa-cream)",
                  }}
                >
                  <Lock size={22} />
                </div>
                <p
                  className="section-label mb-2"
                  style={{ color: "var(--aa-gold)" }}
                >
                  Coming soon
                </p>
                <h2
                  className="font-serif text-2xl md:text-3xl mb-3"
                  style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}
                >
                  Supplier Hub launching soon
                </h2>
                <p
                  className="text-sm"
                  style={{
                    color: "var(--aa-text-mid)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 300,
                  }}
                >
                  We&apos;re curating our directory of trusted partners and exclusive
                  member discounts. You&apos;ll be notified as soon as it&apos;s live.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
          <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">
            ← Back
          </Link>
          <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">
            Exit
          </Link>
        </div>
    </MemberLayout>
  );
}
