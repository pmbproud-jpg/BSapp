import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface SelectedUser {
  id: string;
  full_name: string | null;
  email: string;
  role?: string;
}

interface MultiSelectUsersProps {
  label?: string;
  selectedUsers: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
  placeholder?: string;
  projectRoles?: boolean; // Czy pokazywać wybór roli w projekcie
  excludeUserIds?: string[]; // ID użytkowników do wykluczenia (np. PM już przypisany)
}

// Role w projekcie
const PROJECT_ROLES = ["member", "leader", "observer"] as const;
type ProjectRole = typeof PROJECT_ROLES[number];

export default function MultiSelectUsers({
  label,
  selectedUsers,
  onChange,
  placeholder,
  projectRoles = false,
  excludeUserIds = [],
}: MultiSelectUsersProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);

  useEffect(() => {
    if (showModal) {
      fetchUsers();
    }
  }, [showModal]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    // Filtruj wykluczonych
    if (excludeUserIds.includes(user.id)) return false;
    
    // Filtruj po wyszukiwaniu
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const isSelected = (userId: string) => {
    return selectedUsers.some((u) => u.id === userId);
  };

  const toggleUser = (user: Profile) => {
    if (isSelected(user.id)) {
      onChange(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      onChange([
        ...selectedUsers,
        {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: projectRoles ? "member" : undefined,
        },
      ]);
    }
  };

  const updateUserRole = (userId: string, role: string) => {
    onChange(
      selectedUsers.map((u) =>
        u.id === userId ? { ...u, role } : u
      )
    );
    setEditingRole(null);
  };

  const removeUser = (userId: string) => {
    onChange(selectedUsers.filter((u) => u.id !== userId));
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      leader: "#2563eb",
      member: "#10b981",
      observer: "#64748b",
    };
    return colors[role] || "#94a3b8";
  };

  const renderSelectedUser = (user: SelectedUser) => (
    <View key={user.id} style={styles.selectedUserChip}>
      <View style={styles.selectedUserInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.selectedUserName} numberOfLines={1}>
          {user.full_name || user.email}
        </Text>
      </View>
      
      {projectRoles && user.role && (
        <TouchableOpacity
          style={[styles.roleBadge, { backgroundColor: `${getRoleColor(user.role)}20` }]}
          onPress={() => setEditingRole(editingRole === user.id ? null : user.id)}
        >
          <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
            {t(`team.roles.${user.role}`)}
          </Text>
          <Ionicons name="chevron-down" size={12} color={getRoleColor(user.role)} />
        </TouchableOpacity>
      )}
      
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeUser(user.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* Role dropdown */}
      {editingRole === user.id && projectRoles && (
        <View style={styles.roleDropdown}>
          {PROJECT_ROLES.map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleOption,
                user.role === role && styles.roleOptionActive,
              ]}
              onPress={() => updateUserRole(user.id, role)}
            >
              <Text
                style={[
                  styles.roleOptionText,
                  user.role === role && styles.roleOptionTextActive,
                ]}
              >
                {t(`team.roles.${role}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderUserItem = ({ item }: { item: Profile }) => {
    const selected = isSelected(item.id);
    return (
      <TouchableOpacity
        style={[styles.userItem, selected && styles.userItemSelected]}
        onPress={() => toggleUser(item)}
      >
        <View style={[styles.avatarLarge, selected && styles.avatarSelected]}>
          <Text style={[styles.avatarTextLarge, selected && styles.avatarTextSelected]}>
            {(item.full_name || item.email).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.full_name || item.email}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userRole}>{t(`common.roles.${item.role}`)}</Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Ionicons name="checkmark" size={16} color="#ffffff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Wybrani użytkownicy */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedUsersContainer}>
          {selectedUsers.map(renderSelectedUser)}
        </View>
      )}

      {/* Przycisk dodawania */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="person-add-outline" size={20} color="#2563eb" />
        <Text style={styles.addButtonText}>
          {selectedUsers.length === 0
            ? placeholder || t("team.add_members")
            : t("team.add_more")}
        </Text>
      </TouchableOpacity>

      {/* Modal wyboru */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("team.select_members")}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            {/* Wyszukiwarka */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder={t("team.search_placeholder")}
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery !== "" && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Licznik wybranych */}
            {selectedUsers.length > 0 && (
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionText}>
                  {t("team.selected_count", { count: selectedUsers.length })}
                </Text>
                <TouchableOpacity onPress={() => onChange([])}>
                  <Text style={styles.clearAllText}>{t("team.clear_all")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Lista użytkowników */}
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.userList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>{t("team.no_users_found")}</Text>
                </View>
              }
            />

            {/* Przycisk zatwierdzenia */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.confirmButtonText}>
                {t("common.confirm")} ({selectedUsers.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  selectedUsersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  selectedUserChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 8,
    gap: 8,
    position: "relative",
  },
  selectedUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  selectedUserName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1e293b",
    maxWidth: 100,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  removeButton: {
    marginLeft: 2,
  },
  roleDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginTop: 4,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    elevation: 4,
    zIndex: 100,
  },
  roleOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  roleOptionActive: {
    backgroundColor: "#eff6ff",
  },
  roleOptionText: {
    fontSize: 13,
    color: "#64748b",
  },
  roleOptionTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  selectionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
  },
  selectionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  clearAllText: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "500",
  },
  userList: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  userItemSelected: {
    backgroundColor: "#f8fafc",
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarSelected: {
    backgroundColor: "#2563eb",
  },
  avatarTextLarge: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  avatarTextSelected: {
    color: "#ffffff",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  userEmail: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 12,
  },
  confirmButton: {
    backgroundColor: "#2563eb",
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
