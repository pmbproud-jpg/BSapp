/**
 * Modal wyboru projektu (Baustelle) dla narzedzia.
 * Wydzielony z magazyn.tsx (Faza 2 step 5).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "../styles";

type ToolsHook = ReturnType<typeof useWarehouseTools>;

type ProjectLite = { id: string; name: string; project_number: string | null; location: string | null };

type Props = {
  tools: ToolsHook;
  allProjects: ProjectLite[];
};

export function BaustellePickerModal({ tools, allProjects }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showBaustellePicker, setShowBaustellePicker,
    baustelleSearch, setBaustelleSearch,
    form, setForm,
  } = tools;

  return (
    <Modal visible={showBaustellePicker} transparent animationType="fade" onRequestClose={() => setShowBaustellePicker(false)}>
      <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[s.modalContent, { backgroundColor: tc.card, maxHeight: "80%" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={[s.modalTitle, { color: tc.text }]}>{t("magazyn.select_site")}</Text>
            <TouchableOpacity onPress={() => setShowBaustellePicker(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>
          <View style={[s.searchBox, { borderColor: tc.border, backgroundColor: tc.background }]}>
            <Ionicons name="search" size={18} color={tc.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: tc.text }]}
              placeholder={t("magazyn.search_site")}
              placeholderTextColor={tc.textMuted}
              value={baustelleSearch}
              onChangeText={setBaustelleSearch}
            />
            {baustelleSearch.length > 0 && (
              <TouchableOpacity onPress={() => setBaustelleSearch("")}>
                <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={{ flex: 1 }}>
            {allProjects
              .filter((p) => !baustelleSearch.trim() || p.name.toLowerCase().includes(baustelleSearch.toLowerCase()) || (p.project_number || "").toLowerCase().includes(baustelleSearch.toLowerCase()) || (p.location || "").toLowerCase().includes(baustelleSearch.toLowerCase()))
              .map((p) => {
                const label = p.project_number ? `${p.project_number} – ${p.name}` : p.name;
                const isSelected = form.baustelle === label || form.baustelle === p.name;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10, backgroundColor: isSelected ? "#10b98110" : "transparent" }}
                    onPress={() => { setForm((prev) => ({ ...prev, baustelle: label })); setShowBaustellePicker(false); }}
                  >
                    <Ionicons name={isSelected ? "checkmark-circle" : "business-outline"} size={22} color={isSelected ? "#10b981" : tc.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: isSelected ? "#10b981" : tc.text, fontWeight: isSelected ? "700" : "500" }}>{label}</Text>
                      {p.location ? <Text style={{ fontSize: 11, color: tc.textMuted, marginTop: 2 }}>{p.location}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            {allProjects.length === 0 && (
              <Text style={{ textAlign: "center", color: tc.textMuted, paddingVertical: 20 }}>{t("magazyn.no_sites")}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
