export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'approved' | 'pending' | 'rejected'
          approved_at: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'approved' | 'pending' | 'rejected'
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'approved' | 'pending' | 'rejected'
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_profile_links: {
        Row: {
          id: string
          user_id: string
          profile_id: string
          permission: 'read' | 'edit'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          profile_id: string
          permission: 'read' | 'edit'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profile_id?: string
          permission?: 'read' | 'edit'
          created_at?: string
        }
      }
      financial_entries: {
        Row: {
          id: string
          profile_id: string
          entry_date: string
          high_medium_risk: Json
          low_risk: Json
          total_high_medium_risk: number
          total_low_risk: number
          total_assets: number
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          profile_id: string
          entry_date: string
          high_medium_risk: Json
          low_risk: Json
          total_high_medium_risk: number
          total_low_risk: number
          total_assets: number
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          profile_id?: string
          entry_date?: string
          high_medium_risk?: Json
          low_risk?: Json
          total_high_medium_risk?: number
          total_low_risk?: number
          total_assets?: number
          created_at?: string
          updated_at?: string
          created_by?: string
        }
      }
    }
  }
}
