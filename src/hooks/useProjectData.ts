/**
 * Hook zarządzający danymi projektu: szczegóły, zadania, załączniki, foldery, historia.
 * Wydzielony z projects/[id].tsx.
 */

import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useState } from "react";
import { Alert, Platform } from "react-native";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
};
type HistoryEntry = {
  type: "created" | "member_added" | "member_removed" | "task_created" | "task_completed";
  date: string;
  description: string;
  icon: string;
  color: string;
  taskId?: string;
};

export function useProjectData(projectId: string | undefined, profileId: string | undefined, t: any) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pmName, setPmName] = useState<string>("");
  const [blName, setBlName] = useState<string>("");

  // Attachment folders
  const [folders, setFolders] = useState<any[]>([]);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderAttachments, setFolderAttachments] = useState<Record<string, any[]>>({});
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
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
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const taskIds = (data || []).map((t: any) => t.id);

      // Pobierz task_assignees dla wszystkich zadań
      let assigneesMap: Record<string, string[]> = {};
      if (taskIds.length > 0) {
        const { data: assignees } = await (supabaseAdmin.from("task_assignees") as any)
          .select("task_id, user_id")
          .in("task_id", taskIds);
        (assignees || []).forEach((a: any) => {
          if (!assigneesMap[a.task_id]) assigneesMap[a.task_id] = [];
          assigneesMap[a.task_id].push(a.user_id);
        });
      }

      // Zbierz wszystkie user IDs (assigned_to, created_by, task_assignees)
      const allAssigneeIds = Object.values(assigneesMap).flat();
      const userIds = [
        ...new Set(
          (data || [])
            .flatMap((t: any) => [t.assigned_to, t.created_by])
            .filter(Boolean)
            .concat(allAssigneeIds)
        ),
      ];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await (supabaseAdmin.from("profiles") as any)
          .select("id, full_name, email")
          .in("id", userIds);
        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p.full_name || p.email || "";
        });
      }

      const tasksWithNames = (data || []).map((task: any) => {
        // Użyj task_assignees jeśli istnieją, w przeciwnym razie fallback na assigned_to
        const taskAssigneeIds = assigneesMap[task.id] || (task.assigned_to ? [task.assigned_to] : []);
        const assigneeNames = taskAssigneeIds.map((uid: string) => profileMap[uid] || "").filter(Boolean);
        return {
          ...task,
          assignee_name: assigneeNames.join(", "),
          assignee_names: assigneeNames,
          creator_name: task.created_by ? profileMap[task.created_by] || "" : "",
        };
      });
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
        .eq("project_id", projectId!)
        .is("folder_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const fetchFolders = async () => {
    try {
      const { data, error } = await (supabaseAdmin.from("attachment_folders") as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("name", { ascending: true });
      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
    }
  };

  const fetchFolderAttachments = async (folderId: string) => {
    try {
      const { data, error } = await (supabaseAdmin.from("project_attachments") as any)
        .select("*")
        .eq("project_id", projectId!)
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFolderAttachments((prev) => ({ ...prev, [folderId]: data || [] }));
    } catch (error) {
      console.error("Error fetching folder attachments:", error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const { error } = await (supabaseAdmin.from("attachment_folders") as any).insert({
        project_id: projectId!,
        name: newFolderName.trim(),
        created_by: profileId || null,
      });
      if (error) throw error;
      setNewFolderName("");
      setShowNewFolderInput(false);
      fetchFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
      Alert.alert(t("common.error"), "Fehler beim Erstellen des Ordners");
    }
  };

  const deleteFolder = async (folderId: string, folderName: string) => {
    const doDelete = async () => {
      try {
        const { error } = await (supabaseAdmin.from("attachment_folders") as any)
          .delete().eq("id", folderId);
        if (error) throw error;
        setOpenFolderId(null);
        fetchFolders();
      } catch (error) {
        console.error("Error deleting folder:", error);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`${t("common.delete")} "${folderName}"? (${t("attachments.delete_message")})`)) doDelete();
    } else {
      Alert.alert(t("common.delete"), `"${folderName}"?`, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const buildHistory = (membersData: any[], currentTasks: any[], currentProject: Project | null) => {
    const entries: HistoryEntry[] = [];

    // Projekt utworzony
    if (currentProject?.created_at) {
      entries.push({
        type: "created",
        date: currentProject.created_at,
        description: t("projects.history.created"),
        icon: "add-circle",
        color: "#2563eb",
      });
    }

    // Członkowie dodani
    membersData.forEach((m: any) => {
      entries.push({
        type: "member_added",
        date: m.joined_at,
        description: `${m.profile?.full_name || m.profile?.email || "?"} — ${t("projects.history.member_added")}`,
        icon: "person-add",
        color: "#10b981",
      });
    });

    // Zadania utworzone / zakończone
    currentTasks.forEach((task: any) => {
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
      // Refetch all po usunięciu
      await Promise.all([fetchProjectTasks(), fetchAttachments()]);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
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
    if (!confirmed) return false;

    try {
      const { error } = await (supabaseAdmin.from("projects") as any)
        .delete()
        .eq("id", projectId!);
      if (error) throw error;
      return true; // caller should router.back()
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  };

  return {
    project, setProject,
    tasks, setTasks,
    attachments,
    history,
    loading,
    pmName, blName,

    // Folders
    folders,
    openFolderId, setOpenFolderId,
    folderAttachments,
    showNewFolderInput, setShowNewFolderInput,
    newFolderName, setNewFolderName,

    // Actions
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
