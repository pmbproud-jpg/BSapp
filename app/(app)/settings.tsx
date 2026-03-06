import { usePermissions } from "@/src/hooks/usePermissions";
import { setLanguage, SupportedLanguage } from "@/src/i18n";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useCompany } from "@/src/providers/CompanyProvider";
import { ThemeMode, useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const perms = usePermissions();
  const { colors, themeMode, setThemeMode, isDark } = useTheme();
  const { companyName } = useCompany();
  // Password change (for all users)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwChangeSaving, setPwChangeSaving] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; timestamp: string } | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);

  const currentLanguage = i18n.language;

  const changePassword = async () => {
    if (newPassword.length < 8) {
      const msg = t("settings.pw_too_short", "Nowe hasło musi mieć min. 8 znaków");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = t("settings.pw_mismatch", "Hasła nie są takie same");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    setPwChangeSaving(true);
    try {
      // Verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || "",
        password: currentPassword,
      });
      if (signInError) {
        const msg = t("settings.pw_current_wrong", "Aktualne hasło jest nieprawidłowe");
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      const msg = t("settings.pw_changed", "Hasło zostało zmienione");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      const msg = e?.message || t("settings.pw_change_error", "Błąd zmiany hasła");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally {
      setPwChangeSaving(false);
    }
  };

  useEffect(() => {
    loadGpsSettings();
  }, []);

  const getRoleColor = (role: string) => {
    const map: Record<string, string> = {
      admin: "#ef4444", management: "#f59e0b", project_manager: "#3b82f6",
      bauleiter: "#10b981", worker: "#64748b", office_worker: "#06b6d4",
      logistics: "#f97316", purchasing: "#ec4899", warehouse_manager: "#7c3aed",
    };
    return map[role] || "#94a3b8";
  };

  const loadGpsSettings = async () => {
    try {
      const stored = Platform.OS === "web"
        ? window.localStorage.getItem("bsapp_gps_enabled")
        : await AsyncStorage.getItem("bsapp_gps_enabled");
      if (stored === "true") setGpsEnabled(true);
      // Load last known location
      const locStr = Platform.OS === "web"
        ? window.localStorage.getItem("bsapp_gps_last")
        : await AsyncStorage.getItem("bsapp_gps_last");
      if (locStr) setGpsLocation(JSON.parse(locStr));
    } catch (e) { /* ignore */ }
  };

  const toggleGps = async (value: boolean) => {
    setGpsEnabled(value);
    try {
      if (Platform.OS === "web") {
        window.localStorage.setItem("bsapp_gps_enabled", value ? "true" : "false");
      } else {
        await AsyncStorage.setItem("bsapp_gps_enabled", value ? "true" : "false");
      }
      if (value) requestGpsLocation();
    } catch (e) { /* ignore */ }
  };

  const requestGpsLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        const msg = t("settings.gps_permission_denied") || "Keine Standortberechtigung";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert(t("common.error"), msg);
        setGpsEnabled(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const gpsData = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp: new Date().toISOString(),
      };
      setGpsLocation(gpsData);

      // Save locally
      const json = JSON.stringify(gpsData);
      if (Platform.OS === "web") window.localStorage.setItem("bsapp_gps_last", json);
      else await AsyncStorage.setItem("bsapp_gps_last", json);

      // Save to Supabase profile + user_locations history
      if (profile?.id) {
        await (supabase.from("profiles") as any)
          .update({ last_latitude: gpsData.lat, last_longitude: gpsData.lng, last_location_at: gpsData.timestamp })
          .eq("id", profile.id);

        // Insert into user_locations so it appears in user profile GPS view
        await supabaseAdmin.from("user_locations")
          .insert({
            user_id: profile.id,
            latitude: gpsData.lat,
            longitude: gpsData.lng,
            accuracy: loc.coords.accuracy || null,
            altitude: loc.coords.altitude || null,
            speed: loc.coords.speed || null,
            heading: loc.coords.heading || null,
            recorded_at: gpsData.timestamp,
          });
      }
    } catch (error: any) {
      console.error("GPS error:", error);
      const msg = error?.message || t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setGpsLoading(false);
    }
  };

  const languages = [
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "pl", name: "Polski", flag: "🇵🇱" },
    { code: "en", name: "English", flag: "🇬🇧" },
  ];

  const changeLanguage = async (lang: string) => {
    try {
      await setLanguage(lang as SupportedLanguage);
    } catch (error) {
      console.error("Error changing language:", error);
    }
  };

  const saveProfile = async () => {
    if (!profile?.id) return;
    if (!fullName.trim()) {
      Alert.alert(t("common.error"), t("settings.name_required"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase
        .from("profiles") as any)
        .update({ full_name: fullName.trim() })
        .eq("id", profile.id);

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

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Change Password - for all users */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t("settings.change_password", "Zmiana hasła")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t("settings.current_password", "Aktualne hasło")}
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, paddingRight: 44 }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPw}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPw(!showCurrentPw)}
                style={{ position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center" }}
              >
                <Ionicons name={showCurrentPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t("settings.new_password", "Nowe hasło")}
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, paddingRight: 44 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPw}
                placeholder={t("settings.new_pw_placeholder", "Min. 8 znaków")}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => setShowNewPw(!showNewPw)}
                style={{ position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center" }}
              >
                <Ionicons name={showNewPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t("settings.confirm_password", "Potwierdź hasło")}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showNewPw}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <TouchableOpacity
            style={[styles.saveButton, pwChangeSaving && styles.saveButtonDisabled]}
            onPress={changePassword}
            disabled={pwChangeSaving}
          >
            <Text style={styles.saveButtonText}>
              {pwChangeSaving ? t("common.loading") : t("settings.change_password", "Zmiana hasła")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
                  {t(`common.roles.${profile?.role || "worker"}`)}
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
              <Text style={[styles.companyName, { color: colors.text }]}>{companyName}</Text>
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

      {/* GPS Location — only Admin/Zarząd */}
      {perms.canManageGPS && (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t("settings.gps_title") || "Lokalizacja GPS"}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.twoFARow}>
            <View style={styles.twoFAInfo}>
              <Ionicons name="location" size={24} color={gpsEnabled ? "#10b981" : colors.textMuted} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.twoFATitle, { color: colors.text }]}>
                  {t("settings.gps_tracking") || "Śledzenie lokalizacji"}
                </Text>
                <Text style={[styles.twoFADesc, { color: colors.textMuted }]}>
                  {t("settings.gps_desc") || "Udostępnij swoją lokalizację kierownictwu"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.twoFAToggle, gpsEnabled && styles.twoFAToggleActive]}
              onPress={() => toggleGps(!gpsEnabled)}
            >
              <View style={[styles.twoFAToggleKnob, gpsEnabled && styles.twoFAToggleKnobActive]} />
            </TouchableOpacity>
          </View>

          {gpsEnabled && (
            <>
              <View style={[styles.autoDivider, { backgroundColor: colors.borderLight }]} />
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}
                onPress={requestGpsLocation}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                )}
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                  {t("settings.gps_refresh") || "Odśwież lokalizację"}
                </Text>
              </TouchableOpacity>

              {gpsLocation && (
                <View style={{ marginTop: 6, padding: 10, backgroundColor: `${colors.primary}10`, borderRadius: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="navigate" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: "600" }}>
                      {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>
                    {t("settings.gps_last_update") || "Ostatnia aktualizacja"}: {new Date(gpsLocation.timestamp).toLocaleString()}
                  </Text>
                  {Platform.OS === "web" && (
                    <TouchableOpacity
                      style={{ marginTop: 6 }}
                      onPress={() => {
                        window.open(`https://www.google.com/maps?q=${gpsLocation.lat},${gpsLocation.lng}`, "_blank");
                      }}
                    >
                      <Text style={{ fontSize: 12, color: "#2563eb", textDecorationLine: "underline" }}>
                        {t("settings.gps_open_map") || "Otwórz w Google Maps"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
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
        <Text style={[styles.footerText, { color: colors.textMuted }]}>{companyName}</Text>
      </View>
    </ScrollView>
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
