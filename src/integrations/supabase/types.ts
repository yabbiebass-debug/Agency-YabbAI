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
      actions: {
        Row: {
          approval_id: string
          executed_at: string
          id: string
          kind: string
          owner: string
          result: Json
        }
        Insert: {
          approval_id: string
          executed_at?: string
          id?: string
          kind: string
          owner?: string
          result?: Json
        }
        Update: {
          approval_id?: string
          executed_at?: string
          id?: string
          kind?: string
          owner?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "actions_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          agent: string
          created_at: string
          decided_at: string | null
          detail: string | null
          id: string
          license: string | null
          license_class: string | null
          owner: string
          payload: Json
          status: string
          title: string
          type: string
        }
        Insert: {
          agent?: string
          created_at?: string
          decided_at?: string | null
          detail?: string | null
          id?: string
          license?: string | null
          license_class?: string | null
          owner?: string
          payload?: Json
          status?: string
          title: string
          type: string
        }
        Update: {
          agent?: string
          created_at?: string
          decided_at?: string | null
          detail?: string | null
          id?: string
          license?: string | null
          license_class?: string | null
          owner?: string
          payload?: Json
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          biz: string
          build_pct: number
          created_at: string
          created_via: string
          health: string
          id: string
          lead_id: string | null
          mrr: number
          owner: string
          package: string | null
          setup_fee: number
          setup_paid: boolean
          status: string
          stripe_customer_id: string | null
          tier: string | null
        }
        Insert: {
          biz: string
          build_pct?: number
          created_at?: string
          created_via: string
          health?: string
          id?: string
          lead_id?: string | null
          mrr?: number
          owner?: string
          package?: string | null
          setup_fee?: number
          setup_paid?: boolean
          status?: string
          stripe_customer_id?: string | null
          tier?: string | null
        }
        Update: {
          biz?: string
          build_pct?: number
          created_at?: string
          created_via?: string
          health?: string
          id?: string
          lead_id?: string | null
          mrr?: number
          owner?: string
          package?: string | null
          setup_fee?: number
          setup_paid?: boolean
          status?: string
          stripe_customer_id?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          id: string
          n: number
          owner: string
          started_at: string
          summary: Json
        }
        Insert: {
          id?: string
          n: number
          owner?: string
          started_at?: string
          summary?: Json
        }
        Update: {
          id?: string
          n?: number
          owner?: string
          started_at?: string
          summary?: Json
        }
        Relationships: []
      }
      events: {
        Row: {
          agent: string
          created_at: string
          cycle_n: number
          id: string
          message: string
          owner: string
        }
        Insert: {
          agent: string
          created_at?: string
          cycle_n?: number
          id?: string
          message: string
          owner?: string
        }
        Update: {
          agent?: string
          created_at?: string
          cycle_n?: number
          id?: string
          message?: string
          owner?: string
        }
        Relationships: []
      }
      forge_evaluations: {
        Row: {
          approval_id: string | null
          created_at: string
          id: string
          license: string
          license_class: string
          name: string
          note: string | null
          owner: string
        }
        Insert: {
          approval_id?: string | null
          created_at?: string
          id?: string
          license: string
          license_class: string
          name: string
          note?: string | null
          owner?: string
        }
        Update: {
          approval_id?: string | null
          created_at?: string
          id?: string
          license?: string
          license_class?: string
          name?: string
          note?: string | null
          owner?: string
        }
        Relationships: [
          {
            foreignKeyName: "forge_evaluations_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          biz: string
          created_at: string
          email: string | null
          fit: string | null
          id: string
          niche: string | null
          notes: string | null
          owner: string
          pain: string | null
          phone: string | null
          score: number | null
          source: string
          stage: string
          suburb: string | null
        }
        Insert: {
          biz: string
          created_at?: string
          email?: string | null
          fit?: string | null
          id?: string
          niche?: string | null
          notes?: string | null
          owner?: string
          pain?: string | null
          phone?: string | null
          score?: number | null
          source?: string
          stage?: string
          suburb?: string | null
        }
        Update: {
          biz?: string
          created_at?: string
          email?: string | null
          fit?: string | null
          id?: string
          niche?: string | null
          notes?: string | null
          owner?: string
          pain?: string | null
          phone?: string | null
          score?: number | null
          source?: string
          stage?: string
          suburb?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_aud: number
          biz: string | null
          client_id: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          lead_id: string | null
          method: string
          mrr: number
          owner: string
          package: string | null
          purpose: string
          recipient: string | null
          reference: string | null
          sol_amount: number | null
          status: string
          tier: string | null
        }
        Insert: {
          amount_aud?: number
          biz?: string | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          method: string
          mrr?: number
          owner?: string
          package?: string | null
          purpose?: string
          recipient?: string | null
          reference?: string | null
          sol_amount?: number | null
          status?: string
          tier?: string | null
        }
        Update: {
          amount_aud?: number
          biz?: string | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          method?: string
          mrr?: number
          owner?: string
          package?: string | null
          purpose?: string
          recipient?: string | null
          reference?: string | null
          sol_amount?: number | null
          status?: string
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          name: string
          owner: string
          seats: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner?: string
          seats?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner?: string
          seats?: number
        }
        Relationships: []
      }
    }
    Views: {
      money_view: {
        Row: {
          active_clients: number | null
          cash_collected: number | null
          mrr: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_approval: { Args: { p_id: string }; Returns: undefined }
      close_deal: {
        Args: {
          p_fee: number
          p_lead_id: string
          p_mrr: number
          p_package: string
          p_tier: string
        }
        Returns: string
      }
      create_client_from_payment: {
        Args: { p_payment_id: string }
        Returns: string
      }
      mark_replied: { Args: { p_lead_id: string }; Returns: undefined }
      reject_approval: { Args: { p_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
