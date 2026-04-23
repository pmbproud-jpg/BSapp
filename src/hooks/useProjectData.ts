/**
 * Hook zarządzający danymi projektu: szczegóły, zadania, załączniki, foldery, historia.
 * Wydzielony z projects/[id].tsx.
 *
 * Faza 3: migracja na TanStack Query v5.
 * Sygnatura zewnetrzna zachowana -- caller (projects/[id].tsx) bez zmian.
 * Wewnatrz: 4x useQuery + useMutation; manualne refetch przez wrapper na .refetch().
 */

import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { Alert, Platform } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
type IoniconName = keyof typeof Ionicons.glyphMap;

type Project = Database["public"]["Tables"]["projects"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type AttachmentFolderRow = Database["public"]["Tables"]["attachment_folders"]["Row"];
type ProjectAttachmentRow = Database["public"]["Tables"]["project_attachments"]["Row"];
type TaskAssigneeRow = Database["public"]["Tables"]["task_assignees"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// Task + computed display fields (zbudowane w pamięci, nie w DB)
export type TaskWithNames = TaskRow & {
  assignee_name: string;
  assignee_names: string[];
  creator_name: string;
};

// Skrócony profil dla lookup po id → nazwa
type ProfileLite = Pick<ProfileRow, "id" | "full_name" | "email">;

// Wpis z joinem profile (dla project_members)
type MemberWithProfile = {
  joined_at: string;
  profile?: Pick<ProfileRow, "full_name" | "email"> | null;
};

type HistoryEntry = {
  type: "created" | "member_added" | "member_removed" | "task_created" | "task_completed";
  date: string;
  description: string;
  icon: IoniconName;
  color: string;
  taskId?: string;
};

// Centralne klucze cache -- spojny invalidate w mutation onSuccess
export const projectKeys = {
  all: (id: string) => ["project", id] as const,
  details: (id: string) => ["project", id, "details"] as const,
  tasks: (id: string) => ["project", id, "tasks"] as const,
  attachments: (id: string) => ["project", id, "attachments"] as const,
  folders: (id: string) => ["project", id, "folders"] as const,
  folderAttachments: (id: string, folderId: string) => ["project", id, "folder", folderId, "attachments"] as const,
};

// ── Pure fetchers ──
async function fetchProjectWithLeaders(projectId: string): Promise<{ project: Project; pmName: string; blName: string }> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  // Direct client + .single() narrowing quirk -- cast bezpieczny bo SELECT *
  const project = data as Project;
  let pmName = "";
  let blName = "";
  const leaderIds = [project.project_manager_id, project.bauleiter_id].filter((id): id is string => Boolean(id));
  if (leaderIds.length > 0) {
    const { data: leaders } = await supabaseAdmin.from("profiles")
      .select("id, full_name, email")
      .in("id", leaderIds);
    const map = new Map<string, string>(((leaders ?? []) as ProfileLite[]).map((l) => [l.id, l.full_name || l.email || ""]));
    if (project.project_manager_id) pmName = map.get(project.project_manager_id) || "";
    if (project.bauleiter_id) blName = map.get(project.bauleiter_id) || "";
  }
  return { project, pmName, blName };
}

async function fetchTasksWithNames(projectId: string): Promise<TaskWithNames[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as TaskRow[];
  const taskIds = rows.map((task) => task.id);

  const assigneesMap: Record<string, string[]> = {};
  if (taskIds.length > 0) {
    const { data: assignees } = await supabaseAdmin.from("task_assignees")
      .select("task_id, user_id")
      .in("task_id", taskIds);
    ((assignees ?? []) as Pick<TaskAssigneeRow, "task_id" | "user_id">[]).forEach((a) => {
      if (!assigneesMap[a.task_id]) assigneesMap[a.task_id] = [];
      assigneesMap[a.task_id].push(a.user_id);
    });
  }

  const allAssigneeIds = Object.values(assigneesMap).flat();
  const userIds = [
    ...new Set(
      rows
        .flatMap((task) => [task.assigned_to, task.created_by])
        .filter((id): id is string => Boolean(id))
        .concat(allAssigneeIds),
    ),
  ];
  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    ((profiles ?? []) as ProfileLite[]).forEach((p) => {
      profileMap[p.id] = p.full_name || p.email || "";
    });
  }

  return rows.map((task) => {
    const taskAssigneeIds = assigneesMap[task.id] ?? (task.assigned_to ? [task.assigned_to] : []);
    const assigneeNames = taskAssigneeIds.map((uid) => profileMap[uid] || "").filter(Boolean);
    return {
      ...task,
      assignee_name: assigneeNames.join(", "),
      assignee_names: assigneeNames,
      creator_name: task.created_by ? profileMap[task.created_by] || "" : "",
    };
  });
}

