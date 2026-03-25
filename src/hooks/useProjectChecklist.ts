/**
 * Hook zarządzający checklistą dokumentów projektu (Vollständigkeitsprüfung).
 * Jeden checklist per projekt — upsert.
 */

import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { ProjectChecklist } from "@/src/lib/supabase/database.types";
import { useState, useCallback } from "react";

export function useProjectChecklist(projectId: string | undefined, profileId: string | undefined) {
  const [checklist, setChecklist] = useState<ProjectChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchChecklist = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from("project_checklists")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      setChecklist(data || null);
    } catch (err: any) {
      console.error("fetchChecklist error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const saveChecklist = async (updates: Partial<ProjectChecklist>): Promise<boolean> => {
    if (!projectId) return false;
    setSaving(true);
    try {
      const payload = {
        ...updates,
        project_id: projectId,
        updated_by: profileId || null,
      };

      const { error } = await supabaseAdmin
        .from("project_checklists")
        .upsert(payload, { onConflict: "project_id" });

      if (error) throw error;
      await fetchChecklist();
      return true;
    } catch (err: any) {
      console.error("saveChecklist error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (field: keyof ProjectChecklist, currentValue: boolean): Promise<boolean> => {
    return saveChecklist({ [field]: !currentValue });
  };

  // Oblicz postęp
  const getProgress = (): { checked: number; total: number; percent: number } => {
    if (!checklist) return { checked: 0, total: 14, percent: 0 };
    const fields: (keyof ProjectChecklist)[] = [
      "has_calculations", "has_fire_protection", "has_floor_plans", "has_sections",
      "has_schematics", "has_calculations_match", "has_afu", "has_material_list",
      "has_montage_plan", "has_operating_manuals", "has_revision_docs",
      "has_acceptance_protocol", "has_collisions",
    ];
    const total = fields.length;
    const checked = fields.filter((f) => checklist[f] === true).length;
    return { checked, total, percent: Math.round((checked / total) * 100) };
  };

  // Generuj listę braków (Shitlist)
  const getMissingItems = (): string[] => {
    if (!checklist) return [];
    const items: { field: keyof ProjectChecklist; label: string }[] = [
      { field: "has_calculations", label: "Berechnungen" },
      { field: "has_fire_protection", label: "Brandschutzkonzept" },
      { field: "has_floor_plans", label: "Grundrisse" },
      { field: "has_sections", label: "Schnitte" },
      { field: "has_schematics", label: "Schemata" },
      { field: "has_calculations_match", label: "Berechnungen ↔ Plan" },
      { field: "has_afu", label: "Ausführungsunterlagen" },
      { field: "has_material_list", label: "Materialliste" },
      { field: "has_montage_plan", label: "Montageplanung" },
      { field: "has_operating_manuals", label: "Betriebs-/Wartungsanleitungen" },
      { field: "has_revision_docs", label: "Revisionsunterlagen" },
      { field: "has_acceptance_protocol", label: "Abnahmeprotokoll" },
    ];
    return items.filter((i) => checklist[i.field] !== true).map((i) => i.label);
  };

  return {
    checklist,
    loading,
    saving,
    fetchChecklist,
    saveChecklist,
    toggleItem,
    getProgress,
    getMissingItems,
  };
}
