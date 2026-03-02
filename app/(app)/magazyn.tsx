import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { orderStatusColors } from "@/src/constants/colors";
import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { fetchProfileMap } from "@/src/services/profileService";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";

type WarehouseItem = {
  id: string;
  iv_pds: string | null;
  menge: string | null;
  beschreibung: string | null;
  serial_nummer: string | null;
  akku_serial_nummer: string | null;
  ladegeraet_sn: string | null;
  status: string | null;
  datum_abgeben: string | null;
  baustelle: string | null;
  hersteller: string | null;
  inventar: string | null;
  aufmerksamkeit: string | null;
  art_nr: string | null;
  datum_inventur: string | null;
  kategorie: string | null;
  wartungstermine: string | null;
  assigned_to: string | null;
  assigned_to_profile?: { full_name: string | null } | null;
  notes: string | null;
  is_damaged: boolean;
  created_at: string;
};

const EMPTY_FORM = {
  iv_pds: "", menge: "", beschreibung: "", serial_nummer: "", akku_serial_nummer: "",
  ladegeraet_sn: "", status: "", datum_abgeben: "", baustelle: "",
  hersteller: "", inventar: "", aufmerksamkeit: "", art_nr: "", datum_inventur: "",
  kategorie: "", wartungstermine: "", assigned_to: "",
};

const FIELDS: { key: keyof typeof EMPTY_FORM; label: string; labelDE: string }[] = [
  { key: "iv_pds", label: "IV / PDS", labelDE: "IV / PDS" },
  { key: "menge", label: "Menge", labelDE: "Menge" },
  { key: "beschreibung", label: "Beschreibung", labelDE: "Beschreibung" },
  { key: "serial_nummer", label: "Serial Nummer", labelDE: "Serial Nummer" },
  { key: "akku_serial_nummer", label: "Akku Serial Nummer", labelDE: "Akku Serial Nummer" },
  { key: "ladegeraet_sn", label: "Ladegerät S.N", labelDE: "Ladegerät S.N" },
  { key: "status", label: "Status", labelDE: "Status" },
  { key: "datum_abgeben", label: "Datum Abgeben", labelDE: "Datum Abgeben" },
  { key: "baustelle", label: "Baustelle", labelDE: "Baustelle" },
  { key: "hersteller", label: "Hersteller", labelDE: "Hersteller" },
  { key: "inventar", label: "Inventar", labelDE: "Inventar" },
  { key: "aufmerksamkeit", label: "Aufmerksamkeit", labelDE: "Aufmerksamkeit" },
  { key: "art_nr", label: "Art-Nr", labelDE: "Art-Nr" },
  { key: "datum_inventur", label: "Datum Inventur", labelDE: "Datum Inventur" },
  { key: "kategorie", label: "Kategorie", labelDE: "Kategorie" },
  { key: "wartungstermine", label: "Wartungstermine 2026", labelDE: "Wartungstermine 2026" },
];

// ═══════════════════════════════════════
// MATERIAŁY (Materials)
// ═══════════════════════════════════════
type MaterialItem = {
  id: string;
  pozycja: string | null;
  art_nr: string | null;
  nazwa: string | null;
  ilosc: number | null;
  dlugosc: string | null;
  szerokosc: string | null;
  wysokosc: string | null;
  waga: string | null;
  zamawiajacy: string | null;
  data_zamowienia: string | null;
  data_dostawy: string | null;
  min_stan: number | null;
  created_by: string | null;
  created_at: string;
};

const MAT_EMPTY = {
  pozycja: "", art_nr: "", nazwa: "", ilosc: "", dlugosc: "", szerokosc: "",
  wysokosc: "", waga: "", zamawiajacy: "", data_zamowienia: "", data_dostawy: "", min_stan: "",
};

const MAT_FIELDS: { key: keyof typeof MAT_EMPTY; label: string; labelDE: string; numeric?: boolean }[] = [
  { key: "pozycja", label: "Position", labelDE: "Position" },
  { key: "art_nr", label: "Art-Nr", labelDE: "Art-Nr" },
  { key: "nazwa", label: "Name", labelDE: "Name" },
  { key: "ilosc", label: "Menge", labelDE: "Menge", numeric: true },
  { key: "dlugosc", label: "Länge [mm]", labelDE: "Länge [mm]" },
  { key: "szerokosc", label: "Breite [mm]", labelDE: "Breite [mm]" },
  { key: "wysokosc", label: "Höhe [mm]", labelDE: "Höhe [mm]" },
  { key: "waga", label: "Gewicht [kg]", labelDE: "Gewicht [kg]" },
  { key: "zamawiajacy", label: "Eingetragen von", labelDE: "Eingetragen von" },
  { key: "data_zamowienia", label: "Bestelldatum", labelDE: "Bestelldatum" },
  { key: "data_dostawy", label: "Lieferdatum", labelDE: "Lieferdatum" },
  { key: "min_stan", label: "Mindestbestand", labelDE: "Mindestbestand", numeric: true },
];

