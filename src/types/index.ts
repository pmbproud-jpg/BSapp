/**
 * Centralne typy aplikacji.
 * Re-eksportuje typy z database.types.ts i dodaje brakujące.
 */

// Re-eksport typów bazowych
export type {
  Database,
  Json,
  UserRole,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  SupportedLanguage,
  Company,
  Profile,
  Project,
  Task,
  TaskComment,
  ProjectMember,
  ProjectWithRelations,
  TaskWithRelations,
  ProfileWithCompany,
} from "@/src/lib/supabase/database.types";

import type { Database } from "@/src/lib/supabase/database.types";

// ─── Dodatkowe typy tabelowe ───

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type PlanRequest = Database["public"]["Tables"]["plan_requests"]["Row"];
export type PlanAssignment = Database["public"]["Tables"]["plan_assignments"]["Row"];
export type PlanRequestWorker = Database["public"]["Tables"]["plan_request_workers"]["Row"];
export type WarehouseMaterial = Database["public"]["Tables"]["warehouse_materials"]["Row"];
export type AutomationRule = Database["public"]["Tables"]["automation_rules"]["Row"];

// ─── Typy aplikacyjne (nie z DB) ───

export interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface AttachmentFolder {
  id: string;
  project_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface ProjectMemberWithProfile {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { full_name: string | null; email: string; role: string };
}

export interface HistoryEntry {
  type: "created" | "member_added" | "member_removed" | "task_created" | "task_completed";
  date: string;
  description: string;
  icon: string;
  color: string;
  taskId?: string;
}

export interface OrderItem {
  id: string;
  project_id: string;
  status: string;
  ilosc: number | null;
  uwagi: string | null;
  ordered_by: string | null;
  created_at: string;
  ordered_by_profile?: { full_name: string | null };
}

export interface MaterialOrder extends OrderItem {
  material_id: string;
  material?: Partial<WarehouseMaterial>;
}

export interface ToolOrder extends OrderItem {
  tool_id: string;
  tool?: {
    beschreibung: string | null;
    art_nr: string | null;
    hersteller: string | null;
    kategorie: string | null;
    serial_nummer: string | null;
  };
}

export interface AbsenceItem {
  id: string;
  user_id: string;
  type: string;
  date_from: string;
  date_to: string;
  days: number;
  status: string;
  note: string | null;
  approved_by: string | null;
  created_at: string;
  approver?: { full_name: string | null };
}

export interface ImportedUser {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}
