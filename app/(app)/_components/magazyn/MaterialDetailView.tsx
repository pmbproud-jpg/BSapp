/**
 * Widok szczegółów pojedynczego materiału w magazynie.
 * Wydzielony z magazyn.tsx (Faza 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { MAT_FIELDS, type MaterialItem } from "@/src/hooks/useWarehouseMaterials";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "./styles";

type Props = {
  item: MaterialItem;
  canManage: boolean;
  onBack: () => void;
  onEdit: (item: MaterialItem) => void;
  onDelete: (item: MaterialItem) => void;
};

export function MaterialDetailView({ item, canManage, onBack, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const isLowStock = item.min_stan != null && item.ilosc != null && item.ilosc <= item.min_stan;

  return (
    <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
      <View style={s.titleRow}>
        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Ionicons name="layers" size={24} color="#f97316" />
        <Text style={[s.title, { color: tc.text, flex: 1 }]} numberOfLines={1}>
          {item.nazwa || "—"}
        </Text>
        {canManage && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => { onBack(); onEdit(item); }} style={{ padding: 6 }}>
              <Ionicons name="create-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item)} style={{ padding: 6 }}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {isLowStock && (
        <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="warning" size={18} color="#ef4444" />
          <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>
            {t("magazyn.low_stock") || "Niedriger Lagerbestand!"} (min: {item.min_stan})
          </Text>
        </View>
      )}
      <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
        {MAT_FIELDS.map((f) => {
          const val = (item as Record<string, unknown>)[f.key];
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
