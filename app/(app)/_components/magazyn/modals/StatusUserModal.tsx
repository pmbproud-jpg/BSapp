/**
 * Modal przypisywania uzytkownika do narzedzia (status = imie pracownika).
 * Wydzielony z magazyn.tsx (Faza 2 step 5).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "../styles";

type ToolsHook = ReturnType<typeof useWarehouseTools>;

type Props = {
  tools: ToolsHook;
  allUsers: { id: string; full_name: string }[];
};

export function StatusUserModal({ tools, allUsers }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showStatusUserModal, setShowStatusUserModal,
    statusUserItem, statusUserSearch, setStatusUserSearch,
    assignStatusToUser,
    showModal, form,
  } = tools;

  return (
    <Modal visible={showStatusUserModal} transparent animationType="fade" onRequestClose={() => setShowStatusUserModal(false)}>
      <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[s.modalContent, { backgroundColor: tc.card, maxHeight: "80%" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>{t("magazyn.status_assigned")}</Text>
              <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }} numberOfLines={1}>{statusUserItem?.beschreibung || "—"}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowStatusUserModal(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>
          <View style={[s.searchBox, { backgroundColor: tc.background, borderColor: tc.border, marginHorizontal: 0, marginBottom: 10 }]}>
            <Ionicons name="search" size={16} color={tc.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: tc.text }]}
              placeholder={t("magazyn.search_user")}
              placeholderTextColor={tc.textSecondary}
              value={statusUserSearch}
              onChangeText={setStatusUserSearch}
            />
          </View>
          <ScrollView style={{ maxHeight: 350 }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10 }}
              onPress={() => assignStatusToUser(null)}
            >
              <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
              <Text style={{ fontSize: 14, color: "#ef4444", fontWeight: "600" }}>{t("magazyn.no_assignment")}</Text>
            </TouchableOpacity>
            {allUsers
              .filter((u) => !statusUserSearch.trim() || u.full_name.toLowerCase().includes(statusUserSearch.toLowerCase()))
              .map((u) => {
                const isSelected = showModal ? form.assigned_to === u.id : statusUserItem?.assigned_to === u.id;
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10, backgroundColor: isSelected ? "#2563eb10" : "transparent" }}
                    onPress={() => assignStatusToUser(u.id)}
                  >
                    <Ionicons name={isSelected ? "checkmark-circle" : "person-outline"} size={22} color={isSelected ? "#2563eb" : tc.textSecondary} />
                    <Text style={{ fontSize: 14, color: isSelected ? "#2563eb" : tc.text, fontWeight: isSelected ? "700" : "400" }}>{u.full_name}</Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
