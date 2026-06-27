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
      appointment: {
        Row: {
          camera_id: string | null
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          origin: Database["public"]["Enums"]["appointment_origin"]
          pet_id: string
          photos: string[]
          scheduled_at: string | null
          service_type_id: string | null
          staff_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          tutor_id: string
        }
        Insert: {
          camera_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["appointment_origin"]
          pet_id: string
          photos?: string[]
          scheduled_at?: string | null
          service_type_id?: string | null
          staff_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          tutor_id: string
        }
        Update: {
          camera_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          origin?: Database["public"]["Enums"]["appointment_origin"]
          pet_id?: string
          photos?: string[]
          scheduled_at?: string | null
          service_type_id?: string | null
          staff_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "camera"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_step: {
        Row: {
          appointment_id: string
          done: boolean
          done_at: string | null
          id: string
          label: string
          position: number
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          done?: boolean
          done_at?: string | null
          id?: string
          label: string
          position?: number
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          done?: boolean
          done_at?: string | null
          id?: string
          label?: string
          position?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_step_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_step_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          target: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      camera: {
        Row: {
          active: boolean
          created_at: string
          id: string
          room_label: string
          rtsp_secret: string | null
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          room_label: string
          rtsp_secret?: string | null
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          room_label?: string
          rtsp_secret?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      consent: {
        Row: {
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          purpose: string
          tenant_id: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          purpose: string
          tenant_id: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          purpose?: string
          tenant_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          appointment_id: string
          author_id: string | null
          comment: string | null
          created_at: string
          direction: Database["public"]["Enums"]["feedback_direction"]
          id: string
          rating: number | null
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          author_id?: string | null
          comment?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["feedback_direction"]
          id?: string
          rating?: number | null
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          author_id?: string | null
          comment?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["feedback_direction"]
          id?: string
          rating?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["staff_role"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          role?: Database["public"]["Enums"]["staff_role"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      pet: {
        Row: {
          birth_date: string | null
          breed: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          photo_path: string | null
          size: string | null
          species: string | null
          tenant_id: string
          tutor_id: string
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          photo_path?: string | null
          size?: string | null
          species?: string | null
          tenant_id: string
          tutor_id: string
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          photo_path?: string | null
          size?: string | null
          species?: string | null
          tenant_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          photo_path: string | null
          photos: string[]
          price_cents: number
          stock: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photo_path?: string | null
          photos?: string[]
          price_cents?: number
          stock?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photo_path?: string | null
          photos?: string[]
          price_cents?: number
          stock?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reservation: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          tenant_id: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          tenant_id: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          tenant_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reservation_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reservation_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reservation_item: {
        Row: {
          id: string
          price_cents: number
          product_id: string
          quantity: number
          reservation_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          price_cents?: number
          product_id: string
          quantity?: number
          reservation_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          price_cents?: number
          product_id?: string
          quantity?: number
          reservation_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reservation_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reservation_item_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "product_reservation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reservation_item_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      recording: {
        Row: {
          appointment_id: string
          created_at: string
          duration_sec: number | null
          id: string
          retain_until: string | null
          storage_path: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          retain_until?: string | null
          storage_path: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          retain_until?: string | null
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      service_type: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price_cents: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name: string
          price_cents?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_type_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
        }
        Relationships: []
      }
      tutor: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_staff_role: {
        Args: {
          _roles: Database["public"]["Enums"]["staff_role"][]
          _tenant: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _tenant: string }; Returns: boolean }
      my_tutor_id: { Args: { _tenant: string }; Returns: string }
    }
    Enums: {
      appointment_origin: "STAFF" | "TUTOR"
      appointment_status:
        | "REQUESTED"
        | "CONFIRMED"
        | "CHECKED_IN"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "REJECTED"
        | "CANCELLED"
      feedback_direction: "STAFF_TO_TUTOR" | "TUTOR_TO_PETSHOP"
      reservation_status:
        | "RESERVED"
        | "PICKED"
        | "COMPLETED"
        | "EXPIRED"
        | "CANCELLED"
      staff_role: "OWNER" | "MANAGER" | "ATTENDANT" | "VIEWER"
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
      reservation_status: [
        "RESERVED",
        "PICKED",
        "COMPLETED",
        "EXPIRED",
        "CANCELLED",
      ],
      staff_role: ["OWNER", "MANAGER", "ATTENDANT", "VIEWER"],
    },
  },
} as const
