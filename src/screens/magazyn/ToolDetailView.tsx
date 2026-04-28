/**
 * Widok szczegółów pojedynczego narzędzia w magazynie.
 * Wydzielony z magazyn.tsx (Faza 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { FIELDS, type WarehouseItem } from "@/src/hooks/useWarehouseTools";
import { useTheme } from "@/src/providers/ThemeProvider";

import { s } from "./styles";

type Props = {
  item: WarehouseItem;
  allUsers: { id: string; full_name: string }[];
  canManage: boolean;
  onBack: () => void;
  onEdit: (item: WarehouseItem) => void;
  onDelete: (item: WarehouseItem) => void;
};

export function ToolDetailView({ item, allUsers, canManage, onBack, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();

  return (
    <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
      <View style={s.titleRow}>
        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Ionicons name="construct" size={24} color="#dc2626" />
        <Text style={[s.title, { color: tc.text, flex: 1 }]} numberOfLines={1}>
          {item.beschreibung || "—"}
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
      <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
        {FIELDS.map((f) => {
          let val: unknown = (item as Record<string, unknown>)[f.key];
          if (f.key === "assigned_to" && val) {
            const userName = item.assigned_to_profile?.full_name || allUsers.find((u) => u.id === val)?.full_name || val;
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
      {item.assigned_to ? (
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
