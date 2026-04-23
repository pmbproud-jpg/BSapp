/**
 * Modal dodawania/edycji narzedzia w magazynie.
 * Wydzielony z magazyn.tsx (Faza 2 step 5).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { FIELDS, type useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "../styles";

type ToolsHook = ReturnType<typeof useWarehouseTools>;

type Props = {
  tools: ToolsHook;
};

export function ToolEditModal({ tools }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showModal, setShowModal, editingItem, form, setForm, saving, saveItem,
    setStatusUserSearch, setShowStatusUserModal,
    setBaustelleSearch, setShowBaustellePicker,
  } = tools;

  return (
    <Modal visible={showModal} animationType="slide" transparent>
      <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[s.modalContent, { backgroundColor: tc.card }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={[s.modalTitle, { color: tc.text }]}>
              {editingItem ? (t("magazyn.edit_item") || "Werkzeug bearbeiten") : (t("magazyn.add_item") || "Werkzeug hinzufügen")}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            {FIELDS.map((f) => (
              <View key={f.key} style={{ marginBottom: 10 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                {f.key === "status" ? (
                  <View>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: form.assigned_to ? "#2563eb" : (tc.border || "#e2e8f0"), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: form.assigned_to ? "#eff6ff" : (tc.background || "#fff") }}
                      onPress={() => { setStatusUserSearch(""); setShowStatusUserModal(true); }}
                    >
                      <Ionicons name="person" size={18} color={form.assigned_to ? "#2563eb" : tc.textSecondary} />
                      <Text style={{ flex: 1, fontSize: 14, color: form.assigned_to ? "#2563eb" : tc.textSecondary, fontWeight: form.assigned_to ? "600" : "400" }}>
                        {form.status || t("magazyn.select_user")}
                      </Text>
                      {form.assigned_to ? (
                        <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, assigned_to: "", status: "" }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color="#2563eb" />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : f.key === "baustelle" ? (
                  <View>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: form.baustelle ? "#10b981" : (tc.border || "#e2e8f0"), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: form.baustelle ? "#ecfdf5" : (tc.background || "#fff") }}
                      onPress={() => { setBaustelleSearch(""); setShowBaustellePicker(true); }}
                    >
                      <Ionicons name="business" size={18} color={form.baustelle ? "#10b981" : tc.textSecondary} />
                      <Text style={{ flex: 1, fontSize: 14, color: form.baustelle ? "#10b981" : tc.textSecondary, fontWeight: form.baustelle ? "600" : "400" }}>
                        {form.baustelle || t("magazyn.select_site")}
                      </Text>
                      {form.baustelle ? (
                        <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, baustelle: "" }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color="#10b981" />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TextInput
                    style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={form[f.key]}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.labelDE}
                    placeholderTextColor={tc.textMuted || "#999"}
                    keyboardType="default"
                  />
                )}
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowModal(false)}>
              <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#dc2626" }]} onPress={saveItem} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
