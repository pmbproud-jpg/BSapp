import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Alert, Platform,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { usePermissions } from "@/src/hooks/usePermissions";
import { useTheme } from "@/src/providers/ThemeProvider";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

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
  created_at: string;
};

const EMPTY_FORM = {
  iv_pds: "", menge: "", beschreibung: "", serial_nummer: "", akku_serial_nummer: "",
  ladegeraet_sn: "", status: "", datum_abgeben: "", baustelle: "",
  hersteller: "", inventar: "", aufmerksamkeit: "", art_nr: "", datum_inventur: "",
  kategorie: "", wartungstermine: "",
};

const FIELDS: { key: keyof typeof EMPTY_FORM; label: string; labelDE: string }[] = [
  { key: "iv_pds", label: "IV / PDS", labelDE: "IV / PDS" },
  { key: "menge", label: "Ilość", labelDE: "Menge" },
  { key: "beschreibung", label: "Opis", labelDE: "Beschreibung" },
  { key: "serial_nummer", label: "Numer seryjny", labelDE: "Serial Nummer" },
  { key: "akku_serial_nummer", label: "Numer seryjny akumulatora", labelDE: "Akku Serial Nummer" },
  { key: "ladegeraet_sn", label: "Numer seryjny ładowarki", labelDE: "Ladegerät S.N" },
  { key: "status", label: "Status", labelDE: "Status" },
  { key: "datum_abgeben", label: "Data wydania / przekazania", labelDE: "Datum Abgeben" },
  { key: "baustelle", label: "Budowa / plac budowy", labelDE: "Baustelle" },
  { key: "hersteller", label: "Producent", labelDE: "Hersteller" },
  { key: "inventar", label: "Inwentarz / majątek", labelDE: "Inventar" },
  { key: "aufmerksamkeit", label: "Uwaga", labelDE: "Aufmerksamkeit" },
  { key: "art_nr", label: "Nr artykułu", labelDE: "Art-Nr" },
  { key: "datum_inventur", label: "Data inwentaryzacji", labelDE: "Datum Inventur" },
  { key: "kategorie", label: "Kategoria", labelDE: "Kategorie" },
  { key: "wartungstermine", label: "Terminy konserwacji 2026", labelDE: "Wartungstermine 2026" },
];

export default function MagazynScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: tc } = useTheme();

  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);

  const canManage = perms.isAdmin || perms.isManagement;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const { data, error } = await (supabase.from("warehouse_items") as any)
        .select("*")
        .order("iv_pds", { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading magazyn data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
      };

      if (editingItem) {
        const { error } = await (supabase.from("warehouse_items") as any)
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        payload.created_by = profile?.id || null;
        const { error } = await (supabase.from("warehouse_items") as any)
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
      const { error } = await (supabase.from("warehouse_items") as any)
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
            const XLSX = await import("xlsx");
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            await processImportRows(rows);
          } catch (err) {
            console.error("Import error:", err);
            window.alert(t("magazyn.import_error") || "Błąd importu");
          } finally {
            setImportLoading(false);
          }
        };
        reader.readAsArrayBuffer(blob);
      } else {
        // Mobile: read file
        try {
          const XLSX = await import("xlsx");
          const fileContent = await FileSystem.readAsStringAsync(file.uri, {
            encoding: "base64" as any,
          });
          const workbook = XLSX.read(fileContent, { type: "base64" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          await processImportRows(rows);
        } catch (err) {
          console.error("Import error:", err);
          Alert.alert(t("common.error"), t("magazyn.import_error") || "Błąd importu");
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
      const msg = t("magazyn.import_empty") || "Plik nie zawiera danych";
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
      const { error } = await (supabase.from("warehouse_items") as any).insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
      } else {
        inserted += batch.length;
      }
    }

    const msg = (t("magazyn.import_success") || "Zaimportowano") + `: ${inserted} / ${itemsToInsert.length}`;
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert(t("common.success"), msg);
    loadData();
  };

  // ── FILTER ──
  const filtered = items.filter((item) => {
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
      (item.art_nr || "").toLowerCase().includes(q)
    );
  });

  // ── RENDER ──
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  // Detail view
  if (selectedItem) {
    return (
      <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
        <View style={s.titleRow}>
          <TouchableOpacity onPress={() => setSelectedItem(null)} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={tc.text} />
          </TouchableOpacity>
          <Ionicons name="cube" size={24} color="#dc2626" />
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
            const val = (selectedItem as any)[f.key];
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={s.titleRow}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Ionicons name="cube" size={28} color="#dc2626" />
        <Text style={[s.title, { color: tc.text }]}>{t("magazyn.title") || "Magazyn"}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 13, color: tc.textSecondary }}>{filtered.length} / {items.length}</Text>
      </View>

      {/* Action buttons */}
      {canManage && (
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#dc2626" }]} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.actionBtnText}>{t("magazyn.add_item") || "Dodaj"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: "#16a34a" }]}
            onPress={handleImport}
            disabled={importLoading}
          >
            {importLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={s.actionBtnText}>{t("magazyn.import_excel") || "Import Excel"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <View style={[s.searchBox, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <Ionicons name="search" size={18} color={tc.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: tc.text }]}
          placeholder={t("magazyn.search_placeholder") || "Szukaj..."}
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

      {/* Items list */}
      {filtered.length === 0 ? (
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={{ alignItems: "center", paddingVertical: 30 }}>
            <Ionicons name="cube-outline" size={48} color="#dc2626" />
            <Text style={{ fontSize: 15, color: tc.textSecondary, marginTop: 12 }}>
              {items.length === 0
                ? (t("magazyn.empty_state") || "Brak pozycji w magazynie")
                : (t("magazyn.no_results") || "Brak wyników")}
            </Text>
          </View>
        </View>
      ) : (
        filtered.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[s.itemCard, { backgroundColor: tc.card, borderColor: tc.border }]}
            activeOpacity={0.7}
            onPress={() => setSelectedItem(item)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={s.itemIcon}>
                <Ionicons name="construct" size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.itemTitle, { color: tc.text }]} numberOfLines={1}>
                  {item.beschreibung || "—"}
                </Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 3 }}>
                  {item.iv_pds && <Text style={[s.itemMeta, { color: tc.textSecondary }]}>{item.iv_pds}</Text>}
                  {item.hersteller && <Text style={[s.itemMeta, { color: tc.textSecondary }]}>{item.hersteller}</Text>}
                  {item.serial_nummer && <Text style={[s.itemMeta, { color: tc.textSecondary }]}>SN: {item.serial_nummer}</Text>}
                </View>
                {item.baustelle && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="location-outline" size={12} color={tc.textSecondary} />
                    <Text style={[s.itemMeta, { color: tc.textSecondary }]}>{item.baustelle}</Text>
                  </View>
                )}
              </View>
              {item.menge && (
                <View style={s.mengeBadge}>
                  <Text style={s.mengeText}>{item.menge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={tc.textSecondary} />
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 40 }} />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>
                {editingItem
                  ? (t("magazyn.edit_item") || "Edytuj pozycję")
                  : (t("magazyn.add_item") || "Dodaj pozycję")}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {FIELDS.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={form[f.key]}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.labelDE}
                    placeholderTextColor={tc.textMuted || "#999"}
                    keyboardType="default"
                  />
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: "#dc2626" }]}
                onPress={saveItem}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>
                )}
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
  actionRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
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
});
