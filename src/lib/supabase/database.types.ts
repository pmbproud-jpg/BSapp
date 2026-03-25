// src/lib/supabase/database.types.ts
// Typy TypeScript dla bazy danych Supabase
// Te typy możesz wygenerować automatycznie przez: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'management' | 'project_manager' | 'bauleiter' | 'worker' | 'subcontractor' | 'office_worker' | 'logistics' | 'purchasing' | 'warehouse_manager'
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type SupportedLanguage = 'de' | 'pl' | 'en'

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          company_id: string | null
          email: string
          full_name: string | null
          role: UserRole
          language: SupportedLanguage
          avatar_url: string | null
          phone: string | null
          hide_phone: boolean
          hide_email: boolean
          access_expires_at: string | null
          custom_permissions: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id?: string | null
          email: string
          full_name?: string | null
          role?: UserRole
          language?: SupportedLanguage
          avatar_url?: string | null
          phone?: string | null
          hide_phone?: boolean
          hide_email?: boolean
          access_expires_at?: string | null
          custom_permissions?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          email?: string
          full_name?: string | null
          role?: UserRole
          language?: SupportedLanguage
          avatar_url?: string | null
          phone?: string | null
          hide_phone?: boolean
          hide_email?: boolean
          access_expires_at?: string | null
          custom_permissions?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          status: ProjectStatus
          start_date: string | null
          end_date: string | null
          budget: number | null
          location: string | null
          project_manager_id: string | null
          bauleiter_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          status?: ProjectStatus
          start_date?: string | null
          end_date?: string | null
          budget?: number | null
          location?: string | null
          project_manager_id?: string | null
          bauleiter_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          status?: ProjectStatus
          start_date?: string | null
          end_date?: string | null
          budget?: number | null
          location?: string | null
          project_manager_id?: string | null
          bauleiter_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          due_date: string | null
          completed_at: string | null
          assigned_to: string | null
          assigned_by: string | null
          assigned_at: string | null
          created_by: string | null
          edited_by: string | null
          edited_at: string | null
          notes_de: string | null
          notes_pl: string | null
          notes_en: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          completed_at?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          assigned_at?: string | null
          created_by?: string | null
          edited_by?: string | null
          edited_at?: string | null
          notes_de?: string | null
          notes_pl?: string | null
          notes_en?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          completed_at?: string | null
          assigned_to?: string | null
          assigned_by?: string | null
          assigned_at?: string | null
          created_by?: string | null
          edited_by?: string | null
          edited_at?: string | null
          notes_de?: string | null
          notes_pl?: string | null
          notes_en?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          comment: string
          language: SupportedLanguage
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          comment: string
          language?: SupportedLanguage
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          comment?: string
          language?: SupportedLanguage
          created_at?: string
        }
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          type: string
          read: boolean
          data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body: string
          type?: string
          read?: boolean
          data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          type?: string
          read?: boolean
          data?: Json | null
          created_at?: string
        }
      }
      automation_rules: {
        Row: {
          id: string
          name: string
          trigger_type: string
          action_type: string
          config: Json
          enabled: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          trigger_type: string
          action_type: string
          config?: Json
          enabled?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          trigger_type?: string
          action_type?: string
          config?: Json
          enabled?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          name: string
          license_plate: string
          seats: number
          active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          license_plate: string
          seats?: number
          active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          license_plate?: string
          seats?: number
          active?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      plan_requests: {
        Row: {
          id: string
          project_id: string
          week_start: string
          requested_by: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          week_start: string
          requested_by: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          week_start?: string
          requested_by?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      plan_request_workers: {
        Row: {
          id: string
          request_id: string
          worker_id: string
        }
        Insert: {
          id?: string
          request_id: string
          worker_id: string
        }
        Update: {
          id?: string
          request_id?: string
          worker_id?: string
        }
      }
      plan_assignments: {
        Row: {
          id: string
          request_id: string
          worker_id: string
          vehicle_id: string | null
          day_of_week: number
          departure_time: string | null
          start_time: string | null
          end_time: string | null
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          worker_id: string
          vehicle_id?: string | null
          day_of_week: number
          departure_time?: string | null
          start_time?: string | null
          end_time?: string | null
          assigned_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          worker_id?: string
          vehicle_id?: string | null
          day_of_week?: number
          departure_time?: string | null
          start_time?: string | null
          end_time?: string | null
          assigned_by?: string | null
          created_at?: string
        }
      }
      project_deadlines: {
        Row: {
          id: string
          project_id: string
          type: string
          title: string
          description: string | null
          start_date: string | null
          deadline_date: string
          warning_days: number
          status: 'pending' | 'warned' | 'overdue' | 'completed'
          completed_at: string | null
          related_obstruction_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type: string
          title: string
          description?: string | null
          start_date?: string | null
          deadline_date: string
          warning_days?: number
          status?: 'pending' | 'warned' | 'overdue' | 'completed'
          completed_at?: string | null
          related_obstruction_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: string
          title?: string
          description?: string | null
          start_date?: string | null
          deadline_date?: string
          warning_days?: number
          status?: 'pending' | 'warned' | 'overdue' | 'completed'
          completed_at?: string | null
          related_obstruction_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_obstructions: {
        Row: {
          id: string
          project_id: string
          type: 'behinderung' | 'bedenken'
          status: 'active' | 'resolved' | 'escalated'
          title: string
          description: string | null
          cause: string | null
          consequences: string | null
          cost_estimate: number | null
          reported_at: string
          resolved_at: string | null
          reported_by: string | null
          resolved_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type?: 'behinderung' | 'bedenken'
          status?: 'active' | 'resolved' | 'escalated'
          title: string
          description?: string | null
          cause?: string | null
          consequences?: string | null
          cost_estimate?: number | null
          reported_at?: string
          resolved_at?: string | null
          reported_by?: string | null
          resolved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: 'behinderung' | 'bedenken'
          status?: 'active' | 'resolved' | 'escalated'
          title?: string
          description?: string | null
          cause?: string | null
          consequences?: string | null
          cost_estimate?: number | null
          reported_at?: string
          resolved_at?: string | null
          reported_by?: string | null
          resolved_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      project_checklists: {
        Row: {
          id: string
          project_id: string
          has_calculations: boolean
          has_fire_protection: boolean
          has_floor_plans: boolean
          has_sections: boolean
          has_schematics: boolean
          has_calculations_match: boolean
          has_afu: boolean
          has_material_list: boolean
          has_montage_plan: boolean
          has_operating_manuals: boolean
          has_revision_docs: boolean
          has_acceptance_protocol: boolean
          has_collisions: boolean
          collision_notes: string | null
          shitlist_notes: string | null
          shitlist_sent_at: string | null
          notes: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          has_calculations?: boolean
          has_fire_protection?: boolean
          has_floor_plans?: boolean
          has_sections?: boolean
          has_schematics?: boolean
          has_calculations_match?: boolean
          has_afu?: boolean
          has_material_list?: boolean
          has_montage_plan?: boolean
          has_operating_manuals?: boolean
          has_revision_docs?: boolean
          has_acceptance_protocol?: boolean
          has_collisions?: boolean
          collision_notes?: string | null
          shitlist_notes?: string | null
          shitlist_sent_at?: string | null
          notes?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          has_calculations?: boolean
          has_fire_protection?: boolean
          has_floor_plans?: boolean
          has_sections?: boolean
          has_schematics?: boolean
          has_calculations_match?: boolean
          has_afu?: boolean
          has_material_list?: boolean
          has_montage_plan?: boolean
          has_operating_manuals?: boolean
          has_revision_docs?: boolean
          has_acceptance_protocol?: boolean
          has_collisions?: boolean
          collision_notes?: string | null
          shitlist_notes?: string | null
          shitlist_sent_at?: string | null
          notes?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      daily_reports: {
        Row: {
          id: string
          project_id: string
          report_date: string
          worker_count: number
          worker_details: string | null
          weather: string | null
          temperature: string | null
          work_start: string | null
          work_end: string | null
          work_description: string | null
          had_disruptions: boolean
          disruption_description: string | null
          had_orders: boolean
          order_description: string | null
          had_hourly_work: boolean
          hourly_work_description: string | null
          hourly_work_hours: number | null
          notes: string | null
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          status: 'draft' | 'submitted' | 'approved'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          report_date: string
          worker_count?: number
          worker_details?: string | null
          weather?: string | null
          temperature?: string | null
          work_start?: string | null
          work_end?: string | null
          work_description?: string | null
          had_disruptions?: boolean
          disruption_description?: string | null
          had_orders?: boolean
          order_description?: string | null
          had_hourly_work?: boolean
          hourly_work_description?: string | null
          hourly_work_hours?: number | null
          notes?: string | null
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'draft' | 'submitted' | 'approved'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          report_date?: string
          worker_count?: number
          worker_details?: string | null
          weather?: string | null
          temperature?: string | null
          work_start?: string | null
          work_end?: string | null
          work_description?: string | null
          had_disruptions?: boolean
          disruption_description?: string | null
          had_orders?: boolean
          order_description?: string | null
          had_hourly_work?: boolean
          hourly_work_description?: string | null
          hourly_work_hours?: number | null
          notes?: string | null
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'draft' | 'submitted' | 'approved'
          created_at?: string
          updated_at?: string
        }
      }
      warehouse_materials: {
        Row: {
          id: string
          pozycja: string | null
          art_nr: string | null
          nazwa: string | null
          ilosc: number | null
          dlugosc: string | null
          szerokosc: string | null
          wysokosc: string | null
          waga: string | null
          zamawiajacy: string | null
          data_zamowienia: string | null
          data_dostawy: string | null
          min_stan: number | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pozycja?: string | null
          art_nr?: string | null
          nazwa?: string | null
          ilosc?: number | null
          dlugosc?: string | null
          szerokosc?: string | null
          wysokosc?: string | null
          waga?: string | null
          zamawiajacy?: string | null
          data_zamowienia?: string | null
          data_dostawy?: string | null
          min_stan?: number | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          pozycja?: string | null
          art_nr?: string | null
          nazwa?: string | null
          ilosc?: number | null
          dlugosc?: string | null
          szerokosc?: string | null
          wysokosc?: string | null
          waga?: string | null
          zamawiajacy?: string | null
          data_zamowienia?: string | null
          data_dostawy?: string | null
          min_stan?: number | null
          created_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: UserRole
      }
      user_has_project_access: {
        Args: {
          project_uuid: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      project_status: ProjectStatus
      task_status: TaskStatus
      task_priority: TaskPriority
    }
  }
}

// Pomocnicze typy
export type Company = Database['public']['Tables']['companies']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskComment = Database['public']['Tables']['task_comments']['Row']
export type ProjectMember = Database['public']['Tables']['project_members']['Row']

// Typy z relacjami (do użycia w zapytaniach)
export type ProjectWithRelations = Project & {
  project_manager?: Profile
  bauleiter?: Profile
  company?: Company
}

export type TaskWithRelations = Task & {
  assigned_to_user?: Profile
  assigned_by_user?: Profile
  project?: Project
  comments?: TaskComment[]
}

export type ProfileWithCompany = Profile & {
  company?: Company
}

export type ProjectDeadline = Database['public']['Tables']['project_deadlines']['Row']
export type ProjectDeadlineInsert = Database['public']['Tables']['project_deadlines']['Insert']
export type ProjectObstruction = Database['public']['Tables']['project_obstructions']['Row']
export type ProjectObstructionInsert = Database['public']['Tables']['project_obstructions']['Insert']
export type ProjectChecklist = Database['public']['Tables']['project_checklists']['Row']
export type DailyReport = Database['public']['Tables']['daily_reports']['Row']
export type DailyReportInsert = Database['public']['Tables']['daily_reports']['Insert']
export type DailyReportUpdate = Database['public']['Tables']['daily_reports']['Update']
export type DailyReportStatus = 'draft' | 'submitted' | 'approved'
