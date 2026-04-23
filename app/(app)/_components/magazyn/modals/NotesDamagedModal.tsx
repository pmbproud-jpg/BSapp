/**
 * Modal edycji uwag i flagi "uszkodzone" dla narzedzia.
 * Wydzielony z magazyn.tsx (Faza 2 step 5).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { useTheme } from "@/src/providers/ThemeProvider";

type ToolsHook = ReturnType<typeof useWarehouseTools>;

type Props = {
  tools: ToolsHook;
};

export function NotesDamagedModal({ tools }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showNotesModal, setShowNotesModal,
    notesItem, notesText, setNotesText,
    notesDamaged, setNotesDamaged, notesSaving, saveNotes,
  } = tools;

  return (
    <Modal visible={showNotesModal} transparent animationType="fade" onRequestClose={() => setShowNotesModal(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
        <View style={{ backgroundColor: tc.card || "#fff", borderRadius: 16, padding: 20, width: "92%", maxWidth: 440, borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#e2e8f0") }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="chatbubble-ellipses" size={22} color={notesDamaged ? "#ef4444" : "#f59e0b"} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: tc.text }}>
                {t("magazyn.notes_title") || "Uwagi"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowNotesModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={tc.textSecondary} />
            </TouchableOpacity>
          </View>

          {notesItem && (
            <View style={{ backgroundColor: notesDamaged ? "#fef2f2" : (tc.background || "#f8fafc"), borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: notesDamaged ? "#fca5a5" : (tc.border || "#e2e8f0") }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: tc.text }} numberOfLines={1}>
                {notesItem.beschreibung || "—"}
              </Text>
              <Text style={{ fontSize: 11, color: tc.textSecondary, marginTop: 2 }}>
                {notesItem.iv_pds || "—"} • {notesItem.hersteller || "—"} • SN: {notesItem.serial_nummer || "—"}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setNotesDamaged(!notesDamaged)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
              borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#e2e8f0"),
              backgroundColor: notesDamaged ? "#fef2f2" : "transparent",
              marginBottom: 14,
            }}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 6,
              borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#cbd5e1"),
              backgroundColor: notesDamaged ? "#ef4444" : "transparent",
              justifyContent: "center", alignItems: "center",
            }}>
              {notesDamaged && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Ionicons name="warning" size={18} color={notesDamaged ? "#ef4444" : tc.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: notesDamaged ? "#ef4444" : tc.text }}>
              {t("magazyn.damaged") || "Uszkodzone / Beschädigt"}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>
            {t("magazyn.notes_label") || "Uwagi / Anmerkungen"}
          </Text>
          <TextInput
            style={{
              borderWidth: 1, borderColor: notesDamaged ? "#fca5a5" : (tc.border || "#e2e8f0"),
              borderRadius: 10, padding: 12, fontSize: 14, color: tc.text,
              backgroundColor: tc.background || "#fff",
              minHeight: 100, textAlignVertical: "top",
            }}
            value={notesText}
            onChangeText={setNotesText}
            placeholder={t("magazyn.notes_placeholder") || "Uwagi dotyczące tego przedmiotu..."}
            placeholderTextColor={tc.textMuted || "#999"}
            multiline
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", alignItems: "center" }}
              onPress={() => setShowNotesModal(false)}
            >
              <Text style={{ color: tc.text, fontWeight: "600", fontSize: 14 }}>{t("common.cancel") || "Anuluj"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: notesDamaged ? "#ef4444" : "#2563eb", alignItems: "center" }}
              onPress={saveNotes}
              disabled={notesSaving}
            >
              {notesSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{t("common.save") || "Zapisz"}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
