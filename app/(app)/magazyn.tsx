import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

import { orderStatusColors } from "@/src/constants/colors";
import { usePermissions } from "@/src/hooks/usePermissions";
import { MAT_FIELDS, useWarehouseMaterials } from "@/src/hooks/useWarehouseMaterials";
import { useWarehouseOrders } from "@/src/hooks/useWarehouseOrders";
import { FIELDS, useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";

export default function MagazynScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: tc } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<"tools" | "materials" | "orders">("tools");

  // Users for assignment
  const [allUsers, setAllUsers] = useState<{ id: string; full_name: string }[]>([]);
  // Projects for baustelle picker
  const [allProjects, setAllProjects] = useState<{ id: string; name: string; project_number: string | null; location: string | null }[]>([]);

  // ─── Hooks ───
  const tools = useWarehouseTools(profile?.id ?? undefined, allUsers, t);
  const mats = useWarehouseMaterials(profile?.id ?? undefined, profile?.full_name ?? undefined, t);
  const orders = useWarehouseOrders(t);

  // Destructure for JSX compatibility
  const {
    items, loading, refreshing, setRefreshing,
    search, setSearch, importLoading, handleImport, handleToolsExport,
    showModal, setShowModal, editingItem, form, setForm, saving,
    selectedItem, setSelectedItem,
    openAdd, openEdit, saveItem, deleteItem,
    toolSortKey, toolSortAsc,
    showSortDropdown, setShowSortDropdown,
    filterColumn, setFilterColumn, filterValue, setFilterValue,
    showFilterDropdown, setShowFilterDropdown,
    showFilterValueDropdown, setShowFilterValueDropdown,
    toolColumns, filterColumnValues, filtered, toggleToolSort,
    showStatusUserModal, setShowStatusUserModal,
    statusUserItem, statusUserSearch, setStatusUserSearch,
    openStatusUserModal, assignStatusToUser,
    showNotesModal, setShowNotesModal,
    notesItem, notesText, setNotesText,
    notesDamaged, setNotesDamaged, notesSaving, saveNotes, openNotesModal,
    showBaustellePicker, setShowBaustellePicker,
    baustelleSearch, setBaustelleSearch,
    loadData,
  } = tools;

  const {
    materials, matLoading,
    matSearch, setMatSearch,
    matImportLoading, handleMatImport, handleMatExport,
    showMatModal, setShowMatModal, editingMat, matForm, setMatForm, matSaving,
    selectedMat, setSelectedMat,
    openAddMat, openEditMat, saveMatItem, deleteMatItem,
    matSortKey, matSortAsc, showMatSortDD, setShowMatSortDD,
    matFilterCol, setMatFilterCol, matFilterVal, setMatFilterVal,
    showMatFilterDD, setShowMatFilterDD, showMatFilterValDD, setShowMatFilterValDD,
    matColumns, matFilterColValues, filteredMat, toggleMatSort,
    loadMaterials,
  } = mats;

  const {
    allOrders, ordersLoading,
    orderSearch, setOrderSearch,
    orderSortKey, orderSortAsc, showOrdSortDD, setShowOrdSortDD,
    ordFilterCol, setOrdFilterCol, ordFilterVal, setOrdFilterVal,
    showOrdFilterDD, setShowOrdFilterDD, showOrdFilterValDD, setShowOrdFilterValDD,
    ordColumns, ordFilterColValues, filteredOrders, toggleOrderSort,
    getOrderItemName,
    showOrderEditModal, setShowOrderEditModal,
    editingOrder, orderForm, setOrderForm, orderSaving,
    loadOrders, openEditOrder, saveOrder, deleteOrder,
  } = orders;

  const canManage = perms.canEditWarehouse;
  const canManageMaterials = perms.canEditWarehouse || perms.canOrderMaterials;

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

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadMaterials();
      loadUsers();
      loadProjects();
      loadOrders();
    }, [])
  );


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
