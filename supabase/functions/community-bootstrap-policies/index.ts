// TEMPORARY one-shot bootstrap for the Community center.
// - Ensures GRANTs to authenticated / anon / service_role
// - Ensures admin_full_access policies via public.has_role()
// - Adds author/member policies on community_* tables
// - Adds tables to the supabase_realtime publication
// - Sets REPLICA IDENTITY FULL so realtime payloads contain full rows
//
// Safe to call multiple times (idempotent). Delete this function after running.

import postgres from "npm:postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STEPS: Array<{ name: string; sql: string }> = [
  // ---------- GRANTS ----------
  {
    name: "grants_community_spaces",
    sql: `
      grant select on public.community_spaces to anon, authenticated;
      grant insert, update, delete on public.community_spaces to authenticated;
      grant all on public.community_spaces to service_role;
    `,
  },
  {
    name: "grants_community_channels",
    sql: `
      grant select on public.community_channels to anon, authenticated;
      grant insert, update, delete on public.community_channels to authenticated;
      grant all on public.community_channels to service_role;
    `,
  },
  {
    name: "grants_community_posts",
    sql: `
      grant select on public.community_posts to authenticated;
      grant insert, update, delete on public.community_posts to authenticated;
      grant all on public.community_posts to service_role;
    `,
  },
  {
    name: "grants_community_replies",
    sql: `
      grant select on public.community_replies to authenticated;
      grant insert, update, delete on public.community_replies to authenticated;
      grant all on public.community_replies to service_role;
    `,
  },
  {
    name: "grants_community_reactions",
    sql: `
      grant select on public.community_reactions to authenticated;
      grant insert, delete on public.community_reactions to authenticated;
      grant all on public.community_reactions to service_role;
    `,
  },
  {
    name: "grants_moderation_actions",
    sql: `
      grant select on public.moderation_actions to authenticated;
      grant insert on public.moderation_actions to authenticated;
      grant all on public.moderation_actions to service_role;
    `,
  },

  // ---------- ENABLE RLS ----------
  {
    name: "enable_rls",
    sql: `
      alter table public.community_spaces    enable row level security;
      alter table public.community_channels  enable row level security;
      alter table public.community_posts     enable row level security;
      alter table public.community_replies   enable row level security;
      alter table public.community_reactions enable row level security;
      alter table public.moderation_actions  enable row level security;
    `,
  },

  // ---------- ADMIN FULL ACCESS (idempotent) ----------
  {
    name: "admin_full_access_policies",
    sql: `
      do $$
      declare t text;
      begin
        foreach t in array array[
          'community_spaces','community_channels','community_posts',
          'community_replies','community_reactions','moderation_actions'
        ] loop
          execute format('drop policy if exists admin_full_access on public.%I', t);
          execute format(
            'create policy admin_full_access on public.%I as permissive for all to authenticated using (public.has_role(auth.uid(), ''admin''::public.app_role)) with check (public.has_role(auth.uid(), ''admin''::public.app_role))',
            t
          );
        end loop;
      end$$;
    `,
  },

  // ---------- MEMBER READ POLICIES ----------
  {
    name: "spaces_member_select",
    sql: `
      drop policy if exists "community_spaces_member_select" on public.community_spaces;
      create policy "community_spaces_member_select"
        on public.community_spaces for select
        to anon, authenticated
        using (status = 'published');
    `,
  },
  {
    name: "channels_member_select",
    sql: `
      drop policy if exists "community_channels_member_select" on public.community_channels;
      create policy "community_channels_member_select"
        on public.community_channels for select
        to anon, authenticated
        using (
          status = 'published'
          and exists (
            select 1 from public.community_spaces s
            where s.id = community_channels.space_id and s.status = 'published'
          )
        );
    `,
  },
  {
    name: "posts_member_select",
    sql: `
      drop policy if exists "community_posts_member_select" on public.community_posts;
      create policy "community_posts_member_select"
        on public.community_posts for select
        to authenticated
        using (
          deleted_at is null
          and hidden_at is null
          and exists (
            select 1 from public.community_channels c
            where c.id = community_posts.channel_id and c.status = 'published'
          )
        );
    `,
  },
  {
    name: "replies_member_select",
    sql: `
      drop policy if exists "community_replies_member_select" on public.community_replies;
      create policy "community_replies_member_select"
        on public.community_replies for select
        to authenticated
        using (
          deleted_at is null
          and hidden_at is null
        );
    `,
  },
  {
    name: "reactions_member_select",
    sql: `
      drop policy if exists "community_reactions_member_select" on public.community_reactions;
      create policy "community_reactions_member_select"
        on public.community_reactions for select
        to authenticated
        using (true);
    `,
  },

  // ---------- AUTHOR WRITE POLICIES ----------
  {
    name: "posts_author_insert",
    sql: `
      drop policy if exists "community_posts_author_insert" on public.community_posts;
      create policy "community_posts_author_insert"
        on public.community_posts for insert
        to authenticated
        with check (
          author_id = auth.uid()
          and exists (
            select 1 from public.community_channels c
            where c.id = channel_id and c.status = 'published'
          )
        );
    `,
  },
  {
    name: "posts_author_update",
    sql: `
      drop policy if exists "community_posts_author_update" on public.community_posts;
      create policy "community_posts_author_update"
        on public.community_posts for update
        to authenticated
        using (author_id = auth.uid())
        with check (author_id = auth.uid());
    `,
  },
  {
    name: "posts_author_delete",
    sql: `
      drop policy if exists "community_posts_author_delete" on public.community_posts;
      create policy "community_posts_author_delete"
        on public.community_posts for delete
        to authenticated
        using (author_id = auth.uid());
    `,
  },
  {
    name: "replies_author_insert",
    sql: `
      drop policy if exists "community_replies_author_insert" on public.community_replies;
      create policy "community_replies_author_insert"
        on public.community_replies for insert
        to authenticated
        with check (
          author_id = auth.uid()
          and exists (
            select 1 from public.community_posts p
            where p.id = post_id and p.locked = false and p.deleted_at is null
          )
        );
    `,
  },
  {
    name: "replies_author_update",
    sql: `
      drop policy if exists "community_replies_author_update" on public.community_replies;
      create policy "community_replies_author_update"
        on public.community_replies for update
        to authenticated
        using (author_id = auth.uid())
        with check (author_id = auth.uid());
    `,
  },
  {
    name: "replies_author_delete",
    sql: `
      drop policy if exists "community_replies_author_delete" on public.community_replies;
      create policy "community_replies_author_delete"
        on public.community_replies for delete
        to authenticated
        using (author_id = auth.uid());
    `,
  },
  {
    name: "reactions_author_insert",
    sql: `
      drop policy if exists "community_reactions_author_insert" on public.community_reactions;
      create policy "community_reactions_author_insert"
        on public.community_reactions for insert
        to authenticated
        with check (user_id = auth.uid());
    `,
  },
  {
    name: "reactions_author_delete",
    sql: `
      drop policy if exists "community_reactions_author_delete" on public.community_reactions;
      create policy "community_reactions_author_delete"
        on public.community_reactions for delete
        to authenticated
        using (user_id = auth.uid());
    `,
  },

  // ---------- REPLICA IDENTITY (for realtime payloads) ----------
  {
    name: "replica_identity_full",
    sql: `
      alter table public.community_posts     replica identity full;
      alter table public.community_replies   replica identity full;
      alter table public.community_reactions replica identity full;
    `,
  },

  // ---------- REALTIME PUBLICATION ----------
  {
    name: "realtime_publication",
    sql: `
      do $$
      declare t text;
      begin
        foreach t in array array[
          'community_posts','community_replies','community_reactions',
          'community_channels','community_spaces'
        ] loop
          if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = t
          ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
          end if;
        end loop;
      end$$;
    `,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return json({ ok: false, error: "missing_db_url" }, 500);

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  const results: Array<{ step: string; ok: boolean; error?: string }> = [];

  try {
    for (const step of STEPS) {
      try {
        await sql.unsafe(step.sql);
        results.push({ step: step.name, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ step: step.name, ok: false, error: message });
        console.error(`[${step.name}] failed:`, message);
      }
    }
    const failed = results.filter((r) => !r.ok);
    return json({ ok: failed.length === 0, steps: results, failed_count: failed.length });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
