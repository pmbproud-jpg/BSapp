import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_user?: { full_name: string } | null;
  due_date?: string | null;
};

type KanbanBoardProps = {
  tasks: Task[];
  onStatusChange?: (taskId: string, newStatus: string) => void;
};

const COLUMNS = [
  { key: "pending", color: "#f59e0b", icon: "time" as const },
  { key: "in_progress", color: "#3b82f6", icon: "play-circle" as const },
  { key: "completed", color: "#10b981", icon: "checkmark-circle" as const },
];

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: "#64748b",
    medium: "#f59e0b",
    high: "#ef4444",
    urgent: "#dc2626",
  };
  return colors[priority] || "#94a3b8";
};

export default function KanbanBoard({ tasks, onStatusChange }: KanbanBoardProps) {
  const { t } = useTranslation();
  const screenWidth = Dimensions.get("window").width;
  const columnWidth = Math.max(screenWidth / 3 - 16, 200);

  const getTasksForColumn = (status: string) =>
    tasks.filter((task) => task.status === status);

  const renderTask = (task: Task) => (
    <TouchableOpacity
      key={task.id}
      style={styles.taskCard}
      onPress={() => router.push(`/tasks/${task.id}` as any)}
    >
      <View style={styles.taskHeader}>
        <View
          style={[
            styles.priorityDot,
            { backgroundColor: getPriorityColor(task.priority) },
          ]}
        />
        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>
      </View>
      {task.assigned_user?.full_name && (
        <View style={styles.taskMeta}>
          <Ionicons name="person-outline" size={12} color="#94a3b8" />
          <Text style={styles.taskMetaText} numberOfLines={1}>
            {task.assigned_user.full_name}
          </Text>
        </View>
      )}
      {task.due_date && (
        <View style={styles.taskMeta}>
          <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
          <Text style={styles.taskMetaText}>
            {new Date(task.due_date).toLocaleDateString()}
          </Text>
        </View>
      )}
      {onStatusChange && (
        <View style={styles.moveButtons}>
          {task.status !== "pending" && (
            <TouchableOpacity
              style={styles.moveBtn}
              onPress={(e) => {
                e.stopPropagation();
                const prev = task.status === "completed" ? "in_progress" : "pending";
                onStatusChange(task.id, prev);
              }}
            >
              <Ionicons name="arrow-back" size={14} color="#64748b" />
            </TouchableOpacity>
          )}
          {task.status !== "completed" && (
            <TouchableOpacity
              style={styles.moveBtn}
              onPress={(e) => {
                e.stopPropagation();
                const next = task.status === "pending" ? "in_progress" : "completed";
                onStatusChange(task.id, next);
              }}
            >
              <Ionicons name="arrow-forward" size={14} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {COLUMNS.map((col) => {
        const columnTasks = getTasksForColumn(col.key);
        return (
          <View key={col.key} style={[styles.column, { width: columnWidth }]}>
            <View style={styles.columnHeader}>
              <Ionicons name={col.icon} size={18} color={col.color} />
              <Text style={[styles.columnTitle, { color: col.color }]}>
                {t(`tasks.status.${col.key}`)}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: `${col.color}20` }]}>
                <Text style={[styles.countText, { color: col.color }]}>
                  {columnTasks.length}
                </Text>
              </View>
            </View>
            <ScrollView style={styles.columnContent} nestedScrollEnabled>
              {columnTasks.length === 0 ? (
                <View style={styles.emptyColumn}>
                  <Text style={styles.emptyText}>{t("tasks.empty")}</Text>
                </View>
              ) : (
                columnTasks.map(renderTask)
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  column: {
    marginHorizontal: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 8,
    maxHeight: 500,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginBottom: 8,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
  },
  columnContent: {
    flex: 1,
  },
  taskCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
    lineHeight: 18,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingLeft: 16,
  },
  taskMetaText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  moveButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 8,
  },
  moveBtn: {
    padding: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
  },
  emptyColumn: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#94a3b8",
  },
});
