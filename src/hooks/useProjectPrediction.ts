/**
 * Hook do predykcji opóźnień projektów.
 * Analizuje: task velocity, blocked ratio, deadline proximity,
 * completion trend, team size vs. workload.
 *
 * Algorytm działa 100% lokalnie — nie wymaga API AI.
 * To jest klucz do wniosku ZIM: mierzalny algorytm ML/predykcyjny.
 */
import { useState, useCallback } from "react";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database } from "@/src/lib/supabase/database.types";

type ProjectSlice = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "status" | "start_date" | "end_date"
>;
type TaskSlice = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "status" | "priority" | "created_at" | "completed_at"
>;

// ─── Types ───

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type PredictionFactor = {
  name: string;
  score: number; // 0-100 (100 = worst)
  weight: number;
  description: string;
};

export type ProjectPrediction = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  endDate: string | null;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  predictedDelay: number; // estimated days of delay
  factors: PredictionFactor[];
  recommendations: string[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    inProgressTasks: number;
    todoTasks: number;
    completionRate: number;
    avgTaskDuration: number; // days
    taskVelocity: number; // tasks/week
    daysRemaining: number;
    daysElapsed: number;
    tasksPerDay: number; // required rate to finish on time
    memberCount: number;
  };
};

// ─── Prediction Algorithm ───

function calculateRisk(stats: ProjectPrediction["stats"], endDate: string | null): {
  riskScore: number;
  riskLevel: RiskLevel;
  predictedDelay: number;
  factors: PredictionFactor[];
  recommendations: string[];
} {
  const factors: PredictionFactor[] = [];
  const recommendations: string[] = [];

  // Factor 1: Completion Rate vs Time Elapsed (weight: 30%)
  const timeProgress = stats.daysElapsed > 0 && stats.daysRemaining >= 0
    ? stats.daysElapsed / (stats.daysElapsed + stats.daysRemaining)
    : 0;
  const taskProgress = stats.completionRate / 100;
  const progressGap = Math.max(0, (timeProgress - taskProgress) * 100);

  factors.push({
    name: "progress_gap",
    score: Math.min(progressGap * 1.5, 100),
    weight: 30,
    description: `Time: ${Math.round(timeProgress * 100)}% | Tasks: ${Math.round(taskProgress * 100)}%`,
  });

  if (progressGap > 20) {
    recommendations.push("task_completion_behind_schedule");
  }

  // Factor 2: Blocked Tasks Ratio (weight: 25%)
  const blockedRatio = stats.totalTasks > 0
    ? (stats.blockedTasks / stats.totalTasks) * 100
    : 0;
  const blockedScore = Math.min(blockedRatio * 5, 100); // 20% blocked = 100 score

  factors.push({
    name: "blocked_ratio",
    score: blockedScore,
    weight: 25,
    description: `${stats.blockedTasks}/${stats.totalTasks} (${Math.round(blockedRatio)}%)`,
  });

  if (blockedRatio > 10) {
    recommendations.push("resolve_blocked_tasks");
  }

  // Factor 3: Task Velocity Trend (weight: 20%)
  const remainingTasks = stats.totalTasks - stats.completedTasks;
  const requiredVelocity = stats.daysRemaining > 0
    ? (remainingTasks / stats.daysRemaining) * 7 // tasks per week needed
    : remainingTasks > 0 ? 999 : 0;
  const velocityGap = stats.taskVelocity > 0
    ? Math.max(0, ((requiredVelocity - stats.taskVelocity) / requiredVelocity) * 100)
    : remainingTasks > 0 ? 100 : 0;

  factors.push({
    name: "velocity_gap",
    score: Math.min(velocityGap, 100),
    weight: 20,
    description: `Current: ${stats.taskVelocity.toFixed(1)}/week | Required: ${requiredVelocity.toFixed(1)}/week`,
  });

  if (velocityGap > 30) {
    recommendations.push("increase_velocity");
  }

  // Factor 4: Deadline Proximity (weight: 15%)
  let deadlineScore = 0;
  if (endDate) {
    if (stats.daysRemaining < 0) {
      deadlineScore = 100; // overdue
      recommendations.push("project_overdue");
    } else if (stats.daysRemaining < 7) {
      deadlineScore = 80;
      recommendations.push("deadline_imminent");
    } else if (stats.daysRemaining < 14) {
      deadlineScore = 50;
    } else if (stats.daysRemaining < 30) {
      deadlineScore = 25;
    }
  }

  factors.push({
    name: "deadline_proximity",
    score: deadlineScore,
    weight: 15,
    description: endDate
      ? stats.daysRemaining < 0
        ? `${Math.abs(stats.daysRemaining)} days overdue`
        : `${stats.daysRemaining} days remaining`
      : "No deadline set",
  });

  // Factor 5: Team Workload (weight: 10%)
  const tasksPerMember = stats.memberCount > 0
    ? remainingTasks / stats.memberCount
    : remainingTasks;
  const workloadScore = Math.min(tasksPerMember * 5, 100); // 20 tasks/member = 100

  factors.push({
    name: "team_workload",
    score: workloadScore,
    weight: 10,
    description: `${remainingTasks} tasks / ${stats.memberCount || 1} members = ${tasksPerMember.toFixed(1)} each`,
  });

  if (tasksPerMember > 15) {
    recommendations.push("add_team_members");
  }

  // Calculate weighted risk score
  const riskScore = Math.round(
    factors.reduce((sum, f) => sum + (f.score * f.weight) / 100, 0)
  );

  // Determine risk level
  let riskLevel: RiskLevel;
  if (riskScore >= 70) riskLevel = "critical";
  else if (riskScore >= 45) riskLevel = "high";
  else if (riskScore >= 25) riskLevel = "medium";
  else riskLevel = "low";

  // Estimate delay in days
  let predictedDelay = 0;
  if (stats.taskVelocity > 0 && remainingTasks > 0) {
    const weeksNeeded = remainingTasks / stats.taskVelocity;
    const daysNeeded = weeksNeeded * 7;
    predictedDelay = Math.max(0, Math.round(daysNeeded - stats.daysRemaining));
  } else if (stats.daysRemaining < 0) {
    predictedDelay = Math.abs(stats.daysRemaining);
  }

  if (recommendations.length === 0) {
    recommendations.push("on_track");
  }

  return { riskScore, riskLevel, predictedDelay, factors, recommendations };
}

