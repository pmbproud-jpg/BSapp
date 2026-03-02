/**
 * Hook zarządzający uprawnieniami użytkowników w ustawieniach:
 * fetchAllUsers, changeUserRole, loadUserPerms, saveUserPerms,
 * resetUserPermsToDefaults, permissionGroups, roleOptions.
 * Wydzielony z settings.tsx.
 */
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { getRoleDefaults, RoleName } from "@/src/hooks/usePermissions";
import { supabase } from "@/src/lib/supabase/client";

export function useSettingsPermissions(t: any) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>({});
  const [userRoleDefaults, setUserRoleDefaults] = useState<Record<string, boolean>>({});
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean> | null>(null);
  const [permSaving, setPermSaving] = useState(false);
  const [permSearch, setPermSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showRolePickerInPerm, setShowRolePickerInPerm] = useState(false);
  const [permSortBy, setPermSortBy] = useState<"name" | "role">("name");
  const [permSortAsc, setPermSortAsc] = useState(true);

  const roleOptions = [
    { value: "admin", label: t("common.roles.admin"), icon: "shield-checkmark" as const, color: "#ef4444" },
    { value: "management", label: t("common.roles.management"), icon: "business" as const, color: "#f59e0b" },
    { value: "project_manager", label: t("common.roles.project_manager"), icon: "briefcase" as const, color: "#3b82f6" },
    { value: "bauleiter", label: t("common.roles.bauleiter"), icon: "construct" as const, color: "#10b981" },
    { value: "worker", label: t("common.roles.worker"), icon: "hammer" as const, color: "#64748b" },
    { value: "office_worker", label: t("common.roles.office_worker"), icon: "desktop" as const, color: "#06b6d4" },
    { value: "logistics", label: t("common.roles.logistics"), icon: "cube" as const, color: "#f97316" },
    { value: "purchasing", label: t("common.roles.purchasing"), icon: "cart" as const, color: "#ec4899" },
    { value: "warehouse_manager", label: t("common.roles.warehouse_manager"), icon: "file-tray-stacked" as const, color: "#7c3aed" },
  ];

  const permissionGroups = [
    {
      title: t("settings.perm_group_dashboard", "Dashboard"),
      icon: "bar-chart" as const,
      color: "#3b82f6",
      perms: [
        { key: "canViewAllCharts", label: t("settings.perm_view_all_charts", "Alle Diagramme anzeigen") },
        { key: "canViewOwnCharts", label: t("settings.perm_view_own_charts", "Eigene Diagramme anzeigen") },
      ],
    },
    {
      title: t("settings.perm_group_projects", "Projekty"),
      icon: "folder-open" as const,
      color: "#10b981",
      perms: [
        { key: "canCreateProject", label: t("settings.perm_create_project", "Projekte erstellen") },
        { key: "canEditProject", label: t("settings.perm_edit_project", "Projekte bearbeiten") },
        { key: "canDeleteProject", label: t("settings.perm_delete_project", "Projekte löschen") },
        { key: "canViewAllProjects", label: t("settings.perm_view_all_projects", "Alle Projekte anzeigen") },
      ],
    },
    {
      title: t("settings.perm_group_tasks", "Zadania"),
      icon: "checkbox" as const,
      color: "#f59e0b",
      perms: [
        { key: "canCreateTask", label: t("settings.perm_create_task", "Aufgaben erstellen") },
        { key: "canEditTask", label: t("settings.perm_edit_task", "Aufgaben bearbeiten") },
        { key: "canDeleteTask", label: t("settings.perm_delete_task", "Aufgaben löschen") },
        { key: "canAssignTask", label: t("settings.perm_assign_task", "Aufgaben zuweisen") },
        { key: "canAddTaskComments", label: t("settings.perm_task_comments", "Aufgabenkommentare") },
        { key: "canChangeTaskStatus", label: t("settings.perm_change_task_status", "Aufgabenstatus ändern") },
      ],
    },
    {
      title: t("settings.perm_group_members", "Mitglieder"),
      icon: "people" as const,
      color: "#8b5cf6",
      perms: [
        { key: "canManageMembers", label: t("settings.perm_manage_members", "Mitglieder verwalten") },
        { key: "canAddMembers", label: t("settings.perm_add_members", "Mitglieder hinzufügen") },
        { key: "canRemoveMembers", label: t("settings.perm_remove_members", "Mitglieder entfernen") },
      ],
    },
    {
      title: t("settings.perm_group_users", "Benutzer"),
      icon: "person" as const,
      color: "#06b6d4",
      perms: [
        { key: "canViewUsers", label: t("settings.perm_view_users", "Benutzer anzeigen") },
        { key: "canCreateUser", label: t("settings.perm_create_user", "Benutzer erstellen") },
        { key: "canEditUser", label: t("settings.perm_edit_user", "Benutzer bearbeiten") },
        { key: "canDeleteUser", label: t("settings.perm_delete_user", "Benutzer löschen") },
        { key: "canChangeUserRole", label: t("settings.perm_change_role", "Benutzerrolle ändern") },
      ],
    },
    {
      title: t("settings.perm_group_subcontractors", "Subunternehmer"),
      icon: "construct" as const,
      color: "#f97316",
      perms: [
        { key: "canCreateSubcontractor", label: t("settings.perm_create_sub", "Subunternehmer erstellen") },
        { key: "canManageSubcontractor", label: t("settings.perm_manage_sub", "Subunternehmer verwalten") },
      ],
    },
    {
      title: t("settings.perm_group_settings", "Einstellungen"),
      icon: "settings" as const,
      color: "#64748b",
      perms: [
        { key: "canManagePermissions", label: t("settings.perm_manage_permissions", "Berechtigungen verwalten") },
        { key: "canManageGlobalSettings", label: t("settings.perm_global_settings", "Globale Einstellungen") },
        { key: "canManageCompanySettings", label: t("settings.perm_company_settings", "Firmeneinstellungen") },
      ],
    },
    {
      title: "GPS",
      icon: "location" as const,
      color: "#ef4444",
      perms: [
        { key: "canViewGPS", label: t("settings.perm_view_gps", "GPS anzeigen") },
        { key: "canManageGPS", label: t("settings.perm_manage_gps", "GPS verwalten") },
        { key: "canViewGPSUsers", label: t("settings.perm_view_gps_users", "GPS-Benutzer anzeigen") },
      ],
    },
    {
      title: t("settings.perm_group_files", "Dateien"),
      icon: "document-attach" as const,
      color: "#ec4899",
      perms: [
        { key: "canUploadFiles", label: t("settings.perm_upload_files", "Dateien hochladen") },
        { key: "canDeleteFiles", label: t("settings.perm_delete_files", "Dateien löschen") },
        { key: "canImportData", label: t("settings.perm_import_data", "Datenimport") },
      ],
    },
    {
      title: t("settings.perm_group_warehouse", "Lager"),
      icon: "cube" as const,
      color: "#7c3aed",
      perms: [
        { key: "canViewWarehouse", label: t("settings.perm_view_warehouse", "Lager anzeigen") },
        { key: "canEditWarehouse", label: t("settings.perm_edit_warehouse", "Lager bearbeiten") },
        { key: "canOrderMaterials", label: t("settings.perm_order_materials", "Materialbestellungen") },
      ],
    },
    {
      title: t("settings.perm_group_plan", "Wochenplan"),
      icon: "calendar" as const,
      color: "#0891b2",
      perms: [
        { key: "canViewPlan", label: t("settings.perm_view_plan", "Plan anzeigen") },
        { key: "canEditPlan", label: t("settings.perm_edit_plan", "Plan bearbeiten") },
      ],
    },
    {
      title: t("settings.perm_group_general", "Allgemein"),
      icon: "shield-checkmark" as const,
      color: "#475569",
      perms: [
        { key: "canDelete", label: t("settings.perm_delete_general", "Allgemeines Löschen") },
      ],
    },
  ];

  // Flat list for backward compat
  const permissionKeys = permissionGroups.flatMap((g) => g.perms);

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name");
      if (error) throw error;
      setAllUsers(data || []);
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setUsersLoading(false);
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await (supabase.from("profiles") as any)
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      setShowRoleModal(false);
      setSelectedUser(null);
      const msg = t("settings.role_changed_success") || "Funktion wurde geändert";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      console.error("Error changing role:", e);
      const msg = t("settings.role_change_error") || "Fehler beim Ändern der Funktion";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    }
  };

  const loadUserPerms = async (userId: string) => {
    try {
      const { data, error } = await (supabase.from("profiles") as any)
        .select("custom_permissions, role")
        .eq("id", userId)
        .single();
      if (error) throw error;
      const role = (data?.role || allUsers.find((u: any) => u.id === userId)?.role || "worker") as RoleName;
      const defaults = getRoleDefaults(role);
      setUserRoleDefaults(defaults);
      setUserOverrides(data?.custom_permissions || null);
      if (data?.custom_permissions) {
        // Merge: start from defaults, apply overrides
        setUserPerms({ ...defaults, ...data.custom_permissions });
      } else {
        setUserPerms({ ...defaults });
      }
    } catch (e) {
      console.error("Error loading perms:", e);
    }
  };

  const resetUserPermsToDefaults = () => {
    if (!selectedUser) return;
    const role = (selectedUser.role || "worker") as RoleName;
    const defaults = getRoleDefaults(role);
    setUserPerms({ ...defaults });
    setUserOverrides(null);
  };

  const isPermOverridden = (key: string): boolean => {
    if (!userOverrides) return false;
    return key in userOverrides && userOverrides[key] !== userRoleDefaults[key];
  };

  const toggleGroupCollapse = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const overrideCount = Object.keys(userPerms).filter((k) => userPerms[k] !== userRoleDefaults[k]).length;

  const saveUserPerms = async () => {
    if (!selectedUser) return;
    setPermSaving(true);
    try {
      // Only save differences from role defaults
      const overridesOnly: Record<string, boolean> = {};
      for (const key of Object.keys(userPerms)) {
        if (userPerms[key] !== userRoleDefaults[key]) {
          overridesOnly[key] = userPerms[key];
        }
      }
      const toSave = Object.keys(overridesOnly).length > 0 ? overridesOnly : null;
      const { data, error } = await (supabase.from("profiles") as any)
        .update({ custom_permissions: toSave })
        .eq("id", selectedUser.id)
        .select("id, custom_permissions");
      if (error) throw error;
      setShowPermModal(false);
      setSelectedUser(null);
      const msg = t("settings.perms_saved_success") || "Berechtigungen gespeichert";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("[saveUserPerms] Error:", e);
      const msg = t("settings.perms_save_error") || "Fehler beim Speichern der Berechtigungen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setPermSaving(false);
    }
  };

  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      admin: "#ef4444",
      management: "#f59e0b",
      project_manager: "#3b82f6",
      bauleiter: "#10b981",
      worker: "#64748b",
      office_worker: "#06b6d4",
      logistics: "#f97316",
      purchasing: "#ec4899",
      warehouse_manager: "#7c3aed",
    };
    return colorMap[role] || "#94a3b8";
  };

  return {
    // Users
    allUsers, usersLoading, selectedUser, setSelectedUser,
    fetchAllUsers,
    // Role modal
    showRoleModal, setShowRoleModal,
    roleOptions, changeUserRole, getRoleColor,
    // Perm modal
    showPermModal, setShowPermModal,
    userPerms, setUserPerms, userRoleDefaults, setUserRoleDefaults,
    userOverrides, setUserOverrides,
    permSaving, permSearch, setPermSearch,
    collapsedGroups, showRolePickerInPerm, setShowRolePickerInPerm,
    permSortBy, setPermSortBy, permSortAsc, setPermSortAsc,
    permissionGroups, permissionKeys,
    loadUserPerms, saveUserPerms,
    resetUserPermsToDefaults, isPermOverridden,
    toggleGroupCollapse, overrideCount,
  };
}
