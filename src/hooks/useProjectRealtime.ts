/**
 * Realtime subskrypcje dla widoku projektu (projects/[id].tsx).
 * Sluchana zmian w tabelach powiazanych z projektem i invaliduje
 * odpowiednie klucze TanStack Query.
 *
 * Uzycie:
 *   useProjectRealtime(projectId);
 *
 * Faza 3.5 roadmapy.
 */
import { useSupabaseRealtime } from "./useSupabaseRealtime";
import { projectKeys } from "./useProjectData";
import { projectMembersKey } from "./useProjectMembers";
import { projectOrdersKeys } from "./useProjectOrders";

export function useProjectRealtime(projectId: string | undefined) {
  const enabled = !!projectId;
  const safeId = projectId ?? "";
  const filter = `project_id=eq.${safeId}`;

  // Zmiana w samym projekcie (nazwa, PM, BL, status)
  useSupabaseRealtime({
    channel: `project-${safeId}-details`,
    table: "projects",
    filter: `id=eq.${safeId}`,
    invalidateKeys: [projectKeys.details(safeId)],
    enabled,
  });

  // Zadania w projekcie
  useSupabaseRealtime({
    channel: `project-${safeId}-tasks`,
    table: "tasks",
    filter,
    invalidateKeys: [projectKeys.tasks(safeId)],
    enabled,
  });

  // Czlonkowie projektu
  useSupabaseRealtime({
    channel: `project-${safeId}-members`,
    table: "project_members",
    filter,
    invalidateKeys: [projectMembersKey(safeId)],
    enabled,
  });

  // Zalaczniki (loose + folders -- ta sama tabela project_attachments)
  useSupabaseRealtime({
    channel: `project-${safeId}-attachments`,
    table: "project_attachments",
    filter,
    invalidateKeys: [projectKeys.attachments(safeId)],
    enabled,
  });

  // Foldery zalacznikow
  useSupabaseRealtime({
    channel: `project-${safeId}-folders`,
    table: "attachment_folders",
    filter,
    invalidateKeys: [projectKeys.folders(safeId)],
    enabled,
  });

  // Zamowienia materialowe per projekt
  useSupabaseRealtime({
    channel: `project-${safeId}-material-orders`,
    table: "project_material_orders",
    filter,
    invalidateKeys: [projectOrdersKeys.materialOrders(safeId)],
    enabled,
  });

  // Zamowienia narzedziowe per projekt
  useSupabaseRealtime({
    channel: `project-${safeId}-tool-orders`,
    table: "project_tool_orders",
    filter,
    invalidateKeys: [projectOrdersKeys.toolOrders(safeId)],
    enabled,
  });
}
