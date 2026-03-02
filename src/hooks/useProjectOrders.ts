/**
 * Hook zarządzający zamówieniami materiałów i narzędzi w projekcie.
 * Wydzielony z projects/[id].tsx dla redukcji rozmiaru god component.
 */

import { adminApi } from "@/src/lib/supabase/adminApi";
import { fetchProfileMap } from "@/src/services/profileService";
import { useState } from "react";
import { Alert, Platform } from "react-native";

const supabaseAdmin = adminApi;

export function useProjectOrders(projectId: string | undefined, userId: string | undefined, t: any) {

  // Material orders state
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [projectOrders, setProjectOrders] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ material_id: "", ilosc: "", uwagi: "" });
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderMatSearch, setOrderMatSearch] = useState("");
  const [orderCart, setOrderCart] = useState<Record<string, string>>({});

  // Tool orders state
  const [orderSubTab, setOrderSubTab] = useState<"materials" | "tools">("materials");
  const [toolsList, setToolsList] = useState<any[]>([]);
  const [projectToolOrders, setProjectToolOrders] = useState<any[]>([]);
  const [showToolOrderModal, setShowToolOrderModal] = useState(false);
  const [toolOrderSaving, setToolOrderSaving] = useState(false);
  const [toolOrderSearch, setToolOrderSearch] = useState("");
  const [toolOrderCart, setToolOrderCart] = useState<Record<string, string>>({});

  const fetchMaterialsAndOrders = async () => {
    if (!projectId) return;
    try {
      const { data: mats } = await supabaseAdmin.from("warehouse_materials").select("*").order("nazwa");
      setMaterialsList(mats || []);
      const { data: ords, error: ordErr } = await supabaseAdmin.from("project_material_orders")
        .select("*, material:warehouse_materials(nazwa, art_nr, dlugosc, szerokosc, wysokosc, waga)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (ordErr) { console.error("Orders fetch error:", ordErr); setProjectOrders([]); return; }
      const userIds = [...new Set((ords || []).map((o: any) => o.ordered_by).filter(Boolean))] as string[];
      const profileMap = await fetchProfileMap(userIds);
      const enriched = (ords || []).map((o: any) => ({
        ...o,
        ordered_by_profile: { full_name: profileMap[o.ordered_by] || null },
      }));
      setProjectOrders(enriched);
    } catch (e) {
      console.error("Error fetching materials/orders:", e);
    }
  };

  const submitOrder = async () => {
    if (!orderForm.material_id || !orderForm.ilosc) return;
    setOrderSaving(true);
    try {
      const { error } = await supabaseAdmin.from("project_material_orders").insert({
        project_id: projectId,
        material_id: orderForm.material_id,
        ilosc: parseFloat(orderForm.ilosc),
        uwagi: orderForm.uwagi.trim() || null,
        ordered_by: userId,
        status: "pending",
      });
      if (error) throw error;
      setShowOrderModal(false);
      setOrderForm({ material_id: "", ilosc: "", uwagi: "" });
      setOrderCart({});
      fetchMaterialsAndOrders();
      const msg = t("projects.order_created", "Bestellung erstellt");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error creating order:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setOrderSaving(false);
    }
  };

  const submitCartOrders = async () => {
    const entries = Object.entries(orderCart).filter(([_, qty]) => parseFloat(qty) > 0);
    if (entries.length === 0) {
      const msg = "Bitte mindestens ein Material mit Menge auswählen";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    setOrderSaving(true);
    try {
      const rows = entries.map(([matId, qty]) => ({
        project_id: projectId,
        material_id: matId,
        ilosc: parseFloat(qty),
        uwagi: null,
        ordered_by: userId,
        status: "pending",
      }));
      const { error } = await supabaseAdmin.from("project_material_orders").insert(rows);
      if (error) throw error;
      setShowOrderModal(false);
      setOrderCart({});
      setOrderMatSearch("");
      fetchMaterialsAndOrders();
      const msg = `${entries.length} Bestellung(en) erstellt`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error creating orders:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setOrderSaving(false);
    }
  };

  const fetchToolsAndOrders = async () => {
    if (!projectId) return;
    try {
      const { data: tools } = await supabaseAdmin.from("warehouse_items").select("*").order("beschreibung");
      setToolsList(tools || []);
      const { data: ords, error: ordErr } = await supabaseAdmin.from("project_tool_orders")
        .select("*, tool:warehouse_items(beschreibung, art_nr, hersteller, kategorie, serial_nummer)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (ordErr) { console.error("Tool orders fetch error:", ordErr); setProjectToolOrders([]); return; }
      const userIds = [...new Set((ords || []).map((o: any) => o.ordered_by).filter(Boolean))] as string[];
      const profileMap = await fetchProfileMap(userIds);
      const enriched = (ords || []).map((o: any) => ({
        ...o,
        ordered_by_profile: { full_name: profileMap[o.ordered_by] || null },
      }));
      setProjectToolOrders(enriched);
    } catch (e) {
      console.error("Error fetching tools/orders:", e);
    }
  };

  const submitToolCartOrders = async () => {
    const entries = Object.entries(toolOrderCart).filter(([_, qty]) => parseFloat(qty) > 0);
    if (entries.length === 0) {
      const msg = "Bitte mindestens ein Werkzeug mit Menge auswählen";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    setToolOrderSaving(true);
    try {
      const rows = entries.map(([toolId, qty]) => ({
        project_id: projectId,
        tool_id: toolId,
        ilosc: parseFloat(qty),
        uwagi: null,
        ordered_by: userId,
        status: "pending",
      }));
      const { error } = await supabaseAdmin.from("project_tool_orders").insert(rows);
      if (error) throw error;
      setShowToolOrderModal(false);
      setToolOrderCart({});
      setToolOrderSearch("");
      fetchToolsAndOrders();
      const msg = `${entries.length} Werkzeugbestellung(en) erstellt`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error creating tool orders:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setToolOrderSaving(false);
    }
  };

  return {
    // Material orders
    materialsList,
    projectOrders,
    showOrderModal, setShowOrderModal,
    orderForm, setOrderForm,
    orderSaving,
    orderMatSearch, setOrderMatSearch,
    orderCart, setOrderCart,
    fetchMaterialsAndOrders,
    submitOrder,
    submitCartOrders,

    // Tool orders
    orderSubTab, setOrderSubTab,
    toolsList,
    projectToolOrders,
    showToolOrderModal, setShowToolOrderModal,
    toolOrderSaving,
    toolOrderSearch, setToolOrderSearch,
    toolOrderCart, setToolOrderCart,
    fetchToolsAndOrders,
    submitToolCartOrders,
  };
}
