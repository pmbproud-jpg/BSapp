/**
 * Behinderungsanzeige / Bedenkenanzeige — komponent zakładki w widoku projektu.
 * Lista zgłoszeń przeszkód/zastrzeżeń + formularz.
 */

import { useProjectObstructions } from "@/src/hooks/useProjectObstructions";
import type { ProjectObstruction, ProjectObstructionInsert } from "@/src/lib/supabase/database.types";
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

const emptyForm = (): Omit<ProjectObstructionInsert, "project_id"> => ({
  type: "behinderung",
  title: "",
  description: "",
  cause: "",
  consequences: "",
  cost_estimate: null,
  notes: "",
});

export default function ProjectObstructions({ projectId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc } = useTheme();

  const {
    obstructions, loading, saving,
    activeCount, escalatedCount,
    fetchObstructions, createObstruction,
    resolveObstruction, escalateObstruction, deleteObstruction,
  } = useProjectObstructions(projectId, profile?.id, t);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  useEffect(() => {
    fetchObstructions();
  }, [fetchObstructions]);

  const filteredItems = obstructions.filter((o) => {
    if (filter === "active") return o.status === "active" || o.status === "escalated";
    if (filter === "resolved") return o.status === "resolved";
    return true;
  });

  const handleCreate = async () => {
    if (!form.title.trim()) {
      const msg = t("obstructions.fillRequired") || "Bitte Titel ausfüllen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    const ok = await createObstruction(form as ProjectObstructionInsert);
    if (ok) {
      setShowModal(false);
      setForm(emptyForm());
    }
  };

  const handleResolve = (id: string) => {
    const confirm = () => resolveObstruction(id);
    if (Platform.OS === "web") {
      if (window.confirm(t("obstructions.confirmResolve") || "Behinderung als gelöst markieren?")) confirm();
    } else {
      Alert.alert(
        t("obstructions.resolve") || "Lösen",
        t("obstructions.confirmResolve") || "Behinderung als gelöst markieren?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.confirm"), onPress: confirm }]
      );
    }
  };

  const handleDelete = (id: string) => {
    const confirm = () => deleteObstruction(id);
    if (Platform.OS === "web") {
      if (window.confirm(t("obstructions.confirmDelete") || "Eintrag löschen?")) confirm();
    } else {
      Alert.alert(
        t("common.delete"),
        t("obstructions.confirmDelete") || "Eintrag löschen?",
        [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: confirm }]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "#ef4444";
      case "escalated": return "#f59e0b";
      case "resolved": return "#10b981";
      default: return "#94a3b8";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return t("obstructions.statusActive") || "Aktiv";
      case "escalated": return t("obstructions.statusEscalated") || "Eskaliert";
      case "resolved": return t("obstructions.statusResolved") || "Gelöst";
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    return type === "behinderung"
      ? (t("obstructions.typeBehinderung") || "Behinderung")
      : (t("obstructions.typeBedenken") || "Bedenken");
  };

  const renderItem = ({ item }: { item: ProjectObstruction }) => (
    <View style={[styles.itemCard, { backgroundColor: tc.card, borderColor: tc.border, borderLeftColor: getStatusColor(item.status), borderLeftWidth: 4 }]}>
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleRow}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === "behinderung" ? "#ef444420" : "#f59e0b20" }]}>
            <Ionicons
              name={item.type === "behinderung" ? "hand-left-outline" : "alert-circle-outline"}
              size={12}
              color={item.type === "behinderung" ? "#ef4444" : "#f59e0b"}
            />
            <Text style={{ fontSize: 10, fontWeight: "600", color: item.type === "behinderung" ? "#ef4444" : "#f59e0b" }}>
              {getTypeLabel(item.type)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={{ fontSize: 10, fontWeight: "600", color: getStatusColor(item.status) }}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={[styles.itemTitle, { color: tc.text }]}>{item.title}</Text>
      </View>

      {item.description ? (
        <Text style={[styles.itemDesc, { color: tc.textSecondary }]} numberOfLines={2}>{item.description}</Text>
      ) : null}

      <View style={styles.itemMeta}>
        <View style={styles.metaChip}>
          <Ionicons name="calendar-outline" size={12} color={tc.textSecondary} />
          <Text style={[styles.metaText, { color: tc.textSecondary }]}>
            {new Date(item.reported_at).toLocaleDateString("de-DE")}
          </Text>
        </View>
        {item.cost_estimate != null && item.cost_estimate > 0 && (
          <View style={styles.metaChip}>
            <Ionicons name="cash-outline" size={12} color={tc.textSecondary} />
            <Text style={[styles.metaText, { color: tc.textSecondary }]}>
              ~{item.cost_estimate.toLocaleString("de-DE")} €
            </Text>
          </View>
        )}
        {item.resolved_at && (
          <View style={styles.metaChip}>
            <Ionicons name="checkmark-circle-outline" size={12} color="#10b981" />
            <Text style={[styles.metaText, { color: "#10b981" }]}>
              {new Date(item.resolved_at).toLocaleDateString("de-DE")}
            </Text>
          </View>
        )}
      </View>

      {/* Cause / Consequences */}
      {item.cause ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: tc.textSecondary }]}>{t("obstructions.cause") || "Ursache"}:</Text>
          <Text style={[styles.detailText, { color: tc.text }]} numberOfLines={2}>{item.cause}</Text>
        </View>
      ) : null}
      {item.consequences ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: tc.textSecondary }]}>{t("obstructions.consequences") || "Folgen"}:</Text>
          <Text style={[styles.detailText, { color: tc.text }]} numberOfLines={2}>{item.consequences}</Text>
        </View>
      ) : null}

      {/* Akcje */}
      {item.status !== "resolved" && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10b981" }]} onPress={() => handleResolve(item.id)}>
            <Ionicons name="checkmark-outline" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>{t("obstructions.resolve") || "Gelöst"}</Text>
          </TouchableOpacity>
          {item.status === "active" && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#f59e0b" }]} onPress={() => escalateObstruction(item.id)}>
              <Ionicons name="arrow-up-outline" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>{t("obstructions.escalate") || "Eskalieren"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#ef4444" }]} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─── Modal formularz ───
  const renderForm = () => (
    <Modal visible={showModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: tc.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>
              {t("obstructions.new") || "Neue Meldung"}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Typ */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.type") || "Art"}</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === "behinderung" && { backgroundColor: "#ef4444", borderColor: "#ef4444" }]}
                onPress={() => setForm({ ...form, type: "behinderung" })}
              >
                <Ionicons name="hand-left-outline" size={16} color={form.type === "behinderung" ? "#fff" : tc.textSecondary} />
                <Text style={{ color: form.type === "behinderung" ? "#fff" : tc.textSecondary, fontWeight: "600", fontSize: 13 }}>
                  {t("obstructions.typeBehinderung") || "Behinderung"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === "bedenken" && { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }]}
                onPress={() => setForm({ ...form, type: "bedenken" })}
              >
                <Ionicons name="alert-circle-outline" size={16} color={form.type === "bedenken" ? "#fff" : tc.textSecondary} />
                <Text style={{ color: form.type === "bedenken" ? "#fff" : tc.textSecondary, fontWeight: "600", fontSize: 13 }}>
                  {t("obstructions.typeBedenken") || "Bedenken"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tytuł */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.titleField") || "Titel"} *</Text>
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
              placeholder={t("obstructions.titlePlaceholder") || "Kurzbeschreibung der Behinderung..."}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Opis */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.description") || "Beschreibung"}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.description || ""}
              onChangeText={(v) => setForm({ ...form, description: v })}
              multiline
              numberOfLines={3}
              placeholder={t("obstructions.descriptionPlaceholder") || "Detaillierte Beschreibung..."}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Przyczyna */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.cause") || "Ursache"}</Text>
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.cause || ""}
              onChangeText={(v) => setForm({ ...form, cause: v })}
              placeholder={t("obstructions.causePlaceholder") || "Ursache der Behinderung..."}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Konsekwencje */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.consequences") || "Folgen"}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.consequences || ""}
              onChangeText={(v) => setForm({ ...form, consequences: v })}
              multiline
              numberOfLines={3}
              placeholder={t("obstructions.consequencesPlaceholder") || "Folgen beschreiben..."}
              placeholderTextColor={tc.textSecondary}
            />

            {/* Szacowane koszty */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.costEstimate") || "Kostenschätzung (€)"}</Text>
            <TextInput
              style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.cost_estimate != null ? String(form.cost_estimate) : ""}
              onChangeText={(v) => setForm({ ...form, cost_estimate: parseFloat(v) || null })}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={tc.textSecondary}
            />

            {/* Uwagi */}
            <Text style={[styles.label, { color: tc.textSecondary }]}>{t("obstructions.notes") || "Bemerkungen"}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
              value={form.notes || ""}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              multiline
              numberOfLines={2}
              placeholderTextColor={tc.textSecondary}
            />

            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.footerBtn, { backgroundColor: tc.border }]} onPress={() => setShowModal(false)}>
              <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel") || "Abbrechen"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: "#2563eb", opacity: saving ? 0.6 : 1 }]}
              onPress={handleCreate}
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
      {/* Header z licznikami */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: tc.text }]}>
          {t("obstructions.title") || "Behinderungen & Bedenken"}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(emptyForm()); setShowModal(true); }}>
          <Ionicons name="add-circle" size={28} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Statystyki */}
      {obstructions.length > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: "#ef444420" }]}>
            <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>{activeCount}</Text>
            <Text style={{ color: "#ef4444", fontSize: 11 }}>{t("obstructions.statusActive") || "Aktiv"}</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: "#f59e0b20" }]}>
            <Text style={{ color: "#f59e0b", fontWeight: "700", fontSize: 16 }}>{escalatedCount}</Text>
            <Text style={{ color: "#f59e0b", fontSize: 11 }}>{t("obstructions.statusEscalated") || "Eskaliert"}</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: "#10b98120" }]}>
            <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 16 }}>{obstructions.length - activeCount - escalatedCount}</Text>
            <Text style={{ color: "#10b981", fontSize: 11 }}>{t("obstructions.statusResolved") || "Gelöst"}</Text>
          </View>
        </View>
      )}

      {/* Filtry */}
      {obstructions.length > 0 && (
        <View style={styles.filterRow}>
          {(["all", "active", "resolved"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === "all" ? (t("common.all") || "Alle") : f === "active" ? (t("obstructions.filterActive") || "Offen") : (t("obstructions.filterResolved") || "Gelöst")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 32 }} />
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark-outline" size={48} color={tc.textSecondary} />
          <Text style={[styles.emptyText, { color: tc.textSecondary }]}>
            {obstructions.length === 0
              ? (t("obstructions.empty") || "Keine Behinderungen oder Bedenken")
              : (t("obstructions.noResults") || "Keine Einträge für diesen Filter")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      )}

      {renderForm()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  addBtn: { padding: 4 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statChip: { flex: 1, alignItems: "center", borderRadius: 10, paddingVertical: 8 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  filterBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  filterText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  filterTextActive: { color: "#fff" },
  itemCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  itemHeader: { marginBottom: 8 },
  itemTitleRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  typeBadge: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, gap: 4 },
  statusBadge: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  itemTitle: { fontSize: 15, fontWeight: "600" },
  itemDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  itemMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
  detailRow: { marginTop: 4 },
  detailLabel: { fontSize: 11, fontWeight: "600" },
  detailText: { fontSize: 13 },
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
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  footerBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 100 },
});
