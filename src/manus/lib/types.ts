// Loose row types for the Supabase facade. They intentionally allow extra
// unknown fields so the migrated code can access optional properties without
// resorting to `any`.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ProfileRow {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  avatar_path?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

export interface MembershipRow {
  id?: string | number;
  plan_key?: string;
  status: string;
  starts_at?: string;
  ends_at: string;
  source?: string;
  metadata?: Record<string, unknown>;
  updated_at?: string;
  [key: string]: unknown;
}

export interface EntitlementRow {
  id: number;
  course_id: number;
  active: boolean;
  starts_at: string;
  ends_at: string;
  stripe_checkout_session_id?: string | null;
  stripe_price_id?: string | null;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ModuleRow {
  id: number;
  number?: number;
  sort_order?: number;
  title?: string;
  description?: string | null;
  tagline?: string;
  lesson_count?: number;
  lessonCount?: number;
  status?: string;
  isPublished?: boolean;
  [key: string]: unknown;
}

export interface LessonRow {
  id: number;
  module_id: number | string;
  moduleId?: number;
  number?: number;
  sort_order?: number;
  title?: string;
  external_video_url?: string;
  videoUrl?: string;
  content_text?: string;
  content?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ProgressRow {
  lessonId: number;
  moduleId: number;
  completed: boolean;
  last_watched_at?: string | null;
  [key: string]: unknown;
}

export interface SupplierRow {
  id: number | string;
  name?: string;
  room?: string | null;
  priceTier?: string | null;
  website_url?: string | null;
  websiteUrl?: string | null;
  category?: string | null;
  supplier_categories?: { name?: string | null } | null;
  [key: string]: unknown;
}

export interface CommunityPostRow {
  id: number | string;
  channel_id?: number | string;
  author_id?: string;
  title?: string;
  body?: string;
  status?: string;
  pinned?: boolean;
  locked?: boolean;
  last_activity_at?: string;
  created_at?: string;
  profiles?: ProfileRow | null;
  [key: string]: unknown;
}

export interface CheckoutSessionRow {
  id?: number | string;
  user_id?: string;
  stripe_session_id?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PaymentRow {
  id?: number | string;
  user_id?: string;
  amount?: number | string | null;
  status?: string;
  [key: string]: unknown;
}

export interface UserAdminRow extends ProfileRow {
  user_roles?: Array<{ role: string }> | null;
  memberships?: Array<{ plan_key?: string; status?: string; ends_at?: string }> | null;
}

export interface CertificateRow {
  id: number | string;
  user_id: string;
  course_id: number | string;
  certificate_number: string;
  issued_at: string;
  issuedAt?: string;
  completionPercentage?: number;
  metadata?: { completion_percentage?: number; [key: string]: unknown };
  [key: string]: unknown;
}
