import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

export interface NotificationRow {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

const KEY = (userId: string | null | undefined) => ["notifications", userId ?? null] as const;

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY(user?.id),
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
      const { data, error } = await client
        .from("notifications")
        .select("id,kind,title,body,href,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error as Error;
      return (data as NotificationRow[]) ?? [];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: KEY(user.id) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return query;
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | "all") => {
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (c: string, v: string | number) => Promise<{ error: unknown }> & {
              is: (c: string, v: unknown) => Promise<{ error: unknown }>;
            };
          };
        };
      };
      if (id === "all") {
        const { error } = await client
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("user_id", user?.id ?? "")
          .is("read_at", null);
        if (error) throw error as Error;
      } else {
        const { error } = await client
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error as Error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(user?.id) }),
  });
}