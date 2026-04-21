/**
 * Hook zarządzający danymi planu tygodniowego:
 * fetchAll (vehicles, projects, workers, assignments, requests, absences),
 * vehicle CRUD, assignment CRUD, BL order CRUD.
 * Wydzielony z plan.tsx.
 */
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { fetchAllWorkers, fetchProfileMap } from "@/src/services/profileService";
import type { Database } from "@/src/lib/supabase/database.types";
import type { TFunction } from "i18next";
import { useState } from "react";
import { Alert, Platform } from "react-native";

// ── Typy z Supabase schema ──
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type PlanAssignmentRow = Database["public"]["Tables"]["plan_assignments"]["Row"];
type PlanRequestRow = Database["public"]["Tables"]["plan_requests"]["Row"];
type UserAbsenceRow = Database["public"]["Tables"]["user_absences"]["Row"];
type ProjectMemberRow = Database["public"]["Tables"]["project_members"]["Row"];

export type Vehicle = { id: string; name: string; license_plate: string; seats: number; active: boolean };

// Pola projektu wybierane w fetchProjects (ograniczony SELECT)
type ProjectLite = Pick<ProjectRow, "id" | "name" | "location" | "status" | "project_number">;

// Skrócony profil (z joina)
type WorkerLite = Pick<ProfileRow, "id" | "full_name" | "role">;

// plan_requests z dołączonym project + workers + requester
type RequestWithRelations = PlanRequestRow & {
  project?: Pick<ProjectRow, "name" | "location"> | null;
  workers?: Array<{ worker_id: string; profile?: { id: string; full_name: string | null } | null }>;
  requester?: { id?: string; full_name: string | null } | null;
};

// plan_assignments po zasileniu join-ami w pamięci
type AssignmentWithRelations = PlanAssignmentRow & {
  project?: Pick<ProjectRow, "id" | "name" | "location"> | null;
  worker?: WorkerLite | null;
  vehicle?: Vehicle | null;
  vehicles?: Vehicle[];
};

// user_absences z dołączonym użytkownikiem
type AbsenceWithUser = UserAbsenceRow & {
  user?: { id: string; full_name: string | null } | null;
};

// project_members z profile join
type MemberWithProfile = ProjectMemberRow & {
  profile?: WorkerLite | null;
};

// Struktura "dnia" z widoku planu (komponent plan.tsx przekazuje).
// `date` to ISO YYYY-MM-DD używane do filtrowania nieobecności.
export type PlanDay = {
  dayOfWeek: number;
  dayNum: number;
  monthNum: number;
  date: string;
  yearNum?: number;
  dayName?: string;
};

type NotificationData = Record<string, unknown>;
type SendNotificationFn = (
  userId: string,
  title: string,
  body: string,
  type?: string,
  data?: NotificationData,
) => Promise<void>;

type DayFullFn = (day: PlanDay, lang: string) => string;

