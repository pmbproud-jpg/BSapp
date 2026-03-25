/**
 * Hook zarządzający terminami VOB (Fristen-Kalender) dla projektu.
 */

import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { ProjectDeadline, ProjectDeadlineInsert } from "@/src/lib/supabase/database.types";
import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = (...args: any[]) => any;

// Predefiniowane szablony terminów VOB
export const DEADLINE_TEMPLATES: { type: string; titleKey: string; fallback: string; days: number; icon: string }[] = [
  { type: "rechnung_pruef", titleKey: "deadlines.typRechnungPruef", fallback: "Prüffrist Rechnung", days: 21, icon: "document-text-outline" },
  { type: "rechnung_zahlung", titleKey: "deadlines.typRechnungZahlung", fallback: "Zahlungsfrist", days: 21, icon: "cash-outline" },
  { type: "rechnung_nachfrist", titleKey: "deadlines.typNachfrist3", fallback: "Nachfrist Zahlung", days: 3, icon: "alarm-outline" },
  { type: "abnahme_forderung", titleKey: "deadlines.typAbnahmeForderung", fallback: "Frist förmliche Abnahme", days: 12, icon: "ribbon-outline" },
  { type: "aufmass_pruef", titleKey: "deadlines.typAufmassPruef", fallback: "Prüffrist Aufmaß", days: 7, icon: "resize-outline" },
  { type: "stundenlohn_frist", titleKey: "deadlines.typStundenlohn", fallback: "Frist Stundenlohn", days: 6, icon: "timer-outline" },
  { type: "gewaehrleistung", titleKey: "deadlines.typGewaehrleistung", fallback: "Gewährleistung", days: 1826, icon: "shield-outline" },
  { type: "custom", titleKey: "deadlines.typCustom", fallback: "Benutzerdefiniert", days: 0, icon: "create-outline" },
];

export function useProjectDeadlines(projectId: string | undefined, profileId: string | undefined, t: TFunc) {
  const [deadlines, setDeadlines] = useState<ProjectDeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDeadlines = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from("project_deadlines")
        .select("*")
        .eq("project_id", projectId)
        .order("deadline_date", { ascending: true });

      if (error) throw error;

      // Auto-update status based on dates
      const now = new Date();
      const updated = (data || []).map((d) => {
        if (d.status === "completed") return d;
        const deadline = new Date(d.deadline_date + "T23:59:59");
        const warningDate = new Date(deadline);
        warningDate.setDate(warningDate.getDate() - d.warning_days);

        if (now > deadline) return { ...d, status: "overdue" as const };
        if (now >= warningDate) return { ...d, status: "warned" as const };
        return d;
      });

      setDeadlines(updated);
    } catch (err: any) {
      console.error("fetchDeadlines error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createDeadline = async (data: ProjectDeadlineInsert): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("project_deadlines")
        .insert({
          ...data,
          project_id: projectId!,
          created_by: profileId || null,
        });

      if (error) throw error;
      await fetchDeadlines();
      return true;
    } catch (err: any) {
      console.error("createDeadline error:", err);
      const msg = t("deadlines.saveError") || "Fehler beim Speichern";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createFromTemplate = async (templateType: string, startDate: string): Promise<boolean> => {
    const template = DEADLINE_TEMPLATES.find((t) => t.type === templateType);
    if (!template) return false;

    const start = new Date(startDate + "T00:00:00");
    const deadline = new Date(start);
    deadline.setDate(deadline.getDate() + template.days);

    return createDeadline({
      project_id: projectId!,
      type: template.type,
      title: t(template.titleKey) || template.fallback,
      start_date: startDate,
      deadline_date: deadline.toISOString().split("T")[0],
      warning_days: template.days <= 7 ? 1 : template.days <= 30 ? 3 : 14,
    });
  };

  const completeDeadline = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("project_deadlines")
        .update({
          status: "completed" as const,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      await fetchDeadlines();
      return true;
    } catch (err: any) {
      console.error("completeDeadline error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteDeadline = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabaseAdmin
        .from("project_deadlines")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchDeadlines();
      return true;
    } catch (err: any) {
      console.error("deleteDeadline error:", err);
      return false;
    }
  };

  const overdueCount = deadlines.filter((d) => d.status === "overdue").length;
  const warnedCount = deadlines.filter((d) => d.status === "warned").length;
  const pendingCount = deadlines.filter((d) => d.status === "pending").length;

  return {
    deadlines,
    loading,
    saving,
    overdueCount,
    warnedCount,
    pendingCount,
    fetchDeadlines,
    createDeadline,
    createFromTemplate,
    completeDeadline,
    deleteDeadline,
  };
}
