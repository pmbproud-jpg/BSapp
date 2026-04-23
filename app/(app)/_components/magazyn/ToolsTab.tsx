/**
 * Zakładka "Werkzeuge" (Tools) w magazynie:
 * action buttons, search, sort/filter dropdowns, tabela narzędzi.
 * Wydzielona z magazyn.tsx (Faza 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/src/providers/ThemeProvider";
import type { useWarehouseTools } from "@/src/hooks/useWarehouseTools";

import { s } from "./styles";

type ToolsHook = ReturnType<typeof useWarehouseTools>;

type Props = {
  tools: ToolsHook;
  canManage: boolean;
};

export function ToolsTab({ tools, canManage }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();

  const {
    items, search, setSearch, importLoading, handleImport, handleToolsExport,
    openAdd, setSelectedItem,
    toolSortKey, toolSortAsc,
    showSortDropdown, setShowSortDropdown,
    filterColumn, setFilterColumn, filterValue, setFilterValue,
    showFilterDropdown, setShowFilterDropdown,
    showFilterValueDropdown, setShowFilterValueDropdown,
    toolColumns, filterColumnValues, filtered, toggleToolSort,
    openStatusUserModal, openNotesModal,
  } = tools;

  return (
    <>
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
            <Text style={s.actionBtnText}>{t("magazyn.export_excel")}</Text>
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
        <View style={{ position: "relative", zIndex: 20 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", backgroundColor: tc.card }}
            onPress={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); setShowFilterValueDropdown(false); }}
          >
            <Ionicons name="swap-vertical" size={14} color="#2563eb" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: tc.text }}>{t("magazyn.sort")}: {toolColumns.find((c) => c.key === toolSortKey)?.label || "—"}</Text>
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

        <View style={{ position: "relative", zIndex: 19 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: filterColumn ? "#f59e0b" : (tc.border || "#e2e8f0"), backgroundColor: filterColumn ? "#fef3c720" : tc.card }}
            onPress={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); setShowFilterValueDropdown(false); }}
          >
            <Ionicons name="funnel" size={14} color={filterColumn ? "#f59e0b" : tc.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: filterColumn ? "#f59e0b" : tc.text }}>
              {filterColumn ? `${toolColumns.find((c) => c.key === filterColumn)?.label}: ${filterValue || "…"}` : t("magazyn.filter")}
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
                <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>{t("magazyn.reset_filters")}</Text>
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

        {filterColumn ? (
          <View style={{ position: "relative", zIndex: 18 }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: filterValue ? "#10b981" : (tc.border || "#e2e8f0"), backgroundColor: filterValue ? "#10b98110" : tc.card }}
              onPress={() => { setShowFilterValueDropdown(!showFilterValueDropdown); setShowSortDropdown(false); setShowFilterDropdown(false); }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: filterValue ? "#10b981" : tc.textSecondary }}>{filterValue || t("magazyn.select_value")}</Text>
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
                  <Text style={{ padding: 12, fontSize: 12, color: tc.textMuted }}>{t("magazyn.no_values")}</Text>
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
                  { label: t("magazyn.col_description"), w: 180, key: "beschreibung" },
                  { label: t("magazyn.col_manufacturer"), w: 110, key: "hersteller" },
                  { label: "SN", w: 120, key: "serial_nummer" },
                  { label: t("magazyn.status_label"), w: 110, key: "status" },
                  { label: t("magazyn.col_site"), w: 120, key: "baustelle" },
                  { label: t("magazyn.col_qty"), w: 60, key: "menge" },
                  { label: t("magazyn.col_category"), w: 100, key: "kategorie" },
                  { label: t("magazyn.notes_title"), w: 120, key: "notes" },
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
  );
}
