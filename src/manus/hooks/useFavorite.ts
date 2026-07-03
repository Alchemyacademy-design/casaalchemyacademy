import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export type FavoriteEntity = "deal" | "supplier" | "magazine" | "post";

function keyFor(userId: string | null | undefined, entityType: FavoriteEntity) {
  return ["user-favorites", userId ?? null, entityType] as const;
}

/** Read the caller's favorites of a given entity type. Returns a Set of entity_ids as strings. */
export function useFavorites(entityType: FavoriteEntity) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keyFor(user?.id, entityType),
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: unknown; error: unknown }> } };
      })
        .from("user_favorites")
        .select("entity_id")
        .eq("entity_type", entityType);
      if (error) throw error as Error;
      const rows = (data as Array<{ entity_id: string }>) ?? [];
      return new Set(rows.map((r) => String(r.entity_id)));
    },
  });
}

/** Toggle a favorite. Optimistically updates the set. */
export function useToggleFavorite(entityType: FavoriteEntity) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entityId, next }: { entityId: string | number; next: boolean }) => {
      if (!user?.id) throw new Error("Sign in to save favorites");
      const id = String(entityId);
      const client = supabase as unknown as {
        from: (t: string) => {
          insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
          delete: () => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
            };
          };
        };
      };
      if (next) {
        const { error } = await client
          .from("user_favorites")
          .insert({ user_id: user.id, entity_type: entityType, entity_id: id });
        if (error) throw error as Error;
      } else {
        const { error } = await client
          .from("user_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("entity_type", entityType)
          .eq("entity_id", id);
        if (error) throw error as Error;
      }
      return { entityId: id, next };
    },
    onMutate: async ({ entityId, next }) => {
      const key = keyFor(user?.id, entityType);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Set<string>>(key) ?? new Set<string>();
      const nextSet = new Set(prev);
      if (next) nextSet.add(String(entityId));
      else nextSet.delete(String(entityId));
      qc.setQueryData(key, nextSet);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keyFor(user?.id, entityType), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keyFor(user?.id, entityType) });
    },
  });
}