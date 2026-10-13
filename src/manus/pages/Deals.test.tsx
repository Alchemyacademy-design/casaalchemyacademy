import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { orderDeals } from "@/manus/lib/deal-order";
import Deals from "./Deals";
import DealDetail from "./DealDetail";

const mocks = vi.hoisted(() => ({ track: vi.fn(), rpc: vi.fn(), rows: [] as Record<string, unknown>[] }));
vi.mock("@/manus/components/MemberLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/manus/hooks/usePublicContent", () => ({ useActiveDeals: () => ({ data: mocks.rows, isLoading: false }) }));
vi.mock("@/manus/hooks/useTrackDealClick", () => ({ useTrackDealClick: () => ({ mutate: mocks.track }) }));
vi.mock("@/manus/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));

const partner = { id: 2, slug: "creative-canvas", title: "Creative Canvas", created_at: "2026-09-01T00:00:00Z", description: "Full discount details\nCall 0418 213 216", price_label: "Partner discount", external_url: "https://example.com/partner", cover_image_path: "data:image/png;base64,logo" };
const casa = { ...partner, id: 1, slug: "casa-consult", title: "Casa Consult", created_at: "2026-10-01T00:00:00Z" };

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/deals" element={<Deals />} /><Route path="/deals/:slug" element={<DealDetail />} /></Routes></MemoryRouter>);
}

describe("exclusive deal presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [casa, partner];
    mocks.rpc.mockResolvedValue({ data: { terms_accepted: false, payment_verified: false }, error: null });
  });

  it("orders Casa Consult first and partners by creation time then id without mutating input", () => {
    const newer = { ...partner, id: 4, created_at: "2026-09-02T00:00:00Z" };
    const tied = { ...partner, id: 3 };
    const input = [newer, tied, partner, casa];
    expect(orderDeals(input).map(d => d.id)).toEqual([1, 2, 3, 4]);
    expect(input.map(d => d.id)).toEqual([4, 3, 2, 1]);
  });

  it("keeps Casa Consult booking and sends partner redemption externally with tracking", () => {
    open("/deals");
    expect(screen.getByRole("link", { name: /Book Now/ })).toHaveAttribute("href", "/deals/casa-consult");
    const redeem = screen.getByRole("link", { name: /Redeem offer/ });
    expect(redeem).toHaveAttribute("href", partner.external_url);
    expect(redeem).toHaveAttribute("target", "_blank");
    fireEvent.click(redeem);
    expect(mocks.track).toHaveBeenCalledWith(2);
    expect(screen.getByRole("link", { name: "0418 213 216" })).toHaveAttribute("href", "tel:0418213216");
    expect(screen.getByRole("img", { name: partner.title })).toHaveClass("h-auto", "w-full", "object-contain");
    expect(screen.getByText(/Full discount details/)).toBeVisible();
  });

  it("renders partner detail without booking steps or booking requests", () => {
    open("/deals/creative-canvas");
    expect(screen.getByRole("heading", { name: partner.title })).toBeVisible();
    expect(screen.getByText(partner.price_label)).toBeVisible();
    expect(screen.queryByText("Terms & conditions")).not.toBeInTheDocument();
    expect(screen.queryByText("Scheduling")).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
    const visit = screen.getByRole("link", { name: /Visit partner/ });
    expect(visit).toHaveAttribute("href", partner.external_url);
    fireEvent.click(visit);
    expect(mocks.track).toHaveBeenCalledWith(2);
    expect(screen.getByRole("link", { name: "0418 213 216" })).toHaveAttribute("href", "tel:0418213216");
  });

  it("preserves the server-verified Casa Consult flow", async () => {
    open("/deals/casa-consult");
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue to payment" })).toBeVisible());
    expect(mocks.rpc).toHaveBeenCalledWith("deal_booking_status", expect.objectContaining({ p_deal_slug: "casa-consult" }));
    expect(screen.getByText("Scheduling")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Visit partner/ })).not.toBeInTheDocument();
  });
});