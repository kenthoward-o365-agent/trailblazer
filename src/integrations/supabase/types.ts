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
      account_groups: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          id: string
          name: string
          property_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at?: string
          id?: string
          name: string
          property_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          id?: string
          name?: string
          property_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      account_taxes: {
        Row: {
          calculation_type: string
          created_at: string
          id: string
          inclusive_of_tax_id: string | null
          is_active: boolean
          property_id: string
          rate_value: number
          revenue_account_id: string
          sort_order: number
          tax_account_id: string
          updated_at: string
        }
        Insert: {
          calculation_type: string
          created_at?: string
          id?: string
          inclusive_of_tax_id?: string | null
          is_active?: boolean
          property_id: string
          rate_value?: number
          revenue_account_id: string
          sort_order?: number
          tax_account_id: string
          updated_at?: string
        }
        Update: {
          calculation_type?: string
          created_at?: string
          id?: string
          inclusive_of_tax_id?: string | null
          is_active?: boolean
          property_id?: string
          rate_value?: number
          revenue_account_id?: string
          sort_order?: number
          tax_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_taxes_inclusive_of_tax_id_fkey"
            columns: ["inclusive_of_tax_id"]
            isOneToOne: false
            referencedRelation: "account_taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_taxes_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_taxes_tax_account_id_fkey"
            columns: ["tax_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_integrations: {
        Row: {
          access_token: string | null
          company_name: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string
          environment: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          property_id: string
          provider: string
          realm_id: string | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          sync_frequency: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          company_name?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          property_id: string
          provider?: string
          realm_id?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          sync_frequency?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          company_name?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          property_id?: string
          provider?: string
          realm_id?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          sync_frequency?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_integrations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_sync_log: {
        Row: {
          created_at: string
          dayend_close_id: string | null
          error_message: string | null
          external_ref: string | null
          id: string
          property_id: string
          provider: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          sync_type: string
          synced_at: string
          synced_by: string | null
        }
        Insert: {
          created_at?: string
          dayend_close_id?: string | null
          error_message?: string | null
          external_ref?: string | null
          id?: string
          property_id: string
          provider?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          sync_type: string
          synced_at?: string
          synced_by?: string | null
        }
        Update: {
          created_at?: string
          dayend_close_id?: string | null
          error_message?: string | null
          external_ref?: string | null
          id?: string
          property_id?: string
          provider?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          sync_type?: string
          synced_at?: string
          synced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sync_log_dayend_close_id_fkey"
            columns: ["dayend_close_id"]
            isOneToOne: false
            referencedRelation: "dayend_closes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sync_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_group_id: string
          code: string
          created_at: string
          description: string | null
          external_account: string | null
          id: string
          include_in_nightly_kpis: boolean
          is_active: boolean
          name: string
          normal_balance: string
          payment_type: string | null
          property_id: string
          qb_account_id: string | null
          qb_account_name: string | null
          tax_calculation_type: string | null
          tax_rate_value: number | null
          updated_at: string
        }
        Insert: {
          account_group_id: string
          code: string
          created_at?: string
          description?: string | null
          external_account?: string | null
          id?: string
          include_in_nightly_kpis?: boolean
          is_active?: boolean
          name: string
          normal_balance?: string
          payment_type?: string | null
          property_id: string
          qb_account_id?: string | null
          qb_account_name?: string | null
          tax_calculation_type?: string | null
          tax_rate_value?: number | null
          updated_at?: string
        }
        Update: {
          account_group_id?: string
          code?: string
          created_at?: string
          description?: string | null
          external_account?: string | null
          id?: string
          include_in_nightly_kpis?: boolean
          is_active?: boolean
          name?: string
          normal_balance?: string
          payment_type?: string | null
          property_id?: string
          qb_account_id?: string | null
          qb_account_name?: string | null
          tax_calculation_type?: string | null
          tax_rate_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      add_ons: {
        Row: {
          account_id: string | null
          category: string | null
          charge_type: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          property_id: string
          rental_item_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          charge_type?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          property_id: string
          rental_item_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category?: string | null
          charge_type?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          property_id?: string
          rental_item_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "add_ons_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_ons_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_ons_rental_item_id_fkey"
            columns: ["rental_item_id"]
            isOneToOne: false
            referencedRelation: "rental_items"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_audit: {
        Row: {
          action: string
          admin_role: string
          admin_user_id: string
          admin_user_name: string
          created_at: string
          id: string
          ip_address: string | null
          notes: string | null
          organization_id: string | null
          organization_name: string | null
          property_id: string
          property_name: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_role: string
          admin_user_id: string
          admin_user_name: string
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          organization_id?: string | null
          organization_name?: string | null
          property_id: string
          property_name: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_role?: string
          admin_user_id?: string
          admin_user_name?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          organization_id?: string | null
          organization_name?: string | null
          property_id?: string
          property_name?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_audit_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_name: string
          key_prefix: string
          key_type: string
          last_used_at: string | null
          property_id: string
          rate_limit_per_minute: number | null
          revoked_at: string | null
          scopes: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_name: string
          key_prefix: string
          key_type?: string
          last_used_at?: string | null
          property_id: string
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
          scopes?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_name?: string
          key_prefix?: string
          key_type?: string
          last_used_at?: string | null
          property_id?: string
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
          scopes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      api_logs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          property_id: string | null
          request_body: Json | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          property_id?: string | null
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          property_id?: string | null
          request_body?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      api_quota_usage: {
        Row: {
          booking_engine_count: number
          id: string
          organization_id: string
          request_count: number
          throttled_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          booking_engine_count?: number
          id?: string
          organization_id: string
          request_count?: number
          throttled_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          booking_engine_count?: number
          id?: string
          organization_id?: string
          request_count?: number
          throttled_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_quota_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_run_logs: {
        Row: {
          audit_date: string | null
          created_at: string | null
          folios_processed: number | null
          id: string
          message: string | null
          property_id: string | null
          run_type: string
          status: string
          total_room_revenue: number | null
          total_tax_revenue: number | null
        }
        Insert: {
          audit_date?: string | null
          created_at?: string | null
          folios_processed?: number | null
          id?: string
          message?: string | null
          property_id?: string | null
          run_type: string
          status: string
          total_room_revenue?: number | null
          total_tax_revenue?: number | null
        }
        Update: {
          audit_date?: string | null
          created_at?: string | null
          folios_processed?: number | null
          id?: string
          message?: string | null
          property_id?: string | null
          run_type?: string
          status?: string
          total_room_revenue?: number | null
          total_tax_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_run_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_settings: {
        Row: {
          about_markdown: string | null
          accent_color: string | null
          allow_search_engine_indexing: boolean
          background_color: string | null
          background_image_path: string | null
          body_font: string | null
          brand_source_url: string | null
          brand_synced_at: string | null
          button_radius: string | null
          cancellation_summary: string | null
          confirmation_message: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          custom_css: string | null
          footer_columns: Json
          footer_note: string | null
          header_links: Json
          heading_font: string | null
          hero_image_path: string | null
          id: string
          logo_image_path: string | null
          logo_url: string | null
          max_advance_days: number
          max_nights: number
          min_advance_days: number
          min_nights: number
          primary_color: string | null
          property_id: string
          same_day_cutoff_time: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_website: string | null
          tagline: string | null
          terms_and_conditions: string | null
          text_color: string | null
          updated_at: string
          widget_config: Json
        }
        Insert: {
          about_markdown?: string | null
          accent_color?: string | null
          allow_search_engine_indexing?: boolean
          background_color?: string | null
          background_image_path?: string | null
          body_font?: string | null
          brand_source_url?: string | null
          brand_synced_at?: string | null
          button_radius?: string | null
          cancellation_summary?: string | null
          confirmation_message?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_css?: string | null
          footer_columns?: Json
          footer_note?: string | null
          header_links?: Json
          heading_font?: string | null
          hero_image_path?: string | null
          id?: string
          logo_image_path?: string | null
          logo_url?: string | null
          max_advance_days?: number
          max_nights?: number
          min_advance_days?: number
          min_nights?: number
          primary_color?: string | null
          property_id: string
          same_day_cutoff_time?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_website?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          text_color?: string | null
          updated_at?: string
          widget_config?: Json
        }
        Update: {
          about_markdown?: string | null
          accent_color?: string | null
          allow_search_engine_indexing?: boolean
          background_color?: string | null
          background_image_path?: string | null
          body_font?: string | null
          brand_source_url?: string | null
          brand_synced_at?: string | null
          button_radius?: string | null
          cancellation_summary?: string | null
          confirmation_message?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_css?: string | null
          footer_columns?: Json
          footer_note?: string | null
          header_links?: Json
          heading_font?: string | null
          hero_image_path?: string | null
          id?: string
          logo_image_path?: string | null
          logo_url?: string | null
          max_advance_days?: number
          max_nights?: number
          min_advance_days?: number
          min_nights?: number
          primary_color?: string | null
          property_id?: string
          same_day_cutoff_time?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_website?: string | null
          tagline?: string | null
          terms_and_conditions?: string | null
          text_color?: string | null
          updated_at?: string
          widget_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          check_in: string
          check_out: string
          created_at: string
          expires_at: string
          guests: number
          id: string
          property_id: string
          rate_id: string | null
          session_id: string | null
          site_id: string | null
          site_type_id: string | null
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string
          expires_at?: string
          guests?: number
          id?: string
          property_id: string
          rate_id?: string | null
          session_id?: string | null
          site_id?: string | null
          site_type_id?: string | null
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string
          expires_at?: string
          guests?: number
          id?: string
          property_id?: string
          rate_id?: string | null
          session_id?: string | null
          site_id?: string | null
          site_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_white_label: {
        Row: {
          accent_color: string | null
          brand_id: string
          created_at: string
          custom_domain: string | null
          favicon_url: string | null
          is_active: boolean
          logo_url: string | null
          primary_color: string | null
          sender_email: string | null
          sender_name: string | null
          theme_tokens: Json
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          brand_id: string
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string | null
          sender_email?: string | null
          sender_name?: string | null
          theme_tokens?: Json
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          brand_id?: string
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          primary_color?: string | null
          sender_email?: string | null
          sender_name?: string | null
          theme_tokens?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_white_label_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          organization_id: string
          primary_color: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          organization_id: string
          primary_color?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          organization_id?: string
          primary_color?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          guest_id: string
          id: string
          reservation_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          campaign_id: string
          guest_id: string
          id?: string
          reservation_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          campaign_id?: string
          guest_id?: string
          id?: string
          reservation_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          id: string
          name: string
          property_id: string
          segment_filters: Json | null
          sent_count: number | null
          status: string
          subject: string | null
          trigger_days: number | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          channel?: string
          content?: string | null
          created_at?: string
          id?: string
          name: string
          property_id: string
          segment_filters?: Json | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          trigger_days?: number | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          property_id?: string
          segment_filters?: Json | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          trigger_days?: number | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      change_journal: {
        Row: {
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          property_id: string
          record_id: string
          record_identifier: string
          record_type: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          property_id: string
          record_id: string
          record_identifier: string
          record_type: string
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          property_id?: string
          record_id?: string
          record_identifier?: string
          record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_journal_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_ari_queue: {
        Row: {
          attempts: number
          available_count: number
          channel_id: string
          created_at: string
          currency: string
          id: string
          last_error: string | null
          property_id: string
          rate_amount: number | null
          scheduled_for: string
          sent_at: string | null
          site_type_id: string
          status: Database["public"]["Enums"]["channel_queue_status"]
          stay_date: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_count?: number
          channel_id: string
          created_at?: string
          currency?: string
          id?: string
          last_error?: string | null
          property_id: string
          rate_amount?: number | null
          scheduled_for?: string
          sent_at?: string | null
          site_type_id: string
          status?: Database["public"]["Enums"]["channel_queue_status"]
          stay_date: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_count?: number
          channel_id?: string
          created_at?: string
          currency?: string
          id?: string
          last_error?: string | null
          property_id?: string
          rate_amount?: number | null
          scheduled_for?: string
          sent_at?: string | null
          site_type_id?: string
          status?: Database["public"]["Enums"]["channel_queue_status"]
          stay_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_ari_queue_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_ari_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_ari_queue_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_content: {
        Row: {
          amenities: Json
          channel_id: string
          created_at: string
          display_name: string | null
          gallery_asset_ids: string[]
          id: string
          last_error: string | null
          last_pushed_at: string | null
          long_description: string | null
          max_occupancy: number | null
          policies: Json
          property_id: string
          push_status: string
          short_description: string | null
          site_type_id: string
          updated_at: string
        }
        Insert: {
          amenities?: Json
          channel_id: string
          created_at?: string
          display_name?: string | null
          gallery_asset_ids?: string[]
          id?: string
          last_error?: string | null
          last_pushed_at?: string | null
          long_description?: string | null
          max_occupancy?: number | null
          policies?: Json
          property_id: string
          push_status?: string
          short_description?: string | null
          site_type_id: string
          updated_at?: string
        }
        Update: {
          amenities?: Json
          channel_id?: string
          created_at?: string
          display_name?: string | null
          gallery_asset_ids?: string[]
          id?: string
          last_error?: string | null
          last_pushed_at?: string | null
          long_description?: string | null
          max_occupancy?: number | null
          policies?: Json
          property_id?: string
          push_status?: string
          short_description?: string | null
          site_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_content_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_content_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_content_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_governance_policies: {
        Row: {
          allowed_channels: Json
          brand_id: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          parity_enforced: boolean
          updated_at: string
        }
        Insert: {
          allowed_channels?: Json
          brand_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          parity_enforced?: boolean
          updated_at?: string
        }
        Update: {
          allowed_channels?: Json
          brand_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          parity_enforced?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_governance_policies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_governance_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_holdback_rules: {
        Row: {
          channel_id: string
          created_at: string
          end_date: string | null
          hold_type: Database["public"]["Enums"]["channel_holdback_type"]
          hold_value: number
          id: string
          is_active: boolean
          name: string
          priority: number
          property_id: string
          site_type_id: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          end_date?: string | null
          hold_type: Database["public"]["Enums"]["channel_holdback_type"]
          hold_value: number
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          property_id: string
          site_type_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          end_date?: string | null
          hold_type?: Database["public"]["Enums"]["channel_holdback_type"]
          hold_value?: number
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          property_id?: string
          site_type_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_holdback_rules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_holdback_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_holdback_rules_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_rate_mappings: {
        Row: {
          channel_id: string
          created_at: string
          external_rate_plan_code: string
          external_rate_plan_name: string | null
          id: string
          is_active: boolean
          property_id: string
          rate_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          external_rate_plan_code: string
          external_rate_plan_name?: string | null
          id?: string
          is_active?: boolean
          property_id: string
          rate_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          external_rate_plan_code?: string
          external_rate_plan_name?: string | null
          id?: string
          is_active?: boolean
          property_id?: string
          rate_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_rate_mappings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_rate_mappings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_rate_mappings_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_reservations_inbox: {
        Row: {
          channel_id: string
          created_at: string
          external_reservation_id: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          property_id: string
          reservation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          external_reservation_id: string
          id?: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
          property_id: string
          reservation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          external_reservation_id?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          property_id?: string
          reservation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_reservations_inbox_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_reservations_inbox_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_reservations_inbox_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_site_type_mappings: {
        Row: {
          channel_id: string
          created_at: string
          external_room_type_code: string
          external_room_type_name: string | null
          id: string
          is_active: boolean
          property_id: string
          site_type_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          external_room_type_code: string
          external_room_type_name?: string | null
          id?: string
          is_active?: boolean
          property_id: string
          site_type_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          external_room_type_code?: string
          external_room_type_name?: string | null
          id?: string
          is_active?: boolean
          property_id?: string
          site_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_site_type_mappings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_site_type_mappings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_site_type_mappings_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_sync_log: {
        Row: {
          action: string
          channel_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["channel_sync_direction"]
          duration_ms: number | null
          error: string | null
          http_status: number | null
          id: string
          items_count: number | null
          property_id: string
          request_summary: Json | null
          response_summary: Json | null
          status: string
        }
        Insert: {
          action: string
          channel_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["channel_sync_direction"]
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: string
          items_count?: number | null
          property_id: string
          request_summary?: Json | null
          response_summary?: Json | null
          status: string
        }
        Update: {
          action?: string
          channel_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["channel_sync_direction"]
          duration_ms?: number | null
          error?: string | null
          http_status?: number | null
          id?: string
          items_count?: number | null
          property_id?: string
          request_summary?: Json | null
          response_summary?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_sync_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_sync_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          channel_code: Database["public"]["Enums"]["channel_code"]
          created_at: string
          credentials_ref: string | null
          currency: string
          hotel_id: string | null
          id: string
          is_enabled: boolean
          last_ari_sync_at: string | null
          last_error: string | null
          last_res_pull_at: string | null
          mock_mode: boolean
          property_id: string
          status: Database["public"]["Enums"]["channel_status"]
          updated_at: string
        }
        Insert: {
          channel_code: Database["public"]["Enums"]["channel_code"]
          created_at?: string
          credentials_ref?: string | null
          currency?: string
          hotel_id?: string | null
          id?: string
          is_enabled?: boolean
          last_ari_sync_at?: string | null
          last_error?: string | null
          last_res_pull_at?: string | null
          mock_mode?: boolean
          property_id: string
          status?: Database["public"]["Enums"]["channel_status"]
          updated_at?: string
        }
        Update: {
          channel_code?: Database["public"]["Enums"]["channel_code"]
          created_at?: string
          credentials_ref?: string | null
          currency?: string
          hotel_id?: string | null
          id?: string
          is_enabled?: boolean
          last_ari_sync_at?: string | null
          last_error?: string | null
          last_res_pull_at?: string | null
          mock_mode?: boolean
          property_id?: string
          status?: Database["public"]["Enums"]["channel_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      city_ledger_invoice_payments: {
        Row: {
          applied_amount: number
          applied_at: string | null
          applied_by_name: string | null
          id: string
          invoice_id: string
          payment_transaction_id: string
        }
        Insert: {
          applied_amount: number
          applied_at?: string | null
          applied_by_name?: string | null
          id?: string
          invoice_id: string
          payment_transaction_id: string
        }
        Update: {
          applied_amount?: number
          applied_at?: string | null
          applied_by_name?: string | null
          id?: string
          invoice_id?: string
          payment_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_ledger_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "city_ledger_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_ledger_invoice_payments_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      city_ledger_invoices: {
        Row: {
          checkout_date: string | null
          city_ledger_account_id: string
          confirmation_number: string | null
          created_at: string | null
          guest_name: string | null
          id: string
          notes: string | null
          original_amount: number
          paid_amount: number
          property_id: string
          reservation_id: string | null
          room_number: string | null
          source_folio_id: string | null
          status: string
          transfer_date: string
          updated_at: string | null
        }
        Insert: {
          checkout_date?: string | null
          city_ledger_account_id: string
          confirmation_number?: string | null
          created_at?: string | null
          guest_name?: string | null
          id?: string
          notes?: string | null
          original_amount: number
          paid_amount?: number
          property_id: string
          reservation_id?: string | null
          room_number?: string | null
          source_folio_id?: string | null
          status?: string
          transfer_date?: string
          updated_at?: string | null
        }
        Update: {
          checkout_date?: string | null
          city_ledger_account_id?: string
          confirmation_number?: string | null
          created_at?: string | null
          guest_name?: string | null
          id?: string
          notes?: string | null
          original_amount?: number
          paid_amount?: number
          property_id?: string
          reservation_id?: string | null
          room_number?: string | null
          source_folio_id?: string | null
          status?: string
          transfer_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_ledger_invoices_city_ledger_account_id_fkey"
            columns: ["city_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_ledger_invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_ledger_invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_ledger_invoices_source_folio_id_fkey"
            columns: ["source_folio_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_preferences: {
        Row: {
          created_at: string
          full_clean_interval: number | null
          id: string
          property_id: string
          sheet_change_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_clean_interval?: number | null
          id?: string
          property_id: string
          sheet_change_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_clean_interval?: number | null
          id?: string
          property_id?: string
          sheet_change_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_preferences_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidated_ar_customers: {
        Row: {
          billing_address: Json | null
          billing_email: string | null
          code: string | null
          created_at: string
          credit_limit: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          billing_email?: string | null
          code?: string | null
          created_at?: string
          credit_limit?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          billing_email?: string | null
          code?: string | null
          created_at?: string
          credit_limit?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidated_ar_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidated_ar_links: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          ledger_account_id: string | null
          property_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          ledger_account_id?: string | null
          property_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          ledger_account_id?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidated_ar_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "consolidated_ar_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_ar_links_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_ar_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json
          property_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json
          property_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
          property_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dayend_closes: {
        Row: {
          account_summary: Json | null
          ai_summary: string | null
          close_date: string
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closing_ar_balance: number | null
          created_at: string
          exceptions_handled: number
          id: string
          ledger_summary: Json | null
          night_audit_id: string | null
          opening_ar_balance: number | null
          property_id: string
          status: string
          total_payments: number | null
          total_refunds: number | null
          total_revenue: number | null
          total_taxes: number | null
          updated_at: string
        }
        Insert: {
          account_summary?: Json | null
          ai_summary?: string | null
          close_date: string
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_ar_balance?: number | null
          created_at?: string
          exceptions_handled?: number
          id?: string
          ledger_summary?: Json | null
          night_audit_id?: string | null
          opening_ar_balance?: number | null
          property_id: string
          status?: string
          total_payments?: number | null
          total_refunds?: number | null
          total_revenue?: number | null
          total_taxes?: number | null
          updated_at?: string
        }
        Update: {
          account_summary?: Json | null
          ai_summary?: string | null
          close_date?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_ar_balance?: number | null
          created_at?: string
          exceptions_handled?: number
          id?: string
          ledger_summary?: Json | null
          night_audit_id?: string | null
          opening_ar_balance?: number | null
          property_id?: string
          status?: string
          total_payments?: number | null
          total_refunds?: number | null
          total_revenue?: number | null
          total_taxes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dayend_closes_night_audit_id_fkey"
            columns: ["night_audit_id"]
            isOneToOne: false
            referencedRelation: "night_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dayend_closes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dayend_exceptions: {
        Row: {
          action_taken: string
          amount_posted: number
          close_date: string
          confirmation_number: string | null
          created_at: string
          dayend_close_id: string | null
          deposit_amount: number
          deposit_disposition: string | null
          deposit_folio_id: string | null
          details: Json
          exception_type: string
          guest_name: string | null
          id: string
          night_audit_id: string | null
          performed_by: string | null
          performed_by_name: string | null
          property_id: string
          reservation_id: string | null
          resolution: string
          site_number: string | null
          status_after: string | null
          status_before: string | null
        }
        Insert: {
          action_taken: string
          amount_posted?: number
          close_date: string
          confirmation_number?: string | null
          created_at?: string
          dayend_close_id?: string | null
          deposit_amount?: number
          deposit_disposition?: string | null
          deposit_folio_id?: string | null
          details?: Json
          exception_type: string
          guest_name?: string | null
          id?: string
          night_audit_id?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          property_id: string
          reservation_id?: string | null
          resolution?: string
          site_number?: string | null
          status_after?: string | null
          status_before?: string | null
        }
        Update: {
          action_taken?: string
          amount_posted?: number
          close_date?: string
          confirmation_number?: string | null
          created_at?: string
          dayend_close_id?: string | null
          deposit_amount?: number
          deposit_disposition?: string | null
          deposit_folio_id?: string | null
          details?: Json
          exception_type?: string
          guest_name?: string | null
          id?: string
          night_audit_id?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          property_id?: string
          reservation_id?: string | null
          resolution?: string
          site_number?: string | null
          status_after?: string | null
          status_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dayend_exceptions_dayend_close_id_fkey"
            columns: ["dayend_close_id"]
            isOneToOne: false
            referencedRelation: "dayend_closes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dayend_exceptions_night_audit_id_fkey"
            columns: ["night_audit_id"]
            isOneToOne: false
            referencedRelation: "night_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dayend_exceptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dayend_exceptions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_policies: {
        Row: {
          cancellation_tiers: Json
          created_at: string
          deposit_due: string
          deposit_due_days: number | null
          deposit_type: string
          deposit_value: number
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          no_show_charge_type: string
          no_show_charge_value: number
          payment_mode: string
          property_id: string
          updated_at: string
        }
        Insert: {
          cancellation_tiers?: Json
          created_at?: string
          deposit_due?: string
          deposit_due_days?: number | null
          deposit_type?: string
          deposit_value?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          no_show_charge_type?: string
          no_show_charge_value?: number
          payment_mode?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          cancellation_tiers?: Json
          created_at?: string
          deposit_due?: string
          deposit_due_days?: number | null
          deposit_type?: string
          deposit_value?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          no_show_charge_type?: string
          no_show_charge_value?: number
          payment_mode?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_report_snapshots: {
        Row: {
          brand_id: string | null
          computed_at: string
          id: string
          kpis: Json
          organization_id: string
          period_end: string
          period_start: string
          property_id: string | null
          region_id: string | null
          scope: string
        }
        Insert: {
          brand_id?: string | null
          computed_at?: string
          id?: string
          kpis?: Json
          organization_id: string
          period_end: string
          period_start: string
          property_id?: string | null
          region_id?: string | null
          scope: string
        }
        Update: {
          brand_id?: string | null
          computed_at?: string
          id?: string
          kpis?: Json
          organization_id?: string
          period_end?: string
          period_start?: string
          property_id?: string | null
          region_id?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_report_snapshots_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_report_snapshots_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_postings: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string
          id: string
          is_voided: boolean | null
          ledger_account_id: string
          ledger_transaction_id: string | null
          night_audit_id: string | null
          posted_by: string | null
          posted_by_name: string | null
          posting_date: string
          posting_type: string
          property_id: string | null
          running_balance: number
          source_ledger_account_id: string | null
          source_posting_id: string | null
          transfer_note: string | null
          voided_at: string | null
          voided_by: string | null
          voided_by_name: string | null
          voided_posting_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description: string
          id?: string
          is_voided?: boolean | null
          ledger_account_id: string
          ledger_transaction_id?: string | null
          night_audit_id?: string | null
          posted_by?: string | null
          posted_by_name?: string | null
          posting_date?: string
          posting_type: string
          property_id?: string | null
          running_balance?: number
          source_ledger_account_id?: string | null
          source_posting_id?: string | null
          transfer_note?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_by_name?: string | null
          voided_posting_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string
          id?: string
          is_voided?: boolean | null
          ledger_account_id?: string
          ledger_transaction_id?: string | null
          night_audit_id?: string | null
          posted_by?: string | null
          posted_by_name?: string | null
          posting_date?: string
          posting_type?: string
          property_id?: string | null
          running_balance?: number
          source_ledger_account_id?: string | null
          source_posting_id?: string | null
          transfer_note?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_by_name?: string | null
          voided_posting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folio_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_night_audit_id_fkey"
            columns: ["night_audit_id"]
            isOneToOne: false
            referencedRelation: "night_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_source_ledger_account_id_fkey"
            columns: ["source_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_source_posting_id_fkey"
            columns: ["source_posting_id"]
            isOneToOne: false
            referencedRelation: "folio_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_postings_voided_posting_id_fkey"
            columns: ["voided_posting_id"]
            isOneToOne: false
            referencedRelation: "folio_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_split_rule_allocations: {
        Row: {
          allocation_value: number
          created_at: string | null
          id: string
          reservation_guest_id: string
          split_rule_id: string
        }
        Insert: {
          allocation_value: number
          created_at?: string | null
          id?: string
          reservation_guest_id: string
          split_rule_id: string
        }
        Update: {
          allocation_value?: number
          created_at?: string | null
          id?: string
          reservation_guest_id?: string
          split_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folio_split_rule_allocations_reservation_guest_id_fkey"
            columns: ["reservation_guest_id"]
            isOneToOne: false
            referencedRelation: "reservation_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_split_rule_allocations_split_rule_id_fkey"
            columns: ["split_rule_id"]
            isOneToOne: false
            referencedRelation: "folio_split_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_split_rules: {
        Row: {
          account_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          reservation_id: string
          split_type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reservation_id: string
          split_type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reservation_id?: string
          split_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folio_split_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_split_rules_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_assets: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          id: string
          is_hero: boolean
          property_id: string
          scope: string
          scope_id: string | null
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          is_hero?: boolean
          property_id: string
          scope: string
          scope_id?: string | null
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          is_hero?: boolean
          property_id?: string
          scope?: string
          scope_id?: string | null
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_export_schedules: {
        Row: {
          cadence: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          property_id: string
          target: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          property_id: string
          target: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          property_id?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_export_schedules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      group_block_payment_cards: {
        Row: {
          created_at: string | null
          group_block_id: string
          id: string
          is_primary: boolean | null
          payment_card_id: string
        }
        Insert: {
          created_at?: string | null
          group_block_id: string
          id?: string
          is_primary?: boolean | null
          payment_card_id: string
        }
        Update: {
          created_at?: string | null
          group_block_id?: string
          id?: string
          is_primary?: boolean | null
          payment_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_block_payment_cards_group_block_id_fkey"
            columns: ["group_block_id"]
            isOneToOne: false
            referencedRelation: "group_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_block_payment_cards_payment_card_id_fkey"
            columns: ["payment_card_id"]
            isOneToOne: false
            referencedRelation: "payment_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      group_block_room_allocations: {
        Row: {
          allocation_date: string
          created_at: string | null
          group_block_id: string
          id: string
          override_rate: number | null
          rate_id: string | null
          rooms_blocked: number
          site_id: string | null
          site_type_id: string | null
        }
        Insert: {
          allocation_date: string
          created_at?: string | null
          group_block_id: string
          id?: string
          override_rate?: number | null
          rate_id?: string | null
          rooms_blocked?: number
          site_id?: string | null
          site_type_id?: string | null
        }
        Update: {
          allocation_date?: string
          created_at?: string | null
          group_block_id?: string
          id?: string
          override_rate?: number | null
          rate_id?: string | null
          rooms_blocked?: number
          site_id?: string | null
          site_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_block_room_allocations_group_block_id_fkey"
            columns: ["group_block_id"]
            isOneToOne: false
            referencedRelation: "group_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_block_room_allocations_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_block_room_allocations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_block_room_allocations_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      group_blocks: {
        Row: {
          allow_other_room_types: boolean | null
          allow_overbooking: boolean | null
          charge_routing: string | null
          city: string | null
          city_ledger_account_id: string | null
          code: string
          contact_email: string | null
          contact_first_name: string | null
          contact_last_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          description: string | null
          end_date: string
          has_master_account: boolean | null
          id: string
          master_contact_email: string | null
          master_contact_name: string | null
          master_contact_phone: string | null
          master_ledger_account_id: string | null
          property_id: string
          start_date: string
          state: string | null
          status: string | null
          street_address: string | null
          updated_at: string | null
          zipcode: string | null
        }
        Insert: {
          allow_other_room_types?: boolean | null
          allow_overbooking?: boolean | null
          charge_routing?: string | null
          city?: string | null
          city_ledger_account_id?: string | null
          code: string
          contact_email?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          end_date: string
          has_master_account?: boolean | null
          id?: string
          master_contact_email?: string | null
          master_contact_name?: string | null
          master_contact_phone?: string | null
          master_ledger_account_id?: string | null
          property_id: string
          start_date: string
          state?: string | null
          status?: string | null
          street_address?: string | null
          updated_at?: string | null
          zipcode?: string | null
        }
        Update: {
          allow_other_room_types?: boolean | null
          allow_overbooking?: boolean | null
          charge_routing?: string | null
          city?: string | null
          city_ledger_account_id?: string | null
          code?: string
          contact_email?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          has_master_account?: boolean | null
          id?: string
          master_contact_email?: string | null
          master_contact_name?: string | null
          master_contact_phone?: string | null
          master_ledger_account_id?: string | null
          property_id?: string
          start_date?: string
          state?: string | null
          status?: string | null
          street_address?: string | null
          updated_at?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_blocks_city_ledger_account_id_fkey"
            columns: ["city_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_blocks_master_ledger_account_id_fkey"
            columns: ["master_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantee_options: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          property_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          property_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          property_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantee_options_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_identities: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          identity_type: string
          identity_value: string
          is_verified: boolean
          organization_id: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          identity_type: string
          identity_value: string
          is_verified?: boolean
          organization_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          identity_type?: string
          identity_value?: string
          is_verified?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_identities_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_identities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_login_attempts: {
        Row: {
          attempted_at: string
          confirmation_number: string
          id: string
          ip_address: string | null
          property_id: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          confirmation_number: string
          id?: string
          ip_address?: string | null
          property_id: string
          succeeded?: boolean
        }
        Update: {
          attempted_at?: string
          confirmation_number?: string
          id?: string
          ip_address?: string | null
          property_id?: string
          succeeded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "guest_login_attempts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_room_preferences: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          preference_type: string
          preference_value: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          preference_type: string
          preference_value: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          preference_type?: string
          preference_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_room_preferences_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sharing_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          property_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_sharing_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "guest_sharing_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sharing_group_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sharing_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_sharing_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          anniversary: string | null
          birthday: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          favorite_site_id: string | null
          first_name: string
          household_id: string | null
          id: string
          last_name: string
          likes_dislikes: string | null
          master_guest_id: string | null
          organization_id: string | null
          origin_property_id: string | null
          phone: string | null
          phone2: string | null
          state: string | null
          street_address: string | null
          title: string | null
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          anniversary?: string | null
          birthday?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          favorite_site_id?: string | null
          first_name: string
          household_id?: string | null
          id?: string
          last_name: string
          likes_dislikes?: string | null
          master_guest_id?: string | null
          organization_id?: string | null
          origin_property_id?: string | null
          phone?: string | null
          phone2?: string | null
          state?: string | null
          street_address?: string | null
          title?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          anniversary?: string | null
          birthday?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          favorite_site_id?: string | null
          first_name?: string
          household_id?: string | null
          id?: string
          last_name?: string
          likes_dislikes?: string | null
          master_guest_id?: string | null
          organization_id?: string | null
          origin_property_id?: string | null
          phone?: string | null
          phone2?: string | null
          state?: string | null
          street_address?: string | null
          title?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_favorite_site_id_fkey"
            columns: ["favorite_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_master_guest_id_fkey"
            columns: ["master_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_origin_property_id_fkey"
            columns: ["origin_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          ltv_amount: number
          marketing_opt_in: boolean
          name: string | null
          notes: string | null
          organization_id: string
          postal_code: string | null
          primary_email: string | null
          primary_phone: string | null
          state_region: string | null
          stay_count: number
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ltv_amount?: number
          marketing_opt_in?: boolean
          name?: string | null
          notes?: string | null
          organization_id: string
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          state_region?: string | null
          stay_count?: number
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ltv_amount?: number
          marketing_opt_in?: boolean
          name?: string | null
          notes?: string | null
          organization_id?: string
          postal_code?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          state_region?: string | null
          stay_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intercompany_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          from_property_id: string
          id: string
          memo: string | null
          organization_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: string
          to_property_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          from_property_id: string
          id?: string
          memo?: string | null
          organization_id: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          to_property_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          from_property_id?: string
          id?: string
          memo?: string | null
          organization_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          to_property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercompany_transfers_from_property_id_fkey"
            columns: ["from_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_transfers_to_property_id_fkey"
            columns: ["to_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          is_posted: boolean
          posted_at: string | null
          posted_by: string | null
          property_id: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          is_posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          property_id: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          is_posted?: boolean
          posted_at?: string | null
          posted_by?: string | null
          property_id?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          journal_entry_id: string
          property_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
          property_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          account_number: string | null
          balance: number
          city: string | null
          closed_at: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          guest_id: string | null
          id: string
          is_active: boolean
          ledger_type: Database["public"]["Enums"]["ledger_type"]
          opened_at: string
          payment_terms_days: number | null
          phone: string | null
          property_id: string
          reservation_guest_id: string | null
          reservation_id: string | null
          state: string | null
          street_address: string | null
          street_address_2: string | null
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          account_number?: string | null
          balance?: number
          city?: string | null
          closed_at?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          guest_id?: string | null
          id?: string
          is_active?: boolean
          ledger_type: Database["public"]["Enums"]["ledger_type"]
          opened_at?: string
          payment_terms_days?: number | null
          phone?: string | null
          property_id: string
          reservation_guest_id?: string | null
          reservation_id?: string | null
          state?: string | null
          street_address?: string | null
          street_address_2?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          account_number?: string | null
          balance?: number
          city?: string | null
          closed_at?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          guest_id?: string | null
          id?: string
          is_active?: boolean
          ledger_type?: Database["public"]["Enums"]["ledger_type"]
          opened_at?: string
          payment_terms_days?: number | null
          phone?: string | null
          property_id?: string
          reservation_guest_id?: string | null
          reservation_id?: string | null
          state?: string | null
          street_address?: string | null
          street_address_2?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_reservation_guest_id_fkey"
            columns: ["reservation_guest_id"]
            isOneToOne: false
            referencedRelation: "reservation_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_accounts_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          account_code: string | null
          account_id: string | null
          created_at: string
          created_by: string | null
          credit_amount: number | null
          debit_amount: number | null
          description: string
          id: string
          journal_entry_id: string | null
          ledger_account_id: string
          posted_by_name: string | null
          property_id: string | null
          reference_number: string | null
          running_balance: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_code?: string | null
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description: string
          id?: string
          journal_entry_id?: string | null
          ledger_account_id: string
          posted_by_name?: string | null
          property_id?: string | null
          reference_number?: string | null
          running_balance?: number | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_code?: string | null
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string
          id?: string
          journal_entry_id?: string | null
          ledger_account_id?: string
          posted_by_name?: string | null
          property_id?: string | null
          reference_number?: string | null
          running_balance?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempt_time: string
          id: string
          ip_address: string | null
          property_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attempt_time?: string
          id?: string
          ip_address?: string | null
          property_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attempt_time?: string
          id?: string
          ip_address?: string | null
          property_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      los_discount_rules: {
        Row: {
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          min_nights: number
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_nights: number
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_nights?: number
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "los_discount_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      member_accounts: {
        Row: {
          activated_at: string | null
          adyen_recurring_detail_reference: string | null
          adyen_shopper_reference: string | null
          auto_renew: boolean
          created_at: string
          expires_at: string | null
          guest_id: string | null
          household_id: string | null
          id: string
          joined_at: string
          member_number: string
          notes: string | null
          organization_id: string
          points_balance: number
          program_id: string
          status: Database["public"]["Enums"]["membership_account_status"]
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          adyen_recurring_detail_reference?: string | null
          adyen_shopper_reference?: string | null
          auto_renew?: boolean
          created_at?: string
          expires_at?: string | null
          guest_id?: string | null
          household_id?: string | null
          id?: string
          joined_at?: string
          member_number: string
          notes?: string | null
          organization_id: string
          points_balance?: number
          program_id: string
          status?: Database["public"]["Enums"]["membership_account_status"]
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          adyen_recurring_detail_reference?: string | null
          adyen_shopper_reference?: string | null
          auto_renew?: boolean
          created_at?: string
          expires_at?: string | null
          guest_id?: string | null
          household_id?: string | null
          id?: string
          joined_at?: string
          member_number?: string
          notes?: string | null
          organization_id?: string
          points_balance?: number
          program_id?: string
          status?: Database["public"]["Enums"]["membership_account_status"]
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_accounts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_accounts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "membership_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_accounts_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      member_dues_invoices: {
        Row: {
          adyen_psp_reference: string | null
          amount: number
          attempted_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          member_account_id: string
          organization_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["membership_dues_status"]
          updated_at: string
        }
        Insert: {
          adyen_psp_reference?: string | null
          amount: number
          attempted_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          member_account_id: string
          organization_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["membership_dues_status"]
          updated_at?: string
        }
        Update: {
          adyen_psp_reference?: string | null
          amount?: number
          attempted_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          member_account_id?: string
          organization_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["membership_dues_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_dues_invoices_member_account_id_fkey"
            columns: ["member_account_id"]
            isOneToOne: false
            referencedRelation: "member_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_dues_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_entitlement_usage: {
        Row: {
          created_at: string
          free_nights_used: number
          id: string
          last_stay_ended_at: string | null
          member_account_id: string
          organization_id: string
          parks_visited: Json
          stays_count: number
          total_nights_used: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          free_nights_used?: number
          id?: string
          last_stay_ended_at?: string | null
          member_account_id: string
          organization_id: string
          parks_visited?: Json
          stays_count?: number
          total_nights_used?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          free_nights_used?: number
          id?: string
          last_stay_ended_at?: string | null
          member_account_id?: string
          organization_id?: string
          parks_visited?: Json
          stays_count?: number
          total_nights_used?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_entitlement_usage_member_account_id_fkey"
            columns: ["member_account_id"]
            isOneToOne: false
            referencedRelation: "member_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_entitlement_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_points_ledger: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          delta: number
          id: string
          member_account_id: string
          organization_id: string
          property_id: string | null
          reason: string
          reservation_id: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          member_account_id: string
          organization_id: string
          property_id?: string | null
          reason: string
          reservation_id?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          member_account_id?: string
          organization_id?: string
          property_id?: string | null
          reason?: string
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_points_ledger_member_account_id_fkey"
            columns: ["member_account_id"]
            isOneToOne: false
            referencedRelation: "member_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_points_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_points_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_points_ledger_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_program_properties: {
        Row: {
          created_at: string
          id: string
          program_id: string
          property_id: string
          tier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          property_id: string
          tier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          property_id?: string
          tier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_program_properties_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "membership_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_program_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_program_properties_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_programs: {
        Row: {
          auto_renew_default: boolean
          billing_period: Database["public"]["Enums"]["membership_billing_period"]
          brand_id: string | null
          code: string | null
          created_at: string
          currency: string
          description: string | null
          dues_amount: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          point_redemption_value: number
          points_per_currency_unit: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          auto_renew_default?: boolean
          billing_period?: Database["public"]["Enums"]["membership_billing_period"]
          brand_id?: string | null
          code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dues_amount?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          point_redemption_value?: number
          points_per_currency_unit?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew_default?: boolean
          billing_period?: Database["public"]["Enums"]["membership_billing_period"]
          brand_id?: string | null
          code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dues_amount?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          point_redemption_value?: number
          points_per_currency_unit?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_programs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tiers: {
        Row: {
          benefits: Json
          blackout_dates: Json
          cooldown_days: number
          created_at: string
          discount_percent: number
          dues_amount_override: number | null
          free_nights_per_year: number
          id: string
          is_active: boolean
          max_consecutive_nights: number | null
          name: string
          parks_per_year_cap: number | null
          points_multiplier: number
          priority: number
          priority_booking_window_days: number
          program_id: string
          updated_at: string
        }
        Insert: {
          benefits?: Json
          blackout_dates?: Json
          cooldown_days?: number
          created_at?: string
          discount_percent?: number
          dues_amount_override?: number | null
          free_nights_per_year?: number
          id?: string
          is_active?: boolean
          max_consecutive_nights?: number | null
          name: string
          parks_per_year_cap?: number | null
          points_multiplier?: number
          priority?: number
          priority_booking_window_days?: number
          program_id: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          blackout_dates?: Json
          cooldown_days?: number
          created_at?: string
          discount_percent?: number
          dues_amount_override?: number | null
          free_nights_per_year?: number
          id?: string
          is_active?: boolean
          max_consecutive_nights?: number | null
          name?: string
          parks_per_year_cap?: number | null
          points_multiplier?: number
          priority?: number
          priority_booking_window_days?: number
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_tiers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "membership_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_ai_actions: {
        Row: {
          action_payload: Json
          action_summary: string
          action_type: string
          approved_by_user_id: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          message_id: string | null
          property_id: string
          proposed_reply: string | null
          result: Json | null
          status: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_summary: string
          action_type: string
          approved_by_user_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          message_id?: string | null
          property_id: string
          proposed_reply?: string | null
          result?: Json | null
          status?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_summary?: string
          action_type?: string
          approved_by_user_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          message_id?: string | null
          property_id?: string
          proposed_reply?: string | null
          result?: Json | null
          status?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_ai_actions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messaging_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_ai_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_ai_actions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "messaging_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_ai_knowledge: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          property_id: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          property_id: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          property_id?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_ai_knowledge_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_channels: {
        Row: {
          channel: string
          config: Json
          created_at: string
          credentials_ref: string | null
          id: string
          identifier: string
          is_active: boolean
          property_id: string
          provider: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          channel: string
          config?: Json
          created_at?: string
          credentials_ref?: string | null
          id?: string
          identifier: string
          is_active?: boolean
          property_id: string
          provider: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          credentials_ref?: string | null
          id?: string
          identifier?: string
          is_active?: boolean
          property_id?: string
          provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_channels_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_messages: {
        Row: {
          ai_generated: boolean
          approved_by_user_id: string | null
          attachments: Json
          body: string
          created_at: string
          delivery_status: string | null
          direction: string
          id: string
          metadata: Json
          property_id: string
          provider_message_id: string | null
          sender_type: string
          sender_user_id: string | null
          thread_id: string
        }
        Insert: {
          ai_generated?: boolean
          approved_by_user_id?: string | null
          attachments?: Json
          body: string
          created_at?: string
          delivery_status?: string | null
          direction: string
          id?: string
          metadata?: Json
          property_id: string
          provider_message_id?: string | null
          sender_type: string
          sender_user_id?: string | null
          thread_id: string
        }
        Update: {
          ai_generated?: boolean
          approved_by_user_id?: string | null
          attachments?: Json
          body?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          metadata?: Json
          property_id?: string
          provider_message_id?: string | null
          sender_type?: string
          sender_user_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "messaging_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_role_visibility: {
        Row: {
          can_view: boolean
          category: string
          created_at: string
          id: string
          property_id: string
          role: string
        }
        Insert: {
          can_view?: boolean
          category: string
          created_at?: string
          id?: string
          property_id: string
          role: string
        }
        Update: {
          can_view?: boolean
          category?: string
          created_at?: string
          id?: string
          property_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_role_visibility_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_threads: {
        Row: {
          ai_mode: string
          assigned_role: string | null
          assigned_to_user_id: string | null
          category: string | null
          channel: string
          channel_id: string | null
          created_at: string
          display_name: string | null
          external_participant: string
          guest_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          property_id: string
          reservation_id: string | null
          status: string
          subject: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_mode?: string
          assigned_role?: string | null
          assigned_to_user_id?: string | null
          category?: string | null
          channel: string
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          external_participant: string
          guest_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          property_id: string
          reservation_id?: string | null
          status?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_mode?: string
          assigned_role?: string | null
          assigned_to_user_id?: string | null
          category?: string | null
          channel?: string
          channel_id?: string | null
          created_at?: string
          display_name?: string | null
          external_participant?: string
          guest_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          property_id?: string
          reservation_id?: string | null
          status?: string
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "messaging_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_threads_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_threads_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      night_audit_settings: {
        Row: {
          ai_summary_enabled: boolean
          auto_advance_audit_date: boolean
          auto_run_enabled: boolean | null
          auto_run_time: string | null
          created_at: string
          deposit_action: string
          id: string
          inhouse_departure_action: string
          pending_arrivals_action: string
          property_id: string
          updated_at: string
        }
        Insert: {
          ai_summary_enabled?: boolean
          auto_advance_audit_date?: boolean
          auto_run_enabled?: boolean | null
          auto_run_time?: string | null
          created_at?: string
          deposit_action?: string
          id?: string
          inhouse_departure_action?: string
          pending_arrivals_action?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          ai_summary_enabled?: boolean
          auto_advance_audit_date?: boolean
          auto_run_enabled?: boolean | null
          auto_run_time?: string | null
          created_at?: string
          deposit_action?: string
          id?: string
          inhouse_departure_action?: string
          pending_arrivals_action?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "night_audit_settings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      night_audits: {
        Row: {
          audit_date: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          folios_processed: number | null
          id: string
          notes: string | null
          property_id: string
          started_at: string | null
          started_by: string | null
          status: string
          total_other_revenue: number | null
          total_payments: number | null
          total_room_revenue: number | null
          total_tax_revenue: number | null
          updated_at: string
        }
        Insert: {
          audit_date: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          folios_processed?: number | null
          id?: string
          notes?: string | null
          property_id: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          total_other_revenue?: number | null
          total_payments?: number | null
          total_room_revenue?: number | null
          total_tax_revenue?: number | null
          updated_at?: string
        }
        Update: {
          audit_date?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          folios_processed?: number | null
          id?: string
          notes?: string | null
          property_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          total_other_revenue?: number | null
          total_payments?: number | null
          total_room_revenue?: number | null
          total_tax_revenue?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "night_audits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          current_step: string | null
          property_id: string
          steps: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          current_step?: string | null
          property_id: string
          steps?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          current_step?: string | null
          property_id?: string
          steps?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_quotas: {
        Row: {
          booking_engine_daily_limit: number
          burst_per_minute: number
          created_at: string
          daily_request_limit: number
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          booking_engine_daily_limit?: number
          burst_per_minute?: number
          created_at?: string
          daily_request_limit?: number
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          booking_engine_daily_limit?: number
          burst_per_minute?: number
          created_at?: string
          daily_request_limit?: number
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_api_quotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_compliance_settings: {
        Row: {
          byok_enabled: boolean
          byok_key_reference: string | null
          created_at: string
          data_residency: string
          dpa_url: string | null
          incident_response_url: string | null
          notes: string | null
          organization_id: string
          security_contact_email: string | null
          soc2_last_review_at: string | null
          soc2_readiness_state: string
          subprocessors_url: string | null
          updated_at: string
        }
        Insert: {
          byok_enabled?: boolean
          byok_key_reference?: string | null
          created_at?: string
          data_residency?: string
          dpa_url?: string | null
          incident_response_url?: string | null
          notes?: string | null
          organization_id: string
          security_contact_email?: string | null
          soc2_last_review_at?: string | null
          soc2_readiness_state?: string
          subprocessors_url?: string | null
          updated_at?: string
        }
        Update: {
          byok_enabled?: boolean
          byok_key_reference?: string | null
          created_at?: string
          data_residency?: string
          dpa_url?: string | null
          incident_response_url?: string | null
          notes?: string | null
          organization_id?: string
          security_contact_email?: string | null
          soc2_last_review_at?: string | null
          soc2_readiness_state?: string
          subprocessors_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_compliance_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_sandbox_environments: {
        Row: {
          id: string
          is_active: boolean
          label: string
          parent_organization_id: string
          provisioned_at: string
          provisioned_by: string | null
          sandbox_organization_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          label?: string
          parent_organization_id: string
          provisioned_at?: string
          provisioned_by?: string | null
          sandbox_organization_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          parent_organization_id?: string
          provisioned_at?: string
          provisioned_by?: string | null
          sandbox_organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_sandbox_environments_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sandbox_environments_sandbox_organization_id_fkey"
            columns: ["sandbox_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          admin_user_id: string | null
          billing_email: string | null
          client_number: number
          created_at: string
          hubspot_company_id: string | null
          id: string
          name: string
          payment_status: string
          share_chart_of_accounts: boolean | null
          share_reporting: boolean | null
          share_user_access: boolean | null
          updated_at: string
          welcome_email_sent_at: string | null
        }
        Insert: {
          admin_user_id?: string | null
          billing_email?: string | null
          client_number?: number
          created_at?: string
          hubspot_company_id?: string | null
          id?: string
          name: string
          payment_status?: string
          share_chart_of_accounts?: boolean | null
          share_reporting?: boolean | null
          share_user_access?: boolean | null
          updated_at?: string
          welcome_email_sent_at?: string | null
        }
        Update: {
          admin_user_id?: string | null
          billing_email?: string | null
          client_number?: number
          created_at?: string
          hubspot_company_id?: string | null
          id?: string
          name?: string
          payment_status?: string
          share_chart_of_accounts?: boolean | null
          share_reporting?: boolean | null
          share_user_access?: boolean | null
          updated_at?: string
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      ota_connections: {
        Row: {
          api_endpoint: string
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          ota_name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          api_endpoint: string
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          ota_name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          api_endpoint?: string
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          ota_name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ota_connections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          add_on_id: string
          id: string
          package_id: string
          quantity: number
          rental_item_id: string | null
        }
        Insert: {
          add_on_id: string
          id?: string
          package_id: string
          quantity?: number
          rental_item_id?: string | null
        }
        Update: {
          add_on_id?: string
          id?: string
          package_id?: string
          quantity?: number
          rental_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_items_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_rental_item_id_fkey"
            columns: ["rental_item_id"]
            isOneToOne: false
            referencedRelation: "rental_items"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          charge_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          property_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          charge_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          property_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          charge_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          property_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_authorizations: {
        Row: {
          adyen_auth_code: string | null
          adyen_psp_reference: string | null
          captured_amount: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          currency: string | null
          current_amount: number
          expires_at: string | null
          id: string
          is_mock: boolean | null
          ledger_account_id: string
          original_amount: number
          payment_card_id: string
          property_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          adyen_auth_code?: string | null
          adyen_psp_reference?: string | null
          captured_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          currency?: string | null
          current_amount: number
          expires_at?: string | null
          id?: string
          is_mock?: boolean | null
          ledger_account_id: string
          original_amount: number
          payment_card_id: string
          property_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          adyen_auth_code?: string | null
          adyen_psp_reference?: string | null
          captured_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          currency?: string | null
          current_amount?: number
          expires_at?: string | null
          id?: string
          is_mock?: boolean | null
          ledger_account_id?: string
          original_amount?: number
          payment_card_id?: string
          property_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_authorizations_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_authorizations_payment_card_id_fkey"
            columns: ["payment_card_id"]
            isOneToOne: false
            referencedRelation: "payment_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_authorizations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_cards: {
        Row: {
          adyen_recurring_reference: string | null
          adyen_shopper_reference: string | null
          card_brand: string
          card_sequence: number | null
          cardholder_name: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          expiry_month: number
          expiry_year: number
          guest_id: string | null
          id: string
          is_mock: boolean | null
          is_primary: boolean | null
          last_four_digits: string
          ledger_account_id: string | null
          property_id: string | null
          reservation_guest_id: string | null
          reservation_id: string | null
          token_status: string | null
          updated_at: string
        }
        Insert: {
          adyen_recurring_reference?: string | null
          adyen_shopper_reference?: string | null
          card_brand: string
          card_sequence?: number | null
          cardholder_name: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expiry_month: number
          expiry_year: number
          guest_id?: string | null
          id?: string
          is_mock?: boolean | null
          is_primary?: boolean | null
          last_four_digits: string
          ledger_account_id?: string | null
          property_id?: string | null
          reservation_guest_id?: string | null
          reservation_id?: string | null
          token_status?: string | null
          updated_at?: string
        }
        Update: {
          adyen_recurring_reference?: string | null
          adyen_shopper_reference?: string | null
          card_brand?: string
          card_sequence?: number | null
          cardholder_name?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          expiry_month?: number
          expiry_year?: number
          guest_id?: string | null
          id?: string
          is_mock?: boolean | null
          is_primary?: boolean | null
          last_four_digits?: string
          ledger_account_id?: string | null
          property_id?: string | null
          reservation_guest_id?: string | null
          reservation_id?: string | null
          token_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_cards_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cards_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cards_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cards_reservation_guest_id_fkey"
            columns: ["reservation_guest_id"]
            isOneToOne: false
            referencedRelation: "reservation_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cards_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          adyen_psp_reference: string | null
          amount: number
          authorization_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          currency: string | null
          folio_posting_id: string | null
          gateway_response: Json | null
          id: string
          is_mock: boolean | null
          ledger_account_id: string | null
          payment_card_id: string | null
          property_id: string
          reservation_id: string | null
          source: string
          status: string
          transaction_type: string
        }
        Insert: {
          adyen_psp_reference?: string | null
          amount: number
          authorization_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          currency?: string | null
          folio_posting_id?: string | null
          gateway_response?: Json | null
          id?: string
          is_mock?: boolean | null
          ledger_account_id?: string | null
          payment_card_id?: string | null
          property_id: string
          reservation_id?: string | null
          source?: string
          status: string
          transaction_type: string
        }
        Update: {
          adyen_psp_reference?: string | null
          amount?: number
          authorization_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          currency?: string | null
          folio_posting_id?: string | null
          gateway_response?: Json | null
          id?: string
          is_mock?: boolean | null
          ledger_account_id?: string | null
          payment_card_id?: string | null
          property_id?: string
          reservation_id?: string | null
          source?: string
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "payment_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_folio_posting_id_fkey"
            columns: ["folio_posting_id"]
            isOneToOne: false
            referencedRelation: "folio_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_card_id_fkey"
            columns: ["payment_card_id"]
            isOneToOne: false
            referencedRelation: "payment_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_metrics_daily: {
        Row: {
          adr: number
          ancillary_revenue: number
          computed_at: string
          id: string
          occupancy_pct: number
          property_id: string
          revpar: number
          room_revenue: number
          sites_available: number
          sites_sold: number
          stay_date: string
          total_revenue: number
        }
        Insert: {
          adr?: number
          ancillary_revenue?: number
          computed_at?: string
          id?: string
          occupancy_pct?: number
          property_id: string
          revpar?: number
          room_revenue?: number
          sites_available?: number
          sites_sold?: number
          stay_date: string
          total_revenue?: number
        }
        Update: {
          adr?: number
          ancillary_revenue?: number
          computed_at?: string
          id?: string
          occupancy_pct?: number
          property_id?: string
          revpar?: number
          room_revenue?: number
          sites_available?: number
          sites_sold?: number
          stay_date?: string
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_metrics_daily_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          property_id: string
          revenue_ledger_account_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          property_id: string
          revenue_ledger_account_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          property_id?: string
          revenue_ledger_account_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_categories_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_categories_revenue_ledger_account_id_fkey"
            columns: ["revenue_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_inventory_movements: {
        Row: {
          change_qty: number
          created_at: string
          id: string
          notes: string | null
          outlet_id: string | null
          property_id: string
          reason: string
          reference_id: string | null
          user_id: string | null
          variant_id: string
        }
        Insert: {
          change_qty: number
          created_at?: string
          id?: string
          notes?: string | null
          outlet_id?: string | null
          property_id: string
          reason: string
          reference_id?: string | null
          user_id?: string | null
          variant_id: string
        }
        Update: {
          change_qty?: number
          created_at?: string
          id?: string
          notes?: string | null
          outlet_id?: string | null
          property_id?: string
          reason?: string
          reference_id?: string | null
          user_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_inventory_movements_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "pos_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_inventory_movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "pos_item_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_item_variants: {
        Row: {
          barcode: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          item_id: string
          price_override: number | null
          property_id: string
          reorder_point: number | null
          size: string | null
          sku: string | null
          stock_qty: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_id: string
          price_override?: number | null
          property_id: string
          reorder_point?: number | null
          size?: string | null
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_id?: string
          price_override?: number | null
          property_id?: string
          reorder_point?: number | null
          size?: string | null
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_item_variants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_items: {
        Row: {
          base_price: number
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          property_id: string
          revenue_ledger_account_id: string | null
          sku: string | null
          tax_profile_id: string | null
          track_inventory: boolean
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          property_id: string
          revenue_ledger_account_id?: string | null
          sku?: string | null
          tax_profile_id?: string | null
          track_inventory?: boolean
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          property_id?: string
          revenue_ledger_account_id?: string | null
          sku?: string | null
          tax_profile_id?: string | null
          track_inventory?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pos_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_items_revenue_ledger_account_id_fkey"
            columns: ["revenue_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_items_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "account_taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          item_name: string
          line_total: number
          order_id: string
          property_id: string
          qty: number
          revenue_ledger_account_id: string | null
          tax_amount: number
          unit_price: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          item_name: string
          line_total: number
          order_id: string
          property_id: string
          qty: number
          revenue_ledger_account_id?: string | null
          tax_amount?: number
          unit_price: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          item_name?: string
          line_total?: number
          order_id?: string
          property_id?: string
          qty?: number
          revenue_ledger_account_id?: string | null
          tax_amount?: number
          unit_price?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_revenue_ledger_account_id_fkey"
            columns: ["revenue_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "pos_item_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_sequences: {
        Row: {
          last_number: number
          property_id: string
        }
        Insert: {
          last_number?: number
          property_id: string
        }
        Update: {
          last_number?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_sequences_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          amount_tendered: number | null
          cashier_name: string | null
          cashier_user_id: string | null
          change_due: number | null
          closed_at: string | null
          created_at: string
          discount: number
          folio_posting_id: string | null
          id: string
          notes: string | null
          opened_at: string
          order_number: string | null
          outlet_id: string
          payment_transaction_id: string | null
          property_id: string
          reservation_id: string | null
          status: string
          subtotal: number
          tax: number
          tender_type: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount_tendered?: number | null
          cashier_name?: string | null
          cashier_user_id?: string | null
          change_due?: number | null
          closed_at?: string | null
          created_at?: string
          discount?: number
          folio_posting_id?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          order_number?: string | null
          outlet_id: string
          payment_transaction_id?: string | null
          property_id: string
          reservation_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tender_type?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount_tendered?: number | null
          cashier_name?: string | null
          cashier_user_id?: string | null
          change_due?: number | null
          closed_at?: string | null
          created_at?: string
          discount?: number
          folio_posting_id?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          order_number?: string | null
          outlet_id?: string
          payment_transaction_id?: string | null
          property_id?: string
          reservation_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tender_type?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_folio_posting_id_fkey"
            columns: ["folio_posting_id"]
            isOneToOne: false
            referencedRelation: "folio_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "pos_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_outlets: {
        Row: {
          cash_ledger_account_id: string | null
          clearing_ledger_account_id: string | null
          code: string | null
          created_at: string
          default_revenue_ledger_account_id: string | null
          id: string
          is_active: boolean
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          cash_ledger_account_id?: string | null
          clearing_ledger_account_id?: string | null
          code?: string | null
          created_at?: string
          default_revenue_ledger_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          cash_ledger_account_id?: string | null
          clearing_ledger_account_id?: string | null
          code?: string | null
          created_at?: string
          default_revenue_ledger_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_outlets_cash_ledger_account_id_fkey"
            columns: ["cash_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_outlets_clearing_ledger_account_id_fkey"
            columns: ["clearing_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_outlets_default_revenue_ledger_account_id_fkey"
            columns: ["default_revenue_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_outlets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          property_id: string
          updated_at: string
          uses_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          property_id: string
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          property_id?: string
          updated_at?: string
          uses_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          adyen_client_key: string | null
          adyen_merchant_account: string | null
          audit_date: string | null
          auto_post_to_quickbooks: boolean
          booking_custom_domain: string | null
          booking_custom_slug: string | null
          booking_engine_enabled: boolean
          booking_public_slug: string | null
          brand_id: string | null
          country: string | null
          created_at: string
          customer_id: number | null
          default_online_buffer: number
          email: string | null
          id: string
          is_active: boolean
          lockout_duration_minutes: number | null
          map_height: number | null
          map_image_url: string | null
          map_width: number | null
          max_failed_login_attempts: number | null
          max_sites: number | null
          name: string
          organization_id: string | null
          password_min_length: number | null
          password_require_number: boolean | null
          password_require_special: boolean | null
          password_require_uppercase: boolean | null
          password_rotation_days: number | null
          payment_gateway_mode: string | null
          phone1: string | null
          phone2: string | null
          property_group_id: string | null
          provisioned_at: string | null
          provisioned_by: string | null
          region_id: string | null
          require_mfa: boolean | null
          session_timeout_minutes: number | null
          setup_completed: boolean
          setup_completed_at: string | null
          setup_started_at: string | null
          setup_step: number
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address: string
          adyen_client_key?: string | null
          adyen_merchant_account?: string | null
          audit_date?: string | null
          auto_post_to_quickbooks?: boolean
          booking_custom_domain?: string | null
          booking_custom_slug?: string | null
          booking_engine_enabled?: boolean
          booking_public_slug?: string | null
          brand_id?: string | null
          country?: string | null
          created_at?: string
          customer_id?: number | null
          default_online_buffer?: number
          email?: string | null
          id?: string
          is_active?: boolean
          lockout_duration_minutes?: number | null
          map_height?: number | null
          map_image_url?: string | null
          map_width?: number | null
          max_failed_login_attempts?: number | null
          max_sites?: number | null
          name: string
          organization_id?: string | null
          password_min_length?: number | null
          password_require_number?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          password_rotation_days?: number | null
          payment_gateway_mode?: string | null
          phone1?: string | null
          phone2?: string | null
          property_group_id?: string | null
          provisioned_at?: string | null
          provisioned_by?: string | null
          region_id?: string | null
          require_mfa?: boolean | null
          session_timeout_minutes?: number | null
          setup_completed?: boolean
          setup_completed_at?: string | null
          setup_started_at?: string | null
          setup_step?: number
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string
          adyen_client_key?: string | null
          adyen_merchant_account?: string | null
          audit_date?: string | null
          auto_post_to_quickbooks?: boolean
          booking_custom_domain?: string | null
          booking_custom_slug?: string | null
          booking_engine_enabled?: boolean
          booking_public_slug?: string | null
          brand_id?: string | null
          country?: string | null
          created_at?: string
          customer_id?: number | null
          default_online_buffer?: number
          email?: string | null
          id?: string
          is_active?: boolean
          lockout_duration_minutes?: number | null
          map_height?: number | null
          map_image_url?: string | null
          map_width?: number | null
          max_failed_login_attempts?: number | null
          max_sites?: number | null
          name?: string
          organization_id?: string | null
          password_min_length?: number | null
          password_require_number?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          password_rotation_days?: number | null
          payment_gateway_mode?: string | null
          phone1?: string | null
          phone2?: string | null
          property_group_id?: string | null
          provisioned_at?: string | null
          provisioned_by?: string | null
          region_id?: string | null
          require_mfa?: boolean | null
          session_timeout_minutes?: number | null
          setup_completed?: boolean
          setup_completed_at?: string | null
          setup_started_at?: string | null
          setup_step?: number
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_confirmation_sequences: {
        Row: {
          last_number: number
          property_id: string
        }
        Insert: {
          last_number?: number
          property_id: string
        }
        Update: {
          last_number?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_confirmation_sequences_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          share_chart_of_accounts: boolean
          share_reporting: boolean
          share_user_access: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          share_chart_of_accounts?: boolean
          share_reporting?: boolean
          share_user_access?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          share_chart_of_accounts?: boolean
          share_reporting?: boolean
          share_user_access?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_work_order_sequences: {
        Row: {
          last_number: number
          property_id: string
        }
        Insert: {
          last_number?: number
          property_id: string
        }
        Update: {
          last_number?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_work_order_sequences_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_add_ons: {
        Row: {
          add_on_id: string
          created_at: string
          id: string
          rate_id: string
        }
        Insert: {
          add_on_id: string
          created_at?: string
          id?: string
          rate_id: string
        }
        Update: {
          add_on_id?: string
          created_at?: string
          id?: string
          rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_add_ons_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_booking_config: {
        Row: {
          created_at: string
          deposit_policy_id: string | null
          id: string
          is_public: boolean
          payment_mode_override: string | null
          property_id: string
          public_description: string | null
          public_name: string | null
          rate_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_policy_id?: string | null
          id?: string
          is_public?: boolean
          payment_mode_override?: string | null
          property_id: string
          public_description?: string | null
          public_name?: string | null
          rate_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_policy_id?: string | null
          id?: string
          is_public?: boolean
          payment_mode_override?: string | null
          property_id?: string
          public_description?: string | null
          public_name?: string | null
          rate_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_booking_config_deposit_policy_id_fkey"
            columns: ["deposit_policy_id"]
            isOneToOne: false
            referencedRelation: "deposit_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_booking_config_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_booking_config_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: true
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_membership_eligibility: {
        Row: {
          created_at: string
          discount_percent_override: number | null
          id: string
          member_only: boolean
          min_tier_priority: number
          program_id: string
          rate_id: string
        }
        Insert: {
          created_at?: string
          discount_percent_override?: number | null
          id?: string
          member_only?: boolean
          min_tier_priority?: number
          program_id: string
          rate_id: string
        }
        Update: {
          created_at?: string
          discount_percent_override?: number | null
          id?: string
          member_only?: boolean
          min_tier_priority?: number
          program_id?: string
          rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_membership_eligibility_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "membership_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_membership_eligibility_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_rules: {
        Row: {
          conditions: Json
          created_at: string
          discount_amount: number | null
          id: string
          multiplier: number | null
          name: string
          property_id: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          conditions: Json
          created_at?: string
          discount_amount?: number | null
          id?: string
          multiplier?: number | null
          name: string
          property_id: string
          rule_type: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          discount_amount?: number | null
          id?: string
          multiplier?: number | null
          name?: string
          property_id?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_seasons: {
        Row: {
          adjustment_type: string | null
          adjustment_value: number | null
          created_at: string | null
          end_date: string
          id: string
          multiplier: number
          rate_id: string
          season_name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          created_at?: string | null
          end_date: string
          id?: string
          multiplier?: number
          rate_id: string
          season_name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          created_at?: string | null
          end_date?: string
          id?: string
          multiplier?: number
          rate_id?: string
          season_name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_seasons_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_site_type_prices: {
        Row: {
          adjustment_type: string | null
          adjustment_value: number | null
          created_at: string | null
          id: string
          price: number
          property_id: string
          rate_id: string
          site_type_id: string
        }
        Insert: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          created_at?: string | null
          id?: string
          price: number
          property_id: string
          rate_id: string
          site_type_id: string
        }
        Update: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          created_at?: string | null
          id?: string
          price?: number
          property_id?: string
          rate_id?: string
          site_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_site_type_prices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_site_type_prices_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_site_type_prices_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_template_pushes: {
        Row: {
          created_at: string
          error: string | null
          id: string
          pushed_by: string | null
          result_summary: Json | null
          status: string
          target_property_ids: string[]
          template_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          pushed_by?: string | null
          result_summary?: Json | null
          status?: string
          target_property_ids?: string[]
          template_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          pushed_by?: string | null
          result_summary?: Json | null
          status?: string
          target_property_ids?: string[]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_template_pushes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_template_restrictions: {
        Row: {
          created_at: string
          cta: boolean
          ctd: boolean
          end_date: string
          id: string
          max_los: number | null
          min_los: number | null
          start_date: string
          stop_sell: boolean
          template_id: string
        }
        Insert: {
          created_at?: string
          cta?: boolean
          ctd?: boolean
          end_date: string
          id?: string
          max_los?: number | null
          min_los?: number | null
          start_date: string
          stop_sell?: boolean
          template_id: string
        }
        Update: {
          created_at?: string
          cta?: boolean
          ctd?: boolean
          end_date?: string
          id?: string
          max_los?: number | null
          min_los?: number | null
          start_date?: string
          stop_sell?: boolean
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_template_restrictions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_template_site_type_prices: {
        Row: {
          adjustment_type: string | null
          adjustment_value: number | null
          created_at: string
          id: string
          price: number
          site_type_code: string
          template_id: string
        }
        Insert: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          created_at?: string
          id?: string
          price: number
          site_type_code: string
          template_id: string
        }
        Update: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          created_at?: string
          id?: string
          price?: number
          site_type_code?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_template_site_type_prices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_templates: {
        Row: {
          adjustment_type: string | null
          adjustment_value: number | null
          brand_id: string | null
          created_at: string
          deposit_requirement: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          region_id: string | null
          scope: string
          template_code: string
          updated_at: string
        }
        Insert: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          brand_id?: string | null
          created_at?: string
          deposit_requirement?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          region_id?: string | null
          scope: string
          template_code: string
          updated_at?: string
        }
        Update: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          brand_id?: string | null
          created_at?: string
          deposit_requirement?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          region_id?: string | null
          scope?: string
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_templates_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          adjustment_type: string | null
          adjustment_value: number | null
          base_rate_id: string | null
          created_at: string | null
          deposit_requirement: string
          description: string | null
          end_date: string
          id: string
          is_base_rate: boolean | null
          is_default: boolean
          property_id: string
          rate_code: string
          revenue_account_id: string | null
          show_on_booking_chart: boolean
          show_on_booking_engine: boolean
          start_date: string
          updated_at: string | null
        }
        Insert: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          base_rate_id?: string | null
          created_at?: string | null
          deposit_requirement?: string
          description?: string | null
          end_date: string
          id?: string
          is_base_rate?: boolean | null
          is_default?: boolean
          property_id: string
          rate_code: string
          revenue_account_id?: string | null
          show_on_booking_chart?: boolean
          show_on_booking_engine?: boolean
          start_date: string
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string | null
          adjustment_value?: number | null
          base_rate_id?: string | null
          created_at?: string | null
          deposit_requirement?: string
          description?: string | null
          end_date?: string
          id?: string
          is_base_rate?: boolean | null
          is_default?: boolean
          property_id?: string
          rate_code?: string
          revenue_account_id?: string | null
          show_on_booking_chart?: boolean
          show_on_booking_engine?: boolean
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rates_base_rate_id_fkey"
            columns: ["base_rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_work_order_pool: {
        Row: {
          completed_at: string | null
          created_at: string
          dispatched_at: string | null
          dispatched_to_user_id: string | null
          id: string
          notes: string | null
          property_id: string
          region_id: string
          sla_hours: number | null
          status: string
          travel_minutes: number | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dispatched_at?: string | null
          dispatched_to_user_id?: string | null
          id?: string
          notes?: string | null
          property_id: string
          region_id: string
          sla_hours?: number | null
          status?: string
          travel_minutes?: number | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dispatched_at?: string | null
          dispatched_to_user_id?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          region_id?: string
          sla_hours?: number | null
          status?: string
          travel_minutes?: number | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_work_order_pool_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_work_order_pool_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_work_order_pool_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          brand_id: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_items: {
        Row: {
          category: string
          code: string | null
          created_at: string
          daily_rate: number | null
          deposit_amount: number
          description: string | null
          hourly_rate: number | null
          id: string
          image_url: string | null
          is_active: boolean
          messaging_offerable: boolean
          name: string
          property_id: string
          revenue_account_id: string | null
          stay_rate: number | null
          total_quantity: number
          tracking_mode: string
          updated_at: string
        }
        Insert: {
          category?: string
          code?: string | null
          created_at?: string
          daily_rate?: number | null
          deposit_amount?: number
          description?: string | null
          hourly_rate?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          messaging_offerable?: boolean
          name: string
          property_id: string
          revenue_account_id?: string | null
          stay_rate?: number | null
          total_quantity?: number
          tracking_mode?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string | null
          created_at?: string
          daily_rate?: number | null
          deposit_amount?: number
          description?: string | null
          hourly_rate?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          messaging_offerable?: boolean
          name?: string
          property_id?: string
          revenue_account_id?: string | null
          stay_rate?: number | null
          total_quantity?: number
          tracking_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_items_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_reservations: {
        Row: {
          checked_out_at: string | null
          created_at: string
          deposit_charged: number
          end_at: string
          folio_posting_id: string | null
          guest_id: string | null
          id: string
          notes: string | null
          pricing_mode: string
          property_id: string
          quantity: number
          rate_applied: number
          rental_item_id: string
          rental_unit_id: string | null
          reservation_id: string | null
          returned_at: string | null
          source: string
          start_at: string
          status: string
          total_charge: number
          updated_at: string
        }
        Insert: {
          checked_out_at?: string | null
          created_at?: string
          deposit_charged?: number
          end_at: string
          folio_posting_id?: string | null
          guest_id?: string | null
          id?: string
          notes?: string | null
          pricing_mode?: string
          property_id: string
          quantity?: number
          rate_applied?: number
          rental_item_id: string
          rental_unit_id?: string | null
          reservation_id?: string | null
          returned_at?: string | null
          source?: string
          start_at: string
          status?: string
          total_charge?: number
          updated_at?: string
        }
        Update: {
          checked_out_at?: string | null
          created_at?: string
          deposit_charged?: number
          end_at?: string
          folio_posting_id?: string | null
          guest_id?: string | null
          id?: string
          notes?: string | null
          pricing_mode?: string
          property_id?: string
          quantity?: number
          rate_applied?: number
          rental_item_id?: string
          rental_unit_id?: string | null
          reservation_id?: string | null
          returned_at?: string | null
          source?: string
          start_at?: string
          status?: string
          total_charge?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_reservations_folio_posting_id_fkey"
            columns: ["folio_posting_id"]
            isOneToOne: false
            referencedRelation: "folio_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_reservations_rental_item_id_fkey"
            columns: ["rental_item_id"]
            isOneToOne: false
            referencedRelation: "rental_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_reservations_rental_unit_id_fkey"
            columns: ["rental_unit_id"]
            isOneToOne: false
            referencedRelation: "rental_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_reservations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_units: {
        Row: {
          asset_tag: string | null
          created_at: string
          id: string
          notes: string | null
          property_id: string
          rental_item_id: string
          status: string
          unit_label: string
          updated_at: string
        }
        Insert: {
          asset_tag?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          rental_item_id: string
          status?: string
          unit_label: string
          updated_at?: string
        }
        Update: {
          asset_tag?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          rental_item_id?: string
          status?: string
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_units_rental_item_id_fkey"
            columns: ["rental_item_id"]
            isOneToOne: false
            referencedRelation: "rental_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_add_ons: {
        Row: {
          add_on_id: string
          created_at: string
          id: string
          price_at_booking: number
          property_id: string
          quantity: number
          reservation_id: string
        }
        Insert: {
          add_on_id: string
          created_at?: string
          id?: string
          price_at_booking: number
          property_id: string
          quantity?: number
          reservation_id: string
        }
        Update: {
          add_on_id?: string
          created_at?: string
          id?: string
          price_at_booking?: number
          property_id?: string
          quantity?: number
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_add_ons_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_add_ons_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_guests: {
        Row: {
          created_at: string | null
          folio_number: number
          guest_confirmation_number: string
          guest_id: string
          id: string
          is_primary: boolean | null
          property_id: string
          reservation_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          folio_number: number
          guest_confirmation_number: string
          guest_id: string
          id?: string
          is_primary?: boolean | null
          property_id: string
          reservation_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          folio_number?: number
          guest_confirmation_number?: string
          guest_id?: string
          id?: string
          is_primary?: boolean | null
          property_id?: string
          reservation_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_guests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_recommendations: {
        Row: {
          created_at: string
          id: string
          recommended_add_on: Json | null
          recommended_sites: Json | null
          reservation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommended_add_on?: Json | null
          recommended_sites?: Json | null
          reservation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recommended_add_on?: Json | null
          recommended_sites?: Json | null
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_recommendations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults_count: number | null
          assignment_locked: boolean | null
          billing_instructions: string | null
          check_in_date: string
          check_out_date: string
          checked_in_at: string | null
          checkin_hold_at: string | null
          checkin_hold_reason: string | null
          checkin_source: string | null
          children_count: number | null
          city_ledger_account_id: string | null
          confirmation_number: string
          created_at: string
          group_block_id: string | null
          guest_id: string
          guests_count: number
          hold_folio_type: string | null
          id: string
          is_share_master: boolean | null
          master_reservation_id: string | null
          needs_staff_review: boolean
          override_rate: number | null
          property_id: string
          rate_id: string | null
          registration_signature: string | null
          registration_signed_at: string | null
          registration_signed_name: string | null
          required_attributes: Json
          share_group_id: string | null
          signature_captured_at: string | null
          signature_path: string | null
          site_id: string | null
          site_type_id: string | null
          source_of_business_id: string | null
          special_requests: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          adults_count?: number | null
          assignment_locked?: boolean | null
          billing_instructions?: string | null
          check_in_date: string
          check_out_date: string
          checked_in_at?: string | null
          checkin_hold_at?: string | null
          checkin_hold_reason?: string | null
          checkin_source?: string | null
          children_count?: number | null
          city_ledger_account_id?: string | null
          confirmation_number?: string
          created_at?: string
          group_block_id?: string | null
          guest_id: string
          guests_count?: number
          hold_folio_type?: string | null
          id?: string
          is_share_master?: boolean | null
          master_reservation_id?: string | null
          needs_staff_review?: boolean
          override_rate?: number | null
          property_id: string
          rate_id?: string | null
          registration_signature?: string | null
          registration_signed_at?: string | null
          registration_signed_name?: string | null
          required_attributes?: Json
          share_group_id?: string | null
          signature_captured_at?: string | null
          signature_path?: string | null
          site_id?: string | null
          site_type_id?: string | null
          source_of_business_id?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          adults_count?: number | null
          assignment_locked?: boolean | null
          billing_instructions?: string | null
          check_in_date?: string
          check_out_date?: string
          checked_in_at?: string | null
          checkin_hold_at?: string | null
          checkin_hold_reason?: string | null
          checkin_source?: string | null
          children_count?: number | null
          city_ledger_account_id?: string | null
          confirmation_number?: string
          created_at?: string
          group_block_id?: string | null
          guest_id?: string
          guests_count?: number
          hold_folio_type?: string | null
          id?: string
          is_share_master?: boolean | null
          master_reservation_id?: string | null
          needs_staff_review?: boolean
          override_rate?: number | null
          property_id?: string
          rate_id?: string | null
          registration_signature?: string | null
          registration_signed_at?: string | null
          registration_signed_name?: string | null
          required_attributes?: Json
          share_group_id?: string | null
          signature_captured_at?: string | null
          signature_path?: string | null
          site_id?: string | null
          site_type_id?: string | null
          source_of_business_id?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_city_ledger_account_id_fkey"
            columns: ["city_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_group_block_id_fkey"
            columns: ["group_block_id"]
            isOneToOne: false
            referencedRelation: "group_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_master_reservation_id_fkey"
            columns: ["master_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_source_of_business_id_fkey"
            columns: ["source_of_business_id"]
            isOneToOne: false
            referencedRelation: "source_of_business"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          multiplier: number
          name: string
          property_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          multiplier?: number
          name: string
          property_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          multiplier?: number
          name?: string
          property_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          created_at: string
          event_description: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          property_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_description?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          property_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_description?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          property_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      service_status_incident_updates: {
        Row: {
          id: string
          incident_id: string
          message: string
          posted_at: string
          status: string
        }
        Insert: {
          id?: string
          incident_id: string
          message: string
          posted_at?: string
          status: string
        }
        Update: {
          id?: string
          incident_id?: string
          message?: string
          posted_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_status_incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "service_status_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      service_status_incidents: {
        Row: {
          affected_components: string[]
          created_at: string
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_components?: string[]
          created_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_components?: string[]
          created_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_booking_config: {
        Row: {
          amenities: Json
          created_at: string
          id: string
          is_bookable_online: boolean
          is_featured: boolean
          max_rig_length: number | null
          property_id: string
          public_notes: string | null
          site_id: string
          updated_at: string
        }
        Insert: {
          amenities?: Json
          created_at?: string
          id?: string
          is_bookable_online?: boolean
          is_featured?: boolean
          max_rig_length?: number | null
          property_id: string
          public_notes?: string | null
          site_id: string
          updated_at?: string
        }
        Update: {
          amenities?: Json
          created_at?: string
          id?: string
          is_bookable_online?: boolean
          is_featured?: boolean
          max_rig_length?: number | null
          property_id?: string
          public_notes?: string | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_booking_config_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_booking_config_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_custom_attributes: {
        Row: {
          code: string
          created_at: string
          data_type: string
          enforce_on_booking: boolean
          id: string
          name: string
          property_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          data_type?: string
          enforce_on_booking?: boolean
          id?: string
          name: string
          property_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          data_type?: string
          enforce_on_booking?: boolean
          id?: string
          name?: string
          property_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_custom_attributes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      site_type_booking_config: {
        Row: {
          allow_specific_site_pick: boolean
          amenities: Json
          created_at: string
          id: string
          is_bookable_online: boolean
          max_nights: number | null
          max_rig_length: number | null
          min_nights: number | null
          online_buffer: number | null
          property_id: string
          public_description: string | null
          site_type_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_specific_site_pick?: boolean
          amenities?: Json
          created_at?: string
          id?: string
          is_bookable_online?: boolean
          max_nights?: number | null
          max_rig_length?: number | null
          min_nights?: number | null
          online_buffer?: number | null
          property_id: string
          public_description?: string | null
          site_type_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_specific_site_pick?: boolean
          amenities?: Json
          created_at?: string
          id?: string
          is_bookable_online?: boolean
          max_nights?: number | null
          max_rig_length?: number | null
          min_nights?: number | null
          online_buffer?: number | null
          property_id?: string
          public_description?: string | null
          site_type_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_type_booking_config_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_type_booking_config_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: true
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      site_types: {
        Row: {
          auto_description: string | null
          base_price: number
          bed_type: string | null
          booking_engine_description_override: string | null
          code: string | null
          created_at: string
          description: string | null
          featured_amenities: string[] | null
          floor_size_sqft: number | null
          icon: string | null
          id: string
          image_path: string | null
          is_wheelchair_accessible: boolean | null
          max_adults: number | null
          max_children: number | null
          name: string
          property_id: string
          room_class: string | null
          room_views: string[] | null
          smoking_preference: string | null
          updated_at: string
          use_auto_description: boolean
        }
        Insert: {
          auto_description?: string | null
          base_price: number
          bed_type?: string | null
          booking_engine_description_override?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          featured_amenities?: string[] | null
          floor_size_sqft?: number | null
          icon?: string | null
          id?: string
          image_path?: string | null
          is_wheelchair_accessible?: boolean | null
          max_adults?: number | null
          max_children?: number | null
          name: string
          property_id: string
          room_class?: string | null
          room_views?: string[] | null
          smoking_preference?: string | null
          updated_at?: string
          use_auto_description?: boolean
        }
        Update: {
          auto_description?: string | null
          base_price?: number
          bed_type?: string | null
          booking_engine_description_override?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          featured_amenities?: string[] | null
          floor_size_sqft?: number | null
          icon?: string | null
          id?: string
          image_path?: string | null
          is_wheelchair_accessible?: boolean | null
          max_adults?: number | null
          max_children?: number | null
          name?: string
          property_id?: string
          room_class?: string | null
          room_views?: string[] | null
          smoking_preference?: string | null
          updated_at?: string
          use_auto_description?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "site_types_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          allows_bump_outs: boolean
          amenities: string[] | null
          bed_config: string | null
          connecting_room_id: string | null
          created_at: string
          custom_attributes: Json
          description: string | null
          floor: string | null
          has_30amp: boolean
          has_50amp: boolean
          has_fire_pit: boolean
          has_picnic_table: boolean
          has_towed_vehicle_parking: boolean | null
          has_towing_vehicle_parking: boolean | null
          id: string
          is_active: boolean
          is_ada_accessible: boolean | null
          is_shaded: boolean
          maintenance_status: string | null
          map_height: number | null
          map_width: number | null
          map_x: number | null
          map_y: number | null
          max_occupancy: number
          max_vehicle_length: number | null
          property_id: string
          rotation: number | null
          site_access_type: string | null
          site_number: string
          site_type_id: string
          slideouts: number | null
          unavailable_end_date: string | null
          unavailable_reason: string | null
          unavailable_start_date: string | null
          updated_at: string
          view_type: string | null
          zone_id: string | null
        }
        Insert: {
          allows_bump_outs?: boolean
          amenities?: string[] | null
          bed_config?: string | null
          connecting_room_id?: string | null
          created_at?: string
          custom_attributes?: Json
          description?: string | null
          floor?: string | null
          has_30amp?: boolean
          has_50amp?: boolean
          has_fire_pit?: boolean
          has_picnic_table?: boolean
          has_towed_vehicle_parking?: boolean | null
          has_towing_vehicle_parking?: boolean | null
          id?: string
          is_active?: boolean
          is_ada_accessible?: boolean | null
          is_shaded?: boolean
          maintenance_status?: string | null
          map_height?: number | null
          map_width?: number | null
          map_x?: number | null
          map_y?: number | null
          max_occupancy?: number
          max_vehicle_length?: number | null
          property_id: string
          rotation?: number | null
          site_access_type?: string | null
          site_number: string
          site_type_id: string
          slideouts?: number | null
          unavailable_end_date?: string | null
          unavailable_reason?: string | null
          unavailable_start_date?: string | null
          updated_at?: string
          view_type?: string | null
          zone_id?: string | null
        }
        Update: {
          allows_bump_outs?: boolean
          amenities?: string[] | null
          bed_config?: string | null
          connecting_room_id?: string | null
          created_at?: string
          custom_attributes?: Json
          description?: string | null
          floor?: string | null
          has_30amp?: boolean
          has_50amp?: boolean
          has_fire_pit?: boolean
          has_picnic_table?: boolean
          has_towed_vehicle_parking?: boolean | null
          has_towing_vehicle_parking?: boolean | null
          id?: string
          is_active?: boolean
          is_ada_accessible?: boolean | null
          is_shaded?: boolean
          maintenance_status?: string | null
          map_height?: number | null
          map_width?: number | null
          map_x?: number | null
          map_y?: number | null
          max_occupancy?: number
          max_vehicle_length?: number | null
          property_id?: string
          rotation?: number | null
          site_access_type?: string | null
          site_number?: string
          site_type_id?: string
          slideouts?: number | null
          unavailable_end_date?: string | null
          unavailable_reason?: string | null
          unavailable_start_date?: string | null
          updated_at?: string
          view_type?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_connecting_room_id_fkey"
            columns: ["connecting_room_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_site_type_id_fkey"
            columns: ["site_type_id"]
            isOneToOne: false
            referencedRelation: "site_types"
            referencedColumns: ["id"]
          },
        ]
      }
      source_of_business: {
        Row: {
          code: string
          created_at: string
          definition: string
          id: string
          is_default: boolean
          property_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          definition: string
          id?: string
          is_default?: boolean
          property_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          definition?: string
          id?: string
          is_default?: boolean
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_of_business_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          staff_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          staff_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_sends: {
        Row: {
          city_ledger_account_id: string
          id: string
          is_mock: boolean | null
          property_id: string
          sent_at: string | null
          sent_by_name: string | null
          sent_to_email: string
          statement_date: string
          total_amount: number
        }
        Insert: {
          city_ledger_account_id: string
          id?: string
          is_mock?: boolean | null
          property_id: string
          sent_at?: string | null
          sent_by_name?: string | null
          sent_to_email: string
          statement_date: string
          total_amount: number
        }
        Update: {
          city_ledger_account_id?: string
          id?: string
          is_mock?: boolean | null
          property_id?: string
          sent_at?: string | null
          sent_by_name?: string | null
          sent_to_email?: string
          statement_date?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "statement_sends_city_ledger_account_id_fkey"
            columns: ["city_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_sends_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          flat_amount: number
          hubspot_deal_id: string | null
          hubspot_last_synced_at: string | null
          id: string
          max_sites: number
          organization_id: string
          price_per_site: number
          pricing_model: string
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          flat_amount?: number
          hubspot_deal_id?: string | null
          hubspot_last_synced_at?: string | null
          id?: string
          max_sites?: number
          organization_id: string
          price_per_site?: number
          pricing_model?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          flat_amount?: number
          hubspot_deal_id?: string | null
          hubspot_last_synced_at?: string | null
          id?: string
          max_sites?: number
          organization_id?: string
          price_per_site?: number
          pricing_model?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trailguide_item_recipients: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trailguide_item_recipients_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "trailguide_items"
            referencedColumns: ["id"]
          },
        ]
      }
      trailguide_item_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          delivery_results: Json | null
          error: string | null
          id: string
          input_prompt: string
          item_id: string
          output_text: string | null
          property_id: string
          proposed_actions: Json | null
          started_at: string
          status: string
          tool_calls: Json | null
          triggered_by: string
          triggered_by_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          delivery_results?: Json | null
          error?: string | null
          id?: string
          input_prompt: string
          item_id: string
          output_text?: string | null
          property_id: string
          proposed_actions?: Json | null
          started_at?: string
          status?: string
          tool_calls?: Json | null
          triggered_by?: string
          triggered_by_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          delivery_results?: Json | null
          error?: string | null
          id?: string
          input_prompt?: string
          item_id?: string
          output_text?: string | null
          property_id?: string
          proposed_actions?: Json | null
          started_at?: string
          status?: string
          tool_calls?: Json | null
          triggered_by?: string
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trailguide_item_runs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "trailguide_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trailguide_item_runs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      trailguide_items: {
        Row: {
          created_at: string
          created_by_user_id: string
          delivery_channels: string[]
          id: string
          is_active: boolean
          last_run_at: string | null
          last_status: string | null
          name: string
          next_run_at: string | null
          prompt: string
          property_id: string
          requires_approval: boolean
          schedule_config: Json
          schedule_type: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          delivery_channels?: string[]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          name: string
          next_run_at?: string | null
          prompt: string
          property_id: string
          requires_approval?: boolean
          schedule_config?: Json
          schedule_type: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          delivery_channels?: string[]
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          next_run_at?: string | null
          prompt?: string
          property_id?: string
          requires_approval?: boolean
          schedule_config?: Json
          schedule_type?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trailguide_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      trailguide_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          item_id: string | null
          kind: string
          property_id: string
          read_at: string | null
          run_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          kind?: string
          property_id: string
          read_at?: string | null
          run_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          kind?: string
          property_id?: string
          read_at?: string | null
          run_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trailguide_notifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "trailguide_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trailguide_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trailguide_notifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "trailguide_item_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_brand_access: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_brand_admin: boolean
          organization_id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_brand_admin?: boolean
          organization_id: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_brand_admin?: boolean
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_brand_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_brand_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          created_at: string | null
          custom_role_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_role_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_role_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lockouts: {
        Row: {
          id: string
          locked_at: string
          reason: string | null
          unlock_at: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          user_id: string
        }
        Insert: {
          id?: string
          locked_at?: string
          reason?: string | null
          unlock_at?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id: string
        }
        Update: {
          id?: string
          locked_at?: string
          reason?: string | null
          unlock_at?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_password_history: {
        Row: {
          changed_by: string | null
          id: string
          password_changed_at: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          id?: string
          password_changed_at?: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          id?: string
          password_changed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_property_access: {
        Row: {
          created_at: string
          id: string
          is_org_admin: boolean
          organization_id: string
          property_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_org_admin?: boolean
          organization_id: string
          property_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_org_admin?: boolean
          organization_id?: string
          property_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_property_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_access_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_region_access: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          organization_id: string
          region_id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          organization_id: string
          region_id: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          region_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_region_access_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_region_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_region_access_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_catalog_endpoints: {
        Row: {
          category: string
          created_at: string
          description: string
          display_name: string
          event_key: string
          id: string
          is_active: boolean
          payload_example: Json
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          display_name: string
          event_key: string
          id?: string
          is_active?: boolean
          payload_example?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          display_name?: string
          event_key?: string
          id?: string
          is_active?: boolean
          payload_example?: Json
          updated_at?: string
        }
        Relationships: []
      }
      work_order_attachments: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          property_id: string
          storage_path: string
          uploaded_by_user_id: string
          work_order_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          property_id: string
          storage_path: string
          uploaded_by_user_id: string
          work_order_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          property_id?: string
          storage_path?: string
          uploaded_by_user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_attachments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_system: boolean
          property_id: string
          user_id: string
          work_order_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_system?: boolean
          property_id: string
          user_id: string
          work_order_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_system?: boolean
          property_id?: string
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_comments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_comments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_cost_items: {
        Row: {
          cost_type: Database["public"]["Enums"]["wo_cost_type"]
          created_at: string
          created_by_user_id: string
          description: string
          id: string
          incurred_on: string
          property_id: string
          quantity: number
          total_cost: number | null
          unit_cost: number
          vendor_name: string | null
          work_order_id: string
        }
        Insert: {
          cost_type: Database["public"]["Enums"]["wo_cost_type"]
          created_at?: string
          created_by_user_id: string
          description: string
          id?: string
          incurred_on?: string
          property_id: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
          vendor_name?: string | null
          work_order_id: string
        }
        Update: {
          cost_type?: Database["public"]["Enums"]["wo_cost_type"]
          created_at?: string
          created_by_user_id?: string
          description?: string
          id?: string
          incurred_on?: string
          property_id?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
          vendor_name?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_cost_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_cost_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_at: string | null
          assigned_to_user_id: string | null
          category: Database["public"]["Enums"]["wo_category"]
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          location_text: string | null
          priority: Database["public"]["Enums"]["wo_priority"]
          property_id: string
          reported_at: string
          reported_by_user_id: string
          resolution_notes: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at: string
          wo_number: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          category?: Database["public"]["Enums"]["wo_category"]
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location_text?: string | null
          priority?: Database["public"]["Enums"]["wo_priority"]
          property_id: string
          reported_at?: string
          reported_by_user_id: string
          resolution_notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title: string
          updated_at?: string
          wo_number?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          category?: Database["public"]["Enums"]["wo_category"]
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          location_text?: string | null
          priority?: Database["public"]["Enums"]["wo_priority"]
          property_id?: string
          reported_at?: string
          reported_by_user_id?: string
          resolution_notes?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["wo_status"]
          title?: string
          updated_at?: string
          wo_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_guest: {
        Args: { _guest_id: string; _property_id: string }
        Returns: boolean
      }
      cleanup_expired_booking_holds: { Args: never; Returns: number }
      compute_executive_snapshot: {
        Args: {
          _brand_id: string
          _organization_id: string
          _period_end: string
          _period_start: string
          _region_id: string
        }
        Returns: string
      }
      current_user_has_mfa: { Args: never; Returns: boolean }
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
      generate_booking_public_slug: { Args: never; Returns: string }
      get_active_memberships_for_property: {
        Args: { _guest_id: string; _property_id: string }
        Returns: {
          discount_percent: number
          member_account_id: string
          member_number: string
          program_id: string
          tier_id: string
          tier_priority: number
        }[]
      }
      get_rental_availability: {
        Args: {
          _end: string
          _exclude_reservation_id?: string
          _item_id: string
          _start: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _organization_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      pci_retention_sweep: { Args: never; Returns: Json }
      refresh_portfolio_metrics: {
        Args: { _from: string; _property_id: string; _to: string }
        Returns: number
      }
      user_can_access_property: {
        Args: { _property_id: string }
        Returns: boolean
      }
      user_has_brand_access: { Args: { _brand_id: string }; Returns: boolean }
      user_has_org_admin_access: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      user_has_property_access: {
        Args: { _property_id: string }
        Returns: boolean
      }
      user_has_region_access: { Args: { _region_id: string }; Returns: boolean }
    }
    Enums: {
      account_type:
        | "asset"
        | "liability"
        | "equity"
        | "revenue"
        | "expense"
        | "tax"
      app_role:
        | "admin"
        | "manager"
        | "front_desk"
        | "super_admin"
        | "internal_admin"
        | "sales"
        | "support"
        | "finance"
        | "brand_admin"
        | "regional_manager"
      assignment_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "inspected"
        | "declined"
      channel_code: "expedia" | "bookingcom"
      channel_holdback_type: "fixed" | "percent"
      channel_queue_status: "pending" | "sending" | "sent" | "failed"
      channel_status: "disconnected" | "connected" | "error"
      channel_sync_direction: "outbound" | "inbound"
      cleaning_type: "stayover" | "departure" | "deep_clean"
      housekeeping_status:
        | "clean"
        | "dirty"
        | "needs_inspection"
        | "out_of_order"
      ledger_type: "advance_deposit" | "guest" | "city"
      membership_account_status:
        | "active"
        | "pending"
        | "suspended"
        | "expired"
        | "cancelled"
      membership_billing_period: "monthly" | "quarterly" | "annual" | "lifetime"
      membership_dues_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "waived"
      occupancy_status: "vacant" | "occupied"
      reservation_status:
        | "PENDING"
        | "CONFIRMED"
        | "CHECKED_IN"
        | "CHECKED_OUT"
        | "CANCELLED"
        | "NO_SHOW"
        | "CHECK_IN_HOLD"
      transaction_type:
        | "payment"
        | "charge"
        | "transfer"
        | "refund"
        | "adjustment"
      wo_category:
        | "plumbing"
        | "electrical"
        | "grounds"
        | "structural"
        | "site_specific"
        | "other"
      wo_cost_type: "parts" | "labor" | "external_vendor" | "other"
      wo_priority: "low" | "normal" | "high" | "urgent"
      wo_status: "open" | "in_progress" | "on_hold" | "completed" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_type: [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
        "tax",
      ],
      app_role: [
        "admin",
        "manager",
        "front_desk",
        "super_admin",
        "internal_admin",
        "sales",
        "support",
        "finance",
        "brand_admin",
        "regional_manager",
      ],
      assignment_status: [
        "pending",
        "in_progress",
        "completed",
        "inspected",
        "declined",
      ],
      channel_code: ["expedia", "bookingcom"],
      channel_holdback_type: ["fixed", "percent"],
      channel_queue_status: ["pending", "sending", "sent", "failed"],
      channel_status: ["disconnected", "connected", "error"],
      channel_sync_direction: ["outbound", "inbound"],
      cleaning_type: ["stayover", "departure", "deep_clean"],
      housekeeping_status: [
        "clean",
        "dirty",
        "needs_inspection",
        "out_of_order",
      ],
      ledger_type: ["advance_deposit", "guest", "city"],
      membership_account_status: [
        "active",
        "pending",
        "suspended",
        "expired",
        "cancelled",
      ],
      membership_billing_period: ["monthly", "quarterly", "annual", "lifetime"],
      membership_dues_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "waived",
      ],
      occupancy_status: ["vacant", "occupied"],
      reservation_status: [
        "PENDING",
        "CONFIRMED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "CANCELLED",
        "NO_SHOW",
        "CHECK_IN_HOLD",
      ],
      transaction_type: [
        "payment",
        "charge",
        "transfer",
        "refund",
        "adjustment",
      ],
      wo_category: [
        "plumbing",
        "electrical",
        "grounds",
        "structural",
        "site_specific",
        "other",
      ],
      wo_cost_type: ["parts", "labor", "external_vendor", "other"],
      wo_priority: ["low", "normal", "high", "urgent"],
      wo_status: ["open", "in_progress", "on_hold", "completed", "cancelled"],
    },
  },
} as const
