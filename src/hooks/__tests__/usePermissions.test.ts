/**
 * Test usePermissions -- core security logic BSapp.
 *
 * 10 rol × ~40 permissions = 400 mozliwych kombinacji. Test pokrywa:
 *   1. getRoleDefaults -- czysta funkcja, po 1 charakterystycznym permission per rola
 *   2. usePermissions hook -- mock useAuth, 5 scenariuszy:
 *      a) admin dostaje wszystko
 *      b) worker ma ograniczone
 *      c) subcontractor nie widzi userow
 *      d) custom_permissions override domyslnych z roli
 *      e) brak profile -> default "worker"
 *
 * Faza 4 commit 3.
 */
import { renderHook } from "@testing-library/react-native";
import { getRoleDefaults, usePermissions, type RoleName } from "../usePermissions";

// Mock useAuth -- usePermissions czyta tylko profile (role + custom_permissions)
const mockProfile: { current: { role?: string; custom_permissions?: Record<string, boolean> | null } | null } = {
  current: null,
};

jest.mock("@/src/providers/AuthProvider", () => ({
  useAuth: () => ({ profile: mockProfile.current }),
}));

beforeEach(() => {
  mockProfile.current = null;
});

// ============================================================
// Czesc 1: getRoleDefaults -- czysta funkcja
// ============================================================

describe("getRoleDefaults", () => {
  it("admin dostaje wszystko (full power)", () => {
    const p = getRoleDefaults("admin");
    // Sprawdz po jednym z kazdej kategorii
    expect(p.canCreateProject).toBe(true);
    expect(p.canDeleteUser).toBe(true);
    expect(p.canManagePermissions).toBe(true);
    expect(p.canViewGPS).toBe(true);
    expect(p.canManageGlobalSettings).toBe(true);
  });

  it("management ma wszystko oprocz tego co tylko admin", () => {
    const p = getRoleDefaults("management");
    expect(p.canCreateProject).toBe(true);
    expect(p.canEditUser).toBe(true);
    expect(p.canViewGPS).toBe(true);
    // Tylko admin:
    expect(p.canDeleteUser).toBe(false);
    expect(p.canChangeUserRole).toBe(false);
    expect(p.canManagePermissions).toBe(false);
    expect(p.canManageGlobalSettings).toBe(false);
  });

  it("project_manager widzi wszystko oprocz GPS, edytuje projekty", () => {
    const p = getRoleDefaults("project_manager");
    expect(p.canCreateProject).toBe(true);
    expect(p.canEditProject).toBe(true);
    expect(p.canCreateTask).toBe(true);
    expect(p.canEditTask).toBe(true);
    expect(p.canViewGPS).toBe(false);
    expect(p.canManagePermissions).toBe(false);
    expect(p.canDeleteProject).toBe(false);
  });

  it("bauleiter tworzy zadania, nie edytuje projektow ani usuwa", () => {
    const p = getRoleDefaults("bauleiter");
    expect(p.canCreateTask).toBe(true);
    expect(p.canAssignTask).toBe(true);
    expect(p.canViewWarehouse).toBe(true);
    expect(p.canViewGPS).toBe(false);
    expect(p.canCreateProject).toBe(false);
    expect(p.canEditProject).toBe(false);
    expect(p.canEditWarehouse).toBe(false);
    expect(p.canDeleteTask).toBe(false);
  });

  it("worker -- dodaje uwagi, zmienia status zadan, uploaduje pliki", () => {
    const p = getRoleDefaults("worker");
    expect(p.canAddTaskComments).toBe(true);
    expect(p.canChangeTaskStatus).toBe(true);
    expect(p.canUploadFiles).toBe(true);
    expect(p.canUseVoiceReport).toBe(true);
    // Worker NIE moze:
    expect(p.canCreateTask).toBe(false);
    expect(p.canEditProject).toBe(false);
    expect(p.canViewGPS).toBe(false);
    expect(p.canManagePermissions).toBe(false);
  });

  it("subcontractor -- najmniej uprawnien, nie widzi nawet uzytkownikow", () => {
    const p = getRoleDefaults("subcontractor");
    expect(p.canViewUsers).toBe(false);
    expect(p.canCreateTask).toBe(false);
    expect(p.canEditProject).toBe(false);
    expect(p.canViewGPS).toBe(false);
    expect(p.canViewWarehouse).toBe(false);
    expect(p.canEditPlan).toBe(false);
  });

  it("office_worker -- widzi wszystko poza GPS, nic nie edytuje", () => {
    const p = getRoleDefaults("office_worker");
    expect(p.canViewAllProjects).toBe(true);
    expect(p.canViewWarehouse).toBe(true);
    expect(p.canViewPlan).toBe(true);
    expect(p.canViewGPS).toBe(false);
    expect(p.canEditProject).toBe(false);
    expect(p.canEditWarehouse).toBe(false);
    expect(p.canEditPlan).toBe(false);
  });

  it("logistics -- read-only + wyjatek: edycja planu tygodniowego + import", () => {
    const p = getRoleDefaults("logistics");
    expect(p.canEditPlan).toBe(true);
    expect(p.canImportData).toBe(true);
    expect(p.canViewAllProjects).toBe(true);
    expect(p.canEditProject).toBe(false);
    expect(p.canEditWarehouse).toBe(false);
    expect(p.canViewGPS).toBe(false);
  });

  it("purchasing -- read-only + wyjatek: pelne uprawnienia magazynu", () => {
    const p = getRoleDefaults("purchasing");
    expect(p.canEditWarehouse).toBe(true);
    expect(p.canOrderMaterials).toBe(true);
    expect(p.canImportData).toBe(true);
    expect(p.canEditProject).toBe(false);
    expect(p.canEditPlan).toBe(false);
    expect(p.canViewGPS).toBe(false);
  });

  it("warehouse_manager -- jak purchasing (pelny magazyn, reszta read-only)", () => {
    const p = getRoleDefaults("warehouse_manager");
    expect(p.canEditWarehouse).toBe(true);
    expect(p.canOrderMaterials).toBe(true);
    expect(p.canImportData).toBe(true);
    expect(p.canEditProject).toBe(false);
    expect(p.canEditPlan).toBe(false);
    expect(p.canViewGPS).toBe(false);
  });

  // Sanity: nieznana rola NIE crashuje (zwraca obiekt z samymi false)
  it("nieznana rola -- wszystkie permissions false (defense)", () => {
    const p = getRoleDefaults("invalid_role" as RoleName);
    expect(p.canCreateProject).toBe(false);
    expect(p.canViewGPS).toBe(false);
    expect(p.canViewWarehouse).toBe(false);
  });
});

