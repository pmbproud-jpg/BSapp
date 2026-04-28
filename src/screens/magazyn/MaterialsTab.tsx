/**
 * Zakładka "Materialien" w magazynie:
 * action buttons, search, sort/filter dropdowns, tabela materiałów.
 * Wydzielona z magazyn.tsx (Faza 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/src/providers/ThemeProvider";
import type { useWarehouseMaterials } from "@/src/hooks/useWarehouseMaterials";

import { s } from "./styles";

type MaterialsHook = ReturnType<typeof useWarehouseMaterials>;

type Props = {
  mats: MaterialsHook;
  canManageMaterials: boolean;
};

export function MaterialsTab({ mats, canManageMaterials }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();

  const {
    materials,
    matSearch, setMatSearch,
    matImportLoading, handleMatImport, handleMatExport,
    openAddMat, setSelectedMat,
    matSortKey, matSortAsc, showMatSortDD, setShowMatSortDD,
    matFilterCol, setMatFilterCol, matFilterVal, setMatFilterVal,
    showMatFilterDD, setShowMatFilterDD, showMatFilterValDD, setShowMatFilterValDD,
    matColumns, matFilterColValues, filteredMat, toggleMatSort,
  } = mats;

  return (
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
                <Text style={s.actionBtnText}>{t("magazyn.import_excel")}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#2563eb" }]} onPress={handleMatExport}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={s.actionBtnText}>{t("magazyn.export_excel")}</Text>
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

      <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <View style={{ position: "relative", zIndex: 20 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", backgroundColor: tc.card }}
            onPress={() => { setShowMatSortDD(!showMatSortDD); setShowMatFilterDD(false); setShowMatFilterValDD(false); }}
          >
            <Ionicons name="swap-vertical" size={14} color="#2563eb" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: tc.text }}>{t("magazyn.sort")}: {matColumns.find((c) => c.key === matSortKey)?.label || "—"}</Text>
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
              {matFilterCol ? `${matColumns.find((c) => c.key === matFilterCol)?.label}: ${matFilterVal || "…"}` : t("magazyn.filter")}
            </Text>
            {matFilterCol ? <TouchableOpacity onPress={() => { setMatFilterCol(""); setMatFilterVal(""); setShowMatFilterDD(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close-circle" size={14} color="#f59e0b" /></TouchableOpacity> : null}
          </TouchableOpacity>
          {showMatFilterDD && (
            <View style={{ position: "absolute", top: 38, left: 0, minWidth: 180, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
              <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setMatFilterCol(""); setMatFilterVal(""); setShowMatFilterDD(false); }}>
                <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "600" }}>{t("magazyn.reset_filters")}</Text>
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
              <Text style={{ fontSize: 12, fontWeight: "600", color: matFilterVal ? "#10b981" : tc.textSecondary }}>{matFilterVal || t("magazyn.select_value")}</Text>
              <Ionicons name="chevron-down" size={12} color={matFilterVal ? "#10b981" : tc.textSecondary} />
            </TouchableOpacity>
            {showMatFilterValDD && (
              <ScrollView style={{ position: "absolute", top: 38, left: 0, minWidth: 200, maxHeight: 250, backgroundColor: tc.card, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", elevation: 8, zIndex: 100 }}>
                {matFilterColValues.map((val) => (
                  <TouchableOpacity key={val} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.border || "#f1f5f9" }} onPress={() => { setMatFilterVal(val); setShowMatFilterValDD(false); }}>
                    <Text style={{ fontSize: 13, color: matFilterVal === val ? "#10b981" : tc.text, fontWeight: matFilterVal === val ? "700" : "400" }}>{val}</Text>
                  </TouchableOpacity>
                ))}
                {matFilterColValues.length === 0 && <Text style={{ padding: 12, fontSize: 12, color: tc.textMuted }}>{t("magazyn.no_values")}</Text>}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>

      <Text style={{ paddingHorizontal: 16, fontSize: 12, color: tc.textSecondary, marginBottom: 6 }}>{filteredMat.length} / {materials.length}</Text>

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
              <View style={{ flexDirection: "row", backgroundColor: "#92400e", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                {[
                  { label: t("magazyn.col_position"), w: 50, key: "pozycja" },
                  { label: t("magazyn.col_art_nr"), w: 80, key: "art_nr" },
                  { label: t("magazyn.col_name"), w: 180, key: "nazwa" },
                  { label: t("magazyn.col_qty"), w: 60, key: "ilosc" },
                  { label: t("magazyn.col_length"), w: 70, key: "dlugosc" },
                  { label: t("magazyn.col_width"), w: 75, key: "szerokosc" },
                  { label: t("magazyn.col_height"), w: 70, key: "wysokosc" },
                  { label: t("magazyn.col_weight"), w: 70, key: "waga" },
                  { label: t("magazyn.col_entered_by"), w: 110, key: "zamawiajacy" },
                  { label: t("magazyn.col_min"), w: 70, key: "min_stan" },
                ].map((col) => (
                  <TouchableOpacity key={col.key} onPress={() => toggleMatSort(col.key)} style={{ width: col.w, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{col.label}</Text>
                    {matSortKey === col.key && (
                      <Ionicons name={matSortAsc ? "arrow-up" : "arrow-down"} size={10} color="#fbbf24" style={{ marginLeft: 2 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
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
  );
}
