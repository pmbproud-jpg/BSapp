import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Platform, Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";

type Vehicle = { id: string; name: string; license_plate: string; seats: number; active: boolean };

function getNextMonday(): string {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
  return d.toISOString().split("T")[0];
}

function getWeekDays(mondayStr: string) {
  const monday = new Date(mondayStr);
  const namesPL = ["Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota","Niedziela"];
  const namesDE = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
  const namesEN = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const sPL = ["Pon","Wt","Śr","Czw","Pt","Sob","Ndz"];
  const sDE = ["Mo","Di","Mi","Do","Fr","Sa","So"];
  const sEN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(d.getDate() + i);
    days.push({
      dayOfWeek: i + 1, date: d.toISOString().split("T")[0],
      dayNum: d.getDate(), monthNum: d.getMonth() + 1,
      namePL: namesPL[i], nameDE: namesDE[i], nameEN: namesEN[i],
      shortPL: sPL[i], shortDE: sDE[i], shortEN: sEN[i],
      isToday: d.toISOString().split("T")[0] === new Date().toISOString().split("T")[0],
      isWeekend: i >= 5,
    });
  }
  return days;
}

function dayShort(day: any, lang: string) {
  return lang === "de" ? day.shortDE : lang === "en" ? day.shortEN : day.shortPL;
}
function dayFull(day: any, lang: string) {
  return lang === "de" ? day.nameDE : lang === "en" ? day.nameEN : day.namePL;
}
function fmtWeek(m: string) {
  const mon = new Date(m); const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const f = (d: Date) => `${d.getDate().toString().padStart(2,"0")}.${(d.getMonth()+1).toString().padStart(2,"0")}`;
  return `${f(mon)} – ${f(sun)}`;
}