export function usePlanData(
  weekStart: string,
  profileId: string | undefined,
  sendNotification: SendNotificationFn,
  t: TFunction,
  i18nLang: string,
  dayFullFn: DayFullFn,
) {
  // Shared data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [workers, setWorkers] = useState<ProfileRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithRelations[]>([]);
  const [requests, setRequests] = useState<RequestWithRelations[]>([]);
  const [absences, setAbsences] = useState<AbsenceWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectMembers, setProjectMembers] = useState<Map<string, MemberWithProfile[]>>(new Map());

  // Day view
  const [selectedDay, setSelectedDay] = useState<PlanDay | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssign, setEditingAssign] = useState<AssignmentWithRelations | null>(null);
  const [assignProject, setAssignProject] = useState<string | null>(null);
  const [assignVehicles, setAssignVehicles] = useState<Set<string>>(new Set());
  const [assignDeparture, setAssignDeparture] = useState("06:00");
  const [assignStartTime, setAssignStartTime] = useState("06:00");
  const [assignEndTime, setAssignEndTime] = useState("16:00");
  const [assignWorkers, setAssignWorkers] = useState<Set<string>>(new Set());
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignShowProjects, setAssignShowProjects] = useState(false);
  const [assignShowVehicles, setAssignShowVehicles] = useState(false);
  const [assignShowWorkers, setAssignShowWorkers] = useState(false);

  // Vehicle modal
  const [vehiclesCollapsed, setVehiclesCollapsed] = useState(true);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vName, setVName] = useState(""); const [vPlate, setVPlate] = useState(""); const [vSeats, setVSeats] = useState("5");
  const [savingV, setSavingV] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // BL order
  const [orderProject, setOrderProject] = useState<string | null>(null);
  const [orderWorkers, setOrderWorkers] = useState<Set<string>>(new Set());
  const [orderVehicles, setOrderVehicles] = useState<Set<string>>(new Set());
  const [orderNotes, setOrderNotes] = useState("");
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderShowForm, setOrderShowForm] = useState(false);
  const [orderEditingId, setOrderEditingId] = useState<string | null>(null);
  const [orderShowProjectPicker, setOrderShowProjectPicker] = useState(false);
  const [orderShowWorkerPicker, setOrderShowWorkerPicker] = useState(false);
  const [orderShowVehiclePicker, setOrderShowVehiclePicker] = useState(false);

  // ── Fetch ──
  const fetchAbsencesForWeek = async () => {
    const ws = new Date(weekStart);
    const rangeStart = new Date(ws.getFullYear(), ws.getMonth(), 1);
    const rangeEnd = new Date(ws.getFullYear(), ws.getMonth() + 2, 0);
    const rStart = rangeStart.toISOString().split("T")[0];
    const rEnd = rangeEnd.toISOString().split("T")[0];
    const { data } = await supabaseAdmin.from("user_absences")
      .select("*, user:profiles!user_absences_user_id_fkey(id, full_name)")
      .or("status.eq.approved,type.eq.sick_leave")
      .lte("date_from", rEnd)
      .gte("date_to", rStart)
      .order("date_from");
    setAbsences((data ?? []) as AbsenceWithUser[]);
  };

  const fetchVehicles = async () => {
    const { data } = await supabaseAdmin.from("vehicles").select("*").eq("active", true).order("name");
    setVehicles((data ?? []) as Vehicle[]);
  };
  const fetchProjects = async () => {
    const { data } = await supabaseAdmin.from("projects").select("id, name, location, status, project_number").order("name");
    setProjects((data ?? []) as ProjectLite[]);
  };
  const fetchWorkers = async () => {
    const data = await fetchAllWorkers();
    setWorkers(data as ProfileRow[]);
  };

  const fetchProjectMembers = async () => {
    const { data } = await supabaseAdmin.from("project_members")
      .select("project_id, user_id, role, profile:profiles(id, full_name, role)")
      .order("project_id");
    if (data) {
      const map = new Map<string, MemberWithProfile[]>();
      for (const m of data as MemberWithProfile[]) {
        const pid = m.project_id;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(m);
      }
      setProjectMembers(map);
    }
  };

  const fetchAssignments = async () => {
    const { data: reqs } = await supabaseAdmin.from("plan_requests")
      .select("id, project_id, week_start, status, project:projects(id, name, location)")
      .eq("week_start", weekStart);
    const reqsTyped = (reqs ?? []) as Array<Pick<PlanRequestRow, "id" | "project_id" | "week_start" | "status"> & { project?: Pick<ProjectRow, "id" | "name" | "location"> | null }>;
    if (reqsTyped.length === 0) { setAssignments([]); return; }
    const reqIds = reqsTyped.map((r) => r.id);
    const { data: asgn } = await supabaseAdmin.from("plan_assignments").select("*").in("request_id", reqIds);
    const asgnTyped = (asgn ?? []) as PlanAssignmentRow[];
    const wIds = [...new Set(asgnTyped.map((a) => a.worker_id))];
    let pMap = new Map<string, WorkerLite>();
    if (wIds.length > 0) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, role").in("id", wIds);
      pMap = new Map(((profs ?? []) as WorkerLite[]).map((p) => [p.id, p]));
    }
    const { data: freshVehicles } = await supabaseAdmin.from("vehicles").select("*").eq("active", true);
    const vMap = new Map(((freshVehicles ?? []) as Vehicle[]).map((v) => [v.id, v]));
    setAssignments(asgnTyped.map((a): AssignmentWithRelations => {
      const req = reqsTyped.find((r) => r.id === a.request_id);
      // Single vehicle per worker — take last from vehicle_ids (latest change) or fallback to vehicle_id
      const firstVid = (Array.isArray(a.vehicle_ids) && a.vehicle_ids.length > 0)
        ? a.vehicle_ids[a.vehicle_ids.length - 1]
        : a.vehicle_id ?? null;
      const resolvedVehicle = firstVid ? vMap.get(firstVid) ?? null : null;
      return {
        ...a,
        project: req?.project ?? null,
        worker: pMap.get(a.worker_id) ?? null,
        vehicle: resolvedVehicle,
        vehicles: resolvedVehicle ? [resolvedVehicle] : [],
      };
    }));
  };

  const fetchRequests = async () => {
    const { data } = await supabaseAdmin.from("plan_requests")
      .select("*, project:projects(name, location), workers:plan_request_workers(worker_id)")
      .eq("week_start", weekStart).order("created_at", { ascending: false });
    const rows = (data ?? []) as RequestWithRelations[];
    if (rows.length > 0) {
      const allWIds = [...new Set(
        rows.flatMap((r) => [
          ...(r.workers ?? []).map((w) => w.worker_id),
          r.requested_by,
        ]),
      )].filter((id): id is string => Boolean(id));
      if (allWIds.length > 0) {
        const profMap = await fetchProfileMap(allWIds);
        const pm = new Map<string, { id: string; full_name: string | null }>(
          Object.entries(profMap).map(([id, name]) => [id, { id, full_name: name }]),
        );
        for (const req of rows) {
          req.requester = pm.get(req.requested_by) ?? { full_name: null };
          req.workers = (req.workers ?? []).map((w) => ({
            ...w,
            profile: pm.get(w.worker_id) ?? null,
          }));
        }
      }
    }
    setRequests(rows);
  };

  const fetchAll = async () => {
    setLoading(true);
    try { await Promise.all([fetchVehicles(), fetchProjects(), fetchWorkers(), fetchProjectMembers(), fetchAssignments(), fetchRequests(), fetchAbsencesForWeek()]); }
    finally { setLoading(false); }
  };

  // ── Helpers ──
  const getWorkerAbsence = (workerId: string, dateStr: string) => {
    return absences.find((a) => a.user_id === workerId && a.status === "approved" && dateStr >= a.date_from && dateStr <= a.date_to);
  };

  const dayCount = (dow: number) => assignments.filter((a) => a.day_of_week === dow).length;
  const dayAsgn = (dow: number) => assignments.filter((a) => a.day_of_week === dow);
  const vUsage = (vid: string, dow: number) => assignments.filter((a) => {
    if (a.day_of_week !== dow) return false;
    if (Array.isArray(a.vehicle_ids) && a.vehicle_ids.length > 0) return a.vehicle_ids.includes(vid);
    return a.vehicle_id === vid;
  }).length;

  const getWorkersForProject = (projectId: string | null): ProfileRow[] => {
    if (!projectId) return [];
    const members = projectMembers.get(projectId) ?? [];
    if (members.length === 0) return workers;
    const memberIds = new Set(members.map((m) => m.user_id));
    return workers.filter((w) => memberIds.has(w.id));
  };

  const getRequestedWorkerIds = (projectId: string | null): Set<string> => {
    if (!projectId) return new Set();
    const ids = new Set<string>();
    requests.filter((r) => r.project_id === projectId).forEach((r) => {
      (r.workers ?? []).forEach((w) => { if (w.worker_id) ids.add(w.worker_id); });
    });
    return ids;
  };

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getWorkerConflicts = (
    workerId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): AssignmentWithRelations[] => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return assignments.filter((a) => {
      if (a.worker_id !== workerId) return false;
      if (a.day_of_week !== dayOfWeek) return false;
      if (excludeId && a.id === excludeId) return false;
      const aStart = a.start_time ? timeToMinutes(a.start_time.slice(0, 5)) : 0;
      const aEnd = a.end_time ? timeToMinutes(a.end_time.slice(0, 5)) : 1440;
      return start < aEnd && end > aStart;
    });
  };

  // ── Vehicle CRUD ──
  const openAddVehicle = () => {
    setEditingVehicleId(null); setVName(""); setVPlate(""); setVSeats("5"); setShowVehicleModal(true);
  };
  const openEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id); setVName(v.name); setVPlate(v.license_plate); setVSeats(String(v.seats)); setShowVehicleModal(true);
  };
  const saveVehicle = async () => {
    if (!vName.trim() || !vPlate.trim()) return;
    setSavingV(true);
    try {
      if (editingVehicleId) {
        const { error } = await supabaseAdmin.from("vehicles").update({ name: vName.trim(), license_plate: vPlate.trim().toUpperCase(), seats: parseInt(vSeats) || 5 }).eq("id", editingVehicleId);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("vehicles").insert({ name: vName.trim(), license_plate: vPlate.trim().toUpperCase(), seats: parseInt(vSeats) || 5, created_by: profileId || null });
        if (error) throw error;
      }
      setVName(""); setVPlate(""); setVSeats("5"); setEditingVehicleId(null); setShowVehicleModal(false); fetchVehicles();
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : null) || t("common.error");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally { setSavingV(false); }
  };
  const deleteVehicle = async (vehicleId: string) => {
    try {
      const { error } = await supabaseAdmin.from("vehicles").update({ active: false }).eq("id", vehicleId);
      if (error) throw error;
      fetchVehicles();
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : null) || t("common.error");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    }
  };

  // ── Assignment CRUD ──
  const openAddAssign = () => {
    setEditingAssign(null); setAssignProject(null); setAssignVehicles(new Set());
    setAssignDeparture("06:00"); setAssignStartTime("06:00"); setAssignEndTime("16:00");
    setAssignWorkers(new Set()); setAssignShowProjects(false); setAssignShowVehicles(false); setAssignShowWorkers(false);
    setShowAssignModal(true);
  };

  const openEditAssign = (a: AssignmentWithRelations) => {
    setEditingAssign(a);
    setAssignProject(a.project?.id ?? null);
    // Load the latest vehicle (last in array = most recent change)
    const firstVid = (Array.isArray(a.vehicle_ids) && a.vehicle_ids.length > 0)
      ? a.vehicle_ids[a.vehicle_ids.length - 1]
      : a.vehicle_id ?? null;
    setAssignVehicles(firstVid ? new Set([firstVid]) : new Set());
    setAssignDeparture(a.departure_time?.slice(0, 5) || "06:00");
    setAssignStartTime(a.start_time?.slice(0, 5) || "06:00");
    setAssignEndTime(a.end_time?.slice(0, 5) || "16:00");
    const sameGroup = assignments.filter((x) => x.request_id === a.request_id && x.day_of_week === a.day_of_week);
    const wIds = new Set<string>(sameGroup.map((x) => x.worker_id).filter(Boolean));
    setAssignWorkers(wIds);
    setAssignShowProjects(false); setAssignShowVehicles(false); setAssignShowWorkers(false);
    setShowAssignModal(true);
  };

  const saveAssignment = async () => {
    if (!assignProject || !selectedDay || assignWorkers.size === 0) {
      const msg = t("plan.select_project_and_workers");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    if (timeToMinutes(assignStartTime) >= timeToMinutes(assignEndTime)) {
      const msg = t("plan.invalid_time_range") || "Startzeit muss vor der Endzeit liegen";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    const excludeIds = new Set<string>();
    if (editingAssign) {
      assignments.filter((x) => x.request_id === editingAssign.request_id && x.day_of_week === editingAssign.day_of_week)
        .forEach((x) => excludeIds.add(x.id));
    }
    const conflicts: string[] = [];
    for (const wid of Array.from(assignWorkers)) {
      const c = getWorkerConflicts(wid, selectedDay.dayOfWeek, assignStartTime, assignEndTime).filter((a) => !excludeIds.has(a.id));
      if (c.length > 0) {
        const wName = workers.find((w) => w.id === wid)?.full_name || wid.slice(0, 8);
        const projNames = c.map((a) => a.project?.name || "?").join(", ");
        const times = c.map((a) => `${(a.start_time || "00:00").slice(0, 5)}-${(a.end_time || "24:00").slice(0, 5)}`).join(", ");
        conflicts.push(`${wName}: ${projNames} (${times})`);
      }
    }
    if (conflicts.length > 0) {
      const msg = (t("plan.time_conflict") || "Zeitkonflikt") + ":\n" + conflicts.join("\n");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    setSavingAssign(true);
    const vehicleIdsArr = Array.from(assignVehicles);
    const firstVehicleId = vehicleIdsArr.length > 0 ? vehicleIdsArr[0] : null;
    try {
      if (editingAssign) {
        const sameGroup = assignments.filter((x) => x.request_id === editingAssign.request_id && x.day_of_week === editingAssign.day_of_week);
        const existingWorkerIds = new Set(sameGroup.map((x) => x.worker_id));
        const newWorkerIds = assignWorkers;
        for (const a of sameGroup) {
          if (!newWorkerIds.has(a.worker_id)) {
            await supabaseAdmin.from("plan_assignments").delete().eq("id", a.id);
          }
        }
        const editedWorkerId = editingAssign.worker_id;
        for (const wid of Array.from(newWorkerIds)) {
          if (existingWorkerIds.has(wid)) {
            const existing = sameGroup.find((x) => x.worker_id === wid);
            if (existing) {
              const isEditedWorker = wid === editedWorkerId;
              if (isEditedWorker) {
                await supabaseAdmin.from("plan_assignments")
                  .update({
                    departure_time: assignDeparture || null,
                    start_time: assignStartTime || null,
                    end_time: assignEndTime || null,
                    vehicle_id: firstVehicleId,
                    vehicle_ids: vehicleIdsArr,
                  })
                  .eq("id", existing.id);
              }
            }
          } else {
            await supabaseAdmin.from("plan_request_workers").upsert({ request_id: editingAssign.request_id, worker_id: wid }, { onConflict: "request_id,worker_id" });
            await supabaseAdmin.from("plan_assignments").upsert({
              request_id: editingAssign.request_id, worker_id: wid, day_of_week: editingAssign.day_of_week,
              vehicle_id: firstVehicleId, vehicle_ids: vehicleIdsArr, departure_time: assignDeparture || null,
              start_time: assignStartTime || null, end_time: assignEndTime || null,
              assigned_by: profileId || null,
            }, { onConflict: "request_id,worker_id,day_of_week" });
          }
        }
      } else {
        const { data: existingReq } = await supabaseAdmin.from("plan_requests")
          .select("id").eq("project_id", assignProject).eq("week_start", weekStart).maybeSingle();
        let requestId: string;
        if (existingReq) { requestId = (existingReq as { id: string }).id; }
        else {
          const { data: newReq, error } = await supabaseAdmin.from("plan_requests")
            .insert({ project_id: assignProject, week_start: weekStart, requested_by: profileId || null, status: "published" }).select().single();
          if (error) throw error;
          if (!newReq) throw new Error("Failed to create plan_request");
          requestId = (newReq as { id: string }).id;
        }
        for (const wid of Array.from(assignWorkers)) {
          await supabaseAdmin.from("plan_request_workers").upsert({ request_id: requestId, worker_id: wid }, { onConflict: "request_id,worker_id" });
          await supabaseAdmin.from("plan_assignments").upsert({
            request_id: requestId, worker_id: wid, day_of_week: selectedDay.dayOfWeek,
            vehicle_id: firstVehicleId, vehicle_ids: vehicleIdsArr, departure_time: assignDeparture || null,
            start_time: assignStartTime || null, end_time: assignEndTime || null,
            assigned_by: profileId || null,
          }, { onConflict: "request_id,worker_id,day_of_week" });
        }
      }
      // Notifications
      if (selectedDay) {
        const projName = projects.find((p) => p.id === assignProject)?.name || "";
        const vehNames = vehicleIdsArr.map((vid) => vehicles.find((v) => v.id === vid)?.name).filter(Boolean).join(", ");
        const dayName = dayFullFn(selectedDay, i18nLang);
        const dateStr = `${selectedDay.dayNum}.${selectedDay.monthNum.toString().padStart(2, "0")}`;
        for (const wid of Array.from(assignWorkers)) {
          if (wid !== profileId) {
            const title = t("notifications.plan_assignment_title", "Nowy przydział");
            const body = `${dayName} (${dateStr}): ${projName}${vehNames ? ` • ${vehNames}` : ""}${assignDeparture ? ` • ${assignDeparture}` : ""}${assignStartTime && assignEndTime ? ` • ${assignStartTime}-${assignEndTime}` : ""}`;
            sendNotification(wid, title, body, "plan_assignment", { day_of_week: selectedDay.dayOfWeek, project_name: projName });
          }
        }
      }
      const msg = t("plan.assignment_saved");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      setShowAssignModal(false); setEditingAssign(null); fetchAssignments();
    } catch (e: unknown) {
      console.error(e);
      const msg = (e instanceof Error ? e.message : null) || "Error";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally { setSavingAssign(false); }
  };

  const deleteAssign = async (id: string) => {
    await supabaseAdmin.from("plan_assignments").delete().eq("id", id);
    fetchAssignments();
  };

  const toggleAW = (id: string) => {
    setAssignWorkers((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── BL Order CRUD ──
  const resetOrderForm = () => {
    setOrderShowForm(false);
    setOrderEditingId(null);
    setOrderProject(null);
    setOrderWorkers(new Set());
    setOrderVehicles(new Set());
    setOrderNotes("");
    setOrderShowProjectPicker(false);
    setOrderShowWorkerPicker(false);
    setOrderShowVehiclePicker(false);
  };

  const saveOrder = async () => {
    if (!orderProject || orderWorkers.size === 0) {
      const msg = t("plan.select_project_and_workers");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    setSendingOrder(true);
    try {
      const vehicleIdsArr = Array.from(orderVehicles);
      if (orderEditingId) {
        await supabaseAdmin.from("plan_requests")
          .update({ project_id: orderProject, notes: orderNotes.trim() || null, vehicle_ids: vehicleIdsArr })
          .eq("id", orderEditingId);
        await supabaseAdmin.from("plan_request_workers").delete().eq("request_id", orderEditingId);
        const rows = Array.from(orderWorkers).map((wid) => ({ request_id: orderEditingId, worker_id: wid }));
        await supabaseAdmin.from("plan_request_workers").insert(rows);
      } else {
        const { data: req, error } = await supabaseAdmin.from("plan_requests")
          .insert({ project_id: orderProject, week_start: weekStart, requested_by: profileId || null, notes: orderNotes.trim() || null, vehicle_ids: vehicleIdsArr }).select().single();
        if (error) throw error;
        if (!req) throw new Error("Failed to create plan_request");
        const reqId = (req as { id: string }).id;
        const rows = Array.from(orderWorkers).map((wid) => ({ request_id: reqId, worker_id: wid }));
        await supabaseAdmin.from("plan_request_workers").insert(rows);
      }
      const msg = orderEditingId ? (t("common.saved") || "Gespeichert") : t("plan.request_sent");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      resetOrderForm(); fetchRequests();
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : null) || "Error";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally { setSendingOrder(false); }
  };

  const deleteOrder = async (id: string) => {
    const msg = t("plan.delete_confirm") || "Eintrag wirklich löschen?";
    const confirmed = Platform.OS === "web"
      ? window.confirm(msg)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t("common.confirm") || "Löschen", msg, [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.delete") || "Löschen", style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      await supabaseAdmin.from("plan_request_workers").delete().eq("request_id", id);
      await supabaseAdmin.from("plan_assignments").delete().eq("request_id", id);
      await supabaseAdmin.from("plan_requests").delete().eq("id", id);
      if (orderEditingId === id) resetOrderForm();
      fetchRequests();
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : null) || "Error";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    }
  };

  const openEditOrder = (req: RequestWithRelations) => {
    setOrderEditingId(req.id);
    setOrderProject(req.project_id || null);
    setOrderWorkers(new Set((req.workers ?? []).map((w) => w.worker_id)));
    setOrderVehicles(new Set(Array.isArray(req.vehicle_ids) ? req.vehicle_ids : []));
    setOrderNotes(req.notes || "");
    setOrderShowForm(true);
    setOrderShowProjectPicker(false);
    setOrderShowWorkerPicker(false);
    setOrderShowVehiclePicker(false);
  };

  const toggleOW = (id: string) => {
    setOrderWorkers((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleOV = (id: string) => {
    setOrderVehicles((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return {
    // Data
    vehicles, projects, workers, assignments, requests, absences, loading, projectMembers,
    // Day view
    selectedDay, setSelectedDay,
    // Helpers
    fetchAll, getWorkerAbsence, dayCount, dayAsgn, vUsage,
    getWorkersForProject, getRequestedWorkerIds, getWorkerConflicts, timeToMinutes,
    // Vehicle
    vehiclesCollapsed, setVehiclesCollapsed,
    showVehicleModal, setShowVehicleModal,
    vName, setVName, vPlate, setVPlate, vSeats, setVSeats,
    savingV, editingVehicleId, setEditingVehicleId,
    openAddVehicle, openEditVehicle, saveVehicle, deleteVehicle,
    // Assignment
    showAssignModal, setShowAssignModal,
    editingAssign, setEditingAssign, assignProject, setAssignProject,
    assignVehicles, setAssignVehicles,
    assignDeparture, setAssignDeparture,
    assignStartTime, setAssignStartTime, assignEndTime, setAssignEndTime,
    assignWorkers, setAssignWorkers, savingAssign,
    assignShowProjects, setAssignShowProjects,
    assignShowVehicles, setAssignShowVehicles,
    assignShowWorkers, setAssignShowWorkers,
    openAddAssign, openEditAssign, saveAssignment, deleteAssign, toggleAW,
    // BL Order
    orderProject, setOrderProject,
    orderWorkers, orderVehicles,
    orderNotes, setOrderNotes,
    sendingOrder, orderShowForm, setOrderShowForm,
    orderEditingId,
    orderShowProjectPicker, setOrderShowProjectPicker,
    orderShowWorkerPicker, setOrderShowWorkerPicker,
    orderShowVehiclePicker, setOrderShowVehiclePicker,
    saveOrder, deleteOrder, openEditOrder, resetOrderForm, toggleOW, toggleOV,
    // Refresh
    fetchAssignments, fetchRequests, fetchVehicles,
  };
}