// ─── Hook ───

export function useProjectPrediction() {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<ProjectPrediction[]>([]);

  const analyzeProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active projects
      const { data: projects } = await supabaseAdmin
        .from("projects")
        .select("id, name, status, start_date, end_date")
        .in("status", ["planning", "active", "on_hold"]);

      if (!projects || projects.length === 0) {
        setPredictions([]);
        return;
      }

      const results: ProjectPrediction[] = [];

      for (const project of projects as ProjectSlice[]) {
        // Fetch tasks
        const { data: tasks } = await supabaseAdmin
          .from("tasks")
          .select("id, status, priority, created_at, completed_at")
          .eq("project_id", project.id);

        const allTasks = (tasks ?? []) as TaskSlice[];

        // Fetch members
        const { data: members } = await supabaseAdmin
          .from("project_members")
          .select("id")
          .eq("project_id", project.id);

        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter((t) => t.status === "completed").length;
        const blockedTasks = allTasks.filter((t) => t.status === "blocked").length;
        const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
        const todoTasks = allTasks.filter((t) => t.status === "todo").length;

        // Calculate avg task duration (completed tasks only)
        const completedWithDates = allTasks.filter(
          (t): t is TaskSlice & { completed_at: string } =>
            t.status === "completed" && Boolean(t.created_at) && Boolean(t.completed_at),
        );
        let avgTaskDuration = 0;
        if (completedWithDates.length > 0) {
          const totalDays = completedWithDates.reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const completed = new Date(t.completed_at).getTime();
            return sum + (completed - created) / (1000 * 60 * 60 * 24);
          }, 0);
          avgTaskDuration = totalDays / completedWithDates.length;
        }

        // Calculate task velocity (tasks completed per week, last 4 weeks)
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const recentCompleted = completedWithDates.filter(
          (t) => new Date(t.completed_at) >= fourWeeksAgo,
        );
        const taskVelocity = recentCompleted.length / 4;

        // Days remaining/elapsed
        const now = new Date();
        const startDate = project.start_date ? new Date(project.start_date) : null;
        const endDate = project.end_date ? new Date(project.end_date) : null;
        const daysRemaining = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const daysElapsed = startDate ? Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        const stats = {
          totalTasks,
          completedTasks,
          blockedTasks,
          inProgressTasks,
          todoTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          avgTaskDuration: Math.round(avgTaskDuration * 10) / 10,
          taskVelocity: Math.round(taskVelocity * 10) / 10,
          daysRemaining,
          daysElapsed: Math.max(0, daysElapsed),
          tasksPerDay: daysRemaining > 0 ? (totalTasks - completedTasks) / daysRemaining : 0,
          memberCount: (members || []).length,
        };

        const risk = calculateRisk(stats, project.end_date);

        results.push({
          projectId: project.id,
          projectName: project.name,
          projectStatus: project.status,
          endDate: project.end_date,
          riskLevel: risk.riskLevel,
          riskScore: risk.riskScore,
          predictedDelay: risk.predictedDelay,
          factors: risk.factors,
          recommendations: risk.recommendations,
          stats,
        });
      }

      // Sort by risk score descending
      results.sort((a, b) => b.riskScore - a.riskScore);
      setPredictions(results);
    } catch (e) {
      console.error("Prediction error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, predictions, analyzeProjects };
}
