/**
 * Lista planow budowlanych projektu (kafelki z thumbnailem PDF/zdjecia).
 * Renderowana gdy nie ma wybranego planu albo user wrocil do listy.
 * Wydzielona z ProjectPlans.tsx (Faza 2 step 3).
 */
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/src/providers/ThemeProvider";

type Plan = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  floor_level: string | null;
  file_url: string;
  file_type: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

type Props = {
  plans: Plan[];
  loadingPlans: boolean;
  onSelectPlan: (plan: Plan) => void;
  onDelete: (planId: string) => void;
  onUpload: () => void;
  onBack?: () => void;
  uploadModal: ReactNode;
};

export function PlanListView({ plans, loadingPlans, onSelectPlan, onDelete, onUpload, onBack, uploadModal }: Props) {
  const { t } = useTranslation();
  const { colors: tc, isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color={tc.text} />
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 18, fontWeight: "700", color: tc.text }}>
            <Ionicons name="map-outline" size={20} color={tc.primary} /> {t("plans.title", "Plany budowlane")}
          </Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: tc.primary, paddingVertical: 14, borderRadius: 12, shadowColor: tc.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }}
          onPress={onUpload}
        >
          <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{t("plans.upload", "Dodaj plan")}</Text>
        </TouchableOpacity>
      </View>

      {loadingPlans ? (
        <ActivityIndicator size="large" color={tc.primary} style={{ marginTop: 40 }} />
      ) : plans.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: tc.primary + "15", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="map-outline" size={40} color={tc.primary} />
          </View>
          <Text style={{ color: tc.text, fontSize: 18, fontWeight: "700", marginBottom: 6 }}>{t("plans.no_plans", "Brak planów")}</Text>
          <Text style={{ color: tc.textMuted, fontSize: 14, textAlign: "center", marginBottom: 20 }}>{t("plans.upload_hint", "Dodaj plan PDF lub zdjęcie")}</Text>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: tc.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, shadowColor: tc.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 }}
            onPress={onUpload}
          >
            <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>{t("plans.upload", "Dodaj plan")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        plans.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? tc.surface : "#fff",
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: tc.border,
            }}
            onPress={() => onSelectPlan(plan)}
          >
            {plan.file_type === "image" ? (
              <Image
                source={{ uri: plan.file_url }}
                style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: tc.surfaceVariant }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="document-text" size={28} color="#ef4444" />
                <Text style={{ fontSize: 9, color: "#ef4444", fontWeight: "700" }}>PDF</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: tc.text }}>{plan.name}</Text>
              {plan.floor_level ? (
                <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }}>
                  <Ionicons name="layers-outline" size={12} /> {plan.floor_level}
                </Text>
              ) : null}
              {plan.description ? (
                <Text style={{ fontSize: 12, color: tc.textMuted, marginTop: 2 }} numberOfLines={1}>{plan.description}</Text>
              ) : null}
              <Text style={{ fontSize: 11, color: tc.textMuted, marginTop: 4 }}>
                v{plan.version} · {new Date(plan.created_at).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onDelete(plan.id)} style={{ padding: 8 }}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}

      {uploadModal}
    </View>
  );
}
