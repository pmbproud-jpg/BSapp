/**
 * Hook zarządzający zamówieniami magazynowymi (project_material_orders, project_tool_orders):
 * CRUD, sortowanie, filtrowanie. Używany w magazyn.tsx -> Bestellungen tab (wszystkie projekty).
 * Wydzielony z magazyn.tsx.
 *
 * Faza 3: migracja na TanStack Query v5.
 * - 1 useQuery: allOrders (combined material + tool orders, enriched z profile)
 * - 4 useMutation: markOrdered, updateDeliveryDate, saveOrder, deleteOrder
 *
 * Klucz cache: warehouseOrdersKey = ["warehouse", "orders", "all"] -- agregat
 * obu typow zamowien dla widoku magazyn-wide. Mutations invalidate ten klucz.
 */
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { fetchProfileMap } from "@/src/services/profileService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";

// Luźny typ dla Order — warehouse_items/materials mają rozbudowane SELECTy z join,
// których nie da się łatwo statycznie typować (różne shapes per rodzaj).
// Record<string, unknown> + rzutowane pola-klucze.
type Order = Record<string, unknown> & {
  id: string;
  order_type?: "material" | "tool";
  ordered_by?: string | null;
  created_at?: string;
  status?: string;
  data_dostawy?: string | null;
  uwagi?: string | null;
  ordered_at?: string | null;
  material?: { nazwa?: string; art_nr?: string };
  tool?: { beschreibung?: string; art_nr?: string; hersteller?: string };
  project?: { name?: string; project_number?: string };
  ordered_by_profile?: { full_name: string | null };
};

export const warehouseOrdersKey = ["warehouse", "orders", "all"] as const;

async function fetchAllWarehouseOrders(): Promise<Order[]> {
  const { data: matData, error: matErr } = await supabaseAdmin.from("project_material_orders")
    .select("*, material:warehouse_materials(nazwa, art_nr, dlugosc, szerokosc, wysokosc, waga), project:projects(name, project_number)")
    .order("created_at", { ascending: false });
  if (matErr) console.error("Material orders error:", matErr);
  const matOrders = ((matData ?? []) as Order[]).map((o) => ({ ...o, order_type: "material" as const }));

  const { data: toolData, error: toolErr } = await supabaseAdmin.from("project_tool_orders")
    .select("*, tool:warehouse_items(beschreibung, art_nr, hersteller, kategorie, serial_nummer), project:projects(name, project_number)")
    .order("created_at", { ascending: false });
  if (toolErr) console.error("Tool orders error:", toolErr);
  const toolOrders = ((toolData ?? []) as Order[]).map((o) => ({ ...o, order_type: "tool" as const }));

  const combined: Order[] = [...matOrders, ...toolOrders];
  const userIds = [...new Set(combined.map((o) => o.ordered_by).filter((id): id is string => Boolean(id)))];
  const profileMap = await fetchProfileMap(userIds);
  const enriched: Order[] = combined.map((o) => ({
    ...o,
    ordered_by_profile: { full_name: o.ordered_by ? profileMap[o.ordered_by] ?? null : null },
  }));
  enriched.sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime());
  return enriched;
}

