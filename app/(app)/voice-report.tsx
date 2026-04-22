import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useTheme, type ThemeColors } from "@/src/providers/ThemeProvider";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useVoiceReport } from "@/src/hooks/useVoiceReport";
import { supabase } from "@/src/lib/supabase/client";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

// ─── Recording Timer Display ───

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ─── Language flag helper ───

function langLabel(code: string): string {
  const map: Record<string, string> = {
    de: "Deutsch",
    pl: "Polski",
    en: "English",
    tr: "Türkçe",
    ru: "Русский",
    uk: "Українська",
    ro: "Română",
    ar: "العربية",
    unknown: "?",
  };
  return map[code] || code.toUpperCase();
}

// ─── Extracted data display ───

function ExtractedDataView({
  data,
  colors,
  t,
}: {
  data: NonNullable<import("@/src/hooks/useVoiceReport").VoiceReportResult["extracted_data"]>;
  colors: ThemeColors;
  t: TFunction;
}) {
  return (
    <View style={[styles.extractedContainer, { borderColor: colors.border }]}>
      <Text style={[styles.extractedTitle, { color: colors.primary }]}>
        {t("voice_report.extracted_data")}
      </Text>

      {data.tasks.length > 0 && (
        <View style={styles.extractedSection}>
          <Text style={[styles.extractedLabel, { color: colors.textSecondary }]}>
            {t("voice_report.tasks_performed")}
          </Text>
          {data.tasks.map((task, i) => (
            <View key={i} style={styles.extractedRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
              <Text style={[styles.extractedText, { color: colors.text }]}>
                {task.description}
                {task.quantity ? ` — ${task.quantity} ${task.unit}` : ""}
                {task.location ? ` (${task.location})` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.materials.length > 0 && (
        <View style={styles.extractedSection}>
          <Text style={[styles.extractedLabel, { color: colors.textSecondary }]}>
            {t("voice_report.materials_used")}
          </Text>
          {data.materials.map((mat, i) => (
            <View key={i} style={styles.extractedRow}>
              <Ionicons name="cube-outline" size={14} color="#3b82f6" />
              <Text style={[styles.extractedText, { color: colors.text }]}>
                {mat.name}{mat.quantity ? ` — ${mat.quantity}` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.issues.length > 0 && (
        <View style={styles.extractedSection}>
          <Text style={[styles.extractedLabel, { color: colors.textSecondary }]}>
            {t("voice_report.issues")}
          </Text>
          {data.issues.map((issue, i) => (
            <View key={i} style={styles.extractedRow}>
              <Ionicons name="warning-outline" size={14} color="#f59e0b" />
              <Text style={[styles.extractedText, { color: colors.text }]}>{issue}</Text>
            </View>
          ))}
        </View>
      )}

      {data.work_hours && (
        <View style={styles.extractedRow}>
          <Ionicons name="time-outline" size={14} color="#8b5cf6" />
          <Text style={[styles.extractedText, { color: colors.text }]}>
            {t("voice_report.work_hours")}: {data.work_hours}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ───

export default function VoiceReportScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [editingDe, setEditingDe] = useState(false);
  const [editedReportDe, setEditedReportDe] = useState("");
  const [editingOrig, setEditingOrig] = useState(false);
  const [editedReportOrig, setEditedReportOrig] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"de" | "original">("de");

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const {
    state,
    error,
    result,
    recordingDuration,
    startRecording,
    stopAndProcess,
    cancelRecording,
    clearResult,
  } = useVoiceReport(selectedProjectId, selectedProject?.name);

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

  // Sync edited text when result arrives
  useEffect(() => {
    if (result) {
      setEditedReportDe(result.report_de);
      setEditedReportOrig(result.report_original);
    }
  }, [result]);

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleNewRecording = () => {
    clearResult();
    setEditingDe(false);
    setEditingOrig(false);
    setEditedReportDe("");
    setEditedReportOrig("");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="mic" size={28} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{t("voice_report.title")}</Text>
      </View>

      {/* Project selector */}
      <TouchableOpacity
        style={[styles.projectSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowProjectPicker(!showProjectPicker)}
      >
        <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.projectText, { color: colors.text }]} numberOfLines={1}>
          {selectedProject?.name || t("reports.select_project")}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
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

      {/* ─── Recording Section ─── */}
      {!result && (
        <View style={styles.recordingSection}>
          {state === "idle" && (
            <>
              <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                {t("voice_report.instruction")}
              </Text>
              <TouchableOpacity
                style={[styles.recordButton, { backgroundColor: "#ef4444" }]}
                onPress={startRecording}
              >
                <Ionicons name="mic" size={48} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.recordLabel, { color: colors.textMuted }]}>
                {t("voice_report.tap_to_record")}
              </Text>
            </>
          )}

          {state === "recording" && (
            <>
              <View style={styles.pulseContainer}>
                <View style={[styles.pulseOuter, { borderColor: "#ef4444" }]} />
                <View style={[styles.recordButton, { backgroundColor: "#ef4444" }]}>
                  <Ionicons name="mic" size={48} color="#fff" />
                </View>
              </View>
              <Text style={[styles.timerText, { color: colors.text }]}>
                {formatDuration(recordingDuration)}
              </Text>
              <Text style={[styles.recordingHint, { color: "#ef4444" }]}>
                {t("voice_report.recording")}
              </Text>

              <View style={styles.recordActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.border }]}
                  onPress={cancelRecording}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
                  onPress={stopAndProcess}
                >
                  <Ionicons name="checkmark" size={22} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>{t("voice_report.stop_and_process")}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {state === "processing" && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.processingText, { color: colors.text }]}>
                {t("voice_report.processing")}
              </Text>
              <Text style={[styles.processingHint, { color: colors.textSecondary }]}>
                {t("voice_report.processing_steps")}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBar}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ─── Result Section ─── */}
      {result && (
        <>
          {/* Transcription */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="ear-outline" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t("voice_report.transcription")}
              </Text>
              <View style={[styles.langBadge, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.langBadgeText, { color: colors.primary }]}>
                  {langLabel(result.detected_language)}
                </Text>
              </View>
            </View>
            <Text style={[styles.transcriptionText, { color: colors.textSecondary }]}>
              "{result.transcription}"
            </Text>
          </View>

          {/* Report tabs: DE / Original */}
          <View style={[styles.tabBar, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "de" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab("de")}
            >
              <Text style={[styles.tabText, { color: activeTab === "de" ? colors.primary : colors.textMuted }]}>
                Deutsch (DE)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "original" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab("original")}
            >
              <Text style={[styles.tabText, { color: activeTab === "original" ? colors.primary : colors.textMuted }]}>
                {langLabel(result.detected_language)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* DE Report */}
          {activeTab === "de" && (
            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.reportCardHeader}>
                <Text style={[styles.reportLabel, { color: colors.text }]}>
                  {t("voice_report.report_de")}
                </Text>
                <View style={styles.reportActions}>
                  <TouchableOpacity onPress={() => setEditingDe(!editingDe)}>
                    <Ionicons name={editingDe ? "checkmark" : "create-outline"} size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleCopy(editedReportDe, "DE")}>
                    <Ionicons name={copyFeedback === "DE" ? "checkmark" : "copy-outline"} size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              {editingDe ? (
                <TextInput
                  style={[styles.editInput, { color: colors.text, borderColor: colors.border }]}
                  value={editedReportDe}
                  onChangeText={setEditedReportDe}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                <Text style={[styles.reportText, { color: colors.text }]} selectable>
                  {editedReportDe}
                </Text>
              )}
            </View>
          )}

          {/* Original language report */}
          {activeTab === "original" && (
            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.reportCardHeader}>
                <Text style={[styles.reportLabel, { color: colors.text }]}>
                  {t("voice_report.report_original")} ({langLabel(result.detected_language)})
                </Text>
                <View style={styles.reportActions}>
                  <TouchableOpacity onPress={() => setEditingOrig(!editingOrig)}>
                    <Ionicons name={editingOrig ? "checkmark" : "create-outline"} size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleCopy(editedReportOrig, "ORIG")}>
                    <Ionicons name={copyFeedback === "ORIG" ? "checkmark" : "copy-outline"} size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              {editingOrig ? (
                <TextInput
                  style={[styles.editInput, { color: colors.text, borderColor: colors.border }]}
                  value={editedReportOrig}
                  onChangeText={setEditedReportOrig}
                  multiline
                  textAlignVertical="top"
                />
              ) : (
                <Text style={[styles.reportText, { color: colors.text }]} selectable>
                  {editedReportOrig}
                </Text>
              )}
            </View>
          )}

          {/* Extracted structured data */}
          {result.extracted_data && (
            <ExtractedDataView data={result.extracted_data} colors={colors} t={t} />
          )}

          {/* Meta info */}
          <View style={[styles.metaRow, { borderColor: colors.border }]}>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {t("voice_report.worker")}: {result.worker} | {new Date(result.generatedAt).toLocaleString()}
              {result.duration ? ` | ${Math.round(result.duration)}s audio` : ""}
            </Text>
          </View>

          {/* New recording button */}
          <TouchableOpacity
            style={[styles.newRecordingBtn, { backgroundColor: colors.primary }]}
            onPress={handleNewRecording}
          >
            <Ionicons name="mic" size={20} color="#fff" />
            <Text style={styles.newRecordingText}>{t("voice_report.new_recording")}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  projectSelector: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8, marginBottom: 16,
  },
  projectText: { flex: 1, fontSize: 15 },
  dropdown: {
    borderWidth: 1, borderRadius: 10, marginTop: -12, marginBottom: 12,
    maxHeight: 200, elevation: 3,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  dropdownText: { fontSize: 14 },

  // Recording
  recordingSection: { alignItems: "center", paddingVertical: 32 },
  instruction: { fontSize: 15, textAlign: "center", marginBottom: 24, lineHeight: 22, paddingHorizontal: 16 },
  recordButton: { width: 96, height: 96, borderRadius: 48, justifyContent: "center", alignItems: "center", elevation: 4 },
  recordLabel: { marginTop: 12, fontSize: 14 },
  pulseContainer: { position: "relative", width: 120, height: 120, justifyContent: "center", alignItems: "center" },
  pulseOuter: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 3, opacity: 0.4 },
  timerText: { fontSize: 36, fontWeight: "700", marginTop: 16, fontVariant: ["tabular-nums"] },
  recordingHint: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  recordActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { fontSize: 14, fontWeight: "600" },

  // Processing
  processingContainer: { alignItems: "center", paddingVertical: 40 },
  processingText: { fontSize: 17, fontWeight: "600", marginTop: 16 },
  processingHint: { fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 18 },

  // Error
  errorBar: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8, backgroundColor: "#fef2f2", borderRadius: 8, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#ef4444", flex: 1 },

  // Result cards
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  langBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  langBadgeText: { fontSize: 11, fontWeight: "700" },
  transcriptionText: { fontSize: 14, fontStyle: "italic", lineHeight: 20 },

  // Tabs
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 0 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },

  // Report card
  reportCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 0, marginBottom: 12, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  reportCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  reportLabel: { fontSize: 13, fontWeight: "700" },
  reportActions: { flexDirection: "row", gap: 12 },
  reportText: { fontSize: 14, lineHeight: 22 },
  editInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, lineHeight: 22, minHeight: 200, maxHeight: 400 },

  // Extracted data
  extractedContainer: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  extractedTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  extractedSection: { marginBottom: 10 },
  extractedLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  extractedRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4, paddingLeft: 4 },
  extractedText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // Meta
  metaRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginBottom: 16 },
  metaText: { fontSize: 11, textAlign: "center" },

  // New recording
  newRecordingBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 12, paddingVertical: 14, gap: 8 },
  newRecordingText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
