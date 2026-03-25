/**
 * Checklista dokumentów projektu (Vollständigkeitsprüfung + Shitlist).
 * Komponent zakładki w widoku projektu.
 */

import { useProjectChecklist } from "@/src/hooks/useProjectChecklist";
import type { ProjectChecklist as ChecklistType } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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

type CheckField = {
  field: keyof ChecklistType;
  labelKey: string;
  fallback: string;
  icon: string;
  category: "technical" | "execution" | "acceptance";
};

const CHECKLIST_ITEMS: CheckField[] = [
  // Technische Dokumente
  { field: "has_calculations", labelKey: "checklist.calculations", fallback: "Berechnungen vorhanden", icon: "calculator-outline", category: "technical" },
  { field: "has_fire_protection", labelKey: "checklist.fireProtection", fallback: "Brandschutzkonzept", icon: "flame-outline", category: "technical" },
  { field: "has_floor_plans", labelKey: "checklist.floorPlans", fallback: "Grundrisse vorhanden", icon: "map-outline", category: "technical" },
  { field: "has_sections", labelKey: "checklist.sections", fallback: "Schnitte vorhanden", icon: "cut-outline", category: "technical" },
  { field: "has_schematics", labelKey: "checklist.schematics", fallback: "Schemata beschriftet", icon: "git-branch-outline", category: "technical" },
  { field: "has_calculations_match", labelKey: "checklist.calculationsMatch", fallback: "Berechnungen ↔ Planangaben", icon: "checkmark-done-outline", category: "technical" },
  // Ausführung
  { field: "has_afu", labelKey: "checklist.afu", fallback: "Ausführungsunterlagen (AFU)", icon: "document-outline", category: "execution" },
  { field: "has_material_list", labelKey: "checklist.materialList", fallback: "Materialliste aus LV", icon: "list-outline", category: "execution" },
  { field: "has_montage_plan", labelKey: "checklist.montagePlan", fallback: "Montageplanung", icon: "construct-outline", category: "execution" },
  { field: "has_collisions", labelKey: "checklist.collisions", fallback: "Kollisionen geprüft", icon: "alert-circle-outline", category: "execution" },
  // Abnahme
  { field: "has_operating_manuals", labelKey: "checklist.operatingManuals", fallback: "Betriebs-/Wartungsanleitungen", icon: "book-outline", category: "acceptance" },
  { field: "has_revision_docs", labelKey: "checklist.revisionDocs", fallback: "Revisionsunterlagen", icon: "folder-outline", category: "acceptance" },
  { field: "has_acceptance_protocol", labelKey: "checklist.acceptanceProtocol", fallback: "Abnahmeprotokoll", icon: "ribbon-outline", category: "acceptance" },
];

const CATEGORIES = [
  { key: "technical", labelKey: "checklist.catTechnical", fallback: "Technische Dokumente", color: "#3b82f6" },
  { key: "execution", labelKey: "checklist.catExecution", fallback: "Ausführung", color: "#f59e0b" },
  { key: "acceptance", labelKey: "checklist.catAcceptance", fallback: "Abnahme & Übergabe", color: "#10b981" },
];