// ═══════════════════════════════════════════════════════════
export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc } = useTheme();
  const role = profile?.role || "worker";
  const isLogistics = role === "admin" || role === "management";
  const isBL = role === "bauleiter" || role === "project_manager";

  // Tabs: "plan" = weekly plan, "orders" = BL orders
  const [activeTab, setActiveTab] = useState<"plan" | "orders">(isBL ? "orders" : "plan");
  const [weekStart, setWeekStart] = useState(getNextMonday());

  // Shared data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Day view
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  // Assign modal (add/edit)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssign, setEditingAssign] = useState<any | null>(null);
  const [assignProject, setAssignProject] = useState<string | null>(null);
  const [assignVehicle, setAssignVehicle] = useState<string | null>(null);
  const [assignDeparture, setAssignDeparture] = useState("06:00");
  const [assignStartTime, setAssignStartTime] = useState("06:00");
  const [assignEndTime, setAssignEndTime] = useState("16:00");
  const [assignWorkers, setAssignWorkers] = useState<Set<string>>(new Set());
  const [savingAssign, setSavingAssign] = useState(false);
  const [projectMembers, setProjectMembers] = useState<Map<string, any[]>>(new Map());

  // Vehicle modal
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vName, setVName] = useState(""); const [vPlate, setVPlate] = useState(""); const [vSeats, setVSeats] = useState("5");
  const [savingV, setSavingV] = useState(false);

  // BL order
  const [orderProject, setOrderProject] = useState<string | null>(null);
  const [orderWorkers, setOrderWorkers] = useState<Set<string>>(new Set());
  const [orderNotes, setOrderNotes] = useState("");
  const [sendingOrder, setSendingOrder] = useState(false);

  const weekDays = getWeekDays(weekStart);

  useFocusEffect(useCallback(() => { fetchAll(); }, [weekStart]));

  const fetchAll = async () => {
    setLoading(true);
    try { await Promise.all([fetchVehicles(), fetchProjects(), fetchWorkers(), fetchProjectMembers(), fetchAssignments(), fetchRequests()]); }
    finally { setLoading(false); }
  };

  const fetchVehicles = async () => {
    const { data } = await (supabaseAdmin.from("vehicles") as any).select("*").eq("active", true).order("name");
    setVehicles(data || []);
  };
  const fetchProjects = async () => {
    const { data } = await (supabaseAdmin.from("projects") as any).select("id, name, location, status").in("status", ["active", "planning"]).order("name");
    setProjects(data || []);
  };
  const fetchWorkers = async () => {
    const { data } = await (supabaseAdmin.from("profiles") as any).select("id, full_name, role").in("role", ["worker", "bauleiter"]).order("full_name");
    setWorkers(data || []);
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
    setAssignments((asgn || []).map((a: any) => {
      const req = reqs.find((r: any) => r.id === a.request_id);
      return { ...a, project: req?.project, worker: pMap.get(a.worker_id) || null, vehicle: vehicles.find((v) => v.id === a.vehicle_id) || null };
    }));
  };

  const fetchRequests = async () => {
    const { data } = await (supabaseAdmin.from("plan_requests") as any)
      .select("*, project:projects(name, location), workers:plan_request_workers(worker_id)")
      .eq("week_start", weekStart).order("created_at", { ascending: false });
    if (data) {
      const allWIds = [...new Set(data.flatMap((r: any) => [...(r.workers || []).map((w: any) => w.worker_id), r.requested_by]))];
      if (allWIds.length > 0) {
        const { data: profs } = await (supabaseAdmin.from("profiles") as any).select("id, full_name").in("id", allWIds);
        const pm = new Map((profs || []).map((p: any) => [p.id, p]));
        for (const req of data) {
          req.requester = pm.get(req.requested_by) || { full_name: null };
          req.workers = (req.workers || []).map((w: any) => ({ ...w, profile: pm.get(w.worker_id) || null }));
        }
      }
    }
    setRequests(data || []);
  };

  const dayCount = (dow: number) => assignments.filter((a) => a.day_of_week === dow).length;
  const dayAsgn = (dow: number) => assignments.filter((a) => a.day_of_week === dow);
  const vUsage = (vid: string, dow: number) => assignments.filter((a) => a.vehicle_id === vid && a.day_of_week === dow).length;

  // ─── Vehicle CRUD ──────────────────────────────────────
  const addVehicle = async () => {
    if (!vName.trim() || !vPlate.trim()) return;
    setSavingV(true);
    try {
      const { error } = await (supabaseAdmin.from("vehicles") as any).insert({ name: vName.trim(), license_plate: vPlate.trim().toUpperCase(), seats: parseInt(vSeats) || 5, created_by: profile?.id });
      if (error) throw error;
      setVName(""); setVPlate(""); setVSeats("5"); setShowVehicleModal(false); fetchVehicles();
    } catch (e: any) {
      const msg = e?.message || t("common.error");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally { setSavingV(false); }
  };

  // ─── Assignment CRUD (add + edit) ──────────────────────
  const getWorkersForProject = (projectId: string | null): any[] => {
    if (!projectId) return [];
    const members = projectMembers.get(projectId) || [];
    if (members.length === 0) return workers;
    const memberIds = new Set(members.map((m: any) => m.user_id));
    return workers.filter((w: any) => memberIds.has(w.id));
  };

  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
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

  const openAddAssign = () => {
    setEditingAssign(null); setAssignProject(null); setAssignVehicle(null);
    setAssignDeparture("06:00"); setAssignStartTime("06:00"); setAssignEndTime("16:00");
    setAssignWorkers(new Set()); setShowAssignModal(true);
  };

  const openEditAssign = (a: any) => {
    setEditingAssign(a);
    setAssignProject(a.project?.id || null);
    setAssignVehicle(a.vehicle_id);
    setAssignDeparture(a.departure_time?.slice(0, 5) || "06:00");
    setAssignStartTime(a.start_time?.slice(0, 5) || "06:00");
    setAssignEndTime(a.end_time?.slice(0, 5) || "16:00");
    setAssignWorkers(new Set([a.worker_id]));
    setShowAssignModal(true);
  };

  const saveAssignment = async () => {
    if (!assignProject || !selectedDay || assignWorkers.size === 0) {
      const msg = t("plan.select_project_and_workers");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    // Validate time range
    if (timeToMinutes(assignStartTime) >= timeToMinutes(assignEndTime)) {
      const msg = t("plan.invalid_time_range") || "Godzina rozpoczęcia musi być wcześniejsza niż zakończenia";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    // Check for time conflicts
    const conflicts: string[] = [];
    for (const wid of Array.from(assignWorkers)) {
      const c = getWorkerConflicts(wid, selectedDay.dayOfWeek, assignStartTime, assignEndTime, editingAssign?.id);
      if (c.length > 0) {
        const wName = workers.find((w: any) => w.id === wid)?.full_name || wid.slice(0, 8);
        const projNames = c.map((a: any) => a.project?.name || "?").join(", ");
        const times = c.map((a: any) => `${(a.start_time || "00:00").slice(0, 5)}-${(a.end_time || "24:00").slice(0, 5)}`).join(", ");
        conflicts.push(`${wName}: ${projNames} (${times})`);
      }
    }
    if (conflicts.length > 0) {
      const msg = (t("plan.time_conflict") || "Konflikt godzin") + ":\n" + conflicts.join("\n");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    setSavingAssign(true);
    try {
      if (editingAssign) {
        await (supabaseAdmin.from("plan_assignments") as any)
          .update({ vehicle_id: assignVehicle, departure_time: assignDeparture || null, start_time: assignStartTime || null, end_time: assignEndTime || null })
          .eq("id", editingAssign.id);
      } else {
        let { data: existingReq } = await (supabaseAdmin.from("plan_requests") as any)
          .select("id").eq("project_id", assignProject).eq("week_start", weekStart).maybeSingle();
        let requestId: string;
        if (existingReq) { requestId = existingReq.id; }
        else {
          const { data: newReq, error } = await (supabaseAdmin.from("plan_requests") as any)
            .insert({ project_id: assignProject, week_start: weekStart, requested_by: profile?.id, status: "published" }).select().single();
          if (error) throw error; requestId = newReq.id;
        }
        for (const wid of Array.from(assignWorkers)) {
          await (supabaseAdmin.from("plan_request_workers") as any).upsert({ request_id: requestId, worker_id: wid }, { onConflict: "request_id,worker_id" });
          await (supabaseAdmin.from("plan_assignments") as any).upsert({
            request_id: requestId, worker_id: wid, day_of_week: selectedDay.dayOfWeek,
            vehicle_id: assignVehicle, departure_time: assignDeparture || null,
            start_time: assignStartTime || null, end_time: assignEndTime || null,
            assigned_by: profile?.id,
          }, { onConflict: "request_id,worker_id,day_of_week" });
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

  // ─── BL Order ──────────────────────────────────────────
  const sendOrder = async () => {
    if (!orderProject || orderWorkers.size === 0) {
      const msg = t("plan.select_project_and_workers");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg); return;
    }
    setSendingOrder(true);
    try {
      const { data: req, error } = await (supabaseAdmin.from("plan_requests") as any)
        .insert({ project_id: orderProject, week_start: weekStart, requested_by: profile?.id, notes: orderNotes.trim() || null }).select().single();
      if (error) throw error;
      const rows = Array.from(orderWorkers).map((wid) => ({ request_id: req.id, worker_id: wid }));
      await (supabaseAdmin.from("plan_request_workers") as any).insert(rows);
      const msg = t("plan.request_sent");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      setOrderWorkers(new Set()); setOrderNotes(""); fetchRequests();
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message || "Error");
    } finally { setSendingOrder(false); }
  };

  const toggleOW = (id: string) => {
    setOrderWorkers((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ─── LOADING ───────────────────────────────────────────
  if (loading) return <View style={[s.center, { backgroundColor: tc.background }]}><ActivityIndicator size="large" color={tc.primary} /></View>;

  // ─── WEEK SELECTOR (shared) ────────────────────────────
  const WeekSelector = () => (
    <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
      <View style={s.weekRow}>
        <TouchableOpacity onPress={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().split("T")[0]); }} style={[s.weekBtn, { borderColor: tc.border }]}>
          <Ionicons name="chevron-back" size={20} color={tc.textSecondary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[s.weekLabel, { color: tc.text }]}>{fmtWeek(weekStart)}</Text>
          <Text style={{ fontSize: 12, color: tc.textMuted, marginTop: 2 }}>{t("plan.week")}</Text>
        </View>
        <TouchableOpacity onPress={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().split("T")[0]); }} style={[s.weekBtn, { borderColor: tc.border }]}>
          <Ionicons name="chevron-forward" size={20} color={tc.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ═══════════════════════════════════════════════════════
  // DAY DETAIL VIEW
  // ═══════════════════════════════════════════════════════
  if (selectedDay) {
    const items = dayAsgn(selectedDay.dayOfWeek);
    const byProj = new Map<string, any[]>();
    items.forEach((a) => { const k = a.project?.name || a.request_id; if (!byProj.has(k)) byProj.set(k, []); byProj.get(k)!.push(a); });

    return (
      <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
        <View style={s.dayHeaderRow}>
          <TouchableOpacity onPress={() => setSelectedDay(null)} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={22} color={tc.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: tc.text, marginLeft: 0 }]}>{dayFull(selectedDay, i18n.language)}</Text>
            <Text style={{ fontSize: 14, color: tc.textSecondary }}>{selectedDay.dayNum}.{selectedDay.monthNum.toString().padStart(2, "0")}</Text>
          </View>
          {isLogistics && (
            <TouchableOpacity onPress={openAddAssign} style={[s.addBtn, { backgroundColor: tc.primary }]}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13, marginLeft: 4 }}>{t("plan.add_assignment")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicles */}
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={s.hdrRow}>
            <Text style={[s.cardLabel, { color: tc.textSecondary }]}>{t("plan.vehicles")} ({vehicles.length})</Text>
            {isLogistics && (
              <TouchableOpacity onPress={() => setShowVehicleModal(true)} style={[s.smBtn, { backgroundColor: tc.primaryLight }]}>
                <Ionicons name="add" size={14} color={tc.primary} /><Text style={{ color: tc.primary, fontWeight: "600", fontSize: 12, marginLeft: 2 }}>{t("plan.add_vehicle")}</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {vehicles.map((v) => {
              const u = vUsage(v.id, selectedDay.dayOfWeek); const full = u >= v.seats;
              return (<View key={v.id} style={[s.vChip, { backgroundColor: full ? tc.dangerLight : tc.surfaceVariant, borderColor: full ? tc.danger : tc.border }]}>
                <Ionicons name="car" size={14} color={full ? tc.danger : tc.primary} />
                <Text style={{ fontSize: 12, fontWeight: "600", marginLeft: 4, color: full ? tc.danger : tc.text }}>{v.name}</Text>
                <Text style={{ fontSize: 11, marginLeft: 4, color: full ? tc.danger : tc.textMuted }}>{u}/{v.seats}</Text>
              </View>);
            })}
          </ScrollView>
        </View>

        {/* Assignments */}
        {items.length === 0 ? (
          <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border, alignItems: "center", paddingVertical: 30 }]}>
            <Ionicons name="calendar-outline" size={48} color={tc.textMuted} />
            <Text style={{ color: tc.textMuted, marginTop: 10 }}>{t("plan.no_assignments_day")}</Text>
            {isLogistics && (
              <TouchableOpacity onPress={openAddAssign} style={[s.emptyBtn, { borderColor: tc.primary }]}>
                <Ionicons name="add" size={16} color={tc.primary} /><Text style={{ color: tc.primary, fontWeight: "600", marginLeft: 4 }}>{t("plan.add_assignment")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          Array.from(byProj.entries()).map(([pName, arr]) => (
            <View key={pName} style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Ionicons name="business" size={18} color={tc.primary} />
                <Text style={[s.projName, { color: tc.text }]}>{pName}</Text>
              </View>
              {arr[0]?.project?.location && <Text style={{ fontSize: 12, color: tc.textMuted, marginLeft: 24, marginBottom: 4 }}>{arr[0].project.location}</Text>}
              {arr.map((a: any, idx: number) => (
                <View key={a.id || idx} style={[s.aRow, { borderTopColor: tc.borderLight }, idx === 0 && { borderTopWidth: 0 }]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => isLogistics ? openEditAssign(a) : null} disabled={!isLogistics}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: tc.text }}>
                      <Ionicons name="person" size={14} color={tc.textSecondary} /> {a.worker?.full_name || a.worker_id?.slice(0, 8)}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 4, gap: 12, flexWrap: "wrap" }}>
                      {a.vehicle && <Text style={{ fontSize: 12, color: tc.textSecondary }}><Ionicons name="car" size={12} color={tc.success} /> {a.vehicle?.name || vehicles.find((v: any) => v.id === a.vehicle_id)?.name} ({a.vehicle?.license_plate || vehicles.find((v: any) => v.id === a.vehicle_id)?.license_plate})</Text>}
                      {a.departure_time && <Text style={{ fontSize: 12, color: tc.text, fontWeight: "700" }}><Ionicons name="time" size={12} color={tc.warning} /> {a.departure_time.slice(0, 5)}</Text>}
                      {(a.start_time || a.end_time) && <Text style={{ fontSize: 12, color: tc.primary, fontWeight: "600" }}><Ionicons name="calendar-outline" size={12} color={tc.primary} /> {(a.start_time || "").slice(0, 5)} - {(a.end_time || "").slice(0, 5)}</Text>}
                    </View>
                    {isLogistics && <Text style={{ fontSize: 11, color: tc.primary, marginTop: 4 }}>{t("plan.tap_to_edit")}</Text>}
                  </TouchableOpacity>
                  {isLogistics && (
                    <TouchableOpacity onPress={() => {
                      if (Platform.OS === "web") { if (window.confirm(t("plan.delete_confirm"))) deleteAssign(a.id); }
                      else Alert.alert(t("common.confirm"), t("plan.delete_confirm"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => deleteAssign(a.id) }]);
                    }} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={tc.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
        {renderAssignModal()}
        {renderVehicleModal()}
      </ScrollView>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ASSIGN MODAL (add + edit)
  // ═══════════════════════════════════════════════════════
  function renderAssignModal() {
    return (
      <Modal visible={showAssignModal} transparent animationType="fade">
        <View style={[s.mOverlay, { backgroundColor: tc.overlay }]}>
          <View style={[s.mContent, { backgroundColor: tc.card }]}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              <Text style={[s.mTitle, { color: tc.text }]}>
                {editingAssign ? t("plan.edit_assignment") : t("plan.add_assignment")}
              </Text>

              {!editingAssign && (<>
                <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.select_project")}</Text>
                {projects.map((p) => (
                  <TouchableOpacity key={p.id} style={[s.selItem, { borderColor: tc.border }, assignProject === p.id && { backgroundColor: tc.primaryLight, borderColor: tc.primary }]} onPress={() => setAssignProject(p.id)}>
                    <Ionicons name="business" size={16} color={assignProject === p.id ? tc.primary : tc.textMuted} />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: "500", color: assignProject === p.id ? tc.primary : tc.text }}>{p.name}</Text>
                    {assignProject === p.id && <Ionicons name="checkmark-circle" size={18} color={tc.primary} />}
                  </TouchableOpacity>
                ))}
              </>)}

              <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.select_vehicle")}</Text>
              {vehicles.map((v) => {
                const u = selectedDay ? vUsage(v.id, selectedDay.dayOfWeek) : 0; const full = u >= v.seats;
                return (
                  <TouchableOpacity key={v.id} disabled={full && assignVehicle !== v.id}
                    style={[s.selItem, { borderColor: tc.border }, assignVehicle === v.id && { backgroundColor: tc.primaryLight, borderColor: tc.primary }, full && assignVehicle !== v.id && { opacity: 0.4 }]}
                    onPress={() => setAssignVehicle(assignVehicle === v.id ? null : v.id)}>
                    <Ionicons name="car" size={16} color={assignVehicle === v.id ? tc.primary : tc.textMuted} />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: assignVehicle === v.id ? tc.primary : tc.text }}>{v.name} ({v.license_plate})</Text>
                    <Text style={{ fontSize: 12, color: full ? tc.danger : tc.textMuted }}>{u}/{v.seats}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.departure_time")}</Text>
              <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={assignDeparture} onChangeText={setAssignDeparture} placeholder="06:00" placeholderTextColor={tc.textMuted} maxLength={5} />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.start_time") || "Od"}</Text>
                  <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={assignStartTime} onChangeText={setAssignStartTime} placeholder="06:00" placeholderTextColor={tc.textMuted} maxLength={5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.end_time") || "Do"}</Text>
                  <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={assignEndTime} onChangeText={setAssignEndTime} placeholder="16:00" placeholderTextColor={tc.textMuted} maxLength={5} />
                </View>
              </View>

              {!editingAssign && (<>
                <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.select_workers")} ({assignWorkers.size})</Text>
                {assignProject && (projectMembers.get(assignProject) || []).length > 0 && (
                  <Text style={{ fontSize: 11, color: tc.textMuted, marginBottom: 6 }}>{t("plan.showing_project_members") || "Wyświetlani członkowie projektu"}</Text>
                )}
                {(assignProject ? getWorkersForProject(assignProject) : workers).map((w) => {
                  const hasConflict = selectedDay && assignStartTime && assignEndTime
                    ? getWorkerConflicts(w.id, selectedDay.dayOfWeek, assignStartTime, assignEndTime).length > 0
                    : false;
                  const conflictInfo = hasConflict && selectedDay
                    ? getWorkerConflicts(w.id, selectedDay.dayOfWeek, assignStartTime, assignEndTime)
                    : [];
                  return (
                    <TouchableOpacity key={w.id} style={[s.selItem, { borderColor: tc.border }, assignWorkers.has(w.id) && { backgroundColor: tc.successLight, borderColor: tc.success }, hasConflict && !assignWorkers.has(w.id) && { borderColor: tc.danger, opacity: 0.6 }]} onPress={() => toggleAW(w.id)}>
                      <Ionicons name={assignWorkers.has(w.id) ? "checkbox" : "square-outline"} size={20} color={assignWorkers.has(w.id) ? tc.success : hasConflict ? tc.danger : tc.textMuted} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ fontSize: 14, color: assignWorkers.has(w.id) ? tc.success : tc.text }}>{w.full_name || w.id.slice(0, 8)}</Text>
                        {hasConflict && (
                          <Text style={{ fontSize: 10, color: tc.danger, marginTop: 2 }}>
                            ⚠ {t("plan.busy") || "Zajęty"}: {conflictInfo.map((a: any) => `${(a.start_time || "00:00").slice(0, 5)}-${(a.end_time || "24:00").slice(0, 5)}`).join(", ")}
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: tc.textMuted }}>{w.role}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>)}
            </ScrollView>
            <View style={s.mActions}>
              <TouchableOpacity style={[s.mCancel, { borderColor: tc.border }]} onPress={() => { setShowAssignModal(false); setEditingAssign(null); }}>
                <Text style={{ color: tc.textSecondary, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.mSave, savingAssign && { opacity: 0.6 }]} onPress={saveAssignment} disabled={savingAssign}>
                {savingAssign ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════
  // VEHICLE MODAL
  // ═══════════════════════════════════════════════════════
  function renderVehicleModal() {
    return (
      <Modal visible={showVehicleModal} transparent animationType="fade">
        <View style={[s.mOverlay, { backgroundColor: tc.overlay }]}>
          <View style={[s.mContent, { backgroundColor: tc.card }]}>
            <Text style={[s.mTitle, { color: tc.text }]}>{t("plan.add_vehicle")}</Text>
            <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.vehicle_name")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={vName} onChangeText={setVName} placeholder="Mercedes Sprinter" placeholderTextColor={tc.textMuted} />
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 10 }]}>{t("plan.license_plate")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={vPlate} onChangeText={setVPlate} placeholder="AB 1234 CD" placeholderTextColor={tc.textMuted} autoCapitalize="characters" />
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 10 }]}>{t("plan.seats")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={vSeats} onChangeText={setVSeats} keyboardType="numeric" placeholder="5" placeholderTextColor={tc.textMuted} />
            <View style={s.mActions}>
              <TouchableOpacity style={[s.mCancel, { borderColor: tc.border }]} onPress={() => setShowVehicleModal(false)}><Text style={{ color: tc.textSecondary, fontWeight: "600" }}>{t("common.cancel")}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.mSave, savingV && { opacity: 0.6 }]} onPress={addVehicle} disabled={savingV}>
                {savingV ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════
  // MAIN RENDER — TABS
  // ═══════════════════════════════════════════════════════
  return (
    <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
      <View style={s.titleRow}>
        <Ionicons name="calendar" size={24} color={tc.primary} />
        <Text style={[s.title, { color: tc.text }]}>{t("plan.title")}</Text>
      </View>

      {/* Tab switcher */}
      <View style={[s.tabs, { borderColor: tc.border }]}>
        <TouchableOpacity style={[s.tab, activeTab === "plan" && { backgroundColor: tc.primary }]} onPress={() => setActiveTab("plan")}>
          <Ionicons name="calendar-outline" size={18} color={activeTab === "plan" ? "#fff" : tc.textSecondary} />
          <Text style={[s.tabText, { color: activeTab === "plan" ? "#fff" : tc.textSecondary }]}>{t("plan.tab_plan")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === "orders" && { backgroundColor: tc.primary }]} onPress={() => setActiveTab("orders")}>
          <Ionicons name="people-outline" size={18} color={activeTab === "orders" ? "#fff" : tc.textSecondary} />
          <Text style={[s.tabText, { color: activeTab === "orders" ? "#fff" : tc.textSecondary }]}>{t("plan.tab_orders")}</Text>
        </TouchableOpacity>
      </View>

      <WeekSelector />

      {/* ─── TAB: PLAN ─── */}
      {activeTab === "plan" && (<>
        <View style={s.daysGrid}>
          {weekDays.map((day) => {
            const c = dayCount(day.dayOfWeek);
            return (
              <TouchableOpacity key={day.dayOfWeek} style={[s.dayBtn, { backgroundColor: tc.card, borderColor: day.isToday ? tc.primary : tc.border, borderWidth: day.isToday ? 2 : 1 }, day.isWeekend && { backgroundColor: tc.surfaceVariant }]} onPress={() => setSelectedDay(day)}>
                <Text style={[s.dayName, { color: day.isToday ? tc.primary : day.isWeekend ? tc.textMuted : tc.text }]}>{dayShort(day, i18n.language)}</Text>
                <Text style={{ fontSize: 12, color: day.isToday ? tc.primary : tc.textSecondary }}>{day.dayNum}.{day.monthNum.toString().padStart(2, "0")}</Text>
                <View style={[s.badge, { backgroundColor: c > 0 ? tc.primary : tc.surfaceVariant }]}>
                  <Text style={[s.badgeT, c === 0 && { color: tc.textMuted }]}>{c}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Vehicles overview */}
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={s.hdrRow}>
            <Text style={[s.cardLabel, { color: tc.textSecondary }]}>{t("plan.vehicles")} ({vehicles.length})</Text>
            {isLogistics && (
              <TouchableOpacity onPress={() => setShowVehicleModal(true)} style={[s.smBtn, { backgroundColor: tc.primaryLight }]}>
                <Ionicons name="add" size={14} color={tc.primary} /><Text style={{ color: tc.primary, fontWeight: "600", fontSize: 12, marginLeft: 2 }}>{t("plan.add_vehicle")}</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {vehicles.map((v) => (
              <View key={v.id} style={[s.vChip, { backgroundColor: tc.surfaceVariant, borderColor: tc.border }]}>
                <Ionicons name="car" size={14} color={tc.primary} />
                <Text style={{ fontSize: 12, fontWeight: "600", marginLeft: 4, color: tc.text }}>{v.name}</Text>
                <Text style={{ fontSize: 11, marginLeft: 4, color: tc.textMuted }}>{v.license_plate}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </>)}

      {/* ─── TAB: ORDERS (Zapotrzebowanie) ─── */}
      {activeTab === "orders" && (<>
        {/* BL / PM: form to send order */}
        {(isBL || isLogistics) && (
          <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <Text style={[s.cardLabel, { color: tc.textSecondary, marginBottom: 8 }]}>{t("plan.new_order")}</Text>

            <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.select_project")}</Text>
            {projects.map((p) => (
              <TouchableOpacity key={p.id} style={[s.selItem, { borderColor: tc.border }, orderProject === p.id && { backgroundColor: tc.primaryLight, borderColor: tc.primary }]} onPress={() => setOrderProject(p.id)}>
                <Ionicons name="business" size={16} color={orderProject === p.id ? tc.primary : tc.textMuted} />
                <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: "500", color: orderProject === p.id ? tc.primary : tc.text }}>{p.name}</Text>
                {p.location && <Text style={{ fontSize: 11, color: tc.textMuted }}>{p.location}</Text>}
              </TouchableOpacity>
            ))}

            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.select_workers")} ({orderWorkers.size})</Text>
            {orderProject && (projectMembers.get(orderProject) || []).length > 0 && (
              <Text style={{ fontSize: 11, color: tc.textMuted, marginBottom: 6 }}>{t("plan.showing_project_members") || "Wyświetlani członkowie projektu"}</Text>
            )}
            {(orderProject ? getWorkersForProject(orderProject) : workers).map((w) => (
              <TouchableOpacity key={w.id} style={[s.selItem, { borderColor: tc.border }, orderWorkers.has(w.id) && { backgroundColor: tc.successLight, borderColor: tc.success }]} onPress={() => toggleOW(w.id)}>
                <Ionicons name={orderWorkers.has(w.id) ? "checkbox" : "square-outline"} size={20} color={orderWorkers.has(w.id) ? tc.success : tc.textMuted} />
                <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: orderWorkers.has(w.id) ? tc.success : tc.text }}>{w.full_name || w.id.slice(0, 8)}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.notes")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text, minHeight: 50, textAlignVertical: "top" }]} value={orderNotes} onChangeText={setOrderNotes} placeholder={t("plan.notes_placeholder")} placeholderTextColor={tc.textMuted} multiline />

            <TouchableOpacity style={[s.sendBtn, sendingOrder && { opacity: 0.6 }]} onPress={sendOrder} disabled={sendingOrder}>
              {sendingOrder ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 8 }}>{t("plan.send_request")}</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* List of existing orders */}
        <Text style={[s.cardLabel, { color: tc.textSecondary, marginHorizontal: 16, marginTop: 8, marginBottom: 8 }]}>{t("plan.existing_requests")} ({requests.length})</Text>
        {requests.length === 0 ? (
          <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border, alignItems: "center", paddingVertical: 20 }]}>
            <Ionicons name="document-text-outline" size={40} color={tc.textMuted} />
            <Text style={{ color: tc.textMuted, marginTop: 8 }}>{t("plan.no_requests")}</Text>
          </View>
        ) : requests.map((req: any) => (
          <View key={req.id} style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.projName, { color: tc.text }]}>{req.project?.name}</Text>
                {req.project?.location && <Text style={{ fontSize: 12, color: tc.textMuted }}>{req.project.location}</Text>}
              </View>
              <View style={[s.statusBadge, { backgroundColor: req.status === "published" ? tc.successLight : req.status === "approved" ? tc.primaryLight : tc.warningLight }]}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: req.status === "published" ? tc.success : req.status === "approved" ? tc.primary : tc.warning }}>{t(`plan.status.${req.status}`)}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: tc.textMuted, marginTop: 4 }}>{t("plan.requested_by")}: {req.requester?.full_name || "—"}</Text>
            <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }}>{(req.workers || []).length} {t("plan.workers_count")}: {(req.workers || []).map((w: any) => w.profile?.full_name || "?").join(", ")}</Text>
            {req.notes && <Text style={{ fontSize: 12, color: tc.textMuted, marginTop: 4, fontStyle: "italic" }}>{req.notes}</Text>}
          </View>
        ))}
      </>)}

      <View style={{ height: 40 }} />
      {renderVehicleModal()}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", marginLeft: 10 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6 },
  tabText: { fontSize: 14, fontWeight: "600" },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  cardLabel: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  hdrRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  weekBtn: { padding: 10, borderRadius: 10, borderWidth: 1 },
  weekLabel: { fontSize: 18, fontWeight: "700", marginHorizontal: 20 },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginBottom: 12, gap: 6 },
  dayBtn: { width: "13%", minWidth: 44, flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, alignItems: "center" },
  dayName: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  badge: { marginTop: 6, borderRadius: 10, minWidth: 22, height: 22, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  badgeT: { fontSize: 11, fontWeight: "700", color: "#fff" },
  dayHeaderRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  addBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  smBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  vChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginRight: 6 },
  emptyBtn: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  projName: { fontSize: 15, fontWeight: "600", marginLeft: 6 },
  aRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, marginTop: 14 },
  mOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  mContent: { width: "100%", maxWidth: 440, borderRadius: 16, padding: 20 },
  mTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  iLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  mInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  selItem: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  mActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  mCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  mSave: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb" },
});
