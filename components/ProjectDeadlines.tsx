/**
 * Fristen-Kalender (Terminy VOB) — komponent zakładki w widoku projektu.
 * Szybkie tworzenie terminów z szablonów VOB + lista z countdown.
 */

import { useProjectDeadlines, DEADLINE_TEMPLATES } from "@/src/hooks/useProjectDeadlines";
import type { ProjectDeadline, ProjectDeadlineInsert } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  projectId: string;
}

export default function ProjectDeadlines({ projectId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc } = useTheme();

  const {
    deadlines, loading, saving,
    overdueCount, warnedCount,
    fetchDeadlines, createFromTemplate, createDeadline,
    completeDeadline, deleteDeadline,
  } = useProjectDeadlines(projectId, profile?.id, t);

  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [customDays, setCustomDays] = useState("");

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    if (selectedTemplate === "custom") {
      if (!customTitle.trim() || !customDays) {
        const msg = t("deadlines.fillRequired") || "Bitte Titel und Tage ausfüllen";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert(t("common.error"), msg);
        return;
      }
      const start = new Date(startDate + "T00:00:00");
      const deadline = new Date(start);
      deadline.setDate(deadline.getDate() + parseInt(customDays));
      const ok = await createDeadline({
        project_id: projectId,
        type: "custom",
        title: customTitle,
        start_date: startDate,
        deadline_date: deadline.toISOString().split("T")[0],
        warning_days: parseInt(customDays) <= 7 ? 1 : 3,
      });
      if (ok) {
        setShowModal(false);
        setCustomTitle("");
        setCustomDays("");
      }
    } else {
      const ok = await createFromTemplate(selectedTemplate, startDate);
      if (ok) setShowModal(false);
    }
  };

  const handleComplete = (id: string) => {
    const confirm = () => completeDeadline(id);
    if (Platform.OS === "web") {
      if (window.confirm(t("deadlines.confirmComplete") || "Frist als erledigt markieren?")) confirm();
    } else {
      Alert.alert(
        t("deadlines.complete") || "Erledigt",
        t("deadlines.confirmComplete") || "Frist als erledigt markieren?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.confirm"), onPress: confirm }]
      );
    }
  };

  const handleDelete = (id: string) => {
    const confirm = () => deleteDeadline(id);
    if (Platform.OS === "web") {
      if (window.confirm(t("deadlines.confirmDelete") || "Frist löschen?")) confirm();
    } else {
      Alert.alert(
        t("common.delete"),
        t("deadlines.confirmDelete") || "Frist löschen?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: confirm }]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "overdue": return "#ef4444";
      case "warned": return "#f59e0b";
      case "pending": return "#3b82f6";
      case "completed": return "#10b981";
      default: return "#94a3b8";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "overdue": return t("deadlines.statusOverdue") || "Überfällig";
      case "warned": return t("deadlines.statusWarned") || "Bald fällig";
      case "pending": return t("deadlines.statusPending") || "Offen";
      case "completed": return t("deadlines.statusCompleted") || "Erledigt";
      default: return status;
    }
  };

  const getDaysRemaining = (deadlineDate: string): number => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineDate + "T00:00:00");
    return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getTemplateIcon = (type: string): string => {
    return DEADLINE_TEMPLATES.find((t) => t.type === type)?.icon || "time-outline";
  };

  const renderItem = ({ item }: { item: ProjectDeadline }) => {
    const daysLeft = getDaysRemaining(item.deadline_date);
    const isCompleted = item.status === "completed";

    return (
      <View style={[styles.itemCard, { backgroundColor: tc.card, borderColor: tc.border, borderLeftColor: getStatusColor(item.status), borderLeftWidth: 4 }]}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Ionicons name={getTemplateIcon(item.type) as any} size={18} color={getStatusColor(item.status)} />
            <Text style={[styles.itemTitle, { color: tc.text }, isCompleted && styles.itemCompleted]}>{item.title}</Text>
          </View>
          {!isCompleted && (
            <View style={[styles.daysChip, { backgroundColor: getStatusColor(item.status) + "20" }]}>
              <Text style={[styles.daysText, { color: getStatusColor(item.status) }]}>
                {daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? t("deadlines.today") || "Heute" : `${Math.abs(daysLeft)}d!`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemMeta}>
          {item.start_date && (
            <View style={styles.metaChip}>
              <Ionicons name="play-outline" size={12} color={tc.textSecondary} />
              <Text style={[styles.metaText, { color: tc.textSecondary }]}>
                {new Date(item.start_date + "T00:00:00").toLocaleDateString("de-DE")}
              </Text>
            </View>
          )}
          <View style={styles.metaChip}>
            <Ionicons name="flag-outline" size={12} color={getStatusColor(item.status)} />
            <Text style={[styles.metaText, { color: getStatusColor(item.status), fontWeight: "600" }]}>
              {new Date(item.deadline_date + "T00:00:00").toLocaleDateString("de-DE")}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
            <Text style={{ fontSize: 10, fontWeight: "600", color: getStatusColor(item.status) }}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text style={[styles.itemDesc, { color: tc.textSecondary }]} numberOfLines={1}>{item.description}</Text>
        ) : null}

        {!isCompleted && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10b981" }]} onPress={() => handleComplete(item.id)}>
              <Ionicons name="checkmark-outline" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>{t("deadlines.complete") || "Erledigt"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#ef4444" }]} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: tc.text }]}>
          {t("deadlines.title") || "Fristen"} ({deadlines.length})
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setSelectedTemplate(null); setShowModal(true); }}>
          <Ionicons name="add-circle" size={28} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Alert jeśli są przeterminowane */}
      {overdueCount > 0 && (
        <View style={[styles.alertBar, { backgroundColor: "#ef444415", borderColor: "#ef4444" }]}>
          <Ionicons name="alert-circle" size={18} color="#ef4444" />
          <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13, flex: 1 }}>
            {overdueCount} {t("deadlines.overdueAlert") || "überfällige Frist(en)!"}
          </Text>
        </View>
      )}
      {warnedCount > 0 && overdueCount === 0 && (
        <View style={[styles.alertBar, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b" }]}>
          <Ionicons name="warning-outline" size={18} color="#f59e0b" />
          <Text style={{ color: "#f59e0b", fontWeight: "600", fontSize: 13, flex: 1 }}>
            {warnedCount} {t("deadlines.warningAlert") || "Frist(en) laufen bald ab"}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 32 }} />
      ) : deadlines.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={tc.textSecondary} />
          <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
            {t("deadlines.empty") || "Keine Fristen vorhanden"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={deadlines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      )}

      {/* Modal: wybór szablonu + data startu */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: tc.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: tc.text }]}>
                {t("deadlines.newDeadline") || "Neue Frist"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={[styles.label, { color: tc.textSecondary }]}>{t("deadlines.selectType") || "Fristtyp auswählen"}</Text>
              {DEADLINE_TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.type}
                  style={[styles.templateBtn, selectedTemplate === tmpl.type && styles.templateBtnActive]}
                  onPress={() => setSelectedTemplate(tmpl.type)}
                >
                  <Ionicons name={tmpl.icon as any} size={18} color={selectedTemplate === tmpl.type ? "#fff" : tc.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.templateLabel, { color: selectedTemplate === tmpl.type ? "#fff" : tc.text }]}>
                      {t(tmpl.titleKey) || tmpl.fallback}
                    </Text>
                    {tmpl.days > 0 && (
                      <Text style={{ fontSize: 11, color: selectedTemplate === tmpl.type ? "#ffffffaa" : tc.textSecondary }}>
                        {tmpl.days} {t("deadlines.days") || "Tage"}
                      </Text>
                    )}
                  </View>
                  {selectedTemplate === tmpl.type && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                </TouchableOpacity>
              ))}

              {selectedTemplate === "custom" && (
                <>
                  <Text style={[styles.label, { color: tc.textSecondary }]}>{t("deadlines.customTitle") || "Titel"}</Text>
                  <TextInput
                    style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    placeholder={t("deadlines.customTitlePlaceholder") || "Fristbezeichnung..."}
                    placeholderTextColor={tc.textSecondary}
                  />
                  <Text style={[styles.label, { color: tc.textSecondary }]}>{t("deadlines.customDays") || "Anzahl Tage"}</Text>
                  <TextInput
                    style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="numeric"
                    placeholder="21"
                    placeholderTextColor={tc.textSecondary}
                  />
                </>
              )}

              <Text style={[styles.label, { color: tc.textSecondary }]}>{t("deadlines.startDate") || "Startdatum (Frist beginnt)"}</Text>
              <TextInput
                style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={tc.textSecondary}
              />

              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.footerBtn, { backgroundColor: tc.border }]} onPress={() => setShowModal(false)}>
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel") || "Abbrechen"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, { backgroundColor: "#2563eb", opacity: !selectedTemplate || saving ? 0.5 : 1 }]}
                onPress={handleCreateFromTemplate}
                disabled={!selectedTemplate || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.create") || "Erstellen"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  addBtn: { padding: 4 },
  alertBar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  itemCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  itemCompleted: { textDecorationLine: "line-through", opacity: 0.5 },
  daysChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  daysText: { fontSize: 13, fontWeight: "700" },
  itemMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  itemDesc: { fontSize: 12, marginTop: 4 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalContent: { width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: 16, overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  formScroll: { paddingHorizontal: 20, paddingTop: 12 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  templateBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 6 },
  templateBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  templateLabel: { fontSize: 13, fontWeight: "600" },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  footerBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 100 },
});
