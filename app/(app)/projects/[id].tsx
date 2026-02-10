import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  FlatList,
  TextInput,
  Linking,
} from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { usePermissions } from "@/src/hooks/usePermissions";
import { useTheme } from "@/src/providers/ThemeProvider";
import FileAttachments from "@/components/FileAttachments";
import KanbanBoard from "@/components/KanbanBoard";
import { exportToExcel, exportToPDF } from "@/src/utils/exportData";
import type { Database } from "@/src/lib/supabase/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type ProjectMember = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { full_name: string | null; email: string; role: string };
};
type HistoryEntry = {
  type: "created" | "member_added" | "member_removed" | "task_created" | "task_completed";
  date: string;
  description: string;
  icon: string;
  color: string;
  taskId?: string;
};

type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

export default function ProjectDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [pmName, setPmName] = useState<string>("");
  const [blName, setBlName] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "members" | "history">("tasks");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [planWorkers, setPlanWorkers] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", location: "", status: "planning", budget: "", start_date: "", end_date: "", project_manager_id: "", bauleiter_id: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showPMPicker, setShowPMPicker] = useState(false);
  const [showBLPicker, setShowBLPicker] = useState(false);

  const perms = usePermissions();
  const { colors: tc } = useTheme();
  const canEdit = perms.canEditProject;
  const canDelete = perms.canDeleteProject;
  const canManageMembers = perms.canManageMembers;
  const canUploadFiles = perms.canUploadFiles;
  const canCreateTask = perms.canCreateTask;
  const canDeleteTask = perms.canDeleteTask;

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      fetchPlanWorkers();
    }, [id])
  );

  const fetchAll = async () => {
    await Promise.all([
      fetchProjectDetails(),
      fetchProjectTasks(),
      fetchAttachments(),
      fetchMembers(),
    ]);
  };

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProject(data);

      // Pobierz nazwy PM i BL
      const proj: any = data;
      if (proj.project_manager_id) {
        const { data: pm } = await (supabaseAdmin.from("profiles") as any)
          .select("full_name, email")
          .eq("id", proj.project_manager_id)
          .single();
        setPmName(pm?.full_name || pm?.email || "");
      }
      if (proj.bauleiter_id) {
        const { data: bl } = await (supabaseAdmin.from("profiles") as any)
          .select("full_name, email")
          .eq("id", proj.bauleiter_id)
          .single();
        setBlName(bl?.full_name || bl?.email || "");
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Pobierz nazwy przypisanych osób
      const tasksWithNames = await Promise.all(
        (data || []).map(async (task: any) => {
          if (task.assigned_to) {
            const { data: assignee } = await (supabaseAdmin.from("profiles") as any)
              .select("full_name, email")
              .eq("id", task.assigned_to)
              .single();
            return { ...task, assignee_name: assignee?.full_name || assignee?.email || "" };
          }
          return { ...task, assignee_name: "" };
        })
      );
      setTasks(tasksWithNames);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchAttachments = async () => {
    try {
      const { data, error } = await (supabase
        .from("project_attachments") as any)
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await (supabaseAdmin.from("project_members") as any)
        .select("*")
        .eq("project_id", id)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      // Pobierz profile członków
      const membersWithProfiles = await Promise.all(
        (data || []).map(async (m: any) => {
          const { data: prof } = await (supabaseAdmin.from("profiles") as any)
            .select("full_name, email, role")
            .eq("id", m.user_id)
            .single();
          return { ...m, profile: prof };
        })
      );
      setMembers(membersWithProfiles);
      buildHistory(membersWithProfiles);

      // Auto-detekcja PM i BL z zespołu — jeśli nie ustawione w projekcie
      const proj: any = project;
      const updateData: any = {};
      if (!proj?.project_manager_id) {
        const pmMember = membersWithProfiles.find((m: any) => m.profile?.role === "project_manager");
        if (pmMember) updateData.project_manager_id = pmMember.user_id;
      }
      if (!proj?.bauleiter_id) {
        const blMember = membersWithProfiles.find((m: any) => m.profile?.role === "bauleiter");
        if (blMember) updateData.bauleiter_id = blMember.user_id;
      }
      if (Object.keys(updateData).length > 0) {
        await (supabaseAdmin.from("projects") as any).update(updateData).eq("id", id);
        fetchProjectDetails();
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const buildHistory = (membersData: ProjectMember[]) => {
    const entries: HistoryEntry[] = [];

    // Projekt utworzony
    if (project?.created_at) {
      entries.push({
        type: "created",
        date: project.created_at,
        description: t("projects.history.created"),
        icon: "add-circle",
        color: "#2563eb",
      });
    }

    // Członkowie dodani
    membersData.forEach((m) => {
      entries.push({
        type: "member_added",
        date: m.joined_at,
        description: `${m.profile?.full_name || m.profile?.email || "?"} — ${t("projects.history.member_added")}`,
        icon: "person-add",
        color: "#10b981",
      });
    });

    // Zadania utworzone / zakończone
    tasks.forEach((task) => {
      entries.push({
        type: "task_created",
        date: task.created_at,
        description: `${t("projects.history.task_created")}: ${task.title}`,
        icon: "clipboard",
        color: "#f59e0b",
        taskId: task.id,
      });
      if (task.completed_at) {
        entries.push({
          type: "task_completed",
          date: task.completed_at,
          description: `${t("projects.history.task_completed")}: ${task.title}`,
          icon: "checkmark-circle",
          color: "#10b981",
          taskId: task.id,
        });
      }
    });

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setHistory(entries);
  };

  // Odśwież historię gdy zmienią się tasks
  useEffect(() => {
    if (members.length > 0 || tasks.length > 0) {
      buildHistory(members);
    }
  }, [tasks, project]);

  const addMember = async (userId: string) => {
    try {
      const { error } = await (supabaseAdmin.from("project_members") as any)
        .insert({ project_id: id, user_id: userId, role: "member" });
      if (error) throw error;

      // Sprawdź rolę dodawanego użytkownika i automatycznie ustaw PM/BL w projekcie
      const { data: addedUser } = await (supabaseAdmin.from("profiles") as any)
        .select("id, role, full_name, email")
        .eq("id", userId)
        .single();

      if (addedUser) {
        const updateData: any = {};

        if (addedUser.role === "project_manager") {
          // Dodano PM → ustaw project_manager_id
          updateData.project_manager_id = userId;

          // Szukaj BL w aktualnych członkach zespołu i ustaw automatycznie
          const currentMembers = [...members, { user_id: userId, profile: addedUser }];
          const { data: memberProfiles } = await (supabaseAdmin.from("profiles") as any)
            .select("id, role")
            .in("id", currentMembers.map((m: any) => m.user_id));
          const blUser = (memberProfiles || []).find((p: any) => p.role === "bauleiter");
          if (blUser) {
            updateData.bauleiter_id = blUser.id;
          }
        }

        if (addedUser.role === "bauleiter") {
          // Dodano BL → ustaw bauleiter_id
          updateData.bauleiter_id = userId;

          // Jeśli PM jeszcze nie ustawiony, szukaj PM w zespole
          const proj: any = project;
          if (!proj?.project_manager_id) {
            const currentMembers = [...members, { user_id: userId, profile: addedUser }];
            const { data: memberProfiles } = await (supabaseAdmin.from("profiles") as any)
              .select("id, role")
              .in("id", currentMembers.map((m: any) => m.user_id));
            const pmUser = (memberProfiles || []).find((p: any) => p.role === "project_manager");
            if (pmUser) {
              updateData.project_manager_id = pmUser.id;
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          await (supabaseAdmin.from("projects") as any)
            .update(updateData)
            .eq("id", id);
        }
      }

      setShowAddMember(false);
      fetchAll();
    } catch (error: any) {
      console.error("Error adding member:", error);
      const msg = error.code === "23505" ? t("projects.member_already_exists") : t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(`${t("projects.remove_member_confirm")} ${memberName}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t("projects.remove_member_title"),
            `${t("projects.remove_member_confirm")} ${memberName}?`,
            [
              { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
              { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });
    if (!confirmed) return;

    try {
      const { error } = await (supabaseAdmin.from("project_members") as any)
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  // Pobierz pracowników przypisanych z planu dziennego do tego projektu
  const fetchPlanWorkers = async () => {
    try {
      // Znajdź plan_requests dla tego projektu
      const { data: reqs } = await (supabaseAdmin.from("plan_requests") as any)
        .select("id")
        .eq("project_id", id);
      if (!reqs || reqs.length === 0) { setPlanWorkers([]); return; }
      const reqIds = reqs.map((r: any) => r.id);
      // Pobierz przypisania
      const { data: asgn } = await (supabaseAdmin.from("plan_assignments") as any)
        .select("worker_id")
        .in("request_id", reqIds);
      if (!asgn || asgn.length === 0) { setPlanWorkers([]); return; }
      const workerIds = [...new Set(asgn.map((a: any) => a.worker_id))];
      // Pobierz profile
      const { data: profiles } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .in("id", workerIds)
        .order("full_name");
      setPlanWorkers(profiles || []);
    } catch (error) {
      console.error("Error fetching plan workers:", error);
    }
  };

  // Usuwanie zadania z poziomu projektu
  const deleteTaskFromProject = async (taskId: string, taskTitle: string) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(`${t("tasks.delete_confirm_message")}: ${taskTitle}`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t("tasks.delete_confirm_title"),
            `${t("tasks.delete_confirm_message")}\n${taskTitle}`,
            [
              { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
              { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });
    if (!confirmed) return;
    try {
      const { error } = await (supabaseAdmin.from("tasks") as any).delete().eq("id", taskId);
      if (error) throw error;
      fetchAll();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const openAddMemberModal = async () => {
    setUsersLoading(true);
    setShowAddMember(true);
    try {
      const { data, error } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id)
        .order("full_name");
      if (error) throw error;
      // Filtruj już dodanych
      const memberIds = members.map((m) => m.user_id);
      setAvailableUsers((data || []).filter((u: any) => !memberIds.includes(u.id)));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const openEditProject = async () => {
    if (!project) return;
    const proj: any = project;
    setEditForm({
      name: project.name || "",
      description: project.description || "",
      location: project.location || "",
      status: project.status || "planning",
      budget: project.budget ? String(project.budget) : "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      project_manager_id: proj.project_manager_id || "",
      bauleiter_id: proj.bauleiter_id || "",
    });
    // Fetch users for PM/BL pickers
    try {
      const { data } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id)
        .order("full_name");
      setAllUsers(data || []);
    } catch (e) { console.error(e); }
    setShowEditModal(true);
  };

  const saveEditProject = async () => {
    if (!editForm.name.trim()) {
      Alert.alert(t("common.error"), t("projects.name_required"));
      return;
    }
    setEditSaving(true);
    try {
      let blId = editForm.bauleiter_id || null;

      // Jeśli PM jest ustawiony a BL nie — szukaj BL automatycznie w zespole
      if (editForm.project_manager_id && !blId) {
        const memberIds = members.map((m: any) => m.user_id);
        if (memberIds.length > 0) {
          const { data: memberProfiles } = await (supabaseAdmin.from("profiles") as any)
            .select("id, role")
            .in("id", memberIds);
          const blUser = (memberProfiles || []).find((p: any) => p.role === "bauleiter");
          if (blUser) blId = blUser.id;
        }
      }

      const updateData: any = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        location: editForm.location.trim() || null,
        status: editForm.status,
        project_manager_id: editForm.project_manager_id || null,
        bauleiter_id: blId,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
      };
      if (editForm.budget) updateData.budget = parseFloat(editForm.budget);
      else updateData.budget = null;

      // Jeśli PM jest ustawiony, dodaj go do zespołu jeśli jeszcze nie jest
      if (editForm.project_manager_id) {
        const pmInTeam = members.some((m: any) => m.user_id === editForm.project_manager_id);
        if (!pmInTeam) {
          await (supabaseAdmin.from("project_members") as any)
            .upsert({ project_id: id, user_id: editForm.project_manager_id, role: "member" }, { onConflict: "project_id,user_id" });
        }
      }
      // Jeśli BL jest ustawiony, dodaj go do zespołu jeśli jeszcze nie jest
      if (blId) {
        const blInTeam = members.some((m: any) => m.user_id === blId);
        if (!blInTeam) {
          await (supabaseAdmin.from("project_members") as any)
            .upsert({ project_id: id, user_id: blId, role: "member" }, { onConflict: "project_id,user_id" });
        }
      }

      const { error } = await (supabaseAdmin.from("projects") as any)
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      setShowEditModal(false);
      fetchAll();
    } catch (error) {
      console.error("Error updating project:", error);
      Alert.alert(t("common.error"), t("projects.update_error"));
    } finally {
      setEditSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "#f59e0b",
      active: "#10b981",
      on_hold: "#ef4444",
      completed: "#6366f1",
      cancelled: "#64748b",
    };
    return colors[status] || "#94a3b8";
  };

  const getTaskStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "#f59e0b",
      in_progress: "#3b82f6",
      completed: "#10b981",
      cancelled: "#64748b",
    };
    return colors[status] || "#94a3b8";
  };

  const deleteProject = async () => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(t("projects.delete_confirm_message"))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t("projects.delete_confirm_title"),
            t("projects.delete_confirm_message"),
            [
              { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
              { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });
    if (!confirmed) return;

    try {
      const { error } = await (supabaseAdmin.from("projects") as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      router.back();
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.status === "completed").length;
    const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
    const pending = tasks.filter((t: any) => t.status === "todo").length;
    return { total, completed, inProgress, pending };
  };

  const taskStats = getTaskStats();

  const handleExportExcel = async () => {
    const data = tasks.map((t: any) => ({
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      Assigned: t.assignee_name || "-",
      DueDate: t.due_date ? new Date(t.due_date).toLocaleDateString() : "-",
      Created: new Date(t.created_at).toLocaleDateString(),
    }));
    const ok = await exportToExcel(data, `${project?.name || "tasks"}_export`, "Tasks");
    if (ok) {
      if (Platform.OS === "web") window.alert(t("export.success"));
      else Alert.alert(t("common.success"), t("export.success"));
    }
  };

  const handleExportPDF = async () => {
    const headers = [t("tasks.title"), "Status", t("tasks.priorityLabel"), t("tasks.assigned_to"), t("tasks.due_date")];
    const rows = tasks.map((t: any) => [
      t.title,
      t.status,
      t.priority,
      t.assignee_name || "-",
      t.due_date ? new Date(t.due_date).toLocaleDateString() : "-",
    ]);
    const ok = await exportToPDF(project?.name || "Tasks", headers, rows, `${project?.name || "tasks"}_report`);
    if (ok) {
      if (Platform.OS === "web") window.alert(t("export.success"));
      else Alert.alert(t("common.success"), t("export.success"));
    }
  };

  const handleKanbanStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await (supabase.from("tasks") as any)
        .update({ status: newStatus })
        .eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t("projects.not_found")}</Text>
      </View>
    );
  }

  const proj: any = project;

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: tc.headerBg, borderBottomColor: tc.border }]}>
        <TouchableOpacity onPress={() => router.replace("/projects" as any)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tc.text }]} numberOfLines={1}>{project.name}</Text>
        <View style={styles.headerActions}>
          {canEdit && (
            <TouchableOpacity
              onPress={openEditProject}
              style={styles.iconButton}
            >
              <Ionicons name="create-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity onPress={deleteProject} style={styles.iconButton}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Stałe info projektu */}
        <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={styles.projectHeader}>
            <View style={{ flex: 1 }}>
              {(proj as any).project_number && (
                <Text style={[styles.projectNumber, { color: tc.primary }]}>#{(proj as any).project_number}</Text>
              )}
              <Text style={[styles.projectName, { color: tc.text }]}>{project.name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(project.status)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                {t(`projects.status.${project.status}`)}
              </Text>
            </View>
          </View>

          {project.description && (
            <Text style={[styles.description, { color: tc.textSecondary }]}>{project.description}</Text>
          )}

          <View style={styles.infoGrid}>
            {project.location && (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => {
                  const address = encodeURIComponent(project.location!);
                  const url = Platform.OS === "ios"
                    ? `maps://app?daddr=${address}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${address}`;
                  Linking.openURL(url).catch(() => {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${address}`);
                  });
                }}
                activeOpacity={0.6}
              >
                <Ionicons name="location-outline" size={16} color="#2563eb" />
                <Text style={[styles.infoText, { color: "#2563eb", textDecorationLine: "underline" }]}>{project.location}</Text>
                <Ionicons name="navigate-outline" size={14} color="#2563eb" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
            {project.start_date && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
                <Text style={styles.infoText}>
                  {new Date(project.start_date).toLocaleDateString()}
                  {project.end_date ? ` — ${new Date(project.end_date).toLocaleDateString()}` : ""}
                </Text>
              </View>
            )}
            {project.budget && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={16} color="#64748b" />
                <Text style={styles.infoText}>{project.budget.toLocaleString()} €</Text>
              </View>
            )}
          </View>

          {/* PM & BL */}
          {(pmName || blName) && (
            <View style={styles.pmBlSection}>
              {pmName ? (
                <View style={styles.pmBlItem}>
                  <Ionicons name="person" size={16} color="#3b82f6" />
                  <Text style={styles.pmBlLabel}>PM:</Text>
                  <Text style={styles.pmBlValue}>{pmName}</Text>
                </View>
              ) : null}
              {blName ? (
                <View style={styles.pmBlItem}>
                  <Ionicons name="person" size={16} color="#10b981" />
                  <Text style={styles.pmBlLabel}>BL:</Text>
                  <Text style={styles.pmBlValue}>{blName}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Utworzono */}
          <View style={styles.createdAtRow}>
            <Ionicons name="time-outline" size={14} color="#94a3b8" />
            <Text style={styles.createdAtText}>
              {t("projects.history.created")}: {formatDateTime(project.created_at)}
            </Text>
          </View>
        </View>

        {/* Task Stats by Status */}
        {tasks.length > 0 && (() => {
          const maxVal = Math.max(taskStats.pending, taskStats.inProgress, taskStats.completed, 1);
          const barMaxH = 120;
          return (
            <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border, marginTop: 12 }]}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: tc.textSecondary, marginBottom: 12 }}>
                {t("dashboard.charts.tasks_by_status") || "Zadania wg statusu"}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: barMaxH + 40 }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#f59e0b", marginBottom: 4 }}>{taskStats.pending}</Text>
                  <View style={{ width: 32, height: Math.max((taskStats.pending / maxVal) * barMaxH, 6), backgroundColor: "#f59e0b", borderRadius: 6 }} />
                  <Text style={{ fontSize: 11, color: tc.textSecondary, marginTop: 6, textAlign: "center" }}>{t("tasks.status.todo") || "Do zrobienia"}</Text>
                </View>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#3b82f6", marginBottom: 4 }}>{taskStats.inProgress}</Text>
                  <View style={{ width: 32, height: Math.max((taskStats.inProgress / maxVal) * barMaxH, 6), backgroundColor: "#3b82f6", borderRadius: 6 }} />
                  <Text style={{ fontSize: 11, color: tc.textSecondary, marginTop: 6, textAlign: "center" }}>{t("tasks.status.in_progress")}</Text>
                </View>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#10b981", marginBottom: 4 }}>{taskStats.completed}</Text>
                  <View style={{ width: 32, height: Math.max((taskStats.completed / maxVal) * barMaxH, 6), backgroundColor: "#10b981", borderRadius: 6 }} />
                  <Text style={{ fontSize: 11, color: tc.textSecondary, marginTop: 6, textAlign: "center" }}>{t("tasks.status.completed")}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(["tasks", "members", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === "tasks" ? "clipboard-outline" : tab === "members" ? "people-outline" : "time-outline"}
                size={18}
                color={activeTab === tab ? "#2563eb" : "#64748b"}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "tasks" ? t("tasks.title") : tab === "members" ? t("team.title") : t("projects.history.title")}
                {tab === "tasks" ? ` (${tasks.length})` : tab === "members" ? ` (${members.length})` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab: Zadania */}
        {activeTab === "tasks" && (
          <View style={styles.card}>
            {/* View mode toggle + Export buttons */}
            <View style={styles.taskToolbar}>
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode("list")}
                >
                  <Ionicons name="list" size={16} color={viewMode === "list" ? "#2563eb" : "#94a3b8"} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === "kanban" && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode("kanban")}
                >
                  <Ionicons name="grid" size={16} color={viewMode === "kanban" ? "#2563eb" : "#94a3b8"} />
                </TouchableOpacity>
              </View>
              {tasks.length > 0 && perms.canImportData && (
                <View style={styles.exportButtons}>
                  <TouchableOpacity style={styles.exportBtn} onPress={handleExportExcel}>
                    <Ionicons name="document-text-outline" size={16} color="#10b981" />
                    <Text style={styles.exportBtnText}>Excel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
                    <Ionicons name="print-outline" size={16} color="#ef4444" />
                    <Text style={styles.exportBtnTextPdf}>PDF</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Kanban View */}
            {viewMode === "kanban" && tasks.length > 0 ? (
              <KanbanBoard
                tasks={tasks.map((t: any) => ({
                  ...t,
                  assigned_user: t.assignee_name ? { full_name: t.assignee_name } : null,
                }))}
                onStatusChange={canEdit ? handleKanbanStatusChange : undefined}
              />
            ) : tasks.length === 0 ? (
              <Text style={styles.emptyText}>{t("tasks.empty_project")}</Text>
            ) : (
              tasks.map((task: any, index: number) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskItem, index === tasks.length - 1 && styles.taskItemLast]}
                  onPress={() => router.push(`/tasks/${task.id}` as any)}
                >
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                    <View style={[styles.taskStatusBadge, { backgroundColor: `${getTaskStatusColor(task.status)}20` }]}>
                      <Text style={[styles.taskStatusText, { color: getTaskStatusColor(task.status) }]}>
                        {t(`tasks.status.${task.status}`)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.taskMeta}>
                    {task.assignee_name ? (
                      <View style={styles.taskMetaItem}>
                        <Ionicons name="person-outline" size={13} color="#64748b" />
                        <Text style={styles.taskMetaText}>{task.assignee_name}</Text>
                      </View>
                    ) : null}
                    <View style={styles.taskMetaItem}>
                      <Ionicons name="time-outline" size={13} color="#64748b" />
                      <Text style={styles.taskMetaText}>{formatDateTime(task.created_at)}</Text>
                    </View>
                    {task.due_date && (
                      <View style={styles.taskMetaItem}>
                        <Ionicons name="calendar-outline" size={13} color="#64748b" />
                        <Text style={styles.taskMetaText}>{new Date(task.due_date).toLocaleDateString()}</Text>
                      </View>
                    )}
                  </View>
                  {canDeleteTask && (
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={(e) => { e.stopPropagation(); deleteTaskFromProject(task.id, task.title); }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))
            )}
            {canCreateTask && (
              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={() => router.push(`/tasks/new?project_id=${id}` as any)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                <Text style={styles.addTaskText}>{t("tasks.addTask")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tab: Członkowie */}
        {activeTab === "members" && (
          <View style={styles.card}>
            {/* Pracownicy z planu dziennego */}
            {planWorkers.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 8 }}>{t("plan.workers_from_plan") || "Pracownicy z planu dziennego"}</Text>
                {planWorkers.map((pw) => (
                  <TouchableOpacity
                    key={pw.id}
                    style={styles.memberItem}
                    onPress={() => router.push(`/tasks/new?project_id=${id}&assigned_to=${pw.id}` as any)}
                  >
                    <Ionicons name="person-circle" size={36} color="#f59e0b" />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{pw.full_name || pw.email}</Text>
                      <Text style={styles.memberRole}>{t(`common.roles.${pw.role || "worker"}`)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
                      <Text style={{ fontSize: 12, color: "#2563eb", fontWeight: "600" }}>{t("tasks.assign") || "Przypisz"}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 }} />
              </View>
            )}
            {members.length === 0 ? (
              <Text style={styles.emptyText}>{t("team.no_members")}</Text>
            ) : (
              members.map((m) => (
                <View key={m.id} style={styles.memberItem}>
                  <Ionicons name="person-circle" size={36} color="#3b82f6" />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.profile?.full_name || m.profile?.email || "?"}</Text>
                    <Text style={styles.memberRole}>{t(`common.roles.${m.profile?.role || "worker"}`)}</Text>
                    <Text style={styles.memberDate}>{t("projects.history.member_added")}: {formatDateTime(m.joined_at)}</Text>
                  </View>
                  {canManageMembers && (
                    <TouchableOpacity onPress={() => removeMember(m.id, m.profile?.full_name || m.profile?.email || "")}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
            {canManageMembers && (
              <TouchableOpacity style={styles.addTaskButton} onPress={openAddMemberModal}>
                <Ionicons name="person-add-outline" size={20} color="#2563eb" />
                <Text style={styles.addTaskText}>{t("team.add_members")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tab: Historia */}
        {activeTab === "history" && (
          <View style={styles.card}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>{t("projects.history.empty")}</Text>
            ) : (
              history.map((entry, index) => {
                const Wrapper = entry.taskId ? TouchableOpacity : View;
                const wrapperProps = entry.taskId ? { onPress: () => router.push(`/tasks/${entry.taskId}` as any) } : {};
                return (
                  <Wrapper key={index} style={styles.historyItem} {...wrapperProps}>
                    <View style={[styles.historyIcon, { backgroundColor: `${entry.color}20` }]}>
                      <Ionicons name={entry.icon as any} size={16} color={entry.color} />
                    </View>
                    <View style={[styles.historyContent, { flex: 1 }]}>
                      <Text style={[styles.historyText, entry.taskId && { color: "#2563eb" }]}>{entry.description}</Text>
                      <Text style={styles.historyDate}>{formatDateTime(entry.date)}</Text>
                    </View>
                    {entry.taskId && <Ionicons name="chevron-forward" size={16} color="#94a3b8" />}
                  </Wrapper>
                );
              })
            )}
          </View>
        )}

        {/* Attachments */}
        <View style={styles.card}>
          <FileAttachments
            attachments={attachments}
            entityType="project"
            entityId={id || ""}
            canUpload={canUploadFiles}
            onRefresh={fetchAttachments}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal dodawania członka */}
      <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("team.add_members")}</Text>
              <TouchableOpacity onPress={() => setShowAddMember(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            {usersLoading ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
            ) : availableUsers.length === 0 ? (
              <Text style={styles.emptyText}>{t("team.no_available_users")}</Text>
            ) : (
              <FlatList
                data={availableUsers}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.userPickerItem} onPress={() => addMember(item.id)}>
                    <Ionicons name="person-circle-outline" size={28} color="#3b82f6" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.userPickerName}>{item.full_name || item.email}</Text>
                      <Text style={styles.userPickerEmail}>{item.email}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color="#10b981" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Project Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>{t("projects.edit")}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }}>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.name")} *</Text>
                <TextInput style={styles.editInput} value={editForm.name} onChangeText={(v) => setEditForm({ ...editForm, name: v })} placeholder={t("projects.name_placeholder")} placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.description")}</Text>
                <TextInput style={[styles.editInput, { minHeight: 80, textAlignVertical: "top" }]} value={editForm.description} onChangeText={(v) => setEditForm({ ...editForm, description: v })} multiline placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.location")}</Text>
                <TextInput style={styles.editInput} value={editForm.location} onChangeText={(v) => setEditForm({ ...editForm, location: v })} placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.statusLabel")}</Text>
                <View style={styles.editChips}>
                  {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
                    <TouchableOpacity key={s} style={[styles.editChip, editForm.status === s && styles.editChipActive]} onPress={() => setEditForm({ ...editForm, status: s })}>
                      <Text style={[styles.editChipText, editForm.status === s && styles.editChipTextActive]}>{t(`projects.status.${s}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.budget")} (EUR)</Text>
                <TextInput style={styles.editInput} value={editForm.budget} onChangeText={(v) => setEditForm({ ...editForm, budget: v })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.start_date")}</Text>
                <TextInput style={styles.editInput} value={editForm.start_date} onChangeText={(v) => setEditForm({ ...editForm, start_date: v })} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>{t("projects.end_date")}</Text>
                <TextInput style={styles.editInput} value={editForm.end_date} onChangeText={(v) => setEditForm({ ...editForm, end_date: v })} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
              </View>
              {/* PM */}
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Project Manager</Text>
                <TouchableOpacity style={styles.editPickerBtn} onPress={() => setShowPMPicker(!showPMPicker)}>
                  <Text style={styles.editPickerBtnText}>
                    {editForm.project_manager_id ? (allUsers.find((u) => u.id === editForm.project_manager_id)?.full_name || allUsers.find((u) => u.id === editForm.project_manager_id)?.email || "—") : "—"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
                {showPMPicker && (
                  <View style={styles.editPickerList}>
                    <TouchableOpacity style={styles.editPickerItem} onPress={() => { setEditForm({ ...editForm, project_manager_id: "" }); setShowPMPicker(false); }}>
                      <Text style={styles.editPickerItemText}>— {t("common.none")} —</Text>
                    </TouchableOpacity>
                    {allUsers.map((u) => (
                      <TouchableOpacity key={u.id} style={[styles.editPickerItem, editForm.project_manager_id === u.id && { backgroundColor: "#eff6ff" }]} onPress={() => { setEditForm({ ...editForm, project_manager_id: u.id }); setShowPMPicker(false); }}>
                        <Text style={styles.editPickerItemText}>{u.full_name || u.email}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {/* BL */}
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Bauleiter</Text>
                <TouchableOpacity style={styles.editPickerBtn} onPress={() => setShowBLPicker(!showBLPicker)}>
                  <Text style={styles.editPickerBtnText}>
                    {editForm.bauleiter_id ? (allUsers.find((u) => u.id === editForm.bauleiter_id)?.full_name || allUsers.find((u) => u.id === editForm.bauleiter_id)?.email || "—") : "—"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
                {showBLPicker && (
                  <View style={styles.editPickerList}>
                    <TouchableOpacity style={styles.editPickerItem} onPress={() => { setEditForm({ ...editForm, bauleiter_id: "" }); setShowBLPicker(false); }}>
                      <Text style={styles.editPickerItemText}>— {t("common.none")} —</Text>
                    </TouchableOpacity>
                    {allUsers.map((u) => (
                      <TouchableOpacity key={u.id} style={[styles.editPickerItem, editForm.bauleiter_id === u.id && { backgroundColor: "#eff6ff" }]} onPress={() => { setEditForm({ ...editForm, bauleiter_id: u.id }); setShowBLPicker(false); }}>
                        <Text style={styles.editPickerItemText}>{u.full_name || u.email}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.editSaveBtn, editSaving && { opacity: 0.6 }]} onPress={saveEditProject} disabled={editSaving}>
              <Text style={styles.editSaveBtnText}>{editSaving ? t("common.loading") : t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PM Picker - nested modal not needed, inline above */}
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
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  projectNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 4,
  },
  projectName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 12,
  },
  infoGrid: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  pmBlSection: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  pmBlItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pmBlLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  pmBlValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  createdAtRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  createdAtText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  tabActive: {
    backgroundColor: "#eff6ff",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 24,
  },
  taskItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  taskItemLast: {
    borderBottomWidth: 0,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1e293b",
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  taskStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  taskMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskMetaText: {
    fontSize: 12,
    color: "#64748b",
  },
  addTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 6,
  },
  addTaskText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  memberRole: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "500",
    marginTop: 2,
  },
  memberDate: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  historyContent: {
    flex: 1,
  },
  historyText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
  },
  historyDate: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
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
  userPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  userPickerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  userPickerEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  errorText: {
    fontSize: 16,
    color: "#64748b",
  },
  taskToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    overflow: "hidden",
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: "#dbeafe",
  },
  exportButtons: {
    flexDirection: "row",
    gap: 8,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },
  exportBtnTextPdf: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  editModalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "90%",
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  editField: {
    marginBottom: 14,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
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
  editPickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  editPickerBtnText: {
    fontSize: 15,
    color: "#1e293b",
  },
  editPickerList: {
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    maxHeight: 150,
  },
  editPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  editPickerItemText: {
    fontSize: 14,
    color: "#1e293b",
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
