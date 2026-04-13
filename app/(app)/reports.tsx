import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { useAutoReport, ReportType } from "@/src/hooks/useAutoReport";
import { supabase } from "@/src/lib/supabase/client";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

// ─── Report Type Config ───

const REPORT_TYPES: { type: ReportType; icon: string; color: string }[] = [
  { type: "daily", icon: "today-outline", color: "#3b82f6" },
  { type: "weekly", icon: "calendar-outline", color: "#8b5cf6" },
  { type: "monthly", icon: "stats-chart-outline", color: "#06b6d4" },
  { type: "safety", icon: "shield-checkmark-outline", color: "#ef4444" },
];

// ─── Report Type Card ───

function ReportTypeCard({
  type,
  icon,
  color,
  selected,
  onPress,
  colors,
  t,
}: {
  type: ReportType;
  icon: string;
  color: string;
  selected: boolean;
  onPress: () => void;
  colors: any;
  t: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.typeCard,
        {
          backgroundColor: selected ? color + "12" : colors.surface,
          borderColor: selected ? color : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View style={[styles.typeIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.typeName, { color: colors.text }]}>
        {t(`reports.${type}`)}
      </Text>
      <Text style={[styles.typeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
        {t(`reports.${type}_desc`)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Task Stats Mini Chart ───

function TaskStatsBar({
  stats,
  colors,
  t,
}: {
  stats: { total: number; completed: number; in_progress: number; todo: number; blocked: number; completion_rate: number };
  colors: any;
  t: any;
}) {
  if (stats.total === 0) return null;
  const segments = [
    { count: stats.completed, color: "#22c55e", label: "completed" },
    { count: stats.in_progress, color: "#3b82f6", label: "in_progress" },
    { count: stats.todo, color: "#94a3b8", label: "todo" },
    { count: stats.blocked, color: "#ef4444", label: "blocked" },
  ];

  return (
    <View style={[styles.statsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statsHeader}>
        <Text style={[styles.statsTitle, { color: colors.text }]}>
          {t("reports.task_stats")}
        </Text>
        <Text style={[styles.statsRate, { color: "#22c55e" }]}>
          {stats.completion_rate}% {t("reports.completion")}
        </Text>
      </View>
      <View style={styles.progressBar}>
        {segments.map((s) =>
          s.count > 0 ? (
            <View
              key={s.label}
              style={[styles.progressSegment, { flex: s.count, backgroundColor: s.color }]}
            />
          ) : null
        )}
      </View>
      <View style={styles.statsLegend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              {s.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ───

export default function ReportsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { loading, error, report, generateReport, clearReport } = useAutoReport();

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedType, setSelectedType] = useState<ReportType>("daily");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Load projects
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["planning", "active", "on_hold"])
        .order("name") as { data: { id: string; name: string }[] | null };
      if (data) {
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      }
    }
    load();
  }, []);

  const handleGenerate = async () => {
    if (!selectedProjectId) {
      if (Platform.OS === "web") window.alert(t("reports.no_project"));
      else Alert.alert(t("common.error"), t("reports.no_project"));
      return;
    }
    const result = await generateReport(selectedProjectId, selectedType);
    if (result) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const handleCopy = async () => {
    if (!report?.report) return;
    await Clipboard.setStringAsync(report.report);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleNewReport = () => {
    clearReport();
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="document-text" size={28} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{t("reports.title")}</Text>
      </View>

      {!report ? (
        <>
          {/* Project selector */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t("reports.select_project")}
          </Text>
          <TouchableOpacity
            style={[styles.projectSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowProjectPicker(!showProjectPicker)}
          >
            <Ionicons name="briefcase-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.projectText, { color: colors.text }]} numberOfLines={1}>
              {selectedProject?.name || t("reports.select_project")}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showProjectPicker && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {projects.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.dropdownItem, selectedProjectId === p.id && { backgroundColor: colors.primary + "15" }]}
                  onPress={() => { setSelectedProjectId(p.id); setShowProjectPicker(false); }}
                >
                  <Text style={[styles.dropdownText, { color: colors.text }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Report type selection */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>
            {t("reports.select_type")}
          </Text>
          <View style={styles.typeGrid}>
            {REPORT_TYPES.map((rt) => (
              <ReportTypeCard
                key={rt.type}
                type={rt.type}
                icon={rt.icon}
                color={rt.color}
                selected={selectedType === rt.type}
                onPress={() => setSelectedType(rt.type)}
                colors={colors}
                t={t}
              />
            ))}
          </View>

          {/* Generate button */}
          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: loading ? colors.border : colors.primary }]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.generateText}>{t("reports.generating")}</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.generateText}>{t("reports.generate")}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Error */}
          {error && (
            <View style={styles.errorBar}>
              <Ionicons name="warning" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          {/* Report result */}
          <View style={[styles.reportHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.reportMeta}>
              <Text style={[styles.reportProjectName, { color: colors.text }]}>
                {report.projectName}
              </Text>
              <Text style={[styles.reportType, { color: colors.primary }]}>
                {t(`reports.${report.reportType}`)}
              </Text>
            </View>
            <View style={styles.reportMetaRow}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {t("reports.generated_at")}: {new Date(report.generatedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.reportMetaRow}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {t("reports.generated_by")}: {report.generatedBy}
              </Text>
            </View>

            {report.taskStats && (
              <TaskStatsBar stats={report.taskStats} colors={colors} t={t} />
            )}
          </View>

          {/* Report content */}
          <View style={[styles.reportContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.reportText, { color: colors.text }]} selectable>
              {report.report}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleCopy}
            >
              <Ionicons name={copyFeedback ? "checkmark" : "copy-outline"} size={18} color="#fff" />
              <Text style={styles.actionButtonText}>
                {copyFeedback ? t("reports.copied") : t("reports.copy")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.textSecondary }]}
              onPress={handleNewReport}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>{t("reports.new_report")}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "700" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  projectSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  projectText: { flex: 1, fontSize: 15 },
  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 200,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  dropdownText: { fontSize: 14 },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  typeName: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  typeDesc: { fontSize: 11, textAlign: "center", marginTop: 4, lineHeight: 15 },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    gap: 8,
  },
  generateText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: { fontSize: 13, color: "#ef4444", flex: 1 },
  reportHeader: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportProjectName: { fontSize: 17, fontWeight: "700", flex: 1 },
  reportType: { fontSize: 13, fontWeight: "600" },
  reportMetaRow: { marginBottom: 2 },
  metaText: { fontSize: 12 },
  statsContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  statsTitle: { fontSize: 12, fontWeight: "600" },
  statsRate: { fontSize: 13, fontWeight: "700" },
  progressBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    gap: 2,
  },
  progressSegment: { borderRadius: 4 },
  statsLegend: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  reportContent: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reportText: {
    fontSize: 14,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  actionButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
