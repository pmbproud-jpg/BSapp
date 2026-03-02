import React, { useState, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Modal,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/providers/ThemeProvider";

const WORKER_COLORS = [
  "#16a34a", "#ea580c", "#db2777", "#0891b2", "#ca8a04",
  "#7c3aed", "#dc2626", "#0d9488", "#d97706", "#2563eb",
  "#65a30d", "#be123c", "#0284c7", "#9333ea", "#c2410c",
  "#4f46e5", "#059669", "#c026d3", "#e11d48", "#0e7490",
];

const VEHICLE_COLORS = [
  "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0e7490",
  "#6d28d9", "#be185d", "#0f766e", "#b45309", "#1d4ed8",
];

type Props = {
  weekDays: any[];
  assignments: any[];
  projects: any[];
  vehicles: any[];
  workers: any[];
  absences: any[];
  weekStart: string;
  lang: string;
};

type ViewMode = "day" | "week" | "month";

const STATUS_FILTERS = ["active", "planning", "on_hold", "completed", "cancelled"] as const;

// Generuj dni miesiąca
function getMonthDays(refDate: string | Date, lang: string) {
  const d = typeof refDate === "string" ? new Date(refDate) : refDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const namesPL = ["Pon","Wt","Śr","Czw","Pt","Sob","Ndz"];
  const namesDE = ["Mo","Di","Mi","Do","Fr","Sa","So"];
  const namesEN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const days = [];
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const dd = new Date(year, month, i);
    const dow = dd.getDay() === 0 ? 7 : dd.getDay();
    const shorts = lang === "de" ? namesDE : lang === "en" ? namesEN : namesPL;
    days.push({
      dayOfWeek: dow,
      date: dd.toISOString().split("T")[0],
      dayNum: i,
      monthNum: month + 1,
      shortName: shorts[dow - 1],
      isToday: dd.toISOString().split("T")[0] === new Date().toISOString().split("T")[0],
      isWeekend: dow >= 6,
    });
  }
  return days;
}

