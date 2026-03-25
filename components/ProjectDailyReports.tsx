/**
 * Bautagebuch (Dziennik Budowy) — komponent zakładki w widoku projektu.
 * Lista raportów dziennych + formularz dodawania/edycji.
 */

import { useDailyReports } from "@/src/hooks/useDailyReports";
import { usePermissions } from "@/src/hooks/usePermissions";
import type { DailyReport, DailyReportInsert } from "@/src/lib/supabase/database.types";
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  projectId: string;
}

const WEATHER_OPTIONS = [
  { key: "sunny", icon: "sunny-outline", label: "sonnig" },
  { key: "cloudy", icon: "cloud-outline", label: "bewölkt" },
  { key: "rainy", icon: "rainy-outline", label: "Regen" },
  { key: "snowy", icon: "snow-outline", label: "Schnee" },
  { key: "frost", icon: "thermometer-outline", label: "Frost" },
  { key: "windy", icon: "flag-outline", label: "Wind" },
];

const emptyForm = (): DailyReportInsert => ({
  project_id: "",
  report_date: new Date().toISOString().split("T")[0],
  worker_count: 0,
  worker_details: "",
  weather: "",
  temperature: "",
  work_start: "07:00",
  work_end: "16:00",
  work_description: "",
  had_disruptions: false,
  disruption_description: "",
  had_orders: false,
  order_description: "",
  had_hourly_work: false,
  hourly_work_description: "",
  hourly_work_hours: null,
  notes: "",
});

