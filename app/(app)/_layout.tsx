import { Tabs, router } from "expo-router";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { useCompany } from "@/src/providers/CompanyProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { usePermissions } from "@/src/hooks/usePermissions";
import { useGPSTracking } from "@/src/hooks/useGPSTracking";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

function AppHeader({ compact = false }: { compact?: boolean }) {
  const { user, profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { companyName, logoUrl } = useCompany();
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (compact) {
    return (
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.headerBg }}>
        <View style={[styles.compactHeader, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <View style={styles.compactLeft}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} resizeMode="contain" />
            ) : (
              <Ionicons name="business" size={18} color={colors.primary} />
            )}
            <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>{companyName}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/(app)/notifications" as any)}
              style={styles.notifButton}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.headerBg }}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={styles.companySection}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={{ width: 28, height: 28, borderRadius: 6 }} resizeMode="contain" />
            ) : (
              <Ionicons name="business" size={24} color={colors.primary} />
            )}
            <Text style={[styles.companyName, { color: colors.text }]}>{companyName}</Text>
          </View>
          <View style={styles.userSection}>
            <View style={styles.userInfo}>
              <Ionicons name="person-circle" size={20} color={colors.textSecondary} />
              <Text style={[styles.userName, { color: colors.text }]}>{profile?.full_name || user?.email}</Text>
            </View>
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>
              {t(`common.roles.${profile?.role || "worker"}`)}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push("/(app)/notifications" as any)}
            style={styles.notifButton}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const perms = usePermissions();
  const insets = useSafeAreaInsets();
  const canViewUsers = perms.canViewUsers || perms.canManageSubcontractor;

  // GPS tracking — sends location if gps_enabled on user's profile
  useGPSTracking();

  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader compact />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.tabBarBg,
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
          header: () => <AppHeader />,
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
        name="plan"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="magazyn"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="absences"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="components/ProjectPlans"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="components/ResourceCalendar"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t("navigation.users"),
          href: canViewUsers ? "/(app)/users" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: (perms.isAdmin || perms.isManagement) ? ("/(app)/admin" as any) : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={size} color={color} />
          ),
        }}
      />
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
  );
}

const styles = StyleSheet.create({
  compactHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compactLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  compactName: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
    maxWidth: 200,
  },
  header: {
    paddingTop: 8,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  logoutButton: {
    padding: 8,
  },
  notifButton: {
    padding: 8,
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
});
