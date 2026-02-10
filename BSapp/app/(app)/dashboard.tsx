import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    activeProjects: 0,
    pendingTasks: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";
  const isZarzad = profile?.role === "zarzad";
  const isPM = profile?.role === "project_manager";
  const isBauleiter = profile?.role === "bauleiter";
  const canCreateProject = isAdmin || isZarzad || isPM;
  const canCreateTask = isAdmin || isZarzad || isPM || isBauleiter;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { count: activeCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .in("status", ["planning", "active"]);

      const { count: pendingCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "in_progress"]);

      const { count: completedCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      setStats({
        activeProjects: activeCount || 0,
        pendingTasks: pendingCount || 0,
        completedTasks: completedCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {t("dashboard.greeting", { name: profile?.full_name || "Administrator" })}
        </Text>
        <Text style={styles.roleText}>
          {t(`common.roles.${profile?.role || "worker"}`)}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="briefcase" size={32} color="#2563eb" />
          <Text style={styles.statNumber}>{stats.activeProjects}</Text>
          <Text style={styles.statLabel}>
            {t("dashboard.stats.active_projects")}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="time" size={32} color="#f59e0b" />
          <Text style={styles.statNumber}>{stats.pendingTasks}</Text>
          <Text style={styles.statLabel}>
            {t("dashboard.stats.pending_tasks")}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={32} color="#10b981" />
          <Text style={styles.statNumber}>{stats.completedTasks}</Text>
          <Text style={styles.statLabel}>
            {t("dashboard.stats.completed_tasks")}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("dashboard.quick_actions.title")}
        </Text>

        <View style={styles.actionsGrid}>
          {canCreateProject && (
            <Link href="/projects/new" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="add-circle" size={48} color="#2563eb" />
                <Text style={styles.actionText}>
                  {t("dashboard.quick_actions.add_project")}
                </Text>
              </TouchableOpacity>
            </Link>
          )}

          {canCreateTask && (
            <Link href="/tasks/new" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="add-circle" size={48} color="#10b981" />
                <Text style={styles.actionText}>
                  {t("dashboard.quick_actions.add_task")}
                </Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      </View>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
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
    marginBottom: 16,
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
    minWidth: "47%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginTop: 8,
  },
});
