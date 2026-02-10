import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { formatDate, formatDateRange } from "@/src/utils/dateFormatter";
import type { Database } from "@/src/lib/supabase/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  project_members?: { count: number }[];
};

export default function ProjectsScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isZarzad = profile?.role === "zarzad";
  const isPM = profile?.role === "project_manager";
  const canCreate = isAdmin || isZarzad || isPM;

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_members(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "#f59e0b",
      active: "#10b981",
      on_hold: "#ef4444",
      completed: "#6366f1",
      cancelled: "#64748b",
    };
    return colors[status] || "#94a3b8";
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      planning: "construct",
      active: "play-circle",
      on_hold: "pause-circle",
      completed: "checkmark-circle",
      cancelled: "close-circle",
    };
    return icons[status] || "help-circle";
  };

  const renderProject = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => router.push(`/projects/${item.id}`)}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectTitleRow}>
          <Ionicons name="briefcase-outline" size={20} color="#2563eb" />
          <Text style={styles.projectName}>{item.name}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(item.status)}20` },
          ]}
        >
          <Ionicons
            name={getStatusIcon(item.status)}
            size={14}
            color={getStatusColor(item.status)}
          />
          <Text
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {t(`projects.status.${item.status}`)}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={styles.projectDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.projectFooter}>
        {item.location && (
          <View style={styles.projectInfo}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.projectInfoText}>{item.location}</Text>
          </View>
        )}
        {item.start_date && (
          <View style={styles.projectInfo}>
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <Text style={styles.projectInfoText}>
              {formatDate(item.start_date, i18n.language, 'short')}
            </Text>
          </View>
        )}
        {item.project_members && item.project_members[0]?.count > 0 && (
          <View style={styles.projectInfo}>
            <Ionicons name="people-outline" size={14} color="#2563eb" />
            <Text style={[styles.projectInfoText, { color: "#2563eb" }]}>
              {item.project_members[0].count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {projects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="briefcase-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t("projects.empty")}</Text>
          {canCreate && (
            <Text style={styles.emptySubtext}>
              {t("projects.empty_subtitle")}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={projects}
          renderItem={renderProject}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563eb"
            />
          }
        />
      )}

      {canCreate && (
        <Link href="/projects/new" asChild>
          <TouchableOpacity style={styles.fab}>
            <Ionicons name="add" size={28} color="#ffffff" />
          </TouchableOpacity>
        </Link>
      )}
    </View>
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
  listContainer: {
    padding: 16,
  },
  projectCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  projectTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  projectDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
    lineHeight: 20,
  },
  projectFooter: {
    flexDirection: "row",
    gap: 16,
  },
  projectInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  projectInfoText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
