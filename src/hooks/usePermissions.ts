import { useAuth } from "@/src/providers/AuthProvider";

export type RoleName = "admin" | "management" | "project_manager" | "bauleiter" | "worker" | "subcontractor" | "office_worker" | "logistics" | "purchasing" | "warehouse_manager";

/**
 * Centralny hook uprawnień — matryca wg funkcji zatrudnienia.
 *
 * 1. Administrator — wszystkie uprawnienia
 * 2. Zarząd — wszystkie uprawnienia
 * 3. Menager projektu — widzi wszystko oprócz GPS. Edytuje wszystko poza GPS, magazynem,
 *    indywidualnymi uprawnieniami.
 * 4. BL (kierownik budowy) — widzi wszystko oprócz GPS. NIE może: edytować magazynu,
 *    nadawać uprawnień, edytować/dodawać użytkowników i podwykonawców, tworzyć projektów,
 *    usuwać zadań, usuwać plików, edytować planu. W edycji projektu: tylko pliki/foldery.
 *    Może tworzyć zadania.
 * 5. Pracownik — widzi plan, dashboard, użytkowników, ustawienia (bez GPS i uprawnień).
 *    Projekty widzi, nie edytuje. Zadania: widzi, może dodać uwagę i zmienić status
 *    (w trakcie / ukończone). Może dodawać pliki, zdjęcia, robić zdjęcia. Może zmieniać tłumaczenie.
 * 6. Pracownik biurowy — widzi wszystko, nie widzi GPS i uprawnień. Nie może nic edytować.
 * 7. Logistyka — widzi wszystko, nie widzi GPS i uprawnień. Nie może nic edytować.
 *    Wyjątek: może zarządzać planem tygodniowym (edytować, tworzyć, usuwać).
 * 8. Dział zakupów — widzi wszystko, nie widzi GPS i uprawnień. Nie może nic edytować.
 *    Wyjątek: pełne uprawnienia do magazynu (zarządzać, dodawać, edytować, usuwać).
 * 9. Magazynier — widzi wszystko, nie widzi GPS i uprawnień. Nie może nic edytować.
 *    Wyjątek: pełne uprawnienia do magazynu (zarządzać, dodawać, edytować, usuwać).
 *
 * Indywidualne uprawnienia nadal działają — admin może per-user nadpisać domyślne.
 * Nadpisania są przechowywane w kolumnie `custom_permissions` (jsonb) w tabeli `profiles`.
 */
/** Generuje domyślne uprawnienia dla danej roli (bez overrides) */
export function getRoleDefaults(role: RoleName): Record<string, boolean> {
  const isAdmin = role === "admin";
  const isManagement = role === "management";
  const isPM = role === "project_manager";
  const isBL = role === "bauleiter";
  const isWorker = role === "worker";
  const isSubcontractor = role === "subcontractor";
  const isOfficeWorker = role === "office_worker";
  const isLogistics = role === "logistics";
  const isPurchasing = role === "purchasing";
  const isWarehouseManager = role === "warehouse_manager";
  const isAdminOrManagement = isAdmin || isManagement;

  return {
    canViewAllCharts: isAdminOrManagement,
    canViewOwnCharts: isPM || isBL,
    canCreateProject: isAdminOrManagement || isPM,
    canEditProject: isAdminOrManagement || isPM,
    canDeleteProject: isAdminOrManagement,
    canViewAllProjects: isAdminOrManagement || isOfficeWorker || isLogistics || isPurchasing || isWarehouseManager,
    canCreateTask: isAdminOrManagement || isPM || isBL,
    canEditTask: isAdminOrManagement || isPM,
    canDeleteTask: isAdminOrManagement,
    canAssignTask: isAdminOrManagement || isPM || isBL,
    canAddTaskComments: isAdminOrManagement || isPM || isBL || isWorker,
    canChangeTaskStatus: isAdminOrManagement || isPM || isBL || isWorker,
    canManageMembers: isAdminOrManagement || isPM,
    canAddMembers: isAdminOrManagement || isPM,
    canRemoveMembers: isAdminOrManagement,
    canViewUsers: !isSubcontractor,
    canCreateUser: isAdminOrManagement,
    canEditUser: isAdminOrManagement,
    canDeleteUser: isAdmin,
    canChangeUserRole: isAdmin,
    canCreateSubcontractor: isAdminOrManagement,
    canManageSubcontractor: isAdminOrManagement,
    canManagePermissions: isAdmin,
    canManageGlobalSettings: isAdmin,
    canManageCompanySettings: isAdminOrManagement,
    canViewGPS: isAdminOrManagement,
    canManageGPS: isAdminOrManagement,
    canViewGPSUsers: isAdminOrManagement,
    canUploadFiles: isAdminOrManagement || isPM || isBL || isWorker,
    canDeleteFiles: isAdminOrManagement,
    canImportData: isAdminOrManagement || isLogistics || isPurchasing || isWarehouseManager,
    canViewWarehouse: isAdminOrManagement || isPM || isBL || isOfficeWorker || isLogistics || isPurchasing || isWarehouseManager,
    canEditWarehouse: isAdminOrManagement || isPurchasing || isWarehouseManager,
    canOrderMaterials: isAdminOrManagement || isPM || isBL || isWarehouseManager || isPurchasing,
    canViewPlan: isAdminOrManagement || isPM || isBL || isWorker || isLogistics || isOfficeWorker || isPurchasing || isWarehouseManager,
    canEditPlan: isAdminOrManagement || isLogistics,
    canDelete: isAdminOrManagement,
  };
}

