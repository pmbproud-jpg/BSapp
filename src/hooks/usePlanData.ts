/**
 * Hook zarządzający danymi planu tygodniowego:
 * fetchAll (vehicles, projects, workers, assignments, requests, absences),
 * vehicle CRUD, assignment CRUD, BL order CRUD.
 * Wydzielony z plan.tsx.
 */
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { fetchAllWorkers, fetchProfileMap } from "@/src/services/profileService";
import { useState } from "react";
import { Alert, Platform } from "react-native";

export type Vehicle = { id: string; name: string; license_plate: string; seats: number; active: boolean };

export function usePlanData(
  weekStart: string,
  profileId: string | undefined,
  sendNotification: any,
  t: any,
  i18nLang: string,
  dayFullFn: (day: any, lang: string) => string,
) {
  // Shared data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectMembers, setProjectMembers] = useState<Map<string, any[]>>(new Map());

  // Day view
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssign, setEditingAssign] = useState<any | null>(null);
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
    const { data } = await (supabaseAdmin.from("user_absences") as any)
      .select("*, user:profiles!user_absences_user_id_fkey(id, full_name)")
      .or("status.eq.approved,type.eq.sick_leave")
      .lte("date_from", rEnd)
      .gte("date_to", rStart)
      .order("date_from");
    setAbsences(data || []);
  };

  const fetchVehicles = async () => {
    const { data } = await (supabaseAdmin.from("vehicles") as any).select("*").eq("active", true).order("name");
    setVehicles(data || []);
  };
  const fetchProjects = async () => {
    const { data } = await (supabaseAdmin.from("projects") as any).select("id, name, location, status, project_number").order("name");
    setProjects(data || []);
  };
  const fetchWorkers = async () => {
    const data = await fetchAllWorkers();
    setWorkers(data);
  };

  const fetchProjectMembers = async () => {
    const { data } = await (supabaseAdmin.from("project_members") as any)
      .select("project_id, user_id, role, profile:profiles(id, full_name, role)")
      .order("project_id");
    if (data) {
      const map = new Map<string, any[]>();
      for (const m of data) {
        const pid = m.project_id;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(m);
      }
      setProjectMembers(map);
    }
  };

  const fetchAssignments = async () => {
    const { data: reqs } = await (supabaseAdmin.from("plan_requests") as any)
      .select("id, project_id, week_start, status, project:projects(id, name, location)")
      .eq("week_start", weekStart);
    if (!reqs || reqs.length === 0) { setAssignments([]); return; }
    const reqIds = reqs.map((r: any) => r.id);
    const { data: asgn } = await (supabaseAdmin.from("plan_assignments") as any).select("*").in("request_id", reqIds);
    const wIds = [...new Set((asgn || []).map((a: any) => a.worker_id))];
    let pMap = new Map();
    if (wIds.length > 0) {
      const { data: profs } = await (supabaseAdmin.from("profiles") as any).select("id, full_name, role").in("id", wIds);
      pMap = new Map((profs || []).map((p: any) => [p.id, p]));
    }
    const { data: freshVehicles } = await (supabaseAdmin.from("vehicles") as any).select("*").eq("active", true);
    const vMap = new Map((freshVehicles || []).map((v: any) => [v.id, v]));
    setAssignments((asgn || []).map((a: any) => {
      const req = reqs.find((r: any) => r.id === a.request_id);
      const vIds: string[] = Array.isArray(a.vehicle_ids) && a.vehicle_ids.length > 0
        ? a.vehicle_ids
        : a.vehicle_id ? [a.vehicle_id] : [];
      const resolvedVehicles = vIds.map((vid: string) => vMap.get(vid)).filter(Boolean);
      return { ...a, project: req?.project, worker: pMap.get(a.worker_id) || null, vehicle: resolvedVehicles[0] || null, vehicles: resolvedVehicles };
    }));
  };

  const fetchRequests = async () => {
    const { data } = await (supabaseAdmin.from("plan_requests") as any)
      .select("*, project:projects(name, location), workers:plan_request_workers(worker_id)")
      .eq("week_start", weekStart).order("created_at", { ascending: false });
    if (data) {
      const allWIds = [...new Set(data.flatMap((r: any) => [...(r.workers || []).map((w: any) => w.worker_id), r.requested_by]))] as string[];
      if (allWIds.length > 0) {
        const profMap = await fetchProfileMap(allWIds);
        const pm = new Map(Object.entries(profMap).map(([id, name]) => [id, { id, full_name: name }]));
        for (const req of data) {
          req.requester = pm.get(req.requested_by) || { full_name: null };
          req.workers = (req.workers || []).map((w: any) => ({ ...w, profile: pm.get(w.worker_id) || null }));
        }
      }
    }
    setRequests(data || []);
  };

  const fetchAll = async () => {
    setLoading(true);
    try { await Promise.all([fetchVehicles(), fetchProjects(), fetchWorkers(), fetchProjectMembers(), fetchAssignments(), fetchRequests(), fetchAbsencesForWeek()]); }
    finally { setLoading(false); }
  };

  // ── Helpers ──
  const getWorkerAbsence = (workerId: string, dateStr: string) => {
    return absences.find((a: any) => a.user_id === workerId && a.status === "approved" && dateStr >= a.date_from && dateStr <= a.date_to);
  };

  const dayCount = (dow: number) => assignments.filter((a) => a.day_of_week === dow).length;
  const dayAsgn = (dow: number) => assignments.filter((a) => a.day_of_week === dow);
  const vUsage = (vid: string, dow: number) => assignments.filter((a) => a.vehicle_id === vid && a.day_of_week === dow).length;

  const getWorkersForProject = (projectId: string | null): any[] => {
    if (!projectId) return [];
    const members = projectMembers.get(projectId) || [];
    if (members.length === 0) return workers;
    const memberIds = new Set(members.map((m: any) => m.user_id));
    return workers.filter((w: any) => memberIds.has(w.id));
  };

  const getRequestedWorkerIds = (projectId: string | null): Set<string> => {
    if (!projectId) return new Set();
    const ids = new Set<string>();
    requests.filter((r: any) => r.project_id === projectId).forEach((r: any) => {
      (r.workers || []).forEach((w: any) => { if (w.worker_id) ids.add(w.worker_id); });
    });
    return ids;
  };

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getWorkerConflicts = (workerId: string, dayOfWeek: number, startTime: string, endTime: string, excludeId?: string): any[] => {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return assignments.filter((a: any) => {
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
        const { error } = await (supabaseAdmin.from("vehicles") as any).update({ name: vName.trim(), license_plate: vPlate.trim().toUpperCase(), seats: parseInt(vSeats) || 5 }).eq("id", editingVehicleId);
        if (error) throw error;
      } else {
        const { error } = await (supabaseAdmin.from("vehicles") as any).insert({ name: vName.trim(), license_plate: vPlate.trim().toUpperCase(), seats: parseInt(vSeats) || 5, created_by: profileId || null });
        if (error) throw error;
      }
      setVName(""); setVPlate(""); setVSeats("5"); setEditingVehicleId(null); setShowVehicleModal(false); fetchVehicles();
    } catch (e: any) {
      const msg = e?.message || t("common.error");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally { setSavingV(false); }
  };
  const deleteVehicle = async (vehicleId: string) => {
    try {
      const { error } = await (supabaseAdmin.from("vehicles") as any).update({ active: false }).eq("id", vehicleId);
      if (error) throw error;
      fetchVehicles();
    } catch (e: any) {
      const msg = e?.message || t("common.error");
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

  const openEditAssign = (a: any) => {
    setEditingAssign(a);
    setAssignProject(a.project?.id || null);
    const vIdsArr: string[] = Array.isArray(a.vehicle_ids) && a.vehicle_ids.length > 0
      ? a.vehicle_ids
      : a.vehicle_id ? [a.vehicle_id] : [];
    setAssignVehicles(new Set(vIdsArr));
    setAssignDeparture(a.departure_time?.slice(0, 5) || "06:00");
    setAssignStartTime(a.start_time?.slice(0, 5) || "06:00");
    setAssignEndTime(a.end_time?.slice(0, 5) || "16:00");
    const sameGroup = assignments.filter((x: any) => x.request_id === a.request_id && x.day_of_week === a.day_of_week);
    const wIds = new Set<string>(sameGroup.map((x: any) => x.worker_id).filter(Boolean));
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
      assignments.filter((x: any) => x.request_id === editingAssign.request_id && x.day_of_week === editingAssign.day_of_week)
        .forEach((x: any) => excludeIds.add(x.id));
    }
    const conflicts: string[] = [];
    for (const wid of Array.from(assignWorkers)) {
      const c = getWorkerConflicts(wid, selectedDay.dayOfWeek, assignStartTime, assignEndTime).filter((a: any) => !excludeIds.has(a.id));
      if (c.length > 0) {
        const wName = workers.find((w: any) => w.id === wid)?.full_name || wid.slice(0, 8);
        const projNames = c.map((a: any) => a.project?.name || "?").join(", ");
        const times = c.map((a: any) => `${(a.start_time || "00:00").slice(0, 5)}-${(a.end_time || "24:00").slice(0, 5)}`).join(", ");
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
        const sameGroup = assignments.filter((x: any) => x.request_id === editingAssign.request_id && x.day_of_week === editingAssign.day_of_week);
        const existingWorkerIds = new Set(sameGroup.map((x: any) => x.worker_id));
        const newWorkerIds = assignWorkers;
        for (const a of sameGroup) {
          if (!newWorkerIds.has(a.worker_id)) {
            await (supabaseAdmin.from("plan_assignments") as any).delete().eq("id", a.id);
          }
        }
        const editedWorkerId = editingAssign.worker_id;
        for (const wid of Array.from(newWorkerIds)) {
          if (existingWorkerIds.has(wid)) {
            const existing = sameGroup.find((x: any) => x.worker_id === wid);
            if (existing) {
              const isEditedWorker = wid === editedWorkerId;
              if (isEditedWorker) {
                await (supabaseAdmin.from("plan_assignments") as any)
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
            await (supabaseAdmin.from("plan_request_workers") as any).upsert({ request_id: editingAssign.request_id, worker_id: wid }, { onConflict: "request_id,worker_id" });
            await (supabaseAdmin.from("plan_assignments") as any).upsert({
              request_id: editingAssign.request_id, worker_id: wid, day_of_week: editingAssign.day_of_week,
              vehicle_id: firstVehicleId, vehicle_ids: vehicleIdsArr, departure_time: assignDeparture || null,
              start_time: assignStartTime || null, end_time: assignEndTime || null,
              assigned_by: profileId || null,
            }, { onConflict: "request_id,worker_id,day_of_week" });
          }
        }
      } else {
        let { data: existingReq } = await (supabaseAdmin.from("plan_requests") as any)
          .select("id").eq("project_id", assignProject).eq("week_start", weekStart).maybeSingle();
        let requestId: string;
        if (existingReq) { requestId = existingReq.id; }
        else {
          const { data: newReq, error } = await (supabaseAdmin.from("plan_requests") as any)
            .insert({ project_id: assignProject, week_start: weekStart, requested_by: profileId || null, status: "published" }).select().single();
          if (error) throw error; requestId = newReq.id;
        }
        for (const wid of Array.from(assignWorkers)) {
          await (supabaseAdmin.from("plan_request_workers") as any).upsert({ request_id: requestId, worker_id: wid }, { onConflict: "request_id,worker_id" });
          await (supabaseAdmin.from("plan_assignments") as any).upsert({
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
    } catch (e: any) {
      console.error(e);
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message || "Error");
    } finally { setSavingAssign(false); }
  };

  const deleteAssign = async (id: string) => {
    await (supabaseAdmin.from("plan_assignments") as any).delete().eq("id", id);
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
        await (supabaseAdmin.from("plan_requests") as any)
          .update({ project_id: orderProject, notes: orderNotes.trim() || null, vehicle_ids: vehicleIdsArr })
          .eq("id", orderEditingId);
        await (supabaseAdmin.from("plan_request_workers") as any).delete().eq("request_id", orderEditingId);
        const rows = Array.from(orderWorkers).map((wid) => ({ request_id: orderEditingId, worker_id: wid }));
        await (supabaseAdmin.from("plan_request_workers") as any).insert(rows);
      } else {
        const { data: req, error } = await (supabaseAdmin.from("plan_requests") as any)
          .insert({ project_id: orderProject, week_start: weekStart, requested_by: profileId || null, notes: orderNotes.trim() || null, vehicle_ids: vehicleIdsArr }).select().single();
        if (error) throw error;
        const rows = Array.from(orderWorkers).map((wid) => ({ request_id: req.id, worker_id: wid }));
        await (supabaseAdmin.from("plan_request_workers") as any).insert(rows);
      }
      const msg = orderEditingId ? (t("common.saved") || "Gespeichert") : t("plan.request_sent");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      resetOrderForm(); fetchRequests();
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message || "Error");
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
      await (supabaseAdmin.from("plan_request_workers") as any).delete().eq("request_id", id);
      await (supabaseAdmin.from("plan_assignments") as any).delete().eq("request_id", id);
      await (supabaseAdmin.from("plan_requests") as any).delete().eq("id", id);
      if (orderEditingId === id) resetOrderForm();
      fetchRequests();
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message || "Error");
    }
  };

  const openEditOrder = (req: any) => {
    setOrderEditingId(req.id);
    setOrderProject(req.project_id || null);
    setOrderWorkers(new Set((req.workers || []).map((w: any) => w.worker_id)));
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
