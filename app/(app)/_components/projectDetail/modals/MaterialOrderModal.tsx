/**
 * Modal zamowienia materialow (fullscreen, multi-select z kolumna ilosci).
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

export function MaterialOrderModal({ orders }: Props) {
  const { t: _t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showOrderModal, setShowOrderModal,
    materialsList, orderMatSearch, setOrderMatSearch,
    orderCart, setOrderCart, orderSaving, submitCartOrders,
  } = orders;

  return (
    <Modal visible={showOrderModal} transparent={false} animationType="slide" onRequestClose={() => setShowOrderModal(false)}>
      <View style={{ flex: 1, backgroundColor: tc.background || "#f8fafc" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tc.card, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0" }}>
          <TouchableOpacity onPress={() => setShowOrderModal(false)} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={tc.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "700", color: tc.text, flex: 1, textAlign: "center" }}>Materialbestellung</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
              <View style={{ backgroundColor: "#2563eb", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{Object.values(orderCart).filter((q) => parseFloat(q) > 0).length}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: tc.card }}>
          <Ionicons name="search" size={18} color={tc.textSecondary} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: tc.text, padding: 0 }}
            placeholder="Name, Art-Nr oder Position suchen..."
            placeholderTextColor={tc.textSecondary}
            value={orderMatSearch}
            onChangeText={setOrderMatSearch}
          />
          {orderMatSearch.length > 0 && (
            <TouchableOpacity onPress={() => setOrderMatSearch("")}>
              <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Table */}
        <ScrollView style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={{ flexDirection: "row", backgroundColor: "#1e293b", paddingVertical: 8 }}>
                {[
                  { label: "Bestellen", w: 70 },
                  { label: "Pos.", w: 50 },
                  { label: "Art-Nr", w: 80 },
                  { label: "Name", w: 180 },
                  { label: "Lager", w: 60 },
                  { label: "Länge", w: 65 },
                  { label: "Breite", w: 65 },
                  { label: "Höhe", w: 65 },
                  { label: "Gewicht", w: 65 },
                ].map((col, i) => (
                  <Text key={i} style={{ width: col.w, color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }} numberOfLines={1}>{col.label}</Text>
                ))}
              </View>
              {materialsList.filter((mat) => {
                if (!orderMatSearch.trim()) return true;
                const q = orderMatSearch.toLowerCase();
                return (mat.nazwa || "").toLowerCase().includes(q) || (mat.art_nr || "").toLowerCase().includes(q) || (mat.pozycja || "").toLowerCase().includes(q);
              }).map((mat, idx) => {
                const qty = orderCart[mat.id] || "";
                const hasQty = parseFloat(qty) > 0;
                return (
                  <View
                    key={mat.id}
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
                          setOrderCart((prev) => {
                            const next = { ...prev };
                            if (!cleaned || cleaned === "0") delete next[mat.id];
                            else next[mat.id] = cleaned;
                            return next;
                          });
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#cbd5e1"
                      />
                    </View>
                    <Text style={{ width: 50, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.pozycja || "—"}</Text>
                    <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.art_nr || "—"}</Text>
                    <Text style={{ width: 180, fontSize: 11, color: tc.text, fontWeight: "600", paddingHorizontal: 4 }} numberOfLines={1}>{mat.nazwa || "—"}</Text>
                    <Text style={{ width: 60, fontSize: 11, color: "#dc2626", fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }}>{mat.ilosc ?? "—"}</Text>
                    <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.dlugosc || "—"}</Text>
                    <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.szerokosc || "—"}</Text>
                    <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.wysokosc || "—"}</Text>
                    <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.waga || "—"}</Text>
                  </View>
                );
              })}
              {materialsList.length === 0 && (
                <Text style={{ color: tc.textMuted, textAlign: "center", paddingVertical: 20 }}>Keine Materialien</Text>
              )}
            </View>
          </ScrollView>
        </ScrollView>

        {/* Bottom bar — cart summary + order button */}
        <View style={{ backgroundColor: tc.card, borderTopWidth: 1, borderTopColor: tc.border || "#e2e8f0", paddingHorizontal: 16, paddingVertical: 12 }}>
          {Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {Object.entries(orderCart).filter(([_, q]) => parseFloat(q) > 0).map(([matId, qty]) => {
                const mat = materialsList.find((m) => m.id === matId);
                return (
                  <View key={matId} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, gap: 4 }}>
                    <Text style={{ fontSize: 11, color: "#1e40af", fontWeight: "600" }} numberOfLines={1}>{mat?.nazwa?.slice(0, 20) || "?"}</Text>
                    <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "700" }}>×{qty}</Text>
                    <TouchableOpacity onPress={() => setOrderCart((prev) => { const n = { ...prev }; delete n[matId]; return n; })}>
                      <Ionicons name="close-circle" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <TouchableOpacity
            style={{
              backgroundColor: Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0 ? "#2563eb" : "#94a3b8",
              borderRadius: 10, paddingVertical: 14, alignItems: "center",
            }}
            onPress={submitCartOrders}
            disabled={Object.values(orderCart).filter((q) => parseFloat(q) > 0).length === 0 || orderSaving}
          >
            {orderSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                {Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0
                  ? `Bestellen (${Object.values(orderCart).filter((q) => parseFloat(q) > 0).length} Positionen)`
                  : "Menge eingeben zum Bestellen"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
