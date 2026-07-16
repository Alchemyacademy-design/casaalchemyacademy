import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "list_my_certificates",
  title: "List my certificates",
  description: "List certificates issued to the signed-in user in Alchemy Academy, including the course title, certificate number, issue date, and the public share link when the certificate is public.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await supabase
      .from("certificates")
      .select("id, certificate_number, issued_at, revoked_at, public_slug, course_id, courses(title)")
      .order("issued_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    // Build absolute public link when a slug exists. Fall back to the direct
    // supabase host origin at extract-time; the SITE_URL secret (when set)
    // gives the app's canonical origin at runtime.
    const siteUrl = process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL ?? "";
    const rows = (data ?? []).map((r) => {
      const course = (r as { courses?: { title?: string } | null }).courses;
      return {
        id: r.id,
        certificate_number: r.certificate_number,
        issued_at: r.issued_at,
        revoked: Boolean(r.revoked_at),
        course_id: r.course_id,
        course_title: course?.title ?? null,
        public_link: r.public_slug && siteUrl ? `${siteUrl.replace(/\/$/, "")}/c/${r.public_slug}` : (r.public_slug ? `/c/${r.public_slug}` : null),
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { certificates: rows },
    };
  },
});