export default function ProjectChecklist({ projectId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc } = useTheme();

  const {
    checklist, loading, saving,
    fetchChecklist, saveChecklist, toggleItem,
    getProgress, getMissingItems,
  } = useProjectChecklist(projectId, profile?.id);

  const [showShitlist, setShowShitlist] = useState(false);
  const [shitlistNotes, setShitlistNotes] = useState("");
  const [collisionNotes, setCollisionNotes] = useState("");

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  useEffect(() => {
    if (checklist) {
      setShitlistNotes(checklist.shitlist_notes || "");
      setCollisionNotes(checklist.collision_notes || "");
    }
  }, [checklist]);

  const progress = getProgress();
  const missingItems = getMissingItems();

  const handleToggle = async (field: keyof ChecklistType) => {
    const current = checklist ? (checklist[field] as boolean) : false;
    await toggleItem(field, current);
  };

  const handleSaveNotes = async () => {
    await saveChecklist({
      shitlist_notes: shitlistNotes,
      collision_notes: collisionNotes,
    });
  };

  if (loading && !checklist) {
    return <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 32 }} />;
  }

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={[styles.progressCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: tc.text }]}>
            {t("checklist.progress") || "Fortschritt"}
          </Text>
          <Text style={[styles.progressPercent, { color: progress.percent === 100 ? "#10b981" : "#f59e0b" }]}>
            {progress.checked}/{progress.total} ({progress.percent}%)
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: tc.border }]}>
          <View style={[styles.progressFill, { width: `${progress.percent}%`, backgroundColor: progress.percent === 100 ? "#10b981" : "#2563eb" }]} />
        </View>
      </View>

      {/* Kategorie z checkboxami */}
      {CATEGORIES.map((cat) => {
        const items = CHECKLIST_ITEMS.filter((i) => i.category === cat.key);
        return (
          <View key={cat.key} style={[styles.categoryCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <View style={[styles.categoryHeader, { borderBottomColor: cat.color + "40" }]}>
              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.categoryTitle, { color: tc.text }]}>
                {t(cat.labelKey) || cat.fallback}
              </Text>
            </View>
            {items.map((item) => {
              const checked = checklist ? (checklist[item.field] as boolean) : false;
              return (
                <TouchableOpacity
                  key={item.field}
                  style={styles.checkRow}
                  onPress={() => handleToggle(item.field)}
                  disabled={saving}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Ionicons name={item.icon as any} size={18} color={checked ? "#10b981" : tc.textSecondary} style={{ marginRight: 8 }} />
                  <Text style={[styles.checkLabel, { color: checked ? tc.text : tc.textSecondary }, checked && styles.checkLabelChecked]}>
                    {t(item.labelKey) || item.fallback}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      {/* Kolizje - notatki */}
      {checklist?.has_collisions && (
        <View style={[styles.notesCard, { backgroundColor: tc.card, borderColor: "#f59e0b" }]}>
          <Text style={[styles.notesLabel, { color: tc.text }]}>
            <Ionicons name="alert-circle-outline" size={14} color="#f59e0b" /> {t("checklist.collisionNotes") || "Kollisionen / Anmerkungen"}
          </Text>
          <TextInput
            style={[styles.notesInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
            value={collisionNotes}
            onChangeText={setCollisionNotes}
            onBlur={handleSaveNotes}
            multiline
            numberOfLines={3}
            placeholder={t("checklist.collisionPlaceholder") || "Kollisionen beschreiben..."}
            placeholderTextColor={tc.textSecondary}
          />
        </View>
      )}

      {/* Shitlist */}
      <TouchableOpacity
        style={[styles.shitlistBtn, { backgroundColor: missingItems.length > 0 ? "#ef4444" : "#10b981" }]}
        onPress={() => setShowShitlist(!showShitlist)}
      >
        <Ionicons name={missingItems.length > 0 ? "alert-outline" : "checkmark-circle-outline"} size={18} color="#fff" />
        <Text style={styles.shitlistBtnText}>
          {missingItems.length > 0
            ? `${t("checklist.shitlist") || "Shitlist"}: ${missingItems.length} ${t("checklist.missing") || "fehlend"}`
            : (t("checklist.allComplete") || "Alle Dokumente vorhanden")}
        </Text>
      </TouchableOpacity>

      {showShitlist && missingItems.length > 0 && (
        <View style={[styles.shitlistCard, { backgroundColor: tc.card, borderColor: "#ef4444" }]}>
          <Text style={[styles.shitlistTitle, { color: "#ef4444" }]}>
            {t("checklist.missingDocs") || "Fehlende Dokumente:"}
          </Text>
          {missingItems.map((item, i) => (
            <View key={i} style={styles.shitlistItem}>
              <Ionicons name="close-circle" size={14} color="#ef4444" />
              <Text style={[styles.shitlistItemText, { color: tc.text }]}>{item}</Text>
            </View>
          ))}
          <Text style={[styles.notesLabel, { color: tc.text, marginTop: 12 }]}>
            {t("checklist.shitlistNotes") || "Notizen für AG:"}
          </Text>
          <TextInput
            style={[styles.notesInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
            value={shitlistNotes}
            onChangeText={setShitlistNotes}
            onBlur={handleSaveNotes}
            multiline
            numberOfLines={3}
            placeholder={t("checklist.shitlistPlaceholder") || "Notizen für den Auftraggeber..."}
            placeholderTextColor={tc.textSecondary}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  categoryCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb20",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  checkLabel: {
    fontSize: 14,
    flex: 1,
  },
  checkLabelChecked: {
    fontWeight: "500",
  },
  notesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  shitlistBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 10,
  },
  shitlistBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  shitlistCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  shitlistTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  shitlistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  shitlistItemText: {
    fontSize: 13,
  },
});
