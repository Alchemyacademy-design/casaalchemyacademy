type OrderedDeal = { slug: string | null; created_at: string; id: number };

/** Casa Consult leads; partner offers retain stable oldest-first ordering. */
export function orderDeals<T extends OrderedDeal>(deals: readonly T[]): T[] {
  return [...deals].sort((a, b) => {
    const priority = Number(b.slug === "casa-consult") - Number(a.slug === "casa-consult");
    return priority || Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
  });
}