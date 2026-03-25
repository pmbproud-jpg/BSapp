/**
 * Hook zarządzający danymi Bautagebuch (dziennik budowy) dla projektu.
 * CRUD wpisów dziennych + zatwierdzanie.
 */

import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { DailyReport, DailyReportInsert, DailyReportUpdate } from "@/src/lib/supabase/database.types";
import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = (...args: any[]) => any;

export function useDailyReports(projectId: string | undefined, profileId: string | undefined, t: TFunc) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from("daily_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("report_date", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("fetchReports error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const saveReport = async (report: DailyReportInsert): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("daily_reports")
        .upsert(
          { ...report, project_id: projectId!, created_by: profileId || null },
          { onConflict: "project_id,report_date" }
        );

      if (error) throw error;
      await fetchReports();
      return true;
    } catch (err: any) {
      console.error("saveReport error:", err);
      const msg = t("dailyReport.saveError") || "Fehler beim Speichern";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitReport = async (reportId: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("daily_reports")
        .update({ status: "submitted" as const })
        .eq("id", reportId);

      if (error) throw error;
      await fetchReports();
      return true;
    } catch (err: any) {
      console.error("submitReport error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const approveReport = async (reportId: string): Promise<boolean> => {
    if (!profileId) return false;
    setSaving(true);
    try {
      const { error } = await supabaseAdmin
        .from("daily_reports")
        .update({
          status: "approved" as const,
          approved_by: profileId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (error) throw error;
      await fetchReports();
      return true;
    } catch (err: any) {
      console.error("approveReport error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (reportId: string): Promise<boolean> => {
    try {
      const { error } = await supabaseAdmin
        .from("daily_reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;
      await fetchReports();
      return true;
    } catch (err: any) {
      console.error("deleteReport error:", err);
      return false;
    }
  };

  return {
    reports,
    loading,
    saving,
    fetchReports,
    saveReport,
    submitReport,
    approveReport,
    deleteReport,
  };
}