async function fetchLooseAttachments(projectId: string): Promise<ProjectAttachmentRow[]> {
  const { data, error } = await supabase
    .from("project_attachments")
    .select("*")
    .eq("project_id", projectId)
    .is("folder_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectAttachmentRow[];
}

async function fetchProjectFolders(projectId: string): Promise<AttachmentFolderRow[]> {
  const { data, error } = await supabaseAdmin.from("attachment_folders")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AttachmentFolderRow[];
}

export function useProjectData(projectId: string | undefined, profileId: string | undefined, t: TFunction) {
  const qc = useQueryClient();
  const enabled = !!projectId;
  const safeId = projectId ?? "";

  // ── Queries ──
  const projectQuery = useQuery({
    queryKey: projectKeys.details(safeId),
    queryFn: () => fetchProjectWithLeaders(safeId),
    enabled,
  });

  const tasksQuery = useQuery({
    queryKey: projectKeys.tasks(safeId),
    queryFn: () => fetchTasksWithNames(safeId),
    enabled,
  });

  const attachmentsQuery = useQuery({
    queryKey: projectKeys.attachments(safeId),
    queryFn: () => fetchLooseAttachments(safeId),
    enabled,
  });

  const foldersQuery = useQuery({
    queryKey: projectKeys.folders(safeId),
    queryFn: () => fetchProjectFolders(safeId),
    enabled,
  });

  // ── Local UI state (nie cache-able) ──
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderAttachments, setFolderAttachments] = useState<Record<string, ProjectAttachmentRow[]>>({});
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Lazy fetch zalacznikow w wybranym folderze (per-folder query). Trzymamy
  // wynik w lokalnym state bo to UI lazy-load -- nie warto plodzic dynamicznych
  // useQuery dla kazdego folderu.
  const fetchFolderAttachments = async (folderId: string) => {
    try {
      const data = await qc.fetchQuery({
        queryKey: projectKeys.folderAttachments(safeId, folderId),
        queryFn: async () => {
          const { data, error } = await supabaseAdmin.from("project_attachments")
            .select("*")
            .eq("project_id", safeId)
            .eq("folder_id", folderId)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as ProjectAttachmentRow[];
        },
      });
      setFolderAttachments((prev) => ({ ...prev, [folderId]: data }));
    } catch (error) {
      console.error("Error fetching folder attachments:", error);
    }
  };

  // ── Mutations ──
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabaseAdmin.from("attachment_folders").insert({
        project_id: safeId,
        name,
        created_by: profileId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewFolderName("");
      setShowNewFolderInput(false);
      qc.invalidateQueries({ queryKey: projectKeys.folders(safeId) });
    },
    onError: (e) => {
      console.error("Error creating folder:", e);
      Alert.alert(t("common.error"), "Fehler beim Erstellen des Ordners");
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabaseAdmin.from("attachment_folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      setOpenFolderId(null);
      qc.invalidateQueries({ queryKey: projectKeys.folders(safeId) });
    },
    onError: (e) => console.error("Error deleting folder:", e),
  });

  const kanbanStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskRow["status"] }) => {
      const { error } = await supabaseAdmin.from("tasks").update({ status }).eq("id", taskId);
      if (error) throw error;
    },
    // Optimistic update -- natychmiast zmieniamy status w cache, rollback na blad
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: projectKeys.tasks(safeId) });
      const previous = qc.getQueryData<TaskWithNames[]>(projectKeys.tasks(safeId));
      qc.setQueryData<TaskWithNames[]>(projectKeys.tasks(safeId), (old) =>
        (old ?? []).map((task) => (task.id === taskId ? { ...task, status } : task)),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      console.error("Error updating task status:", e);
      if (ctx?.previous) qc.setQueryData(projectKeys.tasks(safeId), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: projectKeys.tasks(safeId) });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Unlink plan pin (no ON DELETE CASCADE on plan_pins.task_id)
      await supabaseAdmin.from("plan_pins").update({ task_id: null }).eq("task_id", taskId);
      const { error } = await supabaseAdmin.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.tasks(safeId) });
      qc.invalidateQueries({ queryKey: projectKeys.attachments(safeId) });
    },
    onError: (e) => console.error("Error deleting task:", e),
  });

  // ── Action wrappers (zachowuja oryginalna sygnature API) ──

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate(newFolderName.trim());
  };

  const deleteFolder = async (folderId: string, folderName: string) => {
    const doDelete = () => deleteFolderMutation.mutate(folderId);
    if (Platform.OS === "web") {
      if (window.confirm(`${t("common.delete")} "${folderName}"? (${t("attachments.delete_message")})`)) doDelete();
    } else {
      Alert.alert(t("common.delete"), `"${folderName}"?`, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const buildHistory = (membersData: MemberWithProfile[], currentTasks: TaskWithNames[], currentProject: Project | null) => {
    const entries: HistoryEntry[] = [];
    if (currentProject?.created_at) {
      entries.push({
        type: "created",
        date: currentProject.created_at,
        description: t("projects.history.created"),
        icon: "add-circle",
        color: "#2563eb",
      });
    }
    membersData.forEach((m) => {
      entries.push({
        type: "member_added",
        date: m.joined_at,
        description: `${m.profile?.full_name || m.profile?.email || "?"} — ${t("projects.history.member_added")}`,
        icon: "person-add",
        color: "#10b981",
      });
    });
    currentTasks.forEach((task) => {
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

  const handleKanbanStatusChange = async (taskId: string, newStatus: string) => {
    kanbanStatusMutation.mutate({ taskId, status: newStatus as TaskRow["status"] });
  };

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
    deleteTaskMutation.mutate(taskId);
  };

  const deleteProject = async (): Promise<boolean> => {
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
    if (!confirmed) return false;
    try {
      const { error } = await supabaseAdmin.from("projects").delete().eq("id", safeId);
      if (error) throw error;
      // Po skutecznym delete czyscimy cache projektu
      qc.removeQueries({ queryKey: projectKeys.all(safeId) });
      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  };

  // Refetch wrappers -- API kompatybilne z wczesniejsza wersja hooka
  const fetchProjectDetails = async () => { await projectQuery.refetch(); };
  const fetchProjectTasks = async () => { await tasksQuery.refetch(); };
  const fetchAttachments = async () => { await attachmentsQuery.refetch(); };
  const fetchFolders = async () => { await foldersQuery.refetch(); };

  return {
    // ── Data ──
    project: projectQuery.data?.project ?? null,
    tasks: tasksQuery.data ?? [],
    attachments: attachmentsQuery.data ?? [],
    history,
    loading: projectQuery.isPending && enabled,
    pmName: projectQuery.data?.pmName ?? "",
    blName: projectQuery.data?.blName ?? "",

    // ── Folders ──
    folders: foldersQuery.data ?? [],
    openFolderId, setOpenFolderId,
    folderAttachments,
    showNewFolderInput, setShowNewFolderInput,
    newFolderName, setNewFolderName,

    // ── Actions ──
    fetchProjectDetails,
    fetchProjectTasks,
    fetchAttachments,
    fetchFolders,
    fetchFolderAttachments,
    createFolder,
    deleteFolder,
    buildHistory,
    handleKanbanStatusChange,
    deleteTaskFromProject,
    deleteProject,
  };
}
