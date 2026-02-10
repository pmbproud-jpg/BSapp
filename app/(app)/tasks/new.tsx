import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";
import LocalizedDatePicker from "@/components/LocalizedDatePicker";
import type { Database } from "@/src/lib/supabase/database.types";

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high";
type User = Database["public"]["Tables"]["profiles"]["Row"];

export default function NewTaskScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { project_id } = useLocalSearchParams<{ project_id: string }>();
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [planUsers, setPlanUsers] = useState<User[]>([]);
  const [projectUsers, setProjectUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: null as Date | null,
    status: "pending" as TaskStatus,
    priority: "medium" as TaskPriority,
  });

  const statusOptions: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"];
  const priorityOptions: TaskPriority[] = ["low", "medium", "high"];

  useEffect(() => {
    if (!project_id) {
      Alert.alert(t("common.error"), "Project ID is required");
      router.back();
      return;
    }
    fetchProjectName();
    fetchUsers();
  }, [project_id]);

  const fetchProjectName = async () => {
    if (!project_id) return;
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("id", project_id)
        .single();

      if (error) throw error;
      setProjectName(data?.name || "");
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  };

  const fetchUsers = async () => {
    if (!project_id) return;
    try {
      let planWorkerIds: string[] = [];

      // 1. Pracownicy z planu dziennego
      const { data: planReqs } = await (supabaseAdmin.from("plan_requests") as any)
        .select("id")
        .eq("project_id", project_id);

      if (planReqs && planReqs.length > 0) {
        const reqIds = planReqs.map((r: any) => r.id);
        const { data: planAssign } = await (supabaseAdmin.from("plan_assignments") as any)
          .select("worker_id")
          .in("request_id", reqIds);

        if (planAssign && planAssign.length > 0) {
          planWorkerIds = [...new Set(planAssign.map((a: any) => a.worker_id))] as string[];
          const { data: pw } = await (supabaseAdmin.from("profiles") as any)
            .select("*")
            .in("id", planWorkerIds)
            .order("full_name");
          setPlanUsers(pw || []);
        }
      }

      // 2. Członkowie projektu (bez tych z planu)
      const { data: members } = await (supabaseAdmin.from("project_members") as any)
        .select("user_id")
        .eq("project_id", project_id);

      if (members && members.length > 0) {
        const memberIds = members.map((m: any) => m.user_id).filter((mid: string) => !planWorkerIds.includes(mid));
        if (memberIds.length > 0) {
          const { data: mp } = await (supabaseAdmin.from("profiles") as any)
            .select("*")
            .in("id", memberIds)
            .order("full_name");
          setProjectUsers(mp || []);
        }
      }

      // 3. Fallback: wszyscy (jeśli brak planu i członków)
      const allPlan = planWorkerIds.length > 0 ? planWorkerIds : [];
      const allMembers = members ? members.map((m: any) => m.user_id) : [];
      const combined = [...new Set([...allPlan, ...allMembers])];
      if (combined.length > 0) {
        const { data: cp } = await (supabaseAdmin.from("profiles") as any)
          .select("*")
          .in("id", combined)
          .order("full_name");
        setUsers(cp || []);
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("full_name");
        if (error) throw error;
        setUsers(data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Formatowanie daty do ISO string dla bazy danych
  const formatDateForDB = (date: Date | null): string | null => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      Alert.alert(t("common.error"), t("tasks.title_required"));
      return;
    }

    setLoading(true);
    const taskData: any = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      project_id: project_id,
    };

    if (formData.assigned_to) {
      taskData.assigned_to = formData.assigned_to;
    }
    if (formData.due_date) {
      taskData.due_date = formatDateForDB(formData.due_date);
    }

    try {
      console.log("[TASK] Inserting task:", JSON.stringify(taskData, null, 2));

      const { data, error } = await (supabaseAdmin
        .from("tasks") as any)
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      if (Platform.OS === "web") {
        window.alert(t("tasks.created_success"));
      } else {
        Alert.alert(t("common.success"), t("tasks.created_success"));
      }
      // Wróć do projektu, nie do dashboard
      router.replace(`/projects/${project_id}` as any);
    } catch (error: any) {
      console.error("Error creating task:", JSON.stringify(error, null, 2));
      console.error("Task data was:", JSON.stringify(taskData, null, 2));
      const errMsg = error?.message || error?.details || t("tasks.create_error");
      if (Platform.OS === "web") {
        window.alert(errMsg);
      } else {
        Alert.alert(t("common.error"), errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => project_id ? router.replace(`/projects/${project_id}` as any) : router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("tasks.new")}{projectName ? ` — ${projectName}` : ""}</Text>
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
            <Text style={styles.label}>{t("tasks.assigned_to")}</Text>
            <TouchableOpacity
              style={[
                styles.selectOption,
                !formData.assigned_to && styles.selectOptionActive,
                { alignSelf: "flex-start", marginBottom: 8 },
              ]}
              onPress={() => setFormData({ ...formData, assigned_to: "" })}
            >
              <Text
                style={[
                  styles.selectOptionText,
                  !formData.assigned_to && styles.selectOptionTextActive,
                ]}
              >
                — {t("common.none")}
              </Text>
            </TouchableOpacity>

            {planUsers.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#10b981", marginBottom: 4, textTransform: "uppercase" }}>
                  {t("plan.workers_from_plan")}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={styles.horizontalSelectContainer}>
                    {planUsers.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.selectOption,
                          formData.assigned_to === user.id && styles.selectOptionActive,
                          { borderColor: "#10b981" },
                        ]}
                        onPress={() => setFormData({ ...formData, assigned_to: user.id })}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            formData.assigned_to === user.id && styles.selectOptionTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {user.full_name || user.email}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {projectUsers.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>
                  {t("tasks.project_members") || "Członkowie projektu"}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={styles.horizontalSelectContainer}>
                    {projectUsers.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.selectOption,
                          formData.assigned_to === user.id && styles.selectOptionActive,
                        ]}
                        onPress={() => setFormData({ ...formData, assigned_to: user.id })}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            formData.assigned_to === user.id && styles.selectOptionTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {user.full_name || user.email}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {planUsers.length === 0 && projectUsers.length === 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.horizontalSelectContainer}>
                  {users.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.selectOption,
                        formData.assigned_to === user.id && styles.selectOptionActive,
                      ]}
                      onPress={() => setFormData({ ...formData, assigned_to: user.id })}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          formData.assigned_to === user.id && styles.selectOptionTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {user.full_name || user.email}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.priorityLabel")}</Text>
            <View style={styles.statusGrid}>
              {priorityOptions.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.statusOption,
                    formData.priority === priority && styles.statusOptionActive,
                    formData.priority === priority && priority === "high" && styles.priorityHigh,
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
            <Text style={styles.label}>{t("tasks.statusLabel")}</Text>
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
            <LocalizedDatePicker
              label={t("tasks.due_date")}
              value={formData.due_date}
              onChange={(date) => setFormData({ ...formData, due_date: date })}
              placeholder={t("common.select_date")}
              minimumDate={new Date()}
            />
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
  horizontalSelectContainer: {
    flexDirection: "row",
    gap: 8,
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
    minWidth: 60,
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
  priorityHigh: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
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
