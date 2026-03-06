import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useCompany } from "@/src/providers/CompanyProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

function showMsg(t: any, key: string, fallback: string, type: "success" | "error" = "success") {
  const msg = t(`settings.${key}`, fallback);
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert(t(type === "success" ? "common.success" : "common.error"), msg);
}

export default function AdminCompany() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc } = useTheme();
  const { companyName, logoUrl, updateCompany } = useCompany();
  const [editName, setEditName] = useState(companyName);
  const [editLogo, setEditLogo] = useState(logoUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEditName(companyName); setEditLogo(logoUrl || ""); }, [companyName, logoUrl]);

  const pickLogo = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.alert(t("common.error"), t("settings.permission_required")); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8, aspect: [1, 1] });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = `company_logo_${Date.now()}.jpg`;
        const filePath = `company/${fileName}`;
        let uploadError: any;
        if (Platform.OS === "web") {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const { error } = await supabase.storage.from("attachments").upload(filePath, blob, { contentType: "image/jpeg", upsert: true });
          uploadError = error;
        } else {
          const FileSystem = require("expo-file-system/legacy");
          const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
          const binaryStr = global.atob ? global.atob(base64) : base64;
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const { error } = await supabase.storage.from("attachments").upload(filePath, bytes.buffer, { contentType: "image/jpeg", upsert: true });
          uploadError = error;
        }
        if (uploadError) { showMsg(t, "company_save_error", "Błąd uploadu logo", "error"); return; }
        const { data: urlData } = await supabase.storage.from("attachments").createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
        if (urlData?.signedUrl) setEditLogo(urlData.signedUrl);
      }
    } catch (e) { console.error("Error picking logo:", e); }
  };

  const save = async () => {
    if (!editName.trim()) { showMsg(t, "company_name_required", "Nazwa firmy jest wymagana", "error"); return; }
    setSaving(true);
    try {
      await updateCompany(editName.trim(), editLogo.trim() || null);
      showMsg(t, "company_saved", "Dane firmy zapisane");
    } catch { showMsg(t, "company_save_error", "Błąd zapisu", "error"); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tc.background }}>
      <View style={{ padding: 20 }}>
        {/* Back + header */}
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Ionicons name="arrow-back" size={22} color={tc.text} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: tc.text }}>{t("admin.tiles.company", "Firma")}</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={pickLogo} style={{ width: 100, height: 100, borderRadius: 20, backgroundColor: tc.surface, borderWidth: 2, borderColor: tc.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {editLogo ? (
              <Image source={{ uri: editLogo }} style={{ width: 100, height: 100 }} resizeMode="cover" />
            ) : (
              <Ionicons name="camera-outline" size={32} color={tc.textMuted} />
            )}
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: tc.textMuted, marginTop: 8 }}>{t("settings.tap_to_change_logo", "Kliknij aby zmienić logo")}</Text>
        </View>

        {/* Company name */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>{t("settings.company_name", "Nazwa firmy")}</Text>
        <TextInput
          value={editName}
          onChangeText={setEditName}
          style={{ borderWidth: 1, borderColor: tc.border, borderRadius: 10, padding: 12, fontSize: 16, color: tc.text, backgroundColor: tc.surface, marginBottom: 20 }}
        />

        {/* Save */}
        <TouchableOpacity onPress={save} disabled={saving} style={{ backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: saving ? 0.6 : 1 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{t("common.save")}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
