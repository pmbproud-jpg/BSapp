import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { formatDate } from "@/src/utils/dateFormatter";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  project_members?: { count: number }[];
};

export default function ProjectsScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "number">("name");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const statusOptions = [
    { value: "planning", icon: "construct" as const, color: "#f59e0b" },
    { value: "active", icon: "play-circle" as const, color: "#10b981" },
    { value: "on_hold", icon: "pause-circle" as const, color: "#ef4444" },
    { value: "completed", icon: "checkmark-circle" as const, color: "#6366f1" },
  ];

  // Load favorites from storage
  useEffect(() => {
    AsyncStorage.getItem("project_favorites").then((val) => {
      if (val) setFavorites(JSON.parse(val));
    });
  }, []);

  const toggleFavorite = async (projectId: string) => {
    const next = favorites.includes(projectId)
      ? favorites.filter((id) => id !== projectId)
      : [...favorites, projectId];
    setFavorites(next);
    await AsyncStorage.setItem("project_favorites", JSON.stringify(next));
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const perms = usePermissions();
  const { colors: tc } = useTheme();
  const canCreate = perms.canCreateProject;
  const canDelete = perms.canDeleteProject;
  const canImport = perms.canImportData;

  const deleteProject = async (projectId: string, projectName: string) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(t("projects.delete_confirm_message"))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t("projects.delete_confirm_title"),
            t("projects.delete_confirm_message"),
            [
              { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
              { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await (supabaseAdmin
        .from("projects") as any)
        .delete()
        .eq("id", projectId);
      if (error) throw error;
      fetchProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      if (Platform.OS === "web") {
        window.alert(t("projects.delete_error"));
      } else {
        Alert.alert(t("common.error"), t("projects.delete_error"));
      }
    }
  };

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

  useFocusEffect(
    useCallback(() => {
      fetchProjects();
    }, [])
  );

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
      style={[styles.projectCard, { backgroundColor: tc.card, borderColor: tc.border }]}
      onPress={() => router.push(`/projects/${item.id}`)}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectTitleRow}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
            style={{ padding: 2, marginRight: 4 }}
          >
            <Ionicons
              name={favorites.includes(item.id) ? "star" : "star-outline"}
              size={20}
              color={favorites.includes(item.id) ? "#f59e0b" : "#cbd5e1"}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.projectName, { color: tc.text }]}>{item.name}</Text>
            {(item as any).project_number ? (
              <Text style={{ fontSize: 11, color: tc.textSecondary || "#94a3b8", marginLeft: 8, marginTop: 2 }}>{(item as any).project_number}</Text>
            ) : null}
          </View>
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

      {item.description ? (
        <Text style={[styles.projectDescription, { color: tc.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.projectFooter}>
        <View style={styles.projectFooterLeft}>
          {item.location ? (
            <View style={styles.projectInfo}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.projectInfoText}>{item.location}</Text>
            </View>
          ) : null}
          {item.start_date ? (
            <View style={styles.projectInfo}>
              <Ionicons name="calendar-outline" size={14} color="#64748b" />
              <Text style={styles.projectInfoText}>
                {formatDate(item.start_date, i18n.language, 'short')}
              </Text>
            </View>
          ) : null}
          {item.project_members && item.project_members[0]?.count > 0 && (
            <View style={styles.projectInfo}>
              <Ionicons name="people-outline" size={14} color="#2563eb" />
              <Text style={[styles.projectInfoText, { color: "#2563eb" }]}>
                {item.project_members[0].count}
              </Text>
            </View>
          )}
        </View>
        {canDelete && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              deleteProject(item.id, item.name);
            }}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
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
    <View style={[styles.container, { backgroundColor: tc.background }]}>
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
          data={projects
            .filter((p) => {
              if (showFavorites && !favorites.includes(p.id)) return false;
              if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return (p.name || "").toLowerCase().includes(q) || ((p as any).project_number || "").toLowerCase().includes(q) || (p.location || "").toLowerCase().includes(q);
            })
            .sort((a, b) => {
              if (sortBy === "number") return ((a as any).project_number || "").localeCompare((b as any).project_number || "", "de", { numeric: true });
              return (a.name || "").localeCompare(b.name || "", "de");
            })
          }
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
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              {/* Search */}
              <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: tc.border || "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: tc.card, marginBottom: 10, gap: 8 }}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: tc.text, padding: 0 }}
                  placeholder={t("users.search_placeholder") || "Suchen..."}
                  placeholderTextColor="#94a3b8"
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              {/* Status filter + Favorites */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {/* Favorites toggle */}
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: showFavorites ? "#fbbf2420" : (tc.card || "#fff"),
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: showFavorites ? "#f59e0b" : (tc.border || "#e2e8f0"),
                  }}
                  onPress={() => setShowFavorites(!showFavorites)}
                >
                  <Ionicons name={showFavorites ? "star" : "star-outline"} size={14} color={showFavorites ? "#f59e0b" : (tc.textSecondary || "#94a3b8")} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: showFavorites ? "#f59e0b" : (tc.textSecondary || "#64748b") }}>
                    {t("projects.favorites", "Ulubione")}
                  </Text>
                </TouchableOpacity>
                {statusOptions.map((opt) => {
                  const isActive = statusFilter.includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: isActive ? `${opt.color}20` : (tc.card || "#fff"),
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: isActive ? opt.color : (tc.border || "#e2e8f0"),
                      }}
                      onPress={() => toggleStatusFilter(opt.value)}
                    >
                      <Ionicons name={opt.icon} size={14} color={isActive ? opt.color : (tc.textSecondary || "#94a3b8")} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: isActive ? opt.color : (tc.textSecondary || "#64748b") }}>
                        {t(`projects.status.${opt.value}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Sort */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: sortBy === "name" ? "#2563eb" : (tc.card || "#fff"), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: sortBy === "name" ? "#2563eb" : (tc.border || "#e2e8f0") }}
                  onPress={() => setSortBy("name")}
                >
                  <Ionicons name="text" size={14} color={sortBy === "name" ? "#fff" : (tc.textSecondary || "#64748b")} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: sortBy === "name" ? "#fff" : (tc.textSecondary || "#64748b") }}>{t("projects.name") || "Name"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: sortBy === "number" ? "#2563eb" : (tc.card || "#fff"), paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: sortBy === "number" ? "#2563eb" : (tc.border || "#e2e8f0") }}
                  onPress={() => setSortBy("number")}
                >
                  <Ionicons name="list" size={14} color={sortBy === "number" ? "#fff" : (tc.textSecondary || "#64748b")} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: sortBy === "number" ? "#fff" : (tc.textSecondary || "#64748b") }}>Nr. Budowy</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}

      {canImport && (
        <Link href="/projects/import-projects" asChild>
          <TouchableOpacity style={styles.fabImport}>
            <Ionicons name="cloud-upload-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </Link>
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
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectFooterLeft: {
    flexDirection: "row",
    gap: 16,
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 8,
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
    boxShadow: "0 4px 4px rgba(0,0,0,0.3)",
    elevation: 8,
  },
  fabImport: {
    position: "absolute",
    right: 20,
    bottom: 84,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 4px 4px rgba(0,0,0,0.3)",
    elevation: 8,
  },
});
