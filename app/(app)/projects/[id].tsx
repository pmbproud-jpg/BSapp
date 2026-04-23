import FileAttachments from "@/components/FileAttachments";
import KanbanBoard from "@/components/KanbanBoard";
import { orderStatusColors } from "@/src/constants/colors";
import { usePermissions } from "@/src/hooks/usePermissions";
import { useProjectData } from "@/src/hooks/useProjectData";
import { useProjectEdit } from "@/src/hooks/useProjectEdit";
import { useProjectMembers } from "@/src/hooks/useProjectMembers";
import { useProjectOrders } from "@/src/hooks/useProjectOrders";
import { useProjectPlanWorkers } from "@/src/hooks/useProjectPlanWorkers";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { exportToExcel, exportToPDF } from "@/src/utils/exportData";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ProjectChecklist from "@/components/ProjectChecklist";
import ProjectDailyReports from "@/components/ProjectDailyReports";
import ProjectDeadlines from "@/components/ProjectDeadlines";
import ProjectObstructions from "@/components/ProjectObstructions";
import ProjectPlans from "../components/ProjectPlans";
import { styles } from "../_components/projectDetail/styles";
import { AddMemberModal } from "../_components/projectDetail/modals/AddMemberModal";
import { AddPlanWorkerModal } from "../_components/projectDetail/modals/AddPlanWorkerModal";
import { EditProjectModal } from "../_components/projectDetail/modals/EditProjectModal";
import { MaterialOrderModal } from "../_components/projectDetail/modals/MaterialOrderModal";
import { ToolOrderModal } from "../_components/projectDetail/modals/ToolOrderModal";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function ProjectDetailsScreen() {
  const { id, tab, planId, pinId } = useLocalSearchParams<{ id: string; tab?: string; planId?: string; pinId?: string }>();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: tc } = useTheme();
  const { sendNotification } = useNotifications();

  // ─── Hooks danych ───
  const projectData = useProjectData(id, profile?.id, t);
  const {
    project, setProject, tasks, setTasks, attachments, history, loading,
    pmName, blName,
    folders, openFolderId, setOpenFolderId, folderAttachments,
    showNewFolderInput, setShowNewFolderInput, newFolderName, setNewFolderName,
    fetchProjectDetails, fetchProjectTasks, fetchAttachments, fetchFolders,
    fetchFolderAttachments, createFolder, deleteFolder, buildHistory,
    handleKanbanStatusChange, deleteTaskFromProject, deleteProject,
  } = projectData;

  // Orders hook -- z destructure tylko to co widoczne w tym pliku;
  // modale (MaterialOrderModal/ToolOrderModal) dostaja caly ordersHook przez prop
  const ordersHook = useProjectOrders(id, profile?.id, t);
  const {
    projectOrders, projectToolOrders,
    setShowOrderModal, setShowToolOrderModal,
    setOrderMatSearch,
    fetchMaterialsAndOrders, fetchToolsAndOrders,
    orderSubTab, setOrderSubTab,
  } = ordersHook;

  // fetchAll needs to be defined before hooks that depend on it
  const fetchAll = async () => {
    await Promise.all([
      fetchProjectDetails(),
      fetchProjectTasks(),
      fetchAttachments(),
      fetchFolders(),
      memberHook.fetchMembers(),
      fetchMaterialsAndOrders(),
      fetchToolsAndOrders(),
      editHook.fetchAllUsers(),
    ]);
  };

  // Members hook -- z destructure tylko to co widoczne w tym pliku;
  // modale dostaja caly memberHook przez prop
  const memberHook = useProjectMembers(id, profile, project, t, sendNotification, fetchAll);
  const { members, removeMember, openAddMemberModal } = memberHook;

  // Edit hook -- modal dostaje caly editHook przez prop
  const editHook = useProjectEdit(id, profile, project, members, t, fetchAll);
  const { openEditProject } = editHook;

  // Plan workers hook -- modal dostaje caly planWorkersHook przez prop
  const planWorkersHook = useProjectPlanWorkers(id, profile);
  const {
    planWorkers,
    fetchPlanWorkers, openAddPlanWorkerModal,
  } = planWorkersHook;

  // ─── Local UI state ───
  const [activeTab, setActiveTab] = useState<"tasks" | "members" | "history" | "orders" | "plans" | "diary" | "checklist" | "obstructions" | "deadlines">(
    tab === "plans" ? "plans" : "tasks"
  );
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [taskSortBy, setTaskSortBy] = useState<"date" | "name" | "creator" | "assignee">("date");
  const [teamDate, setTeamDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const canEdit = perms.canEditProject;
  const canDelete = perms.canDeleteProject;
  const canManageMembers = perms.canManageMembers;
  const canUploadFiles = perms.canUploadFiles;
  const canCreateTask = perms.canCreateTask;
  const canDeleteTask = perms.canDeleteTask;

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      fetchPlanWorkers(teamDate);
      if (tab === "plans") {
        setActiveTab("plans");
      }
    }, [id, tab])
  );

  useEffect(() => {
    if (id) fetchPlanWorkers(teamDate);
  }, [teamDate]);


  // Odśwież historię gdy zmienią się tasks
  useEffect(() => {
    if (members.length > 0 || tasks.length > 0) {
      buildHistory(members, tasks, project);
    }
  }, [tasks, project]);

  const handleDeleteProject = async () => {
    const deleted = await deleteProject();
    if (deleted) router.back();
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
      todo: "#f59e0b",
      in_progress: "#3b82f6",
      completed: "#10b981",
      blocked: "#64748b",
    };
    return colors[status] || "#94a3b8";
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const pending = tasks.filter((t) => t.status === "todo").length;
    return { total, completed, inProgress, pending };
  };

  const taskStats = getTaskStats();

  const handleExportExcel = async () => {
    const data = tasks.map((t) => ({
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
    const rows = tasks.map((t) => [
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

  const proj = project;

  return (
    <View style={[styles.container, { backgroundColor: tc.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: tc.headerBg, borderBottomColor: tc.border }]}>
        <TouchableOpacity onPress={() => router.replace("/projects")} style={styles.backButton}>
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
            <TouchableOpacity onPress={handleDeleteProject} style={styles.iconButton}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {activeTab === "plans" && (
        <View style={{ flex: 1 }}>
          <ProjectPlans projectId={id || ""} workers={editHook.allUsers} onTaskCreated={fetchProjectTasks} onBack={() => setActiveTab("tasks")} initialPlanId={planId} initialPinId={pinId} />
        </View>
      )}
      <ScrollView style={[styles.content, activeTab === "plans" && { flex: 0, maxHeight: 0 }]}>
        {/* Stałe info projektu */}
        <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={styles.projectHeader}>
            <View style={{ flex: 1 }}>
              {proj.project_number ? (
                <Text style={[styles.projectNumber, { color: tc.primary }]}>#{proj.project_number}</Text>
              ) : null}
              <Text style={[styles.projectName, { color: tc.text }]}>{project.name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(project.status)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
                {t(`projects.status.${project.status}`)}
              </Text>
            </View>
          </View>

          {project.description ? (
            <Text style={[styles.description, { color: tc.textSecondary }]}>{project.description}</Text>
          ) : null}

          <View style={styles.infoGrid}>
            {project.location ? (
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
            ) : null}
            {project.start_date ? (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
                <Text style={styles.infoText}>
                  {new Date(project.start_date).toLocaleDateString()}
                  {project.end_date ? ` — ${new Date(project.end_date).toLocaleDateString()}` : ""}
                </Text>
              </View>
            ) : null}
            {project.budget ? (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={16} color="#64748b" />
                <Text style={styles.infoText}>{project.budget.toLocaleString()} €</Text>
              </View>
            ) : null}
          </View>

          {/* PM & BL */}
          {(pmName || blName) ? (
            <View style={styles.pmBlSection}>
              {pmName ? (
                <View style={styles.pmBlItem}>
                  <Ionicons name="person" size={16} color="#3b82f6" />
                  <Text style={styles.pmBlLabel}>{t("projects.pm_label")}:</Text>
                  <Text style={styles.pmBlValue}>{pmName}</Text>
                </View>
              ) : null}
              {blName ? (
                <View style={styles.pmBlItem}>
                  <Ionicons name="person" size={16} color="#10b981" />
                  <Text style={styles.pmBlLabel}>{t("projects.bl_label")}:</Text>
                  <Text style={styles.pmBlValue}>{blName}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

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
                {t("dashboard.charts.tasks_by_status", "Aufgaben nach Status")}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: barMaxH + 40 }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#f59e0b", marginBottom: 4 }}>{taskStats.pending}</Text>
                  <View style={{ width: 32, height: Math.max((taskStats.pending / maxVal) * barMaxH, 6), backgroundColor: "#f59e0b", borderRadius: 6 }} />
                  <Text style={{ fontSize: 11, color: tc.textSecondary, marginTop: 6, textAlign: "center" }}>{t("tasks.status.todo", "Zu erledigen")}</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBarContent}>
          {(["tasks", "members", "orders", "plans", "diary", "checklist", "obstructions", "deadlines", "history"] as const).map((tab) => {
            const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
              tasks: "clipboard-outline", members: "people-outline", orders: "cart-outline",
              plans: "map-outline", diary: "book-outline", checklist: "checkbox-outline",
              obstructions: "warning-outline", deadlines: "hourglass-outline", history: "time-outline",
            };
            const tabLabels: Record<string, string> = {
              tasks: t("tasks.title"), members: t("team.title"),
              orders: t("projects.orders_tab") || "Zamówienia", plans: t("plans.title") || "Plany",
              diary: t("dailyReport.title") || "Bautagebuch",
              checklist: t("checklist.title") || "Checkliste",
              obstructions: t("obstructions.tabTitle") || "Meldungen",
              deadlines: t("deadlines.tabTitle") || "Fristen",
              history: t("projects.history.title"),
            };
            const tabCounts: Record<string, string> = {
              tasks: ` (${tasks.length})`, members: ` (${members.length})`, orders: ` (${projectOrders.length})`,
            };
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons
                  name={tabIcons[tab]}
                  size={18}
                  color={activeTab === tab ? "#2563eb" : "#64748b"}
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]} numberOfLines={1}>
                  {tabLabels[tab]}{tabCounts[tab] || ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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

            {/* Sort buttons */}
            {tasks.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {([
                  { key: "date", icon: "time-outline", label: t("tasks.sort_date") || "Data" },
                  { key: "name", icon: "text-outline", label: t("tasks.sort_name") || "Nazwa" },
                  { key: "creator", icon: "create-outline", label: t("tasks.sort_creator") || "Zleceniodawca" },
                  { key: "assignee", icon: "person-outline", label: t("tasks.sort_assignee") || "Zleceniobiorca" },
                ] as { key: "date" | "name" | "creator" | "assignee"; icon: keyof typeof Ionicons.glyphMap; label: string }[]).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: taskSortBy === opt.key ? "#2563eb" : "#f1f5f9" }}
                    onPress={() => setTaskSortBy(opt.key)}
                  >
                    <Ionicons name={opt.icon} size={14} color={taskSortBy === opt.key ? "#fff" : "#64748b"} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: taskSortBy === opt.key ? "#fff" : "#64748b" }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Kanban View */}
            {(() => {
              const sorted = [...tasks].sort((a, b) => {
                if (taskSortBy === "name") return (a.title || "").localeCompare(b.title || "");
                if (taskSortBy === "creator") return (a.creator_name || "").localeCompare(b.creator_name || "");
                if (taskSortBy === "assignee") return (a.assignee_name || "").localeCompare(b.assignee_name || "");
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });

              if (viewMode === "kanban" && sorted.length > 0) {
                return (
                  <KanbanBoard
                    tasks={sorted.map((t) => ({
                      ...t,
                      assigned_user: t.assignee_name ? { full_name: t.assignee_name } : null,
                    }))}
                    onStatusChange={perms.canChangeTaskStatus ? handleKanbanStatusChange : undefined}
                  />
                );
              }
              if (sorted.length === 0) {
                return <Text style={styles.emptyText}>{t("tasks.empty_project")}</Text>;
              }
              return sorted.map((task, index) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskItem, index === sorted.length - 1 && styles.taskItemLast]}
                  onPress={() => router.push(`/tasks/${task.id}`)}
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
                    {task.creator_name ? (
                      <View style={styles.taskMetaItem}>
                        <Ionicons name="create-outline" size={13} color="#2563eb" />
                        <Text style={[styles.taskMetaText, { color: "#2563eb" }]}>{task.creator_name}</Text>
                      </View>
                    ) : null}
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
                    {task.due_date ? (
                      <View style={styles.taskMetaItem}>
                        <Ionicons name="calendar-outline" size={13} color="#64748b" />
                        <Text style={styles.taskMetaText}>{new Date(task.due_date).toLocaleDateString()}</Text>
                      </View>
                    ) : null}
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
              ));
            })()}
            {canCreateTask && (
              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={() => router.push(`/tasks/new?project_id=${id}`)}
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
            {/* Date navigation for plan workers */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12, gap: 12 }}>
              <TouchableOpacity
                onPress={() => { const d = new Date(teamDate); d.setDate(d.getDate() - 1); setTeamDate(d.toISOString().split("T")[0]); }}
                style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" }}
              >
                <Ionicons name="chevron-back" size={18} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTeamDate(new Date().toISOString().split("T")[0])}
                style={{ alignItems: "center", minWidth: 140 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e293b" }}>
                  {new Date(teamDate).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                </Text>
                {teamDate === new Date().toISOString().split("T")[0] && (
                  <Text style={{ fontSize: 10, color: "#2563eb", fontWeight: "600" }}>{t("common.today")}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { const d = new Date(teamDate); d.setDate(d.getDate() + 1); setTeamDate(d.toISOString().split("T")[0]); }}
                style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" }}
              >
                <Ionicons name="chevron-forward" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Plan workers for selected date */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {t("plan.workers_from_plan", "Mitarbeiter aus dem Tagesplan")} ({planWorkers.length})
              </Text>
              {planWorkers.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <Ionicons name="people-outline" size={32} color="#cbd5e1" />
                  <Text style={{ color: "#94a3b8", marginTop: 6, fontSize: 13 }}>{t("projects.no_workers_for_day")}</Text>
                </View>
              ) : (
                planWorkers.map((pw) => (
                  <TouchableOpacity
                    key={pw.id}
                    style={styles.memberItem}
                    onPress={() => router.push(`/tasks/new?project_id=${id}&assigned_to=${pw.id}`)}
                  >
                    <Ionicons name="person-circle" size={36} color="#f59e0b" />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{pw.full_name || pw.email}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <Text style={styles.memberRole}>{t(`common.roles.${pw.role || "worker"}`)}</Text>
                        {(pw.start_time || pw.end_time) ? (
                          <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "600" }}>
                            {pw.start_time || "?"} - {pw.end_time || "?"}
                          </Text>
                        ) : null}
                        {pw.departure_time ? (
                          <Text style={{ fontSize: 11, color: "#f59e0b", fontWeight: "600" }}>
                            <Ionicons name="time-outline" size={10} color="#f59e0b" /> {pw.departure_time}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
              {canManageMembers && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "flex-start", backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                  onPress={openAddPlanWorkerModal}
                >
                  <Ionicons name="person-add-outline" size={16} color="#2563eb" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563eb" }}>{t("projects.add_worker")}</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 }} />
            </View>

            {/* Permanent team members */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              {t("team.members", "Teammitglieder")} ({members.length})
            </Text>
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


        {/* Tab: Bautagebuch */}
        {activeTab === "diary" && (
          <View style={[styles.card, { minHeight: 200 }]}>
            <ProjectDailyReports projectId={id!} />
          </View>
        )}

        {/* Tab: Behinderungen & Bedenken */}
        {activeTab === "obstructions" && (
          <View style={[styles.card, { minHeight: 200 }]}>
            <ProjectObstructions projectId={id!} />
          </View>
        )}

        {/* Tab: Checkliste */}
        {activeTab === "checklist" && (
          <View style={[styles.card, { minHeight: 200 }]}>
            <ProjectChecklist projectId={id!} />
          </View>
        )}

        {/* Tab: Fristen */}
        {activeTab === "deadlines" && (
          <View style={[styles.card, { minHeight: 200 }]}>
            <ProjectDeadlines projectId={id!} />
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
                const wrapperProps = entry.taskId ? { onPress: () => router.push(`/tasks/${entry.taskId}`) } : {};
                return (
                  <Wrapper key={index} style={styles.historyItem} {...wrapperProps}>
                    <View style={[styles.historyIcon, { backgroundColor: `${entry.color}20` }]}>
                      <Ionicons name={entry.icon} size={16} color={entry.color} />
                    </View>
                    <View style={[styles.historyContent, { flex: 1 }]}>
                      <Text style={[styles.historyText, entry.taskId && { color: "#2563eb" }]}>{entry.description}</Text>
                      <Text style={styles.historyDate}>{formatDateTime(entry.date)}</Text>
                    </View>
                    {entry.taskId ? <Ionicons name="chevron-forward" size={16} color="#94a3b8" /> : null}
                  </Wrapper>
                );
              })
            )}
          </View>
        )}

        {/* Tab: Zamówienia (materiały + narzędzia) */}
        {activeTab === "orders" && (
          <View style={{ marginHorizontal: 16, marginTop: 8 }}>
            {/* Sub-tabs: Material / Werkzeuge */}
            <View style={{ flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", overflow: "hidden", marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6, backgroundColor: orderSubTab === "materials" ? "#2563eb" : "transparent" }}
                onPress={() => setOrderSubTab("materials")}
              >
                <Ionicons name="cube-outline" size={16} color={orderSubTab === "materials" ? "#fff" : tc.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: orderSubTab === "materials" ? "#fff" : tc.textSecondary }}>{t("projects.material")} ({projectOrders.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6, backgroundColor: orderSubTab === "tools" ? "#2563eb" : "transparent" }}
                onPress={() => setOrderSubTab("tools")}
              >
                <Ionicons name="construct-outline" size={16} color={orderSubTab === "tools" ? "#fff" : tc.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: orderSubTab === "tools" ? "#fff" : tc.textSecondary }}>{t("projects.tools")} ({projectToolOrders.length})</Text>
              </TouchableOpacity>
            </View>

            {/* === SUB-TAB: MATERIALS === */}
            {orderSubTab === "materials" && (<>
              {perms.canOrderMaterials && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: "flex-start", marginBottom: 12 }}
                  onPress={() => { setOrderMatSearch(""); setShowOrderModal(true); }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{t("projects.new_material_order")}</Text>
                </TouchableOpacity>
              )}

              {projectOrders.length === 0 ? (
                <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border, marginHorizontal: 0 }]}>
                  <View style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
                    <Text style={{ color: tc.textMuted, marginTop: 8, fontSize: 14 }}>{t("projects.no_material_orders")}</Text>
                  </View>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={{ flexDirection: "row", backgroundColor: "#1e40af", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                      {[
                        { label: "Material", w: 160 },
                        { label: "Art-Nr", w: 80 },
                        { label: "Menge", w: 60 },
                        { label: "Status", w: 90 },
                        { label: "Bestellt von", w: 120 },
                        { label: "Datum", w: 80 },
                        { label: "Uhrzeit", w: 60 },
                        { label: "Anmerkung", w: 130 },
                      ].map((col, i) => (
                        <Text key={i} style={{ width: col.w, color: "#fff", fontSize: 11, fontWeight: "700", paddingHorizontal: 6 }} numberOfLines={1}>{col.label}</Text>
                      ))}
                    </View>
                    {projectOrders.map((order, idx) => {
                      const sc = (order.status && orderStatusColors[order.status]) || "#94a3b8";
                      const dt = order.created_at ? new Date(order.created_at) : null;
                      return (
                        <View key={order.id} style={{ flexDirection: "row", backgroundColor: idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc"), borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", paddingVertical: 8, alignItems: "center" }}>
                          <Text style={{ width: 160, fontSize: 12, color: tc.text, fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>{order.material?.nazwa || "—"}</Text>
                          <Text style={{ width: 80, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{order.material?.art_nr || "—"}</Text>
                          <Text style={{ width: 60, fontSize: 12, color: "#2563eb", fontWeight: "700", paddingHorizontal: 6, textAlign: "center" }}>{order.ilosc ?? "—"}</Text>
                          <View style={{ width: 90, paddingHorizontal: 4 }}>
                            <View style={{ backgroundColor: `${sc}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: sc }}>{order.status}</Text>
                            </View>
                          </View>
                          <Text style={{ width: 120, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{order.ordered_by_profile?.full_name || "—"}</Text>
                          <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{dt ? dt.toLocaleDateString("de-DE") : "—"}</Text>
                          <Text style={{ width: 60, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{dt ? dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "—"}</Text>
                          <Text style={{ width: 130, fontSize: 11, color: tc.textMuted, paddingHorizontal: 6, fontStyle: "italic" }} numberOfLines={1}>{order.uwagi || "—"}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </>)}

            {/* === SUB-TAB: TOOLS === */}
            {orderSubTab === "tools" && (<>
              {perms.canOrderMaterials && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: "flex-start", marginBottom: 12 }}
                  onPress={() => { ordersHook.setToolOrderSearch(""); setShowToolOrderModal(true); }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{t("projects.new_tool_order")}</Text>
                </TouchableOpacity>
              )}

              {projectToolOrders.length === 0 ? (
                <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border, marginHorizontal: 0 }]}>
                  <View style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Ionicons name="construct-outline" size={40} color="#cbd5e1" />
                    <Text style={{ color: tc.textMuted, marginTop: 8, fontSize: 14 }}>{t("projects.no_tool_orders")}</Text>
                  </View>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={{ flexDirection: "row", backgroundColor: "#1e40af", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingVertical: 8 }}>
                      {[
                        { label: "Werkzeug", w: 180 },
                        { label: "Art-Nr", w: 80 },
                        { label: "Hersteller", w: 100 },
                        { label: "Menge", w: 60 },
                        { label: "Status", w: 90 },
                        { label: "Bestellt von", w: 120 },
                        { label: "Datum", w: 80 },
                        { label: "Uhrzeit", w: 60 },
                      ].map((col, i) => (
                        <Text key={i} style={{ width: col.w, color: "#fff", fontSize: 11, fontWeight: "700", paddingHorizontal: 6 }} numberOfLines={1}>{col.label}</Text>
                      ))}
                    </View>
                    {projectToolOrders.map((order, idx) => {
                      const sc = (order.status && orderStatusColors[order.status]) || "#94a3b8";
                      const dt = order.created_at ? new Date(order.created_at) : null;
                      return (
                        <View key={order.id} style={{ flexDirection: "row", backgroundColor: idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc"), borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", paddingVertical: 8, alignItems: "center" }}>
                          <Text style={{ width: 180, fontSize: 12, color: tc.text, fontWeight: "600", paddingHorizontal: 6 }} numberOfLines={1}>{order.tool?.beschreibung || "—"}</Text>
                          <Text style={{ width: 80, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{order.tool?.art_nr || "—"}</Text>
                          <Text style={{ width: 100, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{order.tool?.hersteller || "—"}</Text>
                          <Text style={{ width: 60, fontSize: 12, color: "#2563eb", fontWeight: "700", paddingHorizontal: 6, textAlign: "center" }}>{order.ilosc ?? "—"}</Text>
                          <View style={{ width: 90, paddingHorizontal: 4 }}>
                            <View style={{ backgroundColor: `${sc}20`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start" }}>
                              <Text style={{ fontSize: 10, fontWeight: "700", color: sc }}>{order.status}</Text>
                            </View>
                          </View>
                          <Text style={{ width: 120, fontSize: 12, color: tc.textSecondary, paddingHorizontal: 6 }} numberOfLines={1}>{order.ordered_by_profile?.full_name || "—"}</Text>
                          <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{dt ? dt.toLocaleDateString("de-DE") : "—"}</Text>
                          <Text style={{ width: 60, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 6 }}>{dt ? dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "—"}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </>)}
          </View>
        )}

        {/* Attachments with Folders */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="folder-outline" size={20} color="#1e293b" />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e293b" }}>{t("attachments.title")}</Text>
            </View>
            {canUploadFiles && (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                onPress={() => setShowNewFolderInput(true)}
              >
                <Ionicons name="folder-open-outline" size={16} color="#2563eb" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563eb" }}>{t("attachments.new_folder", "Nowy folder")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* New folder input */}
          {showNewFolderInput && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, backgroundColor: "#f8fafc", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#e2e8f0" }}>
              <Ionicons name="folder" size={20} color="#f59e0b" />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: "#1e293b", padding: 0 }}
                placeholder={t("attachments.folder_name_placeholder", "Nazwa folderu...")}
                placeholderTextColor="#94a3b8"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={createFolder}
              />
              <TouchableOpacity onPress={createFolder} style={{ padding: 4 }}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowNewFolderInput(false); setNewFolderName(""); }} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Folders list */}
          {folders.map((folder) => {
            const isOpen = openFolderId === folder.id;
            return (
              <View key={folder.id} style={{ marginBottom: 8, borderWidth: 1, borderColor: isOpen ? "#2563eb" : "#e2e8f0", borderRadius: 10, backgroundColor: isOpen ? "#f8fafc" : "#fff", overflow: "hidden" }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}
                  onPress={() => {
                    if (isOpen) {
                      setOpenFolderId(null);
                    } else {
                      setOpenFolderId(folder.id);
                      fetchFolderAttachments(folder.id);
                    }
                  }}
                >
                  <Ionicons name={isOpen ? "folder-open" : "folder"} size={22} color={isOpen ? "#2563eb" : "#f59e0b"} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#1e293b" }}>{folder.name}</Text>
                  <Text style={{ fontSize: 11, color: "#94a3b8" }}>
                    {folderAttachments[folder.id]?.length ?? "..."}
                  </Text>
                  {perms.canDeleteFiles && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); deleteFolder(folder.id, folder.name); }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
                </TouchableOpacity>

                {isOpen && (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                    <FileAttachments
                      attachments={folderAttachments[folder.id] || []}
                      entityType="project"
                      entityId={id || ""}
                      canUpload={canUploadFiles}
                      canDelete={perms.canDeleteFiles}
                      onRefresh={() => fetchFolderAttachments(folder.id)}
                      folderId={folder.id}
                    />
                  </View>
                )}
              </View>
            );
          })}

          {/* Loose attachments (outside folders) */}
          <View style={{ marginTop: folders.length > 0 ? 12 : 0 }}>
            {folders.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Ionicons name="document-attach-outline" size={16} color="#64748b" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>{t("attachments.loose_files", "Pliki bez folderu")}</Text>
              </View>
            )}
            <FileAttachments
              attachments={attachments}
              entityType="project"
              entityId={id || ""}
              canUpload={canUploadFiles}
              canDelete={perms.canDeleteFiles}
              onRefresh={fetchAttachments}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══ MODALS ═══ */}
      <AddPlanWorkerModal planWorkers={planWorkersHook} teamDate={teamDate} />
      <AddMemberModal members={memberHook} />
      <EditProjectModal edit={editHook} />
      <MaterialOrderModal orders={ordersHook} />
      <ToolOrderModal orders={ordersHook} />
    </View>
  );
}

