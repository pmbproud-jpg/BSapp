/**
 * Modal edycji zamowienia magazynowego (status, daty, uwagi).
 * Wydzielony z magazyn.tsx (Faza 2 step 5).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useWarehouseOrders } from "@/src/hooks/useWarehouseOrders";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "../styles";

type OrdersHook = ReturnType<typeof useWarehouseOrders>;

type Props = {
  orders: OrdersHook;
};

export function OrderEditModal({ orders }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    showOrderEditModal, setShowOrderEditModal,
    editingOrder, orderForm, setOrderForm, orderSaving,
    saveOrder, deleteOrder,
  } = orders;

  return (
    <Modal visible={showOrderEditModal} animationType="slide" transparent onRequestClose={() => setShowOrderEditModal(false)}>
      <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[s.modalContent, { backgroundColor: tc.card }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>{t("magazyn.edit_order")}</Text>
              {editingOrder && (
                <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }} numberOfLines={1}>
                  {editingOrder.order_type === "tool" ? (editingOrder.tool?.beschreibung || "—") : (editingOrder.material?.nazwa || "—")} — {editingOrder.project?.name || "—"}
                  {editingOrder.order_type === "tool" ? ` (${t("magazyn.tool")})` : ` (${t("magazyn.material")})`}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowOrderEditModal(false)}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
            {/* Erstellt — auto info */}
            {editingOrder && (
              <View style={{ marginBottom: 14, backgroundColor: tc.background || "#f8fafc", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: tc.border || "#e2e8f0" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Ionicons name="information-circle-outline" size={16} color={tc.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: tc.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("magazyn.order_info")}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Ionicons name="calendar-outline" size={14} color={tc.textSecondary} />
                  <Text style={{ fontSize: 13, color: tc.text }}>
                    {t("magazyn.created")}: {editingOrder.created_at ? new Date(editingOrder.created_at).toLocaleDateString("de-DE") : "—"}{" "}
                    {editingOrder.created_at ? new Date(editingOrder.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="person-outline" size={14} color={tc.textSecondary} />
                  <Text style={{ fontSize: 13, color: tc.text }}>
                    {t("magazyn.created_by")}: {editingOrder.ordered_by_profile?.full_name || "—"}
                  </Text>
                </View>
              </View>
            )}

            {/* Status */}
            <View style={{ marginBottom: 14 }}>
              <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.status_label")}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "pending", color: "#f59e0b", icon: "time-outline" as const },
                  { value: "ordered", color: "#3b82f6", icon: "cart-outline" as const },
                  { value: "delivered", color: "#10b981", icon: "checkmark-circle-outline" as const },
                ].map((st) => {
                  const isActive = orderForm.status === st.value;
                  return (
                    <TouchableOpacity
                      key={st.value}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 6,
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                        borderWidth: 2, borderColor: isActive ? st.color : (tc.border || "#e2e8f0"),
                        backgroundColor: isActive ? `${st.color}15` : "transparent",
                      }}
                      onPress={() => setOrderForm((prev) => ({ ...prev, status: st.value }))}
                    >
                      <Ionicons name={st.icon} size={18} color={isActive ? st.color : tc.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? st.color : tc.text }}>
                        {t(`magazyn.order_status.${st.value}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Bestellt am */}
            <View style={{ marginBottom: 14 }}>
              <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.ordered_on")}</Text>
              {Platform.OS === "web" ? (
                <View style={{ flexDirection: "row" }}>
                  <input
                    type="date"
                    value={orderForm.ordered_at}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderForm((prev) => ({ ...prev, ordered_at: e.target.value }))}
                    style={{
                      width: 200, maxWidth: "100%", padding: 10, fontSize: 14, borderRadius: 8,
                      border: `1px solid ${tc.border || "#e2e8f0"}`,
                      backgroundColor: tc.background || "#fff",
                      color: tc.text || "#1e293b",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    } as React.CSSProperties}
                  />
                </View>
              ) : (
                <TextInput
                  style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                  value={orderForm.ordered_at}
                  onChangeText={(v) => setOrderForm((prev) => ({ ...prev, ordered_at: v }))}
                  placeholder="JJJJ-MM-TT"
                  placeholderTextColor={tc.textMuted || "#999"}
                />
              )}
              <TouchableOpacity
                style={{ marginTop: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#3b82f610" }}
                onPress={() => setOrderForm((prev) => ({ ...prev, ordered_at: new Date().toISOString().slice(0, 10) }))}
              >
                <Ionicons name="today-outline" size={14} color="#3b82f6" />
                <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: "600" }}>{t("common.today")}</Text>
              </TouchableOpacity>
            </View>

            {/* Lieferung */}
            <View style={{ marginBottom: 14 }}>
              <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.delivery_planned")}</Text>
              {Platform.OS === "web" ? (
                <View style={{ flexDirection: "row" }}>
                  <input
                    type="date"
                    value={orderForm.data_dostawy}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderForm((prev) => ({ ...prev, data_dostawy: e.target.value }))}
                    style={{
                      width: 200, maxWidth: "100%", padding: 10, fontSize: 14, borderRadius: 8,
                      border: `1px solid ${tc.border || "#e2e8f0"}`,
                      backgroundColor: tc.background || "#fff",
                      color: tc.text || "#1e293b",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    } as React.CSSProperties}
                  />
                </View>
              ) : (
                <TextInput
                  style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                  value={orderForm.data_dostawy}
                  onChangeText={(v) => setOrderForm((prev) => ({ ...prev, data_dostawy: v }))}
                  placeholder="JJJJ-MM-TT"
                  placeholderTextColor={tc.textMuted || "#999"}
                />
              )}
              <TouchableOpacity
                style={{ marginTop: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#10b98110" }}
                onPress={() => setOrderForm((prev) => ({ ...prev, data_dostawy: new Date().toISOString().slice(0, 10) }))}
              >
                <Ionicons name="today-outline" size={14} color="#10b981" />
                <Text style={{ fontSize: 11, color: "#10b981", fontWeight: "600" }}>{t("common.today")}</Text>
              </TouchableOpacity>
            </View>

            {/* Anmerkung */}
            <View style={{ marginBottom: 14 }}>
              <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.notes")}</Text>
              <TextInput
                style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background, minHeight: 70, textAlignVertical: "top" }]}
                value={orderForm.uwagi}
                onChangeText={(v) => setOrderForm((prev) => ({ ...prev, uwagi: v }))}
                placeholder={t("magazyn.order_notes_placeholder")}
                placeholderTextColor={tc.textMuted || "#999"}
                multiline
              />
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 }]}
              onPress={() => editingOrder && deleteOrder(editingOrder.id)}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={{ color: "#ef4444", fontWeight: "600" }}>{t("common.delete") || "Löschen"}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowOrderEditModal(false)}>
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel") || "Abbrechen"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#2563eb" }]} onPress={saveOrder} disabled={orderSaving}>
                {orderSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save") || "Speichern"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
