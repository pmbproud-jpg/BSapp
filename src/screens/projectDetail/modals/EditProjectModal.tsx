/**
 * Modal edycji projektu (nazwa, opis, status, daty, budzet, PM, BL).
 * Wydzielony z projects/[id].tsx (Faza 2 step 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useProjectEdit } from "@/src/hooks/useProjectEdit";

import { styles } from "../styles";

type EditHook = ReturnType<typeof useProjectEdit>;

type Props = {
  edit: EditHook;
};

export function EditProjectModal({ edit }: Props) {
  const { t } = useTranslation();
  const {
    showEditModal, setShowEditModal,
    editForm, setEditForm, editSaving, saveEditProject,
    allUsers, showPMPicker, setShowPMPicker, showBLPicker, setShowBLPicker,
  } = edit;

  return (
    <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
      <View style={styles.editModalOverlay}>
        <View style={styles.editModalContent}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>{t("projects.edit")}</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.name")} *</Text>
              <TextInput style={styles.editInput} value={editForm.name} onChangeText={(v) => setEditForm({ ...editForm, name: v })} placeholder={t("projects.name_placeholder")} placeholderTextColor="#94a3b8" maxLength={200} />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.description")}</Text>
              <TextInput style={[styles.editInput, { minHeight: 80, textAlignVertical: "top" }]} value={editForm.description} onChangeText={(v) => setEditForm({ ...editForm, description: v })} multiline placeholderTextColor="#94a3b8" maxLength={2000} />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.location")}</Text>
              <TextInput style={styles.editInput} value={editForm.location} onChangeText={(v) => setEditForm({ ...editForm, location: v })} placeholderTextColor="#94a3b8" maxLength={300} />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.statusLabel")}</Text>
              <View style={styles.editChips}>
                {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
                  <TouchableOpacity key={s} style={[styles.editChip, editForm.status === s && styles.editChipActive]} onPress={() => setEditForm({ ...editForm, status: s })}>
                    <Text style={[styles.editChipText, editForm.status === s && styles.editChipTextActive]}>{t(`projects.status.${s}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.budget")} (EUR)</Text>
              <TextInput style={styles.editInput} value={editForm.budget} onChangeText={(v) => setEditForm({ ...editForm, budget: v })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" maxLength={15} />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.start_date")}</Text>
              <TextInput style={styles.editInput} value={editForm.start_date} onChangeText={(v) => setEditForm({ ...editForm, start_date: v })} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" maxLength={10} />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("projects.end_date")}</Text>
              <TextInput style={styles.editInput} value={editForm.end_date} onChangeText={(v) => setEditForm({ ...editForm, end_date: v })} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" maxLength={10} />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Project Manager</Text>
              <TouchableOpacity style={styles.editPickerBtn} onPress={() => setShowPMPicker(!showPMPicker)}>
                <Text style={styles.editPickerBtnText}>
                  {editForm.project_manager_id ? (allUsers.find((u) => u.id === editForm.project_manager_id)?.full_name || allUsers.find((u) => u.id === editForm.project_manager_id)?.email || "—") : "—"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
              {showPMPicker && (
                <View style={styles.editPickerList}>
                  <TouchableOpacity style={styles.editPickerItem} onPress={() => { setEditForm({ ...editForm, project_manager_id: "" }); setShowPMPicker(false); }}>
                    <Text style={styles.editPickerItemText}>— {t("common.none")} —</Text>
                  </TouchableOpacity>
                  {allUsers.map((u) => (
                    <TouchableOpacity key={u.id} style={[styles.editPickerItem, editForm.project_manager_id === u.id && { backgroundColor: "#eff6ff" }]} onPress={() => { setEditForm({ ...editForm, project_manager_id: u.id }); setShowPMPicker(false); }}>
                      <Text style={styles.editPickerItemText}>{u.full_name || u.email}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Bauleiter</Text>
              <TouchableOpacity style={styles.editPickerBtn} onPress={() => setShowBLPicker(!showBLPicker)}>
                <Text style={styles.editPickerBtnText}>
                  {editForm.bauleiter_id ? (allUsers.find((u) => u.id === editForm.bauleiter_id)?.full_name || allUsers.find((u) => u.id === editForm.bauleiter_id)?.email || "—") : "—"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>
              {showBLPicker && (
                <View style={styles.editPickerList}>
                  <TouchableOpacity style={styles.editPickerItem} onPress={() => { setEditForm({ ...editForm, bauleiter_id: "" }); setShowBLPicker(false); }}>
                    <Text style={styles.editPickerItemText}>— {t("common.none")} —</Text>
                  </TouchableOpacity>
                  {allUsers.map((u) => (
                    <TouchableOpacity key={u.id} style={[styles.editPickerItem, editForm.bauleiter_id === u.id && { backgroundColor: "#eff6ff" }]} onPress={() => { setEditForm({ ...editForm, bauleiter_id: u.id }); setShowBLPicker(false); }}>
                      <Text style={styles.editPickerItemText}>{u.full_name || u.email}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
          <TouchableOpacity style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]} onPress={saveEditProject} disabled={editSaving}>
            <Text style={styles.editSaveBtnText}>{editSaving ? t("common.loading") : t("common.save")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
