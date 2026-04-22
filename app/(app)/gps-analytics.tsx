import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { useTheme, type ThemeColors } from "@/src/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { useGPSAnalytics, GeofenceZone, WorkerDaySummary, SitePresence } from "@/src/hooks/useGPSAnalytics";
import { supabase } from "@/src/lib/supabase/client";
import { Ionicons } from "@expo/vector-icons";
import type { TFunction } from "i18next";

type IoniconName = keyof typeof Ionicons.glyphMap;

// ─── Helpers ───

function formatMinutes(min: number, t: TFunction): string {
  if (min < 60) return `${min} ${t("gps_analytics.minutes_short")}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0
    ? `${h} ${t("gps_analytics.hours_short")} ${m} ${t("gps_analytics.minutes_short")}`
    : `${h} ${t("gps_analytics.hours_short")}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDistance(meters: number | null, t: TFunction): string {
  if (meters === null) return "—";
  if (meters < 1000) return `${meters} ${t("gps_analytics.meters")}`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ─── Components ───

function StatCard({
  icon,
  label,
  value,
  color,
  colors,
}: {
  icon: IoniconName;
  label: string;
  value: string | number;
  color: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function PresenceCard({
  item,
  colors,
  t,
}: {
  item: SitePresence;
  colors: ThemeColors;
  t: TFunction;
}) {
  const statusColor = item.isOnSite ? "#22c55e" : "#ef4444";
  const statusBg = item.isOnSite ? "#f0fdf4" : "#fef2f2";
  const statusText = item.isOnSite
    ? t("gps_analytics.on_site")
    : t("gps_analytics.off_site");

  return (
    <View style={[styles.presenceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.presenceLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View>
          <Text style={[styles.workerName, { color: colors.text }]}>{item.userName}</Text>
          <Text style={[styles.workerRole, { color: colors.textSecondary }]}>
            {t(`common.roles.${item.userRole}`)}
          </Text>
        </View>
      </View>
      <View style={styles.presenceRight}>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusText}</Text>
        </View>
        {item.distanceToSite !== null && (
          <Text style={[styles.distanceText, { color: colors.textMuted }]}>
            {formatDistance(item.distanceToSite, t)}
          </Text>
        )}
        {item.lastSeenAt && (
          <Text style={[styles.lastSeenText, { color: colors.textMuted }]}>
            {formatTime(item.lastSeenAt)}
          </Text>
        )}
      </View>
    </View>
  );
}

function WorkerSummaryCard({
  item,
  colors,
  t,
}: {
  item: WorkerDaySummary;
  colors: ThemeColors;
  t: TFunction;
}) {
  const hasData = item.totalPoints > 0;
  const barWidth = hasData ? Math.min((item.totalMinutesOnSite / 480) * 100, 100) : 0;
  const barColor = item.totalMinutesOnSite >= 360 ? "#22c55e"
    : item.totalMinutesOnSite >= 180 ? "#f59e0b"
    : "#ef4444";

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.workerName, { color: colors.text }]}>{item.userName}</Text>
        <Text style={[styles.summaryTime, { color: colors.text }]}>
          {hasData ? formatMinutes(item.totalMinutesOnSite, t) : "—"}
        </Text>
      </View>

      {hasData && (
        <>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
          </View>

          <View style={styles.summaryDetails}>
            <View style={styles.summaryDetail}>
              <Ionicons name="log-in-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {formatTime(item.firstSeen)}
              </Text>
            </View>
            <View style={styles.summaryDetail}>
              <Ionicons name="log-out-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {formatTime(item.lastSeen)}
              </Text>
            </View>
            <View style={styles.summaryDetail}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {item.totalPoints} pts
              </Text>
            </View>
          </View>

          {item.zones.length > 0 && (
            <View style={styles.zonesRow}>
              {item.zones.map((z) => (
                <View key={z.zoneName} style={[styles.zoneBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.zoneBadgeText, { color: colors.primary }]}>
                    {z.zoneName}: {formatMinutes(z.minutes, t)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {!hasData && (
        <Text style={[styles.noDataText, { color: colors.textMuted }]}>
          {t("gps_analytics.no_data")}
        </Text>
      )}
    </View>
  );
}

// ─── Main Screen ───

type TabType = "presence" | "team";

export default function GPSAnalyticsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { loading, error, getSitePresence, getTeamDaySummary } = useGPSAnalytics();

  const [tab, setTab] = useState<TabType>("presence");
  const [projects, setProjects] = useState<{ id: string; name: string; location: string | null }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [geofenceRadius, setGeofenceRadius] = useState("200");

  const [presenceData, setPresenceData] = useState<SitePresence[]>([]);
  const [teamData, setTeamData] = useState<WorkerDaySummary[]>([]);

  // Load projects
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("id, name, location")
        .in("status", ["planning", "active", "on_hold"])
        .order("name") as { data: { id: string; name: string; location: string | null }[] | null };
      if (data) {
        setProjects(data);
        if (data.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      }
    }
    load();
  }, []);

  // Build geofence zone from selected project
  const getZone = useCallback((): GeofenceZone | null => {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project?.location) return null;

    // Try to parse location as "lat,lng" or "lat, lng"
    const parts = project.location.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return {
        id: project.id,
        name: project.name,
        latitude: parts[0],
        longitude: parts[1],
        radius: parseInt(geofenceRadius) || 200,
        projectId: project.id,
      };
    }
    return null;
  }, [projects, selectedProjectId, geofenceRadius]);

  const loadPresence = useCallback(async () => {
    const zone = getZone();
    if (!zone) return;
    const data = await getSitePresence(zone);
    setPresenceData(data);
  }, [getZone, getSitePresence]);

  const loadTeamSummary = useCallback(async () => {
    const zone = getZone();
    const zones = zone ? [zone] : [];
    const data = await getTeamDaySummary(selectedDate, zones);
    setTeamData(data);
  }, [getZone, selectedDate, getTeamDaySummary]);

  // Load data on tab/project/date change
  useEffect(() => {
    if (!selectedProjectId) return;
    if (tab === "presence") loadPresence();
    else loadTeamSummary();
  }, [tab, selectedProjectId, selectedDate]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const zone = getZone();
  const onSiteCount = presenceData.filter((p) => p.isOnSite).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar — project selector + date */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.projectSelector, { borderColor: colors.border }]}
          onPress={() => setShowProjectPicker(!showProjectPicker)}
        >
          <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.projectText, { color: colors.text }]} numberOfLines={1}>
            {selectedProject?.name || t("gps_analytics.select_site")}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </TouchableOpacity>

        {tab === "team" && (
          <TouchableOpacity style={[styles.dateButton, { borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.dateInput, { color: colors.text }]}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              maxLength={10}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={tab === "presence" ? loadPresence : loadTeamSummary}
        >
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Project picker dropdown */}
      {showProjectPicker && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 200 }}>
            {projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.dropdownItem, selectedProjectId === p.id && { backgroundColor: colors.primary + "15" }]}
                onPress={() => { setSelectedProjectId(p.id); setShowProjectPicker(false); }}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.location && (
                  <Text style={[styles.dropdownSubtext, { color: colors.textMuted }]} numberOfLines={1}>
                    {p.location}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "presence" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab("presence")}
        >
          <Ionicons
            name="people"
            size={16}
            color={tab === "presence" ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, { color: tab === "presence" ? colors.primary : colors.textMuted }]}>
            {t("gps_analytics.presence")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "team" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab("team")}
        >
          <Ionicons
            name="analytics"
            size={16}
            color={tab === "team" ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabText, { color: tab === "team" ? colors.primary : colors.textMuted }]}>
            {t("gps_analytics.team_overview")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* No zone warning */}
      {!zone && selectedProjectId && (
        <View style={styles.warningBar}>
          <Ionicons name="warning-outline" size={16} color="#f59e0b" />
          <Text style={styles.warningText}>
            {t("gps_analytics.select_site")} — format: "51.2345, 7.1234"
          </Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* PRESENCE TAB */}
      {!loading && tab === "presence" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatCard
              icon="people"
              label={t("gps_analytics.workers_on_site")}
              value={onSiteCount}
              color="#22c55e"
              colors={colors}
            />
            <StatCard
              icon="locate"
              label={t("gps_analytics.workers_total")}
              value={presenceData.length}
              color="#3b82f6"
              colors={colors}
            />
            <StatCard
              icon="radio-button-on"
              label={t("gps_analytics.geofence_radius")}
              value={`${geofenceRadius}m`}
              color="#8b5cf6"
              colors={colors}
            />
          </View>

          {/* Geofence radius adjuster */}
          <View style={[styles.radiusRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.radiusLabel, { color: colors.textSecondary }]}>
              {t("gps_analytics.geofence_radius")}:
            </Text>
            {["100", "200", "500", "1000"].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.radiusChip,
                  {
                    backgroundColor: geofenceRadius === r ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => { setGeofenceRadius(r); }}
              >
                <Text style={{ color: geofenceRadius === r ? "#fff" : colors.text, fontSize: 13, fontWeight: "600" }}>
                  {r}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Presence list */}
          {presenceData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t("gps_analytics.no_gps_workers")}
              </Text>
            </View>
          ) : (
            presenceData.map((item) => (
              <PresenceCard key={item.userId} item={item} colors={colors} t={t} />
            ))
          )}
        </ScrollView>
      )}

      {/* TEAM TAB */}
      {!loading && tab === "team" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Stats */}
          {teamData.length > 0 && (
            <View style={styles.statsRow}>
              <StatCard
                icon="people"
                label={t("gps_analytics.workers_total")}
                value={teamData.length}
                color="#3b82f6"
                colors={colors}
              />
              <StatCard
                icon="time"
                label={`Ø ${t("gps_analytics.time_on_site")}`}
                value={formatMinutes(
                  Math.round(teamData.reduce((s, d) => s + d.totalMinutesOnSite, 0) / teamData.length),
                  t
                )}
                color="#22c55e"
                colors={colors}
              />
              <StatCard
                icon="location"
                label={t("gps_analytics.data_points")}
                value={teamData.reduce((s, d) => s + d.totalPoints, 0)}
                color="#8b5cf6"
                colors={colors}
              />
            </View>
          )}

          {teamData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t("gps_analytics.no_data")}
              </Text>
            </View>
          ) : (
            teamData.map((item) => (
              <WorkerSummaryCard key={item.userId} item={item} colors={colors} t={t} />
            ))
          )}
        </ScrollView>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBar}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  projectSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  projectText: { flex: 1, fontSize: 14 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  dateInput: { fontSize: 13, width: 95, padding: 0 },
  refreshButton: { padding: 6 },
  dropdown: {
    position: "absolute",
    top: 52,
    left: 10,
    right: 50,
    zIndex: 100,
    borderWidth: 1,
    borderRadius: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  dropdownText: { fontSize: 14 },
  dropdownSubtext: { fontSize: 11, marginTop: 2 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  warningBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 8,
    backgroundColor: "#fffbeb",
  },
  warningText: { fontSize: 13, color: "#92400e", flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 12 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 11, textAlign: "center", marginTop: 2 },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  radiusLabel: { fontSize: 13 },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  presenceCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  presenceLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  workerName: { fontSize: 14, fontWeight: "600" },
  workerRole: { fontSize: 12, marginTop: 1 },
  presenceRight: { alignItems: "flex-end", gap: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  distanceText: { fontSize: 11 },
  lastSeenText: { fontSize: 10 },
  summaryCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryTime: { fontSize: 15, fontWeight: "700" },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  summaryDetails: {
    flexDirection: "row",
    gap: 12,
  },
  summaryDetail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12 },
  zonesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  zoneBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  zoneBadgeText: { fontSize: 11, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 15, marginTop: 12 },
  noDataText: { fontSize: 13, fontStyle: "italic", marginTop: 4 },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 8,
    backgroundColor: "#fef2f2",
  },
  errorText: { fontSize: 13, color: "#ef4444", flex: 1 },
});
