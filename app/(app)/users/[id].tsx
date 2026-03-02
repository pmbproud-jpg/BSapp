import { roleColors, roleIcons, projectStatusColors as statusColors } from "@/src/constants/colors";
import { useUserAbsences } from "@/src/hooks/useUserAbsences";
import { useUserGPS } from "@/src/hooks/useUserGPS";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { countWorkdays, openLink } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";


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


export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { profile: currentUser } = useAuth();

  const [user, setUser] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [userItems, setUserItems] = useState<any[]>([]);
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

  // ─── Hooks ───
  const gps = useUserGPS(id, t);
  const abs = useUserAbsences(id, currentUser?.id, t);

  // Destructure for JSX compatibility
  const {
    gpsEnabled, setGpsEnabled,
    gpsTogglingLoading,
    lastLocation, setLastLocation,
    locationHistory, showHistory, setShowHistory,
    historyDate, setHistoryDate,
    fetchLastLocation, fetchLocationHistory, toggleGPS, formatTime,
  } = gps;

  const {
    absences, absCalMonth, setAbsCalMonth,
    absShowForm, setAbsShowForm,
    absType, setAbsType,
    absDateFrom, setAbsDateFrom,
    absDateTo, setAbsDateTo,
    absShowFromPicker, setAbsShowFromPicker,
    absShowToPicker, setAbsShowToPicker,
    absNote, setAbsNote,
    absSaving,
    vacationDaysTotal, setVacationDaysTotal,
    absenceTypes, absTypeColor, absTypeLabel,
    statusLabel, statusColor,
    usedVacationDays,
    fetchAbsences, saveAbsence, approveAbsence, rejectAbsence, deleteAbsence,
    getCalendarDays,
  } = abs;

  const canEdit =
    currentUser?.role === "admin" ||
    currentUser?.role === "management" ||
    currentUser?.role === "project_manager";

  const canManageVisibility =
    currentUser?.role === "admin" || currentUser?.role === "management";

  const canManageGPS =
    currentUser?.role === "admin" || currentUser?.role === "management";

  const canApproveAbsence =
    currentUser?.role === "admin" || currentUser?.role === "management" || currentUser?.role === "logistics";

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
      setGpsEnabled(!!(data as any).gps_enabled);
      setVacationDaysTotal((data as any).vacation_days_total ?? 26);
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

  const fetchUserItems = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await (supabase.from("warehouse_items") as any)
        .select("id, iv_pds, beschreibung, serial_nummer, hersteller, menge, status, baustelle, kategorie, art_nr, assigned_to")
        .eq("assigned_to", id)
        .order("beschreibung", { ascending: true });
      if (error) throw error;
      setUserItems(data || []);
    } catch (e) {
      console.error("Error fetching user items:", e);
      setUserItems([]);
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUser(), fetchProjects(), fetchUserItems(), fetchLastLocation(), fetchAbsences()]);
      setLoading(false);
    };
    load();
  }, [fetchUser, fetchProjects, fetchUserItems, fetchLastLocation]);

  const saveProfile = async () => {
    if (!id || !canEdit) return;
    setSaving(true);
    try {
      const { error } = await supabaseAdmin.from("profiles")
        .update({
          full_name: editData.full_name.trim(),
          phone: editData.phone.trim() || null,
          role: editData.role,
        })
        .eq("id", id);

      if (error) throw error;

      setEditing(false);
      fetchUser();
      const msg = t("users.update_success") || "Profil aktualisiert";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (error) {
      console.error("Error updating profile:", error);
      const msg = t("users.update_error") || "Fehler beim Aktualisieren";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const toggleVisibility = async (field: "hide_phone" | "hide_email", value: boolean) => {
    if (!id) return;
    try {
      const { error } = await supabaseAdmin.from("profiles")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
      if (field === "hide_phone") setHidePhone(value);
      else setHideEmail(value);
      const msg = t("users.visibility_updated") || "Sichtbarkeit aktualisiert";
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
    { key: "management", label: t("common.roles.management") || "Geschäftsleitung" },
    { key: "project_manager", label: "PM" },
    { key: "bauleiter", label: "BL" },
    { key: "office_worker", label: t("common.roles.office_worker") || "Büroangestellter" },
    { key: "logistics", label: t("common.roles.logistics") || "Logistik" },
    { key: "purchasing", label: t("common.roles.purchasing") || "Einkauf" },
    { key: "worker", label: t("common.roles.worker") || "Mitarbeiter" },
    { key: "subcontractor", label: t("common.roles.subcontractor") || "Subunternehmer" },
    { key: "warehouse_manager", label: t("common.roles.warehouse_manager") || "Lagerverwalter" },
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
        <Text style={styles.emptyText}>{t("users.not_found") || "Benutzer nicht gefunden"}</Text>
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
          {t("users.profile") || "Benutzerprofil"}
        </Text>
        {canEdit && !editing && (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={20} color="#2563eb" />
            <Text style={styles.editBtnText}>
              {t("users.edit_profile") || "Bearbeiten"}
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
          {t("users.personal_data") || "Persönliche Daten"}
        </Text>

        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.fieldLabel}>
              {t("users.full_name") || "Vollständiger Name"}
            </Text>
            <TextInput
              style={styles.input}
              value={editData.full_name}
              onChangeText={(v) =>
                setEditData((prev) => ({ ...prev, full_name: v }))
              }
              placeholder={t("users.full_name") || "Vollständiger Name"}
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
              {t("users.role") || "Funktion"}
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
                  {t("users.save") || "Speichern"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <Ionicons name="person-outline" size={18} color="#64748b" />
              <Text style={styles.dataLabel}>
                {t("users.full_name") || "Vollständiger Name"}
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
                  onPress={() => user.email && !hideEmail && openLink(`mailto:${user.email}`)}
                  activeOpacity={user.email && !hideEmail ? 0.6 : 1}
                  disabled={!user.email || (hideEmail && !canManageVisibility)}
                >
                  <Ionicons name="mail-outline" size={18} color="#64748b" />
                  <Text style={styles.dataLabel}>Email</Text>
                  {hideEmail ? (
                    canManageVisibility ? (
                      <>
                        <Text style={[styles.dataValue, { color: "#94a3b8" }]}>
                          {user.email}
                        </Text>
                        <Ionicons name="eye-off" size={14} color="#ef4444" style={{ marginLeft: 4 }} />
                      </>
                    ) : (
                      <Text style={[styles.dataValue, { color: "#94a3b8" }]}>{t("users.hidden") || "Versteckt"}</Text>
                    )
                  ) : (
                    <>
                      <Text style={[styles.dataValue, user.email && styles.linkText]}>
                        {user.email}
                      </Text>
                      {user.email ? <Ionicons name="open-outline" size={14} color="#2563eb" /> : null}
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
                      {hideEmail ? (t("users.email_hidden") || "E-Mail versteckt") : (t("users.email_visible") || "E-Mail sichtbar")}
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
                  disabled={!user.phone || (hidePhone && !canManageVisibility)}
                >
                  <Ionicons name="call-outline" size={18} color="#64748b" />
                  <Text style={styles.dataLabel}>
                    {t("users.phone") || "Telefon"}
                  </Text>
                  {hidePhone ? (
                    canManageVisibility ? (
                      <>
                        <Text style={[styles.dataValue, { color: "#94a3b8" }]}>
                          {user.phone || "—"}
                        </Text>
                        <Ionicons name="eye-off" size={14} color="#ef4444" style={{ marginLeft: 4 }} />
                      </>
                    ) : (
                      <Text style={[styles.dataValue, { color: "#94a3b8" }]}>{t("users.hidden") || "Versteckt"}</Text>
                    )
                  ) : (
                    <>
                      <Text style={[styles.dataValue, user.phone && styles.linkText]}>
                        {user.phone || "—"}
                      </Text>
                      {user.phone ? <Ionicons name="call" size={14} color="#2563eb" /> : null}
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
                      {hidePhone ? (t("users.phone_hidden") || "Telefon versteckt") : (t("users.phone_visible") || "Telefon sichtbar")}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.separator} />
              </>
            )}

            <View style={styles.dataRow}>
              <Ionicons name="shield-outline" size={18} color="#64748b" />
              <Text style={styles.dataLabel}>
                {t("users.role") || "Funktion"}
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
                {t("users.member_since") || "Mitglied seit"}
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
          {t("users.assigned_projects") || "Zugewiesene Baustellen"}
        </Text>

        {projects.length === 0 ? (
          <View style={styles.emptyProjects}>
            <Ionicons name="business-outline" size={32} color="#cbd5e1" />
            <Text style={styles.emptyProjectsText}>
              {t("users.no_projects") || "Keine zugewiesenen Baustellen"}
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
              {project.location ? (
                <View style={styles.projectLocation}>
                  <Ionicons name="location-outline" size={14} color="#94a3b8" />
                  <Text style={styles.locationText}>{project.location}</Text>
                </View>
              ) : null}
              {project.joined_at ? (
                <Text style={styles.joinedText}>
                  {t("users.member_since") || "Seit"}: {formatDate(project.joined_at)}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Warehouse items on hand */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("users.items_on_hand") || "Auf Lager (Werkzeuge)"}
        </Text>

        {userItems.length === 0 ? (
          <View style={styles.emptyProjects}>
            <Ionicons name="construct-outline" size={32} color="#cbd5e1" />
            <Text style={styles.emptyProjectsText}>
              {t("users.no_items") || "Keine Werkzeuge auf Lager"}
            </Text>
          </View>
        ) : (
          userItems.map((item: any) => (
            <View key={item.id} style={styles.projectCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="construct" size={18} color="#dc2626" />
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1e293b", flex: 1 }} numberOfLines={1}>
                  {item.beschreibung || "—"}
                </Text>
                {item.menge && (
                  <View style={{ backgroundColor: "#dc262620", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#dc2626" }}>{item.menge}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                {item.iv_pds && <Text style={{ fontSize: 11, color: "#64748b" }}>IV: {item.iv_pds}</Text>}
                {item.serial_nummer && <Text style={{ fontSize: 11, color: "#64748b" }}>SN: {item.serial_nummer}</Text>}
                {item.hersteller && <Text style={{ fontSize: 11, color: "#64748b" }}>{item.hersteller}</Text>}
                {item.kategorie && <Text style={{ fontSize: 11, color: "#64748b" }}>{item.kategorie}</Text>}
              </View>
              {item.baustelle && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="location-outline" size={12} color="#94a3b8" />
                  <Text style={{ fontSize: 11, color: "#94a3b8" }}>{item.baustelle}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Absences / Vacation Section */}
      <View style={styles.section}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar" size={16} color="#ef4444" />{" "}
            {t("users.abs_title") || "Abwesenheiten / Urlaub"}
          </Text>
          {(canEdit || canApproveAbsence) && !absShowForm && (
            <TouchableOpacity
              onPress={() => setAbsShowForm(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
            >
              <Ionicons name="add" size={16} color="#2563eb" />
              <Text style={{ color: "#2563eb", fontWeight: "600", fontSize: 13 }}>{t("users.abs_add") || "Eintragen"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vacation days counter */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#10b981" }}>{vacationDaysTotal - usedVacationDays}</Text>
            <Text style={{ fontSize: 11, color: "#64748b" }}>{t("users.abs_remaining") || "Resturlaub"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#ef4444" }}>{usedVacationDays}</Text>
            <Text style={{ fontSize: 11, color: "#64748b" }}>{t("users.abs_used") || "Genommen"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#1e293b" }}>{vacationDaysTotal}</Text>
            <Text style={{ fontSize: 11, color: "#64748b" }}>{t("users.abs_total") || "Gesamt"}</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.dataCard}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => {
                const [y, m] = absCalMonth.split("-").map(Number);
                const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                setAbsCalMonth(prev);
              }}
              style={{ padding: 6, backgroundColor: "#f1f5f9", borderRadius: 6 }}
            >
              <Ionicons name="chevron-back" size={16} color="#64748b" />
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1e293b" }}>
              {new Date(absCalMonth + "-01").toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const [y, m] = absCalMonth.split("-").map(Number);
                const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                setAbsCalMonth(next);
              }}
              style={{ padding: 6, backgroundColor: "#f1f5f9", borderRadius: 6 }}
            >
              <Ionicons name="chevron-forward" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
          {/* Day headers */}
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#94a3b8" }}>{d}</Text>
            ))}
          </View>
          {/* Day grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {getCalendarDays(absCalMonth).map((cell, idx) => {
              const isToday = cell.date === new Date().toISOString().split("T")[0];
              const hasAbs = cell.absences.length > 0;
              const topAbs = cell.absences[0];
              const dow = (idx % 7);
              const isWeekend = dow === 5 || dow === 6;
              return (
                <View
                  key={idx}
                  style={{
                    width: "14.28%",
                    height: 36,
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 6,
                    backgroundColor: hasAbs ? (absTypeColor(topAbs.type) + "20") : isToday ? "#eff6ff" : "transparent",
                    borderWidth: isToday ? 2 : 0,
                    borderColor: isToday ? "#2563eb" : "transparent",
                  }}
                >
                  {cell.day > 0 && (
                    <>
                      <Text style={{ fontSize: 13, fontWeight: isToday ? "700" : "500", color: hasAbs ? absTypeColor(topAbs.type) : isWeekend ? "#94a3b8" : "#1e293b" }}>
                        {cell.day}
                      </Text>
                      {hasAbs && (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: absTypeColor(topAbs.type), marginTop: 1 }} />
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
          {/* Legend */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" }}>
            {absenceTypes.map((at) => (
              <View key={at.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: at.color }} />
                <Text style={{ fontSize: 10, color: "#64748b" }}>{at.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Add absence form */}
        {absShowForm && (
          <View style={[styles.dataCard, { marginTop: 12, borderColor: "#2563eb", borderWidth: 2 }]}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 10 }}>
              {t("users.abs_new") || "Neue Abwesenheit"}
            </Text>
            {/* Type selector */}
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 6 }}>{t("users.abs_type") || "Typ"}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {absenceTypes.map((at) => (
                <TouchableOpacity
                  key={at.key}
                  onPress={() => setAbsType(at.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: absType === at.key ? at.color : "#f8fafc",
                    borderWidth: 1, borderColor: absType === at.key ? at.color : "#e2e8f0",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: absType === at.key ? "#fff" : "#64748b" }}>{at.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Date inputs */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 4 }}>{t("users.abs_from") || "Von"}</Text>
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={absDateFrom}
                    onChange={(e: any) => setAbsDateFrom(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, backgroundColor: "#f8fafc", color: "#1e293b", width: "100%", boxSizing: "border-box" as any }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => setAbsShowFromPicker(true)}
                      style={[styles.input, { justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 6 }]}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#2563eb" />
                      <Text style={{ color: absDateFrom ? "#1e293b" : "#94a3b8", fontSize: 14, flex: 1 }}>
                        {absDateFrom ? new Date(absDateFrom).toLocaleDateString("de-DE") : t("common.select_date") || "Datum wählen"}
                      </Text>
                    </TouchableOpacity>
                    {absShowFromPicker && (
                      <DateTimePicker
                        value={absDateFrom ? new Date(absDateFrom) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(_: any, date?: Date) => {
                          setAbsShowFromPicker(false);
                          if (date) setAbsDateFrom(date.toISOString().split("T")[0]);
                        }}
                      />
                    )}
                  </>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 4 }}>{t("users.abs_to") || "Bis"}</Text>
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={absDateTo}
                    onChange={(e: any) => setAbsDateTo(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, backgroundColor: "#f8fafc", color: "#1e293b", width: "100%", boxSizing: "border-box" as any }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => setAbsShowToPicker(true)}
                      style={[styles.input, { justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 6 }]}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#2563eb" />
                      <Text style={{ color: absDateTo ? "#1e293b" : "#94a3b8", fontSize: 14, flex: 1 }}>
                        {absDateTo ? new Date(absDateTo).toLocaleDateString("de-DE") : t("common.select_date") || "Datum wählen"}
                      </Text>
                    </TouchableOpacity>
                    {absShowToPicker && (
                      <DateTimePicker
                        value={absDateTo ? new Date(absDateTo) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(_: any, date?: Date) => {
                          setAbsShowToPicker(false);
                          if (date) setAbsDateTo(date.toISOString().split("T")[0]);
                        }}
                      />
                    )}
                  </>
                )}
              </View>
            </View>
            {absDateFrom && absDateTo && absDateFrom <= absDateTo && (
              <Text style={{ fontSize: 12, color: "#2563eb", fontWeight: "600", marginBottom: 8 }}>
                = {countWorkdays(absDateFrom, absDateTo)} {t("users.abs_workdays") || "Arbeitstage"}
              </Text>
            )}
            {/* Note */}
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 4 }}>{t("users.abs_note") || "Notiz"}</Text>
            <TextInput
              style={[styles.input, { minHeight: 40, textAlignVertical: "top" }]}
              value={absNote}
              onChangeText={setAbsNote}
              placeholder={t("users.abs_note_placeholder") || "Optional..."}
              placeholderTextColor="#94a3b8"
              multiline
            />
            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => { setAbsShowForm(false); setAbsDateFrom(""); setAbsDateTo(""); setAbsNote(""); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center" }}
              >
                <Text style={{ color: "#64748b", fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveAbsence}
                disabled={absSaving}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center", opacity: absSaving ? 0.6 : 1 }}
              >
                {absSaving ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Absence list */}
        {absences.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 8 }}>
              {t("users.abs_list") || "Einträge"} ({absences.length})
            </Text>
            {absences.map((a: any) => (
              <View key={a.id} style={{ backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: a.status === "pending" ? "#f59e0b" : "#e2e8f0", borderLeftWidth: 4, borderLeftColor: absTypeColor(a.type) }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: absTypeColor(a.type) }}>{absTypeLabel(a.type)}</Text>
                    <View style={{ backgroundColor: statusColor(a.status) + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor(a.status) }}>{statusLabel(a.status)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#1e293b" }}>{a.days} {t("users.abs_days") || "Tage"}</Text>
                </View>
                <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {new Date(a.date_from).toLocaleDateString("de-DE")} — {new Date(a.date_to).toLocaleDateString("de-DE")}
                </Text>
                {a.note && <Text style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic", marginTop: 4 }}>{a.note}</Text>}
                {a.approver?.full_name && a.status !== "pending" && (
                  <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                    {a.status === "approved" ? "✓" : "✗"} {a.approver.full_name} · {a.approved_at ? new Date(a.approved_at).toLocaleDateString("de-DE") : ""}
                  </Text>
                )}
                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {canApproveAbsence && a.status === "pending" && (
                    <>
                      <TouchableOpacity
                        onPress={() => approveAbsence(a.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      >
                        <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#10b981" }}>{t("users.abs_approve") || "Genehmigen"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => rejectAbsence(a.id)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef2f2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      >
                        <Ionicons name="close-circle" size={14} color="#ef4444" />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#ef4444" }}>{t("users.abs_reject") || "Ablehnen"}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {(canEdit || canApproveAbsence) && (
                    <TouchableOpacity
                      onPress={() => deleteAbsence(a.id)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* GPS Tracking Section */}
      {canManageGPS && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="navigate" size={16} color="#2563eb" />{" "}
            {t("users.gps_tracking") || "GPS-Tracking"}
          </Text>

          <View style={styles.dataCard}>
            {/* Toggle GPS */}
            <View style={[styles.dataRow, { justifyContent: "space-between" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="location" size={18} color={gpsEnabled ? "#10b981" : "#94a3b8"} />
                <Text style={[styles.dataLabel, { flex: 0, marginRight: 8 }]}>
                  {t("users.gps_tracking_label") || "GPS-Tracking"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 12, color: gpsEnabled ? "#10b981" : "#ef4444", fontWeight: "600" }}>
                  {gpsEnabled ? (t("users.gps_on") || "Aktiv") : (t("users.gps_off") || "Inaktiv")}
                </Text>
                {gpsTogglingLoading ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Switch
                    value={gpsEnabled}
                    onValueChange={toggleGPS}
                    trackColor={{ false: "#e2e8f0", true: "#86efac" }}
                    thumbColor={gpsEnabled ? "#10b981" : "#94a3b8"}
                  />
                )}
              </View>
            </View>

            {gpsEnabled && (
              <>
                <View style={styles.separator} />

                {/* Current location */}
                {lastLocation ? (
                  <View style={{ paddingVertical: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <Ionicons name="pin" size={16} color="#2563eb" />
                      <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: "600", color: "#1e293b" }}>
                        {t("users.last_location") || "Letzte Position"}
                      </Text>
                      <Text style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
                        {formatTime(lastLocation.recorded_at)} · {formatDate(lastLocation.recorded_at)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}
                      {lastLocation.accuracy ? ` (±${Math.round(lastLocation.accuracy)}m)` : ""}
                    </Text>
                    {Platform.OS === "web" && (
                      <View style={{ borderRadius: 10, overflow: "hidden", height: 220, borderWidth: 1, borderColor: "#e2e8f0" }}>
                        <iframe
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lastLocation.longitude - 0.005},${lastLocation.latitude - 0.003},${lastLocation.longitude + 0.005},${lastLocation.latitude + 0.003}&layer=mapnik&marker=${lastLocation.latitude},${lastLocation.longitude}`}
                          style={{ width: "100%", height: "100%", border: "none" } as any}
                        />
                      </View>
                    )}
                    {Platform.OS !== "web" && (
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", padding: 10, borderRadius: 8 }}
                        onPress={() => Linking.openURL(`https://www.google.com/maps?q=${lastLocation.latitude},${lastLocation.longitude}`)}
                      >
                        <Ionicons name="map" size={16} color="#2563eb" />
                        <Text style={{ color: "#2563eb", fontWeight: "600", fontSize: 13 }}>
                          {t("users.open_in_maps") || "In Google Maps öffnen"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}>
                    <Ionicons name="location-outline" size={32} color="#cbd5e1" />
                    <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>
                      {t("users.no_location") || "Keine Position verfügbar"}
                    </Text>
                  </View>
                )}

                <View style={styles.separator} />

                {/* History toggle */}
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 }}
                  onPress={() => {
                    if (!showHistory) {
                      setShowHistory(true);
                      fetchLocationHistory(historyDate);
                    } else {
                      setShowHistory(false);
                    }
                  }}
                >
                  <Ionicons name="time" size={18} color="#f59e0b" />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#1e293b" }}>
                    {t("users.location_history") || "Standortverlauf"}
                  </Text>
                  <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
                </TouchableOpacity>

                {showHistory && (
                  <View style={{ paddingBottom: 10 }}>
                    {/* Date picker */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <TouchableOpacity
                        onPress={() => {
                          const d = new Date(historyDate);
                          d.setDate(d.getDate() - 1);
                          const newDate = d.toISOString().split("T")[0];
                          setHistoryDate(newDate);
                          fetchLocationHistory(newDate);
                        }}
                        style={{ padding: 6, backgroundColor: "#f1f5f9", borderRadius: 6 }}
                      >
                        <Ionicons name="chevron-back" size={16} color="#64748b" />
                      </TouchableOpacity>
                      <Text style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: "#1e293b" }}>
                        {new Date(historyDate).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const d = new Date(historyDate);
                          d.setDate(d.getDate() + 1);
                          const newDate = d.toISOString().split("T")[0];
                          setHistoryDate(newDate);
                          fetchLocationHistory(newDate);
                        }}
                        style={{ padding: 6, backgroundColor: "#f1f5f9", borderRadius: 6 }}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    {locationHistory.length === 0 ? (
                      <View style={{ alignItems: "center", paddingVertical: 12 }}>
                        <Ionicons name="location-outline" size={24} color="#cbd5e1" />
                        <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                          {t("users.no_history") || "Keine Daten für diesen Tag"}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                          {locationHistory.length} {t("users.entries") || "Einträge"}
                        </Text>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }}>
                          {locationHistory.map((loc: any, idx: number) => (
                            <View
                              key={loc.id || idx}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 6,
                                paddingHorizontal: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: "#f1f5f9",
                                gap: 8,
                              }}
                            >
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#2563eb" }} />
                              <Text style={{ fontSize: 12, fontWeight: "600", color: "#1e293b", width: 65 }}>
                                {formatTime(loc.recorded_at)}
                              </Text>
                              <Text style={{ fontSize: 11, color: "#64748b", flex: 1 }}>
                                {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                              </Text>
                              {loc.speed != null && loc.speed > 0 && (
                                <Text style={{ fontSize: 10, color: "#f59e0b" }}>
                                  {(loc.speed * 3.6).toFixed(0)} km/h
                                </Text>
                              )}
                              {Platform.OS === "web" && (
                                <TouchableOpacity
                                  onPress={() => window.open(`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`, "_blank")}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="open-outline" size={14} color="#2563eb" />
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </ScrollView>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}

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
