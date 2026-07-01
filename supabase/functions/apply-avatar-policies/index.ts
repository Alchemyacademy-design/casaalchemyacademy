// One-shot admin utility: applies avatar storage policies. Idempotent.
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    await sql.unsafe(`
      drop policy if exists "avatars_insert_own" on storage.objects;
      create policy "avatars_insert_own"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'public-assets'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );

      drop policy if exists "avatars_update_own" on storage.objects;
      create policy "avatars_update_own"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'public-assets'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'public-assets'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );

      drop policy if exists "avatars_delete_own" on storage.objects;
      create policy "avatars_delete_own"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'public-assets'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
    `);

    const policies = await sql`
      select policyname from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('avatars_insert_own','avatars_update_own','avatars_delete_own')
      order by policyname
    `;

    return new Response(JSON.stringify({ ok: true, policies }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
