export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      certificate_views: {
        Row: {
          certificate_id: number
          id: number
          referrer: string | null
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          certificate_id: number
          id?: number
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          certificate_id?: number
          id?: number
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_views_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          certificate_type: string
          certificate_url: string | null
          course_id: number | null
          created_at: string
          id: number
          issued_at: string
          metadata: Json
          pdf_cached_path: string | null
          public_slug: string | null
          revoked_at: string | null
          user_id: string
          verification_hash: string | null
        }
        Insert: {
          certificate_number: string
          certificate_type?: string
          certificate_url?: string | null
          course_id?: number | null
          created_at?: string
          id?: never
          issued_at?: string
          metadata?: Json
          pdf_cached_path?: string | null
          public_slug?: string | null
          revoked_at?: string | null
          user_id: string
          verification_hash?: string | null
        }
        Update: {
          certificate_number?: string
          certificate_type?: string
          certificate_url?: string | null
          course_id?: number | null
          created_at?: string
          id?: never
          issued_at?: string
          metadata?: Json
          pdf_cached_path?: string | null
          public_slug?: string | null
          revoked_at?: string | null
          user_id?: string
          verification_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_follows: {
        Row: {
          channel_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          channel_id: number
          created_at?: string
          user_id: string
        }
        Update: {
          channel_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_follows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_rate_limits: {
        Row: {
          attempt_count: number
          last_checkout_session_id: string | null
          last_idempotency_key: string | null
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          last_checkout_session_id?: string | null
          last_idempotency_key?: string | null
          updated_at?: string
          user_id: string
          window_start: string
        }
        Update: {
          attempt_count?: number
          last_checkout_session_id?: string | null
          last_idempotency_key?: string | null
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      community_channels: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          space_id: number
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          created_at?: string
          description?: string | null
          id?: never
          name: string
          slug: string
          sort_order?: number
          space_id: number
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          created_at?: string
          description?: string | null
          id?: never
          name?: string
          slug?: string
          sort_order?: number
          space_id?: number
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_channels_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          archived_at: string | null
          author_id: string
          body: string
          channel_id: number
          created_at: string
          deleted_at: string | null
          hidden_at: string | null
          id: number
          last_activity_at: string
          locked: boolean
          pinned: boolean
          source_course_id: number | null
          source_lesson_id: number | null
          status: Database["public"]["Enums"]["community_content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          body: string
          channel_id: number
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          id?: never
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          source_course_id?: number | null
          source_lesson_id?: number | null
          status?: Database["public"]["Enums"]["community_content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          body?: string
          channel_id?: number
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          id?: never
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          source_course_id?: number | null
          source_lesson_id?: number | null
          status?: Database["public"]["Enums"]["community_content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_source_lesson_id_fkey"
            columns: ["source_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string
          id: number
          post_id: number | null
          reaction: string
          reply_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          post_id?: number | null
          reaction: string
          reply_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          post_id?: number | null
          reaction?: string
          reply_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "community_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reads: {
        Row: {
          channel_id: number
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: number
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: number
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      community_replies: {
        Row: {
          archived_at: string | null
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          hidden_at: string | null
          id: number
          post_id: number
          status: Database["public"]["Enums"]["community_content_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          id?: never
          post_id: number
          status?: Database["public"]["Enums"]["community_content_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          id?: never
          post_id?: number
          status?: Database["public"]["Enums"]["community_content_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_spaces: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          created_at?: string
          description?: string | null
          id?: never
          name: string
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          created_at?: string
          description?: string | null
          id?: never
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
        }
        Relationships: []
      }
      course_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          course_id: number | null
          created_at: string
          entity_id: number | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          course_id?: number | null
          created_at?: string
          entity_id?: number | null
          entity_type: string
          id?: number
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          course_id?: number | null
          created_at?: string
          entity_id?: number | null
          entity_type?: string
          id?: number
        }
        Relationships: []
      }
      course_categories: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      course_entitlements: {
        Row: {
          active: boolean
          course_id: number
          created_at: string
          ends_at: string
          id: number
          last_stripe_event_created_at: string | null
          last_stripe_event_id: string | null
          last_synced_at: string | null
          metadata: Json
          source: string
          starts_at: string
          stripe_checkout_session_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          course_id: number
          created_at?: string
          ends_at: string
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          metadata?: Json
          source?: string
          starts_at?: string
          stripe_checkout_session_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          course_id?: number
          created_at?: string
          ends_at?: string
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          metadata?: Json
          source?: string
          starts_at?: string
          stripe_checkout_session_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_entitlements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at: string | null
          course_id: number
          cover_image_path: string | null
          created_at: string
          description: string | null
          id: number
          prerequisite_module_id: number | null
          published_at: string | null
          release_after_days: number | null
          release_at: string | null
          release_type: Database["public"]["Enums"]["course_release_type"]
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at?: string | null
          course_id: number
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          id?: never
          prerequisite_module_id?: number | null
          published_at?: string | null
          release_after_days?: number | null
          release_at?: string | null
          release_type?: Database["public"]["Enums"]["course_release_type"]
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at?: string | null
          course_id?: number
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          id?: never
          prerequisite_module_id?: number | null
          published_at?: string | null
          release_after_days?: number | null
          release_at?: string | null
          release_type?: Database["public"]["Enums"]["course_release_type"]
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_modules_prerequisite_module_id_fkey"
            columns: ["prerequisite_module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_tag_map: {
        Row: {
          course_id: number
          tag_id: number
        }
        Insert: {
          course_id: number
          tag_id: number
        }
        Update: {
          course_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_tag_map_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "course_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      course_tags: {
        Row: {
          created_at: string
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          access_type: Database["public"]["Enums"]["course_access_type"]
          archived_at: string | null
          banner_url: string | null
          category_id: number | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_duration: number | null
          external_landing_url: string | null
          has_certificate: boolean
          id: number
          instructor_id: string | null
          instructor_name: string | null
          is_featured: boolean
          language: string
          level: Database["public"]["Enums"]["course_level"] | null
          published_at: string | null
          release_type: Database["public"]["Enums"]["course_release_type"]
          scheduled_publish_at: string | null
          short_description: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          subtitle: string | null
          title: string
          trailer_url: string | null
          updated_at: string
          updated_by: string | null
          visibility: Database["public"]["Enums"]["course_visibility"]
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          access_type?: Database["public"]["Enums"]["course_access_type"]
          archived_at?: string | null
          banner_url?: string | null
          category_id?: number | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration?: number | null
          external_landing_url?: string | null
          has_certificate?: boolean
          id?: never
          instructor_id?: string | null
          instructor_name?: string | null
          is_featured?: boolean
          language?: string
          level?: Database["public"]["Enums"]["course_level"] | null
          published_at?: string | null
          release_type?: Database["public"]["Enums"]["course_release_type"]
          scheduled_publish_at?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          title: string
          trailer_url?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: Database["public"]["Enums"]["course_visibility"]
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          access_type?: Database["public"]["Enums"]["course_access_type"]
          archived_at?: string | null
          banner_url?: string | null
          category_id?: number | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration?: number | null
          external_landing_url?: string | null
          has_certificate?: boolean
          id?: never
          instructor_id?: string | null
          instructor_name?: string | null
          is_featured?: boolean
          language?: string
          level?: Database["public"]["Enums"]["course_level"] | null
          published_at?: string | null
          release_type?: Database["public"]["Enums"]["course_release_type"]
          scheduled_publish_at?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: string | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: Database["public"]["Enums"]["course_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_clicks: {
        Row: {
          clicked_at: string
          deal_id: number
          id: string
          referrer: string | null
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          deal_id: number
          id?: string
          referrer?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          deal_id?: number
          id?: string
          referrer?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_clicks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "exclusive_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at: string | null
          capacity: number | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          external_url: string | null
          google_calendar_event_id: string | null
          google_calendar_html_link: string | null
          google_calendar_sync_error: string | null
          google_calendar_sync_status: string
          google_calendar_synced_at: string | null
          id: number
          location: string | null
          published_at: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at?: string | null
          capacity?: number | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_url?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string
          google_calendar_synced_at?: string | null
          id?: never
          location?: string | null
          published_at?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at?: string | null
          capacity?: number | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_url?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string
          google_calendar_synced_at?: string | null
          id?: never
          location?: string | null
          published_at?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exclusive_deals: {
        Row: {
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          external_url: string | null
          id: number
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          supplier_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_url?: string | null
          id?: never
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          supplier_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_url?: string | null
          id?: never
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          supplier_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusive_deals_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secret_requirements: {
        Row: {
          configured_at: string | null
          created_at: string
          dashboard_path: string | null
          edge_function_secret_name: string | null
          is_required: boolean
          key_name: string
          last_verified_at: string | null
          notes: string | null
          provider: string
          public_safe: boolean
          purpose: string
          status: Database["public"]["Enums"]["secret_config_status"]
          storage_location: Database["public"]["Enums"]["secret_storage_location"]
          updated_at: string
          vault_secret_name: string | null
        }
        Insert: {
          configured_at?: string | null
          created_at?: string
          dashboard_path?: string | null
          edge_function_secret_name?: string | null
          is_required?: boolean
          key_name: string
          last_verified_at?: string | null
          notes?: string | null
          provider: string
          public_safe?: boolean
          purpose: string
          status?: Database["public"]["Enums"]["secret_config_status"]
          storage_location: Database["public"]["Enums"]["secret_storage_location"]
          updated_at?: string
          vault_secret_name?: string | null
        }
        Update: {
          configured_at?: string | null
          created_at?: string
          dashboard_path?: string | null
          edge_function_secret_name?: string | null
          is_required?: boolean
          key_name?: string
          last_verified_at?: string | null
          notes?: string | null
          provider?: string
          public_safe?: boolean
          purpose?: string
          status?: Database["public"]["Enums"]["secret_config_status"]
          storage_location?: Database["public"]["Enums"]["secret_storage_location"]
          updated_at?: string
          vault_secret_name?: string | null
        }
        Relationships: []
      }
      lead_capture_rate_limits: {
        Row: {
          attempt_count: number
          created_at: string
          ip_hash: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          ip_hash: string
          updated_at?: string
          window_start: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          ip_hash?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          hubspot_contact_id: string | null
          hubspot_error: string | null
          hubspot_synced_at: string | null
          id: number
          ip_hash: string | null
          metadata: Json
          name: string
          phone: string
          source: Database["public"]["Enums"]["lead_source"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          hubspot_contact_id?: string | null
          hubspot_error?: string | null
          hubspot_synced_at?: string | null
          id?: never
          ip_hash?: string | null
          metadata?: Json
          name: string
          phone: string
          source: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          hubspot_contact_id?: string | null
          hubspot_error?: string | null
          hubspot_synced_at?: string | null
          id?: never
          ip_hash?: string | null
          metadata?: Json
          name?: string
          phone?: string
          source?: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      lesson_attachments: {
        Row: {
          course_id: number | null
          created_at: string
          created_by: string | null
          description: string | null
          external_url: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: number
          is_downloadable: boolean
          is_public: boolean
          lesson_id: number | null
          material_kind: string
          module_id: number | null
          sort_order: number
          storage_bucket: string
          storage_path: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          course_id?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: number
          is_downloadable?: boolean
          is_public?: boolean
          lesson_id?: number | null
          material_kind?: string
          module_id?: number | null
          sort_order?: number
          storage_bucket?: string
          storage_path?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: number
          is_downloadable?: boolean
          is_public?: boolean
          lesson_id?: number | null
          material_kind?: string
          module_id?: number | null
          sort_order?: number
          storage_bucket?: string
          storage_path?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attachments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_attachments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_blocks: {
        Row: {
          block_type: string
          content: Json
          created_at: string
          created_by: string | null
          id: number
          is_visible: boolean
          lesson_id: number
          position: number
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block_type: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: number
          is_visible?: boolean
          lesson_id: number
          position?: number
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block_type?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: number
          is_visible?: boolean
          lesson_id?: number
          position?: number
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_blocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          body: string
          course_id: number | null
          created_at: string
          id: number
          is_hidden: boolean
          lesson_id: number
          parent_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          course_id?: number | null
          created_at?: string
          id?: number
          is_hidden?: boolean
          lesson_id: number
          parent_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          course_id?: number | null
          created_at?: string
          id?: number
          is_hidden?: boolean
          lesson_id?: number
          parent_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          lesson_id: number
          position_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          lesson_id: number
          position_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          lesson_id?: number
          position_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          last_position_seconds: number | null
          last_watched_at: string
          lesson_id: number
          updated_at: string
          user_id: string
          watched_percent: number
          watched_seconds: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          last_position_seconds?: number | null
          last_watched_at?: string
          lesson_id: number
          updated_at?: string
          user_id: string
          watched_percent?: number
          watched_seconds?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          last_position_seconds?: number | null
          last_watched_at?: string
          lesson_id?: number
          updated_at?: string
          user_id?: string
          watched_percent?: number
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_ratings: {
        Row: {
          comment: string | null
          course_id: number | null
          created_at: string
          id: number
          lesson_id: number
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          course_id?: number | null
          created_at?: string
          id?: number
          lesson_id: number
          stars: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          course_id?: number | null
          created_at?: string
          id?: number
          lesson_id?: number
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ratings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ratings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          allow_comments: boolean
          allow_download: boolean
          archived_at: string | null
          content_text: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          external_resource_url: string | null
          external_video_url: string | null
          id: number
          is_mandatory: boolean
          is_preview: boolean
          lesson_type: Database["public"]["Enums"]["lesson_kind"]
          module_id: number
          prerequisite_lesson_id: number | null
          published_at: string | null
          release_after_days: number | null
          release_at: string | null
          release_type: Database["public"]["Enums"]["course_release_type"]
          sort_order: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_comments?: boolean
          allow_download?: boolean
          archived_at?: string | null
          content_text?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          external_resource_url?: string | null
          external_video_url?: string | null
          id?: never
          is_mandatory?: boolean
          is_preview?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_kind"]
          module_id: number
          prerequisite_lesson_id?: number | null
          published_at?: string | null
          release_after_days?: number | null
          release_at?: string | null
          release_type?: Database["public"]["Enums"]["course_release_type"]
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_comments?: boolean
          allow_download?: boolean
          archived_at?: string | null
          content_text?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          external_resource_url?: string | null
          external_video_url?: string | null
          id?: never
          is_mandatory?: boolean
          is_preview?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_kind"]
          module_id?: number
          prerequisite_lesson_id?: number | null
          published_at?: string | null
          release_after_days?: number | null
          release_at?: string | null
          release_type?: Database["public"]["Enums"]["course_release_type"]
          sort_order?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_prerequisite_lesson_id_fkey"
            columns: ["prerequisite_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      live_workshops: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at: string | null
          capacity: number | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          google_calendar_event_id: string | null
          google_calendar_html_link: string | null
          google_calendar_sync_error: string | null
          google_calendar_sync_status: string | null
          google_calendar_synced_at: string | null
          id: number
          meeting_url: string | null
          published_at: string | null
          replay_url: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at?: string | null
          capacity?: number | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string | null
          google_calendar_synced_at?: string | null
          id?: never
          meeting_url?: string | null
          published_at?: string | null
          replay_url?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          archived_at?: string | null
          capacity?: number | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_calendar_sync_error?: string | null
          google_calendar_sync_status?: string | null
          google_calendar_synced_at?: string | null
          id?: never
          meeting_url?: string | null
          published_at?: string | null
          replay_url?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      magazine_issues: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          external_file_url: string
          id: number
          published_on: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_file_url: string
          id?: never
          published_on?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_file_url?: string
          id?: never
          published_on?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          active: boolean
          all_courses: boolean
          community_access: boolean
          created_at: string
          description: string | null
          duration: string
          events_access: boolean
          exclusive_deals_access: boolean
          individual_course_access: boolean
          key: Database["public"]["Enums"]["membership_plan_key"]
          live_workshops_access: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          all_courses?: boolean
          community_access?: boolean
          created_at?: string
          description?: string | null
          duration: string
          events_access?: boolean
          exclusive_deals_access?: boolean
          individual_course_access?: boolean
          key: Database["public"]["Enums"]["membership_plan_key"]
          live_workshops_access?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          all_courses?: boolean
          community_access?: boolean
          created_at?: string
          description?: string | null
          duration?: string
          events_access?: boolean
          exclusive_deals_access?: boolean
          individual_course_access?: boolean
          key?: Database["public"]["Enums"]["membership_plan_key"]
          live_workshops_access?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          ends_at: string
          id: number
          last_stripe_event_created_at: string | null
          last_stripe_event_id: string | null
          last_synced_at: string | null
          metadata: Json
          plan_key: Database["public"]["Enums"]["membership_plan_key"]
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["membership_status"]
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          metadata?: Json
          plan_key: Database["public"]["Enums"]["membership_plan_key"]
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          metadata?: Json
          plan_key?: Database["public"]["Enums"]["membership_plan_key"]
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["key"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          id: number
          lesson_comment_id: number | null
          moderator_id: string | null
          post_id: number | null
          reason: string | null
          reply_id: number | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          lesson_comment_id?: number | null
          moderator_id?: string | null
          post_id?: number | null
          reason?: string | null
          reply_id?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          lesson_comment_id?: number | null
          moderator_id?: string | null
          post_id?: number | null
          reason?: string | null
          reply_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_lesson_comment_id_fkey"
            columns: ["lesson_comment_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "community_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      module_ratings: {
        Row: {
          created_at: string
          id: number
          module_id: number
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          module_id: number
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          module_id?: number
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_ratings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          href: string | null
          id: number
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          href?: string | null
          id?: never
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          href?: string | null
          id?: never
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_permissions: {
        Row: {
          created_at: string
          permission_key: Database["public"]["Enums"]["plan_permission_key"]
          plan_key: Database["public"]["Enums"]["membership_plan_key"]
        }
        Insert: {
          created_at?: string
          permission_key: Database["public"]["Enums"]["plan_permission_key"]
          plan_key: Database["public"]["Enums"]["membership_plan_key"]
        }
        Update: {
          created_at?: string
          permission_key?: Database["public"]["Enums"]["plan_permission_key"]
          plan_key?: Database["public"]["Enums"]["membership_plan_key"]
        }
        Relationships: [
          {
            foreignKeyName: "plan_permissions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["key"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          details: string | null
          id: number
          post_id: number
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: number
          post_id: number
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: number
          post_id?: number
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          birthdate: string | null
          calendar_auto_add_enabled: boolean
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          leaderboard_opt_out: boolean
          notification_prefs: Json
          profession: string | null
          region: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          birthdate?: string | null
          calendar_auto_add_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          leaderboard_opt_out?: boolean
          notification_prefs?: Json
          profession?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          birthdate?: string | null
          calendar_auto_add_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          leaderboard_opt_out?: boolean
          notification_prefs?: Json
          profession?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          answer_text: string | null
          attempt_id: number
          created_at: string
          id: number
          is_correct: boolean | null
          option_id: number | null
          points_awarded: number
          question_id: number
        }
        Insert: {
          answer_text?: string | null
          attempt_id: number
          created_at?: string
          id?: never
          is_correct?: boolean | null
          option_id?: number | null
          points_awarded?: number
          question_id: number
        }
        Update: {
          answer_text?: string | null
          attempt_id?: number
          created_at?: string
          id?: never
          is_correct?: boolean | null
          option_id?: number | null
          points_awarded?: number
          question_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "quiz_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          created_at: string
          id: number
          passed: boolean
          quiz_id: number
          score: number | null
          started_at: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          passed?: boolean
          quiz_id: number
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          passed?: boolean
          quiz_id?: number
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          created_at: string
          id: number
          is_correct: boolean
          option_text: string
          question_id: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          is_correct?: boolean
          option_text: string
          question_id: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          is_correct?: boolean
          option_text?: string
          question_id?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: number
          points: number
          question_text: string
          quiz_id: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: never
          points?: number
          question_text: string
          quiz_id: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: never
          points?: number
          question_text?: string
          quiz_id?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          course_id: number
          created_at: string
          description: string | null
          id: number
          lesson_id: number | null
          max_attempts: number | null
          module_id: number | null
          passing_score: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: number
          created_at?: string
          description?: string | null
          id?: never
          lesson_id?: number | null
          max_attempts?: number | null
          module_id?: number | null
          passing_score?: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: number
          created_at?: string
          description?: string | null
          id?: never
          lesson_id?: number | null
          max_attempts?: number | null
          module_id?: number | null
          passing_score?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          attended_at: string | null
          cancelled_at: string | null
          created_at: string
          event_id: number | null
          id: number
          live_workshop_id: number | null
          metadata: Json
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          attended_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          event_id?: number | null
          id?: never
          live_workshop_id?: number | null
          metadata?: Json
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          attended_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          event_id?: number | null
          id?: never
          live_workshop_id?: number | null
          metadata?: Json
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_live_workshop_id_fkey"
            columns: ["live_workshop_id"]
            isOneToOne: false
            referencedRelation: "live_workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_checkout_sessions: {
        Row: {
          created_at: string
          id: number
          metadata: Json
          mode: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          metadata?: Json
          mode?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          metadata?: Json
          mode?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string
          email: string | null
          stripe_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          stripe_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          stripe_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_payments: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: number
          last_stripe_event_created_at: string | null
          last_stripe_event_id: string | null
          last_synced_at: string | null
          livemode: boolean | null
          metadata: Json
          paid_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          livemode?: boolean | null
          metadata?: Json
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          livemode?: boolean | null
          metadata?: Json
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_prices: {
        Row: {
          active: boolean
          course_id: number | null
          created_at: string
          currency: string
          id: number
          is_checkout_default: boolean
          livemode: boolean | null
          metadata: Json
          plan_key: Database["public"]["Enums"]["membership_plan_key"]
          recurring_interval: string | null
          recurring_interval_count: number | null
          stripe_price_id: string
          stripe_product_id: string | null
          unit_amount: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          course_id?: number | null
          created_at?: string
          currency?: string
          id?: never
          is_checkout_default?: boolean
          livemode?: boolean | null
          metadata?: Json
          plan_key: Database["public"]["Enums"]["membership_plan_key"]
          recurring_interval?: string | null
          recurring_interval_count?: number | null
          stripe_price_id: string
          stripe_product_id?: string | null
          unit_amount?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          course_id?: number | null
          created_at?: string
          currency?: string
          id?: never
          is_checkout_default?: boolean
          livemode?: boolean | null
          metadata?: Json
          plan_key?: Database["public"]["Enums"]["membership_plan_key"]
          recurring_interval?: string | null
          recurring_interval_count?: number | null
          stripe_price_id?: string
          stripe_product_id?: string | null
          unit_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_prices_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_prices_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "stripe_prices_stripe_product_id_fkey"
            columns: ["stripe_product_id"]
            isOneToOne: false
            referencedRelation: "stripe_products"
            referencedColumns: ["stripe_product_id"]
          },
        ]
      }
      stripe_products: {
        Row: {
          active: boolean
          created_at: string
          id: number
          metadata: Json
          name: string
          stripe_product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: never
          metadata?: Json
          name: string
          stripe_product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: never
          metadata?: Json
          name?: string
          stripe_product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: number
          last_stripe_event_created_at: string | null
          last_stripe_event_id: string | null
          last_synced_at: string | null
          livemode: boolean | null
          membership_id: number | null
          metadata: Json
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          livemode?: boolean | null
          membership_id?: number | null
          metadata?: Json
          status: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: never
          last_stripe_event_created_at?: string | null
          last_stripe_event_id?: string | null
          last_synced_at?: string | null
          livemode?: boolean | null
          membership_id?: number | null
          metadata?: Json
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_subscriptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          attempt_count: number
          created_at: string
          error: string | null
          event_type: string
          id: number
          ignored_reason: string | null
          last_error: string | null
          livemode: boolean | null
          payload: Json
          processed: boolean
          processed_at: string | null
          processing_lease_expires_at: string | null
          processing_started_at: string | null
          status: string
          stripe_event_created_at: string | null
          stripe_event_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          event_type: string
          id?: never
          ignored_reason?: string | null
          last_error?: string | null
          livemode?: boolean | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_lease_expires_at?: string | null
          processing_started_at?: string | null
          status?: string
          stripe_event_created_at?: string | null
          stripe_event_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          event_type?: string
          id?: never
          ignored_reason?: string | null
          last_error?: string | null
          livemode?: boolean | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_lease_expires_at?: string | null
          processing_started_at?: string | null
          status?: string
          stripe_event_created_at?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      supplier_categories: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      supplier_favorites: {
        Row: {
          created_at: string
          supplier_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          supplier_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          supplier_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_favorites_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          access_plan_keys: Database["public"]["Enums"]["membership_plan_key"][]
          category_id: number | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          id: number
          location: string | null
          logo_image_path: string | null
          name: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          category_id?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          id?: never
          location?: string | null
          logo_image_path?: string | null
          name: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          access_plan_keys?: Database["public"]["Enums"]["membership_plan_key"][]
          category_id?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          id?: never
          location?: string | null
          logo_image_path?: string | null
          name?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_course: { Args: { _course_id: number }; Returns: boolean }
      can_access_lesson: { Args: { _lesson_id: number }; Returns: boolean }
      can_access_module: { Args: { _module_id: number }; Returns: boolean }
      certificate_eligibility_for: {
        Args: { _course_id: number; _user_id: string }
        Returns: Json
      }
      cleanup_old_data: { Args: { retention_days?: number }; Returns: Json }
      community_notify_mentions: {
        Args: {
          p_body: string
          p_href: string
          p_post_id?: number
          p_reply_id?: number
          p_title: string
          p_user_ids: string[]
        }
        Returns: number
      }
      community_search_members: {
        Args: { limit_count?: number; term: string }
        Returns: {
          avatar_path: string
          display_name: string
          full_name: string
          id: string
        }[]
      }
      get_alchemist_leaderboard: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          avatar_path: string
          display_name: string
          rank: number
          tier: string
          user_id: string
          xp: number
        }[]
      }
      get_my_alchemist_stats: { Args: never; Returns: Json }
      get_public_certificate: {
        Args: { slug: string }
        Returns: {
          certificate_number: string
          course_title: string
          issued_at: string
          public_slug: string
          student_name: string
          verification_hash: string
        }[]
      }
      get_public_certificate_status: {
        Args: { slug: string }
        Returns: {
          certificate_number: string
          course_title: string
          issued_at: string
          public_slug: string
          revoked_at: string
          status: string
          student_name: string
          verification_hash: string
        }[]
      }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_path: string
          bio: string
          display_name: string
          full_name: string
          id: string
          profession: string
          region: string
        }[]
      }
      get_purchasable_courses: {
        Args: never
        Returns: {
          cover_image_path: string
          description: string
          id: number
          short_description: string
          sort_order: number
          subtitle: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      internal_activate_validated_stripe_price: {
        Args: {
          p_expected_course_id: number
          p_expected_currency: string
          p_expected_livemode: boolean
          p_expected_plan_key: Database["public"]["Enums"]["membership_plan_key"]
          p_expected_recurring_interval: string
          p_expected_recurring_interval_count: number
          p_expected_unit_amount: number
          p_stripe_price_id: string
        }
        Returns: Json
      }
      internal_apply_stripe_access_revocation: {
        Args: {
          p_metadata?: Json
          p_reason: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_subscription_id: string
        }
        Returns: Json
      }
      internal_apply_stripe_invoice_paid: {
        Args: {
          p_amount: number
          p_cancel_at_period_end: boolean
          p_course_id: number
          p_currency: string
          p_current_period_end: string
          p_current_period_start: string
          p_livemode: boolean
          p_metadata?: Json
          p_plan_key: Database["public"]["Enums"]["membership_plan_key"]
          p_stripe_customer_id: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_invoice_id: string
          p_stripe_payment_intent_id: string
          p_stripe_price_id: string
          p_stripe_subscription_id: string
          p_subscription_status: string
          p_user_id: string
        }
        Returns: Json
      }
      internal_apply_stripe_subscription_state: {
        Args: {
          p_metadata?: Json
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_status: string
          p_stripe_subscription_id: string
          p_user_id: string
        }
        Returns: Json
      }
      internal_claim_stripe_webhook_event: {
        Args: {
          p_event_type: string
          p_lease_seconds?: number
          p_livemode: boolean
          p_max_attempts?: number
          p_payload: Json
          p_stripe_event_created_at: string
          p_stripe_event_id: string
        }
        Returns: {
          result: string
          webhook_event_id: number
        }[]
      }
      internal_mark_stripe_webhook_event: {
        Args: {
          p_error?: string
          p_ignored_reason?: string
          p_status: string
          p_stripe_event_id: string
        }
        Returns: undefined
      }
      internal_submit_quiz_attempt: {
        Args: { p_answers: Json; p_quiz_id: number; p_user_id: string }
        Returns: {
          attempts_remaining: number
          passed: boolean
          score: number
        }[]
      }
      issue_my_certificate: { Args: { p_course_id: number }; Returns: Json }
      lesson_rating_summary: {
        Args: { p_lesson_id: number }
        Returns: {
          avg_rating: number
          total: number
          user_rating: number
        }[]
      }
      module_rating_summary: {
        Args: { p_module_id: number }
        Returns: {
          avg_rating: number
          total: number
          user_rating: number
        }[]
      }
      my_certificate_status: { Args: { p_course_id: number }; Returns: Json }
      my_certificates_overview: { Args: never; Returns: Json }
      owns_course: { Args: { _course_id: number }; Returns: boolean }
      owns_lesson: { Args: { _lesson_id: number }; Returns: boolean }
      record_certificate_view: {
        Args: { p_referrer?: string; p_user_agent?: string; slug: string }
        Returns: boolean
      }
      register_for_event: {
        Args: {
          target_id: number
          target_type: Database["public"]["Enums"]["target_kind"]
        }
        Returns: {
          attended_at: string | null
          cancelled_at: string | null
          created_at: string
          event_id: number | null
          id: number
          live_workshop_id: number | null
          metadata: Json
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
          waitlist_position: number | null
        }
        SetofOptions: {
          from: "*"
          to: "registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_certificate_visibility: {
        Args: { p_certificate_id: number; p_make_public: boolean }
        Returns: {
          id: number
          public_slug: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "student" | "content_manager" | "instructor"
      community_content_status: "published" | "hidden" | "archived" | "deleted"
      content_status:
        | "draft"
        | "published"
        | "archived"
        | "in_review"
        | "scheduled"
      course_access_type:
        | "free"
        | "paid"
        | "plan"
        | "manual"
        | "private"
        | "product"
        | "time_limited"
        | "lifetime"
        | "cohort"
      course_level: "beginner" | "intermediate" | "advanced"
      course_release_type:
        | "all_at_once"
        | "drip_days"
        | "drip_date"
        | "after_previous_lesson"
        | "after_previous_module"
        | "manual"
        | "per_cohort"
      course_visibility: "public" | "unlisted" | "private"
      lead_source: "popup" | "quiz"
      lesson_kind:
        | "video"
        | "text"
        | "audio"
        | "pdf"
        | "live"
        | "external_link"
        | "quiz"
        | "assessment"
        | "practice"
        | "download"
        | "hybrid"
      membership_plan_key:
        | "annual_member"
        | "monthly_member"
        | "individual_course"
      membership_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "cancelled"
      plan_permission_key:
        | "all_courses"
        | "course_entitlement"
        | "community"
        | "events"
        | "magazine"
        | "suppliers"
        | "exclusive_deals"
        | "live_classes"
      registration_status:
        | "registered"
        | "waitlisted"
        | "cancelled"
        | "attended"
        | "no_show"
      secret_config_status: "missing" | "configured" | "rotating" | "retired"
      secret_storage_location:
        | "edge_function_secret"
        | "supabase_vault"
        | "auth_provider_config"
        | "frontend_env_public"
        | "external_provider_dashboard"
      target_kind: "event" | "live_workshop"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student", "content_manager", "instructor"],
      community_content_status: ["published", "hidden", "archived", "deleted"],
      content_status: [
        "draft",
        "published",
        "archived",
        "in_review",
        "scheduled",
      ],
      course_access_type: [
        "free",
        "paid",
        "plan",
        "manual",
        "private",
        "product",
        "time_limited",
        "lifetime",
        "cohort",
      ],
      course_level: ["beginner", "intermediate", "advanced"],
      course_release_type: [
        "all_at_once",
        "drip_days",
        "drip_date",
        "after_previous_lesson",
        "after_previous_module",
        "manual",
        "per_cohort",
      ],
      course_visibility: ["public", "unlisted", "private"],
      lead_source: ["popup", "quiz"],
      lesson_kind: [
        "video",
        "text",
        "audio",
        "pdf",
        "live",
        "external_link",
        "quiz",
        "assessment",
        "practice",
        "download",
        "hybrid",
      ],
      membership_plan_key: [
        "annual_member",
        "monthly_member",
        "individual_course",
      ],
      membership_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      payment_status: ["pending", "paid", "failed", "refunded", "cancelled"],
      plan_permission_key: [
        "all_courses",
        "course_entitlement",
        "community",
        "events",
        "magazine",
        "suppliers",
        "exclusive_deals",
        "live_classes",
      ],
      registration_status: [
        "registered",
        "waitlisted",
        "cancelled",
        "attended",
        "no_show",
      ],
      secret_config_status: ["missing", "configured", "rotating", "retired"],
      secret_storage_location: [
        "edge_function_secret",
        "supabase_vault",
        "auth_provider_config",
        "frontend_env_public",
        "external_provider_dashboard",
      ],
      target_kind: ["event", "live_workshop"],
    },
  },
} as const
