export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointment: {
        Row: {
          camera_id: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          collaborator_id: string | null;
          completed_by: string | null;
          created_at: string;
          finished_at: string | null;
          id: string;
          notes: string | null;
          origin: Database["public"]["Enums"]["appointment_origin"];
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          pet_id: string;
          photos: string[];
          request_group_id: string | null;
          scheduled_at: string | null;
          service_type_id: string | null;
          staff_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["appointment_status"];
          tenant_id: string;
          tutor_id: string;
        };
        Insert: {
          camera_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          collaborator_id?: string | null;
          completed_by?: string | null;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          notes?: string | null;
          origin?: Database["public"]["Enums"]["appointment_origin"];
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          pet_id: string;
          photos?: string[];
          request_group_id?: string | null;
          scheduled_at?: string | null;
          service_type_id?: string | null;
          staff_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          tenant_id: string;
          tutor_id: string;
        };
        Update: {
          camera_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          collaborator_id?: string | null;
          completed_by?: string | null;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          notes?: string | null;
          origin?: Database["public"]["Enums"]["appointment_origin"];
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          pet_id?: string;
          photos?: string[];
          request_group_id?: string | null;
          scheduled_at?: string | null;
          service_type_id?: string | null;
          staff_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          tenant_id?: string;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_camera_id_fkey";
            columns: ["camera_id"];
            isOneToOne: false;
            referencedRelation: "camera";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_collaborator_id_fkey";
            columns: ["collaborator_id"];
            isOneToOne: false;
            referencedRelation: "collaborator";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pet";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "service_type";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutor";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_step: {
        Row: {
          appointment_id: string;
          done: boolean;
          done_at: string | null;
          id: string;
          label: string;
          position: number;
          tenant_id: string;
        };
        Insert: {
          appointment_id: string;
          done?: boolean;
          done_at?: string | null;
          id?: string;
          label: string;
          position?: number;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string;
          done?: boolean;
          done_at?: string | null;
          id?: string;
          label?: string;
          position?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_step_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_step_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          meta: Json;
          target: string | null;
          tenant_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          meta?: Json;
          target?: string | null;
          tenant_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          meta?: Json;
          target?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      camera: {
        Row: {
          active: boolean;
          created_at: string;
          host: string | null;
          id: string;
          port: number;
          room_label: string;
          stream_path: string;
          tenant_id: string;
          username: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          host?: string | null;
          id?: string;
          port?: number;
          room_label: string;
          stream_path?: string;
          tenant_id: string;
          username?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          host?: string | null;
          id?: string;
          port?: number;
          room_label?: string;
          stream_path?: string;
          tenant_id?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "camera_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      camera_credential: {
        Row: {
          camera_id: string;
          password_enc: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          camera_id: string;
          password_enc: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          camera_id?: string;
          password_enc?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "camera_credential_camera_id_fkey";
            columns: ["camera_id"];
            isOneToOne: true;
            referencedRelation: "camera";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "camera_credential_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      camera_gateway: {
        Row: {
          api_tunnel_url: string;
          created_at: string;
          last_seen_at: string | null;
          tenant_id: string;
          tunnel_url: string;
          upload_token_hash: string;
        };
        Insert: {
          api_tunnel_url: string;
          created_at?: string;
          last_seen_at?: string | null;
          tenant_id: string;
          tunnel_url: string;
          upload_token_hash: string;
        };
        Update: {
          api_tunnel_url?: string;
          created_at?: string;
          last_seen_at?: string | null;
          tenant_id?: string;
          tunnel_url?: string;
          upload_token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "camera_gateway_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      collaborator: {
        Row: {
          active: boolean;
          created_at: string;
          full_name: string;
          id: string;
          role_title: string | null;
          tenant_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          full_name: string;
          id?: string;
          role_title?: string | null;
          tenant_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          full_name?: string;
          id?: string;
          role_title?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collaborator_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      collaborator_schedule: {
        Row: {
          collaborator_id: string;
          end_time: string;
          id: string;
          start_time: string;
          tenant_id: string;
          weekday: number;
        };
        Insert: {
          collaborator_id: string;
          end_time: string;
          id?: string;
          start_time: string;
          tenant_id: string;
          weekday: number;
        };
        Update: {
          collaborator_id?: string;
          end_time?: string;
          id?: string;
          start_time?: string;
          tenant_id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "collaborator_schedule_collaborator_id_fkey";
            columns: ["collaborator_id"];
            isOneToOne: false;
            referencedRelation: "collaborator";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collaborator_schedule_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      consent: {
        Row: {
          created_at: string;
          granted: boolean;
          granted_at: string | null;
          id: string;
          purpose: string;
          tenant_id: string;
          tutor_id: string;
        };
        Insert: {
          created_at?: string;
          granted?: boolean;
          granted_at?: string | null;
          id?: string;
          purpose: string;
          tenant_id: string;
          tutor_id: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          granted_at?: string | null;
          id?: string;
          purpose?: string;
          tenant_id?: string;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consent_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutor";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          appointment_id: string;
          author_id: string | null;
          comment: string | null;
          created_at: string;
          direction: Database["public"]["Enums"]["feedback_direction"];
          id: string;
          rating: number | null;
          responses: Json | null;
          tenant_id: string;
        };
        Insert: {
          appointment_id: string;
          author_id?: string | null;
          comment?: string | null;
          created_at?: string;
          direction: Database["public"]["Enums"]["feedback_direction"];
          id?: string;
          rating?: number | null;
          responses?: Json | null;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string;
          author_id?: string | null;
          comment?: string | null;
          created_at?: string;
          direction?: Database["public"]["Enums"]["feedback_direction"];
          id?: string;
          rating?: number | null;
          responses?: Json | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_entry: {
        Row: {
          amount_cents: number;
          appointment_id: string | null;
          category: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          occurred_on: string;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          refund_id: string | null;
          reservation_id: string | null;
          snapshot: Json;
          source: Database["public"]["Enums"]["finance_source"];
          tenant_id: string;
          type: Database["public"]["Enums"]["finance_entry_type"];
        };
        Insert: {
          amount_cents: number;
          appointment_id?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          occurred_on?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          refund_id?: string | null;
          reservation_id?: string | null;
          snapshot?: Json;
          source?: Database["public"]["Enums"]["finance_source"];
          tenant_id: string;
          type: Database["public"]["Enums"]["finance_entry_type"];
        };
        Update: {
          amount_cents?: number;
          appointment_id?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          occurred_on?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          refund_id?: string | null;
          reservation_id?: string | null;
          snapshot?: Json;
          source?: Database["public"]["Enums"]["finance_source"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["finance_entry_type"];
        };
        Relationships: [
          {
            foreignKeyName: "finance_entry_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: true;
            referencedRelation: "finance_refund";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: true;
            referencedRelation: "product_reservation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_refund: {
        Row: {
          amount_cents: number;
          appointment_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["finance_refund_kind"];
          original_entry_id: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          reason: string;
          reservation_id: string | null;
          tenant_id: string;
        };
        Insert: {
          amount_cents: number;
          appointment_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["finance_refund_kind"];
          original_entry_id: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          reason: string;
          reservation_id?: string | null;
          tenant_id: string;
        };
        Update: {
          amount_cents?: number;
          appointment_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          idempotency_key?: string;
          kind?: Database["public"]["Enums"]["finance_refund_kind"];
          original_entry_id?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          reason?: string;
          reservation_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_refund_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_original_entry_id_fkey";
            columns: ["original_entry_id"];
            isOneToOne: false;
            referencedRelation: "finance_entry";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_original_entry_id_fkey";
            columns: ["original_entry_id"];
            isOneToOne: false;
            referencedRelation: "finance_movement_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "product_reservation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_refund_item: {
        Row: {
          id: string;
          product_snapshot: Json;
          quantity: number;
          refund_id: string;
          reservation_item_id: string;
          tenant_id: string;
          unit_price_cents: number;
        };
        Insert: {
          id?: string;
          product_snapshot?: Json;
          quantity: number;
          refund_id: string;
          reservation_item_id: string;
          tenant_id: string;
          unit_price_cents: number;
        };
        Update: {
          id?: string;
          product_snapshot?: Json;
          quantity?: number;
          refund_id?: string;
          reservation_item_id?: string;
          tenant_id?: string;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "finance_refund_item_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: false;
            referencedRelation: "finance_refund";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_item_reservation_item_id_fkey";
            columns: ["reservation_item_id"];
            isOneToOne: false;
            referencedRelation: "product_reservation_item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_refund_item_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      membership: {
        Row: {
          created_at: string;
          id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["staff_role"];
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          profile_id: string;
          role?: Database["public"]["Enums"]["staff_role"];
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["staff_role"];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membership_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "membership_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      pet: {
        Row: {
          birth_date: string | null;
          breed: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          photo_path: string | null;
          size: string | null;
          species: string | null;
          tenant_id: string;
          tutor_id: string;
        };
        Insert: {
          birth_date?: string | null;
          breed?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          photo_path?: string | null;
          size?: string | null;
          species?: string | null;
          tenant_id: string;
          tutor_id: string;
        };
        Update: {
          birth_date?: string | null;
          breed?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          photo_path?: string | null;
          size?: string | null;
          species?: string | null;
          tenant_id?: string;
          tutor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutor";
            referencedColumns: ["id"];
          },
        ];
      };
      pet_behavior_report: {
        Row: {
          appointment_id: string;
          author_id: string | null;
          created_at: string;
          id: string;
          note: string | null;
          overall_score: number | null;
          pet_id: string;
          responses: Json;
          tenant_id: string;
        };
        Insert: {
          appointment_id: string;
          author_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          overall_score?: number | null;
          pet_id: string;
          responses?: Json;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string;
          author_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          overall_score?: number | null;
          pet_id?: string;
          responses?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pet_behavior_report_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_behavior_report_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_behavior_report_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pet";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_behavior_report_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      product: {
        Row: {
          active: boolean;
          category: string | null;
          created_at: string;
          description: string | null;
          for_sale: boolean;
          id: string;
          min_stock: number;
          name: string;
          photo_path: string | null;
          photos: string[];
          price_cents: number;
          stock: number;
          tenant_id: string;
        };
        Insert: {
          active?: boolean;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          for_sale?: boolean;
          id?: string;
          min_stock?: number;
          name: string;
          photo_path?: string | null;
          photos?: string[];
          price_cents?: number;
          stock?: number;
          tenant_id: string;
        };
        Update: {
          active?: boolean;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          for_sale?: boolean;
          id?: string;
          min_stock?: number;
          name?: string;
          photo_path?: string | null;
          photos?: string[];
          price_cents?: number;
          stock?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reservation: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string | null;
          note: string | null;
          origin: Database["public"]["Enums"]["reservation_origin"];
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          rejected_at: string | null;
          rejected_by: string | null;
          rejection_reason: string | null;
          rejection_seen_at: string | null;
          status: Database["public"]["Enums"]["reservation_status"];
          tenant_id: string;
          tutor_id: string | null;
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          note?: string | null;
          origin?: Database["public"]["Enums"]["reservation_origin"];
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          rejection_seen_at?: string | null;
          status?: Database["public"]["Enums"]["reservation_status"];
          tenant_id: string;
          tutor_id?: string | null;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          note?: string | null;
          origin?: Database["public"]["Enums"]["reservation_origin"];
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          rejection_seen_at?: string | null;
          status?: Database["public"]["Enums"]["reservation_status"];
          tenant_id?: string;
          tutor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_reservation_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_rejected_by_fkey";
            columns: ["rejected_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutor";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reservation_item: {
        Row: {
          id: string;
          price_cents: number;
          product_id: string;
          quantity: number;
          reservation_id: string;
          tenant_id: string;
          variant_id: string | null;
          variant_label: string | null;
        };
        Insert: {
          id?: string;
          price_cents?: number;
          product_id: string;
          quantity?: number;
          reservation_id: string;
          tenant_id: string;
          variant_id?: string | null;
          variant_label?: string | null;
        };
        Update: {
          id?: string;
          price_cents?: number;
          product_id?: string;
          quantity?: number;
          reservation_id?: string;
          tenant_id?: string;
          variant_id?: string | null;
          variant_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_reservation_item_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_item_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "product_reservation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_item_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reservation_item_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variant";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variant: {
        Row: {
          active: boolean;
          color_hex: string | null;
          color_name: string | null;
          created_at: string;
          id: string;
          position: number;
          price_cents: number;
          product_id: string;
          size: string | null;
          stock: number;
          tenant_id: string;
          weight_grams: number | null;
          weight_unit: string | null;
          weight_value: number | null;
        };
        Insert: {
          active?: boolean;
          color_hex?: string | null;
          color_name?: string | null;
          created_at?: string;
          id?: string;
          position?: number;
          price_cents?: number;
          product_id: string;
          size?: string | null;
          stock?: number;
          tenant_id: string;
          weight_grams?: number | null;
          weight_unit?: string | null;
          weight_value?: number | null;
        };
        Update: {
          active?: boolean;
          color_hex?: string | null;
          color_name?: string | null;
          created_at?: string;
          id?: string;
          position?: number;
          price_cents?: number;
          product_id?: string;
          size?: string | null;
          stock?: number;
          tenant_id?: string;
          weight_grams?: number | null;
          weight_unit?: string | null;
          weight_value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variant_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variant_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      profile: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      recording: {
        Row: {
          appointment_id: string;
          camera_id: string | null;
          created_at: string;
          duration_sec: number | null;
          ended_at: string | null;
          id: string;
          retain_until: string | null;
          size_bytes: number | null;
          started_at: string | null;
          storage_path: string;
          tenant_id: string;
        };
        Insert: {
          appointment_id: string;
          camera_id?: string | null;
          created_at?: string;
          duration_sec?: number | null;
          ended_at?: string | null;
          id?: string;
          retain_until?: string | null;
          size_bytes?: number | null;
          started_at?: string | null;
          storage_path: string;
          tenant_id: string;
        };
        Update: {
          appointment_id?: string;
          camera_id?: string | null;
          created_at?: string;
          duration_sec?: number | null;
          ended_at?: string | null;
          id?: string;
          retain_until?: string | null;
          size_bytes?: number | null;
          started_at?: string | null;
          storage_path?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recording_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recording_camera_id_fkey";
            columns: ["camera_id"];
            isOneToOne: false;
            referencedRelation: "camera";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recording_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      service_type: {
        Row: {
          active: boolean;
          created_at: string;
          default_steps: string[];
          description: string | null;
          duration_min: number;
          id: string;
          name: string;
          price_cents: number;
          tenant_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          default_steps?: string[];
          description?: string | null;
          duration_min?: number;
          id?: string;
          name: string;
          price_cents?: number;
          tenant_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          default_steps?: string[];
          description?: string | null;
          duration_min?: number;
          id?: string;
          name?: string;
          price_cents?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_type_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movement: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          product_id: string;
          quantity: number;
          refund_id: string | null;
          reservation_id: string | null;
          source: Database["public"]["Enums"]["stock_movement_source"];
          stock_after: number;
          stock_before: number;
          tenant_id: string;
          type: Database["public"]["Enums"]["stock_movement_type"];
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          product_id: string;
          quantity: number;
          refund_id?: string | null;
          reservation_id?: string | null;
          source?: Database["public"]["Enums"]["stock_movement_source"];
          stock_after: number;
          stock_before: number;
          tenant_id: string;
          type: Database["public"]["Enums"]["stock_movement_type"];
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          product_id?: string;
          quantity?: number;
          refund_id?: string | null;
          reservation_id?: string | null;
          source?: Database["public"]["Enums"]["stock_movement_source"];
          stock_after?: number;
          stock_before?: number;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["stock_movement_type"];
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movement_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movement_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movement_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: false;
            referencedRelation: "finance_refund";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movement_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "product_reservation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movement_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movement_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variant";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          settings: Json;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          settings?: Json;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          settings?: Json;
          slug?: string;
        };
        Relationships: [];
      };
      tutor: {
        Row: {
          cpf: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          tenant_id: string;
        };
        Insert: {
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          tenant_id: string;
        };
        Update: {
          cpf?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      finance_movement_view: {
        Row: {
          amount_cents: number | null;
          appointment_id: string | null;
          category: string | null;
          created_at: string | null;
          description: string | null;
          id: string | null;
          movement_kind: string | null;
          movement_origin: string | null;
          occurred_on: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          refund_id: string | null;
          refunds: Json | null;
          reservation_id: string | null;
          reservation_status: string | null;
          snapshot: Json | null;
          source: Database["public"]["Enums"]["finance_source"] | null;
          tenant_id: string | null;
          type: Database["public"]["Enums"]["finance_entry_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "finance_entry_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_refund_id_fkey";
            columns: ["refund_id"];
            isOneToOne: true;
            referencedRelation: "finance_refund";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: true;
            referencedRelation: "product_reservation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entry_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
      pet_behavior_summary: {
        Row: {
          average_score: number | null;
          last_report_at: string | null;
          pet_id: string | null;
          report_count: number | null;
          tenant_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pet_behavior_report_pet_id_fkey";
            columns: ["pet_id"];
            isOneToOne: false;
            referencedRelation: "pet";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pet_behavior_report_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenant";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      can_manage_finance: { Args: { p_tenant_id: string }; Returns: boolean };
      cancel_product_reservation: {
        Args: {
          p_reason: string;
          p_reservation_id: string;
          p_target_status?: Database["public"]["Enums"]["reservation_status"];
        };
        Returns: undefined;
      };
      cancel_reservation: {
        Args: { p_reservation_id: string };
        Returns: undefined;
      };
      cancel_reservation_item: {
        Args: { p_item_id: string };
        Returns: undefined;
      };
      claim_tutor_access: { Args: never; Returns: undefined };
      complete_product_sale: {
        Args: {
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_reservation_id: string;
        };
        Returns: undefined;
      };
      expire_product_reservations: { Args: never; Returns: number };
      get_busy_slots: {
        Args: {
          p_collaborator_id: string;
          p_from: string;
          p_tenant_id: string;
          p_to: string;
        };
        Returns: string[];
      };
      has_staff_role: {
        Args: {
          _roles: Database["public"]["Enums"]["staff_role"][];
          _tenant: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _tenant: string }; Returns: boolean };
      link_tutor_access: {
        Args: { p_email: string; p_user_id: string };
        Returns: undefined;
      };
      mark_rejection_seen: {
        Args: { p_reservation_id: string };
        Returns: undefined;
      };
      my_tutor_id: { Args: { _tenant: string }; Returns: string };
      product_variant_label: {
        Args: { v: Database["public"]["Tables"]["product_variant"]["Row"] };
        Returns: string;
      };
      refund_product_sale: {
        Args: {
          p_idempotency_key: string;
          p_items: Json;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_reason: string;
          p_reservation_id: string;
        };
        Returns: string;
      };
      refund_reservation: {
        Args: { p_reservation_id: string };
        Returns: undefined;
      };
      refund_service: {
        Args: {
          p_appointment_id: string;
          p_idempotency_key: string;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_reason: string;
        };
        Returns: string;
      };
      register_counter_sale: {
        Args: {
          p_idempotency_key: string;
          p_items: Json;
          p_payment_method: Database["public"]["Enums"]["payment_method"];
          p_tenant_id: string;
          p_tutor_id: string;
        };
        Returns: string;
      };
      register_stock_movement: {
        Args: {
          p_note?: string;
          p_product_id: string;
          p_quantity: number;
          p_type: Database["public"]["Enums"]["stock_movement_type"];
          p_variant_id?: string;
        };
        Returns: undefined;
      };
      reserve_products: {
        Args: { p_items: Json; p_note?: string; p_tenant_id: string };
        Returns: string;
      };
      restore_reservation_stock: {
        Args: { p_reservation_id: string };
        Returns: undefined;
      };
      search_finance_movements: {
        Args: {
          p_from?: string;
          p_item?: string;
          p_kind?: string;
          p_max_cents?: number;
          p_min_cents?: number;
          p_origin?: string;
          p_page?: number;
          p_page_size?: number;
          p_payment?: Database["public"]["Enums"]["payment_method"];
          p_q?: string;
          p_tenant_id: string;
          p_to?: string;
        };
        Returns: Json;
      };
      search_stock_movements: {
        Args: {
          p_from?: string;
          p_page?: number;
          p_page_size?: number;
          p_q?: string;
          p_source?: Database["public"]["Enums"]["stock_movement_source"];
          p_tenant_id: string;
          p_to?: string;
          p_type?: Database["public"]["Enums"]["stock_movement_type"];
        };
        Returns: Json;
      };
      set_stock_context: {
        Args: {
          p_note?: string;
          p_refund_id?: string;
          p_reservation_id?: string;
          p_source: Database["public"]["Enums"]["stock_movement_source"];
        };
        Returns: undefined;
      };
      staff_cancel_reservation: {
        Args: { p_reason: string; p_reservation_id: string };
        Returns: undefined;
      };
      sync_product_aggregate: {
        Args: { p_product_id: string };
        Returns: undefined;
      };
      tutor_access_status: { Args: { p_email: string }; Returns: string };
      tutor_first_access_target: { Args: { p_email: string }; Returns: Json };
      tutor_has_usable_password: {
        Args: { p_email: string };
        Returns: boolean;
      };
    };
    Enums: {
      appointment_origin: "STAFF" | "TUTOR";
      appointment_status:
        | "REQUESTED"
        | "CONFIRMED"
        | "CHECKED_IN"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "REJECTED"
        | "CANCELLED";
      feedback_direction: "STAFF_TO_TUTOR" | "TUTOR_TO_PETSHOP";
      finance_entry_type: "INCOME" | "EXPENSE";
      finance_refund_kind: "PRODUCT_RETURN" | "SERVICE_REFUND";
      finance_source: "MANUAL" | "APPOINTMENT" | "RESERVATION" | "REFUND";
      payment_method:
        | "CASH"
        | "PIX"
        | "DEBIT_CARD"
        | "CREDIT_CARD"
        | "BANK_TRANSFER"
        | "OTHER";
      reservation_origin: "TUTOR" | "STAFF";
      reservation_status:
        | "RESERVED"
        | "PICKED"
        | "COMPLETED"
        | "EXPIRED"
        | "CANCELLED"
        | "REJECTED"
        | "PARTIALLY_REFUNDED"
        | "REFUNDED";
      staff_role: "OWNER" | "MANAGER" | "ATTENDANT" | "VIEWER";
      stock_movement_source:
        | "MANUAL"
        | "RESERVATION"
        | "SALE"
        | "CANCELLATION"
        | "EXPIRATION"
        | "REFUND";
      stock_movement_type: "IN" | "OUT";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets_vectors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_origin: ["STAFF", "TUTOR"],
      appointment_status: [
        "REQUESTED",
        "CONFIRMED",
        "CHECKED_IN",
        "IN_PROGRESS",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      feedback_direction: ["STAFF_TO_TUTOR", "TUTOR_TO_PETSHOP"],
      finance_entry_type: ["INCOME", "EXPENSE"],
      finance_refund_kind: ["PRODUCT_RETURN", "SERVICE_REFUND"],
      finance_source: ["MANUAL", "APPOINTMENT", "RESERVATION", "REFUND"],
      payment_method: [
        "CASH",
        "PIX",
        "DEBIT_CARD",
        "CREDIT_CARD",
        "BANK_TRANSFER",
        "OTHER",
      ],
      reservation_origin: ["TUTOR", "STAFF"],
      reservation_status: [
        "RESERVED",
        "PICKED",
        "COMPLETED",
        "EXPIRED",
        "CANCELLED",
        "REJECTED",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
      ],
      staff_role: ["OWNER", "MANAGER", "ATTENDANT", "VIEWER"],
      stock_movement_source: [
        "MANUAL",
        "RESERVATION",
        "SALE",
        "CANCELLATION",
        "EXPIRATION",
        "REFUND",
      ],
      stock_movement_type: ["IN", "OUT"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const;
