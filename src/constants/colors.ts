/**
 * Centralne definicje kolorów dla ról, statusów projektów, zamówień i absencji.
 * Używane w wielu komponentach — zmiany tutaj propagują się wszędzie.
 */

import type { Ionicons } from "@expo/vector-icons";

// ─── Role użytkowników ───

export const roleColors: Record<string, string> = {
  admin: "#ef4444",
  management: "#f59e0b",
  project_manager: "#3b82f6",
  bauleiter: "#10b981",
  worker: "#64748b",
  subcontractor: "#8b5cf6",
  office_worker: "#06b6d4",
  logistics: "#f97316",
  purchasing: "#ec4899",
  warehouse_manager: "#7c3aed",
};

export const roleIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  admin: "shield",
  management: "briefcase",
  project_manager: "clipboard",
  bauleiter: "construct",
  worker: "hammer",
  subcontractor: "people",
  office_worker: "desktop",
  logistics: "cube",
  purchasing: "cart",
  warehouse_manager: "file-tray-stacked",
};

// ─── Statusy projektów ───

export const projectStatusColors: Record<string, string> = {
  planning: "#8b5cf6",
  active: "#10b981",
  on_hold: "#f59e0b",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

// ─── Statusy zamówień (materiały, narzędzia) ───

export const orderStatusColors: Record<string, string> = {
  pending: "#f59e0b",
  ordered: "#3b82f6",
  approved: "#10b981",
  rejected: "#ef4444",
  delivered: "#10b981",
};

// ─── Statusy absencji ───

export const absenceStatusColors: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
};
