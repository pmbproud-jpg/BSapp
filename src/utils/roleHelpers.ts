/**
 * Shared role color and icon mappings.
 * Extracted from duplicated code in users/index, settings, useSettingsPermissions, users/import.
 */

export const ROLE_COLORS: Record<string, string> = {
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

export const ROLE_ICONS: Record<string, string> = {
  admin: "shield-checkmark",
  management: "business",
  project_manager: "briefcase",
  bauleiter: "construct",
  worker: "hammer",
  subcontractor: "people",
  office_worker: "desktop",
  logistics: "cube",
  purchasing: "cart",
  warehouse_manager: "file-tray-stacked",
};

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || "#94a3b8";
}

export function getRoleIcon(role: string): string {
  return ROLE_ICONS[role] || "person";
}
