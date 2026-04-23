/**
 * Hook zarządzający zamówieniami materiałów i narzędzi w projekcie.
 * Wydzielony z projects/[id].tsx dla redukcji rozmiaru god component.
 *
 * Faza 3: migracja na TanStack Query v5.
 * - 4 useQuery: materialsList (global warehouse), toolsList (global warehouse),
 *   projectMaterialOrders (per project), projectToolOrders (per project)
 * - 3 useMutation: submitOrder (single material), submitCartOrders (batch materials),
 *   submitToolCartOrders (batch tools)
 *
 * Sygnatura zewnetrzna zachowana, fetchMaterialsAndOrders/fetchToolsAndOrders
 * jako wrappery na .refetch() (uzywane przez fetchAll() w projects/[id].tsx).
 */

import { adminApi } from "@/src/lib/supabase/adminApi";
import { fetchProfileMap } from "@/src/services/profileService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { projectKeys } from "./useProjectData";

const supabaseAdmin = adminApi;

// Luzne typy dla magazynu/zamowien — shape zalezy od wybranego SELECT-a.
// Dokladniejsze typowanie wymagalo by aktualnych migracji warehouse_materials/warehouse_items (Faza dalej).
type MaterialRow = {
  id: string;
  nazwa?: string | null;
  art_nr?: string | null;
  pozycja?: string | null;
  ilosc?: number | string | null;
  dlugosc?: number | string | null;
  szerokosc?: number | string | null;
  wysokosc?: number | string | null;
  waga?: number | string | null;
  jednostka?: string | null;
  stan?: number | string | null;
  [key: string]: unknown;
};
type ToolRow = {
  id: string;
  beschreibung?: string | null;
  art_nr?: string | null;
  hersteller?: string | null;
  kategorie?: string | null;
  serial_nummer?: string | null;
  pozycja?: string | null;
  menge?: number | string | null;
  stan?: number | string | null;
  jednostka?: string | null;
  [key: string]: unknown;
};
type MaterialOrder = {
  id: string;
  ordered_by?: string | null;
  status?: string | null;
  created_at?: string | null;
  ordered_at?: string | null;
  data_dostawy?: string | null;
  uwagi?: string | null;
  ilosc?: number | string | null;
  material?: { nazwa?: string | null; art_nr?: string | null } | null;
  ordered_by_profile?: { full_name?: string | null } | null;
  [key: string]: unknown;
};
type ToolOrder = {
  id: string;
  ordered_by?: string | null;
  status?: string | null;
  created_at?: string | null;
  ordered_at?: string | null;
  data_dostawy?: string | null;
  uwagi?: string | null;
  ilosc?: number | string | null;
  tool?: { beschreibung?: string | null; art_nr?: string | null; hersteller?: string | null } | null;
  ordered_by_profile?: { full_name?: string | null } | null;
  [key: string]: unknown;
};

// ── Cache keys ──
export const warehouseKeys = {
  materials: () => ["warehouse", "materials"] as const,
  tools: () => ["warehouse", "tools"] as const,
};
export const projectOrdersKeys = {
  materialOrders: (projectId: string) => [...projectKeys.all(projectId), "materialOrders"] as const,
  toolOrders: (projectId: string) => [...projectKeys.all(projectId), "toolOrders"] as const,
};

// ── Pure fetchers ──
async function fetchAllMaterials(): Promise<MaterialRow[]> {
  const { data, error } = await supabaseAdmin.from("warehouse_materials").select("*").order("nazwa");
  if (error) throw error;
  return (data ?? []) as MaterialRow[];
}

async function fetchAllTools(): Promise<ToolRow[]> {
  const { data, error } = await supabaseAdmin.from("warehouse_items").select("*").order("beschreibung");
  if (error) throw error;
  return (data ?? []) as ToolRow[];
}

