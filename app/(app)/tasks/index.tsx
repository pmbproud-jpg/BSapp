import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { formatDate, formatRelativeDate } from "@/src/utils/dateFormatter";
import type { Database } from "@/src/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export default function TasksScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { project_id } = useLocalSearchParams<{ project_id: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "my" | "pending">("all");

  useEffect(() => {
    if (!project_id) {
      router.back();
      return;
    }
  }, [project_id]);

  const fetchTasks = async () => {
    if (!project_id) return;
    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false });

      if (filter === "my" && profile?.id) {
        query = query.eq("assigned_to", profile.id);
      } else if (filter === "pending") {
        query = query.in("status", ["pending", "in_progress"]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "#f59e0b",
      in_progress: "#3b82f6",
      completed: "#10b981",
      cancelled: "#64748b",
    };
    return colors[status] || "#94a3b8";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "#64748b",
      medium: "#f59e0b",
      high: "#ef4444",
    };
    return colors[priority] || "#94a3b8";
  };

  const getPriorityIcon = (priority: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      low: "arrow-down",
      medium: "remove",
      high: "arrow-up",
    };
    return icons[priority] || "remove";
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => router.push(`/tasks/${item.id}`)}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#2563eb" />
          <Text style={styles.taskTitle}>{item.title}</Text>
        </View>
        <View style={styles.badges}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: `${getPriorityColor(item.priority)}20` },
            ]}
          >
            <Ionicons
              name={getPriorityIcon(item.priority)}
              size={12}
              color={getPriorityColor(item.priority)}
            />
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(item.status)}20` },
            ]}
          >
            <Text
              style={[styles.statusText, { color: getStatusColor(item.status) }]}
            >
              {t(`tasks.status.${item.status}`)}
            </Text>
          </View>
        </View>
      </View>

      {item.description && (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.taskFooter}>
        {item.due_date && (
          <View style={styles.taskInfo}>
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <Text style={styles.taskInfoText}>
              {formatRelativeDate(item.due_date, i18n.language)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "all" && styles.filterButtonTextActive,
            ]}
          >
            {t("tasks.filter.all")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "my" && styles.filterButtonActive]}
          onPress={() => setFilter("my")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "my" && styles.filterButtonTextActive,
            ]}
          >
            {t("tasks.filter.my")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "pending" && styles.filterButtonActive,
          ]}
          onPress={() => setFilter("pending")}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === "pending" && styles.filterButtonTextActive,
            ]}
          >
            {t("tasks.filter.pending")}
          </Text>
        </TouchableOpacity>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-done-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t("tasks.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563eb"
            />
          }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#2563eb",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  filterButtonTextActive: {
    color: "#ffffff",
  },
  listContainer: {
    padding: 16,
  },
  taskCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 8,
    flex: 1,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
  },
  priorityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  taskDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
    lineHeight: 20,
  },
  taskFooter: {
    flexDirection: "row",
    gap: 16,
  },
  taskInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskInfoText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    textAlign: "center",
  },
});