export function usePermissions() {
  const { profile } = useAuth();
  const role = (profile?.role || "worker") as RoleName;

  const isAdmin = role === "admin";
  const isManagement = role === "management";
  const isPM = role === "project_manager";
  const isBL = role === "bauleiter";
  const isWorker = role === "worker";
  const isSubcontractor = role === "subcontractor";
  const isOfficeWorker = role === "office_worker";
  const isLogistics = role === "logistics";
  const isPurchasing = role === "purchasing";
  const isWarehouseManager = role === "warehouse_manager";

  // Grupy
  const isAdminOrManagement = isAdmin || isManagement;
  const isLeadership = isAdmin || isManagement || isPM;
  const isOfficeStaff = isOfficeWorker || isLogistics || isPurchasing;

  // Domyślne uprawnienia z macierzy ról
  const roleDefaults: Record<string, boolean> = {
    // Dashboard
    canViewAllCharts: isAdminOrManagement,
    canViewOwnCharts: isPM || isBL,
    // Projekty
    canCreateProject: isAdminOrManagement || isPM,
    canEditProject: isAdminOrManagement || isPM,
    canDeleteProject: isAdminOrManagement,
    canViewAllProjects: isAdminOrManagement || isOfficeWorker || isLogistics || isPurchasing || isWarehouseManager,
    // Zadania
    canCreateTask: isAdminOrManagement || isPM || isBL,
    canEditTask: isAdminOrManagement || isPM,
    canDeleteTask: isAdminOrManagement,
    canAssignTask: isAdminOrManagement || isPM || isBL,
    canAddTaskComments: isAdminOrManagement || isPM || isBL || isWorker,
    canChangeTaskStatus: isAdminOrManagement || isPM || isBL || isWorker,
    // Członkowie
    canManageMembers: isAdminOrManagement || isPM,
    canAddMembers: isAdminOrManagement || isPM,
    canRemoveMembers: isAdminOrManagement,
    // Użytkownicy
    canViewUsers: !isSubcontractor,
    canCreateUser: isAdminOrManagement,
    canEditUser: isAdminOrManagement,
    canDeleteUser: isAdmin,
    canChangeUserRole: isAdmin,
    // Podwykonawcy
    canCreateSubcontractor: isAdminOrManagement,
    canManageSubcontractor: isAdminOrManagement,
    // Ustawienia
    canManagePermissions: isAdmin,
    canManageGlobalSettings: isAdmin,
    canManageCompanySettings: isAdminOrManagement,
    // GPS
    canViewGPS: isAdminOrManagement,
    canManageGPS: isAdminOrManagement,
    canViewGPSUsers: isAdminOrManagement,
    // Pliki
    canUploadFiles: isAdminOrManagement || isPM || isBL || isWorker,
    canDeleteFiles: isAdminOrManagement,
    // Import
    canImportData: isAdminOrManagement || isLogistics || isPurchasing || isWarehouseManager,
    // Magazyn
    canViewWarehouse: isAdminOrManagement || isPM || isBL || isOfficeWorker || isLogistics || isPurchasing || isWarehouseManager,
    canEditWarehouse: isAdminOrManagement || isPurchasing || isWarehouseManager,
    canOrderMaterials: isAdminOrManagement || isPM || isBL || isWarehouseManager || isPurchasing,
    // Plan
    canViewPlan: isAdminOrManagement || isPM || isBL || isWorker || isLogistics || isOfficeWorker || isPurchasing || isWarehouseManager,
    canEditPlan: isAdminOrManagement || isLogistics,
    // Ogólne
    canDelete: isAdminOrManagement,
  };

  // Indywidualne nadpisania z profilu Supabase (kolumna custom_permissions jsonb)
  const overrides: Record<string, boolean> | null =
    (profile as any)?.custom_permissions ?? null;

  // Debug: log profile and overrides
  if (profile) {
    console.log("[usePermissions] role:", role, "overrides:", overrides ? JSON.stringify(overrides) : "null", "profile keys:", Object.keys(profile));
  }

  // Funkcja pomocnicza: zwraca indywidualną wartość jeśli istnieje, inaczej domyślną z macierzy
  const perm = (key: string, roleDefault: boolean): boolean => {
    if (overrides && key in overrides) return overrides[key];
    return roleDefault;
  };

  return {
    role,
    isAdmin,
    isManagement,
    isPM,
    isBL,
    isWorker,
    isSubcontractor,
    isOfficeWorker,
    isLogistics,
    isPurchasing,
    isWarehouseManager,
    isOfficeStaff,

    // ===== DASHBOARD =====
    canViewAllCharts: perm("canViewAllCharts", roleDefaults.canViewAllCharts),
    canViewOwnCharts: perm("canViewOwnCharts", roleDefaults.canViewOwnCharts),
    canViewBasicStats: true,

    // ===== PROJEKTY =====
    canCreateProject: perm("canCreateProject", roleDefaults.canCreateProject),
    canEditProject: perm("canEditProject", roleDefaults.canEditProject),
    canDeleteProject: perm("canDeleteProject", roleDefaults.canDeleteProject),
    canViewAllProjects: perm("canViewAllProjects", roleDefaults.canViewAllProjects),
    canViewOnlyAssigned: !perm("canViewAllProjects", roleDefaults.canViewAllProjects),

    // ===== ZADANIA =====
    canCreateTask: perm("canCreateTask", roleDefaults.canCreateTask),
    canEditTask: perm("canEditTask", roleDefaults.canEditTask),
    canDeleteTask: perm("canDeleteTask", roleDefaults.canDeleteTask),
    canAssignTask: perm("canAssignTask", roleDefaults.canAssignTask),
    canAddTaskComments: perm("canAddTaskComments", roleDefaults.canAddTaskComments),
    canChangeTaskStatus: perm("canChangeTaskStatus", roleDefaults.canChangeTaskStatus),
    canViewTasks: true,

    // ===== CZŁONKOWIE PROJEKTU =====
    canManageMembers: perm("canManageMembers", roleDefaults.canManageMembers),
    canAddMembers: perm("canAddMembers", roleDefaults.canAddMembers),
    canRemoveMembers: perm("canRemoveMembers", roleDefaults.canRemoveMembers),

    // ===== UŻYTKOWNICY =====
    canViewUsers: perm("canViewUsers", roleDefaults.canViewUsers),
    canCreateUser: perm("canCreateUser", roleDefaults.canCreateUser),
    canEditUser: perm("canEditUser", roleDefaults.canEditUser),
    canDeleteUser: perm("canDeleteUser", roleDefaults.canDeleteUser),
    canChangeUserRole: perm("canChangeUserRole", roleDefaults.canChangeUserRole),

    // ===== PODWYKONAWCY =====
    canCreateSubcontractor: perm("canCreateSubcontractor", roleDefaults.canCreateSubcontractor),
    canManageSubcontractor: perm("canManageSubcontractor", roleDefaults.canManageSubcontractor),

    // ===== USTAWIENIA =====
    canManagePermissions: perm("canManagePermissions", roleDefaults.canManagePermissions),
    canManageGlobalSettings: perm("canManageGlobalSettings", roleDefaults.canManageGlobalSettings),
    canManageCompanySettings: perm("canManageCompanySettings", roleDefaults.canManageCompanySettings),

    // ===== GPS =====
    canViewGPS: perm("canViewGPS", roleDefaults.canViewGPS),
    canManageGPS: perm("canManageGPS", roleDefaults.canManageGPS),
    canViewGPSUsers: perm("canViewGPSUsers", roleDefaults.canViewGPSUsers),

    // ===== PLIKI =====
    canUploadFiles: perm("canUploadFiles", roleDefaults.canUploadFiles),
    canDeleteFiles: perm("canDeleteFiles", roleDefaults.canDeleteFiles),

    // ===== IMPORT =====
    canImportData: perm("canImportData", roleDefaults.canImportData),

    // ===== MAGAZYN =====
    canViewWarehouse: perm("canViewWarehouse", roleDefaults.canViewWarehouse),
    canEditWarehouse: perm("canEditWarehouse", roleDefaults.canEditWarehouse),
    canOrderMaterials: perm("canOrderMaterials", roleDefaults.canOrderMaterials),

    // ===== PLAN =====
    canViewPlan: perm("canViewPlan", roleDefaults.canViewPlan),
    canEditPlan: perm("canEditPlan", roleDefaults.canEditPlan),

    // ===== OGÓLNE =====
    canDelete: perm("canDelete", roleDefaults.canDelete),
  };
}
