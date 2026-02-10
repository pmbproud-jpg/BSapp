import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { formatDate } from "@/src/utils/dateFormatter";
import type { Database } from "@/src/lib/supabase/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  profiles: Profile;
}

export default function ProjectDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";
  const isZarzad = profile?.role === "zarzad";
  const isPM = profile?.role === "project_manager";
  const canEdit = isAdmin || isZarzad || isPM;

  useEffect(() => {
    fetchProjectDetails();
    fetchProjectTasks();
    fetchTeamMembers();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error("Error fetching project:", error);
      Alert.alert(t("common.error"), t("projects.fetch_error"));
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("*, profiles(*)")
        .eq("project_id", id);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
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

  const getTaskStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "#f59e0b",
      in_progress: "#3b82f6",
      completed: "#10b981",
      cancelled: "#64748b",
    };
    return colors[status] || "#94a3b8";
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      leader: "#2563eb",
      member: "#10b981",
      observer: "#64748b",
    };
    return colors[role] || "#94a3b8";
  };

  const deleteProject = async () => {
    Alert.alert(
      t("projects.delete_confirm_title"),
      t("projects.delete_confirm_message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("projects")
                .delete()
                .eq("id", id);

              if (error) throw error;
              router.back();
            } catch (error) {
              console.error("Error deleting project:", error);
              Alert.alert(t("common.error"), t("projects.delete_error"));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t("projects.not_found")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("projects.details")}</Text>
        {canEdit && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push(`/projects/${id}/edit`)}
              style={styles.iconButton}
            >
              <Ionicons name="create-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteProject} style={styles.iconButton}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Informacje o projekcie */}
        <View style={styles.card}>
          <View style={styles.projectHeader}>
            <Text style={styles.projectName}>{project.name}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(project.status)}20` },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(project.status) },
                ]}
              >
                {t(`projects.status.${project.status}`)}
              </Text>
            </View>
          </View>

          {project.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("projects.description")}</Text>
              <Text style={styles.description}>{project.description}</Text>
            </View>
          )}

          <View style={styles.infoGrid}>
            {project.location && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="location-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("projects.location")}</Text>
                </View>
                <Text style={styles.infoValue}>{project.location}</Text>
              </View>
            )}

            {project.start_date && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("projects.start_date")}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {formatDate(project.start_date, i18n.language)}
                </Text>
              </View>
            )}

            {project.end_date && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("projects.end_date")}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {formatDate(project.end_date, i18n.language)}
                </Text>
              </View>
            )}

            {project.budget && (
              <View style={styles.infoItem}>
                <View style={styles.infoLabel}>
                  <Ionicons name="cash-outline" size={18} color="#64748b" />
                  <Text style={styles.infoLabelText}>{t("projects.budget")}</Text>
                </View>
                <Text style={styles.infoValue}>
                  {project.budget.toLocaleString()} €
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Sekcja Zespołu */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="people" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>{t("team.title")}</Text>
            </View>
            <Text style={styles.memberCount}>{teamMembers.length}</Text>
          </View>

          {teamMembers.length === 0 ? (
            <Text style={styles.emptyText}>{t("team.no_members")}</Text>
          ) : (
            <View style={styles.teamList}>
              {teamMembers.map((member) => (
                <View key={member.id} style={styles.teamMember}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {(member.profiles?.full_name || member.profiles?.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.profiles?.full_name || member.profiles?.email}
                    </Text>
                    <Text style={styles.memberEmail}>
                      {member.profiles?.email}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: `${getRoleColor(member.role)}20` },
                    ]}
                  >
                    <Text
                      style={[styles.roleText, { color: getRoleColor(member.role) }]}
                    >
                      {t(`team.roles.${member.role}`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sekcja Zadań */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="checkbox-outline" size={20} color="#10b981" />
              <Text style={styles.sectionTitle}>{t("tasks.title")}</Text>
            </View>
            <Text style={styles.taskCount}>{tasks.length}</Text>
          </View>

          {tasks.length === 0 ? (
            <Text style={styles.emptyText}>{t("tasks.empty_project")}</Text>
          ) : (
            tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => router.push(`/tasks/${task.id}`)}
              >
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View
                    style={[
                      styles.taskStatusBadge,
                      {
                        backgroundColor: `${getTaskStatusColor(task.status)}20`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.taskStatusText,
                        { color: getTaskStatusColor(task.status) },
                      ]}
                    >
                      {t(`tasks.status.${task.status}`)}
                    </Text>
                  </View>
                </View>
                {task.due_date && (
                  <View style={styles.taskMeta}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={styles.taskMetaText}>
                      {formatDate(task.due_date, i18n.language, 'short')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  projectName: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    gap: 6,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoLabelText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "600",
  },
  memberCount: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  taskCount: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 24,
  },
  teamList: {
    gap: 12,
  },
  teamMember: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  memberEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  taskItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1e293b",
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  taskStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskMetaText: {
    fontSize: 12,
    color: "#64748b",
  },
  errorText: {
    fontSize: 16,
    color: "#64748b",
  },
});
