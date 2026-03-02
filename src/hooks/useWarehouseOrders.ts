/**
 * Hook zarządzający zamówieniami magazynowymi (project_material_orders, project_tool_orders):
 * CRUD, sortowanie, filtrowanie.
 * Wydzielony z magazyn.tsx.
 */
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { fetchProfileMap } from "@/src/services/profileService";

export function useWarehouseOrders(t: any) {
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Search/sort
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSortKey, setOrderSortKey] = useState<string>("created_at");
  const [orderSortAsc, setOrderSortAsc] = useState(false);
  const [showOrdSortDD, setShowOrdSortDD] = useState(false);
  const [ordFilterCol, setOrdFilterCol] = useState<string>("");
  const [ordFilterVal, setOrdFilterVal] = useState<string>("");
  const [showOrdFilterDD, setShowOrdFilterDD] = useState(false);
  const [showOrdFilterValDD, setShowOrdFilterValDD] = useState(false);

  // Order edit modal
  const [showOrderEditModal, setShowOrderEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [orderForm, setOrderForm] = useState({ status: "", ordered_at: "", data_dostawy: "", uwagi: "" });
  const [orderSaving, setOrderSaving] = useState(false);

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      // Fetch material orders
      const { data: matData, error: matErr } = await (supabaseAdmin.from("project_material_orders") as any)
        .select("*, material:warehouse_materials(nazwa, art_nr, dlugosc, szerokosc, wysokosc, waga), project:projects(name, project_number)")
        .order("created_at", { ascending: false });
      if (matErr) console.error("Material orders error:", matErr);
      const matOrders = (matData || []).map((o: any) => ({ ...o, order_type: "material" }));

      // Fetch tool orders
      const { data: toolData, error: toolErr } = await (supabaseAdmin.from("project_tool_orders") as any)
        .select("*, tool:warehouse_items(beschreibung, art_nr, hersteller, kategorie, serial_nummer), project:projects(name, project_number)")
        .order("created_at", { ascending: false });
      if (toolErr) console.error("Tool orders error:", toolErr);
      const toolOrders = (toolData || []).map((o: any) => ({ ...o, order_type: "tool" }));

      const combined = [...matOrders, ...toolOrders];

      // Fetch profile names for ordered_by users
      const userIds = [...new Set(combined.map((o: any) => o.ordered_by).filter(Boolean))];
      const profileMap = await fetchProfileMap(userIds);
      const enriched = combined.map((o: any) => ({
        ...o,
        ordered_by_profile: { full_name: profileMap[o.ordered_by] || null },
      }));
      // Sort by created_at descending
      enriched.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllOrders(enriched);
    } catch (e) {
      console.error("Error loading orders:", e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const markOrdered = async (orderId: string) => {
    try {
      const { error } = await (supabaseAdmin.from("project_material_orders") as any)
        .update({ status: "ordered", ordered_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
      loadOrders();
    } catch (e) {
      console.error("Error marking ordered:", e);
    }
  };

  const updateDeliveryDate = async (orderId: string, date: string) => {
    try {
      const { error } = await (supabaseAdmin.from("project_material_orders") as any)
        .update({ data_dostawy: date, status: "delivered" })
        .eq("id", orderId);
      if (error) throw error;
      loadOrders();
    } catch (e) {
      console.error("Error updating delivery date:", e);
    }
  };

  const openEditOrder = (order: any) => {
    setEditingOrder(order);
    setOrderForm({
      status: order.status || "pending",
      ordered_at: order.ordered_at ? new Date(order.ordered_at).toISOString().slice(0, 10) : "",
      data_dostawy: order.data_dostawy || "",
      uwagi: order.uwagi || "",
    });
    setShowOrderEditModal(true);
  };

  const saveOrder = async () => {
    if (!editingOrder) return;
    setOrderSaving(true);
    try {
      const table = editingOrder.order_type === "tool" ? "project_tool_orders" : "project_material_orders";
      const payload: any = {
        status: orderForm.status || "pending",
        uwagi: orderForm.uwagi.trim() || null,
        ordered_at: orderForm.ordered_at.trim() || null,
        data_dostawy: orderForm.data_dostawy.trim() || null,
      };
      const { error } = await (supabaseAdmin.from(table) as any)
        .update(payload)
        .eq("id", editingOrder.id);
      if (error) throw error;
      setShowOrderEditModal(false);
      setEditingOrder(null);
      loadOrders();
    } catch (e) {
      console.error("Error saving order:", e);
      const msg = t("common.error") || "Fehler beim Speichern";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setOrderSaving(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    const msg = t("magazyn.delete_order_confirm") || "Bestellung wirklich löschen?";
    const confirmed = Platform.OS === "web"
      ? window.confirm(msg)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t("common.delete") || "Löschen", msg, [
            { text: t("common.cancel") || "Abbrechen", style: "cancel", onPress: () => resolve(false) },
            { text: t("common.delete") || "Löschen", style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      const table = editingOrder?.order_type === "tool" ? "project_tool_orders" : "project_material_orders";
      const { error } = await (supabaseAdmin.from(table) as any)
        .delete()
        .eq("id", orderId);
      if (error) throw error;
      setShowOrderEditModal(false);
      setEditingOrder(null);
      loadOrders();
    } catch (e) {
      console.error("Error deleting order:", e);
      const errMsg = t("common.error") || "Fehler";
      if (Platform.OS === "web") window.alert(errMsg);
      else Alert.alert(errMsg);
    }
  };

  // ── Order columns for sort/filter ──
  const ordColumns = [
    { key: "project", label: "Projekt" },
    { key: "material", label: "Material/Werkzeug" },
    { key: "order_type", label: "Typ" },
    { key: "status", label: "Status" },
    { key: "ilosc", label: "Menge" },
    { key: "ordered_by", label: "Bestellt von" },
    { key: "created_at", label: "Erstellt" },
  ];

  const getOrderItemName = (o: any): string => {
    if (o.order_type === "tool") return o.tool?.beschreibung || "";
    return o.material?.nazwa || "";
  };

  const getOrdColVal = (o: any, key: string): string => {
    if (key === "project") return o.project?.name || "";
    if (key === "material") return getOrderItemName(o);
    if (key === "order_type") return o.order_type === "tool" ? "Werkzeug" : "Material";
    if (key === "ordered_by") return o.ordered_by_profile?.full_name || "";
    return (o[key] ?? "").toString();
  };

  const ordFilterColValues = ordFilterCol
    ? [...new Set(allOrders.map((o: any) => getOrdColVal(o, ordFilterCol).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
    : [];

  // Orders filter + sort
  const filteredOrders = allOrders
    .filter((o: any) => {
      if (ordFilterCol && ordFilterVal) {
        const val = getOrdColVal(o, ordFilterCol).toLowerCase();
        if (val !== ordFilterVal.toLowerCase()) return false;
      }
      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase();
      return (
        getOrderItemName(o).toLowerCase().includes(q) ||
        (o.material?.art_nr || "").toLowerCase().includes(q) ||
        (o.tool?.art_nr || "").toLowerCase().includes(q) ||
        (o.tool?.hersteller || "").toLowerCase().includes(q) ||
        (o.project?.name || "").toLowerCase().includes(q) ||
        (o.project?.project_number || "").toString().toLowerCase().includes(q) ||
        (o.status || "").toLowerCase().includes(q) ||
        (o.ordered_by_profile?.full_name || "").toLowerCase().includes(q) ||
        (o.order_type === "tool" ? "werkzeug" : "material").includes(q)
      );
    })
    .sort((a: any, b: any) => {
      let va: string, vb: string;
      if (orderSortKey === "material") { va = getOrderItemName(a).toLowerCase(); vb = getOrderItemName(b).toLowerCase(); }
      else if (orderSortKey === "project") { va = (a.project?.name || "").toLowerCase(); vb = (b.project?.name || "").toLowerCase(); }
      else if (orderSortKey === "order_type") { va = a.order_type || ""; vb = b.order_type || ""; }
      else { va = (a[orderSortKey] ?? "").toString().toLowerCase(); vb = (b[orderSortKey] ?? "").toString().toLowerCase(); }
      const cmp = va.localeCompare(vb, "de");
      return orderSortAsc ? cmp : -cmp;
    });

  const toggleOrderSort = (key: string) => {
    if (orderSortKey === key) setOrderSortAsc(!orderSortAsc);
    else { setOrderSortKey(key); setOrderSortAsc(false); }
  };

  return {
    // Data
    allOrders, ordersLoading,
    // Search
    orderSearch, setOrderSearch,
    // Sort & Filter
    orderSortKey, orderSortAsc, showOrdSortDD, setShowOrdSortDD,
    ordFilterCol, setOrdFilterCol, ordFilterVal, setOrdFilterVal,
    showOrdFilterDD, setShowOrdFilterDD, showOrdFilterValDD, setShowOrdFilterValDD,
    ordColumns, ordFilterColValues, filteredOrders, toggleOrderSort,
    getOrderItemName, getOrdColVal,
    // CRUD
    showOrderEditModal, setShowOrderEditModal,
    editingOrder, orderForm, setOrderForm, orderSaving,
    loadOrders, markOrdered, updateDeliveryDate,
    openEditOrder, saveOrder, deleteOrder,
  };
}