export default function ProjectDailyReports({ projectId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc } = useTheme();
  const perms = usePermissions();

  const {
    reports, loading, saving,
    fetchReports, saveReport, submitReport, approveReport, deleteReport,
  } = useDailyReports(projectId, profile?.id, t);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<DailyReportInsert>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const canApprove = perms.isAdmin || perms.isManagement || perms.isBL || perms.isPM;

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (report: DailyReport) => {
    if (report.status === "approved") return;
    setForm({
      project_id: report.project_id,
      report_date: report.report_date,
      worker_count: report.worker_count,
      worker_details: report.worker_details,
      weather: report.weather,
      temperature: report.temperature,
      work_start: report.work_start,
      work_end: report.work_end,
      work_description: report.work_description,
      had_disruptions: report.had_disruptions,
      disruption_description: report.disruption_description,
      had_orders: report.had_orders,
      order_description: report.order_description,
      had_hourly_work: report.had_hourly_work,
      hourly_work_description: report.hourly_work_description,
      hourly_work_hours: report.hourly_work_hours,
      notes: report.notes,
    });
    setEditingId(report.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.report_date || !form.work_description) {
      const msg = t("dailyReport.fillRequired") || "Bitte Datum und Arbeitsbeschreibung ausfüllen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    const ok = await saveReport(form);
    if (ok) setShowModal(false);
  };

  const handleSubmit = async (reportId: string) => {
    const confirm = () => submitReport(reportId);
    if (Platform.OS === "web") {
      if (window.confirm(t("dailyReport.confirmSubmit") || "Bericht zur Prüfung einreichen?")) confirm();
    } else {
      Alert.alert(
        t("dailyReport.submit") || "Einreichen",
        t("dailyReport.confirmSubmit") || "Bericht zur Prüfung einreichen?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.confirm"), onPress: confirm }]
      );
    }
  };

  const handleApprove = async (reportId: string) => {
    const confirm = () => approveReport(reportId);
    if (Platform.OS === "web") {
      if (window.confirm(t("dailyReport.confirmApprove") || "Bericht genehmigen?")) confirm();
    } else {
      Alert.alert(
        t("dailyReport.approve") || "Genehmigen",
        t("dailyReport.confirmApprove") || "Bericht genehmigen?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.confirm"), onPress: confirm }]
      );
    }
  };

  const handleDelete = async (reportId: string) => {
    const confirm = () => deleteReport(reportId);
    if (Platform.OS === "web") {
      if (window.confirm(t("dailyReport.confirmDelete") || "Bericht löschen?")) confirm();
    } else {
      Alert.alert(
        t("common.delete"),
        t("dailyReport.confirmDelete") || "Bericht löschen?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: confirm }]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "#f59e0b";
      case "submitted": return "#3b82f6";
      case "approved": return "#10b981";
      default: return "#94a3b8";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return t("dailyReport.statusDraft") || "Entwurf";
      case "submitted": return t("dailyReport.statusSubmitted") || "Eingereicht";
      case "approved": return t("dailyReport.statusApproved") || "Genehmigt";
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return `${days[d.getDay()]}, ${d.toLocaleDateString("de-DE")}`;
  };

  const renderReportItem = ({ item }: { item: DailyReport }) => (
    <TouchableOpacity
      style={[styles.reportCard, { backgroundColor: tc.card, borderColor: tc.border }]}
      onPress={() => openEdit(item)}
      activeOpacity={item.status === "approved" ? 1 : 0.7}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportDateRow}>
          <Ionicons name="calendar-outline" size={16} color={tc.textSecondary} />
          <Text style={[styles.reportDate, { color: tc.text }]}>{formatDate(item.report_date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      {/* Info row */}
      <View style={styles.reportInfo}>
        <View style={styles.infoChip}>
          <Ionicons name="people-outline" size={14} color={tc.textSecondary} />
          <Text style={[styles.infoText, { color: tc.textSecondary }]}>{item.worker_count} {t("dailyReport.workers") || "MA"}</Text>
        </View>
        {item.weather ? (
          <View style={styles.infoChip}>
            <Ionicons name={WEATHER_OPTIONS.find(w => w.key === item.weather)?.icon as any || "cloud-outline"} size={14} color={tc.textSecondary} />
            <Text style={[styles.infoText, { color: tc.textSecondary }]}>{item.temperature || item.weather}</Text>
          </View>
        ) : null}
        {item.work_start && item.work_end ? (
          <View style={styles.infoChip}>
            <Ionicons name="time-outline" size={14} color={tc.textSecondary} />
            <Text style={[styles.infoText, { color: tc.textSecondary }]}>{item.work_start}-{item.work_end}</Text>
          </View>
        ) : null}
      </View>

      {/* Opis prac */}
      {item.work_description ? (
        <Text style={[styles.workDesc, { color: tc.text }]} numberOfLines={2}>{item.work_description}</Text>
      ) : null}

      {/* Flagi */}
      <View style={styles.flagsRow}>
        {item.had_disruptions && (
          <View style={[styles.flagChip, { backgroundColor: "#ef444420" }]}>
            <Ionicons name="warning-outline" size={12} color="#ef4444" />
            <Text style={{ color: "#ef4444", fontSize: 11, marginLeft: 3 }}>{t("dailyReport.disruptions") || "Störungen"}</Text>
          </View>
        )}
        {item.had_orders && (
          <View style={[styles.flagChip, { backgroundColor: "#3b82f620" }]}>
            <Ionicons name="document-text-outline" size={12} color="#3b82f6" />
            <Text style={{ color: "#3b82f6", fontSize: 11, marginLeft: 3 }}>{t("dailyReport.orders") || "Anordnungen"}</Text>
          </View>
        )}
        {item.had_hourly_work && (
          <View style={[styles.flagChip, { backgroundColor: "#8b5cf620" }]}>
            <Ionicons name="timer-outline" size={12} color="#8b5cf6" />
            <Text style={{ color: "#8b5cf6", fontSize: 11, marginLeft: 3 }}>{t("dailyReport.hourlyWork") || "Stundenlohn"}</Text>
          </View>
        )}
      </View>

      {/* Akcje */}
      <View style={styles.actionsRow}>
        {item.status === "draft" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]} onPress={() => handleSubmit(item.id)}>
            <Ionicons name="send-outline" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>{t("dailyReport.submit") || "Einreichen"}</Text>
          </TouchableOpacity>
        )}
        {item.status === "submitted" && canApprove && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10b981" }]} onPress={() => handleApprove(item.id)}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>{t("dailyReport.approve") || "Genehmigen"}</Text>
          </TouchableOpacity>
        )}
        {item.status !== "approved" && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#ef4444" }]} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  // ─── Formularz w Modal ───
  const renderForm = () => (
    <Modal visible={showModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: tc.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>
              {editingId ? (t("dailyReport.edit") || "Bericht bearbeiten") : (t("dailyReport.new") || "Neuer Tagesbericht")}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Data */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("dailyReport.date") || "Datum"} *</Text>
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.report_date}
              onChangeText={(v) => setForm({ ...form, report_date: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={tc.textSecondary}
            />

            {/* Personel */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("dailyReport.workerCount") || "Anzahl Mitarbeiter"}</Text>
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={String(form.worker_count || 0)}
              onChangeText={(v) => setForm({ ...form, worker_count: parseInt(v) || 0 })}
              keyboardType="numeric"
              placeholderTextColor={tc.textSecondary}
            />
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.worker_details || ""}
              onChangeText={(v) => setForm({ ...form, worker_details: v })}
              placeholder={t("dailyReport.workerDetails") || "z.B. 3 Monteure, 1 Helfer"}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Pogoda */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("dailyReport.weather") || "Wetter"}</Text>
            <View style={styles.weatherRow}>
              {WEATHER_OPTIONS.map((w) => (
                <TouchableOpacity
                  key={w.key}
                  style={[styles.weatherBtn, form.weather === w.key && styles.weatherBtnActive]}
                  onPress={() => setForm({ ...form, weather: w.key })}
                >
                  <Ionicons name={w.icon as any} size={20} color={form.weather === w.key ? "#fff" : tc.textSecondary} />
                  <Text style={{ fontSize: 9, color: form.weather === w.key ? "#fff" : tc.textSecondary, marginTop: 2 }}>{w.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.temperature || ""}
              onChangeText={(v) => setForm({ ...form, temperature: v })}
              placeholder={t("dailyReport.temperature") || "Temperatur, z.B. 15°C"}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Godziny pracy */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("dailyReport.workHours") || "Arbeitszeiten"}</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                value={form.work_start || ""}
                onChangeText={(v) => setForm({ ...form, work_start: v })}
                placeholder="07:00"
                placeholderTextColor={tc.textSecondary}
              />
              <Text style={{ color: tc.textSecondary, marginHorizontal: 8 }}>-</Text>
              <TextInput
                style={[styles.input, styles.timeInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                value={form.work_end || ""}
                onChangeText={(v) => setForm({ ...form, work_end: v })}
                placeholder="16:00"
                placeholderTextColor={tc.textSecondary}
              />
            </View>

            {/* Opis wykonanych prac */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("dailyReport.workDescription") || "Ausgeführte Arbeiten"} *</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.work_description || ""}
              onChangeText={(v) => setForm({ ...form, work_description: v })}
              multiline
              numberOfLines={4}
              placeholder={t("dailyReport.workDescriptionPlaceholder") || "Beschreibung der ausgeführten Arbeiten..."}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Zakłócenia */}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: tc.text }]}>
                <Ionicons name="warning-outline" size={16} color="#ef4444" /> {t("dailyReport.disruptions") || "Störungen"}
              </Text>
              <Switch
                value={form.had_disruptions || false}
                onValueChange={(v) => setForm({ ...form, had_disruptions: v })}
                trackColor={{ false: tc.border, true: "#ef444480" }}
                thumbColor={form.had_disruptions ? "#ef4444" : "#f4f3f4"}
              />
            </View>
            {form.had_disruptions && (
              <TextInput
                style={[styles.input, styles.textArea, { color: tc.text, borderColor: "#ef4444", backgroundColor: tc.background }]}
                value={form.disruption_description || ""}
                onChangeText={(v) => setForm({ ...form, disruption_description: v })}
                multiline
                numberOfLines={3}
                placeholder={t("dailyReport.disruptionPlaceholder") || "Störungen beschreiben..."}
                placeholderTextColor={tc.textSecondary}
              />
            )}

            {/* Polecenia Bauleitera */}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: tc.text }]}>
                <Ionicons name="document-text-outline" size={16} color="#3b82f6" /> {t("dailyReport.ordersFromBL") || "Anordnungen Bauleiter"}
              </Text>
              <Switch
                value={form.had_orders || false}
                onValueChange={(v) => setForm({ ...form, had_orders: v })}
                trackColor={{ false: tc.border, true: "#3b82f680" }}
                thumbColor={form.had_orders ? "#3b82f6" : "#f4f3f4"}
              />
            </View>
            {form.had_orders && (
              <TextInput
                style={[styles.input, styles.textArea, { color: tc.text, borderColor: "#3b82f6", backgroundColor: tc.background }]}
                value={form.order_description || ""}
                onChangeText={(v) => setForm({ ...form, order_description: v })}
                multiline
                numberOfLines={3}
                placeholder={t("dailyReport.orderPlaceholder") || "Anordnungen beschreiben..."}
                placeholderTextColor={tc.textSecondary}
              />
            )}

            {/* Prace godzinowe */}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: tc.text }]}>
                <Ionicons name="timer-outline" size={16} color="#8b5cf6" /> {t("dailyReport.hourlyWork") || "Stundenlohnarbeiten"}
              </Text>
              <Switch
                value={form.had_hourly_work || false}
                onValueChange={(v) => setForm({ ...form, had_hourly_work: v })}
                trackColor={{ false: tc.border, true: "#8b5cf680" }}
                thumbColor={form.had_hourly_work ? "#8b5cf6" : "#f4f3f4"}
              />
            </View>
            {form.had_hourly_work && (
              <>
                <TextInput
                  style={[styles.input, styles.textArea, { color: tc.text, borderColor: "#8b5cf6", backgroundColor: tc.background }]}
                  value={form.hourly_work_description || ""}
                  onChangeText={(v) => setForm({ ...form, hourly_work_description: v })}
                  multiline
                  numberOfLines={3}
                  placeholder={t("dailyReport.hourlyWorkPlaceholder") || "Stundenlohnarbeiten beschreiben..."}
                  placeholderTextColor={tc.textSecondary}
                />
                <TextInput
                  style={[styles.input, { color: tc.text, borderColor: "#8b5cf6", backgroundColor: tc.background }]}
                  value={form.hourly_work_hours != null ? String(form.hourly_work_hours) : ""}
                  onChangeText={(v) => setForm({ ...form, hourly_work_hours: parseFloat(v) || null })}
                  keyboardType="numeric"
                  placeholder={t("dailyReport.hours") || "Stunden (z.B. 4.5)"}
                  placeholderTextColor={tc.textSecondary}
                />
              </>
            )}

            {/* Uwagi */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("dailyReport.notes") || "Bemerkungen"}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.notes || ""}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
              numberOfLines={3}
              placeholder={t("dailyReport.notesPlaceholder") || "Sonstige Bemerkungen..."}
              placeholderTextColor={tc.textSecondary}
            />

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Przyciski */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.footerBtn, { backgroundColor: tc.border }]} onPress={() => setShowModal(false)}>
              <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel") || "Abbrechen"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: "#2563eb", opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save") || "Speichern"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header z przyciskiem dodawania */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: tc.text }]}>
          {t("dailyReport.title") || "Bautagebuch"} ({reports.length})
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add-circle" size={28} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 32 }} />
      ) : reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={tc.textSecondary} />
          <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
            {t("dailyReport.empty") || "Noch keine Tagesberichte vorhanden"}
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 4 }}>
              {t("dailyReport.createFirst") || "Ersten Bericht erstellen"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          scrollEnabled={false}
        />
      )}

      {renderForm()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  addBtn: {
    padding: 4,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reportDate: {
    fontSize: 15,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  reportInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: 12,
  },
  workDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  flagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeInput: {
    flex: 1,
  },
  weatherRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  weatherBtn: {
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minWidth: 48,
  },
  weatherBtnActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
});
