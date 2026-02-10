import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";
import LocalizedDatePicker from "@/components/LocalizedDatePicker";
import MultiSelectUsers from "@/components/MultiSelectUsers";

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role?: string;
}

export default function NewProjectScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    start_date: null as Date | null,
    end_date: null as Date | null,
    budget: "",
    status: "planning" as ProjectStatus,
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedPM, setSelectedPM] = useState<TeamMember | null>(null);
  const [selectedBL, setSelectedBL] = useState<TeamMember | null>(null);
  const [showUserPicker, setShowUserPicker] = useState<"pm" | "bl" | null>(null);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const canAssignPMBL = profile?.role === "admin" || profile?.role === "management";

  const statusOptions: ProjectStatus[] = [
    "planning",
    "active",
    "on_hold",
    "completed",
    "cancelled",
  ];

  // Formatowanie daty do ISO string dla bazy danych
  const formatDateForDB = (date: Date | null): string | null => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchUsersForPicker = async (type: "pm" | "bl") => {
    setUsersLoading(true);
    try {
      const { data, error } = await (supabaseAdmin
        .from("profiles") as any)
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id)
        .order("full_name");
      if (error) throw error;
      setAvailableUsers(data || []);
      setShowUserPicker(type);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const selectUser = (user: TeamMember) => {
    if (showUserPicker === "pm") setSelectedPM(user);
    else if (showUserPicker === "bl") setSelectedBL(user);
    setShowUserPicker(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert(t("common.error"), t("projects.name_required"));
      return;
    }

    setLoading(true);
    try {
      // 1. Tworzenie projektu
      const projectData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        location: formData.location.trim() || null,
        status: formData.status,
        company_id: profile?.company_id,
        created_by: profile?.id,
        project_manager_id: selectedPM?.id || null,
        bauleiter_id: selectedBL?.id || null,
      };

      if (formData.start_date) {
        projectData.start_date = formatDateForDB(formData.start_date);
      }
      if (formData.end_date) {
        projectData.end_date = formatDateForDB(formData.end_date);
      }
      if (formData.budget) {
        projectData.budget = parseFloat(formData.budget);
      }

      const { data: project, error: projectError } = await (supabaseAdmin
        .from("projects") as any)
        .insert(projectData)
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Dodawanie członków zespołu
      if (teamMembers.length > 0 && project) {
        const membersData = teamMembers.map((member) => ({
          project_id: project.id,
          user_id: member.id,
          role: member.role || "member",
        }));

        const { error: membersError } = await (supabaseAdmin
          .from("project_members") as any)
          .insert(membersData);

        if (membersError) {
          console.error("Error adding team members:", membersError);
          // Nie przerywamy - projekt został utworzony
        }
      }

      if (Platform.OS === "web") {
        window.alert(t("projects.created_success"));
      } else {
        Alert.alert(t("common.success"), t("projects.created_success"));
      }
      router.replace("/projects");
    } catch (error) {
      console.error("Error creating project:", error);
      if (Platform.OS === "web") {
        window.alert(t("projects.create_error"));
      } else {
        Alert.alert(t("common.error"), t("projects.create_error"));
      }
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
        <Text style={styles.headerTitle}>{t("projects.new")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("projects.name")} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder={t("projects.name_placeholder")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder={t("projects.description_placeholder")}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.location")}</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) =>
                setFormData({ ...formData, location: text })
              }
              placeholder={t("projects.location_placeholder")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.statusLabel")}</Text>
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
                    {t(`projects.status.${status}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <LocalizedDatePicker
              label={t("projects.start_date")}
              value={formData.start_date}
              onChange={(date) => setFormData({ ...formData, start_date: date })}
              placeholder={t("common.select_date")}
              maximumDate={formData.end_date || undefined}
            />
          </View>

          <View style={styles.field}>
            <LocalizedDatePicker
              label={t("projects.end_date")}
              value={formData.end_date}
              onChange={(date) => setFormData({ ...formData, end_date: date })}
              placeholder={t("common.select_date")}
              minimumDate={formData.start_date || undefined}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.budget")}</Text>
            <TextInput
              style={styles.input}
              value={formData.budget}
              onChangeText={(text) => setFormData({ ...formData, budget: text })}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>{t("projects.budget_hint")}</Text>
          </View>

          {/* PM & BL - tylko admin i zarząd */}
          {canAssignPMBL && (
            <>
              <View style={styles.sectionDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.sectionTitle}>PM / BL</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("common.roles.project_manager")}</Text>
                {selectedPM ? (
                  <View style={styles.selectedUserCard}>
                    <Ionicons name="person-circle" size={28} color="#3b82f6" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.selectedUserName}>{selectedPM.full_name || selectedPM.email}</Text>
                      <Text style={styles.selectedUserEmail}>{selectedPM.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedPM(null)}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.selectUserBtn} onPress={() => fetchUsersForPicker("pm")} disabled={usersLoading}>
                    <Ionicons name="person-add-outline" size={18} color="#2563eb" />
                    <Text style={styles.selectUserBtnText}>{t("common.select")}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("common.roles.bauleiter")}</Text>
                {selectedBL ? (
                  <View style={styles.selectedUserCard}>
                    <Ionicons name="person-circle" size={28} color="#10b981" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.selectedUserName}>{selectedBL.full_name || selectedBL.email}</Text>
                      <Text style={styles.selectedUserEmail}>{selectedBL.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedBL(null)}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.selectUserBtn} onPress={() => fetchUsersForPicker("bl")} disabled={usersLoading}>
                    <Ionicons name="person-add-outline" size={18} color="#10b981" />
                    <Text style={styles.selectUserBtnText}>{t("common.select")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Sekcja Zespołu */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.sectionTitle}>
              <Ionicons name="people" size={16} color="#64748b" /> {t("team.title")}
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.field}>
            <MultiSelectUsers
              label={t("team.members")}
              selectedUsers={teamMembers}
              onChange={setTeamMembers}
              placeholder={t("team.add_members")}
              projectRoles={true}
            />
          </View>

          {/* Modal wyboru użytkownika PM/BL */}
          <Modal visible={showUserPicker !== null} transparent animationType="slide" onRequestClose={() => setShowUserPicker(null)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {showUserPicker === "pm" ? t("common.roles.project_manager") : t("common.roles.bauleiter")}
                  </Text>
                  <TouchableOpacity onPress={() => setShowUserPicker(null)}>
                    <Ionicons name="close" size={24} color="#1e293b" />
                  </TouchableOpacity>
                </View>
                {usersLoading ? (
                  <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
                ) : (
                  <FlatList
                    data={availableUsers}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 400 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.userPickerItem} onPress={() => selectUser(item)}>
                        <Ionicons name="person-circle-outline" size={28} color={showUserPicker === "pm" ? "#3b82f6" : "#10b981"} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.userPickerName}>{item.full_name || item.email}</Text>
                          <Text style={styles.userPickerEmail}>{item.email}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          </Modal>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? t("common.loading") : t("projects.create")}
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
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
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
  selectedUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
  },
  selectedUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  selectedUserEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  selectUserBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderStyle: "dashed",
    paddingVertical: 14,
  },
  selectUserBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  userPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  userPickerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  userPickerEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
});
