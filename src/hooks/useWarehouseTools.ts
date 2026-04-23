/**
 * Hook zarządzający narzędziami magazynowymi (warehouse_items):
 * CRUD, import/export Excel, przypisanie statusu/użytkownika, notatki/uszkodzenia.
 * Wydzielony z magazyn.tsx.
 *
 * Faza 3: migracja na TanStack Query v5.
 * - 1 useQuery: items (enriched z assigned_to_profile)
 * - 5 useMutation: saveItem, deleteItem, importBatch, assignStatusToUser, saveNotes
 *
 * Klucz cache: warehouseToolsKey = ["warehouse", "items", "enriched"] (osobny
 * od warehouseKeys.tools w useProjectOrders bo inny shape -- enriched profile).
 * Mutations invalidate OBA klucze (modyfikuja ten sam table).
 *
 * Sygnatura zewnetrzna zachowana. loading/saving/importLoading/notesSaving
 * teraz pochodza z useQuery.isPending / useMutation.isPending.
 */
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { fetchProfileMap } from "@/src/services/profileService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import * as DocumentPicker from "expo-document-picker";
// expo-file-system v19+ ma nowe File API; legacy daje stare readAsStringAsync/writeAsStringAsync/documentDirectory
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { warehouseKeys } from "./useProjectOrders";

type ExcelCell = string | number | boolean | null | undefined;

