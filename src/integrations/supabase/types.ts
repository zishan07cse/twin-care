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
      access_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          channel: Database["public"]["Enums"]["msg_channel"]
          created_at: string
          created_by: string | null
          id: string
          language: string
          sent_at: string | null
          title: string
        }
        Insert: {
          audience?: string
          body: string
          channel?: Database["public"]["Enums"]["msg_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          sent_at?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string
          channel?: Database["public"]["Enums"]["msg_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          sent_at?: string | null
          title?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          completed_at: string | null
          coordinator_user_id: string | null
          created_at: string
          created_by: string | null
          doctor_id: string | null
          duration_minutes: number
          id: string
          location: string | null
          meeting_link: string | null
          mode: Database["public"]["Enums"]["appointment_mode"]
          notes: string | null
          nutritionist_id: string | null
          patient_id: string
          provider_kind: Database["public"]["Enums"]["provider_kind"]
          reason: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          coordinator_user_id?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_link?: string | null
          mode?: Database["public"]["Enums"]["appointment_mode"]
          notes?: string | null
          nutritionist_id?: string | null
          patient_id: string
          provider_kind: Database["public"]["Enums"]["provider_kind"]
          reason?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          coordinator_user_id?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_link?: string | null
          mode?: Database["public"]["Enums"]["appointment_mode"]
          notes?: string | null
          nutritionist_id?: string | null
          patient_id?: string
          provider_kind?: Database["public"]["Enums"]["provider_kind"]
          reason?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "nutritionists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      challan_items: {
        Row: {
          batch_no: string | null
          challan_id: string
          created_at: string
          delivered_qty: number
          expiry_date: string | null
          id: string
          item_id: string
          line_total_bdt: number
          order_item_id: string
          serials: string[] | null
          unit_price_bdt: number
        }
        Insert: {
          batch_no?: string | null
          challan_id: string
          created_at?: string
          delivered_qty: number
          expiry_date?: string | null
          id?: string
          item_id: string
          line_total_bdt?: number
          order_item_id: string
          serials?: string[] | null
          unit_price_bdt?: number
        }
        Update: {
          batch_no?: string | null
          challan_id?: string
          created_at?: string
          delivered_qty?: number
          expiry_date?: string | null
          id?: string
          item_id?: string
          line_total_bdt?: number
          order_item_id?: string
          serials?: string[] | null
          unit_price_bdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "challan_items_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challan_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challan_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          amount_bdt: number
          bank: string | null
          bounce_reason: string | null
          bounced_on: string | null
          branch: string | null
          cheque_date: string
          cheque_no: string
          cleared_on: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          deposited_on: string | null
          id: string
          notes: string | null
          payment_id: string | null
          status: Database["public"]["Enums"]["cheque_status"]
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          bank?: string | null
          bounce_reason?: string | null
          bounced_on?: string | null
          branch?: string | null
          cheque_date: string
          cheque_no: string
          cleared_on?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          deposited_on?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          status?: Database["public"]["Enums"]["cheque_status"]
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          bank?: string | null
          bounce_reason?: string | null
          bounced_on?: string | null
          branch?: string | null
          cheque_date?: string
          cheque_no?: string
          cleared_on?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          deposited_on?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          status?: Database["public"]["Enums"]["cheque_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "dealer_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          amount_bdt: number
          commission_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount_bdt: number
          commission_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount_bdt?: number
          commission_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "referral_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_bdt: number
          cn_date: string
          cn_no: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          reason: Database["public"]["Enums"]["credit_note_reason"]
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          cn_date?: string
          cn_no?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: Database["public"]["Enums"]["credit_note_reason"]
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          cn_date?: string
          cn_no?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: Database["public"]["Enums"]["credit_note_reason"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_dunning_log: {
        Row: {
          body: string | null
          created_at: string
          dealer_id: string | null
          event_type: string
          id: string
          ref_id: string | null
          ref_table: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dealer_id?: string | null
          event_type: string
          id?: string
          ref_id?: string | null
          ref_table?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dealer_id?: string | null
          event_type?: string
          id?: string
          ref_id?: string | null
          ref_table?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_dunning_log_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_payments: {
        Row: {
          amount_bdt: number
          created_at: string
          created_by: string | null
          dealer_id: string
          deposit_slip_url: string | null
          id: string
          method: Database["public"]["Enums"]["dealer_payment_method"]
          notes: string | null
          payment_date: string
          received_by: string | null
          reference: string | null
          unallocated_bdt: number
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          created_by?: string | null
          dealer_id: string
          deposit_slip_url?: string | null
          id?: string
          method: Database["public"]["Enums"]["dealer_payment_method"]
          notes?: string | null
          payment_date?: string
          received_by?: string | null
          reference?: string | null
          unallocated_bdt?: number
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          deposit_slip_url?: string | null
          id?: string
          method?: Database["public"]["Enums"]["dealer_payment_method"]
          notes?: string | null
          payment_date?: string
          received_by?: string | null
          reference?: string | null
          unallocated_bdt?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_payments_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_price_tiers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          tier: Database["public"]["Enums"]["dealer_price_tier"]
          unit_price_bdt: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          tier: Database["public"]["Enums"]["dealer_price_tier"]
          unit_price_bdt?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          tier?: Database["public"]["Enums"]["dealer_price_tier"]
          unit_price_bdt?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_price_tiers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_targets: {
        Row: {
          created_at: string
          created_by: string | null
          dealer_id: string
          id: string
          notes: string | null
          period: Database["public"]["Enums"]["target_period"]
          period_start: string
          target_bdt: number
          target_units: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dealer_id: string
          id?: string
          notes?: string | null
          period: Database["public"]["Enums"]["target_period"]
          period_start: string
          target_bdt?: number
          target_units?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          id?: string
          notes?: string | null
          period?: Database["public"]["Enums"]["target_period"]
          period_start?: string
          target_bdt?: number
          target_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_targets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_users: {
        Row: {
          created_at: string
          dealer_id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          dealer_id: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          dealer_id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_users_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          address: string | null
          agreement_url: string | null
          bin: string | null
          business_name: string
          business_name_bn: string | null
          created_at: string
          created_by: string | null
          credit_limit_bdt: number
          credit_period: Database["public"]["Enums"]["credit_period"]
          dealer_code: string
          dealer_type: Database["public"]["Enums"]["dealer_type"]
          district: string | null
          division: string | null
          early_payment_discount_pct: number
          email: string | null
          id: string
          notes: string | null
          onboarded_at: string
          overdue_grace_days: number
          penalty_pct: number
          phone: string | null
          price_tier: Database["public"]["Enums"]["dealer_price_tier"]
          proprietor_name: string | null
          sales_officer_id: string | null
          security_deposit_bdt: number
          status: Database["public"]["Enums"]["dealer_status"]
          territory: string | null
          tin: string | null
          trade_license_no: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          agreement_url?: string | null
          bin?: string | null
          business_name: string
          business_name_bn?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit_bdt?: number
          credit_period?: Database["public"]["Enums"]["credit_period"]
          dealer_code: string
          dealer_type?: Database["public"]["Enums"]["dealer_type"]
          district?: string | null
          division?: string | null
          early_payment_discount_pct?: number
          email?: string | null
          id?: string
          notes?: string | null
          onboarded_at?: string
          overdue_grace_days?: number
          penalty_pct?: number
          phone?: string | null
          price_tier?: Database["public"]["Enums"]["dealer_price_tier"]
          proprietor_name?: string | null
          sales_officer_id?: string | null
          security_deposit_bdt?: number
          status?: Database["public"]["Enums"]["dealer_status"]
          territory?: string | null
          tin?: string | null
          trade_license_no?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          agreement_url?: string | null
          bin?: string | null
          business_name?: string
          business_name_bn?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit_bdt?: number
          credit_period?: Database["public"]["Enums"]["credit_period"]
          dealer_code?: string
          dealer_type?: Database["public"]["Enums"]["dealer_type"]
          district?: string | null
          division?: string | null
          early_payment_discount_pct?: number
          email?: string | null
          id?: string
          notes?: string | null
          onboarded_at?: string
          overdue_grace_days?: number
          penalty_pct?: number
          phone?: string | null
          price_tier?: Database["public"]["Enums"]["dealer_price_tier"]
          proprietor_name?: string | null
          sales_officer_id?: string | null
          security_deposit_bdt?: number
          status?: Database["public"]["Enums"]["dealer_status"]
          territory?: string | null
          tin?: string | null
          trade_license_no?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      debit_notes: {
        Row: {
          amount_bdt: number
          created_at: string
          created_by: string | null
          dealer_id: string
          dn_date: string
          dn_no: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          reason: Database["public"]["Enums"]["debit_note_reason"]
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          created_by?: string | null
          dealer_id: string
          dn_date?: string
          dn_no?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: Database["public"]["Enums"]["debit_note_reason"]
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          dn_date?: string
          dn_no?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: Database["public"]["Enums"]["debit_note_reason"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          challan_no: string | null
          courier: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          delivered_by: string | null
          dispatch_date: string
          id: string
          notes: string | null
          order_id: string
          receiver_ack_url: string | null
          transport_ref: string | null
          updated_at: string
        }
        Insert: {
          challan_no?: string | null
          courier?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          delivered_by?: string | null
          dispatch_date?: string
          id?: string
          notes?: string | null
          order_id: string
          receiver_ack_url?: string | null
          transport_ref?: string | null
          updated_at?: string
        }
        Update: {
          challan_no?: string | null
          courier?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          delivered_by?: string | null
          dispatch_date?: string
          id?: string
          notes?: string | null
          order_id?: string
          receiver_ack_url?: string | null
          transport_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          created_at: string
          created_by: string | null
          daily_calories: number | null
          end_date: string | null
          id: string
          is_active: boolean
          meals: Json
          notes: string | null
          nutritionist_id: string | null
          patient_id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_calories?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          meals?: Json
          notes?: string | null
          nutritionist_id?: string | null
          patient_id: string
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_calories?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          meals?: Json
          notes?: string | null
          nutritionist_id?: string | null
          patient_id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_plans_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "nutritionists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          bmdc_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          full_name_bn: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          is_referrer: boolean
          is_treating: boolean
          notes: string | null
          phone: string | null
          referral_commission_pct: number
          specialization: string | null
          updated_at: string
        }
        Insert: {
          bmdc_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          full_name_bn?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          is_referrer?: boolean
          is_treating?: boolean
          notes?: string | null
          phone?: string | null
          referral_commission_pct?: number
          specialization?: string | null
          updated_at?: string
        }
        Update: {
          bmdc_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          full_name_bn?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          is_referrer?: boolean
          is_treating?: boolean
          notes?: string | null
          phone?: string | null
          referral_commission_pct?: number
          specialization?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_issuances: {
        Row: {
          amount_bdt: number
          approved_at: string | null
          approved_by: string | null
          assignment_id: string | null
          chargeable: boolean
          created_at: string
          id: string
          item_id: string
          notes: string | null
          patient_id: string
          quantity: number
          reason: string
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_bdt?: number
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string | null
          chargeable?: boolean
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          patient_id: string
          quantity: number
          reason: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string | null
          chargeable?: boolean
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          patient_id?: string
          quantity?: number
          reason?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_issuances_assignment_fk"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "inventory_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_issuances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_issuances_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          name_bn: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_bn?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_bn?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          created_by: string | null
          deposit_bdt: number | null
          expires_at: string | null
          extra_issuance_id: string | null
          id: string
          item_id: string
          notes: string | null
          patient_id: string
          quantity: number
          returned_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          deposit_bdt?: number | null
          expires_at?: string | null
          extra_issuance_id?: string | null
          id?: string
          item_id: string
          notes?: string | null
          patient_id: string
          quantity?: number
          returned_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          deposit_bdt?: number | null
          expires_at?: string | null
          extra_issuance_id?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          patient_id?: string
          quantity?: number
          returned_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assignments_extra_issuance_id_fkey"
            columns: ["extra_issuance_id"]
            isOneToOne: false
            referencedRelation: "extra_issuances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assignments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_returnable: boolean
          is_trade_sellable: boolean
          lifespan_days: number | null
          mrp_bdt: number
          name_bn: string | null
          name_en: string
          notes: string | null
          reorder_level: number
          sku: string | null
          stock_qty: number
          trade_stock_qty: number
          unit_price_bdt: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_returnable?: boolean
          is_trade_sellable?: boolean
          lifespan_days?: number | null
          mrp_bdt?: number
          name_bn?: string | null
          name_en: string
          notes?: string | null
          reorder_level?: number
          sku?: string | null
          stock_qty?: number
          trade_stock_qty?: number
          unit_price_bdt?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_returnable?: boolean
          is_trade_sellable?: boolean
          lifespan_days?: number | null
          mrp_bdt?: number
          name_bn?: string | null
          name_en?: string
          notes?: string | null
          reorder_level?: number
          sku?: string | null
          stock_qty?: number
          trade_stock_qty?: number
          unit_price_bdt?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_purchases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_no: string | null
          item_id: string
          notes: string | null
          purchased_at: string
          quantity: number
          supplier: string | null
          total_cost_bdt: number | null
          unit_cost_bdt: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_no?: string | null
          item_id: string
          notes?: string | null
          purchased_at?: string
          quantity: number
          supplier?: string | null
          total_cost_bdt?: number | null
          unit_cost_bdt?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_no?: string | null
          item_id?: string
          notes?: string | null
          purchased_at?: string
          quantity?: number
          supplier?: string | null
          total_cost_bdt?: number | null
          unit_cost_bdt?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          lab_name: string | null
          notes: string | null
          patient_id: string
          performed_on: string
          test_id: string | null
          test_name: string
          unit: string | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          lab_name?: string | null
          notes?: string | null
          patient_id: string
          performed_on?: string
          test_id?: string | null
          test_name: string
          unit?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          lab_name?: string | null
          notes?: string | null
          patient_id?: string
          performed_on?: string
          test_id?: string | null
          test_name?: string
          unit?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          reference_high: number | null
          reference_low: number | null
          reference_text: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          reference_high?: number | null
          reference_low?: number | null
          reference_text?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reference_high?: number | null
          reference_low?: number | null
          reference_text?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          note: string
        }
        Insert: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          note: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          age: number | null
          assigned_to: string | null
          city: string | null
          converted_at: string | null
          converted_patient_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          interest_summary: string | null
          lost_reason: string | null
          next_follow_up_at: string | null
          phone: string
          referrer_doctor_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_detail: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
        }
        Insert: {
          age?: number | null
          assigned_to?: string | null
          city?: string | null
          converted_at?: string | null
          converted_patient_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          interest_summary?: string | null
          lost_reason?: string | null
          next_follow_up_at?: string | null
          phone: string
          referrer_doctor_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Update: {
          age?: number | null
          assigned_to?: string | null
          city?: string | null
          converted_at?: string | null
          converted_patient_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          interest_summary?: string | null
          lost_reason?: string | null
          next_follow_up_at?: string | null
          phone?: string
          referrer_doctor_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_patient_id_fkey"
            columns: ["converted_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referrer_doctor_id_fkey"
            columns: ["referrer_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_reductions: {
        Row: {
          baseline_dose: string | null
          created_at: string
          created_by: string | null
          current_dose: string | null
          id: string
          medicine_id: string | null
          medicine_name: string
          notes: string | null
          patient_id: string
          recorded_on: string
          reduction_percent: number | null
        }
        Insert: {
          baseline_dose?: string | null
          created_at?: string
          created_by?: string | null
          current_dose?: string | null
          id?: string
          medicine_id?: string | null
          medicine_name: string
          notes?: string | null
          patient_id: string
          recorded_on?: string
          reduction_percent?: number | null
        }
        Update: {
          baseline_dose?: string | null
          created_at?: string
          created_by?: string | null
          current_dose?: string | null
          id?: string
          medicine_id?: string | null
          medicine_name?: string
          notes?: string | null
          patient_id?: string
          recorded_on?: string
          reduction_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_reductions_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_reductions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          created_at: string
          created_by: string | null
          form: string | null
          generic_name: string | null
          id: string
          is_active: boolean
          manufacturer: string | null
          name: string
          notes: string | null
          strength: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form?: string | null
          generic_name?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          name: string
          notes?: string | null
          strength?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form?: string | null
          generic_name?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          name?: string
          notes?: string | null
          strength?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_log: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["msg_channel"]
          created_at: string
          direction: Database["public"]["Enums"]["msg_direction"]
          error: string | null
          id: string
          patient_id: string | null
          provider_ref: string | null
          sent_at: string
          sent_by: string | null
          status: Database["public"]["Enums"]["msg_status"]
          template_name: string | null
          variables: Json | null
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"]
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction"]
          error?: string | null
          id?: string
          patient_id?: string | null
          provider_ref?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          template_name?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["msg_channel"]
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction"]
          error?: string | null
          id?: string
          patient_id?: string | null
          provider_ref?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: Database["public"]["Enums"]["msg_status"]
          template_name?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempt: number
          channel: Database["public"]["Enums"]["notif_channel"]
          error: string | null
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id: string
          notification_id: string | null
          patient_id: string | null
          payload: Json | null
          sent_at: string
          status: Database["public"]["Enums"]["notif_status"]
          template_key: string | null
        }
        Insert: {
          attempt?: number
          channel: Database["public"]["Enums"]["notif_channel"]
          error?: string | null
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          notification_id?: string | null
          patient_id?: string | null
          payload?: Json | null
          sent_at?: string
          status: Database["public"]["Enums"]["notif_status"]
          template_key?: string | null
        }
        Update: {
          attempt?: number
          channel?: Database["public"]["Enums"]["notif_channel"]
          error?: string | null
          event_type?: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          notification_id?: string | null
          patient_id?: string | null
          payload?: Json | null
          sent_at?: string
          status?: Database["public"]["Enums"]["notif_status"]
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          disabled_event_types: Database["public"]["Enums"]["notif_event_type"][]
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          patient_id: string
          preferred_language: string
          quiet_end_hour: number
          quiet_start_hour: number
          updated_at: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          disabled_event_types?: Database["public"]["Enums"]["notif_event_type"][]
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          patient_id: string
          preferred_language?: string
          quiet_end_hour?: number
          quiet_start_hour?: number
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          disabled_event_types?: Database["public"]["Enums"]["notif_event_type"][]
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          patient_id?: string
          preferred_language?: string
          quiet_end_hour?: number
          quiet_start_hour?: number
          updated_at?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          channels: Database["public"]["Enums"]["notif_channel"][]
          created_at: string
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id: string
          is_active: boolean
          offsets_days: number[]
          template_key: string | null
          updated_at: string
        }
        Insert: {
          channels?: Database["public"]["Enums"]["notif_channel"][]
          created_at?: string
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          is_active?: boolean
          offsets_days?: number[]
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          channels?: Database["public"]["Enums"]["notif_channel"][]
          created_at?: string
          event_type?: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          is_active?: boolean
          offsets_days?: number[]
          template_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          default_quiet_end_hour: number
          default_quiet_start_hour: number
          email_enabled: boolean
          email_from_address: string
          email_from_name: string
          id: number
          in_app_enabled: boolean
          retry_max_attempts: number
          updated_at: string
          updated_by: string | null
          wati_api_token: string | null
          wati_base_url: string | null
          wati_enabled: boolean
        }
        Insert: {
          default_quiet_end_hour?: number
          default_quiet_start_hour?: number
          email_enabled?: boolean
          email_from_address?: string
          email_from_name?: string
          id?: number
          in_app_enabled?: boolean
          retry_max_attempts?: number
          updated_at?: string
          updated_by?: string | null
          wati_api_token?: string | null
          wati_base_url?: string | null
          wati_enabled?: boolean
        }
        Update: {
          default_quiet_end_hour?: number
          default_quiet_start_hour?: number
          email_enabled?: boolean
          email_from_address?: string
          email_from_name?: string
          id?: number
          in_app_enabled?: boolean
          retry_max_attempts?: number
          updated_at?: string
          updated_by?: string | null
          wati_api_token?: string | null
          wati_base_url?: string | null
          wati_enabled?: boolean
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id: string
          language: string
          subject: string | null
          template_key: string
          updated_at: string
          wati_template_name: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          language?: string
          subject?: string | null
          template_key: string
          updated_at?: string
          wati_template_name?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          event_type?: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          language?: string
          subject?: string | null
          template_key?: string
          updated_at?: string
          wati_template_name?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notif_channel"]
          created_at: string
          error: string | null
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id: string
          patient_id: string | null
          read_at: string | null
          ref_id: string | null
          ref_table: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notif_status"]
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          error?: string | null
          event_type: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          patient_id?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notif_channel"]
          created_at?: string
          error?: string | null
          event_type?: Database["public"]["Enums"]["notif_event_type"]
          id?: string
          patient_id?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      nutritionists: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          full_name_bn: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          qualification: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          full_name_bn?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          qualification?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          full_name_bn?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          qualification?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      package_device_entitlements: {
        Row: {
          created_at: string
          deposit_bdt: number
          id: string
          item_id: string
          notes: string | null
          ownership_mode: Database["public"]["Enums"]["ownership_mode"]
          plan_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_bdt?: number
          id?: string
          item_id: string
          notes?: string | null
          ownership_mode?: Database["public"]["Enums"]["ownership_mode"]
          plan_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_bdt?: number
          id?: string
          item_id?: string
          notes?: string | null
          ownership_mode?: Database["public"]["Enums"]["ownership_mode"]
          plan_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_device_entitlements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_device_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_enrollments: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closure_reason: string | null
          closure_type: string | null
          created_at: string
          created_by: string | null
          discount_bdt: number
          end_date: string | null
          id: string
          net_amount_bdt: number
          notes: string | null
          patient_id: string
          plan_id: string
          renewed_from_enrollment_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["enrollment_status"]
          total_amount_bdt: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          closure_type?: string | null
          created_at?: string
          created_by?: string | null
          discount_bdt?: number
          end_date?: string | null
          id?: string
          net_amount_bdt: number
          notes?: string | null
          patient_id: string
          plan_id: string
          renewed_from_enrollment_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          total_amount_bdt: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          closure_type?: string | null
          created_at?: string
          created_by?: string | null
          discount_bdt?: number
          end_date?: string | null
          id?: string
          net_amount_bdt?: number
          notes?: string | null
          patient_id?: string
          plan_id?: string
          renewed_from_enrollment_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          total_amount_bdt?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_enrollments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_enrollments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_enrollments_renewed_from_enrollment_id_fkey"
            columns: ["renewed_from_enrollment_id"]
            isOneToOne: false
            referencedRelation: "patient_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_entitlements: {
        Row: {
          created_at: string
          deposit_bdt: number
          enrollment_id: string
          id: string
          item_id: string
          notes: string | null
          ownership_mode: Database["public"]["Enums"]["ownership_mode"]
          patient_id: string
          quantity_delivered: number
          quantity_entitled: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_bdt?: number
          enrollment_id: string
          id?: string
          item_id: string
          notes?: string | null
          ownership_mode?: Database["public"]["Enums"]["ownership_mode"]
          patient_id: string
          quantity_delivered?: number
          quantity_entitled?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_bdt?: number
          enrollment_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          ownership_mode?: Database["public"]["Enums"]["ownership_mode"]
          patient_id?: string
          quantity_delivered?: number
          quantity_entitled?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_entitlements_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "patient_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_entitlements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_entitlements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_outcomes: {
        Row: {
          baseline_hba1c: number | null
          baseline_med_count: number | null
          baseline_weight_kg: number | null
          computed_at: string
          current_hba1c: number | null
          current_med_count: number | null
          current_weight_kg: number | null
          hba1c_delta: number | null
          id: string
          in_remission: boolean | null
          insulin_stopped: boolean | null
          patient_id: string
          weight_delta_kg: number | null
        }
        Insert: {
          baseline_hba1c?: number | null
          baseline_med_count?: number | null
          baseline_weight_kg?: number | null
          computed_at?: string
          current_hba1c?: number | null
          current_med_count?: number | null
          current_weight_kg?: number | null
          hba1c_delta?: number | null
          id?: string
          in_remission?: boolean | null
          insulin_stopped?: boolean | null
          patient_id: string
          weight_delta_kg?: number | null
        }
        Update: {
          baseline_hba1c?: number | null
          baseline_med_count?: number | null
          baseline_weight_kg?: number | null
          computed_at?: string
          current_hba1c?: number | null
          current_med_count?: number | null
          current_weight_kg?: number | null
          hba1c_delta?: number | null
          id?: string
          in_remission?: boolean | null
          insulin_stopped?: boolean | null
          patient_id?: string
          weight_delta_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_outcomes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_timeline: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          patient_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          patient_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          patient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_timeline_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          alt_phone: string | null
          bp_diastolic_baseline: number | null
          bp_systolic_baseline: number | null
          city: string | null
          comorbidities: string[] | null
          created_at: string
          created_by: string | null
          current_medications: string | null
          date_of_birth: string | null
          diabetes_years: number | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          enrolled_on: string
          fbg_baseline: number | null
          full_name: string
          full_name_bn: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          hba1c_baseline: number | null
          height_cm: number | null
          hospital_id: string | null
          id: string
          nid: string | null
          notes: string | null
          nutritionist_id: string | null
          patient_code: string
          phone: string
          ppbg_baseline: number | null
          preferred_language: string
          referring_doctor_id: string | null
          status: Database["public"]["Enums"]["patient_status"]
          treating_doctor_id: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          alt_phone?: string | null
          bp_diastolic_baseline?: number | null
          bp_systolic_baseline?: number | null
          city?: string | null
          comorbidities?: string[] | null
          created_at?: string
          created_by?: string | null
          current_medications?: string | null
          date_of_birth?: string | null
          diabetes_years?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrolled_on?: string
          fbg_baseline?: number | null
          full_name: string
          full_name_bn?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          hba1c_baseline?: number | null
          height_cm?: number | null
          hospital_id?: string | null
          id?: string
          nid?: string | null
          notes?: string | null
          nutritionist_id?: string | null
          patient_code: string
          phone: string
          ppbg_baseline?: number | null
          preferred_language?: string
          referring_doctor_id?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          treating_doctor_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          alt_phone?: string | null
          bp_diastolic_baseline?: number | null
          bp_systolic_baseline?: number | null
          city?: string | null
          comorbidities?: string[] | null
          created_at?: string
          created_by?: string | null
          current_medications?: string | null
          date_of_birth?: string | null
          diabetes_years?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          enrolled_on?: string
          fbg_baseline?: number | null
          full_name?: string
          full_name_bn?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          hba1c_baseline?: number | null
          height_cm?: number | null
          hospital_id?: string | null
          id?: string
          nid?: string | null
          notes?: string | null
          nutritionist_id?: string | null
          patient_code?: string
          phone?: string
          ppbg_baseline?: number | null
          preferred_language?: string
          referring_doctor_id?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          treating_doctor_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_nutritionist_id_fkey"
            columns: ["nutritionist_id"]
            isOneToOne: false
            referencedRelation: "nutritionists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_referring_doctor_id_fkey"
            columns: ["referring_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_treating_doctor_id_fkey"
            columns: ["treating_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_bdt: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "dealer_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule: {
        Row: {
          amount_bdt: number
          created_at: string
          due_date: string
          enrollment_id: string
          id: string
          installment_no: number
          notes: string | null
          paid_amount_bdt: number
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          due_date: string
          enrollment_id: string
          id?: string
          installment_no: number
          notes?: string | null
          paid_amount_bdt?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          due_date?: string
          enrollment_id?: string
          id?: string
          installment_no?: number
          notes?: string | null
          paid_amount_bdt?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "patient_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_bdt: number
          created_at: string
          created_by: string | null
          enrollment_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_on: string
          receipt_no: string
          reference: string | null
          schedule_id: string | null
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          created_by?: string | null
          enrollment_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_on?: string
          receipt_no: string
          reference?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          created_by?: string | null
          enrollment_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_on?: string
          receipt_no?: string
          reference?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "patient_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          name_bn: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          name_bn?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_bn?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_service_inclusions: {
        Row: {
          created_at: string
          frequency: Database["public"]["Enums"]["plan_service_frequency"]
          id: string
          label: string
          label_bn: string | null
          notes: string | null
          plan_id: string
          quantity: number
          service_type: Database["public"]["Enums"]["plan_service_type"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["plan_service_frequency"]
          id?: string
          label: string
          label_bn?: string | null
          notes?: string | null
          plan_id: string
          quantity?: number
          service_type: Database["public"]["Enums"]["plan_service_type"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["plan_service_frequency"]
          id?: string
          label?: string
          label_bn?: string | null
          notes?: string | null
          plan_id?: string
          quantity?: number
          service_type?: Database["public"]["Enums"]["plan_service_type"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_service_inclusions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "program_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          created_at: string
          dose: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medicine_id: string | null
          medicine_name: string
          prescription_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_id?: string | null
          medicine_name: string
          prescription_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_id?: string | null
          medicine_name?: string
          prescription_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          advice: string | null
          appointment_id: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          doctor_id: string | null
          follow_up_at: string | null
          id: string
          issued_at: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          advice?: string | null
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          follow_up_at?: string | null
          id?: string
          issued_at?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          advice?: string | null
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          follow_up_at?: string | null
          id?: string
          issued_at?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          full_name_bn: string | null
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          full_name_bn?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          full_name_bn?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_plans: {
        Row: {
          billing_frequency: Database["public"]["Enums"]["billing_frequency"]
          created_at: string
          created_by: string | null
          description: string | null
          duration_months: number
          id: string
          installment_count: number | null
          is_active: boolean
          name: string
          name_bn: string | null
          total_price_bdt: number
          updated_at: string
        }
        Insert: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_months?: number
          id?: string
          installment_count?: number | null
          is_active?: boolean
          name: string
          name_bn?: string | null
          total_price_bdt: number
          updated_at?: string
        }
        Update: {
          billing_frequency?: Database["public"]["Enums"]["billing_frequency"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_months?: number
          id?: string
          installment_count?: number | null
          is_active?: boolean
          name?: string
          name_bn?: string | null
          total_price_bdt?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          accrued_at: string
          amount_bdt: number
          approved_at: string | null
          basis: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          enrollment_id: string | null
          hospital_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          patient_id: string
          percent: number | null
          referrer_kind: Database["public"]["Enums"]["referrer_kind"]
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          accrued_at?: string
          amount_bdt?: number
          approved_at?: string | null
          basis?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          enrollment_id?: string | null
          hospital_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          patient_id: string
          percent?: number | null
          referrer_kind: Database["public"]["Enums"]["referrer_kind"]
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          accrued_at?: string
          amount_bdt?: number
          approved_at?: string | null
          basis?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          enrollment_id?: string | null
          hospital_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          patient_id?: string
          percent?: number | null
          referrer_kind?: Database["public"]["Enums"]["referrer_kind"]
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "patient_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          delivered_qty: number
          discount_pct: number
          id: string
          item_id: string
          line_total_bdt: number
          order_id: string
          quantity: number
          unit_price_bdt: number
        }
        Insert: {
          created_at?: string
          delivered_qty?: number
          discount_pct?: number
          id?: string
          item_id: string
          line_total_bdt?: number
          order_id: string
          quantity: number
          unit_price_bdt?: number
        }
        Update: {
          created_at?: string
          delivered_qty?: number
          discount_pct?: number
          id?: string
          item_id?: string
          line_total_bdt?: number
          order_id?: string
          quantity?: number
          unit_price_bdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          ait_bdt: number
          ait_pct: number
          created_at: string
          created_by: string | null
          credit_override_by: string | null
          credit_override_reason: string | null
          dealer_id: string
          discount_bdt: number
          id: string
          notes: string | null
          order_date: string
          order_no: string | null
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal_bdt: number
          total_bdt: number
          updated_at: string
          vat_bdt: number
          vat_pct: number
        }
        Insert: {
          ait_bdt?: number
          ait_pct?: number
          created_at?: string
          created_by?: string | null
          credit_override_by?: string | null
          credit_override_reason?: string | null
          dealer_id: string
          discount_bdt?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal_bdt?: number
          total_bdt?: number
          updated_at?: string
          vat_bdt?: number
          vat_pct?: number
        }
        Update: {
          ait_bdt?: number
          ait_pct?: number
          created_at?: string
          created_by?: string | null
          credit_override_by?: string | null
          credit_override_reason?: string | null
          dealer_id?: string
          discount_bdt?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal_bdt?: number
          total_bdt?: number
          updated_at?: string
          vat_bdt?: number
          vat_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          created_at: string
          damaged_qty: number
          good_qty: number
          id: string
          item_id: string
          line_total_bdt: number
          notes: string | null
          quantity: number
          restocked: boolean
          return_id: string
          unit_price_bdt: number
        }
        Insert: {
          created_at?: string
          damaged_qty?: number
          good_qty?: number
          id?: string
          item_id: string
          line_total_bdt?: number
          notes?: string | null
          quantity: number
          restocked?: boolean
          return_id: string
          unit_price_bdt?: number
        }
        Update: {
          created_at?: string
          damaged_qty?: number
          good_qty?: number
          id?: string
          item_id?: string
          line_total_bdt?: number
          notes?: string | null
          quantity?: number
          restocked?: boolean
          return_id?: string
          unit_price_bdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          credit_note_id: string | null
          dealer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          reason: string | null
          return_date: string
          return_no: string | null
          status: Database["public"]["Enums"]["sales_return_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          dealer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          return_date?: string
          return_no?: string | null
          status?: Database["public"]["Enums"]["sales_return_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          dealer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          return_date?: string
          return_no?: string | null
          status?: Database["public"]["Enums"]["sales_return_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_applications: {
        Row: {
          applied_at: string
          assignment_id: string | null
          batch_no: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          item_id: string | null
          patient_id: string
          removal_reason: string | null
          removed_at: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string
          assignment_id?: string | null
          batch_no?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          item_id?: string | null
          patient_id: string
          removal_reason?: string | null
          removed_at?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string
          assignment_id?: string | null
          batch_no?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          item_id?: string | null
          patient_id?: string
          removal_reason?: string | null
          removed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_applications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "inventory_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_applications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_applications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_allocations: {
        Row: {
          created_at: string
          from_pool: Database["public"]["Enums"]["stock_pool"]
          id: string
          item_id: string
          moved_by: string | null
          note: string | null
          quantity: number
          to_pool: Database["public"]["Enums"]["stock_pool"]
        }
        Insert: {
          created_at?: string
          from_pool: Database["public"]["Enums"]["stock_pool"]
          id?: string
          item_id: string
          moved_by?: string | null
          note?: string | null
          quantity: number
          to_pool: Database["public"]["Enums"]["stock_pool"]
        }
        Update: {
          created_at?: string
          from_pool?: Database["public"]["Enums"]["stock_pool"]
          id?: string
          item_id?: string
          moved_by?: string | null
          note?: string | null
          quantity?: number
          to_pool?: Database["public"]["Enums"]["stock_pool"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_allocations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          patient_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          ref_id: string | null
          ref_table: string | null
          source: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          patient_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          ref_id?: string | null
          ref_table?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          patient_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          ref_id?: string | null
          ref_table?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_invoice_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          item_id: string
          line_total_bdt: number
          quantity: number
          unit_price_bdt: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          item_id: string
          line_total_bdt?: number
          quantity: number
          unit_price_bdt?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          item_id?: string
          line_total_bdt?: number
          quantity?: number
          unit_price_bdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "trade_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_invoices: {
        Row: {
          ait_bdt: number
          ait_pct: number
          challan_id: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          discount_bdt: number
          due_date: string
          id: string
          invoice_date: string
          invoice_no: string | null
          notes: string | null
          order_id: string | null
          paid_amount_bdt: number
          status: Database["public"]["Enums"]["trade_invoice_status"]
          subtotal_bdt: number
          total_bdt: number
          updated_at: string
          vat_bdt: number
          vat_pct: number
        }
        Insert: {
          ait_bdt?: number
          ait_pct?: number
          challan_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          discount_bdt?: number
          due_date: string
          id?: string
          invoice_date?: string
          invoice_no?: string | null
          notes?: string | null
          order_id?: string | null
          paid_amount_bdt?: number
          status?: Database["public"]["Enums"]["trade_invoice_status"]
          subtotal_bdt?: number
          total_bdt?: number
          updated_at?: string
          vat_bdt?: number
          vat_pct?: number
        }
        Update: {
          ait_bdt?: number
          ait_pct?: number
          challan_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          discount_bdt?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_no?: string | null
          notes?: string | null
          order_id?: string | null
          paid_amount_bdt?: number
          status?: Database["public"]["Enums"]["trade_invoice_status"]
          subtotal_bdt?: number
          total_bdt?: number
          updated_at?: string
          vat_bdt?: number
          vat_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_invoices_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
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
      vehicle_trips: {
        Row: {
          created_at: string
          driver_user_id: string
          end_at: string | null
          end_odometer: number | null
          from_location: string
          id: string
          notes: string | null
          passengers: number | null
          purpose: string | null
          start_at: string
          start_odometer: number | null
          status: string
          to_location: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          driver_user_id: string
          end_at?: string | null
          end_odometer?: number | null
          from_location: string
          id?: string
          notes?: string | null
          passengers?: number | null
          purpose?: string | null
          start_at?: string
          start_odometer?: number | null
          status?: string
          to_location: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          driver_user_id?: string
          end_at?: string | null
          end_odometer?: number | null
          from_location?: string
          id?: string
          notes?: string | null
          passengers?: number | null
          purpose?: string | null
          start_at?: string
          start_odometer?: number | null
          status?: string
          to_location?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity: number | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          make: string | null
          model: string | null
          name: string
          notes: string | null
          plate_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          plate_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          plate_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      visit_form_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: Database["public"]["Enums"]["visit_field_type"]
          id: string
          is_active: boolean
          label: string
          options: Json | null
          placeholder: string | null
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: Database["public"]["Enums"]["visit_field_type"]
          id?: string
          is_active?: boolean
          label: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: Database["public"]["Enums"]["visit_field_type"]
          id?: string
          is_active?: boolean
          label?: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          action_plan: string | null
          assigned_to: string
          checkin_accuracy_m: number | null
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_accuracy_m: number | null
          checkout_at: string | null
          checkout_lat: number | null
          checkout_lng: number | null
          created_at: string
          created_by: string | null
          custom_data: Json
          dealer_id: string | null
          distance_flagged: boolean
          distance_from_target_m: number | null
          doctor_id: string | null
          hospital_id: string | null
          id: string
          next_action: string | null
          notes: string | null
          other_address: string | null
          other_name: string | null
          outcome: string | null
          patient_id: string | null
          pharmacy_id: string | null
          planned_at: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["visit_status"]
          target_lat: number | null
          target_lng: number | null
          target_type: Database["public"]["Enums"]["visit_target_type"]
          updated_at: string
          visit_no: string | null
        }
        Insert: {
          action_plan?: string | null
          assigned_to: string
          checkin_accuracy_m?: number | null
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_accuracy_m?: number | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          created_at?: string
          created_by?: string | null
          custom_data?: Json
          dealer_id?: string | null
          distance_flagged?: boolean
          distance_from_target_m?: number | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          next_action?: string | null
          notes?: string | null
          other_address?: string | null
          other_name?: string | null
          outcome?: string | null
          patient_id?: string | null
          pharmacy_id?: string | null
          planned_at?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          target_lat?: number | null
          target_lng?: number | null
          target_type: Database["public"]["Enums"]["visit_target_type"]
          updated_at?: string
          visit_no?: string | null
        }
        Update: {
          action_plan?: string | null
          assigned_to?: string
          checkin_accuracy_m?: number | null
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_accuracy_m?: number | null
          checkout_at?: string | null
          checkout_lat?: number | null
          checkout_lng?: number | null
          created_at?: string
          created_by?: string | null
          custom_data?: Json
          dealer_id?: string | null
          distance_flagged?: boolean
          distance_from_target_m?: number | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          next_action?: string | null
          notes?: string | null
          other_address?: string | null
          other_name?: string | null
          outcome?: string | null
          patient_id?: string | null
          pharmacy_id?: string | null
          planned_at?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          target_lat?: number | null
          target_lng?: number | null
          target_type?: Database["public"]["Enums"]["visit_target_type"]
          updated_at?: string
          visit_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          bp_diastolic: number | null
          bp_systolic: number | null
          created_at: string
          created_by: string | null
          fasting_glucose: number | null
          hba1c: number | null
          height_cm: number | null
          id: string
          notes: string | null
          patient_id: string
          post_meal_glucose: number | null
          pulse_bpm: number | null
          recorded_on: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          bp_diastolic?: number | null
          bp_systolic?: number | null
          created_at?: string
          created_by?: string | null
          fasting_glucose?: number | null
          hba1c?: number | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          patient_id: string
          post_meal_glucose?: number | null
          pulse_bpm?: number | null
          recorded_on?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          bp_diastolic?: number | null
          bp_systolic?: number | null
          created_at?: string
          created_by?: string | null
          fasting_glucose?: number | null
          hba1c?: number | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          patient_id?: string
          post_meal_glucose?: number | null
          pulse_bpm?: number | null
          recorded_on?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          batch_no: string | null
          claim_date: string
          created_at: string
          created_by: string | null
          dealer_id: string
          id: string
          issue_description: string | null
          item_id: string
          replaced_serial: string | null
          resolution: string | null
          serial_no: string | null
          status: Database["public"]["Enums"]["warranty_claim_status"]
          updated_at: string
        }
        Insert: {
          batch_no?: string | null
          claim_date?: string
          created_at?: string
          created_by?: string | null
          dealer_id: string
          id?: string
          issue_description?: string | null
          item_id: string
          replaced_serial?: string | null
          resolution?: string | null
          serial_no?: string | null
          status?: Database["public"]["Enums"]["warranty_claim_status"]
          updated_at?: string
        }
        Update: {
          batch_no?: string | null
          claim_date?: string
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          id?: string
          issue_description?: string | null
          item_id?: string
          replaced_serial?: string | null
          resolution?: string | null
          serial_no?: string | null
          status?: Database["public"]["Enums"]["warranty_claim_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          language: string
          name: string
          updated_at: string
          variables: string[]
          wati_template_name: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          name: string
          updated_at?: string
          variables?: string[]
          wati_template_name?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          updated_at?: string
          variables?: string[]
          wati_template_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      dealer_ledger_view: {
        Row: {
          credit_bdt: number | null
          dealer_id: string | null
          debit_bdt: number | null
          entry_date: string | null
          entry_type: string | null
          reference: string | null
          source_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_dealer_id: { Args: never; Returns: string }
      current_patient_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_sales_or_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "care_coordinator"
        | "doctor"
        | "nutritionist"
        | "inventory_manager"
        | "finance"
        | "patient"
        | "sales_officer"
        | "dealer"
      appointment_mode: "in_person" | "tele" | "phone"
      appointment_status:
        | "scheduled"
        | "completed"
        | "missed"
        | "cancelled"
        | "rescheduled"
      assignment_status: "active" | "returned" | "consumed" | "lost" | "expired"
      billing_frequency: "one_time" | "monthly" | "quarterly" | "custom"
      cheque_status:
        | "received"
        | "deposited"
        | "cleared"
        | "bounced"
        | "cancelled"
      commission_status: "accrued" | "approved" | "paid" | "void"
      credit_note_reason:
        | "return"
        | "discount"
        | "adjustment"
        | "damage"
        | "other"
      credit_period: "cash" | "net_7" | "net_15" | "net_30" | "net_45"
      dealer_payment_method:
        | "cash"
        | "bank"
        | "cheque"
        | "bkash"
        | "nagad"
        | "card"
        | "other"
      dealer_price_tier: "distributor" | "dealer" | "retailer"
      dealer_status: "active" | "suspended" | "terminated"
      dealer_type:
        | "distributor"
        | "sub_dealer"
        | "retailer"
        | "pharmacy"
        | "hospital_shop"
      debit_note_reason:
        | "freight"
        | "penalty"
        | "extra_charge"
        | "adjustment"
        | "other"
      enrollment_status: "active" | "completed" | "cancelled" | "paused"
      gender: "male" | "female" | "other"
      inventory_category:
        | "device"
        | "consumable"
        | "sensor"
        | "medicine"
        | "other"
      lead_source:
        | "walk_in"
        | "phone"
        | "whatsapp"
        | "facebook"
        | "instagram"
        | "website"
        | "referral"
        | "doctor"
        | "event"
        | "other"
      lead_stage:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "converted"
        | "lost"
      msg_channel: "whatsapp" | "sms" | "email" | "in_app"
      msg_direction: "outbound" | "inbound"
      msg_status: "queued" | "sent" | "delivered" | "read" | "failed"
      notif_channel: "in_app" | "whatsapp" | "email"
      notif_event_type:
        | "sensor_change"
        | "doctor_consult"
        | "nutritionist_consult"
        | "lab_test"
        | "payment_due"
        | "program_renewal"
        | "device_return"
        | "medicine_review"
        | "custom"
      notif_status: "pending" | "sent" | "failed" | "skipped" | "read"
      ownership_mode: "free" | "deposit" | "sold"
      patient_status: "active" | "paused" | "completed" | "dropped"
      payment_method:
        | "cash"
        | "bkash"
        | "nagad"
        | "card"
        | "bank_transfer"
        | "cheque"
        | "other"
      plan_service_frequency:
        | "total"
        | "per_month"
        | "per_quarter"
        | "unlimited"
      plan_service_type:
        | "doctor_visit"
        | "nutritionist_visit"
        | "care_coordinator_checkin"
        | "lab_test"
        | "group_session"
        | "home_visit"
        | "teleconsult"
        | "custom"
      provider_kind: "doctor" | "nutritionist" | "coordinator"
      referrer_kind: "doctor" | "hospital"
      sales_order_status:
        | "draft"
        | "confirmed"
        | "partially_delivered"
        | "delivered"
        | "closed"
        | "cancelled"
      sales_return_status:
        | "draft"
        | "received"
        | "restocked"
        | "closed"
        | "cancelled"
      schedule_status: "pending" | "paid" | "overdue" | "waived" | "partial"
      stock_pool: "program" | "trade"
      target_period: "month" | "quarter" | "year"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "open" | "in_progress" | "done" | "snoozed" | "cancelled"
      trade_invoice_status:
        | "unpaid"
        | "partial"
        | "paid"
        | "overdue"
        | "disputed"
        | "void"
      visit_field_type:
        | "text"
        | "textarea"
        | "number"
        | "select"
        | "date"
        | "checkbox"
      visit_status:
        | "planned"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "missed"
      visit_target_type:
        | "doctor"
        | "hospital"
        | "patient"
        | "dealer"
        | "pharmacy"
        | "other"
        | "office"
      warranty_claim_status:
        | "open"
        | "under_review"
        | "approved"
        | "rejected"
        | "replaced"
        | "closed"
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
      app_role: [
        "super_admin",
        "admin",
        "care_coordinator",
        "doctor",
        "nutritionist",
        "inventory_manager",
        "finance",
        "patient",
        "sales_officer",
        "dealer",
      ],
      appointment_mode: ["in_person", "tele", "phone"],
      appointment_status: [
        "scheduled",
        "completed",
        "missed",
        "cancelled",
        "rescheduled",
      ],
      assignment_status: ["active", "returned", "consumed", "lost", "expired"],
      billing_frequency: ["one_time", "monthly", "quarterly", "custom"],
      cheque_status: [
        "received",
        "deposited",
        "cleared",
        "bounced",
        "cancelled",
      ],
      commission_status: ["accrued", "approved", "paid", "void"],
      credit_note_reason: [
        "return",
        "discount",
        "adjustment",
        "damage",
        "other",
      ],
      credit_period: ["cash", "net_7", "net_15", "net_30", "net_45"],
      dealer_payment_method: [
        "cash",
        "bank",
        "cheque",
        "bkash",
        "nagad",
        "card",
        "other",
      ],
      dealer_price_tier: ["distributor", "dealer", "retailer"],
      dealer_status: ["active", "suspended", "terminated"],
      dealer_type: [
        "distributor",
        "sub_dealer",
        "retailer",
        "pharmacy",
        "hospital_shop",
      ],
      debit_note_reason: [
        "freight",
        "penalty",
        "extra_charge",
        "adjustment",
        "other",
      ],
      enrollment_status: ["active", "completed", "cancelled", "paused"],
      gender: ["male", "female", "other"],
      inventory_category: [
        "device",
        "consumable",
        "sensor",
        "medicine",
        "other",
      ],
      lead_source: [
        "walk_in",
        "phone",
        "whatsapp",
        "facebook",
        "instagram",
        "website",
        "referral",
        "doctor",
        "event",
        "other",
      ],
      lead_stage: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "converted",
        "lost",
      ],
      msg_channel: ["whatsapp", "sms", "email", "in_app"],
      msg_direction: ["outbound", "inbound"],
      msg_status: ["queued", "sent", "delivered", "read", "failed"],
      notif_channel: ["in_app", "whatsapp", "email"],
      notif_event_type: [
        "sensor_change",
        "doctor_consult",
        "nutritionist_consult",
        "lab_test",
        "payment_due",
        "program_renewal",
        "device_return",
        "medicine_review",
        "custom",
      ],
      notif_status: ["pending", "sent", "failed", "skipped", "read"],
      ownership_mode: ["free", "deposit", "sold"],
      patient_status: ["active", "paused", "completed", "dropped"],
      payment_method: [
        "cash",
        "bkash",
        "nagad",
        "card",
        "bank_transfer",
        "cheque",
        "other",
      ],
      plan_service_frequency: [
        "total",
        "per_month",
        "per_quarter",
        "unlimited",
      ],
      plan_service_type: [
        "doctor_visit",
        "nutritionist_visit",
        "care_coordinator_checkin",
        "lab_test",
        "group_session",
        "home_visit",
        "teleconsult",
        "custom",
      ],
      provider_kind: ["doctor", "nutritionist", "coordinator"],
      referrer_kind: ["doctor", "hospital"],
      sales_order_status: [
        "draft",
        "confirmed",
        "partially_delivered",
        "delivered",
        "closed",
        "cancelled",
      ],
      sales_return_status: [
        "draft",
        "received",
        "restocked",
        "closed",
        "cancelled",
      ],
      schedule_status: ["pending", "paid", "overdue", "waived", "partial"],
      stock_pool: ["program", "trade"],
      target_period: ["month", "quarter", "year"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["open", "in_progress", "done", "snoozed", "cancelled"],
      trade_invoice_status: [
        "unpaid",
        "partial",
        "paid",
        "overdue",
        "disputed",
        "void",
      ],
      visit_field_type: [
        "text",
        "textarea",
        "number",
        "select",
        "date",
        "checkbox",
      ],
      visit_status: [
        "planned",
        "checked_in",
        "completed",
        "cancelled",
        "missed",
      ],
      visit_target_type: [
        "doctor",
        "hospital",
        "patient",
        "dealer",
        "pharmacy",
        "other",
        "office",
      ],
      warranty_claim_status: [
        "open",
        "under_review",
        "approved",
        "rejected",
        "replaced",
        "closed",
      ],
    },
  },
} as const
