/**
 * Zakładka "Bestellungen" w magazynie:
 * search, sort/filter dropdowns, tabela zamówień (materiały + narzędzia).
 * Wydzielona z magazyn.tsx (Faza 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { orderStatusColors } from "@/src/constants/colors";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { useWarehouseOrders } from "@/src/hooks/useWarehouseOrders";

import { s } from "./styles";

type OrdersHook = ReturnType<typeof useWarehouseOrders>;

type Props = {
  orders: OrdersHook;
  canManageMaterials: boolean;
};

export function OrdersTab({ orders, canManageMaterials }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();

  const {
    allOrders, ordersLoading,
    orderSearch, setOrderSearch,
    orderSortKey, orderSortAsc, showOrdSortDD, setShowOrdSortDD,
    ordFilterCol, setOrdFilterCol, ordFilterVal, setOrdFilterVal,
    showOrdFilterDD, setShowOrdFilterDD, showOrdFilterValDD, setShowOrdFilterValDD,
    ordColumns, ordFilterColValues, filteredOrders, toggleOrderSort,
    getOrderItemName, openEditOrder,
  } = orders;

  return (
    <>
      <View style={[s.searchBox, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <Ionicons name="search" size={18} color={tc.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: tc.text }]}
          placeholder={t("magazyn.search_orders", "Bestellung suchen...")}
          placeholderTextColor={tc.textSecondary}
          value={orderSearch}
          onChangeText={setOrderSearch}
        />
        {orderSearch.length > 0 && (
          <TouchableOpacity onPress={() => setOrderSearch("")}>
            <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <View style={{ position: "relative", zIndex: 20 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", backgroundColor: tc.card }}
            onPress={() => { setShowOrdSortDD(!showOrdSortDD); setShowOrdFilterDD(false); setShowOrdFilterValDD(false); }}
          >
            <Ionicons name="swap-vertical" size={14} color="#2563eb" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: tc.text }}>{t("magazyn.sort")}: {ordColumns.find((c) => c.key === orderSortKey)?.label || "—"}</Text>
            <Ionicons name={orderSortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />
          </TouchableOpacity>
          {showOrdSortDD && (
            <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
              {ordColumns.map((col) => (
                <TouchableOpacity key={col.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { toggleOrderSort(col.key); setShowOrdSortDD(false); }}>
                  <Text style={{ fontSize: 13, color: orderSortKey === col.key ? "#2563eb" : tc.text, fontWeight: orderSortKey === col.key ? "700" : "400" }}>{col.label}</Text>
                  {orderSortKey === col.key && <Ionicons name={orderSortAsc ? "arrow-up" : "arrow-down"} size={14} color="#2563eb" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={{ position: "relative", zIndex: 19 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: ordFilterCol ? "#f59e0b" : (tc.border || "#e2e8f0"), backgroundColor: ordFilterCol ? "#fef3c720" : tc.card }}
            onPress={() => { setShowOrdFilterDD(!showOrdFilterDD); setShowOrdSortDD(false); setShowOrdFilterValDD(false); }}
          >
            <Ionicons name="funnel" size={14} color={ordFilterCol ? "#f59e0b" : tc.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: ordFilterCol ? "#f59e0b" : tc.text }}>
              {ordFilterCol ? `${ordColumns.find((c) => c.key === ordFilterCol)?.label}: ${ordFilterVal || "…"}` : t("magazyn.filter")}
            </Text>
            {ordFilterCol ? <TouchableOpacity onPress={() => { setOrdFilterCol(""); setOrdFilterVal(""); setShowOrdFilterDD(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={14} color="#f59e0b" /></TouchableOpacity> : null}
          </TouchableOpacity>
          {showOrdFilterDD && (
            <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
              <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setOrdFilterCol(""); setOrdFilterVal(""); setShowOrdFilterDD(false); }}>
                <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>{t("magazyn.reset_filters")}</Text>
              </TouchableOpacity>
              {ordColumns.map((col) => (
                <TouchableOpacity key={col.key} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setOrdFilterCol(col.key); setOrdFilterVal(""); setShowOrdFilterDD(false); setShowOrdFilterValDD(true); }}>
                  <Text style={{ fontSize: 13, color: ordFilterCol === col.key ? "#f59e0b" : tc.text, fontWeight: ordFilterCol === col.key ? "700" : "400" }}>{col.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {ordFilterCol ? (
          <View style={{ position: "relative", zIndex: 18 }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: ordFilterVal ? "#10b981" : (tc.border || "#e2e8f0"), backgroundColor: ordFilterVal ? "#10b98110" : tc.card }}
              onPress={() => { setShowOrdFilterValDD(!showOrdFilterValDD); setShowOrdSortDD(false); setShowOrdFilterDD(false); }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: ordFilterVal ? "#10b981" : tc.textSecondary }}>{ordFilterVal || t("magazyn.select_value")}</Text>
              <Ionicons name="chevron-down" size={12} color={ordFilterVal ? "#10b981" : tc.textSecondary} />
            </TouchableOpacity>
            {showOrdFilterValDD && (
              <ScrollView style={{ position: "absolute", top: 38, left: 0, minWidth: 200, maxHeight: 250, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                {ordFilterColValues.map((val) => (
                  <TouchableOpacity key={val} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setOrdFilterVal(val); setShowOrdFilterValDD(false); }}>
                    <Text style={{ fontSize: 13, color: ordFilterVal === val ? "#10b981" : tc.text, fontWeight: ordFilterVal === val ? "700" : "400" }}>{val}</Text>
                  </TouchableOpacity>
                ))}
                {ordFilterColValues.length === 0 && <Text style={{ padding: 12, fontSize: 12, color: tc.textMuted }}>{t("magazyn.no_values")}</Text>}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>

      <Text style={{ paddingHorizontal: 16, fontSize: 12, color: tc.textSecondary, marginBottom: 6 }}>{filteredOrders.length} / {allOrders.length}</Text>

      {ordersLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 30 }}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <Ionicons name="cart-outline" size={48} color="#2563eb" />
            <Text style={{ fontSize: 15, color: tc.textSecondary, marginTop: 12 }}>
              {allOrders.length === 0 ? (t("magazyn.no_orders", "Keine Bestellungen")) : (t("magazyn.no_results", "Keine Ergebnisse"))}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ marginHorizontal: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={{ flexDirection: "row", backgroundColor: "#1e40af", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                {[
                  { label: t("magazyn.col_type"), w: 70, key: "order_type" },
                  { label: t("magazyn.col_project"), w: 140, key: "project" },
                  { label: `${t("magazyn.material")}/${t("magazyn.tool")}`, w: 170, key: "material" },
                  { label: t("magazyn.col_art_nr"), w: 80, key: "material" },
                  { label: t("magazyn.col_qty"), w: 60, key: "ilosc" },
                  { label: t("magazyn.status_label"), w: 90, key: "status" },
                  { label: t("magazyn.col_ordered_by"), w: 110, key: "ordered_by" },
                  { label: t("magazyn.col_date"), w: 80, key: "created_at" },
                  { label: t("magazyn.col_time"), w: 60, key: "created_at" },
                  { label: t("magazyn.ordered_on"), w: 90, key: "ordered_at" },
                  { label: t("magazyn.col_delivery"), w: 90, key: "data_dostawy" },
                  { label: t("magazyn.notes"), w: 120, key: "uwagi" },
                  { label: t("magazyn.col_action"), w: 100, key: "_action" },
                ].map((col, i) => (
                  <TouchableOpacity key={`${col.key}_${i}`} onPress={() => col.key !== "_action" && toggleOrderSort(col.key)} style={{ width: col.w, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{col.label}</Text>
                    {orderSortKey === col.key && col.key !== "_action" && (
                      <Ionicons name={orderSortAsc ? "arrow-up" : "arrow-down"} size={10} color="#fbbf24" style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {filteredOrders.map((order, idx) => {
                const sc = orderStatusColors[order.status ?? "pending"] || "#94a3b8";
                return (
                  <TouchableOpacity
                    key={order.id}
                    activeOpacity={0.7}
                    onPress={() => canManageMaterials ? openEditOrder(order) : null}
                    style={{ flexDirection: "row", backgroundColor: idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc"), borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", paddingVertical: 8, alignItems: "center" }}
                  >
                    <View style={{ width: 70, paddingHorizontal: 4 }}>
                      <View style={{ backgroundColor: order.order_type === "tool" ? "#f59e0b20" : "#3b82f620", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: order.order_type === "tool" ? "#f59e0b" : "#3b82f6" }}>
                          {order.order_type === "tool" ? t("magazyn.tool") : t("magazyn.material")}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ width: 140, fontSize: 12, color: "#2563eb", fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>
                      {order.project?.project_number ? `#${order.project.project_number} ` : ""}{order.project?.name || "—"}
                    </Text>
                    <Text style={{ width: 170, fontSize: 12, color: tc.text, fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>{getOrderItemName(order) || "—"}</Text>
                    <Text style={{ width: 80, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{(order.order_type === "tool" ? order.tool?.art_nr : order.material?.art_nr) || "—"}</Text>
                    <Text style={{ width: 60, fontSize: 12, color: "#2563eb", fontWeight: "700", paddingHorizontal: 6, textAlign: "center" }}>{String(order.ilosc ?? "—")}</Text>
                    <View style={{ width: 90, paddingHorizontal: 4 }}>
                      <View style={{ backgroundColor: `${sc}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: sc }}>{String(t(`magazyn.order_status.${order.status}`, { defaultValue: order.status ?? "" }))}</Text>
                      </View>
                    </View>
                    <Text style={{ width: 110, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{order.ordered_by_profile?.full_name || "—"}</Text>
                    <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{order.created_at ? new Date(order.created_at).toLocaleDateString("de-DE") : "—"}</Text>
                    <Text style={{ width: 60, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{order.created_at ? new Date(order.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "—"}</Text>
                    <Text style={{ width: 90, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{order.ordered_at ? new Date(order.ordered_at).toLocaleDateString("de-DE") : "—"}</Text>
                    <Text style={{ width: 90, fontSize: 11, color: order.data_dostawy ? "#10b981" : tc.textSecondary, fontWeight: order.data_dostawy ? "600" : "400", paddingHorizontal: 6 }}>{order.data_dostawy || "—"}</Text>
                    <Text style={{ width: 120, fontSize: 11, color: tc.textMuted, paddingHorizontal: 6, fontStyle: "italic" }} numberOfLines={1}>{order.uwagi || "—"}</Text>
                    <View style={{ width: 100, paddingHorizontal: 4, flexDirection: "row", gap: 4 }}>
                      {canManageMaterials ? (
                        <TouchableOpacity
                          style={{ backgroundColor: "#2563eb", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 3 }}
                          onPress={() => openEditOrder(order)}
                        >
                          <Ionicons name="create-outline" size={12} color="#fff" />
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>{t("common.edit")}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </>
  );
}
