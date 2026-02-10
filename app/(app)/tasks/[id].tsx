import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { usePermissions } from "@/src/hooks/usePermissions";
import FileAttachments from "@/components/FileAttachments";
import type { Database } from "@/src/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"] & {
  projects?: { name: string };
  assigned_user?: { full_name: string };
};

type Comment = Database["public"]["Tables"]["task_comments"]["Row"] & {
  profiles?: { full_name: string };
};

type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", status: "pending", priority: "medium", assigned_to: "", due_date: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [planUsers, setPlanUsers] = useState<any[]>([]);
  const [projectUsers, setProjectUsers] = useState<any[]>([]);

  const perms = usePermissions();
  const canEdit = perms.canEditTask;

  useFocusEffect(
    useCallback(() => {
      fetchTaskDetails();
      fetchComments();
      fetchAttachments();
    }, [id])
  );

  const fetchUsersForProject = async (projectId: string) => {
    try {
      // 1. Pracownicy z planu dziennego
      const { data: planReqs } = await (supabaseAdmin.from("plan_requests") as any)
        .select("id")
        .eq("project_id", projectId);

      let planWorkerIds: string[] = [];
      if (planReqs && planReqs.length > 0) {
        const reqIds = planReqs.map((r: any) => r.id);
        const { data: planAssign } = await (supabaseAdmin.from("plan_assignments") as any)
          .select("worker_id")
          .in("request_id", reqIds);
        if (planAssign && planAssign.length > 0) {
          planWorkerIds = [...new Set(planAssign.map((a: any) => a.worker_id))] as string[];
          const { data: pw } = await (supabaseAdmin.from("profiles") as any)
            .select("id, full_name, email")
            .in("id", planWorkerIds)
            .order("full_name");
          setPlanUsers(pw || []);
        }
      }

      // 2. Członkowie projektu (bez tych z planu)
      const { data: members } = await (supabaseAdmin.from("project_members") as any)
        .select("user_id")
        .eq("project_id", projectId);

      if (members && members.length > 0) {
        const memberIds = members.map((m: any) => m.user_id).filter((mid: string) => !planWorkerIds.includes(mid));
        if (memberIds.length > 0) {
          const { data: mp } = await (supabaseAdmin.from("profiles") as any)
            .select("id, full_name, email")
            .in("id", memberIds)
            .order("full_name");
          setProjectUsers(mp || []);
        }
      }

      // 3. Wszyscy (do users — fallback jeśli brak planu i członków)
      const allPlan = planWorkerIds.length > 0 ? planWorkerIds : [];
      const allMembers = members ? members.map((m: any) => m.user_id) : [];
      const combined = [...new Set([...allPlan, ...allMembers])];
      if (combined.length > 0) {
        const { data: combinedProfiles } = await (supabaseAdmin.from("profiles") as any)
          .select("id, full_name, email")
          .in("id", combined)
          .order("full_name");
        setUsers(combinedProfiles || []);
      } else {
        const { data, error } = await (supabaseAdmin.from("profiles") as any)
          .select("id, full_name, email")
          .order("full_name");
        if (!error) setUsers(data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const openEditModal = () => {
    if (!task) return;
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "pending",
      priority: task.priority || "medium",
      assigned_to: (task as any).assigned_to || "",
      due_date: task.due_date || "",
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editForm.title.trim()) {
      Alert.alert(t("common.error"), t("tasks.title_required"));
      return;
    }
    setEditSaving(true);
    try {
      const updateData: any = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        status: editForm.status,
        priority: editForm.priority,
        assigned_to: editForm.assigned_to || null,
        due_date: editForm.due_date || null,
      };
      const { error } = await (supabase.from("tasks") as any)
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      setShowEditModal(false);
      fetchTaskDetails();
    } catch (error) {
      console.error("Error updating task:", error);
      Alert.alert(t("common.error"), t("tasks.update_error"));
    } finally {
      setEditSaving(false);
    }
  };

  const fetchTaskDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name), assigned_user:profiles!assigned_to(full_name)")
        .eq("id", id)
        .single();

      if (error) throw error;
      setTask(data);
      if (data?.project_id) {
        fetchUsersForProject(data.project_id);
      }
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

  const fetchAttachments = async () => {
    try {
      const { data, error } = await (supabase
        .from("task_attachments") as any)
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !profile?.id || !id) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase.from("task_comments").insert({
        task_id: id,
        user_id: profile.id,
        comment: newComment.trim(),
      } as any);

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

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      const { error } = await (supabase
        .from("tasks") as any)
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      fetchTaskDetails();
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert(t("common.error"), t("tasks.update_error"));
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
              if (task?.project_id) {
                router.replace(`/projects/${task.project_id}` as any);
              } else {
                router.back();
              }
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
      urgent: "#dc2626",
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
        <TouchableOpacity onPress={() => {
          if (task?.project_id) {
            router.replace(`/projects/${task.project_id}` as any);
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/projects" as any);
          }
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("tasks.details")}</Text>
        {canEdit && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={openEditModal}
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

          {/* Quick Status Change */}
          {canEdit && task.status !== "completed" && (
            <View style={styles.quickActions}>
              <Text style={styles.quickActionsLabel}>{t("tasks.change_status")}:</Text>
              <View style={styles.statusButtons}>
                {task.status === "pending" && (
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: "#3b82f620" }]}
                    onPress={() => updateStatus("in_progress")}
                  >
                    <Ionicons name="play" size={16} color="#3b82f6" />
                    <Text style={[styles.statusButtonText, { color: "#3b82f6" }]}>
                      {t("tasks.status.in_progress")}
                    </Text>
                  </TouchableOpacity>
                )}
                {(task.status === "pending" || task.status === "in_progress") && (
                  <TouchableOpacity
                    style={[styles.statusButton, { backgroundColor: "#10b98120" }]}
                    onPress={() => updateStatus("completed")}
                  >
                    <Ionicons name="checkmark" size={16} color="#10b981" />
                    <Text style={[styles.statusButtonText, { color: "#10b981" }]}>
                      {t("tasks.status.completed")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

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

        {/* Attachments Section */}
        <View style={styles.card}>
          <FileAttachments
            attachments={attachments}
            entityType="task"
            entityId={id || ""}
            canUpload={canEdit}
            onRefresh={fetchAttachments}
          />
        </View>

        {/* Comments Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tasks.comments")}</Text>

          {comments.length === 0 ? (
            <Text style={styles.emptyText}>{t("tasks.no_comments")}</Text>
          ) : (
            comments.map((comment) => (
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
            ))
          )}

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

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Task Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("tasks.edit")}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }}>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.title")} *</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.title}
                  onChangeText={(v) => setEditForm({ ...editForm, title: v })}
                  placeholder={t("tasks.title_placeholder")}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.description")}</Text>
                <TextInput
                  style={[styles.editInput, { minHeight: 80, textAlignVertical: "top" }]}
                  value={editForm.description}
                  onChangeText={(v) => setEditForm({ ...editForm, description: v })}
                  placeholder={t("tasks.description_placeholder")}
                  placeholderTextColor="#94a3b8"
                  multiline
                />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.statusLabel")}</Text>
                <View style={styles.editChips}>
                  {["pending", "in_progress", "completed", "cancelled"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.editChip, editForm.status === s && styles.editChipActive]}
                      onPress={() => setEditForm({ ...editForm, status: s })}
                    >
                      <Text style={[styles.editChipText, editForm.status === s && styles.editChipTextActive]}>
                        {t(`tasks.status.${s}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.priorityLabel")}</Text>
                <View style={styles.editChips}>
                  {["low", "medium", "high"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.editChip, editForm.priority === p && styles.editChipActive, editForm.priority === p && p === "high" && { backgroundColor: "#dc2626", borderColor: "#dc2626" }]}
                      onPress={() => setEditForm({ ...editForm, priority: p })}
                    >
                      <Text style={[styles.editChipText, editForm.priority === p && styles.editChipTextActive]}>
                        {t(`tasks.priority.${p}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.assigned_to")}</Text>
                <TouchableOpacity
                  style={[styles.editChip, !editForm.assigned_to && styles.editChipActive, { alignSelf: "flex-start", marginBottom: 8 }]}
                  onPress={() => setEditForm({ ...editForm, assigned_to: "" })}
                >
                  <Text style={[styles.editChipText, !editForm.assigned_to && styles.editChipTextActive]}>— {t("common.none")}</Text>
                </TouchableOpacity>

                {planUsers.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#10b981", marginBottom: 4, textTransform: "uppercase" }}>
                      {t("plan.workers_from_plan")}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      <View style={styles.editChips}>
                        {planUsers.map((u) => (
                          <TouchableOpacity
                            key={u.id}
                            style={[styles.editChip, editForm.assigned_to === u.id && styles.editChipActive, { borderColor: "#10b981" }]}
                            onPress={() => setEditForm({ ...editForm, assigned_to: u.id })}
                          >
                            <Text style={[styles.editChipText, editForm.assigned_to === u.id && styles.editChipTextActive]} numberOfLines={1}>
                              {u.full_name || u.email}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                {projectUsers.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>
                      {t("tasks.project_members") || "Członkowie projektu"}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.editChips}>
                        {projectUsers.map((u) => (
                          <TouchableOpacity
                            key={u.id}
                            style={[styles.editChip, editForm.assigned_to === u.id && styles.editChipActive]}
                            onPress={() => setEditForm({ ...editForm, assigned_to: u.id })}
                          >
                            <Text style={[styles.editChipText, editForm.assigned_to === u.id && styles.editChipTextActive]} numberOfLines={1}>
                              {u.full_name || u.email}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                {planUsers.length === 0 && projectUsers.length === 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.editChips}>
                      {users.map((u) => (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.editChip, editForm.assigned_to === u.id && styles.editChipActive]}
                          onPress={() => setEditForm({ ...editForm, assigned_to: u.id })}
                        >
                          <Text style={[styles.editChipText, editForm.assigned_to === u.id && styles.editChipTextActive]} numberOfLines={1}>
                            {u.full_name || u.email}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.due_date")}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editForm.due_date}
                  onChangeText={(v) => setEditForm({ ...editForm, due_date: v })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={editSaving}
            >
              <Text style={styles.editSaveBtnText}>
                {editSaving ? t("common.loading") : t("common.save")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  quickActions: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  quickActionsLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: "row",
    gap: 8,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  statusButtonText: {
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
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1e293b",
  },
  editChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  editChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  editChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  editChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  editChipTextActive: {
    color: "#ffffff",
  },
  editSaveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  editSaveBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
