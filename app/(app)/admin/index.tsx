import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";

const TILES = [
  { key: "database", icon: "server-outline", color: "#2563eb", bg: "#eff6ff" },
  { key: "passwords", icon: "key-outline", color: "#ea580c", bg: "#fff7ed" },
  { key: "permissions", icon: "shield-outline", color: "#7c3aed", bg: "#f5f3ff" },
  { key: "company", icon: "business-outline", color: "#059669", bg: "#ecfdf5" },
  { key: "updates", icon: "cloud-download-outline", color: "#dc2626", bg: "#fef2f2" },
] as const;

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const isMobile = Platform.OS !== "web";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tc.background }}>
      <View style={{ padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="shield-checkmark" size={24} color="#fff" />
          </View>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: tc.text }}>
              {t("admin.title", "Panel administracyjny")}
            </Text>
            <Text style={{ fontSize: 13, color: tc.textMuted, marginTop: 2 }}>
              {t("admin.subtitle", "Zarządzaj aplikacją i bazą danych")}
            </Text>
          </View>
        </View>

        {/* Tiles Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {TILES.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={{
                width: isMobile ? "100%" : "calc(50% - 6px)" as any,
                minWidth: isMobile ? undefined : 260,
                backgroundColor: tile.bg,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: tile.color + "22",
              }}
              activeOpacity={0.7}
              onPress={() => router.push(`/(app)/admin/${tile.key}` as any)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 14,
                  backgroundColor: tile.color + "18",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={tile.icon as any} size={26} color={tile.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: tile.color }}>
                    {t(`admin.tiles.${tile.key}`, tile.key)}
                  </Text>
                  <Text style={{ fontSize: 12, color: tile.color + "99", marginTop: 2 }}>
                    {t(`admin.tiles.${tile.key}_desc`, "")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tile.color + "66"} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
