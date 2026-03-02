/**
 * Serwis profilów — współdzielone operacje na tabeli profiles.
 * Używany w wielu komponentach zamiast duplikowania zapytań.
 */

import { adminApi } from "@/src/lib/supabase/adminApi";

/**
 * Pobiera mapę id → full_name dla podanych user IDs.
 * Wzorzec używany w: projects/[id], plan, magazyn, tasks/[id].
 */
export async function fetchProfileMap(
  userIds: string[]
): Promise<Record<string, string>> {
  if (!userIds.length) return {};
  const { data: profiles } = await (adminApi.from("profiles") as any)
    .select("id, full_name")
    .in("id", userIds);
  const map: Record<string, string> = {};
  (profiles || []).forEach((p: any) => {
    map[p.id] = p.full_name || "";
  });
  return map;
}

/**
 * Pobiera listę profili z id, full_name, email dla podanych IDs.
 * Posortowane po full_name.
 */
export async function fetchProfilesByIds(
  userIds: string[],
  select: string = "id, full_name, email"
): Promise<any[]> {
  if (!userIds.length) return [];
  const { data } = await (adminApi.from("profiles") as any)
    .select(select)
    .in("id", userIds)
    .order("full_name");
  return data || [];
}

/**
 * Pobiera wszystkich pracowników (id, full_name, role), posortowanych po nazwisku.
 */
export async function fetchAllWorkers(): Promise<any[]> {
  const { data } = await (adminApi.from("profiles") as any)
    .select("id, full_name, role")
    .order("full_name");
  return data || [];
}

/**
 * Pobiera wszystkich użytkowników (id, full_name), posortowanych po nazwisku.
 * Filtruje tych bez full_name.
 */
export async function fetchAllUsers(): Promise<{ id: string; full_name: string }[]> {
  const { data } = await (adminApi.from("profiles") as any)
    .select("id, full_name")
    .order("full_name");
  return (data || [])
    .filter((u: any) => u.full_name)
    .map((u: any) => ({ id: u.id, full_name: u.full_name || "" }));
}
