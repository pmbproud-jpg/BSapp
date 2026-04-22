/**
 * Hook zarządzający pracownikami z planu dziennego w projekcie.
 * Wydzielony z projects/[id].tsx.
 */

import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database } from "@/src/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileLite = Pick<Profile, "id" | "full_name" | "email" | "role">;
type PlanWorkerWithTime = ProfileLite & {
  start_time: string | null;
  end_time: string | null;
  departure_time: string | null;
};

export function useProjectPlanWorkers(
  projectId: string | undefined,
  profile: Profile | null,
) {
  const [planWorkers, setPlanWorkers] = useState<PlanWorkerWithTime[]>([]);
  const [showAddPlanWorker, setShowAddPlanWorker] = useState(false);
  const [planWorkerCandidates, setPlanWorkerCandidates] = useState<ProfileLite[]>([]);
  const [planWorkerSearch, setPlanWorkerSearch] = useState("");
  const [addingPlanWorker, setAddingPlanWorker] = useState(false);

  const fetchPlanWorkers = async (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const dayJs = d.getDay();
      const dayOfWeek = dayJs === 0 ? 7 : dayJs;
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek - 1));
      const weekStart = monday.toISOString().split("T")[0];

      const { data: reqs } = await supabaseAdmin.from("plan_requests")
        .select("id")
        .eq("project_id", projectId!)
        .eq("week_start", weekStart);
      if (!reqs || reqs.length === 0) { setPlanWorkers([]); return; }
      const reqsTyped = reqs as { id: string }[];
      const reqIds = reqsTyped.map((r) => r.id);

      type AssignmentSlice = {
        worker_id: string;
        start_time: string | null;
        end_time: string | null;
        vehicle_id: string | null;
        departure_time: string | null;
      };
      const { data: asgn } = await supabaseAdmin.from("plan_assignments")
        .select("worker_id, start_time, end_time, vehicle_id, departure_time")
        .in("request_id", reqIds)
        .eq("day_of_week", dayOfWeek);
      const asgnTyped = (asgn ?? []) as AssignmentSlice[];
      if (asgnTyped.length === 0) { setPlanWorkers([]); return; }

      const workerIds = [...new Set(asgnTyped.map((a) => a.worker_id))];
      const { data: profiles } = await supabaseAdmin.from("profiles")
        .select("id, full_name, email, role")
        .in("id", workerIds)
        .order("full_name");

      const workersWithTime: PlanWorkerWithTime[] = ((profiles ?? []) as ProfileLite[]).map((p) => {
        const assignment = asgnTyped.find((a) => a.worker_id === p.id);
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

  const openAddPlanWorkerModal = async () => {
    setPlanWorkerSearch("");
    setShowAddPlanWorker(true);
    try {
      const { data } = await supabaseAdmin.from("profiles")
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id ?? "")
        .order("full_name");
      const existingIds = planWorkers.map((pw) => pw.id);
      const candidates = ((data ?? []) as ProfileLite[]).filter((u) => !existingIds.includes(u.id));
      setPlanWorkerCandidates(candidates);
    } catch (e) {
      console.error("Error fetching users for plan:", e);
    }
  };

  const addPlanWorkerManually = async (userId: string, teamDate: string) => {
    setAddingPlanWorker(true);
    try {
      const d = new Date(teamDate);
      const dayJs = d.getDay();
      const dayOfWeek = dayJs === 0 ? 7 : dayJs;
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek - 1));
      const weekStart = monday.toISOString().split("T")[0];

      let { data: reqs } = await supabaseAdmin.from("plan_requests")
        .select("id")
        .eq("project_id", projectId!)
        .eq("week_start", weekStart);

      let requestId: string;
      if (reqs && reqs.length > 0) {
        requestId = reqs[0].id;
      } else {
        const { data: newReq, error: reqErr } = await supabaseAdmin.from("plan_requests")
          .insert({ project_id: projectId!, week_start: weekStart, requested_by: profile?.id, status: "published" })
          .select("id")
          .single();
        if (reqErr) throw reqErr;
        requestId = newReq.id;
      }

      const { error: asgnErr } = await supabaseAdmin.from("plan_assignments")
        .insert({ request_id: requestId, worker_id: userId, day_of_week: dayOfWeek });
      if (asgnErr) throw asgnErr;

      setShowAddPlanWorker(false);
      fetchPlanWorkers(teamDate);
    } catch (e: unknown) {
      console.error("Error adding plan worker:", e);
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      const msg = code === "23505" ? "Mitarbeiter bereits zugewiesen" : "Fehler beim Hinzufügen";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Fehler", msg);
    } finally {
      setAddingPlanWorker(false);
    }
  };

  return {
    planWorkers,
    showAddPlanWorker, setShowAddPlanWorker,
    planWorkerCandidates,
    planWorkerSearch, setPlanWorkerSearch,
    addingPlanWorker,
    fetchPlanWorkers,
    openAddPlanWorkerModal,
    addPlanWorkerManually,
  };
}
