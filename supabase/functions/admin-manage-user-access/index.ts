// Admin-only edge function: grant/revoke memberships, course entitlements, and roles.
// Auth: validates JWT and confirms admin role server-side. Service role is used
// only inside this function. Designated platform admin cannot be demoted/revoked.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DESIGNATED_ADMIN_EMAIL = "contact@casaalchemystudio.com";

type Action =
  | "grant_membership"
  | "revoke_membership"
  | "grant_course_entitlement"
  | "revoke_course_entitlement"
  | "promote_admin"
  | "demote_admin"
  | "delete_user";

interface Payload {
  action: Action;
  target_user_id: string;
  plan_key?: "monthly_member" | "annual_member";
  course_id?: number;
  starts_at?: string;
  ends_at?: string;
  reason?: string;
  membership_id?: number;
  entitlement_id?: number;
  confirmation_email?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);

  const actorId = claims.claims.sub as string;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: actorRoles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", actorId);
  if (roleErr) return json({ error: "role_lookup_failed" }, 500);
  const isAdmin = (actorRoles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body || !body.action || !isUuid(body.target_user_id)) {
    return json({ error: "invalid_payload" }, 400);
  }

  // Resolve target user email to enforce designated-admin protections.
  const { data: targetUser } = await admin.auth.admin.getUserById(body.target_user_id);
  if (!targetUser?.user) return json({ error: "target_not_found" }, 404);
  const targetEmail = (targetUser.user.email ?? "").trim().toLowerCase();
  const isDesignated = targetEmail === DESIGNATED_ADMIN_EMAIL;

  const audit = async (
    action: string,
    entity_type: string | null,
    entity_id: string | null,
    before_state: unknown,
    after_state: unknown,
  ) => {
    await admin.from("admin_access_audit_log").insert({
      actor_user_id: actorId,
      target_user_id: body.target_user_id,
      action,
      entity_type,
      entity_id,
      reason: body.reason ?? null,
      before_state: before_state ?? null,
      after_state: after_state ?? null,
    });
  };

  try {
    switch (body.action) {
      case "promote_admin": {
        const { data, error } = await admin
          .from("user_roles")
          .upsert(
            { user_id: body.target_user_id, role: "admin" },
            { onConflict: "user_id,role" },
          )
          .select()
          .maybeSingle();
        if (error) throw error;
        await audit("promote_admin", "user_roles", String(data?.id ?? ""), null, data);
        return json({ ok: true, data });
      }

      case "demote_admin": {
        if (isDesignated) return json({ error: "designated_admin_protected" }, 403);
        const { data: before } = await admin
          .from("user_roles")
          .select("*")
          .eq("user_id", body.target_user_id)
          .eq("role", "admin")
          .maybeSingle();
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", body.target_user_id)
          .eq("role", "admin");
        if (error) throw error;
        await audit("demote_admin", "user_roles", String(before?.id ?? ""), before, null);
        return json({ ok: true });
      }

      case "grant_membership": {
        if (body.plan_key !== "monthly_member" && body.plan_key !== "annual_member") {
          return json({ error: "invalid_plan_key" }, 400);
        }
        const starts = body.starts_at ? new Date(body.starts_at) : new Date();
        const ends = body.ends_at
          ? new Date(body.ends_at)
          : new Date(
              starts.getTime() +
                (body.plan_key === "annual_member" ? 365 : 30) * 86400000,
            );
        if (isNaN(starts.getTime()) || isNaN(ends.getTime()) || ends <= starts) {
          return json({ error: "invalid_dates" }, 400);
        }
        const { data, error } = await admin
          .from("memberships")
          .insert({
            user_id: body.target_user_id,
            plan_key: body.plan_key,
            status: "active",
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            source: "manual",
            metadata: { assigned_by: actorId, reason: body.reason ?? null },
          })
          .select()
          .single();
        if (error) throw error;
        await audit("grant_membership", "memberships", String(data.id), null, data);
        return json({ ok: true, data });
      }

      case "revoke_membership": {
        if (!body.membership_id) return json({ error: "membership_id_required" }, 400);
        const { data: before } = await admin
          .from("memberships")
          .select("*")
          .eq("id", body.membership_id)
          .eq("user_id", body.target_user_id)
          .maybeSingle();
        if (!before) return json({ error: "membership_not_found" }, 404);
        if (before.source !== "manual") {
          return json(
            { error: "only_manual_memberships_revocable_here" },
            400,
          );
        }
        const { data, error } = await admin
          .from("memberships")
          .update({
            status: "cancelled",
            ends_at: new Date().toISOString(),
            metadata: {
              ...((before.metadata as Record<string, unknown> | null) ?? {}),
              revoked_by: actorId,
              revoked_reason: body.reason ?? null,
            },
          })
          .eq("id", body.membership_id)
          .select()
          .single();
        if (error) throw error;
        await audit(
          "revoke_membership",
          "memberships",
          String(body.membership_id),
          before,
          data,
        );
        return json({ ok: true, data });
      }

      case "grant_course_entitlement": {
        if (!body.course_id) return json({ error: "course_id_required" }, 400);
        const { data: course } = await admin
          .from("courses")
          .select("id")
          .eq("id", body.course_id)
          .maybeSingle();
        if (!course) return json({ error: "course_not_found" }, 404);

        const starts = body.starts_at ? new Date(body.starts_at) : new Date();
        const ends = body.ends_at
          ? new Date(body.ends_at)
          : new Date(starts.getTime() + 90 * 86400000);
        if (isNaN(starts.getTime()) || isNaN(ends.getTime()) || ends <= starts) {
          return json({ error: "invalid_dates" }, 400);
        }
        const { data, error } = await admin
          .from("course_entitlements")
          .insert({
            user_id: body.target_user_id,
            course_id: body.course_id,
            active: true,
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            source: "manual",
            metadata: { assigned_by: actorId, reason: body.reason ?? null },
          })
          .select()
          .single();
        if (error) throw error;
        await audit(
          "grant_course_entitlement",
          "course_entitlements",
          String(data.id),
          null,
          data,
        );
        return json({ ok: true, data });
      }

      case "revoke_course_entitlement": {
        if (!body.entitlement_id) return json({ error: "entitlement_id_required" }, 400);
        const { data: before } = await admin
          .from("course_entitlements")
          .select("*")
          .eq("id", body.entitlement_id)
          .eq("user_id", body.target_user_id)
          .maybeSingle();
        if (!before) return json({ error: "entitlement_not_found" }, 404);
        if (before.source !== "manual") {
          return json(
            { error: "only_manual_entitlements_revocable_here" },
            400,
          );
        }
        const { data, error } = await admin
          .from("course_entitlements")
          .update({
            active: false,
            ends_at: new Date().toISOString(),
            metadata: {
              ...((before.metadata as Record<string, unknown> | null) ?? {}),
              revoked_by: actorId,
              revoked_reason: body.reason ?? null,
            },
          })
          .eq("id", body.entitlement_id)
          .select()
          .single();
        if (error) throw error;
        await audit(
          "revoke_course_entitlement",
          "course_entitlements",
          String(body.entitlement_id),
          before,
          data,
        );
        return json({ ok: true, data });
      }

      case "delete_user": {
        if (isDesignated) return json({ error: "designated_admin_protected" }, 403);
        if (body.target_user_id === actorId) {
          return json({ error: "cannot_delete_self" }, 400);
        }
        const typed = (body.confirmation_email ?? "").trim().toLowerCase();
        if (!typed || typed !== targetEmail) {
          return json({ error: "confirmation_email_mismatch" }, 400);
        }

        const { data: beforeProfile } = await admin
          .from("profiles")
          .select("*")
          .eq("id", body.target_user_id)
          .maybeSingle();

        // Audit first — the row must survive the user deletion.
        await audit(
          "delete_user",
          "auth.users",
          body.target_user_id,
          { profile: beforeProfile, email: targetEmail },
          null,
        );

        // Best-effort cleanup of app-owned data. Tables with ON DELETE CASCADE
        // are handled by Postgres; these deletes cover the rest.
        const userScoped: [string, string][] = [
          ["memberships", "user_id"],
          ["course_entitlements", "user_id"],
          ["user_roles", "user_id"],
          ["notifications", "user_id"],
          ["lesson_progress", "user_id"],
          ["lesson_notes", "user_id"],
          ["lesson_ratings", "user_id"],
          ["lesson_comments", "user_id"],
          ["quiz_attempts", "user_id"],
          ["registrations", "user_id"],
          ["channel_follows", "user_id"],
          ["community_reads", "user_id"],
          ["community_reactions", "user_id"],
          ["supplier_favorites", "user_id"],
          ["user_favorites", "user_id"],
          ["stripe_customers", "user_id"],
        ];
        const cleanupErrors: string[] = [];
        for (const [table, column] of userScoped) {
          const { error } = await admin.from(table).delete().eq(column, body.target_user_id);
          if (error) cleanupErrors.push(`${table}: ${error.message}`);
        }
        await admin.from("community_replies").delete().eq("author_id", body.target_user_id);
        await admin.from("community_posts").delete().eq("author_id", body.target_user_id);
        await admin.from("profiles").delete().eq("id", body.target_user_id);

        const { error: delErr } = await admin.auth.admin.deleteUser(body.target_user_id);
        if (delErr) {
          return json({ error: "delete_failed", message: delErr.message, cleanupErrors }, 500);
        }
        return json({ ok: true, deleted: body.target_user_id, cleanupErrors });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "action_failed", message }, 500);
  }
});
