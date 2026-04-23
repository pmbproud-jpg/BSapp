/**
 * Modal dodawania/edycji materialu w magazynie.
 * Wydzielony z magazyn.tsx (Faza 2 step 5).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { MAT_FIELDS, type useWarehouseMaterials } from "@/src/hooks/useWarehouseMaterials";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "../styles";

type MaterialsHook = ReturnType<typeof useWarehouseMaterials>;

type Props = {
  mats: MaterialsHook;
};

export function MaterialEditModal({ mats }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showMatModal, setShowMatModal, editingMat, matForm, setMatForm, matSaving, saveMatItem,
  } = mats;

  return (
    <Modal visible={showMatModal} animationType="slide" transparent>
      <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[s.modalContent, { backgroundColor: tc.card }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={[s.modalTitle, { color: tc.text }]}>
              {editingMat ? (t("magazyn.edit_material") || "Material bearbeiten") : (t("magazyn.add_material") || "Material hinzufügen")}
            </Text>
            <TouchableOpacity onPress={() => setShowMatModal(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            {MAT_FIELDS.map((f) => (
              <View key={f.key} style={{ marginBottom: 10 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                <TextInput
                  style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                  value={matForm[f.key]}
                  onChangeText={(v) => setMatForm((prev) => ({ ...prev, [f.key]: v }))}
                  placeholder={f.labelDE}
                  placeholderTextColor={tc.textMuted || "#999"}
                  keyboardType={f.numeric ? "decimal-pad" : "default"}
                />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowMatModal(false)}>
              <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#f97316" }]} onPress={saveMatItem} disabled={matSaving}>
              {matSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
