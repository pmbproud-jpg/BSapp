import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import type { Database } from "@/src/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function UsersScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
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

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "#ef4444",
      zarzad: "#f59e0b",
      project_manager: "#3b82f6",
      bauleiter: "#10b981",
      worker: "#64748b",
    };
    return colors[role] || "#94a3b8";
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      admin: "shield-checkmark",
      zarzad: "business",
      project_manager: "briefcase",
      bauleiter: "construct",
      worker: "hammer",
    };
    return icons[role] || "person";
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      t("users.delete_confirm_title"),
      t("users.delete_confirm_message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", userId);

              if (error) throw error;
              fetchUsers();
              Alert.alert(t("common.success"), t("users.deleted_success"));
            } catch (error) {
              console.error("Error deleting user:", error);
              Alert.alert(t("common.error"), t("users.delete_error"));
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: Profile }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userIcon}>
          <Ionicons
            name={getRoleIcon(item.role)}
            size={24}
            color={getRoleColor(item.role)}
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.full_name || item.email}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.phone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={14} color="#64748b" />
              <Text style={styles.contactText}>{item.phone}</Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: `${getRoleColor(item.role)}20` },
          ]}
        >
          <Text
            style={[styles.roleText, { color: getRoleColor(item.role) }]}
          >
            {t(`common.roles.${item.role}`)}
          </Text>
        </View>
      </View>

      {item.id !== profile?.id && (
        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/users/${item.id}/edit`)}
          >
            <Ionicons name="create-outline" size={18} color="#2563eb" />
            <Text style={styles.actionButtonText}>{t("common.edit")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteUser(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              {t("common.delete")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>{t("users.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563eb"
            />
          }
        />
      )}

      <Link href="/users/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Ionicons name="person-add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </Link>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
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
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
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
    marginLeft: 8,
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
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
