import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import type { Database } from "@/src/lib/supabase/database.types";

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high";
type Project = Database["public"]["Tables"]["projects"]["Row"];
type User = Database["public"]["Tables"]["profiles"]["Row"];

export default function NewTaskScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    project_id: "",
    assigned_to: "",
    due_date: "",
    status: "pending" as TaskStatus,
    priority: "medium" as TaskPriority,
  });

  const statusOptions: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"];
  const priorityOptions: TaskPriority[] = ["low", "medium", "high"];

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .in("status", ["planning", "active"])
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert(t("common.error"), t("tasks.title_required"));
      return;
    }

    setLoading(true);
    try {
      const taskData: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        created_by: profile?.id,
      };

      if (formData.project_id) {
        taskData.project_id = formData.project_id;
      }
      if (formData.assigned_to) {
        taskData.assigned_to = formData.assigned_to;
      }
      if (formData.due_date) {
        taskData.due_date = formData.due_date;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      Alert.alert(t("common.success"), t("tasks.created_success"), [
        {
          text: t("common.ok"),
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error creating task:", error);
      Alert.alert(t("common.error"), t("tasks.create_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("tasks.new")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("tasks.title")} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder={t("tasks.title_placeholder")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder={t("tasks.description_placeholder")}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.project")}</Text>
            <View style={styles.selectContainer}>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.selectOption,
                    formData.project_id === project.id &&
                      styles.selectOptionActive,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, project_id: project.id })
                  }
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      formData.project_id === project.id &&
                        styles.selectOptionTextActive,
                    ]}
                  >
                    {project.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.assigned_to")}</Text>
            <View style={styles.selectContainer}>
              {users.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[
                    styles.selectOption,
                    formData.assigned_to === user.id && styles.selectOptionActive,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, assigned_to: user.id })
                  }
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      formData.assigned_to === user.id &&
                        styles.selectOptionTextActive,
                    ]}
                  >
                    {user.full_name || user.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.priority")}</Text>
            <View style={styles.statusGrid}>
              {priorityOptions.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.statusOption,
                    formData.priority === priority && styles.statusOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, priority })}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      formData.priority === priority &&
                        styles.statusOptionTextActive,
                    ]}
                  >
                    {t(`tasks.priority.${priority}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.status")}</Text>
            <View style={styles.statusGrid}>
              {statusOptions.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    formData.status === status && styles.statusOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status })}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      formData.status === status &&
                        styles.statusOptionTextActive,
                    ]}
                  >
                    {t(`tasks.status.${status}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.due_date")}</Text>
            <TextInput
              style={styles.input}
              value={formData.due_date}
              onChangeText={(text) =>
                setFormData({ ...formData, due_date: text })
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.hint}>{t("tasks.date_format")}</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? t("common.loading") : t("tasks.create")}
            </Text>
          </TouchableOpacity>
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
    textAlign: "center",
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  selectContainer: {
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  selectOptionActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  selectOptionTextActive: {
    color: "#ffffff",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  statusOptionActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  statusOptionTextActive: {
    color: "#ffffff",
  },
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
