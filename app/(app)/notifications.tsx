import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications, Notification } from "@/src/providers/NotificationProvider";
import { useTheme } from "@/src/providers/ThemeProvider";

const getNotifIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    task_assigned: "person-add",
    task_completed: "checkmark-circle",
    task_status: "sync",
    project_added: "briefcase",
    plan_assignment: "calendar",
    comment: "chatbubble",
    reminder: "alarm",
    system: "information-circle",
  };
  return icons[type] || "notifications";
};

const getNotifColor = (type: string) => {
  const colors: Record<string, string> = {
    task_assigned: "#3b82f6",
    task_completed: "#10b981",
    task_status: "#f59e0b",
    project_added: "#8b5cf6",
    plan_assignment: "#f97316",
    comment: "#2563eb",
    reminder: "#ef4444",
    system: "#64748b",
  };
  return colors[type] || "#64748b";
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleNotifPress = async (notif: Notification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    if (notif.data?.task_id) {
      router.push(`/tasks/${notif.data.task_id}` as any);
    } else if (notif.data?.project_id) {
      router.push(`/projects/${notif.data.project_id}` as any);
    }
  };

  const handleClearAll = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("notifications.clear_confirm"))) {
        clearAll();
      }
    } else {
      Alert.alert(t("notifications.clear_confirm"), "", [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.confirm"), onPress: clearAll },
      ]);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return t("notifications.just_now");
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notifItem,
        { backgroundColor: tc.card, borderColor: tc.border },
        !item.read && { backgroundColor: tc.primaryLight, borderColor: tc.primary + "40" },
      ]}
      onPress={() => handleNotifPress(item)}
    >
      <View
        style={[
          styles.notifIcon,
          { backgroundColor: `${getNotifColor(item.type)}15` },
        ]}
      >
        <Ionicons
          name={getNotifIcon(item.type)}
          size={20}
          color={getNotifColor(item.type)}
        />
      </View>
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, { color: tc.text }, !item.read && styles.notifTitleUnread]}>
          {item.title}
        </Text>
        <Text style={[styles.notifBody, { color: tc.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.notifTime, { color: tc.textMuted }]}>{formatTime(item.created_at)}</Text>
      </View>
      {!item.read && <View style={[styles.unreadDot, { backgroundColor: tc.primary }]} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { backgroundColor: tc.headerBg, borderBottomColor: tc.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tc.text }]}>{t("notifications.title")}</Text>
        <View style={styles.headerRight}>
          {notifications.some((n) => !n.read) && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.headerBtn}>
              <Ionicons name="checkmark-done" size={20} color="#2563eb" />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t("notifications.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 12,
  },
  headerRight: { flexDirection: "row", gap: 4 },
  headerBtn: { padding: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#94a3b8", marginTop: 12 },
  list: { padding: 8 },
  notifItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 14,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  notifUnread: {
    backgroundColor: "#f0f9ff",
    borderColor: "#bfdbfe",
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  notifContent: { flex: 1, marginLeft: 12 },
  notifTitle: { fontSize: 14, fontWeight: "500", color: "#1e293b" },
  notifTitleUnread: { fontWeight: "700" },
  notifBody: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },
  notifTime: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
    marginLeft: 8,
  },
});
