/**
 * Generic helper do subskrypcji Supabase Realtime.
 * Tworzy kanal, sluchana INSERT/UPDATE/DELETE na tabeli (z opcjonalnym filtrem),
 * przy kazdej zmianie wywoluje queryClient.invalidateQueries dla podanych kluczy.
 *
 * Faza 3.5 roadmapy: realtime po migracji wszystkich hookow na TanStack Query.
 *
 * UWAGA: Wymaga zeby tabela byla dodana do publication `supabase_realtime`.
 * Migracja: supabase/migrations/20260423_enable_realtime_publications.sql.
 *
 * Uzycie:
 *   useSupabaseRealtime({
 *     channel: `project-${projectId}-tasks`,
 *     table: "tasks",
 *     filter: `project_id=eq.${projectId}`,
 *     invalidateKeys: [projectKeys.tasks(projectId)],
 *     enabled: !!projectId,
 *   });
 */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/src/lib/supabase/client";

type RealtimeOptions = {
  /** Unikalna nazwa kanalu -- powinna zawierac np. tabele + projectId */
  channel: string;
  /** Nazwa tabeli w schema 'public' */
  table: string;
  /** Filtr Postgres -- np. "project_id=eq.UUID". Bez filtra -> wszystkie zmiany. */
  filter?: string;
  /** Klucze TanStack Query do invalidacji przy kazdej zmianie */
  invalidateKeys: QueryKey[];
  /** Wylacz subskrypcje gdy false (np. brak projectId) */
  enabled?: boolean;
};

export function useSupabaseRealtime({
  channel,
  table,
  filter,
  invalidateKeys,
  enabled = true,
}: RealtimeOptions) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const ch = supabase
      .channel(channel)
      .on(
        // Typ event w supabase-js v2 jest stringly-typed; cast bezpieczny.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          // Pojedyncza zmiana w tabeli -> invalidate wszystkich powiazanych kluczy.
          // TanStack Query domyslnie refetchuje aktywne query (te z mountowanymi hookami).
          invalidateKeys.forEach((key) => {
            qc.invalidateQueries({ queryKey: key });
          });
        },
      )
      .subscribe((status) => {
        // Loguj problem -- pomocne przy debug RLS / publication setup.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Realtime] Channel "${channel}" status: ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(ch);
    };
    // qc i invalidateKeys sa stabilne (qc z context, klucze tworzone na kazdy render
    // ale plytka stabilnosc nie szkodzi -- effect i tak resetowany na zmiane channel/filter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, filter, enabled]);
}
