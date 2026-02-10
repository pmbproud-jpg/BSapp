import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import type { Database } from "@/src/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"] & {
  projects?: { name: string };
  assigned_user?: { full_name: string };
};

type Comment = Database["public"]["Tables"]["task_comments"]["Row"] & {
  profiles?: { full_name: string };
};

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isZarzad = profile?.role === "zarzad";
  const isPM = profile?.role === "project_manager";
  const isBauleiter = profile?.role === "bauleiter";
  const canEdit = isAdmin || isZarzad || isPM || isBauleiter;

  useEffect(() => {
    fetchTaskDetails();
    fetchComments();
  }, [id]);

  const fetchTaskDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name), assigned_user:profiles!assigned_to(full_name)")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTask(data);
    } catch (error) {
      console.error("Error fetching task:", error);
      Alert.alert(t("common.error"), t("tasks.fetch_error"));
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, profiles(full_name)")
        .eq("task_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase.from("task_comments").insert({
        task_id: id,
        user_id: profile?.id,
        comment: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert(t("common.error"), t("tasks.comment_error"));
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteTask = async () => {
    Alert.alert(
      t("tasks.delete_confirm_title"),
      t("tasks.delete_confirm_message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", id);

              if (error) throw error;
              router.back();
            } catch (error) {
              console.error("Error deleting task:", error);
              Alert.alert(t("common.error"), t("tasks.delete_error"));
            }
          },
        },
      ]
    );
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t("tasks.not_found")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("tasks.details")}</Text>
        {canEdit && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push(`/tasks/${id}/edit`)}
              style={styles.iconButton}
            >
              <Ionicons name="create-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteTask} style={styles.iconButton}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={styles.badges}>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: `${getPriorityColor(task.priority)}20` },
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    { color: getPriorityColor(task.priority) },
                  ]}
                >
                  {t(`tasks.priority.${task.priority}`)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${getStatusColor(task.status)}20` },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(task.status) },
                  ]}
                >
                  {t(`tasks.status.${task.status}`)}
                </Text>
              </View>
            </View>
          </View>

          {task.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("tasks.description")}</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>
          )}

          <View style={styles.infoGrid}>
            {task.projects?.name && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="briefcase-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.project")}</Text>
                </View>
                <Text style={styles.infoValue}>{task.projects.name}</Text>
              </View>
            )}

            {task.assigned_user?.full_name && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.assigned_to")}</Text>
                </View>
                <Text style={styles.infoValue}>{task.assigned_user.full_name}</Text>
              </View>
            )}

            {task.due_date && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.due_date")}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {new Date(task.due_date).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tasks.comments")}</Text>

          {comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>
                  {comment.profiles?.full_name || "Unknown"}
                </Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.commentText}>{comment.comment}</Text>
            </View>
          ))}

          <View style={styles.addComment}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder={t("tasks.add_comment")}
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.commentButton,
                (!newComment.trim() || submittingComment) &&
                  styles.commentButtonDisabled,
              ]}
              onPress={addComment}
              disabled={!newComment.trim() || submittingComment}
            >
              <Ionicons name="send" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  taskHeader: {
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    gap: 6,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoLabelText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "600",
  },
  comment: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  commentDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
  commentText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  addComment: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e293b",
    minHeight: 44,
  },
  commentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  commentButtonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    fontSize: 16,
    color: "#64748b",
  },
});
