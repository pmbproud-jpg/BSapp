/**
 * Hook zarządzający materiałami magazynowymi (warehouse_materials):
 * CRUD, import/export Excel, sortowanie, filtrowanie.
 * Wydzielony z magazyn.tsx.
 */
import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as XLSX from "xlsx";

export type MaterialItem = {
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

export const MAT_EMPTY = {
  pozycja: "", art_nr: "", nazwa: "", ilosc: "", dlugosc: "", szerokosc: "",
  wysokosc: "", waga: "", zamawiajacy: "", data_zamowienia: "", data_dostawy: "", min_stan: "",
};

export const MAT_FIELDS: { key: keyof typeof MAT_EMPTY; label: string; labelDE: string; numeric?: boolean }[] = [
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

export function useWarehouseMaterials(
  profileId: string | undefined,
  profileFullName: string | undefined,
  t: any,
) {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [matLoading, setMatLoading] = useState(true);
  const [matSearch, setMatSearch] = useState("");
  const [matImportLoading, setMatImportLoading] = useState(false);
  const [showMatModal, setShowMatModal] = useState(false);
  const [editingMat, setEditingMat] = useState<MaterialItem | null>(null);
  const [matForm, setMatForm] = useState({ ...MAT_EMPTY });
  const [matSaving, setMatSaving] = useState(false);
  const [selectedMat, setSelectedMat] = useState<MaterialItem | null>(null);

  // Sorting & filtering
  const [matSortKey, setMatSortKey] = useState<string>("pozycja");
  const [matSortAsc, setMatSortAsc] = useState(true);
  const [showMatSortDD, setShowMatSortDD] = useState(false);
  const [matFilterCol, setMatFilterCol] = useState<string>("");
  const [matFilterVal, setMatFilterVal] = useState<string>("");
  const [showMatFilterDD, setShowMatFilterDD] = useState(false);
  const [showMatFilterValDD, setShowMatFilterValDD] = useState(false);

  // ── DATA ──
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

  // ── CRUD ──
  const openAddMat = () => {
    setEditingMat(null);
    setMatForm({ ...MAT_EMPTY, zamawiajacy: profileFullName || "" });
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
        zamawiajacy: matForm.zamawiajacy.trim() || profileFullName || null,
        data_zamowienia: matForm.data_zamowienia.trim() || null,
        data_dostawy: matForm.data_dostawy.trim() || null,
        min_stan: matForm.min_stan ? parseFloat(matForm.min_stan) : null,
      };
      if (editingMat) {
        const { error } = await (supabaseAdmin.from("warehouse_materials") as any).update(payload).eq("id", editingMat.id);
        if (error) throw error;
      } else {
        payload.created_by = profileId || null;
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

  // ── Materials import ──
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
      created_by: profileId || null,
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

  // ── Materials export ──
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

  // ── Materials filter + sort ──
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

  return {
    // Data
    materials, matLoading,
    // Search
    matSearch, setMatSearch,
    // Import/Export
    matImportLoading, handleMatImport, handleMatExport,
    // CRUD modal
    showMatModal, setShowMatModal, editingMat, matForm, setMatForm, matSaving,
    selectedMat, setSelectedMat,
    openAddMat, openEditMat, saveMatItem, deleteMatItem,
    // Sorting & Filtering
    matSortKey, matSortAsc, showMatSortDD, setShowMatSortDD,
    matFilterCol, setMatFilterCol, matFilterVal, setMatFilterVal,
    showMatFilterDD, setShowMatFilterDD, showMatFilterValDD, setShowMatFilterValDD,
    matColumns, matFilterColValues, filteredMat, toggleMatSort,
    // Core
    loadMaterials,
  };
}
