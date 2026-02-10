import { Tabs } from "expo-router";
import { useAuth } from "@/src/providers/AuthProvider";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

function CustomHeader() {
  const { user, profile, signOut } = useAuth();
  const { t } = useTranslation();

  const roleTranslations: Record<string, string> = {
    admin: t("common.roles.admin"),
    zarzad: t("common.roles.zarzad"),
    project_manager: t("common.roles.project_manager"),
    bauleiter: t("common.roles.bauleiter"),
    worker: t("common.roles.worker"),
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.companySection}>
          <Ionicons name="business" size={24} color="#2563eb" />
          <Text style={styles.companyName}>Building Solutions GmbH</Text>
        </View>
        
        <View style={styles.userSection}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle" size={20} color="#64748b" />
            <Text style={styles.userName}>{profile?.full_name || user?.email}</Text>
          </View>
          <Text style={styles.userRole}>{roleTranslations[profile?.role || "worker"]}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={22} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <CustomHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarStyle: {
            height: Platform.OS === "ios" ? 88 : 60,
            paddingBottom: Platform.OS === "ios" ? 24 : 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t("navigation.dashboard"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: t("navigation.projects"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t("navigation.tasks"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkmark-done" size={size} color={color} />
            ),
          }}
        />
        {isAdmin && (
          <Tabs.Screen
            name="users"
            options={{
              title: t("navigation.users"),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="people" size={size} color={color} />
              ),
            }}
          />
        )}
        <Tabs.Screen
          name="settings"
          options={{
            title: t("navigation.settings"),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#ffffff",
    paddingTop: Platform.OS === "ios" ? 50 : 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
  },
  companySection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },
  userSection: {
    marginLeft: 32,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginLeft: 6,
  },
  userRole: {
    fontSize: 13,
    color: "#64748b",
    marginLeft: 26,
  },
  logoutButton: {
    padding: 8,
    marginLeft: 12,
  },
});
