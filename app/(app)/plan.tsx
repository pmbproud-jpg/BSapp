import { usePermissions } from "@/src/hooks/usePermissions";
import { usePlanData } from "@/src/hooks/usePlanData";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import ResourceCalendar from "./components/ResourceCalendar";

function getNextMonday(): string {
  const d = new Date(); const day = d.getDay();
  // If today is Monday (1), use today; otherwise go back to this week's Monday
  // Sunday (0) → go forward 1 day to next Monday
  if (day === 0) d.setDate(d.getDate() + 1);
  else if (day > 1) d.setDate(d.getDate() - (day - 1));
  // day === 1 (Monday) → keep as is
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
  const { sendNotification } = useNotifications();
  const perms = usePermissions();
  const canEditPlan = perms.canEditPlan;
  const isBL = perms.isBL || perms.isPM;

  // Tabs: "plan" = weekly plan, "orders" = BL orders
  const [activeTab, setActiveTab] = useState<"plan" | "orders" | "calendar">(isBL ? "orders" : "plan");
  const [weekStart, setWeekStart] = useState(getNextMonday());

  const goWeek = useCallback((dir: -1 | 1) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir * 7);
      return d.toISOString().split("T")[0];
    });
  }, []);

  const swipeRef = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 30 && Math.abs(gs.dy) < 40,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 50) setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; });
      else if (gs.dx < -50) setWeekStart((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; });
    },
  })).current;

  // ─── Plan Data Hook ───
  const plan = usePlanData(weekStart, profile?.id ?? undefined, sendNotification, t, i18n.language, dayFull);
  const {
    vehicles, projects, workers, assignments, requests, absences, loading, projectMembers,
    selectedDay, setSelectedDay,
    fetchAll, getWorkerAbsence, dayCount, dayAsgn, vUsage,
    getWorkersForProject, getRequestedWorkerIds, getWorkerConflicts, timeToMinutes,
    vehiclesCollapsed, setVehiclesCollapsed,
    showVehicleModal, setShowVehicleModal,
    vName, setVName, vPlate, setVPlate, vSeats, setVSeats,
    savingV, editingVehicleId, setEditingVehicleId,
    openAddVehicle, openEditVehicle, saveVehicle, deleteVehicle,
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
    orderProject, setOrderProject,
    orderWorkers, orderVehicles,
    orderNotes, setOrderNotes,
    sendingOrder, orderShowForm, setOrderShowForm,
    orderEditingId,
    orderShowProjectPicker, setOrderShowProjectPicker,
    orderShowWorkerPicker, setOrderShowWorkerPicker,
    orderShowVehiclePicker, setOrderShowVehiclePicker,
    saveOrder, deleteOrder, openEditOrder, resetOrderForm, toggleOW, toggleOV,
    fetchAssignments, fetchRequests, fetchVehicles,
  } = plan;

  const weekDays = getWeekDays(weekStart);

  useFocusEffect(useCallback(() => { fetchAll(); }, [weekStart]));

  // ─── LOADING ───────────────────────────────────────────
  if (loading) return <View style={[s.center, { backgroundColor: tc.background }]}><ActivityIndicator size="large" color={tc.primary} /></View>;

  // ─── WEEK SELECTOR (shared) ────────────────────────────
  const WeekSelector = () => (
    <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]} {...swipeRef.panHandlers}>
      <View style={s.weekRow}>
        <TouchableOpacity onPress={() => goWeek(-1)} style={[s.weekBtn, { borderColor: tc.border }]}>
          <Ionicons name="chevron-back" size={20} color={tc.textSecondary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[s.weekLabel, { color: tc.text }]}>{fmtWeek(weekStart)}</Text>
          <Text style={{ fontSize: 12, color: tc.textMuted, marginTop: 2 }}>{t("plan.week")}</Text>
        </View>
        <TouchableOpacity onPress={() => goWeek(1)} style={[s.weekBtn, { borderColor: tc.border }]}>
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
    const dayDateStr = selectedDay.date;
    const dayAbsences = absences.filter((a: any) => dayDateStr >= a.date_from && dayDateStr <= a.date_to);
    const absTypeLabels: Record<string, string> = { vacation: t("plan.abs_vacation") || "Urlaub", sick_leave: t("plan.abs_sick") || "Krankmeldung", special_leave: t("plan.abs_special") || "Sonderurlaub", training: t("plan.abs_training") || "Schulung", unexcused: t("plan.abs_unexcused") || "Unentschuldigt" };
    const absTypeColors: Record<string, string> = { vacation: "#ef4444", sick_leave: "#f59e0b", special_leave: "#8b5cf6", training: "#3b82f6", unexcused: "#64748b" };

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
          {canEditPlan && (
            <TouchableOpacity onPress={openAddAssign} style={[s.addBtn, { backgroundColor: tc.primary }]}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13, marginLeft: 4 }}>{t("plan.add_assignment")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicles (collapsible) */}
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <TouchableOpacity style={s.hdrRow} onPress={() => setVehiclesCollapsed(!vehiclesCollapsed)} activeOpacity={0.7}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name={vehiclesCollapsed ? "chevron-forward" : "chevron-down"} size={16} color={tc.textSecondary} />
              <Text style={[s.cardLabel, { color: tc.textSecondary }]}>{t("plan.vehicles")} ({vehicles.length})</Text>
            </View>
            {canEditPlan && (
              <TouchableOpacity onPress={openAddVehicle} style={[s.smBtn, { backgroundColor: tc.primaryLight }]}>
                <Ionicons name="add" size={14} color={tc.primary} /><Text style={{ color: tc.primary, fontWeight: "600", fontSize: 12, marginLeft: 2 }}>{t("plan.add_vehicle")}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {!vehiclesCollapsed && (
            <View style={{ marginTop: 6, gap: 6 }}>
              {vehicles.map((v) => {
                const u = vUsage(v.id, selectedDay.dayOfWeek); const full = u >= v.seats;
                return (
                  <View key={v.id} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: full ? tc.dangerLight : tc.surfaceVariant, borderColor: full ? tc.danger : tc.border }}>
                    <Ionicons name="car" size={18} color={full ? tc.danger : tc.primary} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: full ? tc.danger : tc.text }}>{v.name}</Text>
                      <Text style={{ fontSize: 12, color: full ? tc.danger : tc.textMuted }}>{v.license_plate}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: full ? tc.danger : tc.primary, marginRight: canEditPlan ? 8 : 0 }]}>
                      <Text style={s.badgeT}>{u}/{v.seats}</Text>
                    </View>
                    {canEditPlan && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={() => openEditVehicle(v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="create-outline" size={18} color={tc.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { if (Platform.OS === "web") { if (window.confirm(t("plan.delete_vehicle_confirm") || `${v.name} löschen?`)) deleteVehicle(v.id); } else Alert.alert(t("common.confirm"), t("plan.delete_vehicle_confirm") || `${v.name} löschen?`, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => deleteVehicle(v.id) }]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={18} color={tc.danger} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Absences for this day */}
        {dayAbsences.length > 0 && (
          <View style={[s.card, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#ef4444" }}>
                {t("plan.absences_today") || "Abwesend"} ({dayAbsences.length})
              </Text>
            </View>
            {dayAbsences.map((a: any) => (
              <View key={a.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#fecaca", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: absTypeColors[a.type] || "#ef4444" }} />
                <Ionicons name="person" size={14} color="#ef4444" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#dc2626", flex: 1 }}>
                  {a.user?.full_name || "?"}
                </Text>
                <View style={{ backgroundColor: (absTypeColors[a.type] || "#ef4444") + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: absTypeColors[a.type] || "#ef4444" }}>
                    {absTypeLabels[a.type] || a.type}
                  </Text>
                </View>
                {a.status === "pending" && (
                  <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: "#f59e0b" }}>{t("plan.abs_pending") || "Ausstehend"}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Assignments */}
        {items.length === 0 ? (
          <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border, alignItems: "center", paddingVertical: 30 }]}>
            <Ionicons name="calendar-outline" size={48} color={tc.textMuted} />
            <Text style={{ color: tc.textMuted, marginTop: 10 }}>{t("plan.no_assignments_day")}</Text>
            {canEditPlan && (
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
              {arr[0]?.project?.location ? <Text style={{ fontSize: 12, color: tc.textMuted, marginLeft: 24, marginBottom: 4 }}>{arr[0].project.location}</Text> : null}
              {arr.map((a: any, idx: number) => (
                <View key={a.id || idx} style={[s.aRow, { borderTopColor: tc.borderLight }, idx === 0 && { borderTopWidth: 0 }]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => canEditPlan ? openEditAssign(a) : null} disabled={!canEditPlan}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: tc.text }}>
                      <Ionicons name="person" size={14} color={tc.textSecondary} /> {a.worker?.full_name || a.worker_id?.slice(0, 8)}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 4, gap: 12, flexWrap: "wrap" }}>
                      {(a.vehicles && a.vehicles.length > 0) ? a.vehicles.map((veh: any, vi: number) => (
                        <Text key={veh.id || vi} style={{ fontSize: 12, color: tc.textSecondary }}><Ionicons name="car" size={12} color={tc.success} /> {veh.name} ({veh.license_plate})</Text>
                      )) : a.vehicle ? <Text style={{ fontSize: 12, color: tc.textSecondary }}><Ionicons name="car" size={12} color={tc.success} /> {a.vehicle.name} ({a.vehicle.license_plate})</Text> : null}
                      {a.departure_time ? <Text style={{ fontSize: 12, color: tc.text, fontWeight: "700" }}><Ionicons name="time" size={12} color={tc.warning} /> {a.departure_time.slice(0, 5)}</Text> : null}
                      {(a.start_time || a.end_time) ? <Text style={{ fontSize: 12, color: tc.primary, fontWeight: "600" }}><Ionicons name="calendar-outline" size={12} color={tc.primary} /> {(a.start_time || "").slice(0, 5)} - {(a.end_time || "").slice(0, 5)}</Text> : null}
                    </View>
                    {canEditPlan && <Text style={{ fontSize: 11, color: tc.primary, marginTop: 4 }}>{t("plan.tap_to_edit")}</Text>}
                  </TouchableOpacity>
                  {canEditPlan && (
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
    const selectedProjectName = projects.find((p) => p.id === assignProject)?.name;
    const selectedVehicleNames = Array.from(assignVehicles).map((vid) => vehicles.find((v) => v.id === vid)).filter(Boolean);
    const requestedIds = getRequestedWorkerIds(assignProject);
    const allWorkersList = assignProject ? getWorkersForProject(assignProject) : workers;
    // Sortuj: najpierw z zapotrzebowania, potem reszta
    const sortedWorkers = [...allWorkersList].sort((a, b) => {
      const aReq = requestedIds.has(a.id) ? 0 : 1;
      const bReq = requestedIds.has(b.id) ? 0 : 1;
      if (aReq !== bReq) return aReq - bReq;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
    const toggleAV = (id: string) => {
      setAssignVehicles((p) => {
        if (p.has(id)) return new Set(); // deselect → no vehicle
        return new Set([id]); // select → replace with single vehicle
      });
    };

    return (
      <Modal visible={showAssignModal} transparent animationType="fade">
        <View style={[s.mOverlay, { backgroundColor: tc.overlay }]}>
          <View style={[s.mContent, { backgroundColor: tc.card }]}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 550 }}>
              <Text style={[s.mTitle, { color: tc.text }]}>
                {editingAssign ? t("plan.edit_assignment") : t("plan.add_assignment")}
              </Text>

              {/* ── PROJEKT (collapsible) ── */}
              <View style={{ marginBottom: 10 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: assignProject ? tc.primary : tc.border, backgroundColor: assignProject ? tc.primaryLight : tc.surfaceVariant }}
                  onPress={() => { setAssignShowProjects(!assignShowProjects); setAssignShowVehicles(false); setAssignShowWorkers(false); }}
                >
                  <Ionicons name="business" size={18} color={assignProject ? tc.primary : tc.textMuted} />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: "600", color: assignProject ? tc.primary : tc.textSecondary }}>
                    {assignProject ? selectedProjectName : t("plan.select_project")}
                  </Text>
                  <Ionicons name={assignShowProjects ? "chevron-up" : "chevron-down"} size={18} color={tc.textMuted} />
                </TouchableOpacity>
                {assignShowProjects && (
                  <View style={{ marginTop: 4, gap: 4, maxHeight: 200 }}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      {projects.map((p) => (
                        <TouchableOpacity key={p.id} style={[s.selItem, { borderColor: tc.border }, assignProject === p.id && { backgroundColor: tc.primaryLight, borderColor: tc.primary }]}
                          onPress={() => { setAssignProject(p.id); setAssignShowProjects(false); setAssignWorkers((prev) => { const merged = new Set(prev); getRequestedWorkerIds(p.id).forEach((id) => merged.add(id)); return merged; }); }}>
                          <Ionicons name="business" size={16} color={assignProject === p.id ? tc.primary : tc.textMuted} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: "500", color: assignProject === p.id ? tc.primary : tc.text }}>{p.name}</Text>
                            {p.location ? <Text style={{ fontSize: 11, color: tc.textMuted }}>{p.location}</Text> : null}
                          </View>
                          {assignProject === p.id && <Ionicons name="checkmark-circle" size={18} color={tc.primary} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* ── POJAZDY (multi-select, collapsible) ── */}
              <View style={{ marginBottom: 10 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: assignVehicles.size > 0 ? tc.primary : tc.border, backgroundColor: assignVehicles.size > 0 ? tc.primaryLight : tc.surfaceVariant }}
                  onPress={() => { setAssignShowVehicles(!assignShowVehicles); setAssignShowProjects(false); setAssignShowWorkers(false); }}
                >
                  <Ionicons name="car" size={18} color={assignVehicles.size > 0 ? tc.primary : tc.textMuted} />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: "600", color: assignVehicles.size > 0 ? tc.primary : tc.textSecondary }}>
                    {assignVehicles.size > 0
                      ? selectedVehicleNames.map((v: any) => `${v.name}`).join(", ")
                      : t("plan.select_vehicle")} ({assignVehicles.size})
                  </Text>
                  <Ionicons name={assignShowVehicles ? "chevron-up" : "chevron-down"} size={18} color={tc.textMuted} />
                </TouchableOpacity>
                {assignShowVehicles && (
                  <View style={{ marginTop: 4, gap: 4 }}>
                    {vehicles.map((v) => {
                      const u = selectedDay ? vUsage(v.id, selectedDay.dayOfWeek) : 0; const full = u >= v.seats;
                      const isSelected = assignVehicles.has(v.id);
                      return (
                        <TouchableOpacity key={v.id} disabled={full && !isSelected}
                          style={[s.selItem, { borderColor: tc.border }, isSelected && { backgroundColor: tc.primaryLight, borderColor: tc.primary }, full && !isSelected && { opacity: 0.4 }]}
                          onPress={() => toggleAV(v.id)}>
                          <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={20} color={isSelected ? tc.primary : tc.textMuted} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={{ fontSize: 14, color: isSelected ? tc.primary : tc.text }}>{v.name} ({v.license_plate})</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: full ? tc.danger : tc.textMuted }}>{u}/{v.seats}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* ── CZASY ── */}
              <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.departure_time")}</Text>
              <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={assignDeparture} onChangeText={setAssignDeparture} placeholder="06:00" placeholderTextColor={tc.textMuted} maxLength={5} />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.start_time", "Von")}</Text>
                  <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={assignStartTime} onChangeText={setAssignStartTime} placeholder="06:00" placeholderTextColor={tc.textMuted} maxLength={5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.end_time", "Bis")}</Text>
                  <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={assignEndTime} onChangeText={setAssignEndTime} placeholder="16:00" placeholderTextColor={tc.textMuted} maxLength={5} />
                </View>
              </View>

              {/* ── PRACOWNICY (collapsible) ── */}
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: assignWorkers.size > 0 ? tc.success : tc.border, backgroundColor: assignWorkers.size > 0 ? tc.successLight : tc.surfaceVariant }}
                  onPress={() => { setAssignShowWorkers(!assignShowWorkers); setAssignShowProjects(false); setAssignShowVehicles(false); }}
                >
                  <Ionicons name="people" size={18} color={assignWorkers.size > 0 ? tc.success : tc.textMuted} />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: "600", color: assignWorkers.size > 0 ? tc.success : tc.textSecondary }}>
                    {t("plan.select_workers")} ({assignWorkers.size})
                  </Text>
                  <Ionicons name={assignShowWorkers ? "chevron-up" : "chevron-down"} size={18} color={tc.textMuted} />
                </TouchableOpacity>
                {assignShowWorkers && (
                  <View style={{ marginTop: 4, gap: 4 }}>
                    {!assignProject && (
                      <Text style={{ fontSize: 11, color: tc.warning, marginBottom: 4, fontStyle: "italic" }}>{t("plan.select_project_first", "Najpierw wybierz budowę")}</Text>
                    )}
                    {requestedIds.size > 0 && (
                      <Text style={{ fontSize: 11, color: tc.success, fontWeight: "600", marginBottom: 4 }}>
                        ★ {t("plan.from_request", "Z zapotrzebowania")}: {requestedIds.size}
                      </Text>
                    )}
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }}>
                      {sortedWorkers.map((w) => {
                        const isRequested = requestedIds.has(w.id);
                        const hasConflict = selectedDay && assignStartTime && assignEndTime
                          ? getWorkerConflicts(w.id, selectedDay.dayOfWeek, assignStartTime, assignEndTime, editingAssign?.id).length > 0
                          : false;
                        const conflictInfo = hasConflict && selectedDay
                          ? getWorkerConflicts(w.id, selectedDay.dayOfWeek, assignStartTime, assignEndTime, editingAssign?.id)
                          : [];
                        return (
                          <TouchableOpacity key={w.id} style={[s.selItem, { borderColor: tc.border }, assignWorkers.has(w.id) && { backgroundColor: tc.successLight, borderColor: tc.success }, isRequested && !assignWorkers.has(w.id) && { borderColor: "#10b981", borderWidth: 2 }, hasConflict && !assignWorkers.has(w.id) && { borderColor: tc.danger, opacity: 0.6 }]} onPress={() => toggleAW(w.id)}>
                            <Ionicons name={assignWorkers.has(w.id) ? "checkbox" : "square-outline"} size={20} color={assignWorkers.has(w.id) ? tc.success : hasConflict ? tc.danger : tc.textMuted} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 14, color: assignWorkers.has(w.id) ? tc.success : tc.text }}>{w.full_name || w.id.slice(0, 8)}</Text>
                                {isRequested && (
                                  <View style={{ backgroundColor: "#10b981", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 9, color: "#fff", fontWeight: "700" }}>★</Text>
                                  </View>
                                )}
                              </View>
                              {hasConflict && (
                                <Text style={{ fontSize: 10, color: tc.danger, marginTop: 2 }}>
                                  ⚠ {t("plan.busy", "Beschäftigt")}: {conflictInfo.map((a: any) => `${(a.start_time || "00:00").slice(0, 5)}-${(a.end_time || "24:00").slice(0, 5)}`).join(", ")}
                                </Text>
                              )}
                            </View>
                            <Text style={{ fontSize: 11, color: tc.textMuted }}>{w.role}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
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
            <Text style={[s.mTitle, { color: tc.text }]}>{editingVehicleId ? (t("plan.edit_vehicle") || "Fahrzeug bearbeiten") : t("plan.add_vehicle")}</Text>
            <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.vehicle_name")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={vName} onChangeText={setVName} placeholder="Mercedes Sprinter" placeholderTextColor={tc.textMuted} />
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 10 }]}>{t("plan.license_plate")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={vPlate} onChangeText={setVPlate} placeholder="AB 1234 CD" placeholderTextColor={tc.textMuted} autoCapitalize="characters" />
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 10 }]}>{t("plan.seats")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text }]} value={vSeats} onChangeText={setVSeats} keyboardType="numeric" placeholder="5" placeholderTextColor={tc.textMuted} />
            <View style={s.mActions}>
              <TouchableOpacity style={[s.mCancel, { borderColor: tc.border }]} onPress={() => { setShowVehicleModal(false); setEditingVehicleId(null); }}><Text style={{ color: tc.textSecondary, fontWeight: "600" }}>{t("common.cancel")}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.mSave, savingV && { opacity: 0.6 }]} onPress={saveVehicle} disabled={savingV}>
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
  const headerContent = (
    <>
      <View style={s.titleRow}>
        <Ionicons name="calendar" size={24} color={tc.primary} />
        <Text style={[s.title, { color: tc.text }]}>{t("plan.title")}</Text>
      </View>

      {/* Tab switcher */}
      <View style={[s.tabs, { borderColor: tc.border }]}>
        <TouchableOpacity style={[s.tab, activeTab === "plan" && { backgroundColor: tc.primary }]} onPress={() => setActiveTab("plan")}>
          <Ionicons name="calendar-outline" size={18} color={activeTab === "plan" ? "#fff" : tc.textSecondary} />
          <Text style={[s.tabText, { color: activeTab === "plan" ? "#fff" : tc.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t("plan.tab_plan")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === "orders" && { backgroundColor: tc.primary }]} onPress={() => setActiveTab("orders")}>
          <Ionicons name="people-outline" size={18} color={activeTab === "orders" ? "#fff" : tc.textSecondary} />
          <Text style={[s.tabText, { color: activeTab === "orders" ? "#fff" : tc.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t("plan.tab_orders")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === "calendar" && { backgroundColor: tc.primary }]} onPress={() => setActiveTab("calendar")}>
          <Ionicons name="grid-outline" size={18} color={activeTab === "calendar" ? "#fff" : tc.textSecondary} />
          <Text style={[s.tabText, { color: activeTab === "calendar" ? "#fff" : tc.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t("plan.tab_calendar", "Kalender")}</Text>
        </TouchableOpacity>
      </View>

      <WeekSelector />
    </>
  );

  // Calendar tab: wrap in ScrollView so the whole screen scrolls on mobile
  if (activeTab === "calendar") {
    return (
      <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
        {headerContent}
        <ResourceCalendar
          weekDays={weekDays}
          assignments={assignments}
          projects={projects}
          vehicles={vehicles}
          workers={workers}
          absences={absences}
          weekStart={weekStart}
          lang={i18n.language}
          onSwipeWeek={goWeek}
        />
        {renderVehicleModal()}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[s.container, { backgroundColor: tc.background }]}>
      {headerContent}

      {/* ─── TAB: PLAN ─── */}
      {activeTab === "plan" && (<>
        <View style={s.daysGrid} {...swipeRef.panHandlers}>
          {weekDays.map((day) => {
            const c = dayCount(day.dayOfWeek);
            const dayAbsCount = absences.filter((a: any) => day.date >= a.date_from && day.date <= a.date_to).length;
            return (
              <TouchableOpacity key={day.dayOfWeek} style={[s.dayBtn, { backgroundColor: tc.card, borderColor: day.isToday ? tc.primary : tc.border, borderWidth: day.isToday ? 2 : 1 }, day.isWeekend && { backgroundColor: tc.surfaceVariant }]} onPress={() => setSelectedDay(day)}>
                <Text style={[s.dayName, { color: day.isToday ? tc.primary : day.isWeekend ? tc.textMuted : tc.text }]}>{dayShort(day, i18n.language)}</Text>
                <Text style={{ fontSize: 10, color: day.isToday ? tc.primary : tc.textSecondary }}>{day.dayNum}.{day.monthNum.toString().padStart(2, "0")}</Text>
                <View style={[s.badge, { backgroundColor: c > 0 ? tc.primary : tc.surfaceVariant }]}>
                  <Text style={[s.badgeT, c === 0 && { color: tc.textMuted }]}>{c}</Text>
                </View>
                {dayAbsCount > 0 && (
                  <View style={{ backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginTop: 3 }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>{dayAbsCount} ✗</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Vehicles overview (collapsible) */}
        <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <TouchableOpacity style={s.hdrRow} onPress={() => setVehiclesCollapsed(!vehiclesCollapsed)} activeOpacity={0.7}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name={vehiclesCollapsed ? "chevron-forward" : "chevron-down"} size={16} color={tc.textSecondary} />
              <Text style={[s.cardLabel, { color: tc.textSecondary }]}>{t("plan.vehicles")} ({vehicles.length})</Text>
            </View>
            {canEditPlan && (
              <TouchableOpacity onPress={openAddVehicle} style={[s.smBtn, { backgroundColor: tc.primaryLight }]}>
                <Ionicons name="add" size={14} color={tc.primary} /><Text style={{ color: tc.primary, fontWeight: "600", fontSize: 12, marginLeft: 2 }}>{t("plan.add_vehicle")}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {!vehiclesCollapsed && (
            <View style={{ marginTop: 6, gap: 6 }}>
              {vehicles.map((v) => (
                <View key={v.id} style={{ flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: tc.surfaceVariant, borderColor: tc.border }}>
                  <Ionicons name="car" size={18} color={tc.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: tc.text }}>{v.name}</Text>
                    <Text style={{ fontSize: 12, color: tc.textMuted }}>{v.license_plate}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: tc.textMuted, marginRight: canEditPlan ? 8 : 0 }}>{v.seats} Plätze</Text>
                  {canEditPlan && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity onPress={() => openEditVehicle(v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="create-outline" size={18} color={tc.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { if (Platform.OS === "web") { if (window.confirm(t("plan.delete_vehicle_confirm") || `${v.name} löschen?`)) deleteVehicle(v.id); } else Alert.alert(t("common.confirm"), t("plan.delete_vehicle_confirm") || `${v.name} löschen?`, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => deleteVehicle(v.id) }]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={18} color={tc.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </>)}

      {/* ─── TAB: ORDERS (Zapotrzebowanie) ─── */}
      {activeTab === "orders" && (<>
        {/* Add button */}
        {(isBL || canEditPlan) && !orderShowForm && (
          <TouchableOpacity
            style={[s.sendBtn, { marginHorizontal: 16, marginBottom: 12 }]}
            onPress={() => { resetOrderForm(); setOrderShowForm(true); }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 8 }}>{t("plan.new_order")}</Text>
          </TouchableOpacity>
        )}

        {/* Add/Edit form (inline) */}
        {orderShowForm && (
          <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.primary, borderWidth: 2 }]}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: tc.text, marginBottom: 10 }}>
              {orderEditingId ? (t("common.edit") || "Bearbeiten") : t("plan.new_order")}
            </Text>

            {/* Project picker (dropdown) */}
            <Text style={[s.iLabel, { color: tc.textSecondary }]}>{t("plan.select_project")}</Text>
            <TouchableOpacity
              style={[s.selItem, { borderColor: tc.border, justifyContent: "space-between" }]}
              onPress={() => setOrderShowProjectPicker(!orderShowProjectPicker)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="business" size={16} color={orderProject ? tc.primary : tc.textMuted} />
                <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: orderProject ? tc.text : tc.textMuted }} numberOfLines={1}>
                  {orderProject ? (projects.find((p: any) => p.id === orderProject)?.name || "—") : (t("plan.select_project") || "Baustelle auswählen...")}
                </Text>
              </View>
              <Ionicons name={orderShowProjectPicker ? "chevron-up" : "chevron-down"} size={16} color={tc.textSecondary} />
            </TouchableOpacity>
            {orderShowProjectPicker && (
              <View style={{ maxHeight: 200, borderWidth: 1, borderColor: tc.border, borderRadius: 8, marginBottom: 8, marginTop: 4, overflow: "hidden" }}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  {projects.map((p: any) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.selItem, { borderColor: tc.border, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0 }, orderProject === p.id && { backgroundColor: tc.primaryLight }]}
                      onPress={() => { setOrderProject(p.id); setOrderShowProjectPicker(false); }}
                    >
                      <Ionicons name="business" size={16} color={orderProject === p.id ? tc.primary : tc.textMuted} />
                      <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: orderProject === p.id ? "700" : "400", color: orderProject === p.id ? tc.primary : tc.text }}>{p.name}</Text>
                      {p.location ? <Text style={{ fontSize: 11, color: tc.textMuted }}>{p.location}</Text> : null}
                      {orderProject === p.id ? <Ionicons name="checkmark-circle" size={16} color={tc.primary} /> : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Workers picker (dropdown multi-select) */}
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.select_workers")} ({orderWorkers.size})</Text>
            <TouchableOpacity
              style={[s.selItem, { borderColor: tc.border, justifyContent: "space-between" }]}
              onPress={() => setOrderShowWorkerPicker(!orderShowWorkerPicker)}
            >
              <Text style={{ flex: 1, fontSize: 14, color: orderWorkers.size > 0 ? tc.text : tc.textMuted }} numberOfLines={2}>
                {orderWorkers.size > 0
                  ? Array.from(orderWorkers).map((id) => workers.find((w: any) => w.id === id)?.full_name || "?").join(", ")
                  : (t("plan.select_workers") || "Mitarbeiter auswählen...")}
              </Text>
              <Ionicons name={orderShowWorkerPicker ? "chevron-up" : "chevron-down"} size={16} color={tc.textSecondary} />
            </TouchableOpacity>
            {orderShowWorkerPicker && (
              <View style={{ maxHeight: 220, borderWidth: 1, borderColor: tc.border, borderRadius: 8, marginBottom: 8, marginTop: 4, overflow: "hidden" }}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                  {(orderProject ? getWorkersForProject(orderProject) : workers).map((w: any) => (
                    <TouchableOpacity
                      key={w.id}
                      style={[s.selItem, { borderColor: tc.border, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0 }, orderWorkers.has(w.id) && { backgroundColor: tc.successLight }]}
                      onPress={() => toggleOW(w.id)}
                    >
                      <Ionicons name={orderWorkers.has(w.id) ? "checkbox" : "square-outline"} size={20} color={orderWorkers.has(w.id) ? tc.success : tc.textMuted} />
                      <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: orderWorkers.has(w.id) ? tc.success : tc.text }}>{w.full_name || w.id.slice(0, 8)}</Text>
                      <Text style={{ fontSize: 11, color: tc.textMuted }}>{w.role}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Vehicle picker (dropdown multi-select) */}
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.select_vehicle")} ({orderVehicles.size})</Text>
            <TouchableOpacity
              style={[s.selItem, { borderColor: tc.border, justifyContent: "space-between" }]}
              onPress={() => { setOrderShowVehiclePicker(!orderShowVehiclePicker); setOrderShowProjectPicker(false); setOrderShowWorkerPicker(false); }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="car" size={16} color={orderVehicles.size > 0 ? tc.primary : tc.textMuted} />
                <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: orderVehicles.size > 0 ? tc.text : tc.textMuted }} numberOfLines={2}>
                  {orderVehicles.size > 0
                    ? Array.from(orderVehicles).map((id) => vehicles.find((v) => v.id === id)).filter(Boolean).map((v: any) => `${v.name} (${v.license_plate})`).join(", ")
                    : (t("plan.select_vehicle") || "Fahrzeug auswählen...")}
                </Text>
              </View>
              <Ionicons name={orderShowVehiclePicker ? "chevron-up" : "chevron-down"} size={16} color={tc.textSecondary} />
            </TouchableOpacity>
            {orderShowVehiclePicker && (
              <View style={{ maxHeight: 200, borderWidth: 1, borderColor: tc.border, borderRadius: 8, marginBottom: 8, marginTop: 4, overflow: "hidden" }}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  {vehicles.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.selItem, { borderColor: tc.border, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0 }, orderVehicles.has(v.id) && { backgroundColor: tc.primaryLight }]}
                      onPress={() => toggleOV(v.id)}
                    >
                      <Ionicons name={orderVehicles.has(v.id) ? "checkbox" : "square-outline"} size={20} color={orderVehicles.has(v.id) ? tc.primary : tc.textMuted} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ fontSize: 14, color: orderVehicles.has(v.id) ? tc.primary : tc.text }}>{v.name}</Text>
                        <Text style={{ fontSize: 11, color: tc.textMuted }}>{v.license_plate} · {v.seats} {t("plan.seats")}</Text>
                      </View>
                      {orderVehicles.has(v.id) && <Ionicons name="checkmark-circle" size={18} color={tc.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Notes */}
            <Text style={[s.iLabel, { color: tc.textSecondary, marginTop: 12 }]}>{t("plan.notes")}</Text>
            <TextInput style={[s.mInput, { backgroundColor: tc.inputBg, borderColor: tc.border, color: tc.text, minHeight: 50, textAlignVertical: "top" }]} value={orderNotes} onChangeText={setOrderNotes} placeholder={t("plan.notes_placeholder")} placeholderTextColor={tc.textMuted} multiline />

            {/* Buttons row */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              {orderEditingId ? (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: tc.dangerLight || "#fef2f2", borderWidth: 1, borderColor: tc.danger || "#fca5a5" }}
                  onPress={() => { if (orderEditingId) deleteOrder(orderEditingId); }}
                >
                  <Ionicons name="trash-outline" size={14} color={tc.danger || "#ef4444"} />
                  <Text style={{ color: tc.danger || "#ef4444", fontWeight: "600", fontSize: 13 }}>{t("common.delete") || "Löschen"}</Text>
                </TouchableOpacity>
              ) : <View />}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[s.mCancel, { borderColor: tc.border }]} onPress={resetOrderForm}>
                  <Text style={{ color: tc.textSecondary, fontWeight: "600" }}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.mSave, sendingOrder && { opacity: 0.6 }]} onPress={saveOrder} disabled={sendingOrder}>
                  {sendingOrder ? <ActivityIndicator color="#fff" size="small" /> : (
                    <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", marginLeft: 4 }}>{t("common.save")}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Existing requests table */}
        <Text style={[s.cardLabel, { color: tc.textSecondary, marginHorizontal: 16, marginTop: 8, marginBottom: 8 }]}>{t("plan.existing_requests")} ({requests.length})</Text>
        {requests.length === 0 ? (
          <View style={[s.card, { backgroundColor: tc.card, borderColor: tc.border, alignItems: "center", paddingVertical: 20 }]}>
            <Ionicons name="document-text-outline" size={40} color={tc.textMuted} />
            <Text style={{ color: tc.textMuted, marginTop: 8 }}>{t("plan.no_requests")}</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginHorizontal: 16 }}>
            {requests.map((req: any) => (
              <View key={req.id} style={{ backgroundColor: tc.card, borderRadius: 12, borderWidth: 1, borderColor: tc.border, padding: 14 }}>
                {/* Header: project name + actions */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: tc.text }} numberOfLines={2}>{req.project?.name || "—"}</Text>
                    {req.project?.location ? <Text style={{ fontSize: 11, color: tc.textMuted, marginTop: 2 }} numberOfLines={1}>{req.project.location}</Text> : null}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {req.created_at ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 11, color: tc.textSecondary }}>{new Date(req.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}</Text>
                        <Text style={{ fontSize: 10, color: tc.textMuted }}>{new Date(req.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity onPress={() => openEditOrder(req)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="create-outline" size={20} color={tc.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteOrder(req.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={tc.danger || "#ef4444"} />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Workers */}
                {(req.workers || []).length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(req.workers || []).map((w: any, wi: number) => (
                      <View key={wi} style={{ flexDirection: "row", alignItems: "center", backgroundColor: tc.surfaceVariant || "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 }}>
                        <Ionicons name="person" size={12} color={tc.textSecondary} />
                        <Text style={{ fontSize: 12, color: tc.text }}>{w.profile?.full_name || "?"}</Text>
                      </View>
                    ))}
                  </View>
                ) : <Text style={{ fontSize: 12, color: tc.textMuted }}>—</Text>}
                {/* Vehicles */}
                {Array.isArray(req.vehicle_ids) && req.vehicle_ids.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {req.vehicle_ids.map((vid: string, vi: number) => {
                      const veh = vehicles.find((v) => v.id === vid);
                      return veh ? (
                        <View key={vi} style={{ flexDirection: "row", alignItems: "center", backgroundColor: tc.primaryLight || "#eff6ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 }}>
                          <Ionicons name="car" size={12} color={tc.primary} />
                          <Text style={{ fontSize: 12, color: tc.primary }}>{veh.name} ({veh.license_plate})</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                )}
                {req.notes ? <Text style={{ fontSize: 11, color: tc.textMuted, fontStyle: "italic", marginTop: 6 }}>{req.notes}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </>)}

      <View style={{ height: 40 }} />
      {renderVehicleModal()}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: "700", marginLeft: 8 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 4, gap: 5 },
  tabText: { fontSize: 13, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  cardLabel: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  hdrRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  weekBtn: { padding: 10, borderRadius: 10, borderWidth: 1 },
  weekLabel: { fontSize: 18, fontWeight: "700", marginHorizontal: 20 },
  daysGrid: { flexDirection: "row", paddingHorizontal: 8, marginBottom: 12, gap: 4 },
  dayBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 2, alignItems: "center" },
  dayName: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
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
