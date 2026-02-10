import { useAuth } from "@/src/providers/AuthProvider";

export type RoleName = "admin" | "management" | "project_manager" | "bauleiter" | "worker" | "subcontractor";

/**
 * Centralny hook uprawnień.
 * 
 * Hierarchia ról:
 * - admin: pełny dostęp, może wszystko (w tym nadawanie uprawnień)
 * - management (zarząd): pełny dostęp do danych, ale nie może usuwać funkcji wpływających na działanie aplikacji
 * - project_manager (PM): widzi/edytuje/dodaje to na co pozwoli admin/zarząd, nie może usuwać
 * - bauleiter (BL): widzi/edytuje/dodaje to na co pozwoli admin/zarząd, nie może usuwać
 * - worker: widzi/edytuje/dodaje to na co pozwoli admin/zarząd, nie może usuwać
 */
export function usePermissions() {
  const { profile } = useAuth();
  const role = (profile?.role || "worker") as RoleName;

  const isAdmin = role === "admin";
  const isManagement = role === "management";
  const isPM = role === "project_manager";
  const isBL = role === "bauleiter";
  const isWorker = role === "worker";
  const isSubcontractor = role === "subcontractor";

  // Grupy uprawnień
  const isAdminOrManagement = isAdmin || isManagement;
  const isLeadership = isAdmin || isManagement || isPM;

  return {
    role,
    isAdmin,
    isManagement,
    isPM,
    isBL,
    isWorker,
    isSubcontractor,

    // ===== DASHBOARD =====
    // Admin i zarząd widzą wykresy WSZYSTKICH projektów i zadań
    canViewAllCharts: isAdminOrManagement,
    // PM/BL widzą ograniczone wykresy (swoich projektów)
    canViewOwnCharts: isPM || isBL,
    // Worker widzi tylko podstawowe statystyki
    canViewBasicStats: true,

    // ===== PROJEKTY =====
    canCreateProject: isLeadership,
    canEditProject: isLeadership,
    canDeleteProject: isAdminOrManagement,
    canViewAllProjects: isAdminOrManagement,
    // PM/BL/Worker widzą tylko projekty do których są przypisani
    canViewOnlyAssigned: !isAdminOrManagement,

    // ===== ZADANIA =====
    canCreateTask: isAdmin || isManagement || isPM || isBL,
    canEditTask: isAdmin || isManagement || isPM || isBL,
    canDeleteTask: isAdminOrManagement,
    canAssignTask: isAdmin || isManagement || isPM || isBL,

    // ===== CZŁONKOWIE PROJEKTU =====
    canManageMembers: isLeadership,
    canAddMembers: isLeadership,
    canRemoveMembers: isAdminOrManagement,

    // ===== UŻYTKOWNICY =====
    canViewUsers: isAdminOrManagement,
    canCreateUser: isAdminOrManagement,
    canEditUser: isAdminOrManagement,
    canDeleteUser: isAdmin, // Tylko admin może usuwać użytkowników
    canChangeUserRole: isAdmin, // Tylko admin może zmieniać role

    // ===== USTAWIENIA =====
    canManagePermissions: isAdmin, // Panel nadawania uprawnień
    canManageGlobalSettings: isAdmin,
    canManageCompanySettings: isAdminOrManagement,

    // ===== PLIKI =====
    canUploadFiles: isAdmin || isManagement || isPM || isBL,
    canDeleteFiles: isAdminOrManagement,

    // ===== IMPORT =====
    canImportData: isAdminOrManagement,

    // ===== PODWYKONAWCY =====
    canCreateSubcontractor: isAdmin || isManagement || isPM,
    canManageSubcontractor: isAdmin || isManagement || isPM,

    // ===== OGÓLNE =====
    canDelete: isAdminOrManagement, // Ogólna flaga usuwania
  };
}