async function fetchProjectMaterialOrders(projectId: string): Promise<MaterialOrder[]> {
  const { data, error } = await supabaseAdmin.from("project_material_orders")
    .select("*, material:warehouse_materials(nazwa, art_nr, dlugosc, szerokosc, wysokosc, waga)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ordsTyped = (data ?? []) as MaterialOrder[];
  const userIds = [...new Set(ordsTyped.map((o) => o.ordered_by).filter((id): id is string => Boolean(id)))];
  const profileMap = await fetchProfileMap(userIds);
  return ordsTyped.map((o) => ({
    ...o,
    ordered_by_profile: { full_name: o.ordered_by ? profileMap[o.ordered_by] ?? null : null },
  }));
}

async function fetchProjectToolOrders(projectId: string): Promise<ToolOrder[]> {
  const { data, error } = await supabaseAdmin.from("project_tool_orders")
    .select("*, tool:warehouse_items(beschreibung, art_nr, hersteller, kategorie, serial_nummer)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ordsTyped = (data ?? []) as ToolOrder[];
  const userIds = [...new Set(ordsTyped.map((o) => o.ordered_by).filter((id): id is string => Boolean(id)))];
  const profileMap = await fetchProfileMap(userIds);
  return ordsTyped.map((o) => ({
    ...o,
    ordered_by_profile: { full_name: o.ordered_by ? profileMap[o.ordered_by] ?? null : null },
  }));
}

export function useProjectOrders(projectId: string | undefined, userId: string | undefined, t: TFunction) {
  const qc = useQueryClient();
  const enabled = !!projectId;
  const safeId = projectId ?? "";

  // ── Queries ──
  const materialsQuery = useQuery({
    queryKey: warehouseKeys.materials(),
    queryFn: fetchAllMaterials,
    enabled,
  });
  const toolsQuery = useQuery({
    queryKey: warehouseKeys.tools(),
    queryFn: fetchAllTools,
    enabled,
  });
  const materialOrdersQuery = useQuery({
    queryKey: projectOrdersKeys.materialOrders(safeId),
    queryFn: () => fetchProjectMaterialOrders(safeId),
    enabled,
  });
  const toolOrdersQuery = useQuery({
    queryKey: projectOrdersKeys.toolOrders(safeId),
    queryFn: () => fetchProjectToolOrders(safeId),
    enabled,
  });

  // ── Local UI state (form, modals, search, cart) ──
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ material_id: "", ilosc: "", uwagi: "" });
  const [orderMatSearch, setOrderMatSearch] = useState("");
  const [orderCart, setOrderCart] = useState<Record<string, string>>({});
  const [orderSubTab, setOrderSubTab] = useState<"materials" | "tools">("materials");
  const [showToolOrderModal, setShowToolOrderModal] = useState(false);
  const [toolOrderSearch, setToolOrderSearch] = useState("");
  const [toolOrderCart, setToolOrderCart] = useState<Record<string, string>>({});

  // ── Mutations ──

  const submitOrderMutation = useMutation({
    mutationFn: async (form: { material_id: string; ilosc: string; uwagi: string }) => {
      const { error } = await supabaseAdmin.from("project_material_orders").insert({
        project_id: safeId,
        material_id: form.material_id,
        ilosc: parseFloat(form.ilosc),
        uwagi: form.uwagi.trim() || null,
        ordered_by: userId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowOrderModal(false);
      setOrderForm({ material_id: "", ilosc: "", uwagi: "" });
      setOrderCart({});
      qc.invalidateQueries({ queryKey: projectOrdersKeys.materialOrders(safeId) });
      const msg = t("projects.order_created", "Bestellung erstellt");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    },
    onError: (e) => {
      console.error("Error creating order:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    },
  });

  const submitCartOrdersMutation = useMutation({
    mutationFn: async (entries: [string, string][]) => {
      const rows = entries.map(([matId, qty]) => ({
        project_id: safeId,
        material_id: matId,
        ilosc: parseFloat(qty),
        uwagi: null,
        ordered_by: userId,
        status: "pending",
      }));
      const { error } = await supabaseAdmin.from("project_material_orders").insert(rows);
      if (error) throw error;
      return entries.length;
    },
    onSuccess: (count) => {
      setShowOrderModal(false);
      setOrderCart({});
      setOrderMatSearch("");
      qc.invalidateQueries({ queryKey: projectOrdersKeys.materialOrders(safeId) });
      const msg = `${count} Bestellung(en) erstellt`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    },
    onError: (e) => {
      console.error("Error creating orders:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    },
  });

  const submitToolCartOrdersMutation = useMutation({
    mutationFn: async (entries: [string, string][]) => {
      const rows = entries.map(([toolId, qty]) => ({
        project_id: safeId,
        tool_id: toolId,
        ilosc: parseFloat(qty),
        uwagi: null,
        ordered_by: userId,
        status: "pending",
      }));
      const { error } = await supabaseAdmin.from("project_tool_orders").insert(rows);
      if (error) throw error;
      return entries.length;
    },
    onSuccess: (count) => {
      setShowToolOrderModal(false);
      setToolOrderCart({});
      setToolOrderSearch("");
      qc.invalidateQueries({ queryKey: projectOrdersKeys.toolOrders(safeId) });
      const msg = `${count} Werkzeugbestellung(en) erstellt`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    },
    onError: (e) => {
      console.error("Error creating tool orders:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    },
  });

  // ── Action wrappers (zachowuje API hooka) ──

  const fetchMaterialsAndOrders = async () => {
    await Promise.all([materialsQuery.refetch(), materialOrdersQuery.refetch()]);
  };
  const fetchToolsAndOrders = async () => {
    await Promise.all([toolsQuery.refetch(), toolOrdersQuery.refetch()]);
  };

  const submitOrder = () => {
    if (!safeId || !orderForm.material_id || !orderForm.ilosc) return;
    submitOrderMutation.mutate(orderForm);
  };

  const submitCartOrders = () => {
    if (!safeId) return;
    const entries = Object.entries(orderCart).filter(([_, qty]) => parseFloat(qty) > 0) as [string, string][];
    if (entries.length === 0) {
      const msg = "Bitte mindestens ein Material mit Menge auswählen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    submitCartOrdersMutation.mutate(entries);
  };

  const submitToolCartOrders = () => {
    if (!safeId) return;
    const entries = Object.entries(toolOrderCart).filter(([_, qty]) => parseFloat(qty) > 0) as [string, string][];
    if (entries.length === 0) {
      const msg = "Bitte mindestens ein Werkzeug mit Menge auswählen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    submitToolCartOrdersMutation.mutate(entries);
  };

  return {
    // ── Material orders ──
    materialsList: materialsQuery.data ?? [],
    projectOrders: materialOrdersQuery.data ?? [],
    showOrderModal, setShowOrderModal,
    orderForm, setOrderForm,
    orderSaving: submitOrderMutation.isPending || submitCartOrdersMutation.isPending,
    orderMatSearch, setOrderMatSearch,
    orderCart, setOrderCart,
    fetchMaterialsAndOrders,
    submitOrder,
    submitCartOrders,

    // ── Tool orders ──
    orderSubTab, setOrderSubTab,
    toolsList: toolsQuery.data ?? [],
    projectToolOrders: toolOrdersQuery.data ?? [],
    showToolOrderModal, setShowToolOrderModal,
    toolOrderSaving: submitToolCartOrdersMutation.isPending,
    toolOrderSearch, setToolOrderSearch,
    toolOrderCart, setToolOrderCart,
    fetchToolsAndOrders,
    submitToolCartOrders,
  };
}