// ============================================================
// Czesc 2: usePermissions hook -- z mockiem useAuth
// ============================================================

describe("usePermissions hook", () => {
  it("admin: dostaje wszystkie permissions", () => {
    mockProfile.current = { role: "admin", custom_permissions: null };
    const { result } = renderHook(() => usePermissions());
    expect(result.current.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canCreateProject).toBe(true);
    expect(result.current.canManagePermissions).toBe(true);
    expect(result.current.canViewGPS).toBe(true);
  });

  it("worker: ograniczone permissions, isWorker true", () => {
    mockProfile.current = { role: "worker", custom_permissions: null };
    const { result } = renderHook(() => usePermissions());
    expect(result.current.role).toBe("worker");
    expect(result.current.isWorker).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canAddTaskComments).toBe(true);
    expect(result.current.canChangeTaskStatus).toBe(true);
    expect(result.current.canCreateTask).toBe(false);
    expect(result.current.canManagePermissions).toBe(false);
  });

  it("subcontractor: canViewUsers=false (nie widzi listy)", () => {
    mockProfile.current = { role: "subcontractor", custom_permissions: null };
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canViewUsers).toBe(false);
    expect(result.current.canViewWarehouse).toBe(false);
  });

  it("custom_permissions nadpisuje domyslne z roli (admin tracaca permissions)", () => {
    // Edge case: admin z explicit false na canDeleteUser w custom_permissions
    mockProfile.current = {
      role: "admin",
      custom_permissions: { canDeleteUser: false, canManagePermissions: false },
    };
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAdmin).toBe(true);
    // Override:
    expect(result.current.canDeleteUser).toBe(false);
    expect(result.current.canManagePermissions).toBe(false);
    // Inne admin permissions nadal true (nie zostaly nadpisane):
    expect(result.current.canCreateProject).toBe(true);
    expect(result.current.canViewGPS).toBe(true);
  });

  it("custom_permissions moze tez ZWIEKSZYC uprawnienia worker-a", () => {
    // Worker z permission na tworzenie zadan (rzadki przypadek, ale possible)
    mockProfile.current = {
      role: "worker",
      custom_permissions: { canCreateTask: true, canCreateProject: true },
    };
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isWorker).toBe(true);
    // Override:
    expect(result.current.canCreateTask).toBe(true);
    expect(result.current.canCreateProject).toBe(true);
    // Reszta worker defaults zachowana:
    expect(result.current.canManagePermissions).toBe(false);
    expect(result.current.canViewGPS).toBe(false);
  });

  it("brak profile -> default 'worker' (defensive fallback)", () => {
    mockProfile.current = null;
    const { result } = renderHook(() => usePermissions());
    expect(result.current.role).toBe("worker");
    expect(result.current.isWorker).toBe(true);
    expect(result.current.canCreateTask).toBe(false);
  });

  it("isOfficeStaff grupuje office_worker + logistics + purchasing", () => {
    for (const r of ["office_worker", "logistics", "purchasing"] as const) {
      mockProfile.current = { role: r, custom_permissions: null };
      const { result } = renderHook(() => usePermissions());
      expect(result.current.isOfficeStaff).toBe(true);
    }
    // warehouse_manager NIE jest w grupie isOfficeStaff
    mockProfile.current = { role: "warehouse_manager", custom_permissions: null };
    const { result: wm } = renderHook(() => usePermissions());
    expect(wm.current.isOfficeStaff).toBe(false);
    // worker tez nie
    mockProfile.current = { role: "worker", custom_permissions: null };
    const { result: w } = renderHook(() => usePermissions());
    expect(w.current.isOfficeStaff).toBe(false);
  });

  it("canViewBasicStats jest true dla KAZDEJ roli (hardcoded constant)", () => {
    const roles: RoleName[] = [
      "admin", "management", "project_manager", "bauleiter", "worker",
      "subcontractor", "office_worker", "logistics", "purchasing", "warehouse_manager",
    ];
    for (const role of roles) {
      mockProfile.current = { role, custom_permissions: null };
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewBasicStats).toBe(true);
    }
  });
});
