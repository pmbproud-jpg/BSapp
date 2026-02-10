import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";
import type { Database } from "@/src/lib/supabase/database.types";

const openLink = (url: string) => {
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    Linking.openURL(url);
  }
};

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];

type ProjectInfo = {
  id: string;
  name: string;
  status: string;
  location: string | null;
  role: string;
  joined_at: string;
};

const roleColors: Record<string, string> = {
  admin: "#ef4444",
  management: "#f59e0b",
  project_manager: "#3b82f6",
  bauleiter: "#10b981",
  worker: "#64748b",
};

const roleIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  admin: "shield",
  management: "briefcase",
  project_manager: "clipboard",
  bauleiter: "construct",
  worker: "hammer",
};

const statusColors: Record<string, string> = {
  planning: "#8b5cf6",
  active: "#10b981",
  on_hold: "#f59e0b",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { profile: currentUser } = useAuth();

  const [user, setUser] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hidePhone, setHidePhone] = useState(false);
  const [hideEmail, setHideEmail] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    role: "worker" as string,
  });

  const canEdit =
    currentUser?.role === "admin" ||
    currentUser?.role === "management" ||
    currentUser?.role === "project_manager";

  const canManageVisibility =
    currentUser?.role === "admin" || currentUser?.role === "management";

  const fetchUser = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await (supabase
        .from("profiles") as any)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setUser(data as Profile);
      setEditData({
        full_name: (data as any).full_name || "",
        phone: (data as any).phone || "",
        role: (data as any).role,
      });
      setHidePhone(!!(data as any).hide_phone);
      setHideEmail(!!(data as any).hide_email);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }, [id]);

  const fetchProjects = useCallback(async () => {
    if (!id) return;
    try {
      // Get projects where user is a member
      const { data: memberData, error: memberError } = await (supabase
        .from("project_members") as any)
        .select("project_id, role, joined_at")
        .eq("user_id", id);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const projectIds = memberData.map((m: any) => m.project_id);
        const { data: projectData, error: projectError } = await (supabase
          .from("projects") as any)
          .select("id, name, status, location")
          .in("id", projectIds);

        if (projectError) throw projectError;

        const combined: ProjectInfo[] = (projectData || []).map((p: any) => {
          const member = memberData.find((m: any) => m.project_id === p.id);
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            location: p.location,
            role: member?.role || "",
            joined_at: member?.joined_at || "",
          };
        });
        setProjects(combined);
      } else {
        // Also check if user is PM or BL on any project
        const { data: pmData } = await (supabase
          .from("projects") as any)
          .select("id, name, status, location")
          .or(`project_manager_id.eq.${id},bauleiter_id.eq.${id}`);

        if (pmData && pmData.length > 0) {
          setProjects(
            pmData.map((p: any) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              location: p.location,
              role: "manager",
              joined_at: "",
            }))
          );
        } else {
          setProjects([]);
        }
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUser(), fetchProjects()]);
      setLoading(false);
    };
    load();
  }, [fetchUser, fetchProjects]);

  const saveProfile = async () => {
    if (!id || !canEdit) return;
    setSaving(true);
    try {
      const { error } = await (supabaseAdmin.from("profiles") as any)
        .update({
          full_name: editData.full_name.trim(),
          phone: editData.phone.trim() || null,
          role: editData.role,
        })
        .eq("id", id);

      if (error) throw error;

      setEditing(false);
      fetchUser();
      const msg = t("users.update_success") || "Profil zaktualizowany";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (error) {
      console.error("Error updating profile:", error);
      const msg = t("users.update_error") || "Błąd aktualizacji profilu";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const toggleVisibility = async (field: "hide_phone" | "hide_email", value: boolean) => {
    if (!id) return;
    try {
      const { error } = await (supabaseAdmin.from("profiles") as any)
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
      if (field === "hide_phone") setHidePhone(value);
      else setHideEmail(value);
      const msg = t("users.visibility_updated") || "Widoczność zaktualizowana";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error toggling visibility:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    }
  };

  const roles: { key: string; label: string }[] = [
    { key: "admin", label: "Admin" },
    { key: "management", label: t("common.roles.management") || "Zarząd" },
    { key: "project_manager", label: "PM" },
    { key: "bauleiter", label: "BL" },
    { key: "worker", label: "Worker" },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>Użytkownik nie znaleziony</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          router.replace("/users" as any);
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("users.profile") || "Profil użytkownika"}
        </Text>
        {canEdit && !editing && (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={20} color="#2563eb" />
            <Text style={styles.editBtnText}>
              {t("users.edit_profile") || "Edytuj"}
            </Text>
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity
            onPress={() => {
              setEditing(false);
              setEditData({
                full_name: user.full_name || "",
                phone: user.phone || "",
                role: user.role,
              });
            }}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar & Name */}
      <View style={styles.avatarSection}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: `${roleColors[user.role] || "#64748b"}20` },
          ]}
        >
          <Ionicons
            name={roleIcons[user.role] || "person"}
            size={40}
            color={roleColors[user.role] || "#64748b"}
          />
        </View>
        <Text style={styles.userName}>
          {user.full_name || user.email}
        </Text>
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: `${roleColors[user.role] || "#64748b"}20` },
          ]}
        >
          <Text
            style={[
              styles.roleText,
              { color: roleColors[user.role] || "#64748b" },
            ]}
          >
            {t(`common.roles.${user.role}`) || user.role}
          </Text>
        </View>
      </View>

      {/* Personal Data Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("users.personal_data") || "Dane osobowe"}
        </Text>

        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.fieldLabel}>
              {t("users.full_name") || "Imię i Nazwisko"}
            </Text>
            <TextInput
              style={styles.input}
              value={editData.full_name}
              onChangeText={(v) =>
                setEditData((prev) => ({ ...prev, full_name: v }))
              }
              placeholder={t("users.full_name") || "Imię i Nazwisko"}
            />

            <Text style={styles.fieldLabel}>
              {t("users.phone") || "Telefon"}
            </Text>
            <TextInput
              style={styles.input}
              value={editData.phone}
              onChangeText={(v) =>
                setEditData((prev) => ({ ...prev, phone: v }))
              }
              placeholder={t("users.phone") || "Telefon"}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>
              {t("users.role") || "Funkcja"}
            </Text>
            <View style={styles.roleSelector}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.roleOption,
                    editData.role === r.key && {
                      backgroundColor: roleColors[r.key] || "#64748b",
                    },
                  ]}
                  onPress={() =>
                    setEditData((prev) => ({ ...prev, role: r.key }))
                  }
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      editData.role === r.key && { color: "#fff" },
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {t("users.save") || "Zapisz"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <Ionicons name="person-outline" size={18} color="#64748b" />
              <Text style={styles.dataLabel}>
                {t("users.full_name") || "Imię i Nazwisko"}
              </Text>
              <Text style={styles.dataValue}>
                {user.full_name || "—"}
              </Text>
            </View>
            <View style={styles.separator} />

            {/* Email - ukryty jeśli hide_email i nie admin/zarząd */}
            {(!hideEmail || canManageVisibility) && (
              <>
                <TouchableOpacity
                  style={styles.dataRow}
                  onPress={() => user.email && openLink(`mailto:${user.email}`)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="mail-outline" size={18} color="#64748b" />
                  <Text style={styles.dataLabel}>Email</Text>
                  {hideEmail && !canManageVisibility ? (
                    <Text style={[styles.dataValue, { color: "#94a3b8" }]}>{t("users.hidden") || "Ukryty"}</Text>
                  ) : (
                    <>
                      <Text style={[styles.dataValue, user.email && styles.linkText]}>
                        {user.email}
                      </Text>
                      {user.email && <Ionicons name="open-outline" size={14} color="#2563eb" />}
                    </>
                  )}
                </TouchableOpacity>
                {canManageVisibility && (
                  <TouchableOpacity
                    style={styles.visibilityRow}
                    onPress={() => toggleVisibility("hide_email", !hideEmail)}
                  >
                    <Ionicons name={hideEmail ? "eye-off" : "eye"} size={16} color={hideEmail ? "#ef4444" : "#10b981"} />
                    <Text style={[styles.visibilityText, { color: hideEmail ? "#ef4444" : "#10b981" }]}>
                      {hideEmail ? (t("users.email_hidden") || "Email ukryty") : (t("users.email_visible") || "Email widoczny")}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.separator} />
              </>
            )}

            {/* Telefon - ukryty jeśli hide_phone i nie admin/zarząd */}
            {(!hidePhone || canManageVisibility) && (
              <>
                <TouchableOpacity
                  style={styles.dataRow}
                  onPress={() => user.phone && !hidePhone && openLink(`tel:${user.phone}`)}
                  activeOpacity={user.phone && !hidePhone ? 0.6 : 1}
                  disabled={!user.phone || hidePhone}
                >
                  <Ionicons name="call-outline" size={18} color="#64748b" />
                  <Text style={styles.dataLabel}>
                    {t("users.phone") || "Telefon"}
                  </Text>
                  {hidePhone && !canManageVisibility ? (
                    <Text style={[styles.dataValue, { color: "#94a3b8" }]}>{t("users.hidden") || "Ukryty"}</Text>
                  ) : (
                    <>
                      <Text style={[styles.dataValue, user.phone && styles.linkText]}>
                        {user.phone || "—"}
                      </Text>
                      {user.phone && <Ionicons name="call" size={14} color="#2563eb" />}
                    </>
                  )}
                </TouchableOpacity>
                {canManageVisibility && (
                  <TouchableOpacity
                    style={styles.visibilityRow}
                    onPress={() => toggleVisibility("hide_phone", !hidePhone)}
                  >
                    <Ionicons name={hidePhone ? "eye-off" : "eye"} size={16} color={hidePhone ? "#ef4444" : "#10b981"} />
                    <Text style={[styles.visibilityText, { color: hidePhone ? "#ef4444" : "#10b981" }]}>
                      {hidePhone ? (t("users.phone_hidden") || "Telefon ukryty") : (t("users.phone_visible") || "Telefon widoczny")}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.separator} />
              </>
            )}

            <View style={styles.dataRow}>
              <Ionicons name="shield-outline" size={18} color="#64748b" />
              <Text style={styles.dataLabel}>
                {t("users.role") || "Funkcja"}
              </Text>
              <Text
                style={[
                  styles.dataValue,
                  { color: roleColors[user.role] || "#64748b", fontWeight: "600" },
                ]}
              >
                {t(`common.roles.${user.role}`) || user.role}
              </Text>
            </View>
            <View style={styles.separator} />

            <View style={styles.dataRow}>
              <Ionicons name="calendar-outline" size={18} color="#64748b" />
              <Text style={styles.dataLabel}>
                {t("users.member_since") || "Członek od"}
              </Text>
              <Text style={styles.dataValue}>
                {formatDate(user.created_at)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Assigned Projects Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("users.assigned_projects") || "Przypisane budowy"}
        </Text>

        {projects.length === 0 ? (
          <View style={styles.emptyProjects}>
            <Ionicons name="business-outline" size={32} color="#cbd5e1" />
            <Text style={styles.emptyProjectsText}>
              {t("users.no_projects") || "Brak przypisanych budów"}
            </Text>
          </View>
        ) : (
          projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.projectCard}
              onPress={() => router.push(`/projects/${project.id}` as any)}
            >
              <View style={styles.projectHeader}>
                <Ionicons
                  name="business"
                  size={20}
                  color={statusColors[project.status] || "#64748b"}
                />
                <Text style={styles.projectName}>{project.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: `${statusColors[project.status] || "#64748b"}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: statusColors[project.status] || "#64748b",
                      },
                    ]}
                  >
                    {t(`projects.status.${project.status}`) || project.status}
                  </Text>
                </View>
              </View>
              {project.location && (
                <View style={styles.projectLocation}>
                  <Ionicons name="location-outline" size={14} color="#94a3b8" />
                  <Text style={styles.locationText}>{project.location}</Text>
                </View>
              )}
              {project.joined_at && (
                <Text style={styles.joinedText}>
                  {t("users.member_since") || "Od"}: {formatDate(project.joined_at)}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#94a3b8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  editBtnText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  dataCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  dataLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#64748b",
  },
  dataValue: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
    maxWidth: "50%",
    textAlign: "right",
  },
  linkText: {
    color: "#2563eb",
    textDecorationLine: "underline",
  },
  separator: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  editForm: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1e293b",
  },
  roleSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  roleOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyProjects: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyProjectsText: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
  },
  projectCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  projectName: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  projectLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginLeft: 28,
  },
  locationText: {
    marginLeft: 4,
    fontSize: 13,
    color: "#94a3b8",
  },
  joinedText: {
    marginTop: 4,
    marginLeft: 28,
    fontSize: 12,
    color: "#94a3b8",
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 28,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