export default function ResourceCalendar({ weekDays, assignments, projects, vehicles, workers, absences, weekStart, lang }: Props) {
  const { t } = useTranslation();
  const { colors: tc, isDark } = useTheme();
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(["active"]));
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [absPopup, setAbsPopup] = useState<{ date: string; items: any[] } | null>(null);

  const toggleStatus = (s: string) => {
    setStatusFilters((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  };

  // Mapa: projectId -> dateString -> assignments[]
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Map<string, any[]>>();
    const mon = new Date(weekStart);
    for (const a of assignments) {
      const pid = a.project?.id;
      if (!pid) continue;
      // Oblicz datę z weekStart (poniedziałek) + day_of_week (1=pon, 7=ndz)
      const d = new Date(mon);
      d.setDate(d.getDate() + (a.day_of_week - 1));
      const dateKey = d.toISOString().split("T")[0];
      if (!map.has(pid)) map.set(pid, new Map());
      const dayMap = map.get(pid)!;
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
      dayMap.get(dateKey)!.push(a);
    }
    return map;
  }, [assignments, weekStart]);

  const filteredProjects = useMemo(() => {
    let filtered = statusFilters.size === 0 ? projects : projects.filter((p: any) => statusFilters.has(p.status));
    // Sort: projects with assignments first, then by name
    return [...filtered].sort((a: any, b: any) => {
      const aHas = assignmentMap.has(a.id) ? 0 : 1;
      const bHas = assignmentMap.has(b.id) ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [projects, statusFilters, assignmentMap]);

  const vehicleMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const workerColorMap = useMemo(() => {
    const m = new Map<string, string>();
    const allWorkerIds = new Set<string>();
    for (const a of assignments) {
      if (a.worker_id) allWorkerIds.add(a.worker_id);
    }
    let idx = 0;
    for (const wid of allWorkerIds) {
      m.set(wid, WORKER_COLORS[idx % WORKER_COLORS.length]);
      idx++;
    }
    return m;
  }, [assignments]);

  const vehicleColorMap = useMemo(() => {
    const m = new Map<string, string>();
    let idx = 0;
    for (const v of vehicles) {
      m.set(v.id, VEHICLE_COLORS[idx % VEHICLE_COLORS.length]);
      idx++;
    }
    return m;
  }, [vehicles]);

  const dayFullName = (day: any) => lang === "de" ? day.nameDE : lang === "en" ? day.nameEN : day.namePL;

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "#16a34a";
      case "planning": return "#2563eb";
      case "on_hold": return "#d97706";
      case "completed": return "#6b7280";
      case "cancelled": return "#dc2626";
      default: return "#94a3b8";
    }
  };

  const statusLabel = (s: string) => t(`projects.status.${s}`, s);

  const getKW = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const kwNum = getKW(weekStart);

  // Month view: compute month based on weekStart + monthOffset
  const monthDate = useMemo(() => {
    const d = new Date(weekStart);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [weekStart, monthOffset]);

  // Kolumny zależne od widoku
  const visibleDays = useMemo(() => {
    if (viewMode === "day") {
      return [weekDays[selectedDayIdx] || weekDays[0]];
    }
    if (viewMode === "month") {
      return getMonthDays(monthDate, lang);
    }
    return weekDays;
  }, [viewMode, weekDays, selectedDayIdx, monthDate, weekStart, lang]);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // On web: fill the screen; on mobile: fixed widths with horizontal scroll
  const isWeb = Platform.OS === "web";
  const tableMaxHeight = isWeb ? Math.max(300, windowHeight - 280) : 700;
  const numDays = visibleDays.length;
  const PROJECT_COL_WIDTH = isWeb ? Math.max(140, Math.min(200, windowWidth * 0.14)) : 220;
  const availableWidth = windowWidth - PROJECT_COL_WIDTH - 2;
  const DAY_COL_WIDTH = isWeb
    ? (viewMode === "day"
      ? availableWidth
      : viewMode === "month"
        ? Math.max(90, availableWidth / numDays)
        : Math.max(120, availableWidth / numDays))
    : (viewMode === "day" ? 500 : viewMode === "month" ? 110 : 200);

  // Pasek tekstu — wspólny komponent
  const Bar = ({ color, label, bold }: { color: string; label: string; bold?: boolean }) => (
    <View style={{
      backgroundColor: color,
      borderRadius: 2,
      paddingHorizontal: 4,
      paddingVertical: Platform.OS === "web" ? 1.5 : 1,
      marginBottom: 1,
      ...(Platform.OS === "web" ? { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as any : {}),
    }}>
      <Text style={{
        fontSize: viewMode === "month" ? 8 : 10,
        lineHeight: viewMode === "month" ? 11 : 14,
        color: "#ffffff",
        fontWeight: bold ? "800" : "600",
        letterSpacing: 0.1,
        ...(Platform.OS === "web" ? { textShadow: "0px 1px 1px rgba(0,0,0,0.4)" } as any : {}),
      }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  const viewModes: { key: ViewMode; label: string; icon: string }[] = [
    { key: "day", label: t("plan.view_day", "Tag"), icon: "today-outline" },
    { key: "week", label: t("plan.view_week", "Woche"), icon: "calendar-outline" },
    { key: "month", label: t("plan.view_month", "Monat"), icon: "grid-outline" },
  ];

  const monthNames = lang === "de"
    ? ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
    : lang === "en"
      ? ["January","February","March","April","May","June","July","August","September","October","November","December"]
      : ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

  const monthIdx = viewMode === "month" ? monthDate.getMonth() : new Date(weekStart).getMonth();
  const monthYear = viewMode === "month" ? monthDate.getFullYear() : new Date(weekStart).getFullYear();

  // Absences per date
  const absencesByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of absences) {
      const from = new Date(a.date_from);
      const to = new Date(a.date_to);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
      }
    }
    return map;
  }, [absences]);

  const absTypeColor = (type: string) => {
    switch (type) {
      case "vacation": return "#ef4444";
      case "sick_leave": return "#f59e0b";
      case "special_leave": return "#8b5cf6";
      case "training": return "#3b82f6";
      case "unexcused": return "#64748b";
      default: return "#94a3b8";
    }
  };
  const absTypeLabel = (type: string) => {
    switch (type) {
      case "vacation": return t("plan.abs_vacation", "Urlaub");
      case "sick_leave": return t("plan.abs_sick", "Krankmeldung");
      case "special_leave": return t("plan.abs_special", "Sonderurlaub");
      case "training": return t("plan.abs_training", "Schulung");
      case "unexcused": return t("plan.abs_unexcused", "Unentschuldigt");
      default: return type;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Tytuł + KW + widok */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="grid" size={18} color="#00897b" />
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#00897b", marginLeft: 6 }}>
            {t("plan.tab_calendar", "Kalender")}
          </Text>
          <View style={{ marginLeft: 10, backgroundColor: isDark ? "#1e293b" : "#e8f5e9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: tc.text }}>
              {viewMode === "month" ? `${monthNames[monthIdx]} ${monthYear}` : `${kwNum}KW ${new Date(weekStart).getFullYear()}`}
            </Text>
          </View>
          {viewMode === "month" && (
            <View style={{ flexDirection: "row", marginLeft: 8, gap: 4 }}>
              <TouchableOpacity onPress={() => setMonthOffset(p => p - 1)} style={{ padding: 4 }}>
                <Ionicons name="chevron-back" size={18} color={tc.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMonthOffset(p => p + 1)} style={{ padding: 4 }}>
                <Ionicons name="chevron-forward" size={18} color={tc.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* View mode switcher */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: tc.border, overflow: "hidden" }}>
        {viewModes.map((vm) => (
          <TouchableOpacity
            key={vm.key}
            onPress={() => { setViewMode(vm.key); if (vm.key === "day") setSelectedDayIdx(0); }}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
              paddingVertical: 8, gap: 4,
              backgroundColor: viewMode === vm.key ? "#00897b" : "transparent",
            }}
          >
            <Ionicons name={vm.icon as any} size={15} color={viewMode === vm.key ? "#fff" : tc.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: viewMode === vm.key ? "#fff" : tc.textSecondary }}>
              {vm.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day picker (only in day mode) */}
      {viewMode === "day" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {weekDays.map((day: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedDayIdx(idx)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: selectedDayIdx === idx ? "#00897b" : (isDark ? "#1e293b" : "#f1f5f9"),
                  borderWidth: day.isToday ? 2 : 0,
                  borderColor: "#00897b",
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: "700",
                  color: selectedDayIdx === idx ? "#fff" : (day.isToday ? "#00897b" : tc.text),
                }}>
                  {dayFullName(day)} {day.dayNum}.{day.monthNum.toString().padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Status filters */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, marginBottom: 10 }}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilters.has(s);
          return (
            <TouchableOpacity
              key={s}
              onPress={() => toggleStatus(s)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                borderWidth: 1.5,
                borderColor: active ? statusColor(s) : tc.border,
                backgroundColor: active ? statusColor(s) + "22" : "transparent",
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(s) }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? statusColor(s) : tc.textMuted }}>
                {statusLabel(s)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scrollable table */}
      {isWeb ? (
        React.createElement('div', {
          style: {
            maxHeight: tableMaxHeight,
            overflowX: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
          },
        },
        <View style={{ minWidth: PROJECT_COL_WIDTH + DAY_COL_WIDTH * numDays }}>
          {/* Header row */}
          <View style={{ flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#00897b" }}>
            <View style={{
              width: PROJECT_COL_WIDTH,
              backgroundColor: isDark ? "#0e2433" : "#e0f2f1",
              borderRightWidth: 2, borderRightColor: "#00897b",
              paddingVertical: 6, paddingHorizontal: 6,
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#00897b" }}>{t("plan.project", "Projekt")}</Text>
            </View>
            {visibleDays.map((day: any, di: number) => (
              <View
                key={di}
                style={{
                  width: DAY_COL_WIDTH,
                  backgroundColor: day.isToday
                    ? (isDark ? "#1b5e20" : "#c8e6c9")
                    : day.isWeekend
                      ? (isDark ? "#33291a" : "#fff8e1")
                      : (isDark ? "#0e2433" : "#e0f2f1"),
                  borderRightWidth: 1,
                  borderRightColor: "#00897b",
                  paddingVertical: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {viewMode === "month" ? (
                  <>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: day.isToday ? "#1b5e20" : (isDark ? "#a5d6a7" : "#1b5e20") }}>
                      {day.shortName}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: day.isToday ? "#2e7d32" : (isDark ? "#81c784" : "#2e7d32") }}>
                      {day.dayNum}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: day.isToday ? "#1b5e20" : (isDark ? "#a5d6a7" : "#1b5e20") }}>
                      {dayFullName(day)}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: day.isToday ? "#2e7d32" : (isDark ? "#81c784" : "#388e3c"), marginTop: 0 }}>
                      {day.dayNum}.{day.monthNum.toString().padStart(2, "0")}.{new Date(day.date).getFullYear()}
                    </Text>
                  </>
                )}
              </View>
            ))}
          </View>

          {/* Absences row */}
          <View style={{ flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#ef4444" }}>
            <View style={{
              width: PROJECT_COL_WIDTH,
              backgroundColor: isDark ? "#2d1215" : "#fef2f2",
              borderRightWidth: 2, borderRightColor: "#00897b",
              paddingVertical: 4, paddingHorizontal: 6,
              justifyContent: "center",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="person-remove" size={12} color="#ef4444" />
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#ef4444" }}>
                  {t("plan.abs_title", "Abwesenheiten")}
                </Text>
              </View>
            </View>
            {visibleDays.map((day: any, di: number) => {
              const dayAbs = absencesByDate.get(day.date) || [];
              return (
                <TouchableOpacity
                  key={di}
                  disabled={dayAbs.length === 0}
                  onPress={() => dayAbs.length > 0 && setAbsPopup({ date: day.date, items: dayAbs })}
                  style={{
                    width: DAY_COL_WIDTH,
                    backgroundColor: dayAbs.length > 0
                      ? (isDark ? "#2d1215" : "#fef2f2")
                      : (day.isWeekend ? (isDark ? "#33291a" : "#fffbeb") : (isDark ? "#0f172a" : "#fff")),
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#334155" : "#e0e0e0",
                    paddingVertical: 2,
                    paddingHorizontal: 2,
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 28,
                  }}
                  activeOpacity={0.6}
                >
                  {dayAbs.length > 0 ? (
                    <View style={{ backgroundColor: "#ef4444", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                        {dayAbs.length} ✗
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Project rows */}
          <View>
            {filteredProjects.length === 0 && (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Ionicons name="calendar-outline" size={40} color={tc.textMuted} />
                <Text style={{ color: tc.textMuted, fontSize: 14, marginTop: 8 }}>{t("plan.no_projects", "Brak projektów")}</Text>
              </View>
            )}
            {filteredProjects.map((proj: any, projIdx: number) => {
              const projAssignments = assignmentMap.get(proj.id);

              let maxRows = 0;
              for (const day of visibleDays) {
                const dayAssigns = projAssignments?.get(day.date) || [];
                const vIds = new Set<string>();
                for (const a of dayAssigns) {
                  if (a.vehicle_ids && Array.isArray(a.vehicle_ids)) {
                    for (const vid of a.vehicle_ids) vIds.add(vid);
                  } else if (a.vehicle_id) vIds.add(a.vehicle_id);
                }
                const rows = vIds.size + dayAssigns.length;
                if (rows > maxRows) maxRows = rows;
              }
              const barH = viewMode === "month" ? 14 : 18;
              const minRowHeight = Math.max(maxRows * barH + 6, 38);
              const rowBg = projIdx % 2 === 0
                ? (isDark ? "#0f172a" : "#ffffff")
                : (isDark ? "#1a2332" : "#f5f5f5");

              return (
                <View
                  key={proj.id}
                  style={{
                    flexDirection: "row",
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? "#334155" : "#e0e0e0",
                    minHeight: minRowHeight,
                  }}
                >
                  {/* Project info */}
                  <View style={{
                    width: PROJECT_COL_WIDTH,
                    borderRightWidth: 2,
                    borderRightColor: "#00897b",
                    backgroundColor: rowBg,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: tc.text, lineHeight: 13 }} numberOfLines={2}>
                      {proj.name}{proj.project_number ? ` ${proj.project_number}` : ""}
                    </Text>
                    {proj.location ? (
                      <Text style={{ fontSize: 9, color: tc.textMuted, marginTop: 1, lineHeight: 12 }} numberOfLines={1}>
                        {proj.location}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor(proj.status) }} />
                      <Text style={{ fontSize: 8, color: statusColor(proj.status), fontWeight: "700" }}>{statusLabel(proj.status)}</Text>
                    </View>
                  </View>

                  {/* Day cells */}
                  {visibleDays.map((day: any, di: number) => {
                    const dayAssigns = projAssignments?.get(day.date) || [];
                    const dayVehicleIds = new Set<string>();
                    for (const a of dayAssigns) {
                      if (a.vehicle_ids && Array.isArray(a.vehicle_ids)) {
                        for (const vid of a.vehicle_ids) dayVehicleIds.add(vid);
                      } else if (a.vehicle_id) dayVehicleIds.add(a.vehicle_id);
                    }

                    const cellBg = day.isToday
                      ? (isDark ? "#1b5e2030" : "#e8f5e9")
                      : day.isWeekend
                        ? (isDark ? "#33291a30" : "#fffde7")
                        : rowBg;

                    return (
                      <View
                        key={di}
                        style={{
                          width: DAY_COL_WIDTH,
                          borderRightWidth: 1,
                          borderRightColor: isDark ? "#334155" : "#e0e0e0",
                          paddingVertical: 2,
                          paddingHorizontal: 2,
                          backgroundColor: cellBg,
                        }}
                      >
                        {Array.from(dayVehicleIds).map((vid) => {
                          const veh = vehicleMap.get(vid);
                          if (!veh) return null;
                          const vColor = vehicleColorMap.get(vid) || "#666";
                          // Find departure time from any assignment using this vehicle
                          const vAssign = dayAssigns.find((a: any) => {
                            const ids = Array.isArray(a.vehicle_ids) ? a.vehicle_ids : (a.vehicle_id ? [a.vehicle_id] : []);
                            return ids.includes(vid);
                          });
                          const depTime = vAssign?.departure_time ? ` ${(vAssign.departure_time || "").slice(0, 5)}` : "";
                          const label = viewMode === "month"
                            ? veh.license_plate
                            : `${veh.name} (${veh.license_plate})${depTime}`;
                          return <Bar key={vid} color={vColor} label={label} bold />;
                        })}
                        {dayAssigns.map((a: any, ai: number) => {
                          const wColor = workerColorMap.get(a.worker_id) || "#888";
                          const wName = a.worker?.full_name || "?";
                          const timeStr = a.start_time && a.end_time
                            ? ` ${(a.start_time || "").slice(0, 5)}-${(a.end_time || "").slice(0, 5)}`
                            : "";
                          const label = viewMode === "month"
                            ? (wName.split(" ")[0] || "?")
                            : `${wName}${timeStr}`;
                          return <Bar key={a.id || ai} color={wColor} label={label} />;
                        })}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
        )
      ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Header row (mobile) */}
          <View style={{ flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#00897b" }}>
            <View style={{
              width: PROJECT_COL_WIDTH,
              backgroundColor: isDark ? "#0e2433" : "#e0f2f1",
              borderRightWidth: 2, borderRightColor: "#00897b",
              paddingVertical: 6, paddingHorizontal: 6,
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#00897b" }}>{t("plan.project", "Projekt")}</Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 700 }}>
            {filteredProjects.map((proj: any, projIdx: number) => (
              <View key={proj.id} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: isDark ? "#334155" : "#e0e0e0" }}>
                <Text style={{ fontSize: 10, color: tc.text }}>{proj.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
      )}

      {/* Absence popup */}
      {absPopup && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setAbsPopup(null)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setAbsPopup(null)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
          >
            <TouchableOpacity activeOpacity={1} style={{
              backgroundColor: isDark ? "#1e293b" : "#fff",
              borderRadius: 16,
              padding: 20,
              width: "90%",
              maxWidth: 420,
              maxHeight: "70%",
              borderWidth: 2,
              borderColor: "#ef4444",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="person-remove" size={20} color="#ef4444" />
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#ef4444" }}>
                    {t("plan.abs_title", "Abwesenheiten")}
                  </Text>
                </View>
                <View style={{ backgroundColor: isDark ? "#334155" : "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: tc.text }}>
                    {absPopup.date.split("-").reverse().join(".")}
                  </Text>
                </View>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {absPopup.items.map((a: any, i: number) => (
                  <View key={a.id || i} style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: i < absPopup.items.length - 1 ? 1 : 0,
                    borderBottomColor: isDark ? "#334155" : "#f1f5f9",
                  }}>
                    <Ionicons name="person-circle" size={28} color={absTypeColor(a.type)} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: tc.text }}>
                        {a.user?.full_name || "?"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <View style={{
                          backgroundColor: absTypeColor(a.type) + "20",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: absTypeColor(a.type) }}>
                            {absTypeLabel(a.type)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: tc.textSecondary }}>
                          {a.date_from.split("-").reverse().join(".")} — {a.date_to.split("-").reverse().join(".")}
                        </Text>
                      </View>
                      {a.note ? (
                        <Text style={{ fontSize: 11, color: tc.textMuted, marginTop: 3, fontStyle: "italic" }}>
                          „{a.note}"
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setAbsPopup(null)}
                style={{ marginTop: 14, backgroundColor: "#ef4444", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{t("common.close", "Schließen")}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const cs = StyleSheet.create({});
