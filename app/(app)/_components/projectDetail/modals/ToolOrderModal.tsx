/**
 * Modal zamowienia narzedzi (fullscreen, multi-select z kolumna ilosci).
 * Wydzielony z projects/[id].tsx (Faza 2 step 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useProjectOrders } from "@/src/hooks/useProjectOrders";
import { useTheme } from "@/src/providers/ThemeProvider";

type OrdersHook = ReturnType<typeof useProjectOrders>;

type Props = {
  orders: OrdersHook;
};

export function ToolOrderModal({ orders }: Props) {
  const { t: _t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showToolOrderModal, setShowToolOrderModal,
    toolsList, toolOrderSearch, setToolOrderSearch,
    toolOrderCart, setToolOrderCart, toolOrderSaving, submitToolCartOrders,
  } = orders;

  return (
    <Modal visible={showToolOrderModal} transparent={false} animationType="slide" onRequestClose={() => setShowToolOrderModal(false)}>
      <View style={{ flex: 1, backgroundColor: tc.background || "#f8fafc" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tc.card, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0" }}>
          <TouchableOpacity onPress={() => setShowToolOrderModal(false)} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={tc.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "700", color: tc.text, flex: 1, textAlign: "center" }}>Werkzeugbestellung</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
              <View style={{ backgroundColor: "#2563eb", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: tc.card }}>
          <Ionicons name="search" size={18} color={tc.textSecondary} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: tc.text, padding: 0 }}
            placeholder="Beschreibung, Art-Nr oder Hersteller suchen..."
            placeholderTextColor={tc.textSecondary}
            value={toolOrderSearch}
            onChangeText={setToolOrderSearch}
          />
          {toolOrderSearch.length > 0 && (
            <TouchableOpacity onPress={() => setToolOrderSearch("")}>
              <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={{ flexDirection: "row", backgroundColor: "#1e293b", paddingVertical: 8 }}>
                {[
                  { label: "Bestellen", w: 70 },
                  { label: "Beschreibung", w: 200 },
                  { label: "Art-Nr", w: 80 },
                  { label: "Hersteller", w: 120 },
                  { label: "Kategorie", w: 100 },
                  { label: "S/N", w: 120 },
                  { label: "Lager", w: 60 },
                ].map((col, i) => (
                  <Text key={i} style={{ width: col.w, color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }} numberOfLines={1}>{col.label}</Text>
                ))}
              </View>
              {toolsList.filter((tool) => {
                if (!toolOrderSearch.trim()) return true;
                const q = toolOrderSearch.toLowerCase();
                return (tool.beschreibung || "").toLowerCase().includes(q) || (tool.art_nr || "").toLowerCase().includes(q) || (tool.hersteller || "").toLowerCase().includes(q) || (tool.kategorie || "").toLowerCase().includes(q);
              }).map((tool, idx) => {
                const qty = toolOrderCart[tool.id] || "";
                const hasQty = parseFloat(qty) > 0;
                return (
                  <View
                    key={tool.id}
                    style={{
                      flexDirection: "row", alignItems: "center",
                      backgroundColor: hasQty ? "#eff6ff" : (idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc")),
                      borderBottomWidth: 1, borderBottomColor: hasQty ? "#93c5fd" : (tc.border || "#e2e8f0"),
                      borderLeftWidth: hasQty ? 3 : 0, borderLeftColor: "#2563eb",
                      paddingVertical: 4,
                    }}
                  >
                    <View style={{ width: 70, paddingHorizontal: 4, alignItems: "center" }}>
                      <TextInput
                        style={{
                          width: 56, height: 30, borderWidth: 1.5,
                          borderColor: hasQty ? "#2563eb" : (tc.border || "#d1d5db"),
                          borderRadius: 6, textAlign: "center", fontSize: 13, fontWeight: "700",
                          color: hasQty ? "#2563eb" : tc.text,
                          backgroundColor: hasQty ? "#dbeafe" : "#fff",
                          padding: 0,
                        }}
                        value={qty}
                        onChangeText={(v) => {
                          const cleaned = v.replace(/[^0-9.,]/g, "");
                          setToolOrderCart((prev) => {
                            const next = { ...prev };
                            if (!cleaned || cleaned === "0") delete next[tool.id];
                            else next[tool.id] = cleaned;
                            return next;
                          });
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#cbd5e1"
                      />
                    </View>
                    <Text style={{ width: 200, fontSize: 11, color: tc.text, fontWeight: "600", paddingHorizontal: 4 }} numberOfLines={1}>{tool.beschreibung || "—"}</Text>
                    <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.art_nr || "—"}</Text>
                    <Text style={{ width: 120, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.hersteller || "—"}</Text>
                    <Text style={{ width: 100, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.kategorie || "—"}</Text>
                    <Text style={{ width: 120, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.serial_nummer || "—"}</Text>
                    <Text style={{ width: 60, fontSize: 11, color: "#dc2626", fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }}>{tool.menge ?? "—"}</Text>
                  </View>
                );
              })}
              {toolsList.length === 0 && (
                <Text style={{ color: tc.textMuted, textAlign: "center", paddingVertical: 20 }}>Keine Werkzeuge</Text>
              )}
            </View>
          </ScrollView>
        </ScrollView>

        <View style={{ backgroundColor: tc.card, borderTopWidth: 1, borderTopColor: tc.border || "#e2e8f0", paddingHorizontal: 16, paddingVertical: 12 }}>
          {Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {Object.entries(toolOrderCart).filter(([_, q]) => parseFloat(q) > 0).map(([toolId, qty]) => {
                const tool = toolsList.find((t) => t.id === toolId);
                return (
                  <View key={toolId} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, gap: 4 }}>
                    <Text style={{ fontSize: 11, color: "#1e40af", fontWeight: "600" }} numberOfLines={1}>{tool?.beschreibung?.slice(0, 20) || "?"}</Text>
                    <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "700" }}>x{qty}</Text>
                    <TouchableOpacity onPress={() => setToolOrderCart((prev) => { const n = { ...prev }; delete n[toolId]; return n; })}>
                      <Ionicons name="close-circle" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <TouchableOpacity
            style={{
              backgroundColor: Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0 ? "#2563eb" : "#94a3b8",
              borderRadius: 10, paddingVertical: 14, alignItems: "center",
            }}
            onPress={submitToolCartOrders}
            disabled={Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length === 0 || toolOrderSaving}
          >
            {toolOrderSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0
                  ? `Bestellen (${Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length} Positionen)`
                  : "Menge eingeben zum Bestellen"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
