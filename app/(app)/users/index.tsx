import { usePermissions } from "@/src/hooks/usePermissions";
import { useUsersManagement } from "@/src/hooks/useUsersManagement";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useCompany } from "@/src/providers/CompanyProvider";
import { openLink } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function UsersScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "role">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "subcontractors">("users");

  const perms = usePermissions();
  const { defaultPassword } = useCompany();
  const isAdmin = perms.isAdmin;
  const isManagement = perms.isManagement;
  const canViewUsers = perms.canViewUsers;
  const canEditUsers = perms.canEditUser;
  const canDeleteUser = perms.canDeleteUser;
  const canManageSubs = perms.canManageSubcontractor;

  useEffect(() => {
    if (!canViewUsers && !canManageSubs) {
      router.replace("/dashboard");
      return;
    }
    if (!canViewUsers && canManageSubs) {
      setActiveTab("subcontractors");
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // ─── Hook: CRUD + Import ───
  const {
    showAddUser, setShowAddUser, addUserLoading, newUser, setNewUser, createUser,
    showAddSubcontractor, setShowAddSubcontractor, addSubLoading, newSub, setNewSub,
    createSubcontractor, renewAccess,
    showImport, setShowImport, importLoading, importPreview, setImportPreview, importFileName, setImportFileName,
    pickFileWeb, pickFileNative, importUsers,
    sendInviteLink, deleteUser, resetUserPassword,
  } = useUsersManagement(profile, t, fetchUsers, defaultPassword);

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "#ef4444",
      management: "#f59e0b",
      project_manager: "#3b82f6",
      bauleiter: "#10b981",
      worker: "#64748b",
      subcontractor: "#8b5cf6",
      office_worker: "#06b6d4",
      logistics: "#f97316",
      purchasing: "#ec4899",
      warehouse_manager: "#7c3aed",
    };
    return colors[role] || "#94a3b8";
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      admin: "shield-checkmark",
      management: "business",
      project_manager: "briefcase",
      bauleiter: "construct",
      worker: "hammer",
      subcontractor: "people",
      office_worker: "desktop",
      logistics: "cube",
      purchasing: "cart",
      warehouse_manager: "file-tray-stacked",
    };
    return icons[role] || "person";
  };

  // ---- ADD USER ----
  const roleOptions = [
    { value: "admin", label: "Admin", icon: "shield-checkmark" as keyof typeof Ionicons.glyphMap },
    { value: "management", label: t("common.roles.management") || "Geschäftsleitung", icon: "business" as keyof typeof Ionicons.glyphMap },
    { value: "project_manager", label: "PM", icon: "briefcase" as keyof typeof Ionicons.glyphMap },
    { value: "bauleiter", label: "BL", icon: "construct" as keyof typeof Ionicons.glyphMap },
    { value: "office_worker", label: t("common.roles.office_worker") || "Büroangestellter", icon: "desktop" as keyof typeof Ionicons.glyphMap },
    { value: "logistics", label: t("common.roles.logistics") || "Logistik", icon: "cube" as keyof typeof Ionicons.glyphMap },
    { value: "purchasing", label: t("common.roles.purchasing") || "Einkauf", icon: "cart" as keyof typeof Ionicons.glyphMap },
    { value: "worker", label: t("common.roles.worker") || "Mitarbeiter", icon: "hammer" as keyof typeof Ionicons.glyphMap },
    { value: "warehouse_manager", label: t("common.roles.warehouse_manager") || "Lagerverwalter", icon: "file-tray-stacked" as keyof typeof Ionicons.glyphMap },
  ];

  const renderUser = ({ item }: { item: Profile }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => router.push(`/users/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.userHeader}>
        <View style={styles.userIcon}>
          <Ionicons
            name={getRoleIcon(item.role)}
            size={24}
            color={getRoleColor(item.role)}
          />
        </View>
        <View style={styles.userInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
              {item.full_name || item.email}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: `${getRoleColor(item.role)}20` },
                ]}
              >
                <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                  {t(`common.roles.${item.role}`)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
            </View>
          </View>
          {(item as any).hide_email && !(isAdmin || isManagement) ? null : (
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); openLink(`mailto:${item.email}`); }} activeOpacity={0.6}>
              <Text style={[styles.userEmail, { color: "#2563eb", textDecorationLine: "underline" }]} numberOfLines={1}>
                {item.email}{(item as any).hide_email ? " 🔒" : ""}
              </Text>
            </TouchableOpacity>
          )}
          {item.phone ? (
            (item as any).hide_phone && !(isAdmin || isManagement) ? null : (
              <TouchableOpacity style={styles.contactRow} onPress={(e) => { e.stopPropagation(); openLink(`tel:${item.phone}`); }} activeOpacity={0.6}>
                <Ionicons name="call" size={14} color="#2563eb" />
                <Text style={[styles.contactText, { color: "#2563eb", textDecorationLine: "underline" }]}>
                  {item.phone}{(item as any).hide_phone ? " 🔒" : ""}
                </Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>
      </View>

      {canEditUsers && item.id !== profile?.id && (
        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}
            onPress={(e) => { e.stopPropagation(); sendInviteLink(item.email, item.full_name || item.email); }}
          >
            <Ionicons name="mail-outline" size={18} color="#2563eb" />
            <Text style={[styles.actionButtonText, { color: "#2563eb" }]}>
              {t("users.send_invite") || "Link senden"}
            </Text>
          </TouchableOpacity>
          {defaultPassword && item.role !== "admin" && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}
              onPress={(e) => { e.stopPropagation(); resetUserPassword(item.id); }}
            >
              <Ionicons name="refresh-outline" size={18} color="#92400e" />
              <Text style={[styles.actionButtonText, { color: "#92400e" }]}>
                {t("settings.reset_password", "Reset hasła")}
              </Text>
            </TouchableOpacity>
          )}
          {canDeleteUser && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={(e) => { e.stopPropagation(); deleteUser(item.id); }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                {t("common.delete")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (!canViewUsers && !canManageSubs) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const subcontractors = users.filter((u) => u.role === "subcontractor");
  const regularUsers = users.filter((u) => u.role !== "subcontractor");

  const filteredUsers = useMemo(() => {
    return regularUsers
      .filter((u) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (u.full_name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          t(`common.roles.${u.role}`).toLowerCase().includes(q);
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") {
          cmp = (a.full_name || "").localeCompare(b.full_name || "");
        } else {
          cmp = (a.role || "").localeCompare(b.role || "");
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [regularUsers, searchQuery, sortBy, sortAsc, t]);

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const renderSubcontractor = ({ item }: { item: Profile }) => {
    const expired = isExpired((item as any).access_expires_at);
    return (
      <TouchableOpacity
        style={[styles.userCard, expired && { borderColor: "#ef4444", borderWidth: 1.5 }]}
        onPress={() => router.push(`/users/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.userHeader}>
          <View style={[styles.userIcon, { backgroundColor: expired ? "#fef2f2" : "#f5f3ff" }]}>
            <Ionicons name="people" size={24} color={expired ? "#ef4444" : "#8b5cf6"} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.full_name || item.email}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            {(item as any).access_expires_at ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Ionicons name={expired ? "alert-circle" : "time-outline"} size={14} color={expired ? "#ef4444" : "#8b5cf6"} />
                <Text style={{ fontSize: 12, color: expired ? "#ef4444" : "#8b5cf6", fontWeight: "600" }}>
                  {expired
                    ? (t("users.subcontractors.expired") || "Abgelaufen")
                    : `${t("users.subcontractors.expires") || "Läuft ab"}: ${new Date((item as any).access_expires_at).toLocaleDateString("de-DE")}`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: expired ? "#fef2f220" : "#8b5cf620" }]}>
            <Text style={[styles.roleText, { color: expired ? "#ef4444" : "#8b5cf6" }]}>
              {expired ? (t("users.subcontractors.expired") || "Abgelaufen") : (t("common.roles.subcontractor") || "Subunternehmer")}
            </Text>
          </View>
        </View>
        {canManageSubs && expired && (
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#8b5cf610", paddingVertical: 8, borderRadius: 8, marginTop: 8, gap: 6 }}
            onPress={() => {
              const newDate = new Date();
              newDate.setMonth(newDate.getMonth() + 1);
              const dateStr = newDate.toISOString().split("T")[0];
              renewAccess(item.id, dateStr);
            }}
          >
            <Ionicons name="refresh" size={16} color="#8b5cf6" />
            <Text style={{ color: "#8b5cf6", fontWeight: "600", fontSize: 13 }}>{t("users.subcontractors.renew_30_days") || "30 Tage verlängern"}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab bar: Użytkownicy / Podwykonawcy */}
      {!showAddUser && !showImport && !showAddSubcontractor && (
        <View style={styles.tabBar}>
          {canViewUsers && (
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "users" && styles.tabBtnActive]}
              onPress={() => setActiveTab("users")}
            >
              <Ionicons name="people" size={18} color={activeTab === "users" ? "#2563eb" : "#64748b"} />
              <Text style={[styles.tabBtnText, activeTab === "users" && styles.tabBtnTextActive]}>
                {t("users.title") || "Benutzer"} ({regularUsers.length})
              </Text>
            </TouchableOpacity>
          )}
          {canManageSubs && (
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "subcontractors" && styles.tabBtnActive]}
              onPress={() => setActiveTab("subcontractors")}
            >
              <Ionicons name="people-circle" size={18} color={activeTab === "subcontractors" ? "#8b5cf6" : "#64748b"} />
              <Text style={[styles.tabBtnText, activeTab === "subcontractors" && { color: "#8b5cf6" }]}>
                {t("users.subcontractors.title") || "Subunternehmer"} ({subcontractors.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ─── TAB: PODWYKONAWCY ─── */}
      {activeTab === "subcontractors" && !showAddSubcontractor ? (
        <>
          {subcontractors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-circle-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t("users.subcontractors.empty") || "Keine Subunternehmer"}</Text>
            </View>
          ) : (
            <FlatList
              data={subcontractors}
              renderItem={renderSubcontractor}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
            />
          )}
          {canManageSubs && (
            <View style={styles.fabRow}>
              <TouchableOpacity style={[styles.fab, { backgroundColor: "#8b5cf6" }]} onPress={() => setShowAddSubcontractor(true)}>
                <Ionicons name="person-add" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : activeTab === "subcontractors" && showAddSubcontractor ? (
        <ScrollView style={styles.importContent}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={() => { setShowAddSubcontractor(false); setNewSub({ full_name: "", email: "", phone: "", access_expires_at: "" }); }}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.importTitle}>{t("users.subcontractors.add") || "Subunternehmer hinzufügen"}</Text>
          </View>

          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>{t("users.full_name") || "Vollständiger Name"} *</Text>
            <TextInput style={styles.addUserInput} value={newSub.full_name} onChangeText={(v) => setNewSub({ ...newSub, full_name: v })} placeholder="Max Mustermann" placeholderTextColor="#94a3b8" />
          </View>
          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>Email *</Text>
            <TextInput style={styles.addUserInput} value={newSub.email} onChangeText={(v) => setNewSub({ ...newSub, email: v })} placeholder="jan@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>{t("users.phone") || "Telefon"}</Text>
            <TextInput style={styles.addUserInput} value={newSub.phone} onChangeText={(v) => setNewSub({ ...newSub, phone: v })} placeholder="+48 123 456 789" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
          </View>
          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>{t("users.subcontractors.access_until") || "Zugang bis"} *</Text>
            <TextInput style={styles.addUserInput} value={newSub.access_expires_at} onChangeText={(v) => setNewSub({ ...newSub, access_expires_at: v })} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {[30, 60, 90].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#8b5cf610", borderWidth: 1, borderColor: "#8b5cf6" }}
                  onPress={() => {
                    const d = new Date(); d.setDate(d.getDate() + days);
                    setNewSub({ ...newSub, access_expires_at: d.toISOString().split("T")[0] });
                  }}
                >
                  <Text style={{ color: "#8b5cf6", fontWeight: "600", fontSize: 12 }}>{days} {t("users.subcontractors.days") || "Tage"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: "#f5f3ff", borderRadius: 12, padding: 14, marginHorizontal: 16, marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="information-circle" size={20} color="#8b5cf6" />
              <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "600" }}>{t("users.subcontractors.info_title") || "Information"}</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>
              {t("users.subcontractors.info_desc") || "Der Subunternehmer erhält Login und temporäres Passwort. Nach Ablauf des Zugangsdatums kann er sich nicht mehr anmelden. Der Zugang kann jederzeit erneuert werden."}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.createButton, addSubLoading && { opacity: 0.6 }, { backgroundColor: "#8b5cf6", marginHorizontal: 16, marginTop: 16 }]}
            onPress={createSubcontractor}
            disabled={addSubLoading}
          >
            {addSubLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.importButtonText}>{t("users.subcontractors.create") || "Subunternehmer erstellen"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : showAddUser ? (
        <ScrollView style={styles.importContent}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={() => { setShowAddUser(false); setNewUser({ full_name: "", email: "", phone: "", role: "worker" }); }}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.importTitle}>{t("users.add_user") || "Benutzer hinzufügen"}</Text>
          </View>

          <View style={styles.addUserForm}>
            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>{t("users.full_name") || "Vollständiger Name"} *</Text>
              <TextInput
                style={styles.addUserInput}
                value={newUser.full_name}
                onChangeText={(text) => setNewUser({ ...newUser, full_name: text })}
                placeholder="Max Mustermann"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>Email *</Text>
              <TextInput
                style={styles.addUserInput}
                value={newUser.email}
                onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                placeholder="max@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>{t("users.phone") || "Telefon"}</Text>
              <TextInput
                style={styles.addUserInput}
                value={newUser.phone}
                onChangeText={(text) => setNewUser({ ...newUser, phone: text })}
                placeholder="+49 123 456 789"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>{t("users.role") || "Funktion"} *</Text>
              <View style={styles.roleGrid}>
                {roleOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.roleOption,
                      newUser.role === opt.value && styles.roleOptionActive,
                      newUser.role === opt.value && { borderColor: getRoleColor(opt.value) },
                    ]}
                    onPress={() => setNewUser({ ...newUser, role: opt.value })}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={newUser.role === opt.value ? getRoleColor(opt.value) : "#94a3b8"}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        newUser.role === opt.value && { color: getRoleColor(opt.value), fontWeight: "700" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.importButton, addUserLoading && { opacity: 0.6 }]}
              onPress={createUser}
              disabled={addUserLoading}
            >
              {addUserLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.importButtonText}>{t("users.create") || "Benutzer erstellen"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : showImport ? (
        <ScrollView style={styles.importContent}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={() => { setShowImport(false); setImportPreview([]); setImportFileName(""); }}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.importTitle}>{t("users.import.title")}</Text>
          </View>

          <View style={styles.instructions}>
            <Ionicons name="information-circle" size={24} color="#2563eb" />
            <View style={styles.instructionsText}>
              <Text style={styles.instructionsTitle}>{t("users.import.instructions_title")}</Text>
              <Text style={styles.instructionsBody}>{t("users.import.instructions_body")}</Text>
              <Text style={styles.instructionsExample}>
                Name | Email | Telefon | Funktion{"\n"}
                Max Mustermann | max@example.com | +49 123 456 789 | bauleiter
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={Platform.OS === "web" ? pickFileWeb : pickFileNative}
            disabled={importLoading}
          >
            <Ionicons name="cloud-upload-outline" size={32} color="#2563eb" />
            <Text style={styles.uploadButtonText}>
              {importFileName || t("users.import.select_file")}
            </Text>
            <Text style={styles.uploadButtonHint}>{t("users.import.supported_formats")}</Text>
          </TouchableOpacity>

          {importLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
          )}

          {importPreview.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>
                {t("users.import.preview")} ({importPreview.length})
              </Text>
              {importPreview.map((user, index) => (
                <View key={index} style={styles.previewCard}>
                  <View style={styles.previewRow}>
                    <Ionicons name="person-circle" size={24} color="#2563eb" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewName}>{user.full_name}</Text>
                      {user.email ? <Text style={styles.previewEmail}>{user.email}</Text> : null}
                      {user.phone ? <Text style={styles.previewPhone}>{user.phone}</Text> : null}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(user.role)}20` }]}>
                      <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
                        {t(`common.roles.${user.role}`)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.importButton} onPress={importUsers} disabled={importLoading}>
                <Text style={styles.importButtonText}>{t("users.import.import_all")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          {regularUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t("users.empty")}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
            <View style={styles.searchSortBar}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t("users.search_placeholder") || "Nach Name oder E-Mail suchen..."}
                  placeholderTextColor="#94a3b8"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === "name" && styles.sortBtnActive]}
                  onPress={() => { if (sortBy === "name") setSortAsc(!sortAsc); else { setSortBy("name"); setSortAsc(true); } }}
                >
                  <Ionicons name="text" size={14} color={sortBy === "name" ? "#2563eb" : "#64748b"} />
                  <Text style={[styles.sortBtnText, sortBy === "name" && styles.sortBtnTextActive]}>{t("users.full_name")}</Text>
                  {sortBy === "name" && <Ionicons name={sortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === "role" && styles.sortBtnActive]}
                  onPress={() => { if (sortBy === "role") setSortAsc(!sortAsc); else { setSortBy("role"); setSortAsc(true); } }}
                >
                  <Ionicons name="shield" size={14} color={sortBy === "role" ? "#2563eb" : "#64748b"} />
                  <Text style={[styles.sortBtnText, sortBy === "role" && styles.sortBtnTextActive]}>{t("users.role")}</Text>
                  {sortBy === "role" && <Ionicons name={sortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />}
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={filteredUsers}
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#2563eb"
                />
              }
            />
            </View>
          )}

          {canEditUsers && (
            <View style={styles.fabRow}>
              <TouchableOpacity style={[styles.fab, styles.fabSecondary]} onPress={() => setShowImport(true)}>
                <Ionicons name="cloud-upload-outline" size={24} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fab} onPress={() => setShowAddUser(true)}>
                <Ionicons name="person-add" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
        </>
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
  userCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 120,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
    flexShrink: 1,
  },
  userEmail: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  contactText: {
    fontSize: 13,
    color: "#64748b",
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  userActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
  },
  deleteButtonText: {
    color: "#ef4444",
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
  fabRow: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  fabSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  importContent: {
    flex: 1,
    padding: 16,
  },
  importHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  importTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  instructions: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  instructionsText: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 8,
  },
  instructionsBody: {
    fontSize: 14,
    color: "#1e40af",
    marginBottom: 8,
    lineHeight: 20,
  },
  instructionsExample: {
    fontSize: 11,
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    padding: 8,
    borderRadius: 4,
  },
  uploadButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 12,
  },
  uploadButtonHint: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 12,
  },
  previewSection: {
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  previewEmail: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 2,
  },
  previewPhone: {
    fontSize: 12,
    color: "#64748b",
  },
  importButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 32,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  addUserForm: {
    gap: 20,
  },
  addUserField: {
    gap: 8,
  },
  addUserLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  addUserInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  roleOptionActive: {
    backgroundColor: "#f8fafc",
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  searchSortBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    paddingVertical: 0,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  sortBtnActive: {
    backgroundColor: "#dbeafe",
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  sortBtnTextActive: {
    color: "#2563eb",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  tabBtnTextActive: {
    color: "#2563eb",
  },
  createButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
