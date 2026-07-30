import { supabase } from "@/integrations/supabase/client";

export type MaterialKind = "lesson" | "module" | "course" | "bonus";

export type SupportMaterial = {
  id: number;
  lesson_id: number | null;
  module_id: number | null;
  course_id: number | null;
  material_kind: MaterialKind;
  title: string | null;
  description: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string | null;
  external_url: string | null;
  file_type: string | null;
  file_size: number | null;
  is_downloadable: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
};

const SELECT =
  "id,lesson_id,module_id,course_id,material_kind,title,description,file_name,storage_bucket,storage_path,external_url,file_type,file_size,is_downloadable,is_public,sort_order,created_at";

export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt",
  "zip", "png", "jpg", "jpeg", "webp", "gif", "svg", "mp3", "wav",
];

function extensionOf(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

export function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export type MaterialScope =
  | { courseId: number }
  | { moduleId: number }
  | { lessonId: number }
  | { bonus: true };

export function scopeKindOf(scope: MaterialScope): MaterialKind {
  if ("courseId" in scope) return "course";
  if ("moduleId" in scope) return "module";
  if ("lessonId" in scope) return "lesson";
  return "bonus";
}

export function scopeKeyOf(scope: MaterialScope): string {
  if ("courseId" in scope) return `course-${scope.courseId}`;
  if ("moduleId" in scope) return `module-${scope.moduleId}`;
  if ("lessonId" in scope) return `lesson-${scope.lessonId}`;
  return "bonus";
}

function scopeColumns(scope: MaterialScope) {
  return {
    material_kind: scopeKindOf(scope),
    course_id: "courseId" in scope ? scope.courseId : null,
    module_id: "moduleId" in scope ? scope.moduleId : null,
    lesson_id: "lessonId" in scope ? scope.lessonId : null,
  };
}

export async function listMaterials(scope: MaterialScope): Promise<SupportMaterial[]> {
  let query = supabase.from("lesson_attachments").select(SELECT);
  if ("courseId" in scope) query = query.eq("course_id", scope.courseId);
  else if ("moduleId" in scope) query = query.eq("module_id", scope.moduleId);
  else if ("lessonId" in scope) query = query.eq("lesson_id", scope.lessonId);
  else query = query.eq("material_kind", "bonus");
  const { data, error } = await query.order("sort_order", { ascending: true }).order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SupportMaterial[];
}

/** Central library: every material, whatever it is associated with. */
export async function listAllMaterials(): Promise<SupportMaterial[]> {
  const { data, error } = await supabase
    .from("lesson_attachments")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as SupportMaterial[];
}

/** Move a material to another association (course / module / lesson / bonus). */
export async function reassignMaterial(id: number, scope: MaterialScope) {
  const { error } = await supabase.from("lesson_attachments").update(scopeColumns(scope)).eq("id", id);
  if (error) throw error;
}

export async function listMaterialsForLessons(lessonIds: number[]): Promise<SupportMaterial[]> {
  if (lessonIds.length === 0) return [];
  const { data, error } = await supabase
    .from("lesson_attachments")
    .select(SELECT)
    .in("lesson_id", lessonIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SupportMaterial[];
}

export async function uploadMaterialFile(params: {
  scope: MaterialScope;
  file: File;
  title?: string;
  description?: string | null;
  isDownloadable?: boolean;
  sortOrder?: number;
  onProgress?: (percent: number) => void;
}): Promise<SupportMaterial> {
  const { scope, file } = params;
  if (file.size > MAX_MATERIAL_BYTES) {
    throw new Error(`File is too large (max ${formatBytes(MAX_MATERIAL_BYTES)}).`);
  }
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ".${ext}" is not allowed.`);
  }

  const folder = scopeKeyOf(scope);
  const path = `materials/${folder}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  params.onProgress?.(10);
  const { error: uploadError } = await supabase.storage
    .from("course-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  params.onProgress?.(80);

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("lesson_attachments")
    .insert({
      ...scopeColumns(scope),
      title: params.title?.trim() || file.name,
      description: params.description?.trim() || null,
      file_name: file.name,
      storage_bucket: "course-assets",
      storage_path: path,
      file_type: file.type || ext,
      file_size: file.size,
      is_downloadable: params.isDownloadable ?? true,
      sort_order: params.sortOrder ?? 0,
      created_by: userData.user?.id ?? null,
    })
    .select(SELECT)
    .single();

  if (error) {
    await supabase.storage.from("course-assets").remove([path]);
    throw error;
  }
  params.onProgress?.(100);
  return data as unknown as SupportMaterial;
}

export async function createMaterialLink(params: {
  scope: MaterialScope;
  url: string;
  title: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<SupportMaterial> {
  const url = params.url.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Enter a valid URL starting with http:// or https://");
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("lesson_attachments")
    .insert({
      ...scopeColumns(params.scope),
      title: params.title.trim() || url,
      description: params.description?.trim() || null,
      file_name: params.title.trim() || url,
      storage_bucket: "course-assets",
      storage_path: null,
      external_url: url,
      file_type: "link",
      is_downloadable: true,
      sort_order: params.sortOrder ?? 0,
      created_by: userData.user?.id ?? null,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as SupportMaterial;
}

export async function updateMaterial(
  id: number,
  patch: Partial<
    Pick<SupportMaterial, "title" | "description" | "external_url" | "is_downloadable" | "is_public" | "sort_order">
  >,
) {
  const { error } = await supabase.from("lesson_attachments").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMaterial(material: SupportMaterial) {
  if (material.storage_path) {
    await supabase.storage.from(material.storage_bucket || "course-assets").remove([material.storage_path]);
  }
  const { error } = await supabase.from("lesson_attachments").delete().eq("id", material.id);
  if (error) throw error;
}

/** Returns an openable URL: the external link, or a short-lived signed URL. */
export async function getMaterialUrl(material: SupportMaterial): Promise<string> {
  if (material.external_url) return material.external_url;
  if (!material.storage_path) throw new Error("Material has no file.");
  const { data, error } = await supabase.storage
    .from(material.storage_bucket || "course-assets")
    .createSignedUrl(material.storage_path, 60 * 10, material.is_downloadable ? { download: material.file_name } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
