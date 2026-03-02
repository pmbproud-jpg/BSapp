import FileAttachments from "@/components/FileAttachments";
import KanbanBoard from "@/components/KanbanBoard";
import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
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
    FlatList,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ProjectPlans from "../components/ProjectPlans";

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
  const { id, tab, planId, pinId } = useLocalSearchParams<{ id: string; tab?: string; planId?: string; pinId?: string }>();
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
  const [activeTab, setActiveTab] = useState<"tasks" | "members" | "history" | "orders" | "plans">(
    tab === "plans" ? "plans" : "tasks"
  );
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [taskSortBy, setTaskSortBy] = useState<"date" | "name" | "creator" | "assignee">("date");
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

  // Attachment folders
  const [folders, setFolders] = useState<any[]>([]);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderAttachments, setFolderAttachments] = useState<Record<string, any[]>>({});
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Team date navigation
  const [teamDate, setTeamDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Material orders
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [projectOrders, setProjectOrders] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ material_id: "", ilosc: "", uwagi: "" });
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderMatSearch, setOrderMatSearch] = useState("");
  // Multi-select cart: material_id -> quantity string
  const [orderCart, setOrderCart] = useState<Record<string, string>>({});

  // Manual plan worker addition
  const [showAddPlanWorker, setShowAddPlanWorker] = useState(false);
  const [planWorkerCandidates, setPlanWorkerCandidates] = useState<any[]>([]);
  const [planWorkerSearch, setPlanWorkerSearch] = useState("");
  const [addingPlanWorker, setAddingPlanWorker] = useState(false);

  // Tool orders
  const [orderSubTab, setOrderSubTab] = useState<"materials" | "tools">("materials");
  const [toolsList, setToolsList] = useState<any[]>([]);
  const [projectToolOrders, setProjectToolOrders] = useState<any[]>([]);
  const [showToolOrderModal, setShowToolOrderModal] = useState(false);
  const [toolOrderSaving, setToolOrderSaving] = useState(false);
  const [toolOrderSearch, setToolOrderSearch] = useState("");
  const [toolOrderCart, setToolOrderCart] = useState<Record<string, string>>({});

  const perms = usePermissions();
  const { colors: tc } = useTheme();
  const { sendNotification } = useNotifications();
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
      // Switch to plans tab when navigating from task with pin
      if (tab === "plans") {
        setActiveTab("plans");
      }
    }, [id, tab])
  );

  useEffect(() => {
    if (id) fetchPlanWorkers(teamDate);
  }, [teamDate]);

  const fetchAllUsers = async () => {
    try {
      let query = (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .order("full_name");
      if (profile?.company_id) {
        query = query.eq("company_id", profile.company_id);
      }
      const { data } = await query;
      setAllUsers(data || []);
    } catch (e) { console.error("Error fetching all users:", e); }
  };

  const fetchAll = async () => {
    await Promise.all([
      fetchProjectDetails(),
      fetchProjectTasks(),
      fetchAttachments(),
      fetchFolders(),
      fetchMembers(),
      fetchMaterialsAndOrders(),
      fetchToolsAndOrders(),
      fetchAllUsers(),
    ]);
  };

  const fetchMaterialsAndOrders = async () => {
    try {
      const { data: mats } = await (supabaseAdmin.from("warehouse_materials") as any).select("*").order("nazwa");
      setMaterialsList(mats || []);
      // Fetch orders with material join only (no FK-dependent profile join)
      const { data: ords, error: ordErr } = await (supabaseAdmin.from("project_material_orders") as any)
        .select("*, material:warehouse_materials(nazwa, art_nr, dlugosc, szerokosc, wysokosc, waga)")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      if (ordErr) { console.error("Orders fetch error:", ordErr); setProjectOrders([]); return; }
      // Separately fetch profile names for ordered_by users
      const userIds = [...new Set((ords || []).map((o: any) => o.ordered_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await (supabaseAdmin.from("profiles") as any)
          .select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name || ""; });
      }
      // Attach profile info to orders
      const enriched = (ords || []).map((o: any) => ({
        ...o,
        ordered_by_profile: { full_name: profileMap[o.ordered_by] || null },
      }));
      setProjectOrders(enriched);
    } catch (e) {
      console.error("Error fetching materials/orders:", e);
    }
  };

  const submitOrder = async () => {
    if (!orderForm.material_id || !orderForm.ilosc) return;
    setOrderSaving(true);
    try {
      const { error } = await (supabaseAdmin.from("project_material_orders") as any).insert({
        project_id: id,
        material_id: orderForm.material_id,
        ilosc: parseFloat(orderForm.ilosc),
        uwagi: orderForm.uwagi.trim() || null,
        ordered_by: profile?.id,
        status: "pending",
      });
      if (error) throw error;
      setShowOrderModal(false);
      setOrderForm({ material_id: "", ilosc: "", uwagi: "" });
      setOrderCart({});
      fetchMaterialsAndOrders();
      const msg = t("projects.order_created", "Bestellung erstellt");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error creating order:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setOrderSaving(false);
    }
  };

  const submitCartOrders = async () => {
    const entries = Object.entries(orderCart).filter(([_, qty]) => parseFloat(qty) > 0);
    if (entries.length === 0) {
      const msg = "Bitte mindestens ein Material mit Menge auswählen";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    setOrderSaving(true);
    try {
      const rows = entries.map(([matId, qty]) => ({
        project_id: id,
        material_id: matId,
        ilosc: parseFloat(qty),
        uwagi: null,
        ordered_by: profile?.id,
        status: "pending",
      }));
      const { error } = await (supabaseAdmin.from("project_material_orders") as any).insert(rows);
      if (error) throw error;
      setShowOrderModal(false);
      setOrderCart({});
      setOrderMatSearch("");
      fetchMaterialsAndOrders();
      const msg = `${entries.length} Bestellung(en) erstellt`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error creating orders:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setOrderSaving(false);
    }
  };

  const fetchToolsAndOrders = async () => {
    try {
      const { data: tools } = await (supabaseAdmin.from("warehouse_items") as any).select("*").order("beschreibung");
      setToolsList(tools || []);
      const { data: ords, error: ordErr } = await (supabaseAdmin.from("project_tool_orders") as any)
        .select("*, tool:warehouse_items(beschreibung, art_nr, hersteller, kategorie, serial_nummer)")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      if (ordErr) { console.error("Tool orders fetch error:", ordErr); setProjectToolOrders([]); return; }
      const userIds = [...new Set((ords || []).map((o: any) => o.ordered_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await (supabaseAdmin.from("profiles") as any)
          .select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name || ""; });
      }
      const enriched = (ords || []).map((o: any) => ({
        ...o,
        ordered_by_profile: { full_name: profileMap[o.ordered_by] || null },
      }));
      setProjectToolOrders(enriched);
    } catch (e) {
      console.error("Error fetching tools/orders:", e);
    }
  };

  const submitToolCartOrders = async () => {
    const entries = Object.entries(toolOrderCart).filter(([_, qty]) => parseFloat(qty) > 0);
    if (entries.length === 0) {
      const msg = "Bitte mindestens ein Werkzeug mit Menge auswählen";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    setToolOrderSaving(true);
    try {
      const rows = entries.map(([toolId, qty]) => ({
        project_id: id,
        tool_id: toolId,
        ilosc: parseFloat(qty),
        uwagi: null,
        ordered_by: profile?.id,
        status: "pending",
      }));
      const { error } = await (supabaseAdmin.from("project_tool_orders") as any).insert(rows);
      if (error) throw error;
      setShowToolOrderModal(false);
      setToolOrderCart({});
      setToolOrderSearch("");
      fetchToolsAndOrders();
      const msg = `${entries.length} Werkzeugbestellung(en) erstellt`;
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error creating tool orders:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setToolOrderSaving(false);
    }
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
        .eq("project_id", id)
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
        .eq("project_id", id)
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
        .eq("project_id", id)
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
        project_id: id,
        name: newFolderName.trim(),
        created_by: profile?.id || null,
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

      // Wyślij powiadomienie do dodanego użytkownika
      if (userId !== profile?.id) {
        const projName = project?.name || "";
        const title = t("notifications.project_member_title", "Nowy przydział do projektu");
        const body = `${t("notifications.project_member_body", "Zostałeś dodany do projektu")}: ${projName}`;
        sendNotification(userId, title, body, "project_member", { project_id: id, project_name: projName });
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

  // Pobierz pracowników przypisanych z planu dziennego do tego projektu dla danej daty
  const fetchPlanWorkers = async (dateStr: string) => {
    try {
      // Oblicz week_start (poniedziałek) i day_of_week dla danej daty
      const d = new Date(dateStr);
      const dayJs = d.getDay(); // 0=Sun, 1=Mon...
      const dayOfWeek = dayJs === 0 ? 7 : dayJs; // 1=Mon...7=Sun
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek - 1));
      const weekStart = monday.toISOString().split("T")[0];

      // Znajdź plan_requests dla tego projektu i tygodnia
      const { data: reqs } = await (supabaseAdmin.from("plan_requests") as any)
        .select("id")
        .eq("project_id", id)
        .eq("week_start", weekStart);
      if (!reqs || reqs.length === 0) { setPlanWorkers([]); return; }
      const reqIds = reqs.map((r: any) => r.id);
      // Pobierz przypisania dla konkretnego dnia tygodnia
      const { data: asgn } = await (supabaseAdmin.from("plan_assignments") as any)
        .select("worker_id, start_time, end_time, vehicle_id, departure_time")
        .in("request_id", reqIds)
        .eq("day_of_week", dayOfWeek);
      if (!asgn || asgn.length === 0) { setPlanWorkers([]); return; }
      const workerIds = [...new Set(asgn.map((a: any) => a.worker_id))];
      // Pobierz profile
      const { data: profiles } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .in("id", workerIds)
        .order("full_name");
      // Dołącz info o godzinach z przypisań
      const workersWithTime = (profiles || []).map((p: any) => {
        const assignment = asgn.find((a: any) => a.worker_id === p.id);
        return {
          ...p,
          start_time: assignment?.start_time?.slice(0, 5) || null,
          end_time: assignment?.end_time?.slice(0, 5) || null,
          departure_time: assignment?.departure_time?.slice(0, 5) || null,
        };
      });
      setPlanWorkers(workersWithTime);
    } catch (error) {
      console.error("Error fetching plan workers:", error);
    }
  };

  // Ręczne dodawanie pracownika do planu dziennego
  const openAddPlanWorkerModal = async () => {
    setPlanWorkerSearch("");
    setShowAddPlanWorker(true);
    try {
      const { data } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id)
        .order("full_name");
      // Filtruj już przypisanych w planie na ten dzień
      const existingIds = planWorkers.map((pw: any) => pw.id);
      setPlanWorkerCandidates((data || []).filter((u: any) => !existingIds.includes(u.id)));
    } catch (e) {
      console.error("Error fetching users for plan:", e);
    }
  };

  const addPlanWorkerManually = async (userId: string) => {
    setAddingPlanWorker(true);
    try {
      // Oblicz week_start i day_of_week
      const d = new Date(teamDate);
      const dayJs = d.getDay();
      const dayOfWeek = dayJs === 0 ? 7 : dayJs;
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek - 1));
      const weekStart = monday.toISOString().split("T")[0];

      // Znajdź lub utwórz plan_request dla tego projektu i tygodnia
      let { data: reqs } = await (supabaseAdmin.from("plan_requests") as any)
        .select("id")
        .eq("project_id", id)
        .eq("week_start", weekStart);

      let requestId: string;
      if (reqs && reqs.length > 0) {
        requestId = reqs[0].id;
      } else {
        // Utwórz nowy plan_request
        const { data: newReq, error: reqErr } = await (supabaseAdmin.from("plan_requests") as any)
          .insert({ project_id: id, week_start: weekStart, requested_by: profile?.id, status: "published" })
          .select("id")
          .single();
        if (reqErr) throw reqErr;
        requestId = newReq.id;
      }

      // Dodaj plan_assignment
      const { error: asgnErr } = await (supabaseAdmin.from("plan_assignments") as any)
        .insert({ request_id: requestId, worker_id: userId, day_of_week: dayOfWeek });
      if (asgnErr) throw asgnErr;

      setShowAddPlanWorker(false);
      fetchPlanWorkers(teamDate);
    } catch (e: any) {
      console.error("Error adding plan worker:", e);
      const msg = e?.code === "23505" ? "Mitarbeiter bereits zugewiesen" : "Fehler beim Hinzufügen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Fehler", msg);
    } finally {
      setAddingPlanWorker(false);
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
      if (editForm.budget) {
        const budgetNum = parseFloat(editForm.budget);
        updateData.budget = isNaN(budgetNum) ? null : budgetNum;
      } else {
        updateData.budget = null;
      }

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
      todo: "#f59e0b",
      in_progress: "#3b82f6",
      completed: "#10b981",
      blocked: "#64748b",
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

      {activeTab === "plans" && (
        <View style={{ flex: 1 }}>
          <ProjectPlans projectId={id || ""} workers={allUsers} onTaskCreated={fetchProjectTasks} onBack={() => setActiveTab("tasks")} initialPlanId={planId} initialPinId={pinId} />
        </View>
      )}
      <ScrollView style={[styles.content, activeTab === "plans" && { flex: 0, maxHeight: 0 }]}>
        {/* Stałe info projektu */}
        <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={styles.projectHeader}>
            <View style={{ flex: 1 }}>
              {(proj as any).project_number ? (
                <Text style={[styles.projectNumber, { color: tc.primary }]}>#{(proj as any).project_number}</Text>
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
          {(["tasks", "members", "orders", "plans", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === "tasks" ? "clipboard-outline" : tab === "members" ? "people-outline" : tab === "orders" ? "cart-outline" : tab === "plans" ? "map-outline" : "time-outline"}
                size={18}
                color={activeTab === tab ? "#2563eb" : "#64748b"}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]} numberOfLines={1}>
                {tab === "tasks" ? t("tasks.title") : tab === "members" ? t("team.title") : tab === "orders" ? (t("projects.orders_tab") || "Zamówienia") : tab === "plans" ? (t("plans.title") || "Plany") : t("projects.history.title")}
                {tab === "tasks" ? ` (${tasks.length})` : tab === "members" ? ` (${members.length})` : tab === "orders" ? ` (${projectOrders.length})` : tab === "plans" ? "" : ""}
              </Text>
            </TouchableOpacity>
          ))}
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
                ] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: taskSortBy === opt.key ? "#2563eb" : "#f1f5f9" }}
                    onPress={() => setTaskSortBy(opt.key)}
                  >
                    <Ionicons name={opt.icon as any} size={14} color={taskSortBy === opt.key ? "#fff" : "#64748b"} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: taskSortBy === opt.key ? "#fff" : "#64748b" }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Kanban View */}
            {(() => {
              const sorted = [...tasks].sort((a: any, b: any) => {
                if (taskSortBy === "name") return (a.title || "").localeCompare(b.title || "");
                if (taskSortBy === "creator") return (a.creator_name || "").localeCompare(b.creator_name || "");
                if (taskSortBy === "assignee") return (a.assignee_name || "").localeCompare(b.assignee_name || "");
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });

              if (viewMode === "kanban" && sorted.length > 0) {
                return (
                  <KanbanBoard
                    tasks={sorted.map((t: any) => ({
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
              return sorted.map((task: any, index: number) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskItem, index === sorted.length - 1 && styles.taskItemLast]}
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
                  <Text style={{ fontSize: 10, color: "#2563eb", fontWeight: "600" }}>Heute</Text>
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
                  <Text style={{ color: "#94a3b8", marginTop: 6, fontSize: 13 }}>Keine Mitarbeiter für diesen Tag</Text>
                </View>
              ) : (
                planWorkers.map((pw: any) => (
                  <TouchableOpacity
                    key={pw.id}
                    style={styles.memberItem}
                    onPress={() => router.push(`/tasks/new?project_id=${id}&assigned_to=${pw.id}` as any)}
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
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563eb" }}>Mitarbeiter hinzufügen</Text>
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
                <Text style={{ fontSize: 13, fontWeight: "600", color: orderSubTab === "materials" ? "#fff" : tc.textSecondary }}>Material ({projectOrders.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6, backgroundColor: orderSubTab === "tools" ? "#2563eb" : "transparent" }}
                onPress={() => setOrderSubTab("tools")}
              >
                <Ionicons name="construct-outline" size={16} color={orderSubTab === "tools" ? "#fff" : tc.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: orderSubTab === "tools" ? "#fff" : tc.textSecondary }}>Werkzeuge ({projectToolOrders.length})</Text>
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
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Neue Materialbestellung</Text>
                </TouchableOpacity>
              )}

              {projectOrders.length === 0 ? (
                <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border, marginHorizontal: 0 }]}>
                  <View style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
                    <Text style={{ color: tc.textMuted, marginTop: 8, fontSize: 14 }}>Keine Materialbestellungen</Text>
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
                    {projectOrders.map((order: any, idx: number) => {
                      const statusColors: Record<string, string> = { pending: "#f59e0b", ordered: "#3b82f6", approved: "#10b981", rejected: "#ef4444", delivered: "#10b981" };
                      const sc = statusColors[order.status] || "#94a3b8";
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
                  onPress={() => { setToolOrderSearch(""); setShowToolOrderModal(true); }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Neue Werkzeugbestellung</Text>
                </TouchableOpacity>
              )}

              {projectToolOrders.length === 0 ? (
                <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border, marginHorizontal: 0 }]}>
                  <View style={{ alignItems: "center", paddingVertical: 24 }}>
                    <Ionicons name="construct-outline" size={40} color="#cbd5e1" />
                    <Text style={{ color: tc.textMuted, marginTop: 8, fontSize: 14 }}>Keine Werkzeugbestellungen</Text>
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
                    {projectToolOrders.map((order: any, idx: number) => {
                      const statusColors: Record<string, string> = { pending: "#f59e0b", ordered: "#3b82f6", approved: "#10b981", rejected: "#ef4444", delivered: "#10b981" };
                      const sc = statusColors[order.status] || "#94a3b8";
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
          {folders.map((folder: any) => {
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

      {/* Modal ręcznego dodawania pracownika do planu dziennego */}
      <Modal visible={showAddPlanWorker} transparent animationType="slide" onRequestClose={() => setShowAddPlanWorker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Mitarbeiter zum Tagesplan hinzufügen</Text>
                <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {new Date(teamDate).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddPlanWorker(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, gap: 6 }}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: "#1e293b", padding: 0 }}
                placeholder="Name suchen..."
                placeholderTextColor="#94a3b8"
                value={planWorkerSearch}
                onChangeText={setPlanWorkerSearch}
              />
              {planWorkerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPlanWorkerSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
            {addingPlanWorker ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={planWorkerCandidates.filter((u: any) => {
                  if (!planWorkerSearch.trim()) return true;
                  const q = planWorkerSearch.toLowerCase();
                  return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                })}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 400 }}
                ListEmptyComponent={<Text style={styles.emptyText}>Keine verfügbaren Mitarbeiter</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.userPickerItem} onPress={() => addPlanWorkerManually(item.id)}>
                    <Ionicons name="person-circle-outline" size={28} color="#f59e0b" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.userPickerName}>{item.full_name || item.email}</Text>
                      <Text style={styles.userPickerEmail}>{item.role ? `${item.role}` : item.email}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color="#10b981" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

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

      {/* Material Order Modal — fullscreen, multi-select with qty column */}
      <Modal visible={showOrderModal} transparent={false} animationType="slide" onRequestClose={() => setShowOrderModal(false)}>
        <View style={{ flex: 1, backgroundColor: tc.background || "#f8fafc" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tc.card, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0" }}>
            <TouchableOpacity onPress={() => setShowOrderModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "700", color: tc.text, flex: 1, textAlign: "center" }}>Materialbestellung</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
                <View style={{ backgroundColor: "#2563eb", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{Object.values(orderCart).filter((q) => parseFloat(q) > 0).length}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: tc.card }}>
            <Ionicons name="search" size={18} color={tc.textSecondary} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: tc.text, padding: 0 }}
              placeholder="Name, Art-Nr oder Position suchen..."
              placeholderTextColor={tc.textSecondary}
              value={orderMatSearch}
              onChangeText={setOrderMatSearch}
            />
            {orderMatSearch.length > 0 && (
              <TouchableOpacity onPress={() => setOrderMatSearch("")}>
                <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Table */}
          <ScrollView style={{ flex: 1 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Table header */}
                <View style={{ flexDirection: "row", backgroundColor: "#1e293b", paddingVertical: 8 }}>
                  {[
                    { label: "Bestellen", w: 70 },
                    { label: "Pos.", w: 50 },
                    { label: "Art-Nr", w: 80 },
                    { label: "Name", w: 180 },
                    { label: "Lager", w: 60 },
                    { label: "Länge", w: 65 },
                    { label: "Breite", w: 65 },
                    { label: "Höhe", w: 65 },
                    { label: "Gewicht", w: 65 },
                  ].map((col, i) => (
                    <Text key={i} style={{ width: col.w, color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }} numberOfLines={1}>{col.label}</Text>
                  ))}
                </View>
                {/* Table rows */}
                {materialsList.filter((mat: any) => {
                  if (!orderMatSearch.trim()) return true;
                  const q = orderMatSearch.toLowerCase();
                  return (mat.nazwa || "").toLowerCase().includes(q) || (mat.art_nr || "").toLowerCase().includes(q) || (mat.pozycja || "").toLowerCase().includes(q);
                }).map((mat: any, idx: number) => {
                  const qty = orderCart[mat.id] || "";
                  const hasQty = parseFloat(qty) > 0;
                  return (
                    <View
                      key={mat.id}
                      style={{
                        flexDirection: "row", alignItems: "center",
                        backgroundColor: hasQty ? "#eff6ff" : (idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc")),
                        borderBottomWidth: 1, borderBottomColor: hasQty ? "#93c5fd" : (tc.border || "#e2e8f0"),
                        borderLeftWidth: hasQty ? 3 : 0, borderLeftColor: "#2563eb",
                        paddingVertical: 4,
                      }}
                    >
                      {/* Quantity input */}
                      <View style={{ width: 70, paddingHorizontal: 4, alignItems: "center" }}>
                        <TextInput
                          style={{
                            width: 56, height: 30, borderWidth: 1.5,
                            borderColor: hasQty ? "#2563eb" : (tc.border || "#d1d5db"),
                            borderRadius: 6, textAlign: "center", fontSize: 13, fontWeight: "700",
                            color: hasQty ? "#2563eb" : tc.text,
                            backgroundColor: hasQty ? "#dbeafe" : "#fff",
                            padding: 0,
                          }}
                          value={qty}
                          onChangeText={(v) => {
                            const cleaned = v.replace(/[^0-9.,]/g, "");
                            setOrderCart((prev) => {
                              const next = { ...prev };
                              if (!cleaned || cleaned === "0") delete next[mat.id];
                              else next[mat.id] = cleaned;
                              return next;
                            });
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#cbd5e1"
                        />
                      </View>
                      <Text style={{ width: 50, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.pozycja || "—"}</Text>
                      <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.art_nr || "—"}</Text>
                      <Text style={{ width: 180, fontSize: 11, color: tc.text, fontWeight: "600", paddingHorizontal: 4 }} numberOfLines={1}>{mat.nazwa || "—"}</Text>
                      <Text style={{ width: 60, fontSize: 11, color: "#dc2626", fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }}>{mat.ilosc ?? "—"}</Text>
                      <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.dlugosc || "—"}</Text>
                      <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.szerokosc || "—"}</Text>
                      <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.wysokosc || "—"}</Text>
                      <Text style={{ width: 65, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{mat.waga || "—"}</Text>
                    </View>
                  );
                })}
                {materialsList.length === 0 && (
                  <Text style={{ color: tc.textMuted, textAlign: "center", paddingVertical: 20 }}>Keine Materialien</Text>
                )}
              </View>
            </ScrollView>
          </ScrollView>

          {/* Bottom bar — cart summary + order button */}
          <View style={{ backgroundColor: tc.card, borderTopWidth: 1, borderTopColor: tc.border || "#e2e8f0", paddingHorizontal: 16, paddingVertical: 12 }}>
            {Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {Object.entries(orderCart).filter(([_, q]) => parseFloat(q) > 0).map(([matId, qty]) => {
                  const mat = materialsList.find((m: any) => m.id === matId);
                  return (
                    <View key={matId} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: "#1e40af", fontWeight: "600" }} numberOfLines={1}>{mat?.nazwa?.slice(0, 20) || "?"}</Text>
                      <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "700" }}>×{qty}</Text>
                      <TouchableOpacity onPress={() => setOrderCart((prev) => { const n = { ...prev }; delete n[matId]; return n; })}>
                        <Ionicons name="close-circle" size={14} color="#3b82f6" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={{
                backgroundColor: Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0 ? "#2563eb" : "#94a3b8",
                borderRadius: 10, paddingVertical: 14, alignItems: "center",
              }}
              onPress={submitCartOrders}
              disabled={Object.values(orderCart).filter((q) => parseFloat(q) > 0).length === 0 || orderSaving}
            >
              {orderSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                  {Object.values(orderCart).filter((q) => parseFloat(q) > 0).length > 0
                    ? `Bestellen (${Object.values(orderCart).filter((q) => parseFloat(q) > 0).length} Positionen)`
                    : "Menge eingeben zum Bestellen"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tool Order Modal — fullscreen, multi-select with qty column */}
      <Modal visible={showToolOrderModal} transparent={false} animationType="slide" onRequestClose={() => setShowToolOrderModal(false)}>
        <View style={{ flex: 1, backgroundColor: tc.background || "#f8fafc" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: tc.card, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0" }}>
            <TouchableOpacity onPress={() => setShowToolOrderModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={tc.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: "700", color: tc.text, flex: 1, textAlign: "center" }}>Werkzeugbestellung</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
                <View style={{ backgroundColor: "#2563eb", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 8, borderWidth: 1, borderColor: tc.border || "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: tc.card }}>
            <Ionicons name="search" size={18} color={tc.textSecondary} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: tc.text, padding: 0 }}
              placeholder="Beschreibung, Art-Nr oder Hersteller suchen..."
              placeholderTextColor={tc.textSecondary}
              value={toolOrderSearch}
              onChangeText={setToolOrderSearch}
            />
            {toolOrderSearch.length > 0 && (
              <TouchableOpacity onPress={() => setToolOrderSearch("")}>
                <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Table */}
          <ScrollView style={{ flex: 1 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Table header */}
                <View style={{ flexDirection: "row", backgroundColor: "#1e293b", paddingVertical: 8 }}>
                  {[
                    { label: "Bestellen", w: 70 },
                    { label: "Beschreibung", w: 200 },
                    { label: "Art-Nr", w: 80 },
                    { label: "Hersteller", w: 120 },
                    { label: "Kategorie", w: 100 },
                    { label: "S/N", w: 120 },
                    { label: "Lager", w: 60 },
                  ].map((col, i) => (
                    <Text key={i} style={{ width: col.w, color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }} numberOfLines={1}>{col.label}</Text>
                  ))}
                </View>
                {/* Table rows */}
                {toolsList.filter((tool: any) => {
                  if (!toolOrderSearch.trim()) return true;
                  const q = toolOrderSearch.toLowerCase();
                  return (tool.beschreibung || "").toLowerCase().includes(q) || (tool.art_nr || "").toLowerCase().includes(q) || (tool.hersteller || "").toLowerCase().includes(q) || (tool.kategorie || "").toLowerCase().includes(q);
                }).map((tool: any, idx: number) => {
                  const qty = toolOrderCart[tool.id] || "";
                  const hasQty = parseFloat(qty) > 0;
                  return (
                    <View
                      key={tool.id}
                      style={{
                        flexDirection: "row", alignItems: "center",
                        backgroundColor: hasQty ? "#eff6ff" : (idx % 2 === 0 ? tc.card : (tc.background || "#f8fafc")),
                        borderBottomWidth: 1, borderBottomColor: hasQty ? "#93c5fd" : (tc.border || "#e2e8f0"),
                        borderLeftWidth: hasQty ? 3 : 0, borderLeftColor: "#2563eb",
                        paddingVertical: 4,
                      }}
                    >
                      {/* Quantity input */}
                      <View style={{ width: 70, paddingHorizontal: 4, alignItems: "center" }}>
                        <TextInput
                          style={{
                            width: 56, height: 30, borderWidth: 1.5,
                            borderColor: hasQty ? "#2563eb" : (tc.border || "#d1d5db"),
                            borderRadius: 6, textAlign: "center", fontSize: 13, fontWeight: "700",
                            color: hasQty ? "#2563eb" : tc.text,
                            backgroundColor: hasQty ? "#dbeafe" : "#fff",
                            padding: 0,
                          }}
                          value={qty}
                          onChangeText={(v) => {
                            const cleaned = v.replace(/[^0-9.,]/g, "");
                            setToolOrderCart((prev) => {
                              const next = { ...prev };
                              if (!cleaned || cleaned === "0") delete next[tool.id];
                              else next[tool.id] = cleaned;
                              return next;
                            });
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#cbd5e1"
                        />
                      </View>
                      <Text style={{ width: 200, fontSize: 11, color: tc.text, fontWeight: "600", paddingHorizontal: 4 }} numberOfLines={1}>{tool.beschreibung || "—"}</Text>
                      <Text style={{ width: 80, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.art_nr || "—"}</Text>
                      <Text style={{ width: 120, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.hersteller || "—"}</Text>
                      <Text style={{ width: 100, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.kategorie || "—"}</Text>
                      <Text style={{ width: 120, fontSize: 11, color: tc.textSecondary, paddingHorizontal: 4 }} numberOfLines={1}>{tool.serial_nummer || "—"}</Text>
                      <Text style={{ width: 60, fontSize: 11, color: "#dc2626", fontWeight: "700", paddingHorizontal: 4, textAlign: "center" }}>{tool.menge ?? "—"}</Text>
                    </View>
                  );
                })}
                {toolsList.length === 0 && (
                  <Text style={{ color: tc.textMuted, textAlign: "center", paddingVertical: 20 }}>Keine Werkzeuge</Text>
                )}
              </View>
            </ScrollView>
          </ScrollView>

          {/* Bottom bar — cart summary + order button */}
          <View style={{ backgroundColor: tc.card, borderTopWidth: 1, borderTopColor: tc.border || "#e2e8f0", paddingHorizontal: 16, paddingVertical: 12 }}>
            {Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {Object.entries(toolOrderCart).filter(([_, q]) => parseFloat(q) > 0).map(([toolId, qty]) => {
                  const tool = toolsList.find((t: any) => t.id === toolId);
                  return (
                    <View key={toolId} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#dbeafe", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: "#1e40af", fontWeight: "600" }} numberOfLines={1}>{tool?.beschreibung?.slice(0, 20) || "?"}</Text>
                      <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "700" }}>x{qty}</Text>
                      <TouchableOpacity onPress={() => setToolOrderCart((prev) => { const n = { ...prev }; delete n[toolId]; return n; })}>
                        <Ionicons name="close-circle" size={14} color="#3b82f6" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={{
                backgroundColor: Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0 ? "#2563eb" : "#94a3b8",
                borderRadius: 10, paddingVertical: 14, alignItems: "center",
              }}
              onPress={submitToolCartOrders}
              disabled={Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length === 0 || toolOrderSaving}
            >
              {toolOrderSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                  {Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length > 0
                    ? `Bestellen (${Object.values(toolOrderCart).filter((q) => parseFloat(q) > 0).length} Positionen)`
                    : "Menge eingeben zum Bestellen"}
                </Text>
              )}
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
  tabBarScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  tabBarContent: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 5,
  },
  tabActive: {
    backgroundColor: "#eff6ff",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 13,
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
