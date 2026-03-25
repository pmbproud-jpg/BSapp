/**
 * Hook zarządzający Behinderungsanzeige / Bedenkenanzeige dla projektu.
 */

import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { ProjectObstruction, ProjectObstructionInsert } from "@/src/lib/supabase/database.types";
import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = (...args: any[]) => any;

export function useProjectObstructions(projectId: string | undefined, profileId: string | undefined, t: TFunc) {
  const [obstructions, setObstructions] = useState<ProjectObstruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchObstructions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from("project_obstructions")
        .select("*")
        .eq("project_id", projectId)
        .order("reported_at", { ascending: false });

      if (error) throw error;
      setObstructions(data || []);
    } catch (err: any) {
      console.error("fetchObstructions error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createObstruction = async (data: ProjectObstructionInsert): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("project_obstructions")
        .insert({
          ...data,
          project_id: projectId!,
          reported_by: profileId || null,
        });

      if (error) throw error;
      await fetchObstructions();
      return true;
    } catch (err: any) {
      console.error("createObstruction error:", err);
      const msg = t("obstructions.saveError") || "Fehler beim Speichern";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const resolveObstruction = async (id: string): Promise<boolean> => {
    if (!profileId) return false;
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("project_obstructions")
        .update({
          status: "resolved" as const,
          resolved_by: profileId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      await fetchObstructions();
      return true;
    } catch (err: any) {
      console.error("resolveObstruction error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const escalateObstruction = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("project_obstructions")
        .update({ status: "escalated" as const })
        .eq("id", id);

      if (error) throw error;
      await fetchObstructions();
      return true;
    } catch (err: any) {
      console.error("escalateObstruction error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteObstruction = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabaseAdmin
        .from("project_obstructions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchObstructions();
      return true;
    } catch (err: any) {
      console.error("deleteObstruction error:", err);
      return false;
    }
  };

  const activeCount = obstructions.filter((o) => o.status === "active").length;
  const escalatedCount = obstructions.filter((o) => o.status === "escalated").length;

  return {
    obstructions,
    loading,
    saving,
    activeCount,
    escalatedCount,
    fetchObstructions,
    createObstruction,
    resolveObstruction,
    escalateObstruction,
    deleteObstruction,
  };
}
