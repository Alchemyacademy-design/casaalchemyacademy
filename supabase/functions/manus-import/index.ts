// Run the Manus content import as draft. Service-role; idempotent.
// Triggered manually by Lovable agent / admin. No public route should call this.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isPlaceholder = (u: string | null | undefined) =>
  !!u && (u.includes("/manus-storage/") || u.includes("placeholder-video"));
const isLegacy = (p: string | null | undefined) => !!p && p.startsWith("/manus-storage/");

interface PackLesson {
  title: string;
  description?: string | null;
  external_video_url?: string | null;
  external_resource_url?: string | null;
  sort_order: number;
  lesson_number?: number;
  legacy_video_path?: string | null;
  is_preview?: boolean;
}
interface PackModule {
  title: string;
  description?: string | null;
  sort_order?: number;
  lessons?: PackLesson[];
}
interface PackCourse {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  cover_image_path?: string | null;
  sort_order?: number;
  modules?: PackModule[];
}
interface ImportPack {
  warnings?: string[];
  courses?: PackCourse[];
}

interface MissingVideoEntry {
  course: string;
  lesson_number?: number;
  sort_order: number;
  title: string;
  legacy_video_path: string | null;
  status: "PENDING";
}
interface MissingThumbnailEntry {
  course: string;
  legacy_path: string | null;
}
interface ImportReport {
  generated_at: string;
  warnings: string[];
  courses_upserted: number;
  modules_upserted: number;
  lessons_upserted: number;
  missing_video_links: MissingVideoEntry[];
  missing_thumbnails: MissingThumbnailEntry[];
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let pack: ImportPack;
  try {
    const body = (await req.json().catch(() => ({}))) as { pack?: ImportPack };
    if (!body?.pack) {
      // Default pack embedded as raw string fetch from the repo is not possible;
      // require pack in body so any update can be re-imported.
      return new Response(JSON.stringify({ error: "Missing 'pack' in body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    pack = body.pack;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const report: ImportReport = {
    generated_at: new Date().toISOString(),
    warnings: pack.warnings ?? [],
    courses_upserted: 0,
    modules_upserted: 0,
    lessons_upserted: 0,
    missing_video_links: [],
    missing_thumbnails: [],
    errors: [],
  };

  try {
    for (const c of pack.courses ?? []) {
      const slug = c.slug;
      const coursePayload = {
        slug,
        title: c.title,
        subtitle: c.subtitle ?? null,
        description: c.description ?? null,
        cover_image_path: c.cover_image_path ?? null,
        sort_order: c.sort_order ?? 0,
        status: "draft" as const,
      };
      const { data: existing } = await supabase.from("courses").select("id").eq("slug", slug).maybeSingle();
      let courseId: number;
      if (existing) {
        const { error } = await supabase.from("courses").update(coursePayload).eq("id", existing.id);
        if (error) throw new Error(`courses update ${slug}: ${error.message}`);
        courseId = existing.id;
      } else {
        const { data, error } = await supabase.from("courses").insert(coursePayload).select("id").single();
        if (error) throw new Error(`courses insert ${slug}: ${error.message}`);
        courseId = data.id;
      }
      report.courses_upserted++;
      if (isLegacy(c.cover_image_path)) report.missing_thumbnails.push({ course: slug, legacy_path: c.cover_image_path });

      for (const m of c.modules ?? []) {
        const modPayload = {
          course_id: courseId,
          title: m.title,
          description: m.description ?? null,
          sort_order: m.sort_order ?? 1,
          status: "draft" as const,
        };
        const { data: existMod } = await supabase
          .from("course_modules").select("id").eq("course_id", courseId).eq("sort_order", modPayload.sort_order).maybeSingle();
        let moduleId: number;
        if (existMod) {
          const { error } = await supabase.from("course_modules").update(modPayload).eq("id", existMod.id);
          if (error) throw new Error(`module update ${slug} ${m.title}: ${error.message}`);
          moduleId = existMod.id;
        } else {
          const { data, error } = await supabase.from("course_modules").insert(modPayload).select("id").single();
          if (error) throw new Error(`module insert ${slug} ${m.title}: ${error.message}`);
          moduleId = data.id;
        }
        report.modules_upserted++;

        for (const l of m.lessons ?? []) {
          const safe = l.external_video_url && !isPlaceholder(l.external_video_url) ? l.external_video_url : null;
          if (!safe) {
            report.missing_video_links.push({
              course: slug,
              lesson_number: l.lesson_number,
              sort_order: l.sort_order,
              title: l.title,
              legacy_video_path: l.legacy_video_path ?? null,
              status: "PENDING",
            });
          }
          const lessonPayload = {
            module_id: moduleId,
            title: l.title,
            description: l.description ?? null,
            external_video_url: safe,
            external_resource_url: l.external_resource_url ?? null,
            sort_order: l.sort_order,
            is_preview: !!l.is_preview,
            status: "draft" as const,
          };
          const { data: existLesson } = await supabase
            .from("lessons").select("id").eq("module_id", moduleId).eq("sort_order", l.sort_order).maybeSingle();
          if (existLesson) {
            const { error } = await supabase.from("lessons").update(lessonPayload).eq("id", existLesson.id);
            if (error) throw new Error(`lesson update ${slug} ${l.sort_order}: ${error.message}`);
          } else {
            const { error } = await supabase.from("lessons").insert(lessonPayload);
            if (error) throw new Error(`lesson insert ${slug} ${l.sort_order}: ${error.message}`);
          }
          report.lessons_upserted++;
        }
      }
    }
  } catch (e) {
    report.errors.push((e as Error).message);
  }

  return new Response(JSON.stringify(report), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: report.errors.length ? 207 : 200,
  });
});
