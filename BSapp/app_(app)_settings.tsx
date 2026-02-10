import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);

  const currentLanguage = i18n.language;

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
      const { error } = await supabase
        .from("profiles")
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
      zarzad: "#f59e0b",
      project_manager: "#3b82f6",
      bauleiter: "#10b981",
      worker: "#64748b",
    };
    return colors[role] || "#94a3b8";
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.profile")}</Text>

        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color="#2563eb" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
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
            <Text style={styles.label}>{t("settings.email")}</Text>
            <Text style={styles.value}>{profile?.email}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("settings.full_name")}</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t("settings.full_name_placeholder")}
              placeholderTextColor="#94a3b8"
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
        <Text style={styles.sectionTitle}>{t("settings.language")}</Text>

        <View style={styles.card}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                currentLanguage === lang.code && styles.languageOptionActive,
              ]}
              onPress={() => changeLanguage(lang.code)}
            >
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <Text style={styles.languageName}>{lang.name}</Text>
              {currentLanguage === lang.code && (
                <Ionicons name="checkmark-circle" size={24} color="#2563eb" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings.company")}</Text>

        <View style={styles.card}>
          <View style={styles.companyInfo}>
            <Ionicons name="business" size={24} color="#2563eb" />
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>Building Solutions GmbH</Text>
              <Text style={styles.companySubtext}>
                {t("settings.company_member")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutButtonText}>{t("settings.logout")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>BSapp v1.0.0</Text>
        <Text style={styles.footerText}>Building Solutions GmbH</Text>
      </View>
    </ScrollView>
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
});
