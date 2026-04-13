import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase/client";
import { useTranslation } from "react-i18next";

export type PlanSuggestion = {
  day: string;
  worker_id: string;
  worker_name: string;
  project_id: string;
  project_name: string;
  reason: string;
};

export type SmartPlanResult = {
  suggestions: PlanSuggestion[];
  warnings: string[];
  summary: string;
  weekStart: string;
  generatedAt: string;
  stats: {
    projects: number;
    workers: number;
    absences: number;
    urgentTasks: number;
  };
};

const SMART_PLAN_URL =
  Platform.OS === "web"
    ? "/.netlify/functions/ai-smart-plan"
    : `${process.env.EXPO_PUBLIC_APP_URL || "https://bsapp-management.netlify.app"}/.netlify/functions/ai-smart-plan`;

export function useSmartPlan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartPlanResult | null>(null);
  const { i18n } = useTranslation();

  const generatePlan = useCallback(async (weekStart: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";

      const response = await fetch(SMART_PLAN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ weekStart, language: i18n.language }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      setResult(data as SmartPlanResult);
      return data as SmartPlanResult;
    } catch (e: any) {
      setError(e.message || "Failed to generate plan");
      return null;
    } finally {
      setLoading(false);
    }
  }, [i18n.language]);

  const clearPlan = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, error, result, generatePlan, clearPlan };
}
