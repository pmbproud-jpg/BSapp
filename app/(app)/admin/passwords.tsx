import { useCompany } from "@/src/providers/CompanyProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

function showMsg(title: string, msg: string) {
  Platform.OS === "web" ? window.alert(msg) : Alert.alert(title, msg);
}

export default function AdminPasswords() {
  const { t } = useTranslation();
  const { colors: tc } = useTheme();
  const { defaultPassword, updateDefaultPassword } = useCompany();
  const [editPw, setEditPw] = useState(defaultPassword || "");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => { setEditPw(defaultPassword || ""); }, [defaultPassword]);

  const save = async () => {
    if (editPw.length < 6) {
      showMsg(t("common.error"), t("settings.default_pw_too_short", "Hasło musi mieć min. 6 znaków"));
      return;
    }
    setSaving(true);
    try {
      await updateDefaultPassword(editPw);
      showMsg(t("common.success"), t("settings.default_pw_saved", "Domyślne hasło zapisane"));
    } catch {
      showMsg(t("common.error"), t("settings.default_pw_error", "Błąd zapisu hasła"));
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tc.background }}>
      <View style={{ padding: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Ionicons name="arrow-back" size={22} color={tc.text} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: tc.text }}>{t("admin.tiles.passwords", "Hasła")}</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={{ backgroundColor: "#eff6ff", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#bfdbfe" }}>
          <Text style={{ fontSize: 13, color: "#1e40af", lineHeight: 20 }}>
            {t("settings.default_pw_info", "Domyślne hasło jest używane przy tworzeniu nowych użytkowników. Po pierwszym logowaniu użytkownik powinien zmienić hasło w Ustawieniach.")}
          </Text>
        </View>

        {/* Password input */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>
          {t("settings.default_password", "Domyślne hasło")}
        </Text>
        <View style={{ position: "relative", marginBottom: 20 }}>
          <TextInput
            value={editPw}
            onChangeText={setEditPw}
            secureTextEntry={!showPw}
            placeholder={t("settings.default_pw_placeholder", "Min. 6 znaków")}
            placeholderTextColor={tc.textMuted}
            style={{ borderWidth: 1, borderColor: tc.border, borderRadius: 10, padding: 12, paddingRight: 48, fontSize: 16, color: tc.text, backgroundColor: tc.surface }}
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}>
            <Ionicons name={showPw ? "eye-off" : "eye"} size={22} color={tc.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Current value indicator */}
        {defaultPassword && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20, padding: 12, backgroundColor: "#f0fdf4", borderRadius: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text style={{ fontSize: 13, color: "#166534" }}>
              {t("settings.default_pw_active", "Domyślne hasło jest aktywne")}
            </Text>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity onPress={save} disabled={saving} style={{ backgroundColor: "#ea580c", paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: saving ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="key" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{t("common.save")}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