export function useWarehouseOrders(t: TFunction) {
  const qc = useQueryClient();

  // ── Query ──
  const ordersQuery = useQuery({
    queryKey: warehouseOrdersKey,
    queryFn: fetchAllWarehouseOrders,
  });
  const allOrders = ordersQuery.data ?? [];

  // ── Local UI state ──
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
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderForm, setOrderForm] = useState({ status: "", ordered_at: "", data_dostawy: "", uwagi: "" });

  // ── Mutations ──

  const markOrderedMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabaseAdmin.from("project_material_orders")
        .update({ status: "ordered", ordered_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: warehouseOrdersKey }),
    onError: (e) => console.error("Error marking ordered:", e),
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: async ({ orderId, date }: { orderId: string; date: string }) => {
      const { error } = await supabaseAdmin.from("project_material_orders")
        .update({ data_dostawy: date, status: "delivered" })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: warehouseOrdersKey }),
    onError: (e) => console.error("Error updating delivery date:", e),
  });

  const saveOrderMutation = useMutation({
    mutationFn: async ({ table, orderId, payload }: { table: "project_material_orders" | "project_tool_orders"; orderId: string; payload: Record<string, unknown> }) => {
      const { error } = await supabaseAdmin.from(table).update(payload).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowOrderEditModal(false);
      setEditingOrder(null);
      qc.invalidateQueries({ queryKey: warehouseOrdersKey });
    },
    onError: (e) => {
      console.error("Error saving order:", e);
      const msg = t("common.error") || "Fehler beim Speichern";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async ({ table, orderId }: { table: "project_material_orders" | "project_tool_orders"; orderId: string }) => {
      const { error } = await supabaseAdmin.from(table).delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowOrderEditModal(false);
      setEditingOrder(null);
      qc.invalidateQueries({ queryKey: warehouseOrdersKey });
    },
    onError: (e) => {
      console.error("Error deleting order:", e);
      const errMsg = t("common.error") || "Fehler";
      if (Platform.OS === "web") window.alert(errMsg);
      else Alert.alert(errMsg);
    },
  });

  // ── Action wrappers ──

  const loadOrders = async () => { await ordersQuery.refetch(); };

  const markOrdered = (orderId: string) => markOrderedMutation.mutate(orderId);
  const updateDeliveryDate = (orderId: string, date: string) =>
    updateDeliveryMutation.mutate({ orderId, date });

  const openEditOrder = (order: Order) => {
    setEditingOrder(order);
    setOrderForm({
      status: String(order.status ?? "pending"),
      ordered_at: order.ordered_at ? new Date(order.ordered_at).toISOString().slice(0, 10) : "",
      data_dostawy: String(order.data_dostawy ?? ""),
      uwagi: String(order.uwagi ?? ""),
    });
    setShowOrderEditModal(true);
  };

  const saveOrder = () => {
    if (!editingOrder) return;
    const table = editingOrder.order_type === "tool" ? "project_tool_orders" : "project_material_orders";
    const payload: Record<string, unknown> = {
      status: orderForm.status || "pending",
      uwagi: orderForm.uwagi.trim() || null,
      ordered_at: orderForm.ordered_at.trim() || null,
      data_dostawy: orderForm.data_dostawy.trim() || null,
    };
    saveOrderMutation.mutate({ table, orderId: editingOrder.id, payload });
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
    const table = editingOrder?.order_type === "tool" ? "project_tool_orders" : "project_material_orders";
    deleteOrderMutation.mutate({ table, orderId });
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

  const getOrderItemName = (o: Order): string => {
    if (o.order_type === "tool") return o.tool?.beschreibung || "";
    return o.material?.nazwa || "";
  };

  const getOrdColVal = (o: Order, key: string): string => {
    if (key === "project") return o.project?.name || "";
    if (key === "material") return getOrderItemName(o);
    if (key === "order_type") return o.order_type === "tool" ? "Werkzeug" : "Material";
    if (key === "ordered_by") return o.ordered_by_profile?.full_name || "";
    return (o[key] ?? "").toString();
  };

  const ordFilterColValues = ordFilterCol
    ? [...new Set(allOrders.map((o) => getOrdColVal(o, ordFilterCol).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
    : [];

  const filteredOrders = allOrders
    .filter((o) => {
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
    .sort((a, b) => {
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
    allOrders,
    ordersLoading: ordersQuery.isPending,
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
    editingOrder, orderForm, setOrderForm,
    orderSaving: saveOrderMutation.isPending,
    loadOrders, markOrdered, updateDeliveryDate,
    openEditOrder, saveOrder, deleteOrder,
  };
}
