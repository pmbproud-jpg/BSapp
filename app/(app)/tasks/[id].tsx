import FileAttachments from "@/components/FileAttachments";
import { translateText } from "@/src/hooks/useAutoTranslate";
import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

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
  const { sendNotification } = useNotifications();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", status: "todo", priority: "medium", assigned_to: [] as string[], due_date: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [planUsers, setPlanUsers] = useState<any[]>([]);
  const [projectUsers, setProjectUsers] = useState<any[]>([]);

  const perms = usePermissions();
  const canEdit = perms.canEditTask;
  const canDelete = perms.canDeleteTask;
  const canChangeStatus = perms.canChangeTaskStatus;
  const canComment = perms.canAddTaskComments;

  // Translation state (detail view)
  const [translating, setTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedDesc, setTranslatedDesc] = useState("");
  const [translateDir, setTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");

  // Translation state (comments)
  const [commentTranslations, setCommentTranslations] = useState<Record<string, string>>({});
  const [commentTranslatingId, setCommentTranslatingId] = useState<string | null>(null);
  const [commentTranslateDir, setCommentTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");

  // Pin link state
  const [linkedPin, setLinkedPin] = useState<any>(null);
  const [linkedPlan, setLinkedPlan] = useState<any>(null);

  // Translation state (edit modal)
  const [editTranslating, setEditTranslating] = useState(false);
  const [editTranslatedTitle, setEditTranslatedTitle] = useState("");
  const [editTranslatedDesc, setEditTranslatedDesc] = useState("");
  const [editTranslateDir, setEditTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");

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

  const openEditModal = async () => {
    if (!task) return;
    // Pobierz aktualnych przypisanych z task_assignees
    let existingAssignees: string[] = [];
    const { data: assignees } = await (supabaseAdmin.from("task_assignees") as any)
      .select("user_id").eq("task_id", id);
    if (assignees && assignees.length > 0) {
      existingAssignees = assignees.map((a: any) => a.user_id);
    } else if ((task as any).assigned_to) {
      existingAssignees = [(task as any).assigned_to];
    }
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "todo",
      priority: task.priority || "medium",
      assigned_to: existingAssignees,
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
      const primaryAssigned = editForm.assigned_to.length > 0 ? editForm.assigned_to[0] : null;
      const updateData: any = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        status: editForm.status,
        priority: editForm.priority,
        assigned_to: primaryAssigned,
        due_date: editForm.due_date || null,
        edited_by: profile?.id || null,
        edited_at: new Date().toISOString(),
      };
      // Jeśli zmieniono przypisanie — zapisz kto i kiedy przydzielił
      const prevAssigned = (task as any)?.assigned_to || null;
      if (primaryAssigned && primaryAssigned !== prevAssigned) {
        updateData.assigned_by = profile?.id || null;
        updateData.assigned_at = new Date().toISOString();
      } else if (!primaryAssigned && prevAssigned) {
        updateData.assigned_by = null;
        updateData.assigned_at = null;
      }
      const { error } = await (supabase.from("tasks") as any)
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // Pobierz starych przypisanych przed synchronizacją
      const { data: oldAssignees } = await (supabaseAdmin.from("task_assignees") as any)
        .select("user_id").eq("task_id", id);
      const oldIds = new Set((oldAssignees || []).map((a: any) => a.user_id));

      // Synchronizuj task_assignees
      await (supabaseAdmin.from("task_assignees") as any).delete().eq("task_id", id);
      if (editForm.assigned_to.length > 0) {
        const rows = editForm.assigned_to.map((uid: string) => ({
          task_id: id,
          user_id: uid,
          assigned_by: profile?.id || null,
        }));
        await (supabaseAdmin.from("task_assignees") as any).insert(rows);
      }

      // Wyślij powiadomienia do nowo przypisanych pracowników
      const projName = (task as any)?.projects?.name || "";
      for (const uid of editForm.assigned_to) {
        if (uid !== profile?.id && !oldIds.has(uid)) {
          const title = t("notifications.task_assigned_title", "Nowe zadanie");
          const body = `${editForm.title.trim()}${projName ? ` • ${projName}` : ""}`;
          sendNotification(uid, title, body, "task_assigned", { task_id: id, project_id: (task as any)?.project_id });
        }
      }

      setShowEditModal(false);
      fetchTaskDetails();
    } catch (error) {
      console.error("Error updating task:", error);
      Alert.alert(t("common.error"), t("tasks.update_error"));
    } finally {
      setEditSaving(false);
    }
  };

  const fetchLinkedPin = async (taskId: string) => {
    try {
      const { data: pin } = await (supabaseAdmin.from("plan_pins") as any)
        .select("*, plan:project_plans!plan_pins_plan_id_fkey(id, name, project_id)")
        .eq("task_id", taskId)
        .maybeSingle();
      if (pin) {
        setLinkedPin(pin);
        setLinkedPlan(pin.plan || null);
      }
    } catch (e) {
      console.error("Error fetching linked pin:", e);
    }
  };

  const fetchTaskDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, projects(name), assigned_user:profiles!assigned_to(full_name), assigned_by_user:profiles!assigned_by(full_name)")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Pobierz profil created_by i edited_by osobno (brak FK w bazie)
      let enriched: any = { ...(data as any) };
      if (data && (data as any).created_by) {
        const { data: cbUser } = await (supabaseAdmin.from("profiles") as any)
          .select("full_name").eq("id", (data as any).created_by).single();
        if (cbUser) enriched.created_by_user = cbUser;
      }
      if (data && (data as any).edited_by) {
        const { data: ebUser } = await (supabaseAdmin.from("profiles") as any)
          .select("full_name").eq("id", (data as any).edited_by).single();
        if (ebUser) enriched.edited_by_user = ebUser;
      }

      // Pobierz wszystkich przypisanych z task_assignees
      const { data: assignees } = await (supabaseAdmin.from("task_assignees") as any)
        .select("user_id").eq("task_id", id);
      if (assignees && assignees.length > 0) {
        const aIds = assignees.map((a: any) => a.user_id);
        const { data: aProfiles } = await (supabaseAdmin.from("profiles") as any)
          .select("id, full_name, email").in("id", aIds);
        enriched.all_assignees = (aProfiles || []).map((p: any) => p.full_name || p.email || "");
      } else if (enriched.assigned_user?.full_name) {
        enriched.all_assignees = [enriched.assigned_user.full_name];
      } else {
        enriched.all_assignees = [];
      }

      setTask(enriched);
      if ((data as any)?.project_id) {
        fetchUsersForProject((data as any).project_id);
      }
      // Fetch linked pin if task is from a plan pin
      if (id && (data as any)?.title?.startsWith("📌")) {
        fetchLinkedPin(id);
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
      todo: "#f59e0b",
      in_progress: "#3b82f6",
      completed: "#10b981",
      blocked: "#64748b",
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
        {(canEdit || canDelete) && (
          <View style={styles.headerActions}>
            {canEdit && (
              <TouchableOpacity
                onPress={openEditModal}
                style={styles.iconButton}
              >
                <Ionicons name="create-outline" size={22} color="#2563eb" />
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity onPress={deleteTask} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            )}
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
          {canChangeStatus && task.status !== "completed" && (
            <View style={styles.quickActions}>
              <Text style={styles.quickActionsLabel}>{t("tasks.change_status")}:</Text>
              <View style={styles.statusButtons}>
                {(task.status === "todo") && (
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
                {(task.status === "todo" || task.status === "in_progress") && (
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

          {task.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("tasks.description")}</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>
          ) : null}

          {/* Show on plan button — for tasks linked to a pin */}
          {linkedPin && linkedPlan ? (
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#eff6ff",
                borderWidth: 2,
                borderColor: "#3b82f6",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 16,
              }}
              onPress={() => {
                if (task?.project_id) {
                  router.replace(`/projects/${task.project_id}?tab=plans&planId=${linkedPlan.id}&pinId=${linkedPin.id}` as any);
                }
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="map" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#1e40af" }}>
                  {t("plans.show_on_plan", "Auf Plan anzeigen")}
                </Text>
                <Text style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}>
                  📌 {linkedPlan.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
            </TouchableOpacity>
          ) : null}

          {/* Translation PL↔DE */}
          {(task.title || task.description) ? (
            <View style={{ marginBottom: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Ionicons name="language" size={18} color="#64748b" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>Übersetzen</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: translateDir === "pl|de" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => { setTranslateDir("pl|de"); setTranslatedTitle(""); setTranslatedDesc(""); }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: translateDir === "pl|de" ? "#fff" : "#64748b" }}>PL → DE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: translateDir === "de|pl" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => { setTranslateDir("de|pl"); setTranslatedTitle(""); setTranslatedDesc(""); }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: translateDir === "de|pl" ? "#fff" : "#64748b" }}>DE → PL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
                  onPress={async () => {
                    setTranslating(true);
                    setTranslatedTitle(""); setTranslatedDesc("");
                    try {
                      if (task.title?.trim()) {
                        const r = await translateText(task.title, translateDir);
                        setTranslatedTitle(r);
                      }
                      if (task.description?.trim()) {
                        const r = await translateText(task.description, translateDir);
                        setTranslatedDesc(r);
                      }
                    } catch (e) { console.error("Translation error:", e); }
                    finally { setTranslating(false); }
                  }}
                  disabled={translating}
                >
                  {translating ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Ionicons name="swap-horizontal" size={16} color="#2563eb" />
                  )}
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563eb" }}>Übersetzen</Text>
                </TouchableOpacity>
              </View>
              {(translatedTitle || translatedDesc) ? (
                <View style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
                  {translatedTitle ? (
                    <View style={{ marginBottom: translatedDesc ? 8 : 0 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                        {translateDir === "pl|de" ? "Titel (DE):" : "Tytuł (PL):"}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#166534" }}>{translatedTitle}</Text>
                    </View>
                  ) : null}
                  {translatedDesc ? (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                        {translateDir === "pl|de" ? "Beschreibung (DE):" : "Opis (PL):"}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#166534" }}>{translatedDesc}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.infoGrid}>
            {task.projects?.name ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="briefcase-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.project")}</Text>
                </View>
                <Text style={styles.infoValue}>{task.projects.name}</Text>
              </View>
            ) : null}

            {(task as any).all_assignees && (task as any).all_assignees.length > 0 ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="people-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.assigned_to")} ({(task as any).all_assignees.length})</Text>
                </View>
                <Text style={styles.infoValue}>{(task as any).all_assignees.join(", ")}</Text>
              </View>
            ) : task.assigned_user?.full_name ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.assigned_to")}</Text>
                </View>
                <Text style={styles.infoValue}>{task.assigned_user.full_name}</Text>
              </View>
            ) : null}

            {(task as any).assigned_by_user?.full_name ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="person-add-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>Zugewiesen von</Text>
                </View>
                <Text style={styles.infoValue}>
                  {(task as any).assigned_by_user.full_name}
                  {(task as any).assigned_at ? (
                    ` • ${new Date((task as any).assigned_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} ${new Date((task as any).assigned_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                  ) : ""}
                </Text>
              </View>
            ) : null}

            {task.due_date ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("tasks.due_date")}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {new Date(task.due_date).toLocaleDateString()}
                </Text>
              </View>
            ) : null}

            {(task as any).created_by_user?.full_name ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="create-outline" size={18} color="#2563eb" />
                  <Text style={styles.infoLabelText}>{t("tasks.created_by") || "Zlecone przez"}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {(task as any).created_by_user.full_name}
                  {task.created_at ? (
                    ` • ${new Date(task.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} ${new Date(task.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                  ) : ""}
                </Text>
              </View>
            ) : null}

            {(task as any).edited_by_user?.full_name ? (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="pencil-outline" size={18} color="#f59e0b" />
                  <Text style={styles.infoLabelText}>{t("tasks.edited_by") || "Edytowane przez"}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {(task as any).edited_by_user.full_name}
                  {(task as any).edited_at ? (
                    ` • ${new Date((task as any).edited_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} ${new Date((task as any).edited_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                  ) : ""}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Attachments Section */}
        <View style={styles.card}>
          <FileAttachments
            attachments={attachments}
            entityType="task"
            entityId={id || ""}
            canUpload={perms.canUploadFiles}
            canDelete={perms.canDeleteFiles}
            onRefresh={fetchAttachments}
          />
        </View>

        {/* Comments Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tasks.comments")}</Text>

          {comments.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name="language" size={16} color="#64748b" />
              <TouchableOpacity
                style={{ backgroundColor: commentTranslateDir === "pl|de" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                onPress={() => { setCommentTranslateDir("pl|de"); setCommentTranslations({}); }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: commentTranslateDir === "pl|de" ? "#fff" : "#64748b" }}>PL → DE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: commentTranslateDir === "de|pl" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                onPress={() => { setCommentTranslateDir("de|pl"); setCommentTranslations({}); }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: commentTranslateDir === "de|pl" ? "#fff" : "#64748b" }}>DE → PL</Text>
              </TouchableOpacity>
            </View>
          )}

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
                {commentTranslations[comment.id] ? (
                  <View style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: 8, marginTop: 6, borderWidth: 1, borderColor: "#bbf7d0" }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                      {commentTranslateDir === "pl|de" ? "DE:" : "PL:"}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#166534" }}>{commentTranslations[comment.id]}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start" }}
                  disabled={commentTranslatingId === comment.id}
                  onPress={async () => {
                    setCommentTranslatingId(comment.id);
                    try {
                      const result = await translateText(comment.comment, commentTranslateDir);
                      setCommentTranslations((prev) => ({ ...prev, [comment.id]: result }));
                    } catch (e) { console.error("Comment translation error:", e); }
                    finally { setCommentTranslatingId(null); }
                  }}
                >
                  {commentTranslatingId === comment.id ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Ionicons name="swap-horizontal" size={14} color="#2563eb" />
                  )}
                  <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "500" }}>
                    {commentTranslations[comment.id] ? "↻" : "Übersetzen"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {canComment && (
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
          )}
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
              {/* Auto-translate PL↔DE in edit modal */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Ionicons name="language" size={18} color="#64748b" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>Übersetzen</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: editTranslateDir === "pl|de" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                    onPress={() => { setEditTranslateDir("pl|de"); setEditTranslatedTitle(""); setEditTranslatedDesc(""); }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: editTranslateDir === "pl|de" ? "#fff" : "#64748b" }}>PL → DE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: editTranslateDir === "de|pl" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                    onPress={() => { setEditTranslateDir("de|pl"); setEditTranslatedTitle(""); setEditTranslatedDesc(""); }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: editTranslateDir === "de|pl" ? "#fff" : "#64748b" }}>DE → PL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                    onPress={async () => {
                      setEditTranslating(true);
                      setEditTranslatedTitle(""); setEditTranslatedDesc("");
                      try {
                        if (editForm.title.trim()) {
                          const r = await translateText(editForm.title, editTranslateDir);
                          setEditTranslatedTitle(r);
                        }
                        if (editForm.description.trim()) {
                          const r = await translateText(editForm.description, editTranslateDir);
                          setEditTranslatedDesc(r);
                        }
                      } catch (e) { console.error("Translation error:", e); }
                      finally { setEditTranslating(false); }
                    }}
                    disabled={editTranslating || (!editForm.title.trim() && !editForm.description.trim())}
                  >
                    {editTranslating ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Ionicons name="swap-horizontal" size={16} color="#2563eb" />
                    )}
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563eb" }}>Übersetzen</Text>
                  </TouchableOpacity>
                </View>
                {(editTranslatedTitle || editTranslatedDesc) ? (
                  <View style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
                    {editTranslatedTitle ? (
                      <View style={{ marginBottom: editTranslatedDesc ? 6 : 0 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                          {editTranslateDir === "pl|de" ? "Titel (DE):" : "Tytuł (PL):"}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#166534" }}>{editTranslatedTitle}</Text>
                      </View>
                    ) : null}
                    {editTranslatedDesc ? (
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                          {editTranslateDir === "pl|de" ? "Beschreibung (DE):" : "Opis (PL):"}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#166534" }}>{editTranslatedDesc}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#16a34a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => {
                        const newTitle = editTranslatedTitle ? `${editForm.title}\n${editTranslateDir === "pl|de" ? "[DE]" : "[PL]"} ${editTranslatedTitle}` : editForm.title;
                        const newDesc = editTranslatedDesc ? `${editForm.description}\n\n${editTranslateDir === "pl|de" ? "[DE]" : "[PL]"} ${editTranslatedDesc}` : editForm.description;
                        setEditForm({ ...editForm, title: newTitle, description: newDesc });
                        setEditTranslatedTitle(""); setEditTranslatedDesc("");
                      }}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>Übersetzung einfügen</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("tasks.statusLabel")}</Text>
                <View style={styles.editChips}>
                  {["todo", "in_progress", "completed", "blocked"].map((s) => (
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
                <Text style={styles.editLabel}>{t("tasks.assigned_to")} ({editForm.assigned_to.length})</Text>
                <TouchableOpacity
                  style={[styles.editChip, editForm.assigned_to.length === 0 && styles.editChipActive, { alignSelf: "flex-start", marginBottom: 8 }]}
                  onPress={() => setEditForm({ ...editForm, assigned_to: [] })}
                >
                  <Text style={[styles.editChipText, editForm.assigned_to.length === 0 && styles.editChipTextActive]}>— {t("common.none")}</Text>
                </TouchableOpacity>

                {planUsers.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#10b981", marginBottom: 4, textTransform: "uppercase" }}>
                      {t("plan.workers_from_plan")}
                    </Text>
                    {planUsers.map((u) => {
                      const sel = editForm.assigned_to.includes(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.editChip, sel && styles.editChipActive, { borderColor: "#10b981", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }]}
                          onPress={() => {
                            const next = sel ? editForm.assigned_to.filter((x: string) => x !== u.id) : [...editForm.assigned_to, u.id];
                            setEditForm({ ...editForm, assigned_to: next });
                          }}
                        >
                          <Ionicons name={sel ? "checkbox" : "square-outline"} size={18} color={sel ? "#2563eb" : "#94a3b8"} />
                          <Text style={[styles.editChipText, sel && styles.editChipTextActive]} numberOfLines={1}>
                            {u.full_name || u.email}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: 8 }} />
                  </>
                )}

                {projectUsers.length > 0 && (
                  <>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>
                      {t("tasks.project_members", "Członkowie projektu")}
                    </Text>
                    {projectUsers.map((u) => {
                      const sel = editForm.assigned_to.includes(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.editChip, sel && styles.editChipActive, { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }]}
                          onPress={() => {
                            const next = sel ? editForm.assigned_to.filter((x: string) => x !== u.id) : [...editForm.assigned_to, u.id];
                            setEditForm({ ...editForm, assigned_to: next });
                          }}
                        >
                          <Ionicons name={sel ? "checkbox" : "square-outline"} size={18} color={sel ? "#2563eb" : "#94a3b8"} />
                          <Text style={[styles.editChipText, sel && styles.editChipTextActive]} numberOfLines={1}>
                            {u.full_name || u.email}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {planUsers.length === 0 && projectUsers.length === 0 && (
                  <>
                    {users.map((u) => {
                      const sel = editForm.assigned_to.includes(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.editChip, sel && styles.editChipActive, { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }]}
                          onPress={() => {
                            const next = sel ? editForm.assigned_to.filter((x: string) => x !== u.id) : [...editForm.assigned_to, u.id];
                            setEditForm({ ...editForm, assigned_to: next });
                          }}
                        >
                          <Ionicons name={sel ? "checkbox" : "square-outline"} size={18} color={sel ? "#2563eb" : "#94a3b8"} />
                          <Text style={[styles.editChipText, sel && styles.editChipTextActive]} numberOfLines={1}>
                            {u.full_name || u.email}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
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
