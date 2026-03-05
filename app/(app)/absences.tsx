import { absenceStatusColors } from "@/src/constants/colors";
import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type AbsenceItem = {
  id: string;
  user_id: string;
  type: string;
  date_from: string;
  date_to: string;
  days: number;
  status: string;
  note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  user?: { full_name: string } | null;
  approver?: { full_name: string } | null;
};

export default function AbsencesScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: tc } = useTheme();

  const [absences, setAbsences] = useState<AbsenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const canApprove =
    profile?.role === "admin" ||
    profile?.role === "management" ||
    profile?.role === "logistics";

  useFocusEffect(
    useCallback(() => {
      fetchAbsences();
    }, [filter])
  );

  const fetchAbsences = async () => {
    if (!refreshing) setLoading(true);
    try {
      let query = supabaseAdmin.from("user_absences")
        .select("*, user:profiles!user_absences_user_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAbsences(data || []);
    } catch (e) {
      console.error("Error fetching absences:", e);
      setAbsences([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const approveAbsence = async (absId: string) => {
    try {
      const { error } = await supabaseAdmin.from("user_absences")
        .update({
          status: "approved",
          approved_by: profile?.id || null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", absId);
      if (error) throw new Error(error.message);
      fetchAbsences();
      const msg = t("users.abs_approved") || "Genehmigt";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      Platform.OS === "web"
        ? window.alert(e?.message || "Error")
        : Alert.alert(t("common.error"), e?.message);
    }
  };

  const rejectAbsence = async (absId: string) => {
    try {
      const { error } = await supabaseAdmin.from("user_absences")
        .update({
          status: "rejected",
          approved_by: profile?.id || null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", absId);
      if (error) throw new Error(error.message);
      fetchAbsences();
      const msg = t("users.abs_rejected") || "Abgelehnt";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      Platform.OS === "web"
        ? window.alert(e?.message || "Error")
        : Alert.alert(t("common.error"), e?.message);
    }
  };

  const deleteAbsence = async (absId: string) => {
    const confirmMsg = t("users.abs_delete_confirm") || "Abwesenheit löschen?";
    const doDelete = async () => {
      try {
        await supabaseAdmin.from("user_absences").delete().eq("id", absId);
        fetchAbsences();
      } catch (e: any) {
        Platform.OS === "web"
          ? window.alert(e?.message || "Error")
          : Alert.alert(t("common.error"), e?.message);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(confirmMsg)) doDelete();
    } else {
      Alert.alert(t("common.confirm"), confirmMsg, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const typeLabels: Record<string, string> = {
    vacation: t("users.abs_vacation") || "Urlaub",
    sick_leave: t("users.abs_sick") || "Krankmeldung",
    special_leave: t("users.abs_special") || "Sonderurlaub",
    training: t("users.abs_training") || "Schulung",
    unexcused: t("users.abs_unexcused") || "Unentschuldigt",
  };
  const typeColors: Record<string, string> = {
    vacation: "#ef4444",
    sick_leave: "#f59e0b",
    special_leave: "#8b5cf6",
    training: "#3b82f6",
    unexcused: "#64748b",
  };
  const statusLabels: Record<string, string> = {
    pending: t("users.abs_pending") || "Ausstehend",
    approved: t("users.abs_approved") || "Genehmigt",
    rejected: t("users.abs_rejected") || "Abgelehnt",
  };
  const statusColors = absenceStatusColors;

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, "0")}.${(dt.getMonth() + 1).toString().padStart(2, "0")}.${dt.getFullYear()}`;
  };

  const filters: { key: typeof filter; label: string; color: string }[] = [
    { key: "pending", label: t("users.abs_pending") || "Ausstehend", color: "#f59e0b" },
    { key: "approved", label: t("users.abs_approved") || "Genehmigt", color: "#10b981" },
    { key: "rejected", label: t("users.abs_rejected") || "Abgelehnt", color: "#ef4444" },
    { key: "all", label: t("common.all") || "Alle", color: tc.primary },
  ];

  const pendingCount = filter === "pending" ? absences.length : 0;

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: tc.background }}>
        <ActivityIndicator size="large" color={tc.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: tc.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAbsences(); }} />}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color={tc.primary} />
        </TouchableOpacity>
        <Ionicons name="calendar-clear" size={24} color="#f59e0b" />
        <Text style={[s.title, { color: tc.text }]}>{t("absences.title") || "Urlopy"}</Text>
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              s.filterBtn,
              { borderColor: f.color },
              filter === f.key && { backgroundColor: f.color },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: filter === f.key ? "#fff" : f.color,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Count */}
      <Text style={{ fontSize: 13, color: tc.textSecondary, paddingHorizontal: 16, marginBottom: 12 }}>
        {absences.length} {t("users.abs_list") || "Einträge"}
      </Text>

      {/* List */}
      {absences.length === 0 ? (
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border, alignItems: "center", paddingVertical: 40 }]}>
          <Ionicons name="checkmark-circle" size={48} color="#10b981" />
          <Text style={{ color: tc.textMuted, marginTop: 10, fontSize: 14 }}>
            {filter === "pending"
              ? (t("absences.no_pending") || "Keine offenen Anträge")
              : (t("absences.no_entries") || "Keine Einträge")}
          </Text>
        </View>
      ) : (
        absences.map((a) => (
          <View
            key={a.id}
            style={[
              s.card,
              {
                backgroundColor: tc.card,
                borderColor: a.status === "pending" ? "#fbbf24" : tc.border,
                borderWidth: a.status === "pending" ? 2 : 1,
              },
            ]}
          >
            {/* Top row: user + type */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <Ionicons name="person-circle" size={28} color={typeColors[a.type] || "#94a3b8"} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: tc.text }}>
                  {a.user?.full_name || "?"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <View
                    style={{
                      backgroundColor: (typeColors[a.type] || "#94a3b8") + "20",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: typeColors[a.type] || "#94a3b8" }}>
                      {typeLabels[a.type] || a.type}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: (statusColors[a.status] || "#94a3b8") + "20",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: statusColors[a.status] || "#94a3b8" }}>
                      {statusLabels[a.status] || a.status}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Dates */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Ionicons name="calendar-outline" size={14} color={tc.textSecondary} />
              <Text style={{ fontSize: 13, color: tc.text, fontWeight: "600" }}>
                {fmtDate(a.date_from)} — {fmtDate(a.date_to)}
              </Text>
              <View style={{ backgroundColor: tc.primaryLight || "#eff6ff", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: tc.primary }}>
                  {a.days} {t("users.abs_days") || "Tage"}
                </Text>
              </View>
            </View>

            {/* Note */}
            {a.note ? (
              <Text style={{ fontSize: 12, color: tc.textSecondary, marginBottom: 6, fontStyle: "italic" }}>
                „{a.note}"
              </Text>
            ) : null}

            {/* Approved by */}
            {a.status !== "pending" && a.approved_at && (
              <Text style={{ fontSize: 11, color: tc.textMuted, marginBottom: 6 }}>
                {a.status === "approved" ? "✓" : "✗"} {a.approved_at ? fmtDate(a.approved_at) : ""}
              </Text>
            )}

            {/* Created */}
            <Text style={{ fontSize: 10, color: tc.textMuted, marginBottom: 8 }}>
              {t("absences.submitted") || "Eingereicht"}: {fmtDate(a.created_at)}
            </Text>

            {/* Actions */}
            {a.status === "pending" && canApprove && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "#10b981" }]}
                  onPress={() => approveAbsence(a.id)}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={s.actionBtnText}>{t("users.abs_approve") || "Genehmigen"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "#ef4444" }]}
                  onPress={() => rejectAbsence(a.id)}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={s.actionBtnText}>{t("users.abs_reject") || "Ablehnen"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Delete for admin */}
            {canApprove && (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: a.status === "pending" ? 8 : 0, alignSelf: "flex-end" }}
                onPress={() => deleteAbsence(a.id)}
              >
                <Ionicons name="trash-outline" size={14} color={tc.danger || "#ef4444"} />
                <Text style={{ fontSize: 11, color: tc.danger || "#ef4444" }}>{t("common.delete") || "Löschen"}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
