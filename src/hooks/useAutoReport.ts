import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase/client";
import { useTranslation } from "react-i18next";

export type ReportType = "daily" | "weekly" | "monthly" | "safety";

export type GeneratedReport = {
  report: string;
  reportType: ReportType;
  projectName: string;
  generatedAt: string;
  generatedBy: string;
  taskStats: {
    total: number;
    todo: number;
    in_progress: number;
    completed: number;
    blocked: number;
    completion_rate: number;
  };
};

const REPORT_URL =
  Platform.OS === "web"
    ? "/.netlify/functions/ai-report"
    : `${process.env.EXPO_PUBLIC_APP_URL || "https://bsapp-management.netlify.app"}/.netlify/functions/ai-report`;

export function useAutoReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const { i18n } = useTranslation();

  const generateReport = useCallback(
    async (projectId: string, reportType: ReportType) => {
      setLoading(true);
      setError(null);
      setReport(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || "";

        const response = await fetch(REPORT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId,
            reportType,
            language: i18n.language,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        setReport(result as GeneratedReport);
        return result as GeneratedReport;
      } catch (err: any) {
        const msg = err.message || "Report generation failed";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [i18n.language]
  );

  const clearReport = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    report,
    generateReport,
    clearReport,
  };
}
