/**
 * Modal edycji zadania (title, description, status, priority, assigned_to, due_date).
 * Zawiera tlumaczenie PL<->DE z translateText hook.
 * Wydzielony z tasks/[id].tsx (Faza 2 step 1).
 */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { translateText } from "@/src/hooks/useAutoTranslate";

import { styles } from "./styles";

type ProfileLite = { id: string; full_name: string | null; email?: string };

type EditForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string[];
  due_date: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  editSaving: boolean;
  onSave: () => void;
  planUsers: ProfileLite[];
  projectUsers: ProfileLite[];
  users: ProfileLite[];
};

export function EditTaskModal({
  visible, onClose, editForm, setEditForm, editSaving, onSave,
  planUsers, projectUsers, users,
}: Props) {
  const { t } = useTranslation();

  // Translation state — modal-local, resetowany przy kazdym otwarciu modalu
  const [editTranslating, setEditTranslating] = useState(false);
  const [editTranslatedTitle, setEditTranslatedTitle] = useState("");
  const [editTranslatedDesc, setEditTranslatedDesc] = useState("");
  const [editTranslateDir, setEditTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("tasks.edit")}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("tasks.title")} *</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.title}
                onChangeText={(v) => setEditForm({ ...editForm, title: v })}
                placeholder={t("tasks.title_placeholder")}
                placeholderTextColor="#94a3b8"
                maxLength={300}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("tasks.description")}</Text>
              <TextInput
                style={[styles.editInput, { minHeight: 80, textAlignVertical: "top" }]}
                value={editForm.description}
                onChangeText={(v) => setEditForm({ ...editForm, description: v })}
                placeholder={t("tasks.description_placeholder")}
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={5000}
              />
            </View>

            {/* Auto-translate PL↔DE */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Ionicons name="language" size={18} color="#64748b" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>Übersetzen</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: editTranslateDir === "pl|de" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                  onPress={() => { setEditTranslateDir("pl|de"); setEditTranslatedTitle(""); setEditTranslatedDesc(""); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: editTranslateDir === "pl|de" ? "#fff" : "#64748b" }}>PL → DE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: editTranslateDir === "de|pl" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                  onPress={() => { setEditTranslateDir("de|pl"); setEditTranslatedTitle(""); setEditTranslatedDesc(""); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: editTranslateDir === "de|pl" ? "#fff" : "#64748b" }}>DE → PL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                  onPress={async () => {
                    setEditTranslating(true);
                    setEditTranslatedTitle(""); setEditTranslatedDesc("");
                    try {
                      if (editForm.title.trim()) {
                        const r = await translateText(editForm.title, editTranslateDir);
                        setEditTranslatedTitle(r);
                      }
                      if (editForm.description.trim()) {
                        const r = await translateText(editForm.description, editTranslateDir);
                        setEditTranslatedDesc(r);
                      }
                    } catch (e) { console.error("Translation error:", e); }
                    finally { setEditTranslating(false); }
                  }}
                  disabled={editTranslating || (!editForm.title.trim() && !editForm.description.trim())}
                >
                  {editTranslating ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Ionicons name="swap-horizontal" size={16} color="#2563eb" />
                  )}
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563eb" }}>Übersetzen</Text>
                </TouchableOpacity>
              </View>
              {(editTranslatedTitle || editTranslatedDesc) ? (
                <View style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
                  {editTranslatedTitle ? (
                    <View style={{ marginBottom: editTranslatedDesc ? 6 : 0 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                        {editTranslateDir === "pl|de" ? "Titel (DE):" : "Tytuł (PL):"}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#166534" }}>{editTranslatedTitle}</Text>
                    </View>
                  ) : null}
                  {editTranslatedDesc ? (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                        {editTranslateDir === "pl|de" ? "Beschreibung (DE):" : "Opis (PL):"}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#166534" }}>{editTranslatedDesc}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#16a34a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                    onPress={() => {
                      const newTitle = editTranslatedTitle ? `${editForm.title}\n${editTranslateDir === "pl|de" ? "[DE]" : "[PL]"} ${editTranslatedTitle}` : editForm.title;
                      const newDesc = editTranslatedDesc ? `${editForm.description}\n\n${editTranslateDir === "pl|de" ? "[DE]" : "[PL]"} ${editTranslatedDesc}` : editForm.description;
                      setEditForm({ ...editForm, title: newTitle, description: newDesc });
                      setEditTranslatedTitle(""); setEditTranslatedDesc("");
                    }}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>Übersetzung einfügen</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("tasks.statusLabel")}</Text>
              <View style={styles.editChips}>
                {["todo", "in_progress", "completed", "blocked"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.editChip, editForm.status === s && styles.editChipActive]}
                    onPress={() => setEditForm({ ...editForm, status: s })}
                  >
                    <Text style={[styles.editChipText, editForm.status === s && styles.editChipTextActive]}>
                      {t(`tasks.status.${s}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("tasks.priorityLabel")}</Text>
              <View style={styles.editChips}>
                {["low", "medium", "high"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.editChip, editForm.priority === p && styles.editChipActive, editForm.priority === p && p === "high" && { backgroundColor: "#dc2626", borderColor: "#dc2626" }]}
                    onPress={() => setEditForm({ ...editForm, priority: p })}
                  >
                    <Text style={[styles.editChipText, editForm.priority === p && styles.editChipTextActive]}>
                      {t(`tasks.priority.${p}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("tasks.assigned_to")} ({editForm.assigned_to.length})</Text>
              <TouchableOpacity
                style={[styles.editChip, editForm.assigned_to.length === 0 && styles.editChipActive, { alignSelf: "flex-start", marginBottom: 8 }]}
                onPress={() => setEditForm({ ...editForm, assigned_to: [] })}
              >
                <Text style={[styles.editChipText, editForm.assigned_to.length === 0 && styles.editChipTextActive]}>— {t("common.none")}</Text>
              </TouchableOpacity>

              {planUsers.length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#10b981", marginBottom: 4, textTransform: "uppercase" }}>
                    {t("plan.workers_from_plan")}
                  </Text>
                  {planUsers.map((u) => {
                    const sel = editForm.assigned_to.includes(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.editChip, sel && styles.editChipActive, { borderColor: "#10b981", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }]}
                        onPress={() => {
                          const next = sel ? editForm.assigned_to.filter((x: string) => x !== u.id) : [...editForm.assigned_to, u.id];
                          setEditForm({ ...editForm, assigned_to: next });
                        }}
                      >
                        <Ionicons name={sel ? "checkbox" : "square-outline"} size={18} color={sel ? "#2563eb" : "#94a3b8"} />
                        <Text style={[styles.editChipText, sel && styles.editChipTextActive]} numberOfLines={1}>
                          {u.full_name || u.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: 8 }} />
                </>
              )}

              {projectUsers.length > 0 && (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>
                    {t("tasks.project_members", "Członkowie projektu")}
                  </Text>
                  {projectUsers.map((u) => {
                    const sel = editForm.assigned_to.includes(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.editChip, sel && styles.editChipActive, { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }]}
                        onPress={() => {
                          const next = sel ? editForm.assigned_to.filter((x: string) => x !== u.id) : [...editForm.assigned_to, u.id];
                          setEditForm({ ...editForm, assigned_to: next });
                        }}
                      >
                        <Ionicons name={sel ? "checkbox" : "square-outline"} size={18} color={sel ? "#2563eb" : "#94a3b8"} />
                        <Text style={[styles.editChipText, sel && styles.editChipTextActive]} numberOfLines={1}>
                          {u.full_name || u.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {planUsers.length === 0 && projectUsers.length === 0 && (
                <>
                  {users.map((u) => {
                    const sel = editForm.assigned_to.includes(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.editChip, sel && styles.editChipActive, { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }]}
                        onPress={() => {
                          const next = sel ? editForm.assigned_to.filter((x: string) => x !== u.id) : [...editForm.assigned_to, u.id];
                          setEditForm({ ...editForm, assigned_to: next });
                        }}
                      >
                        <Ionicons name={sel ? "checkbox" : "square-outline"} size={18} color={sel ? "#2563eb" : "#94a3b8"} />
                        <Text style={[styles.editChipText, sel && styles.editChipTextActive]} numberOfLines={1}>
                          {u.full_name || u.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("tasks.due_date")}</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.due_date}
                onChangeText={(v) => setEditForm({ ...editForm, due_date: v })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </ScrollView>
          <TouchableOpacity
            style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={editSaving}
          >
            <Text style={styles.editSaveBtnText}>
              {editSaving ? t("common.loading") : t("common.save")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
