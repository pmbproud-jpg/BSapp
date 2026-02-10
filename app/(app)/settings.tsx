import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { usePermissions } from "@/src/hooks/usePermissions";
import { useTheme, ThemeMode } from "@/src/providers/ThemeProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const perms = usePermissions();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);
  const [autoReminders, setAutoReminders] = useState(false);
  const [autoStatus, setAutoStatus] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>({});
  const [permSaving, setPermSaving] = useState(false);

  const currentLanguage = i18n.language;

  const roleOptions = [
    { value: "admin", label: t("common.roles.admin"), icon: "shield-checkmark" as const, color: "#ef4444" },
    { value: "management", label: t("common.roles.management"), icon: "business" as const, color: "#f59e0b" },
    { value: "project_manager", label: t("common.roles.project_manager"), icon: "briefcase" as const, color: "#3b82f6" },
    { value: "bauleiter", label: t("common.roles.bauleiter"), icon: "construct" as const, color: "#10b981" },
    { value: "worker", label: t("common.roles.worker"), icon: "hammer" as const, color: "#64748b" },
  ];

  const permissionKeys = [
    { key: "canCreateProject", label: t("settings.perm_create_project") || "Tworzenie projektów" },
    { key: "canEditProject", label: t("settings.perm_edit_project") || "Edycja projektów" },
    { key: "canDeleteProject", label: t("settings.perm_delete_project") || "Usuwanie projektów" },
    { key: "canCreateTask", label: t("settings.perm_create_task") || "Tworzenie zadań" },
    { key: "canEditTask", label: t("settings.perm_edit_task") || "Edycja zadań" },
    { key: "canDeleteTask", label: t("settings.perm_delete_task") || "Usuwanie zadań" },
    { key: "canManageMembers", label: t("settings.perm_manage_members") || "Zarządzanie członkami" },
    { key: "canUploadFiles", label: t("settings.perm_upload_files") || "Przesyłanie plików" },
    { key: "canDeleteFiles", label: t("settings.perm_delete_files") || "Usuwanie plików" },
    { key: "canImportData", label: t("settings.perm_import_data") || "Import danych" },
  ];

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .order("full_name");
      if (error) throw error;
      setAllUsers(data || []);
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setUsersLoading(false);
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await (supabaseAdmin.from("profiles") as any)
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      setShowRoleModal(false);
      setSelectedUser(null);
      const msg = t("settings.role_changed_success") || "Funkcja została zmieniona";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      console.error("Error changing role:", e);
      const msg = t("settings.role_change_error") || "Błąd zmiany funkcji";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    }
  };

  const loadUserPerms = async (userId: string) => {
    try {
      const key = Platform.OS === "web"
        ? window.localStorage.getItem(`bsapp_perms_${userId}`)
        : await AsyncStorage.getItem(`bsapp_perms_${userId}`);
      if (key) {
        setUserPerms(JSON.parse(key));
      } else {
        // Default perms based on role
        const user = allUsers.find((u) => u.id === userId);
        const role = user?.role || "worker";
        const defaults: Record<string, boolean> = {};
        permissionKeys.forEach((p) => {
          if (role === "admin") defaults[p.key] = true;
          else if (role === "management") defaults[p.key] = !p.key.includes("Delete") || p.key === "canDeleteTask";
          else if (role === "project_manager" || role === "bauleiter") defaults[p.key] = !p.key.includes("Delete") && !p.key.includes("Import");
          else defaults[p.key] = false;
        });
        setUserPerms(defaults);
      }
    } catch (e) { /* ignore */ }
  };

  const saveUserPerms = async () => {
    if (!selectedUser) return;
    setPermSaving(true);
    try {
      const json = JSON.stringify(userPerms);
      if (Platform.OS === "web") {
        window.localStorage.setItem(`bsapp_perms_${selectedUser.id}`, json);
      } else {
        await AsyncStorage.setItem(`bsapp_perms_${selectedUser.id}`, json);
      }
      setShowPermModal(false);
      setSelectedUser(null);
      const msg = t("settings.perms_saved_success") || "Uprawnienia zapisane";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error saving perms:", e);
    } finally {
      setPermSaving(false);
    }
  };

  useEffect(() => {
    loadAutomationSettings();
    if (perms.canManagePermissions) fetchAllUsers();
  }, []);

  const loadAutomationSettings = async () => {
    try {
      const stored = Platform.OS === "web"
        ? window.localStorage.getItem("bsapp_automation")
        : await AsyncStorage.getItem("bsapp_automation");
      if (stored) {
        const parsed = JSON.parse(stored);
        setAutoAssign(!!parsed.autoAssign);
        setAutoReminders(!!parsed.autoReminders);
        setAutoStatus(!!parsed.autoStatus);
      }
    } catch (e) { /* ignore */ }
  };

  const saveAutomationSetting = async (key: string, value: boolean) => {
    const newState = { autoAssign, autoReminders, autoStatus, [key]: value };
    if (key === "autoAssign") setAutoAssign(value);
    if (key === "autoReminders") setAutoReminders(value);
    if (key === "autoStatus") setAutoStatus(value);
    try {
      const json = JSON.stringify(newState);
      if (Platform.OS === "web") {
        window.localStorage.setItem("bsapp_automation", json);
      } else {
        await AsyncStorage.setItem("bsapp_automation", json);
      }
    } catch (e) { /* ignore */ }
  };

  const languages = [
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "pl", name: "Polski", flag: "🇵🇱" },
    { code: "en", name: "English", flag: "🇬🇧" },
  ];

  const changeLanguage = async (lang: string) => {
    try {
      await i18n.changeLanguage(lang);
    } catch (error) {
      console.error("Error changing language:", error);
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert(t("common.error"), t("settings.name_required"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase
        .from("profiles") as any)
        .update({ full_name: fullName.trim() })
        .eq("id", profile?.id);

      if (error) throw error;

      Alert.alert(t("common.success"), t("settings.saved_success"));
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert(t("common.error"), t("settings.save_error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(t("settings.logout_confirm"), t("settings.logout_message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "#ef4444",
      management: "#f59e0b",
      project_manager: "#3b82f6",
      bauleiter: "#10b981",
      worker: "#64748b",
    };
    return colors[role] || "#94a3b8";
  };

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.profile")}</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.profileHeader, { borderBottomColor: colors.borderLight }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {profile?.full_name || profile?.email}
              </Text>
              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: `${getRoleColor(profile?.role || "worker")}20`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { color: getRoleColor(profile?.role || "worker") },
                  ]}
                >
                  {t(`common.roles.${profile?.role}`)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("settings.email")}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{profile?.email}</Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("settings.full_name")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t("settings.full_name_placeholder")}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveProfile}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? t("common.loading") : t("settings.save")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.language")}</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                { borderBottomColor: colors.borderLight },
                currentLanguage === lang.code && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => changeLanguage(lang.code)}
            >
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <Text style={[styles.languageName, { color: colors.text }]}>{lang.name}</Text>
              {currentLanguage === lang.code && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.company")}</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.companyInfo}>
            <Ionicons name="business" size={24} color={colors.primary} />
            <View style={styles.companyDetails}>
              <Text style={[styles.companyName, { color: colors.text }]}>Building Solutions GmbH</Text>
              <Text style={[styles.companySubtext, { color: colors.textSecondary }]}>
                {t("settings.company_member")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dark Mode */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.appearance")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {([
            { mode: "light" as ThemeMode, icon: "sunny" as const, label: t("settings.theme_light") },
            { mode: "dark" as ThemeMode, icon: "moon" as const, label: t("settings.theme_dark") },
            { mode: "system" as ThemeMode, icon: "phone-portrait" as const, label: t("settings.theme_system") },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.mode}
              style={[
                styles.languageOption,
                { borderBottomColor: colors.borderLight },
                themeMode === opt.mode && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => setThemeMode(opt.mode)}
            >
              <Ionicons name={opt.icon} size={22} color={themeMode === opt.mode ? colors.primary : colors.textMuted} />
              <Text style={[styles.languageName, { color: colors.text }, themeMode === opt.mode && { color: colors.primary }]}>{opt.label}</Text>
              {themeMode === opt.mode && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2FA Security */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.security")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.twoFARow}>
            <View style={styles.twoFAInfo}>
              <Ionicons name="shield-checkmark" size={24} color={twoFAEnabled ? "#10b981" : colors.textMuted} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.twoFATitle, { color: colors.text }]}>{t("settings.two_factor_auth")}</Text>
                <Text style={[styles.twoFADesc, { color: colors.textMuted }]}>{t("settings.two_factor_desc")}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.twoFAToggle, twoFAEnabled && styles.twoFAToggleActive]}
              onPress={async () => {
                setTwoFALoading(true);
                try {
                  if (!twoFAEnabled) {
                    // Enable 2FA - Supabase MFA enrollment
                    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
                    if (error) throw error;
                    setTwoFAEnabled(true);
                    if (Platform.OS === "web") {
                      window.alert(t("settings.two_factor_enabled") + "\n\nURI: " + (data?.totp?.uri || ""));
                    } else {
                      Alert.alert(t("common.success"), t("settings.two_factor_enabled"));
                    }
                  } else {
                    // Disable 2FA - unenroll all factors
                    const { data: factors } = await supabase.auth.mfa.listFactors();
                    if (factors?.totp && factors.totp.length > 0) {
                      for (const factor of factors.totp) {
                        await supabase.auth.mfa.unenroll({ factorId: factor.id });
                      }
                    }
                    setTwoFAEnabled(false);
                    if (Platform.OS === "web") {
                      window.alert(t("settings.two_factor_disabled"));
                    } else {
                      Alert.alert(t("common.success"), t("settings.two_factor_disabled"));
                    }
                  }
                } catch (error: any) {
                  console.error("2FA error:", error);
                  const msg = error?.message || t("common.error");
                  if (Platform.OS === "web") {
                    window.alert(msg);
                  } else {
                    Alert.alert(t("common.error"), msg);
                  }
                } finally {
                  setTwoFALoading(false);
                }
              }}
              disabled={twoFALoading}
            >
              {twoFALoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={[styles.twoFAToggleKnob, twoFAEnabled && styles.twoFAToggleKnobActive]} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Automation - Admin only */}
      {perms.canManagePermissions && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.automation")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.autoItem}>
              <Ionicons name="flash" size={20} color="#f59e0b" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.autoTitle, { color: colors.text }]}>{t("settings.auto_assign")}</Text>
                <Text style={[styles.autoDesc, { color: colors.textMuted }]}>{t("settings.auto_assign_desc")}</Text>
              </View>
              <TouchableOpacity
                style={[styles.twoFAToggle, autoAssign && styles.twoFAToggleActive]}
                onPress={() => saveAutomationSetting("autoAssign", !autoAssign)}
              >
                <View style={[styles.twoFAToggleKnob, autoAssign && styles.twoFAToggleKnobActive]} />
              </TouchableOpacity>
            </View>
            <View style={[styles.autoDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.autoItem}>
              <Ionicons name="notifications" size={20} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.autoTitle, { color: colors.text }]}>{t("settings.auto_reminders")}</Text>
                <Text style={[styles.autoDesc, { color: colors.textMuted }]}>{t("settings.auto_reminders_desc")}</Text>
              </View>
              <TouchableOpacity
                style={[styles.twoFAToggle, autoReminders && styles.twoFAToggleActive]}
                onPress={() => saveAutomationSetting("autoReminders", !autoReminders)}
              >
                <View style={[styles.twoFAToggleKnob, autoReminders && styles.twoFAToggleKnobActive]} />
              </TouchableOpacity>
            </View>
            <View style={[styles.autoDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.autoItem}>
              <Ionicons name="sync" size={20} color="#10b981" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.autoTitle, { color: colors.text }]}>{t("settings.auto_status")}</Text>
                <Text style={[styles.autoDesc, { color: colors.textMuted }]}>{t("settings.auto_status_desc")}</Text>
              </View>
              <TouchableOpacity
                style={[styles.twoFAToggle, autoStatus && styles.twoFAToggleActive]}
                onPress={() => saveAutomationSetting("autoStatus", !autoStatus)}
              >
                <View style={[styles.twoFAToggleKnob, autoStatus && styles.twoFAToggleKnobActive]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Admin: Permission Matrix */}
      {perms.canManagePermissions && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("permissions.permissions_matrix")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.permMatrix}>
              {roleOptions.map((role) => (
                <View key={role.value} style={styles.permMatrixRow}>
                  <View style={styles.permMatrixRole}>
                    <Ionicons name={role.icon as any} size={16} color={role.color} />
                    <Text style={[styles.permMatrixRoleName, { color: role.color }]}>{role.label}</Text>
                  </View>
                  <View style={styles.permMatrixPerms}>
                    {role.value === "admin" && <Text style={styles.permTag}>ALL</Text>}
                    {role.value === "management" && <Text style={styles.permTag}>R/W/D*</Text>}
                    {(role.value === "project_manager" || role.value === "bauleiter") && <Text style={styles.permTag}>R/W</Text>}
                    {role.value === "worker" && <Text style={styles.permTag}>R</Text>}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Admin: Nadawanie funkcji (ról) */}
      {perms.canManagePermissions && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("settings.assign_roles") || "Nadawanie funkcji"}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {usersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              allUsers.filter((u) => u.id !== profile?.id).map((user) => (
                <View key={user.id} style={[styles.permUserRow, { borderBottomColor: colors.borderLight }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.permUserName, { color: colors.text }]}>{user.full_name || user.email}</Text>
                    <Text style={[styles.permUserEmail, { color: colors.textMuted }]}>{user.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.permRoleBadge, { backgroundColor: `${getRoleColor(user.role)}15` }]}
                    onPress={() => { setSelectedUser(user); setShowRoleModal(true); }}
                  >
                    <Ionicons name={(roleOptions.find((r) => r.value === user.role)?.icon || "person") as any} size={14} color={getRoleColor(user.role)} />
                    <Text style={[styles.permRoleBadgeText, { color: getRoleColor(user.role) }]}>
                      {t(`common.roles.${user.role}`)}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color={getRoleColor(user.role)} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* Admin: Indywidualne uprawnienia */}
      {perms.canManagePermissions && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("settings.individual_permissions") || "Indywidualne uprawnienia"}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {usersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              allUsers.filter((u) => u.id !== profile?.id).map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.permUserRow, { borderBottomColor: colors.borderLight }]}
                  onPress={() => {
                    setSelectedUser(user);
                    loadUserPerms(user.id);
                    setShowPermModal(true);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.permUserName, { color: colors.text }]}>{user.full_name || user.email}</Text>
                    <Text style={[styles.permUserEmail, { color: colors.textMuted }]}>
                      {t(`common.roles.${user.role}`)}
                    </Text>
                  </View>
                  <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: isDark ? "#7f1d1d" : "#fecaca" }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutButtonText}>{t("settings.logout")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>BSapp v1.0.0</Text>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>Building Solutions GmbH</Text>
      </View>
    </ScrollView>

    {/* Modal: Zmiana funkcji */}
    <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("settings.change_role_for") || "Zmień funkcję dla"}: {selectedUser?.full_name}
            </Text>
            <TouchableOpacity onPress={() => setShowRoleModal(false)}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {roleOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.roleOption,
                selectedUser?.role === opt.value && styles.roleOptionActive,
              ]}
              onPress={() => selectedUser && changeUserRole(selectedUser.id, opt.value)}
            >
              <Ionicons name={opt.icon as any} size={22} color={opt.color} />
              <Text style={[styles.roleOptionLabel, { color: colors.text }]}>{opt.label}</Text>
              {selectedUser?.role === opt.value && (
                <Ionicons name="checkmark-circle" size={22} color={opt.color} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>

    {/* Modal: Indywidualne uprawnienia */}
    <Modal visible={showPermModal} transparent animationType="fade" onRequestClose={() => setShowPermModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "85%" }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("settings.permissions_for") || "Uprawnienia dla"}: {selectedUser?.full_name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {t(`common.roles.${selectedUser?.role || "worker"}`)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowPermModal(false)}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {permissionKeys.map((perm) => (
              <View key={perm.key} style={[styles.permToggleRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.permToggleLabel, { color: colors.text }]}>{perm.label}</Text>
                <TouchableOpacity
                  style={[styles.twoFAToggle, userPerms[perm.key] && styles.twoFAToggleActive]}
                  onPress={() => setUserPerms((prev) => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                >
                  <View style={[styles.twoFAToggleKnob, userPerms[perm.key] && styles.twoFAToggleKnobActive]} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.saveButton, permSaving && styles.saveButtonDisabled, { marginTop: 16 }]}
            onPress={saveUserPerms}
            disabled={permSaving}
          >
            <Text style={styles.saveButtonText}>
              {permSaving ? t("common.loading") : (t("common.save") || "Zapisz")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    color: "#1e293b",
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
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  languageOptionActive: {
    backgroundColor: "#f8fafc",
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1e293b",
  },
  companyInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  companyDetails: {
    flex: 1,
    marginLeft: 12,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  companySubtext: {
    fontSize: 13,
    color: "#64748b",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  permMatrixTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  permMatrix: {
    gap: 8,
  },
  permMatrixRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  permMatrixRole: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  permMatrixRoleName: {
    fontSize: 13,
    fontWeight: "600",
  },
  permMatrixPerms: {
    flexDirection: "row",
    gap: 4,
  },
  permTag: {
    fontSize: 11,
    color: "#64748b",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "600",
  },
  permDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 16,
  },
  permSectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  permUserRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  permUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  permUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  permUserEmail: {
    fontSize: 12,
    color: "#94a3b8",
  },
  permRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  permRoleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  roleOptionActive: {
    backgroundColor: "#f0f9ff",
  },
  roleOptionLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  twoFARow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  twoFAInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  twoFATitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  twoFADesc: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  twoFAToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    paddingHorizontal: 3,
    marginLeft: 12,
  },
  twoFAToggleActive: {
    backgroundColor: "#10b981",
  },
  twoFAToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
  },
  twoFAToggleKnobActive: {
    alignSelf: "flex-end" as const,
  },
  autoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  autoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  autoDesc: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  autoDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  permToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  permToggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    flex: 1,
    marginRight: 12,
  },
});
