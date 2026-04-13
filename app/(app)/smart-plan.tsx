import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { useSmartPlan, PlanSuggestion } from "@/src/hooks/useSmartPlan";
import { Ionicons } from "@expo/vector-icons";

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

const DAY_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b"];

function SuggestionCard({ item, index, colors, t }: { item: PlanSuggestion; index: number; colors: any; t: any }) {
  const dayColor = DAY_COLORS[new Date(item.day).getDay() % DAY_COLORS.length];
  const dayName = new Date(item.day).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit" });

  return (
    <View style={[styles.suggCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: dayColor, borderLeftWidth: 3 }]}>
      <View style={styles.suggHeader}>
        <View style={[styles.dayBadge, { backgroundColor: dayColor + "18" }]}>
          <Text style={[styles.dayText, { color: dayColor }]}>{dayName}</Text>
        </View>
      </View>
      <View style={styles.suggBody}>
        <View style={styles.suggRow}>
          <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.suggWorker, { color: colors.text }]}>{item.worker_name}</Text>
        </View>
        <View style={styles.suggRow}>
          <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.suggProject, { color: colors.text }]}>{item.project_name}</Text>
        </View>
        <Text style={[styles.suggReason, { color: colors.textSecondary }]}>{item.reason}</Text>
      </View>
    </View>
  );
}

export default function SmartPlanScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { loading, error, result, generatePlan, clearPlan } = useSmartPlan();
  const [weekStart, setWeekStart] = useState(getNextMonday);

  const handleGenerate = () => generatePlan(weekStart);

  // Group suggestions by day
  const groupedByDay = result?.suggestions.reduce<Record<string, PlanSuggestion[]>>((acc, s) => {
    (acc[s.day] = acc[s.day] || []).push(s);
    return acc;
  }, {}) || {};

  const sortedDays = Object.keys(groupedByDay).sort();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Ionicons name="calendar" size={28} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{t("smart_plan.title")}</Text>
      </View>

      {!result ? (
        <>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {t("smart_plan.description")}
          </Text>

          {/* Week selector */}
          <View style={[styles.weekRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>
              {t("smart_plan.week_start")}:
            </Text>
            <TextInput
              style={[styles.weekInput, { color: colors.text }]}
              value={weekStart}
              onChangeText={setWeekStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              maxLength={10}
            />
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: loading ? colors.border : colors.primary }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.generateText}>{t("smart_plan.generating")}</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.generateText}>{t("smart_plan.generate")}</Text>
              </>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBar}>
              <Ionicons name="warning" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, { backgroundColor: "#eff6ff" }]}>
              <Text style={[styles.statValue, { color: "#3b82f6" }]}>{result.stats.projects}</Text>
              <Text style={styles.statLabel}>{t("predictions.total_projects")}</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: "#f0fdf4" }]}>
              <Text style={[styles.statValue, { color: "#22c55e" }]}>{result.stats.workers}</Text>
              <Text style={styles.statLabel}>{t("smart_plan.workers")}</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: "#fef2f2" }]}>
              <Text style={[styles.statValue, { color: "#ef4444" }]}>{result.stats.urgentTasks}</Text>
              <Text style={styles.statLabel}>{t("smart_plan.urgent_tasks")}</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: "#fff7ed" }]}>
              <Text style={[styles.statValue, { color: "#f59e0b" }]}>{result.stats.absences}</Text>
              <Text style={styles.statLabel}>{t("smart_plan.absences")}</Text>
            </View>
          </View>

          {/* Summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bulb-outline" size={16} color="#f59e0b" />
            <Text style={[styles.summaryText, { color: colors.text }]}>{result.summary}</Text>
          </View>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <View style={[styles.warningsCard, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              {result.warnings.map((w, i) => (
                <View key={i} style={styles.warningRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#f59e0b" />
                  <Text style={styles.warningText}>{w}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Suggestions grouped by day */}
          {sortedDays.map((day) => (
            <View key={day}>
              {groupedByDay[day].map((s, i) => (
                <SuggestionCard key={`${s.worker_id}-${day}`} item={s} index={i} colors={colors} t={t} />
              ))}
            </View>
          ))}

          {result.suggestions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t("smart_plan.no_suggestions")}</Text>
            </View>
          )}

          {/* New plan button */}
          <TouchableOpacity
            style={[styles.newPlanBtn, { borderColor: colors.primary }]}
            onPress={clearPlan}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={[styles.newPlanText, { color: colors.primary }]}>{t("smart_plan.new_plan")}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  weekRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  weekLabel: { fontSize: 14 },
  weekInput: { fontSize: 14, flex: 1, padding: 0 },
  generateBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    borderRadius: 12, paddingVertical: 14, gap: 8,
  },
  generateText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorBar: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8, backgroundColor: "#fef2f2", borderRadius: 8, marginTop: 12 },
  errorText: { fontSize: 13, color: "#ef4444", flex: 1 },
  statsRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  statBadge: { flex: 1, borderRadius: 8, padding: 10, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 10, color: "#64748b", marginTop: 1 },
  summaryCard: {
    flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, alignItems: "flex-start",
  },
  summaryText: { fontSize: 14, lineHeight: 20, flex: 1 },
  warningsCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, gap: 6 },
  warningRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  warningText: { fontSize: 13, color: "#92400e", flex: 1, lineHeight: 18 },
  suggCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  suggHeader: { marginBottom: 6 },
  dayBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  dayText: { fontSize: 12, fontWeight: "700" },
  suggBody: { gap: 4 },
  suggRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  suggWorker: { fontSize: 14, fontWeight: "600" },
  suggProject: { fontSize: 14 },
  suggReason: { fontSize: 12, marginTop: 4, lineHeight: 16, fontStyle: "italic" },
  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 14 },
  newPlanBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderRadius: 12, paddingVertical: 12, marginTop: 8, gap: 6,
  },
  newPlanText: { fontSize: 15, fontWeight: "600" },
});
