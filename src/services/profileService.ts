/**
 * Serwis profilów — współdzielone operacje na tabeli profiles.
 * Używany w wielu komponentach zamiast duplikowania zapytań.
 */

import { adminApi } from "@/src/lib/supabase/adminApi";
import type { Profile } from "@/src/types";

type ProfileBasic = Pick<Profile, "id" | "full_name">;
type ProfileWithRole = Pick<Profile, "id" | "full_name" | "role">;
type ProfileWithEmail = Pick<Profile, "id" | "full_name" | "email">;

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
  ((profiles || []) as ProfileBasic[]).forEach((p) => {
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
): Promise<ProfileWithEmail[]> {
  if (!userIds.length) return [];
  const { data } = await (adminApi.from("profiles") as any)
    .select(select)
    .in("id", userIds)
    .order("full_name");
  return (data || []) as ProfileWithEmail[];
}

/**
 * Pobiera wszystkich pracowników (id, full_name, role), posortowanych po nazwisku.
 */
export async function fetchAllWorkers(): Promise<ProfileWithRole[]> {
  const { data } = await (adminApi.from("profiles") as any)
    .select("id, full_name, role")
    .order("full_name");
  return (data || []) as ProfileWithRole[];
}

/**
 * Pobiera wszystkich użytkowników (id, full_name), posortowanych po nazwisku.
 * Filtruje tych bez full_name.
 */
export async function fetchAllUsers(): Promise<{ id: string; full_name: string }[]> {
  const { data } = await (adminApi.from("profiles") as any)
    .select("id, full_name")
    .order("full_name");
  return ((data || []) as ProfileBasic[])
    .filter((u) => u.full_name)
    .map((u) => ({ id: u.id, full_name: u.full_name || "" }));
}
