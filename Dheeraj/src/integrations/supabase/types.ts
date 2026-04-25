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
      activity_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          description: string | null
          id: string
          module: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address: string
          booking_id: string
          borrow_needed: boolean
          created_at: string | null
          customer_id: string | null
          customer_name: string
          damage_notes: string | null
          delivery_date: string | null
          delivery_mode: string
          delivery_person: string | null
          delivery_status: string | null
          delivery_team: string[] | null
          end_date: string
          event_time: string | null
          function_type_id: string | null
          id: string
          item_checklist: Json | null
          items: Json | null
          missing_items: string | null
          notes: string | null
          payment_rating: string | null
          payment_status: string | null
          payments: Json | null
          phone: string
          pricing: Json | null
          rating_evaluated_at: string | null
          rating_reason: string | null
          reference_id: string | null
          remaining_amount: number | null
          return_date: string | null
          return_team: string[] | null
          start_date: string
          status: string | null
          total_paid: number | null
          updated_at: string | null
          vendor_borrows: Json
        }
        Insert: {
          address: string
          booking_id?: string
          borrow_needed?: boolean
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          damage_notes?: string | null
          delivery_date?: string | null
          delivery_mode?: string
          delivery_person?: string | null
          delivery_status?: string | null
          delivery_team?: string[] | null
          end_date: string
          event_time?: string | null
          function_type_id?: string | null
          id?: string
          item_checklist?: Json | null
          items?: Json | null
          missing_items?: string | null
          notes?: string | null
          payment_rating?: string | null
          payment_status?: string | null
          payments?: Json | null
          phone: string
          pricing?: Json | null
          rating_evaluated_at?: string | null
          rating_reason?: string | null
          reference_id?: string | null
          remaining_amount?: number | null
          return_date?: string | null
          return_team?: string[] | null
          start_date: string
          status?: string | null
          total_paid?: number | null
          updated_at?: string | null
          vendor_borrows?: Json
        }
        Update: {
          address?: string
          booking_id?: string
          borrow_needed?: boolean
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          damage_notes?: string | null
          delivery_date?: string | null
          delivery_mode?: string
          delivery_person?: string | null
          delivery_status?: string | null
          delivery_team?: string[] | null
          end_date?: string
          event_time?: string | null
          function_type_id?: string | null
          id?: string
          item_checklist?: Json | null
          items?: Json | null
          missing_items?: string | null
          notes?: string | null
          payment_rating?: string | null
          payment_status?: string | null
          payments?: Json | null
          phone?: string
          pricing?: Json | null
          rating_evaluated_at?: string | null
          rating_reason?: string | null
          reference_id?: string | null
          remaining_amount?: number | null
          return_date?: string | null
          return_team?: string[] | null
          start_date?: string
          status?: string | null
          total_paid?: number | null
          updated_at?: string | null
          vendor_borrows?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_function_type_id_fkey"
            columns: ["function_type_id"]
            isOneToOne: false
            referencedRelation: "function_types"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          address: string | null
          business_name: string | null
          created_at: string | null
          id: string
          owner_name: string | null
          phone: string | null
          photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          created_at?: string | null
          id?: string
          owner_name?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          created_at?: string | null
          id?: string
          owner_name?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          name_kn: string | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          name_kn?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          name_kn?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          green_count: number
          id: string
          last_booking: string | null
          latest_rating: string | null
          name: string
          orange_count: number
          phone: string
          rating_override: string | null
          red_count: number
          total_bookings: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          green_count?: number
          id?: string
          last_booking?: string | null
          latest_rating?: string | null
          name: string
          orange_count?: number
          phone: string
          rating_override?: string | null
          red_count?: number
          total_bookings?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          green_count?: number
          id?: string
          last_booking?: string | null
          latest_rating?: string | null
          name?: string
          orange_count?: number
          phone?: string
          rating_override?: string | null
          red_count?: number
          total_bookings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
          name_kn: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          name_kn?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          name_kn?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          attachments: string[] | null
          category: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          payment_method: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          attachments?: string[] | null
          category?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          payment_method?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachments?: string[] | null
          category?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      function_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          title: string
          title_kn: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          title_kn?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          title_kn?: string | null
        }
        Relationships: []
      }
      gallery_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          image_url: string
          is_published: boolean
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_published?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_published?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gallery_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          available_quantity: number
          category_id: string | null
          created_at: string | null
          id: string
          image: string | null
          low_stock_threshold: number
          name: string
          name_kn: string | null
          price: number
          price_delivery: number | null
          price_takeaway: number | null
          total_quantity: number
          updated_at: string | null
        }
        Insert: {
          available_quantity: number
          category_id?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          low_stock_threshold?: number
          name: string
          name_kn?: string | null
          price: number
          price_delivery?: number | null
          price_takeaway?: number | null
          total_quantity: number
          updated_at?: string | null
        }
        Update: {
          available_quantity?: number
          category_id?: string | null
          created_at?: string | null
          id?: string
          image?: string | null
          low_stock_threshold?: number
          name?: string
          name_kn?: string | null
          price?: number
          price_delivery?: number | null
          price_takeaway?: number | null
          total_quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sessions: {
        Row: {
          address: string | null
          created_at: string | null
          customer_name: string | null
          event_date: string | null
          expires_at: string | null
          id: string
          items: Json | null
          phone: string | null
          session_id: string
          status: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          customer_name?: string | null
          event_date?: string | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          phone?: string | null
          session_id?: string
          status?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          customer_name?: string | null
          event_date?: string | null
          expires_at?: string | null
          id?: string
          items?: Json | null
          phone?: string | null
          session_id?: string
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_transactions: {
        Row: {
          created_at: string | null
          id: string
          items: Json
          notes: string | null
          type: string
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          items: Json
          notes?: string | null
          type: string
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      workers: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          phone: string
          role: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone: string
          role?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          role?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      next_booking_id: { Args: never; Returns: string }
      next_reference_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
