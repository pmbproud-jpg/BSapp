/**
 * Hook zarządzający danymi dashboardu:
 * fetchStats, fetchTasksByProject, fetchPendingAbsences.
 * Wydzielony z dashboard.tsx.
 */
import { useState } from "react";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";

export type DashboardStats = {
  activeProjects: number;
  pendingTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  totalTasks: number;
  totalProjects: number;
};

export type TasksByProject = {
  project_number: string;
  project_name: string;
  project_id: string;
  pending: number;
  in_progress: number;
  completed: number;
};

export function useDashboardData(
  profileId: string | undefined,
  canViewOnlyAssigned: boolean,
) {
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    totalTasks: 0,
    totalProjects: 0,
  });
  const [tasksByProject, setTasksByProject] = useState<TasksByProject[]>([]);
  const [tbpSearch, setTbpSearch] = useState("");
  const [tbpSort, setTbpSort] = useState<"name" | "number">("name");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAbsencesCount, setPendingAbsencesCount] = useState(0);

  // Pobierz ID projektów do których user jest przypisany (dla PM/BL/Worker)
  const getMyProjectIds = async (): Promise<string[]> => {
    if (!profileId) return [];
    const { data } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", profileId);

    // Dodaj też projekty gdzie user jest PM lub BL
    const { data: pmProjects } = await supabase
      .from("projects")
      .select("id")
      .or(`project_manager_id.eq.${profileId},bauleiter_id.eq.${profileId}`);

    const memberIds = (data || []).map((m: any) => m.project_id);
    const pmIds = (pmProjects || []).map((p: any) => p.id);
    return [...new Set([...memberIds, ...pmIds])];
  };

  const fetchStats = async () => {
    let projectFilter: string[] | null = null;
    if (canViewOnlyAssigned) {
      projectFilter = await getMyProjectIds();
      if (projectFilter.length === 0) {
        setStats({ activeProjects: 0, pendingTasks: 0, inProgressTasks: 0, completedTasks: 0, totalTasks: 0, totalProjects: 0 });
        return;
      }
    }

    let activeQuery = supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .in("status", ["planning", "active"]);
    if (projectFilter) activeQuery = activeQuery.in("id", projectFilter);
    const { count: activeCount } = await activeQuery;

    let totalProjQuery = supabase
      .from("projects")
      .select("*", { count: "exact", head: true });
    if (projectFilter) totalProjQuery = totalProjQuery.in("id", projectFilter);
    const { count: totalProjectsCount } = await totalProjQuery;

    let pendingQuery = supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["todo", "in_progress"]);
    if (projectFilter) pendingQuery = pendingQuery.in("project_id", projectFilter);
    const { count: pendingCount } = await pendingQuery;

    let inProgressQuery = supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress");
    if (projectFilter) inProgressQuery = inProgressQuery.in("project_id", projectFilter);
    const { count: inProgressCount } = await inProgressQuery;

    let completedQuery = supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");
    if (projectFilter) completedQuery = completedQuery.in("project_id", projectFilter);
    const { count: completedCount } = await completedQuery;

    let totalTasksQuery = supabase
      .from("tasks")
      .select("*", { count: "exact", head: true });
    if (projectFilter) totalTasksQuery = totalTasksQuery.in("project_id", projectFilter);
    const { count: totalTasksCount } = await totalTasksQuery;

    setStats({
      activeProjects: activeCount || 0,
      pendingTasks: pendingCount || 0,
      inProgressTasks: inProgressCount || 0,
      completedTasks: completedCount || 0,
      totalTasks: totalTasksCount || 0,
      totalProjects: totalProjectsCount || 0,
    });
  };

  const fetchTasksByProject = async () => {
    try {
      let projectFilter: string[] | null = null;
      if (canViewOnlyAssigned) {
        projectFilter = await getMyProjectIds();
        if (projectFilter.length === 0) {
          setTasksByProject([]);
          return;
        }
      }

      let projectsQuery = supabase
        .from("projects")
        .select("id, name, project_number")
        .in("status", ["planning", "active"]);
      if (projectFilter) projectsQuery = projectsQuery.in("id", projectFilter);
      const { data: projects, error: projError } = await projectsQuery;

      if (projError) {
        console.error("Error fetching projects for chart:", projError);
        return;
      }

      if (!projects || projects.length === 0) {
        setTasksByProject([]);
        return;
      }

      const result = await Promise.all(
        projects.map(async (proj: any) => {
          const { count: pending } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", proj.id)
            .eq("status", "todo");
          const { count: inProgress } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", proj.id)
            .eq("status", "in_progress");
          const { count: completed } = await supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", proj.id)
            .eq("status", "completed");
          return {
            project_number: proj.project_number || proj.name || "?",
            project_name: proj.name || "?",
            project_id: proj.id,
            pending: (pending || 0),
            in_progress: inProgress || 0,
            completed: completed || 0,
          };
        })
      );
      setTasksByProject(result);
    } catch (error) {
      console.error("Error fetching tasks by project:", error);
    }
  };

  const fetchPendingAbsences = async () => {
    try {
      const { data } = await supabaseAdmin.from("user_absences")
        .select("id")
        .eq("status", "pending");
      setPendingAbsencesCount(data?.length || 0);
    } catch (e) {
      console.error("Error fetching pending absences:", e);
    }
  };

  const fetchAllData = async () => {
    if (!refreshing) setLoading(true);
    try {
      await Promise.allSettled([
        fetchStats(),
        fetchTasksByProject(),
        fetchPendingAbsences(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const completionRate = stats.totalTasks > 0
    ? (stats.completedTasks / stats.totalTasks) * 100
    : 0;

  return {
    stats, tasksByProject, tbpSearch, setTbpSearch,
    tbpSort, setTbpSort,
    loading, refreshing, pendingAbsencesCount,
    fetchAllData, onRefresh, completionRate,
  };
}
