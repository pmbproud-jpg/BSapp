import { getRoleDefaults, RoleName } from "@/src/hooks/usePermissions";
import { useSettingsPermissions } from "@/src/hooks/useSettingsPermissions";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdminPermissionsScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();

  // Automation settings
  const [autoAssign, setAutoAssign] = useState(false);
  const [autoReminders, setAutoReminders] = useState(false);
  const [autoStatus, setAutoStatus] = useState(false);

  const {
    allUsers, usersLoading, selectedUser, setSelectedUser,
    fetchAllUsers,
    showRoleModal, setShowRoleModal,
    roleOptions, changeUserRole, getRoleColor,
    showPermModal, setShowPermModal,
    userPerms, setUserPerms, userRoleDefaults, setUserRoleDefaults,
    userOverrides, setUserOverrides,
    permSaving, permSearch, setPermSearch,
    collapsedGroups, showRolePickerInPerm, setShowRolePickerInPerm,
    permSortBy, setPermSortBy, permSortAsc, setPermSortAsc,
    permissionGroups,
    loadUserPerms, saveUserPerms,
    resetUserPermsToDefaults,
    toggleGroupCollapse, overrideCount,
  } = useSettingsPermissions(t);

  useEffect(() => {
    fetchAllUsers();
    loadAutomationSettings();
  }, []);

  // ─── Automation ───

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

  // ─── Render ───

  const renderToggle = (isOn: boolean, onPress: () => void, highlighted?: boolean) => (
    <TouchableOpacity
      style={[styles.toggle, isOn && styles.toggleActive, highlighted && { borderWidth: 2, borderColor: "#f59e0b" }]}
      onPress={onPress}
    >
      <View style={[styles.toggleKnob, isOn && styles.toggleKnobActive]} />
    </TouchableOpacity>
  );

  const renderRoleModal = () => {
    const content = (
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
            style={[styles.roleOption, selectedUser?.role === opt.value && styles.roleOptionActive]}
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
    );

    return Platform.OS === "web" ? (
      showRoleModal && (
        <View style={[styles.modalOverlay, { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }]}>
          {content}
        </View>
      )
    ) : (
      <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <View style={styles.modalOverlay}>{content}</View>
      </Modal>
    );
  };

  const renderPermModal = () => {
    const permContent = (
      <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "90%", maxWidth: 520, width: "100%" }]}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedUser?.full_name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setShowRolePickerInPerm(!showRolePickerInPerm)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${getRoleColor(selectedUser?.role || "worker")}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
              >
                <Ionicons name={roleOptions.find(r => r.value === selectedUser?.role)?.icon as any || "person"} size={14} color={getRoleColor(selectedUser?.role || "worker")} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: getRoleColor(selectedUser?.role || "worker") }}>
                  {t(`common.roles.${selectedUser?.role || "worker"}`)}
                </Text>
                <Ionicons name={showRolePickerInPerm ? "chevron-up" : "chevron-down"} size={12} color={getRoleColor(selectedUser?.role || "worker")} />
              </TouchableOpacity>
              {overrideCount > 0 && (
                <View style={{ backgroundColor: "#f59e0b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                    {overrideCount} {t("settings.overrides", "zmian")}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => { setShowPermModal(false); setShowRolePickerInPerm(false); }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Role picker inline */}
        {showRolePickerInPerm && (
          <View style={{ marginBottom: 12, padding: 8, backgroundColor: colors.surfaceVariant, borderRadius: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
              {t("settings.change_role", "Zmień funkcję")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {roleOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={async () => {
                    if (selectedUser && opt.value !== selectedUser.role) {
                      await changeUserRole(selectedUser.id, opt.value);
                      setSelectedUser({ ...selectedUser, role: opt.value });
                      const newDefaults = getRoleDefaults(opt.value as RoleName);
                      setUserRoleDefaults(newDefaults);
                      setUserPerms({ ...newDefaults });
                      setUserOverrides(null);
                    }
                    setShowRolePickerInPerm(false);
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 4,
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                    backgroundColor: selectedUser?.role === opt.value ? `${opt.color}20` : colors.card,
                    borderWidth: 1, borderColor: selectedUser?.role === opt.value ? opt.color : colors.border,
                  }}
                >
                  <Ionicons name={opt.icon as any} size={14} color={opt.color} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selectedUser?.role === opt.value ? opt.color : colors.text }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Reset button */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={resetUserPermsToDefaults}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: overrideCount > 0 ? "#fef3c720" : "transparent", borderWidth: 1, borderColor: overrideCount > 0 ? "#f59e0b" : colors.border }}
          >
            <Ionicons name="refresh" size={14} color={overrideCount > 0 ? "#f59e0b" : colors.textMuted} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: overrideCount > 0 ? "#f59e0b" : colors.textMuted }}>
              {t("settings.reset_to_defaults", "Reset do domyślnych")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Grouped permissions */}
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator>
          {permissionGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.title);
            const groupOverrides = group.perms.filter(p => userPerms[p.key] !== userRoleDefaults[p.key]).length;
            const groupEnabled = group.perms.filter(p => userPerms[p.key]).length;

            return (
              <View key={group.title} style={{ marginBottom: 4 }}>
                <TouchableOpacity
                  onPress={() => toggleGroupCollapse(group.title)}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, backgroundColor: `${group.color}08`, borderRadius: 8, marginBottom: isCollapsed ? 0 : 2 }}
                >
                  <Ionicons name={group.icon as any} size={16} color={group.color} />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: group.color, marginLeft: 8 }}>
                    {group.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginRight: 6 }}>
                    {groupEnabled}/{group.perms.length}
                  </Text>
                  {groupOverrides > 0 && (
                    <View style={{ backgroundColor: "#f59e0b", width: 6, height: 6, borderRadius: 3, marginRight: 6 }} />
                  )}
                  <Ionicons name={isCollapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.textMuted} />
                </TouchableOpacity>

                {!isCollapsed && group.perms.map((perm) => {
                  const isOn = !!userPerms[perm.key];
                  const isDefault = userRoleDefaults[perm.key];
                  const isChanged = isOn !== isDefault;

                  return (
                    <View key={perm.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: "500", color: colors.text }}>{perm.label}</Text>
                          {isChanged && (
                            <View style={{ backgroundColor: "#f59e0b", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                                {t("settings.custom", "ZMIENIONE")}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                          {t("settings.default_for_role", "Domyślnie")}: {isDefault ? t("common.yes", "Tak") : t("common.no", "Nie")}
                        </Text>
                      </View>
                      {renderToggle(isOn, () => setUserPerms((prev) => ({ ...prev, [perm.key]: !prev[perm.key] })), isChanged)}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, permSaving && styles.saveButtonDisabled, { marginTop: 16 }]}
          onPress={saveUserPerms}
          disabled={permSaving}
        >
          <Text style={styles.saveButtonText}>
            {permSaving ? t("common.loading", "Wird geladen...") : t("common.save", "Speichern")}
          </Text>
        </TouchableOpacity>
      </View>
    );

    return Platform.OS === "web" ? (
      showPermModal && (
        <View style={[styles.modalOverlay, { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }]}>
          {permContent}
        </View>
      )
    ) : (
      <Modal visible={showPermModal} transparent animationType="fade" onRequestClose={() => { setShowPermModal(false); setShowRolePickerInPerm(false); }}>
        <View style={styles.modalOverlay}>{permContent}</View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="shield" size={24} color="#8b5cf6" />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("admin.permissions", "Uprawnienia")}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Automation */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t("settings.automation")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.autoItem}>
              <Ionicons name="flash" size={20} color="#f59e0b" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.autoTitle, { color: colors.text }]}>{t("settings.auto_assign")}</Text>
                <Text style={[styles.autoDesc, { color: colors.textMuted }]}>{t("settings.auto_assign_desc")}</Text>
              </View>
              {renderToggle(autoAssign, () => saveAutomationSetting("autoAssign", !autoAssign))}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.autoItem}>
              <Ionicons name="notifications" size={20} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.autoTitle, { color: colors.text }]}>{t("settings.auto_reminders")}</Text>
                <Text style={[styles.autoDesc, { color: colors.textMuted }]}>{t("settings.auto_reminders_desc")}</Text>
              </View>
              {renderToggle(autoReminders, () => saveAutomationSetting("autoReminders", !autoReminders))}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.autoItem}>
              <Ionicons name="sync" size={20} color="#10b981" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.autoTitle, { color: colors.text }]}>{t("settings.auto_status")}</Text>
                <Text style={[styles.autoDesc, { color: colors.textMuted }]}>{t("settings.auto_status_desc")}</Text>
              </View>
              {renderToggle(autoStatus, () => saveAutomationSetting("autoStatus", !autoStatus))}
            </View>
          </View>
        </View>

        {/* Permission Matrix */}
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

        {/* Individual Permissions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("settings.individual_permissions") || "Individuelle Berechtigungen"}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Search */}
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.inputBg || "#f1f5f9", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 13, color: colors.text }}
                value={permSearch}
                onChangeText={setPermSearch}
                placeholder={t("users.search_placeholder") || "Nach Name suchen..."}
                placeholderTextColor={colors.textMuted}
              />
              {permSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPermSearch("")}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {/* Sort */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: permSortBy === "name" ? `${colors.primary}15` : "transparent", borderWidth: 1, borderColor: permSortBy === "name" ? colors.primary : (colors.border || "#e2e8f0") }}
                onPress={() => { if (permSortBy === "name") setPermSortAsc(!permSortAsc); else { setPermSortBy("name"); setPermSortAsc(true); } }}
              >
                <Ionicons name="text" size={12} color={permSortBy === "name" ? colors.primary : colors.textMuted} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: permSortBy === "name" ? colors.primary : colors.textMuted }}>{t("users.full_name") || "Name"}</Text>
                {permSortBy === "name" && <Ionicons name={permSortAsc ? "arrow-up" : "arrow-down"} size={10} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: permSortBy === "role" ? `${colors.primary}15` : "transparent", borderWidth: 1, borderColor: permSortBy === "role" ? colors.primary : (colors.border || "#e2e8f0") }}
                onPress={() => { if (permSortBy === "role") setPermSortAsc(!permSortAsc); else { setPermSortBy("role"); setPermSortAsc(true); } }}
              >
                <Ionicons name="shield" size={12} color={permSortBy === "role" ? colors.primary : colors.textMuted} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: permSortBy === "role" ? colors.primary : colors.textMuted }}>{t("users.role") || "Funktion"}</Text>
                {permSortBy === "role" && <Ionicons name={permSortAsc ? "arrow-up" : "arrow-down"} size={10} color={colors.primary} />}
              </TouchableOpacity>
            </View>
            {usersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View>
                {allUsers
                  .filter((u) => u.id !== profile?.id)
                  .filter((u) => {
                    if (!permSearch.trim()) return true;
                    const q = permSearch.toLowerCase();
                    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || t(`common.roles.${u.role}`).toLowerCase().includes(q);
                  })
                  .sort((a, b) => {
                    let cmp = 0;
                    if (permSortBy === "name") cmp = (a.full_name || "").localeCompare(b.full_name || "");
                    else cmp = (a.role || "").localeCompare(b.role || "");
                    return permSortAsc ? cmp : -cmp;
                  })
                  .map((user) => (
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
                  ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {renderRoleModal()}
      {renderPermModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backButton: {
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  autoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  autoTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  autoDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  // Toggle
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#cbd5e1",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#3b82f6",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  // Permission Matrix
  permMatrix: {
    gap: 6,
  },
  permMatrixRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
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
    fontWeight: "700",
    color: "#64748b",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  // User list
  permUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  permUserName: {
    fontSize: 14,
    fontWeight: "600",
  },
  permUserEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 480,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  roleOptionActive: {
    backgroundColor: "#f0f9ff",
  },
  roleOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
