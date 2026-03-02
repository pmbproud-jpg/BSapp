import { useDashboardData } from "@/src/hooks/useDashboardData";
import { usePermissions } from "@/src/hooks/usePermissions";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

const screenWidth = Dimensions.get("window").width;

// Simple Bar Chart Component
const BarChart = ({ data, labels, colors, height = 200 }: {
  data: number[];
  labels: string[];
  colors: string[];
  height?: number;
}) => {
  const maxValue = Math.max(...data, 1);
  const barWidth = (screenWidth - 80) / data.length - 12;

  return (
    <View style={[styles.chartContainer, { height }]}>
      <View style={styles.barsContainer}>
        {data.map((value, index) => {
          const barHeight = Math.max((value / maxValue) * (height - 50), 4);
          return (
            <View key={index} style={styles.barWrapper}>
              <Text style={styles.barValue}>{value}</Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: colors[index] || "#2563eb",
                  },
                ]}
              />
              <Text style={styles.barLabel} numberOfLines={2}>
                {labels[index]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Donut Chart Component (web-safe, no transform)
const DonutChart = ({ data, colors, size = 140 }: {
  data: { value: number; label: string }[];
  colors: string[];
  size?: number;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <View style={styles.donutWrapper}>
      <View style={[styles.donutContainer, { width: size, height: size }]}>
        <View style={[styles.emptyDonut, { width: size, height: size, borderRadius: size / 2 }]} />
        <View style={[styles.donutCenter, { width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3 }]}>
          <Text style={styles.donutTotal}>{total}</Text>
          <Text style={styles.donutTotalLabel}>Total</Text>
        </View>
      </View>
      <View style={styles.legendContainer}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: colors[index] }]} />
            <Text style={styles.legendText}>
              {item.label}: {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Progress Ring Component (web-safe, no transform)
const ProgressRing = ({ progress, size = 100, color = "#10b981", label }: {
  progress: number;
  size?: number;
  color?: string;
  label?: string;
}) => {
  const progressValue = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={[styles.progressRingContainer, { width: size, height: size }]}>
      <View style={[styles.ringBackground, { 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        borderWidth: size * 0.12,
        borderColor: '#e2e8f0'
      }]} />
      <View style={styles.progressTextContainer}>
        <Text style={[styles.progressText, { fontSize: size * 0.22, color }]}>{Math.round(progressValue)}%</Text>
        {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
      </View>
    </View>
  );
};

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: themeColors, isDark } = useTheme();
  // ─── Dashboard Data Hook ───
  const {
    stats, tasksByProject, tbpSearch, setTbpSearch,
    tbpSort, setTbpSort,
    loading, refreshing, pendingAbsencesCount,
    fetchAllData, onRefresh, completionRate,
  } = useDashboardData(profile?.id ?? undefined, perms.canViewOnlyAssigned);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
    }, [profile?.id])
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={[styles.greetingText, { color: themeColors.text }]}>
          {t("dashboard.greeting", { name: profile?.full_name || "Administrator" })}
        </Text>
        <Text style={[styles.roleText, { color: themeColors.textSecondary }]}>
          {t(`common.roles.${profile?.role || "worker"}`)}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Ionicons name="briefcase" size={32} color={themeColors.primary} />
          <Text style={[styles.statNumber, { color: themeColors.text }]}>{stats.activeProjects}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
            {t("dashboard.stats.active_projects")}
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Ionicons name="time" size={32} color="#f59e0b" />
          <Text style={[styles.statNumber, { color: themeColors.text }]}>{stats.pendingTasks}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
            {t("dashboard.stats.pending_tasks")}
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Ionicons name="checkmark-circle" size={32} color="#10b981" />
          <Text style={[styles.statNumber, { color: themeColors.text }]}>{stats.completedTasks}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>
            {t("dashboard.stats.completed_tasks")}
          </Text>
        </View>
      </View>

      {/* Completion Rate */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("dashboard.charts.completion_rate")}</Text>
        <View style={[styles.completionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <ProgressRing progress={completionRate} size={110} color="#10b981" />
          <View style={styles.completionInfo}>
            <Text style={[styles.completionMainText, { color: themeColors.text }]}>
              {stats.completedTasks} / {stats.totalTasks}
            </Text>
            <Text style={[styles.completionSubText, { color: themeColors.textSecondary }]}>
              {t("dashboard.charts.tasks_completed")}
            </Text>
          </View>
        </View>
      </View>

      {/* Plan Button */}
      {perms.canViewPlan && (
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.planButton, { backgroundColor: themeColors.primary }]}
          onPress={() => router.push("/(app)/plan" as any)}
        >
          <View style={styles.planButtonContent}>
            <View style={styles.planButtonIcon}>
              <Ionicons name="calendar" size={32} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planButtonTitle}>{t("plan.title")}</Text>
              <Text style={styles.planButtonSubtitle}>{t("plan.dashboard_desc")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>
      </View>
      )}

      {/* Urlopy Button */}
      {perms.canViewPlan && (
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.planButton, { backgroundColor: "#f59e0b" }]}
          onPress={() => router.push("/(app)/absences" as any)}
        >
          <View style={styles.planButtonContent}>
            <View style={styles.planButtonIcon}>
              <Ionicons name="calendar-clear" size={32} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planButtonTitle}>{t("absences.title") || "Urlopy"}</Text>
              <Text style={styles.planButtonSubtitle}>{t("absences.dashboard_desc") || "Wnioski urlopowe i nieobecności"}</Text>
            </View>
            {pendingAbsencesCount > 0 && (
              <View style={{ backgroundColor: "#ef4444", borderRadius: 12, minWidth: 24, height: 24, justifyContent: "center", alignItems: "center", paddingHorizontal: 6, marginRight: 8 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{pendingAbsencesCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>
      </View>
      )}

      {/* Magazyn Button */}
      {perms.canViewWarehouse && (
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.planButton, { backgroundColor: "#dc2626" }]}
          onPress={() => router.push("/(app)/magazyn" as any)}
        >
          <View style={styles.planButtonContent}>
            <View style={styles.planButtonIcon}>
              <Ionicons name="cube" size={32} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planButtonTitle}>{t("magazyn.title") || "Lager"}</Text>
              <Text style={styles.planButtonSubtitle}>{t("magazyn.dashboard_desc") || "Lagerverwaltung"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>
      </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          {t("dashboard.quick_actions.title")}
        </Text>

        <View style={styles.actionsGrid}>
          {perms.canCreateProject && (
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => router.push("/projects/new" as any)}>
              <Ionicons name="add-circle" size={48} color={themeColors.primary} />
              <Text style={[styles.actionText, { color: themeColors.text }]}>
                {t("dashboard.quick_actions.add_project")}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => router.push("/projects" as any)}>
            <Ionicons name="folder-open" size={48} color="#8b5cf6" />
            <Text style={[styles.actionText, { color: themeColors.text }]}>
              {t("dashboard.quick_actions.view_projects")}
            </Text>
          </TouchableOpacity>

          {perms.canViewUsers && (
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={() => router.push("/users" as any)}>
              <Ionicons name="people" size={48} color="#10b981" />
              <Text style={[styles.actionText, { color: themeColors.text }]}>
                {t("navigation.users")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tasks by Project — vertical list at the bottom */}
      {tasksByProject.length > 0 && (() => {
        const q = tbpSearch.toLowerCase().trim();
        const filtered = tasksByProject
          .filter((p) => !q || p.project_name.toLowerCase().includes(q) || p.project_number.toLowerCase().includes(q))
          .sort((a, b) => {
            if (tbpSort === "number") return (a.project_number || "").localeCompare(b.project_number || "", "de", { numeric: true });
            return (a.project_name || "").localeCompare(b.project_name || "", "de");
          });
        return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("dashboard.charts.tasks_by_project") || "Aufgaben nach Projekt"}</Text>
          <View style={[styles.chartCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {/* Search */}
            <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: themeColors.border || "#e2e8f0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, gap: 6 }}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={{ flex: 1, fontSize: 13, color: themeColors.text, padding: 0 }}
                placeholder={t("users.search_placeholder") || "Suchen..."}
                placeholderTextColor="#94a3b8"
                value={tbpSearch}
                onChangeText={setTbpSearch}
              />
              {tbpSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTbpSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
            {/* Sort buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tbpSort === "name" ? "#2563eb" : (themeColors.border || "#f1f5f9"), paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                onPress={() => setTbpSort("name")}
              >
                <Ionicons name="text" size={14} color={tbpSort === "name" ? "#fff" : themeColors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: tbpSort === "name" ? "#fff" : themeColors.textSecondary }}>{t("projects.name") || "Name"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tbpSort === "number" ? "#2563eb" : (themeColors.border || "#f1f5f9"), paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                onPress={() => setTbpSort("number")}
              >
                <Ionicons name="list" size={14} color={tbpSort === "number" ? "#fff" : themeColors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: tbpSort === "number" ? "#fff" : themeColors.textSecondary }}>Nr. Budowy</Text>
              </TouchableOpacity>
            </View>
            {/* Legend */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#f59e0b" }} />
                <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t("tasks.status.todo") || "Zu erledigen"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#3b82f6" }} />
                <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t("tasks.status.in_progress")}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#10b981" }} />
                <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t("tasks.status.completed")}</Text>
              </View>
            </View>
            {filtered.length === 0 ? (
              <Text style={{ fontSize: 13, color: themeColors.textSecondary, textAlign: "center", paddingVertical: 16 }}>
                {t("projects.empty") || "Keine Projekte"}
              </Text>
            ) : (
              filtered.map((proj) => {
                const total = proj.pending + proj.in_progress + proj.completed;
                const maxVal = Math.max(total, 1);
                return (
                  <TouchableOpacity
                    key={proj.project_id}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/projects/${proj.project_id}` as any)}
                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: themeColors.border || "#f1f5f9" }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.text, flex: 1 }} numberOfLines={1}>{proj.project_name}</Text>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{total} {t("tasks.title") || "Aufgaben"}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginBottom: 6 }} numberOfLines={1}>{proj.project_number}</Text>
                    <View style={{ flexDirection: "row", height: 20, borderRadius: 6, overflow: "hidden", backgroundColor: themeColors.border || "#e2e8f0" }}>
                      {proj.pending > 0 && (
                        <View style={{ width: `${(proj.pending / maxVal) * 100}%`, backgroundColor: "#f59e0b", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{proj.pending}</Text>
                        </View>
                      )}
                      {proj.in_progress > 0 && (
                        <View style={{ width: `${(proj.in_progress / maxVal) * 100}%`, backgroundColor: "#3b82f6", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{proj.in_progress}</Text>
                        </View>
                      )}
                      {proj.completed > 0 && (
                        <View style={{ width: `${(proj.completed / maxVal) * 100}%`, backgroundColor: "#10b981", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{proj.completed}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
        );
      })()}

      <View style={{ height: 40 }} />
    </ScrollView>
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
  greeting: {
    backgroundColor: "#ffffff",
    padding: 24,
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  roleText: {
    fontSize: 16,
    color: "#64748b",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chartContainer: {
    width: "100%",
    justifyContent: "flex-end",
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: "100%",
    paddingBottom: 30,
  },
  barWrapper: {
    alignItems: "center",
    flex: 1,
  },
  bar: {
    borderRadius: 6,
    minHeight: 4,
  },
  barValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  donutWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  donutContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  donutBackground: {
    backgroundColor: "#e2e8f0",
    position: "absolute",
  },
  donutSegment: {
    position: "absolute",
  },
  donutCenter: {
    backgroundColor: "#ffffff",
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  donutTotal: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
  },
  donutTotalLabel: {
    fontSize: 10,
    color: "#64748b",
  },
  emptyDonut: {
    backgroundColor: "#e2e8f0",
  },
  legendContainer: {
    flex: 1,
    paddingLeft: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: "#64748b",
  },
  completionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  progressRingContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  ringBackground: {
    position: "absolute",
  },
  ringProgressOuter: {
    position: "absolute",
  },
  ringProgressInner: {
    borderTopColor: "transparent",
  },
  progressTextContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    fontWeight: "700",
    color: "#1e293b",
  },
  progressLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  completionInfo: {
    flex: 1,
  },
  completionMainText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  completionSubText: {
    fontSize: 14,
    color: "#64748b",
  },
  activityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  activityItemLast: {
    borderBottomWidth: 0,
  },
  activityIcon: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    marginBottom: 2,
  },
  activityStatus: {
    fontSize: 12,
    color: "#64748b",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexBasis: 150,
    flexGrow: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginTop: 8,
  },
  taskSummaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  taskSummaryItem: {
    alignItems: "center",
    flex: 1,
  },
  taskSummaryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  taskSummaryInfo: {
    alignItems: "center",
  },
  taskSummaryNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
  },
  taskSummaryLabel: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },
  taskSummaryDivider: {
    width: 1,
    height: 50,
    backgroundColor: "#e2e8f0",
  },
  planButton: {
    marginHorizontal: 0,
    borderRadius: 16,
    padding: 18,
    elevation: 2,
  },
  planButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  planButtonIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  planButtonTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 2,
  },
  planButtonSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
});
