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

export type UserRole = 'admin' | 'management' | 'project_manager' | 'bauleiter' | 'worker'
export type ProjectStatus = 'planning' | 'active' | 'completed' | 'cancelled'
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