export type WarehouseItem = {
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

export const EMPTY_FORM = {
  iv_pds: "", menge: "", beschreibung: "", serial_nummer: "", akku_serial_nummer: "",
  ladegeraet_sn: "", status: "", datum_abgeben: "", baustelle: "",
  hersteller: "", inventar: "", aufmerksamkeit: "", art_nr: "", datum_inventur: "",
  kategorie: "", wartungstermine: "", assigned_to: "",
};

export const FIELDS: { key: keyof typeof EMPTY_FORM; label: string; labelDE: string }[] = [
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

export const warehouseToolsKey = ["warehouse", "items", "enriched"] as const;

async function fetchEnrichedTools(): Promise<WarehouseItem[]> {
  const { data, error } = await supabaseAdmin.from("warehouse_items")
    .select("*")
    .order("iv_pds", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as WarehouseItem[];
  const assignedIds = [...new Set(rows.map((i) => i.assigned_to).filter((id): id is string => Boolean(id)))];
  const profileMap = await fetchProfileMap(assignedIds);
  return rows.map((i) => ({
    ...i,
    assigned_to_profile: i.assigned_to ? { full_name: profileMap[i.assigned_to] || null } : null,
  }));
}

export function useWarehouseTools(
  profileId: string | undefined,
  allUsers: { id: string; full_name: string }[],
  t: TFunction,
) {
  const qc = useQueryClient();

  // Helper -- invalidate obu kluczy (enriched + raw z useProjectOrders)
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: warehouseToolsKey });
    qc.invalidateQueries({ queryKey: warehouseKeys.tools() });
  };

  // ── Query: enriched items ──
  const itemsQuery = useQuery({
    queryKey: warehouseToolsKey,
    queryFn: fetchEnrichedTools,
  });
  const items = itemsQuery.data ?? [];

  // ── Local UI state (modale, search, sort, filter) ──
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);

  // Sorting & filtering
  const [toolSortKey, setToolSortKey] = useState<string>("iv_pds");
  const [toolSortAsc, setToolSortAsc] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showFilterValueDropdown, setShowFilterValueDropdown] = useState(false);

  // Status/User assignment modal
  const [showStatusUserModal, setShowStatusUserModal] = useState(false);
  const [statusUserItem, setStatusUserItem] = useState<WarehouseItem | null>(null);
  const [statusUserSearch, setStatusUserSearch] = useState("");

  // Notes modal
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesItem, setNotesItem] = useState<WarehouseItem | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesDamaged, setNotesDamaged] = useState(false);

  // Baustelle picker
  const [showBaustellePicker, setShowBaustellePicker] = useState(false);
  const [baustelleSearch, setBaustelleSearch] = useState("");

  // ── Mutations ──

  const saveItemMutation = useMutation({
    mutationFn: async ({ payload, editing }: { payload: Record<string, unknown>; editing: WarehouseItem | null }) => {
      if (editing) {
        const { error } = await supabaseAdmin.from("warehouse_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("warehouse_items").insert({ ...payload, created_by: profileId || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setShowModal(false);
      invalidateAll();
    },
    onError: (e) => {
      console.error("Error saving item:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (item: WarehouseItem) => {
      const { error } = await supabaseAdmin.from("warehouse_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedItem(null);
      invalidateAll();
    },
    onError: (e) => console.error("Error deleting item:", e),
  });

  const importBatchMutation = useMutation({
    mutationFn: async (rows: ExcelCell[][]) => {
      const dataRows = rows.slice(1).filter((r) => r.length > 0 && r.some((c) => c != null && c !== ""));
      if (dataRows.length === 0) throw new Error("EMPTY");

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
        created_by: profileId || null,
      }));

      let inserted = 0;
      for (let i = 0; i < itemsToInsert.length; i += 50) {
        const batch = itemsToInsert.slice(i, i + 50);
        const { error } = await supabaseAdmin.from("warehouse_items").insert(batch);
        if (error) console.error("Batch insert error:", error);
        else inserted += batch.length;
      }
      return { inserted, total: itemsToInsert.length };
    },
    onSuccess: ({ inserted, total }) => {
      const msg = (t("magazyn.import_success") || "Importiert") + `: ${inserted} / ${total}`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
      invalidateAll();
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "EMPTY") {
        const msg = t("magazyn.import_empty") || "Datei enthält keine Daten";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert(t("common.error"), msg);
        return;
      }
      console.error("Import error:", e);
    },
  });

  const assignStatusMutation = useMutation({
    mutationFn: async ({ itemId, userId, userName }: { itemId: string; userId: string | null; userName: string }) => {
      const { error } = await supabaseAdmin.from("warehouse_items")
        .update({ assigned_to: userId, status: userId ? userName : null })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowStatusUserModal(false);
      setStatusUserItem(null);
      invalidateAll();
    },
    onError: (e) => console.error("Error assigning status:", e),
  });

  const saveNotesMutation = useMutation({
    mutationFn: async ({ itemId, notes, damaged }: { itemId: string; notes: string | null; damaged: boolean }) => {
      const { error } = await supabaseAdmin.from("warehouse_items")
        .update({ notes, is_damaged: damaged })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowNotesModal(false);
      setNotesItem(null);
      invalidateAll();
    },
    onError: (e) => {
      console.error("Error saving notes:", e);
      const msg = t("common.error") || "Fehler";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    },
  });

  // ── Action wrappers ──

  const loadData = async () => {
    await itemsQuery.refetch();
    setRefreshing(false);
  };

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

  const saveItem = () => {
    if (!form.beschreibung.trim()) {
      const msg = t("magazyn.description_required") || "Opis jest wymagany";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
      return;
    }
    const payload: Record<string, unknown> = {
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
      const assignedUser = allUsers.find((u) => u.id === payload.assigned_to);
      if (assignedUser) payload.status = assignedUser.full_name;
    }
    saveItemMutation.mutate({ payload, editing: editingItem });
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
    deleteItemMutation.mutate(item);
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
            const rows: ExcelCell[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            importBatchMutation.mutate(rows);
          } catch (err) {
            console.error("Import error:", err);
            window.alert(t("magazyn.import_error") || "Importfehler");
          }
        };
        reader.readAsArrayBuffer(blob);
      } else {
        try {
          const fileContent = await FileSystem.readAsStringAsync(file.uri, {
            encoding: "base64" as "base64",
          });
          const workbook = XLSX.read(fileContent, { type: "base64" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: ExcelCell[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          importBatchMutation.mutate(rows);
        } catch (err) {
          console.error("Import error:", err);
          Alert.alert(t("common.error"), t("magazyn.import_error") || "Importfehler");
        }
      }
    } catch (error) {
      console.error("Document picker error:", error);
    }
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
        "Inventar": item.inventar || "",
        "Kategorie": item.kategorie || "",
        "Datum Inventur": item.datum_inventur || "",
        "Datum Abgeben": item.datum_abgeben || "",
        "Aufmerksamkeit": item.aufmerksamkeit || "",
        "Wartungstermine": item.wartungstermine || "",
        "Notizen": item.notes || "",
        "Beschädigt": item.is_damaged ? "JA" : "",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Werkzeuge");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

      if (Platform.OS === "web") {
        const buf = Uint8Array.from(atob(wbout), (c) => c.charCodeAt(0));
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Werkzeuge_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.documentDirectory}Werkzeuge_${new Date().toISOString().slice(0, 10)}.xlsx`;
        FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: "base64" as "base64" }).then(() => {
          Alert.alert(t("common.success"), `Datei gespeichert: ${fileUri}`);
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(t("common.error"), t("magazyn.export_error") || "Exportfehler");
    }
  };

  // ── STATUS + USER assignment ──
  const openStatusUserModal = (item: WarehouseItem) => {
    setStatusUserItem(item);
    setStatusUserSearch("");
    setShowStatusUserModal(true);
  };

  const assignStatusToUser = (userId: string | null) => {
    const userName = userId ? (allUsers.find((u) => u.id === userId)?.full_name || "") : "";
    // Jesli edit modal jest otwarty, tylko zaktualizuj form (bez DB call)
    if (showModal) {
      setForm((prev) => ({ ...prev, assigned_to: userId || "", status: userId ? userName : prev.status }));
      setShowStatusUserModal(false);
      setStatusUserItem(null);
      return;
    }
    if (!statusUserItem) return;
    assignStatusMutation.mutate({ itemId: statusUserItem.id, userId, userName });
  };

  // ── NOTES / DAMAGED ──
  const openNotesModal = (item: WarehouseItem) => {
    setNotesItem(item);
    setNotesText(item.notes || "");
    setNotesDamaged(item.is_damaged || false);
    setShowNotesModal(true);
  };

  const saveNotes = () => {
    if (!notesItem) return;
    saveNotesMutation.mutate({
      itemId: notesItem.id,
      notes: notesText.trim() || null,
      damaged: notesDamaged,
    });
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

  const filterColumnValues = filterColumn
    ? [...new Set(items.map((i) => ((i as Record<string, unknown>)[filterColumn] || "").toString().trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
    : [];

  const filtered = items
    .filter((item) => {
      if (filterColumn && filterValue) {
        const val = ((item as Record<string, unknown>)[filterColumn] || "").toString().toLowerCase();
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
      const va = ((a as Record<string, unknown>)[toolSortKey] || "").toString().toLowerCase();
      const vb = ((b as Record<string, unknown>)[toolSortKey] || "").toString().toLowerCase();
      const cmp = va.localeCompare(vb, "de");
      return toolSortAsc ? cmp : -cmp;
    });

  const toggleToolSort = (key: string) => {
    if (toolSortKey === key) setToolSortAsc(!toolSortAsc);
    else { setToolSortKey(key); setToolSortAsc(true); }
  };

  return {
    // Data
    items,
    loading: itemsQuery.isPending,
    refreshing, setRefreshing,
    // Search
    search, setSearch,
    // Import/Export
    importLoading: importBatchMutation.isPending,
    handleImport, handleToolsExport,
    // CRUD modal
    showModal, setShowModal, editingItem, form, setForm,
    saving: saveItemMutation.isPending,
    selectedItem, setSelectedItem,
    openAdd, openEdit, saveItem, deleteItem,
    // Sorting & Filtering
    toolSortKey, toolSortAsc, statusFilter, setStatusFilter,
    showSortDropdown, setShowSortDropdown,
    filterColumn, setFilterColumn, filterValue, setFilterValue,
    showFilterDropdown, setShowFilterDropdown,
    showFilterValueDropdown, setShowFilterValueDropdown,
    toolColumns, filterColumnValues, filtered, toggleToolSort,
    // Status/User modal
    showStatusUserModal, setShowStatusUserModal,
    statusUserItem, statusUserSearch, setStatusUserSearch,
    openStatusUserModal, assignStatusToUser,
    // Notes modal
    showNotesModal, setShowNotesModal,
    notesItem, notesText, setNotesText,
    notesDamaged, setNotesDamaged,
    notesSaving: saveNotesMutation.isPending,
    saveNotes, openNotesModal,
    // Baustelle picker
    showBaustellePicker, setShowBaustellePicker,
    baustelleSearch, setBaustelleSearch,
    // Core
    loadData,
  };
}
