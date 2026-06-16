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
      agent_registry: {
        Row: {
          active: boolean
          asset: string
          avg_delivery_ms: number
          category: string
          chain: string
          created_at: string
          description: string
          endpoint: string
          id: string
          name: string
          price_cusd: number
          reputation: number
          wallet_address: string
        }
        Insert: {
          active?: boolean
          asset?: string
          avg_delivery_ms?: number
          category: string
          chain?: string
          created_at?: string
          description: string
          endpoint: string
          id?: string
          name: string
          price_cusd: number
          reputation?: number
          wallet_address: string
        }
        Update: {
          active?: boolean
          asset?: string
          avg_delivery_ms?: number
          category?: string
          chain?: string
          created_at?: string
          description?: string
          endpoint?: string
          id?: string
          name?: string
          price_cusd?: number
          reputation?: number
          wallet_address?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          asset: string
          budget_cusd: number
          category: string
          chain: string
          circuit_fee_cusd: number | null
          created_at: string
          error: string | null
          id: string
          prompt: string
          provider_pay_amount_cusd: number | null
          provider_tx_hash: string | null
          result_text: string | null
          result_url: string | null
          selected_agent_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_pay_amount_cusd: number
          user_tx_hash: string | null
          user_wallet: string
        }
        Insert: {
          asset?: string
          budget_cusd: number
          category: string
          chain?: string
          circuit_fee_cusd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          prompt: string
          provider_pay_amount_cusd?: number | null
          provider_tx_hash?: string | null
          result_text?: string | null
          result_url?: string | null
          selected_agent_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_pay_amount_cusd: number
          user_tx_hash?: string | null
          user_wallet: string
        }
        Update: {
          asset?: string
          budget_cusd?: number
          category?: string
          chain?: string
          circuit_fee_cusd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          prompt?: string
          provider_pay_amount_cusd?: number | null
          provider_tx_hash?: string | null
          result_text?: string | null
          result_url?: string | null
          selected_agent_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_pay_amount_cusd?: number
          user_tx_hash?: string | null
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_selected_agent_id_fkey"
            columns: ["selected_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          created_at: string
          id: string
          job_id: string
          message: string
          metadata: Json | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          message: string
          metadata?: Json | null
          status?: string
          step: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          message?: string
          metadata?: Json | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status:
        | "awaiting_payment"
        | "payment_received"
        | "discovering"
        | "paying_provider"
        | "provider_working"
        | "completed"
        | "failed"
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
      job_status: [
        "awaiting_payment",
        "payment_received",
        "discovering",
        "paying_provider",
        "provider_working",
        "completed",
        "failed",
      ],
    },
  },
} as const