export default function MagazynScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: tc } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<"tools" | "materials" | "orders">("tools");

  // Orders state
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Tools state
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);

  // Users for assignment
  const [allUsers, setAllUsers] = useState<{ id: string; full_name: string }[]>([]);
  // Projects for baustelle picker
  const [allProjects, setAllProjects] = useState<{ id: string; name: string; project_number: string | null; location: string | null }[]>([]);
  const [showBaustellePicker, setShowBaustellePicker] = useState(false);
  const [baustelleSearch, setBaustelleSearch] = useState("");

  // Tools sorting & filtering
  const [toolSortKey, setToolSortKey] = useState<string>("iv_pds");
  const [toolSortAsc, setToolSortAsc] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showFilterValueDropdown, setShowFilterValueDropdown] = useState(false);
  const [showStatusUserModal, setShowStatusUserModal] = useState(false);
  const [statusUserItem, setStatusUserItem] = useState<WarehouseItem | null>(null);
  const [statusUserSearch, setStatusUserSearch] = useState("");

  // Notes modal
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesItem, setNotesItem] = useState<WarehouseItem | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesDamaged, setNotesDamaged] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  // Materials state
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [matLoading, setMatLoading] = useState(true);
  const [matSearch, setMatSearch] = useState("");
  const [matImportLoading, setMatImportLoading] = useState(false);
  const [showMatModal, setShowMatModal] = useState(false);
  const [matSortKey, setMatSortKey] = useState<string>("pozycja");
  const [matSortAsc, setMatSortAsc] = useState(true);
  const [showMatSortDD, setShowMatSortDD] = useState(false);
  const [matFilterCol, setMatFilterCol] = useState<string>("");
  const [matFilterVal, setMatFilterVal] = useState<string>("");
  const [showMatFilterDD, setShowMatFilterDD] = useState(false);
  const [showMatFilterValDD, setShowMatFilterValDD] = useState(false);

  // Orders search/sort
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
  const [editingMat, setEditingMat] = useState<MaterialItem | null>(null);
  const [matForm, setMatForm] = useState({ ...MAT_EMPTY });
  const [matSaving, setMatSaving] = useState(false);
  const [selectedMat, setSelectedMat] = useState<MaterialItem | null>(null);

  const canManage = perms.canEditWarehouse;
  const canManageMaterials = perms.canEditWarehouse || perms.canOrderMaterials;

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadMaterials();
      loadUsers();
      loadProjects();
      loadOrders();
    }, [])
  );

  const loadUsers = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      setAllUsers((data || []).filter((u: any) => u.full_name).map((u: any) => ({ id: u.id, full_name: u.full_name || "" })));
    } catch (e) { console.error("Error loading users:", e); }
  };

  const loadProjects = async () => {
    try {
      const { data } = await (supabaseAdmin.from("projects") as any).select("id, name, project_number, location").order("name");
      setAllProjects(data || []);
    } catch (e) { console.error("Error loading projects:", e); }
  };

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

  const loadData = async () => {
    try {
      const { data, error } = await (supabaseAdmin.from("warehouse_items") as any)
        .select("*")
        .order("iv_pds", { ascending: true });
      if (error) throw error;
      // Enrich with assigned_to profile names
      const assignedIds = [...new Set((data || []).map((i: any) => i.assigned_to).filter(Boolean))] as string[];
      const profileMap = await fetchProfileMap(assignedIds);
      const enriched = (data || []).map((i: any) => ({
        ...i,
        assigned_to_profile: i.assigned_to ? { full_name: profileMap[i.assigned_to] || null } : null,
      }));
      setItems(enriched);
    } catch (error) {
      console.error("Error loading magazyn data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── CRUD ──
  const openAdd = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (item: WarehouseItem) => {
    setEditingItem(item);
    setForm({
      iv_pds: item.iv_pds || "",
      menge: item.menge || "",
      beschreibung: item.beschreibung || "",
      serial_nummer: item.serial_nummer || "",
      akku_serial_nummer: item.akku_serial_nummer || "",
      ladegeraet_sn: item.ladegeraet_sn || "",
      status: item.status || "",
      datum_abgeben: item.datum_abgeben || "",
      baustelle: item.baustelle || "",
      hersteller: item.hersteller || "",
      inventar: item.inventar || "",
      aufmerksamkeit: item.aufmerksamkeit || "",
      art_nr: item.art_nr || "",
      datum_inventur: item.datum_inventur || "",
      kategorie: item.kategorie || "",
      wartungstermine: item.wartungstermine || "",
      assigned_to: item.assigned_to || "",
    });
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.beschreibung.trim()) {
      const msg = t("magazyn.description_required") || "Opis jest wymagany";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        iv_pds: form.iv_pds.trim() || null,
        menge: form.menge.trim() || null,
        beschreibung: form.beschreibung.trim(),
        serial_nummer: form.serial_nummer.trim() || null,
        akku_serial_nummer: form.akku_serial_nummer.trim() || null,
        ladegeraet_sn: form.ladegeraet_sn.trim() || null,
        status: form.status.trim() || null,
        datum_abgeben: form.datum_abgeben.trim() || null,
        baustelle: form.baustelle.trim() || null,
        hersteller: form.hersteller.trim() || null,
        inventar: form.inventar.trim() || null,
        aufmerksamkeit: form.aufmerksamkeit.trim() || null,
        art_nr: form.art_nr.trim() || null,
        datum_inventur: form.datum_inventur.trim() || null,
        kategorie: form.kategorie.trim() || null,
        wartungstermine: form.wartungstermine.trim() || null,
        assigned_to: form.assigned_to.trim() || null,
      };
      // Auto-set status to user name when assigned
      if (payload.assigned_to) {
        const assignedUser = allUsers.find(u => u.id === payload.assigned_to);
        if (assignedUser) payload.status = assignedUser.full_name;
      }

      if (editingItem) {
        const { error } = await (supabaseAdmin.from("warehouse_items") as any)
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        payload.created_by = profile?.id || null;
        const { error } = await (supabaseAdmin.from("warehouse_items") as any)
          .insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error("Error saving item:", error);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: WarehouseItem) => {
    const msg = t("magazyn.delete_confirm") || `Usunąć "${item.beschreibung}"?`;
    const confirmed = Platform.OS === "web"
      ? window.confirm(msg)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t("common.delete"), msg, [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      const { error } = await (supabaseAdmin.from("warehouse_items") as any)
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // ── EXCEL IMPORT ──
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
      });
      if (result.canceled || !result.assets?.[0]) return;

      setImportLoading(true);
      const file = result.assets[0];

      if (Platform.OS === "web") {
        // Web: use FileReader + XLSX
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            await processImportRows(rows);
          } catch (err) {
            console.error("Import error:", err);
            window.alert(t("magazyn.import_error") || "Importfehler");
          } finally {
            setImportLoading(false);
          }
        };
        reader.readAsArrayBuffer(blob);
      } else {
        // Mobile: read file
        try {
          const fileContent = await FileSystem.readAsStringAsync(file.uri, {
            encoding: "base64" as any,
          });
          const workbook = XLSX.read(fileContent, { type: "base64" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          await processImportRows(rows);
        } catch (err) {
          console.error("Import error:", err);
          Alert.alert(t("common.error"), t("magazyn.import_error") || "Importfehler");
        } finally {
          setImportLoading(false);
        }
      }
    } catch (error) {
      console.error("Document picker error:", error);
      setImportLoading(false);
    }
  };

  const processImportRows = async (rows: any[][]) => {
    // Skip header row (row 0), process data rows
    const dataRows = rows.slice(1).filter((r) => r.length > 0 && r.some((c: any) => c != null && c !== ""));
    if (dataRows.length === 0) {
      const msg = t("magazyn.import_empty") || "Datei enthält keine Daten";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }

    const itemsToInsert = dataRows.map((row) => ({
      iv_pds: row[0] != null ? String(row[0]) : null,
      menge: row[1] != null ? String(row[1]) : null,
      beschreibung: row[2] != null ? String(row[2]) : null,
      serial_nummer: row[3] != null ? String(row[3]) : null,
      akku_serial_nummer: row[4] != null ? String(row[4]) : null,
      ladegeraet_sn: row[5] != null ? String(row[5]) : null,
      status: row[6] != null ? String(row[6]) : null,
      datum_abgeben: row[7] != null ? String(row[7]) : null,
      baustelle: row[8] != null ? String(row[8]) : null,
      hersteller: row[9] != null ? String(row[9]) : null,
      inventar: row[10] != null ? String(row[10]) : null,
      aufmerksamkeit: row[11] != null ? String(row[11]) : null,
      art_nr: row[12] != null ? String(row[12]) : null,
      datum_inventur: row[13] != null ? String(row[13]) : null,
      kategorie: row[14] != null ? String(row[14]) : null,
      wartungstermine: row[15] != null ? String(row[15]) : null,
      created_by: profile?.id || null,
    }));

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < itemsToInsert.length; i += 50) {
      const batch = itemsToInsert.slice(i, i + 50);
      const { error } = await (supabaseAdmin.from("warehouse_items") as any).insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
      } else {
        inserted += batch.length;
      }
    }

    const msg = (t("magazyn.import_success") || "Importiert") + `: ${inserted} / ${itemsToInsert.length}`;
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert(t("common.success"), msg);
    loadData();
  };

  // ══════════════════════════════════════
  // MATERIALS CRUD
  // ══════════════════════════════════════
  const loadMaterials = async () => {
    try {
      const { data, error } = await (supabaseAdmin.from("warehouse_materials") as any)
        .select("*")
        .order("pozycja", { ascending: true });
      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error("Error loading materials:", error);
    } finally {
      setMatLoading(false);
    }
  };

  const openAddMat = () => {
    setEditingMat(null);
    setMatForm({ ...MAT_EMPTY, zamawiajacy: profile?.full_name || "" });
    setShowMatModal(true);
  };

  const openEditMat = (item: MaterialItem) => {
    setEditingMat(item);
    setMatForm({
      pozycja: item.pozycja || "",
      art_nr: item.art_nr || "",
      nazwa: item.nazwa || "",
      ilosc: item.ilosc != null ? String(item.ilosc) : "",
      dlugosc: item.dlugosc || "",
      szerokosc: item.szerokosc || "",
      wysokosc: item.wysokosc || "",
      waga: item.waga || "",
      zamawiajacy: item.zamawiajacy || "",
      data_zamowienia: item.data_zamowienia || "",
      data_dostawy: item.data_dostawy || "",
      min_stan: item.min_stan != null ? String(item.min_stan) : "",
    });
    setShowMatModal(true);
  };

  const saveMatItem = async () => {
    setMatSaving(true);
    try {
      const payload: any = {
        pozycja: matForm.pozycja.trim() || null,
        art_nr: matForm.art_nr.trim() || null,
        nazwa: matForm.nazwa.trim() || null,
        ilosc: matForm.ilosc ? parseFloat(matForm.ilosc) : null,
        dlugosc: matForm.dlugosc.trim() || null,
        szerokosc: matForm.szerokosc.trim() || null,
        wysokosc: matForm.wysokosc.trim() || null,
        waga: matForm.waga.trim() || null,
        zamawiajacy: matForm.zamawiajacy.trim() || profile?.full_name || null,
        data_zamowienia: matForm.data_zamowienia.trim() || null,
        data_dostawy: matForm.data_dostawy.trim() || null,
        min_stan: matForm.min_stan ? parseFloat(matForm.min_stan) : null,
      };
      if (editingMat) {
        const { error } = await (supabaseAdmin.from("warehouse_materials") as any).update(payload).eq("id", editingMat.id);
        if (error) throw error;
      } else {
        payload.created_by = profile?.id || null;
        const { error } = await (supabaseAdmin.from("warehouse_materials") as any).insert(payload);
        if (error) throw error;
      }
      setShowMatModal(false);
      loadMaterials();
    } catch (error) {
      console.error("Error saving material:", error);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setMatSaving(false);
    }
  };

  const deleteMatItem = async (item: MaterialItem) => {
    const msg = t("magazyn.delete_confirm") || `Usunąć "${item.nazwa}"?`;
    const confirmed = Platform.OS === "web"
      ? window.confirm(msg)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t("common.delete"), msg, [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      const { error } = await (supabaseAdmin.from("warehouse_materials") as any).delete().eq("id", item.id);
      if (error) throw error;
      setSelectedMat(null);
      loadMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
    }
  };

  // Materials import
  const handleMatImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
      });
      if (result.canceled || !result.assets?.[0]) return;
      setMatImportLoading(true);
      const file = result.assets[0];

      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            await processMatImportRows(rows);
          } catch (err) {
            console.error("Mat import error:", err);
            window.alert(t("magazyn.import_error") || "Importfehler");
          } finally { setMatImportLoading(false); }
        };
        reader.readAsArrayBuffer(blob);
      } else {
        try {
          const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: "base64" as any });
          const workbook = XLSX.read(fileContent, { type: "base64" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          await processMatImportRows(rows);
        } catch (err) {
          console.error("Mat import error:", err);
          Alert.alert(t("common.error"), t("magazyn.import_error") || "Importfehler");
        } finally { setMatImportLoading(false); }
      }
    } catch (error) {
      console.error("Document picker error:", error);
      setMatImportLoading(false);
    }
  };

  const processMatImportRows = async (rows: any[][]) => {
    const dataRows = rows.slice(1).filter((r) => r.length > 0 && r.some((c: any) => c != null && c !== ""));
    if (dataRows.length === 0) {
      const msg = t("magazyn.import_empty") || "Datei enthält keine Daten";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    const toInsert = dataRows.map((row) => ({
      pozycja: row[0] != null ? String(row[0]) : null,
      art_nr: row[1] != null ? String(row[1]) : null,
      nazwa: row[2] != null ? String(row[2]) : null,
      ilosc: row[3] != null && row[3] !== "" ? parseFloat(String(row[3]).replace(",", ".")) : null,
      dlugosc: row[4] != null ? String(row[4]) : null,
      szerokosc: row[5] != null ? String(row[5]) : null,
      wysokosc: row[6] != null ? String(row[6]) : null,
      waga: row[7] != null ? String(row[7]) : null,
      zamawiajacy: row[8] != null ? String(row[8]) : null,
      data_zamowienia: row[9] != null ? String(row[9]) : null,
      data_dostawy: row[10] != null ? String(row[10]) : null,
      min_stan: row[11] != null && row[11] !== "" ? parseFloat(String(row[11]).replace(",", ".")) : null,
      created_by: profile?.id || null,
    }));
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error } = await (supabaseAdmin.from("warehouse_materials") as any).insert(batch);
      if (error) console.error("Batch insert error:", error);
      else inserted += batch.length;
    }
    const msg = (t("magazyn.import_success") || "Importiert") + `: ${inserted} / ${toInsert.length}`;
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert(t("common.success"), msg);
    loadMaterials();
  };

  // Materials export
  const handleMatExport = () => {
    try {
      const exportData = materials.map((m) => ({
        "Position": m.pozycja || "",
        "Art-Nr": m.art_nr || "",
        "Name": m.nazwa || "",
        "Menge": m.ilosc ?? "",
        "Länge [mm]": m.dlugosc || "",
        "Breite [mm]": m.szerokosc || "",
        "Höhe [mm]": m.wysokosc || "",
        "Gewicht [kg]": m.waga || "",
        "Eingetragen von": m.zamawiajacy || "",
        "Bestelldatum": m.data_zamowienia || "",
        "Lieferdatum": m.data_dostawy || "",
        "Mindestbestand": m.min_stan ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Materialien");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

      if (Platform.OS === "web") {
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), (c) => c.charCodeAt(0))],
          { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `materialien_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert(t("common.success"), "Export nur auf Web verfügbar");
      }
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  // Materials filter + sort
  // Material columns for sort/filter
  const matColumns = [
    { key: "pozycja", label: "Position" },
    { key: "art_nr", label: "Art-Nr" },
    { key: "nazwa", label: "Name" },
    { key: "ilosc", label: "Menge" },
    { key: "zamawiajacy", label: "Eingetragen von" },
    { key: "dlugosc", label: "Länge" },
    { key: "szerokosc", label: "Breite" },
    { key: "wysokosc", label: "Höhe" },
    { key: "waga", label: "Gewicht" },
  ];
  const matFilterColValues = matFilterCol
    ? [...new Set(materials.map((i) => ((i as any)[matFilterCol] ?? "").toString().trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
    : [];

  const filteredMat = materials
    .filter((item) => {
      if (matFilterCol && matFilterVal) {
        const val = ((item as any)[matFilterCol] ?? "").toString().toLowerCase();
        if (val !== matFilterVal.toLowerCase()) return false;
      }
      if (!matSearch.trim()) return true;
      const q = matSearch.toLowerCase();
      return (
        (item.nazwa || "").toLowerCase().includes(q) ||
        (item.art_nr || "").toLowerCase().includes(q) ||
        (item.pozycja || "").toLowerCase().includes(q) ||
        (item.zamawiajacy || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const va = ((a as any)[matSortKey] ?? "").toString().toLowerCase();
      const vb = ((b as any)[matSortKey] ?? "").toString().toLowerCase();
      const cmp = va.localeCompare(vb, "de");
      return matSortAsc ? cmp : -cmp;
    });

  const toggleMatSort = (key: string) => {
    if (matSortKey === key) setMatSortAsc(!matSortAsc);
    else { setMatSortKey(key); setMatSortAsc(true); }
  };

  // Order columns for sort/filter
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

  // ── Sortable / filterable columns definition ──
  const toolColumns = [
    { key: "iv_pds", label: "IV/PDS" },
    { key: "beschreibung", label: "Beschreibung" },
    { key: "hersteller", label: "Hersteller" },
    { key: "serial_nummer", label: "SN" },
    { key: "status", label: "Status" },
    { key: "baustelle", label: "Baustelle" },
    { key: "kategorie", label: "Kategorie" },
    { key: "menge", label: "Menge" },
    { key: "art_nr", label: "Art-Nr" },
    { key: "inventar", label: "Inventar" },
  ];

  // Unique values for selected filter column
  const filterColumnValues = filterColumn
    ? [...new Set(items.map((i) => ((i as any)[filterColumn] || "").toString().trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
    : [];

  // ── FILTER + SORT (tools) ──
  const filtered = items
    .filter((item) => {
      // Column filter
      if (filterColumn && filterValue) {
        const val = ((item as any)[filterColumn] || "").toString().toLowerCase();
        if (val !== filterValue.toLowerCase()) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (item.beschreibung || "").toLowerCase().includes(q) ||
        (item.serial_nummer || "").toLowerCase().includes(q) ||
        (item.hersteller || "").toLowerCase().includes(q) ||
        (item.baustelle || "").toLowerCase().includes(q) ||
        (item.iv_pds || "").toLowerCase().includes(q) ||
        (item.inventar || "").toLowerCase().includes(q) ||
        (item.kategorie || "").toLowerCase().includes(q) ||
        (item.akku_serial_nummer || "").toLowerCase().includes(q) ||
        (item.art_nr || "").toLowerCase().includes(q) ||
        (item.status || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const va = ((a as any)[toolSortKey] || "").toString().toLowerCase();
      const vb = ((b as any)[toolSortKey] || "").toString().toLowerCase();
      const cmp = va.localeCompare(vb, "de");
      return toolSortAsc ? cmp : -cmp;
    });

  const toggleToolSort = (key: string) => {
    if (toolSortKey === key) setToolSortAsc(!toolSortAsc);
    else { setToolSortKey(key); setToolSortAsc(true); }
  };

  // ── TOOLS EXPORT ──
  const handleToolsExport = () => {
    try {
      const exportData = items.map((item) => ({
        "IV/PDS": item.iv_pds || "",
        "Beschreibung": item.beschreibung || "",
        "Hersteller": item.hersteller || "",
        "Serial Nr.": item.serial_nummer || "",
        "Akku S.N.": item.akku_serial_nummer || "",
        "Ladegerät S.N.": item.ladegeraet_sn || "",
        "Status": item.status || "",
        "Baustelle": item.baustelle || "",
        "Menge": item.menge || "",
        "Art-Nr": item.art_nr || "",
        "Kategorie": item.kategorie || "",
        "Inventar": item.inventar || "",
        "Datum Abgeben": item.datum_abgeben || "",
        "Datum Inventur": item.datum_inventur || "",
        "Wartungstermine": item.wartungstermine || "",
        "Aufmerksamkeit": item.aufmerksamkeit || "",
        "Zugewiesen an": item.assigned_to_profile?.full_name || allUsers.find(u => u.id === item.assigned_to)?.full_name || "",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Werkzeuge");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
      if (Platform.OS === "web") {
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), (c) => c.charCodeAt(0))],
          { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `werkzeuge_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert(t("common.success", "Erfolg"), t("export.success", "Daten wurden exportiert"));
      }
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  // ── STATUS + USER assignment ──
  const openStatusUserModal = (item: WarehouseItem) => {
    setStatusUserItem(item);
    setStatusUserSearch("");
    setShowStatusUserModal(true);
  };

  const assignStatusToUser = async (userId: string | null) => {
    const userName = userId ? (allUsers.find(u => u.id === userId)?.full_name || "") : "";
    // If edit modal is open, update form state instead of saving directly
    if (showModal) {
      setForm((prev) => ({ ...prev, assigned_to: userId || "", status: userId ? userName : prev.status }));
      setShowStatusUserModal(false);
      setStatusUserItem(null);
      return;
    }
    if (!statusUserItem) return;
    try {
      const { error } = await (supabaseAdmin.from("warehouse_items") as any)
        .update({ assigned_to: userId, status: userId ? userName : null })
        .eq("id", statusUserItem.id);
      if (error) throw error;
      setShowStatusUserModal(false);
      setStatusUserItem(null);
      loadData();
    } catch (e) {
      console.error("Error assigning status:", e);
    }
  };

  // ── NOTES / DAMAGED ──
  const openNotesModal = (item: WarehouseItem) => {
    setNotesItem(item);
    setNotesText(item.notes || "");
    setNotesDamaged(item.is_damaged || false);
    setShowNotesModal(true);
  };

  const saveNotes = async () => {
    if (!notesItem) return;
    setNotesSaving(true);
    try {
      const { error } = await (supabaseAdmin.from("warehouse_items") as any)
        .update({ notes: notesText.trim() || null, is_damaged: notesDamaged })
        .eq("id", notesItem.id);
      if (error) throw error;
      setShowNotesModal(false);
      setNotesItem(null);
      loadData();
    } catch (e) {
      console.error("Error saving notes:", e);
      const msg = t("common.error") || "Fehler";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setNotesSaving(false);
    }
  };

  // ── RENDER ──
  if (loading && matLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  // Detail view - Tools
  if (selectedItem) {
    return (
      <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
        <View style={s.titleRow}>
          <TouchableOpacity onPress={() => setSelectedItem(null)} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={tc.text} />
          </TouchableOpacity>
          <Ionicons name="construct" size={24} color="#dc2626" />
          <Text style={[s.title, { color: tc.text, flex: 1 }]} numberOfLines={1}>
            {selectedItem.beschreibung || "—"}
          </Text>
          {canManage && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => { setSelectedItem(null); openEdit(selectedItem); }} style={{ padding: 6 }}>
                <Ionicons name="create-outline" size={22} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteItem(selectedItem)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          {FIELDS.map((f) => {
            let val: any = (selectedItem as any)[f.key];
            if (f.key === "assigned_to" && val) {
              const userName = selectedItem.assigned_to_profile?.full_name || allUsers.find(u => u.id === val)?.full_name || val;
              val = userName;
            }
            return (
              <View key={f.key} style={s.detailRow}>
                <Text style={[s.detailLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                <Text style={[s.detailValue, { color: f.key === "assigned_to" && val && val !== "—" ? "#2563eb" : tc.text }]}>
                  {val != null && val !== "" ? String(val) : "—"}
                </Text>
              </View>
            );
          })}
        </View>
        {selectedItem.assigned_to ? (
          <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: "#eff6ff", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="person" size={16} color="#2563eb" />
            <Text style={{ color: "#2563eb", fontWeight: "600", fontSize: 13 }}>
              {t("magazyn.assigned_to_user") || "Werkzeug dem Benutzer zugewiesen"}
            </Text>
          </View>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Detail view - Materials
  if (selectedMat) {
    const isLowStock = selectedMat.min_stan != null && selectedMat.ilosc != null && selectedMat.ilosc <= selectedMat.min_stan;
    return (
      <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
        <View style={s.titleRow}>
          <TouchableOpacity onPress={() => setSelectedMat(null)} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={tc.text} />
          </TouchableOpacity>
          <Ionicons name="layers" size={24} color="#f97316" />
          <Text style={[s.title, { color: tc.text, flex: 1 }]} numberOfLines={1}>
            {selectedMat.nazwa || "—"}
          </Text>
          {canManageMaterials && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => { setSelectedMat(null); openEditMat(selectedMat); }} style={{ padding: 6 }}>
                <Ionicons name="create-outline" size={22} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteMatItem(selectedMat)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {isLowStock && (
          <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="warning" size={18} color="#ef4444" />
            <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>
              {t("magazyn.low_stock") || "Niedriger Lagerbestand!"} (min: {selectedMat.min_stan})
            </Text>
          </View>
        )}
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          {MAT_FIELDS.map((f) => {
            const val = (selectedMat as any)[f.key];
            return (
              <View key={f.key} style={s.detailRow}>
                <Text style={[s.detailLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                <Text style={[s.detailValue, { color: tc.text }]}>
                  {val != null && val !== "" ? String(val) : "—"}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: tc.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); loadMaterials(); }} />}
    >
      {/* Header */}
      <View style={s.titleRow}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Ionicons name="cube" size={28} color="#dc2626" />
        <Text style={[s.title, { color: tc.text }]}>{t("magazyn.title") || "Lager"}</Text>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ flexGrow: 1 }}>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === "tools" && { borderBottomColor: "#dc2626", borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("tools")}
        >
          <Ionicons name="construct" size={16} color={activeTab === "tools" ? "#dc2626" : tc.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === "tools" && { color: "#dc2626", fontWeight: "700" }]} numberOfLines={1}>
            {t("magazyn.tools_tab") || "Werkzeuge"} ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === "materials" && { borderBottomColor: "#f97316", borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("materials")}
        >
          <Ionicons name="layers" size={16} color={activeTab === "materials" ? "#f97316" : tc.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === "materials" && { color: "#f97316", fontWeight: "700" }]} numberOfLines={1}>
            {t("magazyn.materials_tab") || "Materialien"} ({materials.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === "orders" && { borderBottomColor: "#2563eb", borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("orders")}
        >
          <Ionicons name="cart" size={16} color={activeTab === "orders" ? "#2563eb" : tc.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === "orders" && { color: "#2563eb", fontWeight: "700" }]} numberOfLines={1}>
            {t("magazyn.orders_tab") || "Bestellungen"} ({allOrders.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ═══ TOOLS TAB ═══ */}
      {activeTab === "tools" && (
        <>
          {/* Action buttons */}
          {canManage && (
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#dc2626" }]} onPress={openAdd}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.actionBtnText}>{t("magazyn.add_item", "Hinzufügen")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#16a34a" }]} onPress={handleImport} disabled={importLoading}>
                {importLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={s.actionBtnText}>{t("magazyn.import_excel", "Import")}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#2563eb" }]} onPress={handleToolsExport}>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={s.actionBtnText}>Export</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search */}
          <View style={[s.searchBox, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <Ionicons name="search" size={18} color={tc.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: tc.text }]}
              placeholder={t("magazyn.search_placeholder", "Nach Name, Nr., Status suchen...")}
              placeholderTextColor={tc.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort & Filter controls */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            {/* Sort dropdown */}
            <View style={{ position: "relative", zIndex: 20 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", backgroundColor: tc.card }}
                onPress={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); setShowFilterValueDropdown(false); }}
              >
                <Ionicons name="swap-vertical" size={14} color="#2563eb" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: tc.text }}>Sortieren: {toolColumns.find((c) => c.key === toolSortKey)?.label || "—"}</Text>
                <Ionicons name={toolSortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />
              </TouchableOpacity>
              {showSortDropdown && (
                <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                  {toolColumns.map((col) => (
                    <TouchableOpacity
                      key={col.key}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }}
                      onPress={() => { toggleToolSort(col.key); setShowSortDropdown(false); }}
                    >
                      <Text style={{ fontSize: 13, color: toolSortKey === col.key ? "#2563eb" : tc.text, fontWeight: toolSortKey === col.key ? "700" : "400" }}>{col.label}</Text>
                      {toolSortKey === col.key && <Ionicons name={toolSortAsc ? "arrow-up" : "arrow-down"} size={14} color="#2563eb" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Filter dropdown — column */}
            <View style={{ position: "relative", zIndex: 19 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: filterColumn ? "#f59e0b" : (tc.border || "#e2e8f0"), backgroundColor: filterColumn ? "#fef3c720" : tc.card }}
                onPress={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); setShowFilterValueDropdown(false); }}
              >
                <Ionicons name="funnel" size={14} color={filterColumn ? "#f59e0b" : tc.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: filterColumn ? "#f59e0b" : tc.text }}>
                  {filterColumn ? `${toolColumns.find((c) => c.key === filterColumn)?.label}: ${filterValue || "…"}` : "Filtern"}
                </Text>
                {filterColumn ? (
                  <TouchableOpacity onPress={() => { setFilterColumn(""); setFilterValue(""); setShowFilterDropdown(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={14} color="#f59e0b" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              {showFilterDropdown && (
                <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }}
                    onPress={() => { setFilterColumn(""); setFilterValue(""); setShowFilterDropdown(false); }}
                  >
                    <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>Filter zurücksetzen</Text>
                  </TouchableOpacity>
                  {toolColumns.map((col) => (
                    <TouchableOpacity
                      key={col.key}
                      style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }}
                      onPress={() => { setFilterColumn(col.key); setFilterValue(""); setShowFilterDropdown(false); setShowFilterValueDropdown(true); }}
                    >
                      <Text style={{ fontSize: 13, color: filterColumn === col.key ? "#f59e0b" : tc.text, fontWeight: filterColumn === col.key ? "700" : "400" }}>{col.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Filter value dropdown */}
            {filterColumn ? (
              <View style={{ position: "relative", zIndex: 18 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: filterValue ? "#10b981" : (tc.border || "#e2e8f0"), backgroundColor: filterValue ? "#10b98110" : tc.card }}
                  onPress={() => { setShowFilterValueDropdown(!showFilterValueDropdown); setShowSortDropdown(false); setShowFilterDropdown(false); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: filterValue ? "#10b981" : tc.textSecondary }}>{filterValue || "Wert wählen…"}</Text>
                  <Ionicons name="chevron-down" size={12} color={filterValue ? "#10b981" : tc.textSecondary} />
                </TouchableOpacity>
                {showFilterValueDropdown && (
                  <ScrollView style={{ position: "absolute", top: 38, left: 0, minWidth: 200, maxHeight: 250, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                    {filterColumnValues.map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }}
                        onPress={() => { setFilterValue(val); setShowFilterValueDropdown(false); }}
                      >
                        <Text style={{ fontSize: 13, color: filterValue === val ? "#10b981" : tc.text, fontWeight: filterValue === val ? "700" : "400" }}>{val}</Text>
                      </TouchableOpacity>
                    ))}
                    {filterColumnValues.length === 0 && (
                      <Text style={{ padding: 12, fontSize: 12, color: tc.textMuted }}>Keine Werte</Text>
                    )}
                  </ScrollView>
                )}
              </View>
            ) : null}
          </View>

          <Text style={{ paddingHorizontal: 16, fontSize: 12, color: tc.textSecondary, marginBottom: 6 }}>{filtered.length} / {items.length}</Text>

          {/* Items list — table format */}
          {filtered.length === 0 ? (
            <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Ionicons name="construct-outline" size={48} color="#dc2626" />
                <Text style={{ fontSize: 15, color: tc.textSecondary, marginTop: 12 }}>
                  {items.length === 0 ? t("magazyn.empty_state", "Keine Werkzeuge") : t("magazyn.no_results", "Keine Ergebnisse")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ marginHorizontal: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Table header — sortable */}
                  <View style={{ flexDirection: "row", backgroundColor: "#1e293b", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                    {[
                      { label: "IV/PDS", w: 80, key: "iv_pds" },
                      { label: "Beschreibung", w: 180, key: "beschreibung" },
                      { label: "Hersteller", w: 110, key: "hersteller" },
                      { label: "SN", w: 120, key: "serial_nummer" },
                      { label: "Status", w: 110, key: "status" },
                      { label: "Baustelle", w: 120, key: "baustelle" },
                      { label: "Menge", w: 60, key: "menge" },
                      { label: "Kategorie", w: 100, key: "kategorie" },
                      { label: t("magazyn.notes_title") || "Anmerkungen", w: 120, key: "notes" },
                    ].map((col) => (
                      <TouchableOpacity key={col.key} onPress={() => toggleToolSort(col.key)} style={{ width: col.w, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{col.label}</Text>
                        {toolSortKey === col.key && (
                          <Ionicons name={toolSortAsc ? "arrow-up" : "arrow-down"} size={10} color="#fbbf24" style={{ marginLeft: 2 }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Table rows */}
                  {filtered.map((item, idx) => {
                    const damaged = item.is_damaged;
                    const rowBg = damaged
                      ? "#fef2f2"
                      : idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc");
                    return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      onPress={() => setSelectedItem(item)}
                      style={{ flexDirection: "row", backgroundColor: rowBg, borderBottomWidth: 1, borderBottomColor: damaged ? "#fca5a5" : (tc.border || "#e2e8f0"), paddingVertical: 8, alignItems: "center", ...(damaged ? { borderLeftWidth: 3, borderLeftColor: "#ef4444" } : {}) }}
                    >
                      <Text style={{ width: 80, fontSize: 12, color: damaged ? "#dc2626" : tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.iv_pds || "—"}</Text>
                      <Text style={{ width: 180, fontSize: 12, color: damaged ? "#dc2626" : tc.text, fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>{item.beschreibung || "—"}</Text>
                      <Text style={{ width: 110, fontSize: 12, color: damaged ? "#dc2626" : tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.hersteller || "—"}</Text>
                      <Text style={{ width: 120, fontSize: 12, color: damaged ? "#dc2626" : tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.serial_nummer || "—"}</Text>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); if (canManage) openStatusUserModal(item); }} style={{ width: 110, paddingHorizontal: 6 }}>
                        <Text style={{ fontSize: 12, color: item.status ? "#2563eb" : tc.textSecondary, fontWeight: item.status ? "600" : "400", textDecorationLine: canManage ? "underline" : "none" }} numberOfLines={1}>{item.status || "—"}</Text>
                      </TouchableOpacity>
                      <Text style={{ width: 120, fontSize: 12, color: damaged ? "#dc2626" : tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.baustelle || "—"}</Text>
                      <Text style={{ width: 60, fontSize: 12, color: "#dc2626", fontWeight: "700", paddingHorizontal: 6, textAlign: "center" }}>{item.menge || "—"}</Text>
                      <Text style={{ width: 100, fontSize: 12, color: damaged ? "#dc2626" : tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.kategorie || "—"}</Text>
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); openNotesModal(item); }}
                        style={{ width: 120, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        {damaged && <Ionicons name="warning" size={12} color="#ef4444" />}
                        <Text style={{ fontSize: 12, color: damaged ? "#ef4444" : (item.notes ? "#f59e0b" : tc.textMuted), fontWeight: damaged ? "700" : (item.notes ? "600" : "400"), textDecorationLine: "underline" }} numberOfLines={1}>
                          {item.notes || (damaged ? (t("magazyn.damaged") || "Beschädigt") : "—")}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* ═══ MATERIALS TAB ═══ */}
      {activeTab === "materials" && (
        <>
          {canManageMaterials && (
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#f97316" }]} onPress={openAddMat}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.actionBtnText}>{t("magazyn.add_item") || "Hinzufügen"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#16a34a" }]} onPress={handleMatImport} disabled={matImportLoading}>
                {matImportLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={s.actionBtnText}>Import</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#2563eb" }]} onPress={handleMatExport}>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={s.actionBtnText}>Export</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[s.searchBox, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <Ionicons name="search" size={18} color={tc.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: tc.text }]}
              placeholder={t("magazyn.search_placeholder") || "Suchen..."}
              placeholderTextColor={tc.textSecondary}
              value={matSearch}
              onChangeText={setMatSearch}
            />
            {matSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMatSearch("")}>
                <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort & Filter controls — materials */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            <View style={{ position: "relative", zIndex: 20 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", backgroundColor: tc.card }}
                onPress={() => { setShowMatSortDD(!showMatSortDD); setShowMatFilterDD(false); setShowMatFilterValDD(false); }}
              >
                <Ionicons name="swap-vertical" size={14} color="#2563eb" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: tc.text }}>Sortieren: {matColumns.find((c) => c.key === matSortKey)?.label || "—"}</Text>
                <Ionicons name={matSortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />
              </TouchableOpacity>
              {showMatSortDD && (
                <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                  {matColumns.map((col) => (
                    <TouchableOpacity key={col.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { toggleMatSort(col.key); setShowMatSortDD(false); }}>
                      <Text style={{ fontSize: 13, color: matSortKey === col.key ? "#2563eb" : tc.text, fontWeight: matSortKey === col.key ? "700" : "400" }}>{col.label}</Text>
                      {matSortKey === col.key && <Ionicons name={matSortAsc ? "arrow-up" : "arrow-down"} size={14} color="#2563eb" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={{ position: "relative", zIndex: 19 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: matFilterCol ? "#f59e0b" : (tc.border || "#e2e8f0"), backgroundColor: matFilterCol ? "#fef3c720" : tc.card }}
                onPress={() => { setShowMatFilterDD(!showMatFilterDD); setShowMatSortDD(false); setShowMatFilterValDD(false); }}
              >
                <Ionicons name="funnel" size={14} color={matFilterCol ? "#f59e0b" : tc.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: matFilterCol ? "#f59e0b" : tc.text }}>
                  {matFilterCol ? `${matColumns.find((c) => c.key === matFilterCol)?.label}: ${matFilterVal || "…"}` : "Filtern"}
                </Text>
                {matFilterCol ? <TouchableOpacity onPress={() => { setMatFilterCol(""); setMatFilterVal(""); setShowMatFilterDD(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={14} color="#f59e0b" /></TouchableOpacity> : null}
              </TouchableOpacity>
              {showMatFilterDD && (
                <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                  <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setMatFilterCol(""); setMatFilterVal(""); setShowMatFilterDD(false); }}>
                    <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>Filter zurücksetzen</Text>
                  </TouchableOpacity>
                  {matColumns.map((col) => (
                    <TouchableOpacity key={col.key} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setMatFilterCol(col.key); setMatFilterVal(""); setShowMatFilterDD(false); setShowMatFilterValDD(true); }}>
                      <Text style={{ fontSize: 13, color: matFilterCol === col.key ? "#f59e0b" : tc.text, fontWeight: matFilterCol === col.key ? "700" : "400" }}>{col.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {matFilterCol ? (
              <View style={{ position: "relative", zIndex: 18 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: matFilterVal ? "#10b981" : (tc.border || "#e2e8f0"), backgroundColor: matFilterVal ? "#10b98110" : tc.card }}
                  onPress={() => { setShowMatFilterValDD(!showMatFilterValDD); setShowMatSortDD(false); setShowMatFilterDD(false); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: matFilterVal ? "#10b981" : tc.textSecondary }}>{matFilterVal || "Wert wählen…"}</Text>
                  <Ionicons name="chevron-down" size={12} color={matFilterVal ? "#10b981" : tc.textSecondary} />
                </TouchableOpacity>
                {showMatFilterValDD && (
                  <ScrollView style={{ position: "absolute", top: 38, left: 0, minWidth: 200, maxHeight: 250, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                    {matFilterColValues.map((val) => (
                      <TouchableOpacity key={val} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setMatFilterVal(val); setShowMatFilterValDD(false); }}>
                        <Text style={{ fontSize: 13, color: matFilterVal === val ? "#10b981" : tc.text, fontWeight: matFilterVal === val ? "700" : "400" }}>{val}</Text>
                      </TouchableOpacity>
                    ))}
                    {matFilterColValues.length === 0 && <Text style={{ padding: 12, fontSize: 12, color: tc.textMuted }}>Keine Werte</Text>}
                  </ScrollView>
                )}
              </View>
            ) : null}
          </View>

          <Text style={{ paddingHorizontal: 16, fontSize: 12, color: tc.textSecondary, marginBottom: 6 }}>{filteredMat.length} / {materials.length}</Text>

          {/* Materials list — table format */}
          {filteredMat.length === 0 ? (
            <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Ionicons name="layers-outline" size={48} color="#f97316" />
                <Text style={{ fontSize: 15, color: tc.textSecondary, marginTop: 12 }}>
                  {materials.length === 0 ? (t("magazyn.empty_materials") || "Keine Materialien") : (t("magazyn.no_results") || "Keine Ergebnisse")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ marginHorizontal: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Table header — sortable */}
                  <View style={{ flexDirection: "row", backgroundColor: "#92400e", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                    {[
                      { label: "Position", w: 50, key: "pozycja" },
                      { label: "Art-Nr", w: 80, key: "art_nr" },
                      { label: "Name", w: 180, key: "nazwa" },
                      { label: "Menge", w: 60, key: "ilosc" },
                      { label: "Länge", w: 70, key: "dlugosc" },
                      { label: "Breite", w: 75, key: "szerokosc" },
                      { label: "Höhe", w: 70, key: "wysokosc" },
                      { label: "Gewicht", w: 70, key: "waga" },
                      { label: "Eingetr.", w: 110, key: "zamawiajacy" },
                      { label: "Min.", w: 70, key: "min_stan" },
                    ].map((col) => (
                      <TouchableOpacity key={col.key} onPress={() => toggleMatSort(col.key)} style={{ width: col.w, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{col.label}</Text>
                        {matSortKey === col.key && (
                          <Ionicons name={matSortAsc ? "arrow-up" : "arrow-down"} size={10} color="#fbbf24" style={{ marginLeft: 2 }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Table rows */}
                  {filteredMat.map((item, idx) => {
                    const isLow = item.min_stan != null && item.ilosc != null && item.ilosc <= item.min_stan;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.7}
                        onPress={() => setSelectedMat(item)}
                        style={{ flexDirection: "row", backgroundColor: isLow ? "#fef2f2" : (idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc")), borderBottomWidth: 1, borderBottomColor: isLow ? "#fca5a5" : (tc.border || "#e2e8f0"), borderLeftWidth: isLow ? 3 : 0, borderLeftColor: "#ef4444", paddingVertical: 8, alignItems: "center" }}
                      >
                        <Text style={{ width: 50, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.pozycja || "—"}</Text>
                        <Text style={{ width: 80, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.art_nr || "—"}</Text>
                        <Text style={{ width: 180, fontSize: 12, color: tc.text, fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>{item.nazwa || "—"}</Text>
                        <Text style={{ width: 60, fontSize: 12, color: isLow ? "#ef4444" : "#f97316", fontWeight: "700", paddingHorizontal: 6, textAlign: "center" }}>{item.ilosc ?? "—"}</Text>
                        <Text style={{ width: 70, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.dlugosc || "—"}</Text>
                        <Text style={{ width: 75, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.szerokosc || "—"}</Text>
                        <Text style={{ width: 70, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.wysokosc || "—"}</Text>
                        <Text style={{ width: 70, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.waga || "—"}</Text>
                        <Text style={{ width: 110, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{item.zamawiajacy || "—"}</Text>
                        <Text style={{ width: 70, fontSize: 12, color: isLow ? "#ef4444" : tc.textSecondary, fontWeight: isLow ? "700" : "400", paddingHorizontal: 6, textAlign: "center" }}>{item.min_stan ?? "—"}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* ═══ ORDERS TAB ═══ */}
      {activeTab === "orders" && (
        <>
          {/* Search */}
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

          {/* Sort & Filter controls — orders */}
          <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            <View style={{ position: "relative", zIndex: 20 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", backgroundColor: tc.card }}
                onPress={() => { setShowOrdSortDD(!showOrdSortDD); setShowOrdFilterDD(false); setShowOrdFilterValDD(false); }}
              >
                <Ionicons name="swap-vertical" size={14} color="#2563eb" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: tc.text }}>Sortieren: {ordColumns.find((c) => c.key === orderSortKey)?.label || "—"}</Text>
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
                  {ordFilterCol ? `${ordColumns.find((c) => c.key === ordFilterCol)?.label}: ${ordFilterVal || "…"}` : "Filtern"}
                </Text>
                {ordFilterCol ? <TouchableOpacity onPress={() => { setOrdFilterCol(""); setOrdFilterVal(""); setShowOrdFilterDD(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={14} color="#f59e0b" /></TouchableOpacity> : null}
              </TouchableOpacity>
              {showOrdFilterDD && (
                <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                  <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setOrdFilterCol(""); setOrdFilterVal(""); setShowOrdFilterDD(false); }}>
                    <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>Filter zurücksetzen</Text>
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
                  <Text style={{ fontSize: 12, fontWeight: "600", color: ordFilterVal ? "#10b981" : tc.textSecondary }}>{ordFilterVal || "Wert wählen…"}</Text>
                  <Ionicons name="chevron-down" size={12} color={ordFilterVal ? "#10b981" : tc.textSecondary} />
                </TouchableOpacity>
                {showOrdFilterValDD && (
                  <ScrollView style={{ position: "absolute", top: 38, left: 0, minWidth: 200, maxHeight: 250, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                    {ordFilterColValues.map((val) => (
                      <TouchableOpacity key={val} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setOrdFilterVal(val); setShowOrdFilterValDD(false); }}>
                        <Text style={{ fontSize: 13, color: ordFilterVal === val ? "#10b981" : tc.text, fontWeight: ordFilterVal === val ? "700" : "400" }}>{val}</Text>
                      </TouchableOpacity>
                    ))}
                    {ordFilterColValues.length === 0 && <Text style={{ padding: 12, fontSize: 12, color: tc.textMuted }}>Keine Werte</Text>}
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
                  {/* Table header — sortable */}
                  <View style={{ flexDirection: "row", backgroundColor: "#1e40af", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                    {[
                      { label: "Typ", w: 70, key: "order_type" },
                      { label: "Projekt", w: 140, key: "project" },
                      { label: "Material/Werkzeug", w: 170, key: "material" },
                      { label: "Art-Nr", w: 80, key: "material" },
                      { label: "Menge", w: 60, key: "ilosc" },
                      { label: "Status", w: 90, key: "status" },
                      { label: "Bestellt von", w: 110, key: "ordered_by" },
                      { label: "Datum", w: 80, key: "created_at" },
                      { label: "Uhrzeit", w: 60, key: "created_at" },
                      { label: "Bestellt am", w: 90, key: "ordered_at" },
                      { label: "Lieferung", w: 90, key: "data_dostawy" },
                      { label: "Anmerkung", w: 120, key: "uwagi" },
                      { label: "Aktion", w: 100, key: "_action" },
                    ].map((col, i) => (
                      <TouchableOpacity key={`${col.key}_${i}`} onPress={() => col.key !== "_action" && toggleOrderSort(col.key)} style={{ width: col.w, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{col.label}</Text>
                        {orderSortKey === col.key && col.key !== "_action" && (
                          <Ionicons name={orderSortAsc ? "arrow-up" : "arrow-down"} size={10} color="#fbbf24" style={{ marginLeft: 2 }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Table rows */}
                  {filteredOrders.map((order: any, idx: number) => {
                    const sc = orderStatusColors[order.status] || "#94a3b8";
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
                              {order.order_type === "tool" ? "Werkzeug" : "Material"}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ width: 140, fontSize: 12, color: "#2563eb", fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>
                          {order.project?.project_number ? `#${order.project.project_number} ` : ""}{order.project?.name || "—"}
                        </Text>
                        <Text style={{ width: 170, fontSize: 12, color: tc.text, fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>{getOrderItemName(order) || "—"}</Text>
                        <Text style={{ width: 80, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{(order.order_type === "tool" ? order.tool?.art_nr : order.material?.art_nr) || "—"}</Text>
                        <Text style={{ width: 60, fontSize: 12, color: "#2563eb", fontWeight: "700", paddingHorizontal: 6, textAlign: "center" }}>{order.ilosc ?? "—"}</Text>
                        <View style={{ width: 90, paddingHorizontal: 4 }}>
                          <View style={{ backgroundColor: `${sc}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: sc }}>{String(t(`magazyn.order_status.${order.status}`, order.status))}</Text>
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
                              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Bearbeiten</Text>
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
      )}

      <View style={{ height: 40 }} />

      {/* Add/Edit Tool Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>
                {editingItem ? (t("magazyn.edit_item") || "Werkzeug bearbeiten") : (t("magazyn.add_item") || "Werkzeug hinzufügen")}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {FIELDS.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                  {f.key === "status" ? (
                    <View>
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: form.assigned_to ? "#2563eb" : (tc.border || "#e2e8f0"), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: form.assigned_to ? "#eff6ff" : (tc.background || "#fff") }}
                        onPress={() => { setStatusUserSearch(""); setShowStatusUserModal(true); }}
                      >
                        <Ionicons name="person" size={18} color={form.assigned_to ? "#2563eb" : tc.textSecondary} />
                        <Text style={{ flex: 1, fontSize: 14, color: form.assigned_to ? "#2563eb" : tc.textSecondary, fontWeight: form.assigned_to ? "600" : "400" }}>
                          {form.status || "Benutzer auswählen…"}
                        </Text>
                        {form.assigned_to ? (
                          <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, assigned_to: "", status: "" }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color="#2563eb" />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : f.key === "baustelle" ? (
                    <View>
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: form.baustelle ? "#10b981" : (tc.border || "#e2e8f0"), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: form.baustelle ? "#ecfdf5" : (tc.background || "#fff") }}
                        onPress={() => { setBaustelleSearch(""); setShowBaustellePicker(true); }}
                      >
                        <Ionicons name="business" size={18} color={form.baustelle ? "#10b981" : tc.textSecondary} />
                        <Text style={{ flex: 1, fontSize: 14, color: form.baustelle ? "#10b981" : tc.textSecondary, fontWeight: form.baustelle ? "600" : "400" }}>
                          {form.baustelle || "Baustelle auswählen…"}
                        </Text>
                        {form.baustelle ? (
                          <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, baustelle: "" }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color="#10b981" />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput
                      style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                      value={form[f.key]}
                      onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                      placeholder={f.labelDE}
                      placeholderTextColor={tc.textMuted || "#999"}
                      keyboardType="default"
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowModal(false)}>
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#dc2626" }]} onPress={saveItem} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Material Modal */}
      <Modal visible={showMatModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>
                {editingMat ? (t("magazyn.edit_material") || "Material bearbeiten") : (t("magazyn.add_material") || "Material hinzufügen")}
              </Text>
              <TouchableOpacity onPress={() => setShowMatModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {MAT_FIELDS.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={matForm[f.key]}
                    onChangeText={(v) => setMatForm((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.labelDE}
                    placeholderTextColor={tc.textMuted || "#999"}
                    keyboardType={f.numeric ? "decimal-pad" : "default"}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowMatModal(false)}>
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#f97316" }]} onPress={saveMatItem} disabled={matSaving}>
                {matSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status → User Assignment Modal */}
      <Modal visible={showStatusUserModal} transparent animationType="fade" onRequestClose={() => setShowStatusUserModal(false)}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card, maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: tc.text }]}>Status / Zugewiesen an</Text>
                <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }} numberOfLines={1}>{statusUserItem?.beschreibung || "—"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStatusUserModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchBox, { backgroundColor: tc.background, borderColor: tc.border, marginHorizontal: 0, marginBottom: 10 }]}>
              <Ionicons name="search" size={16} color={tc.textSecondary} />
              <TextInput
                style={[s.searchInput, { color: tc.text }]}
                placeholder="Benutzer suchen..."
                placeholderTextColor={tc.textSecondary}
                value={statusUserSearch}
                onChangeText={setStatusUserSearch}
              />
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10 }}
                onPress={() => assignStatusToUser(null)}
              >
                <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
                <Text style={{ fontSize: 14, color: "#ef4444", fontWeight: "600" }}>Keine Zuweisung (leer)</Text>
              </TouchableOpacity>
              {allUsers
                .filter((u) => !statusUserSearch.trim() || u.full_name.toLowerCase().includes(statusUserSearch.toLowerCase()))
                .map((u) => {
                  const isSelected = showModal ? form.assigned_to === u.id : statusUserItem?.assigned_to === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10, backgroundColor: isSelected ? "#2563eb10" : "transparent" }}
                      onPress={() => assignStatusToUser(u.id)}
                    >
                      <Ionicons name={isSelected ? "checkmark-circle" : "person-outline"} size={22} color={isSelected ? "#2563eb" : tc.textSecondary} />
                      <Text style={{ fontSize: 14, color: isSelected ? "#2563eb" : tc.text, fontWeight: isSelected ? "700" : "400" }}>{u.full_name}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Baustelle (Project) Picker Modal */}
      <Modal visible={showBaustellePicker} transparent animationType="fade" onRequestClose={() => setShowBaustellePicker(false)}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card, maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>Baustelle auswählen</Text>
              <TouchableOpacity onPress={() => setShowBaustellePicker(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchBox, { borderColor: tc.border, backgroundColor: tc.background }]}>
              <Ionicons name="search" size={18} color={tc.textSecondary} />
              <TextInput
                style={[s.searchInput, { color: tc.text }]}
                placeholder="Baustelle suchen..."
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
                <Text style={{ textAlign: "center", color: tc.textMuted, paddingVertical: 20 }}>Keine Baustellen</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Order Edit Modal */}
      <Modal visible={showOrderEditModal} animationType="slide" transparent onRequestClose={() => setShowOrderEditModal(false)}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: tc.text }]}>Bestellung bearbeiten</Text>
                {editingOrder && (
                  <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }} numberOfLines={1}>
                    {editingOrder.order_type === "tool" ? (editingOrder.tool?.beschreibung || "—") : (editingOrder.material?.nazwa || "—")} — {editingOrder.project?.name || "—"}
                    {editingOrder.order_type === "tool" ? " (Werkzeug)" : " (Material)"}
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
                    <Text style={{ fontSize: 12, fontWeight: "700", color: tc.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>Bestellinfo</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={tc.textSecondary} />
                    <Text style={{ fontSize: 13, color: tc.text }}>
                      Erstellt: {editingOrder.created_at ? new Date(editingOrder.created_at).toLocaleDateString("de-DE") : "—"}{" "}
                      {editingOrder.created_at ? new Date(editingOrder.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""} Uhr
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="person-outline" size={14} color={tc.textSecondary} />
                    <Text style={{ fontSize: 13, color: tc.text }}>
                      Erstellt von: {editingOrder.ordered_by_profile?.full_name || "—"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Status */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>Status</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { value: "pending", labelDE: "Ausstehend", color: "#f59e0b", icon: "time-outline" as const },
                    { value: "ordered", labelDE: "Bestellt", color: "#3b82f6", icon: "cart-outline" as const },
                    { value: "delivered", labelDE: "Geliefert", color: "#10b981", icon: "checkmark-circle-outline" as const },
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
                          {st.labelDE}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Bestellt am — date picker */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>Bestellt am</Text>
                {Platform.OS === "web" ? (
                  <View style={{ flexDirection: "row" }}>
                    <input
                      type="date"
                      value={orderForm.ordered_at}
                      onChange={(e: any) => setOrderForm((prev) => ({ ...prev, ordered_at: e.target.value }))}
                      style={{
                        width: 200, maxWidth: "100%", padding: 10, fontSize: 14, borderRadius: 8,
                        border: `1px solid ${tc.border || "#e2e8f0"}`,
                        backgroundColor: tc.background || "#fff",
                        color: tc.text || "#1e293b",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        boxSizing: "border-box" as any,
                      }}
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
                  <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: "600" }}>Heute</Text>
                </TouchableOpacity>
              </View>

              {/* Lieferung — date picker */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>Lieferung (geplant)</Text>
                {Platform.OS === "web" ? (
                  <View style={{ flexDirection: "row" }}>
                    <input
                      type="date"
                      value={orderForm.data_dostawy}
                      onChange={(e: any) => setOrderForm((prev) => ({ ...prev, data_dostawy: e.target.value }))}
                      style={{
                        width: 200, maxWidth: "100%", padding: 10, fontSize: 14, borderRadius: 8,
                        border: `1px solid ${tc.border || "#e2e8f0"}`,
                        backgroundColor: tc.background || "#fff",
                        color: tc.text || "#1e293b",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        boxSizing: "border-box" as any,
                      }}
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
                  <Text style={{ fontSize: 11, color: "#10b981", fontWeight: "600" }}>Heute</Text>
                </TouchableOpacity>
              </View>

              {/* Anmerkung */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>Anmerkung</Text>
                <TextInput
                  style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background, minHeight: 70, textAlignVertical: "top" }]}
                  value={orderForm.uwagi}
                  onChangeText={(v) => setOrderForm((prev) => ({ ...prev, uwagi: v }))}
                  placeholder="Bemerkungen zur Bestellung..."
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

      {/* ═══ NOTES / DAMAGED MODAL ═══ */}
      <Modal visible={showNotesModal} transparent animationType="fade" onRequestClose={() => setShowNotesModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: tc.card || "#fff", borderRadius: 16, padding: 20, width: "92%", maxWidth: 440, borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#e2e8f0") }}>
            {/* Header */}
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

            {/* Item info */}
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

            {/* Damaged checkbox */}
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

            {/* Notes text input */}
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

            {/* Actions */}
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  title: { fontSize: 22, fontWeight: "700" },
  tabBar: { marginHorizontal: 16, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tabBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabBtnText: { fontSize: 12, fontWeight: "500", color: "#94a3b8" },
  actionRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  itemCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#dc262615", justifyContent: "center", alignItems: "center" },
  itemTitle: { fontSize: 15, fontWeight: "600" },
  itemMeta: { fontSize: 12 },
  mengeBadge: { backgroundColor: "#dc262620", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  mengeText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },
  detailRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  detailLabel: { width: 120, fontSize: 13, fontWeight: "600" },
  detailValue: { flex: 1, fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 500, borderRadius: 16, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 80 },
  userChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", marginRight: 6, marginBottom: 4 },
  userChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  userChipText: { fontSize: 12, fontWeight: "500", color: "#475569" },
});
