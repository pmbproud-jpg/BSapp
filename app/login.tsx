import React, { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams } from "expo-router";
import i18n, { setLanguage, SupportedLanguage } from "../src/i18n";
import { supabase } from "../src/lib/supabase/client";

function getRedirectTo() {
  // Always use web URL — email link always opens in browser
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }
  return `${process.env.EXPO_PUBLIC_SITE_URL || "https://bsapp-management.netlify.app"}/reset-password`;
}

function showMsg(title: string, msg: string) {
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert(title, msg);
}

function prettyErr(err: any) {
  if (!err) return "";
  return String(err?.message || err?.error_description || err?.error || JSON.stringify(err));
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || "");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [, force] = useState(0);

  const resetDisabled = resetLoading;
  const current = (i18n.language as SupportedLanguage) || "de";

  async function pickLang(lang: SupportedLanguage) {
    try {
      await setLanguage(lang);
      force((x) => x + 1);
    } catch (e: any) {
      showMsg("i18n", prettyErr(e));
    }
  }

  async function onLogin() {
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      showMsg(t("login.title"), t("common.error"));
      return;
    }
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        showMsg(t("login.title"), t("login.invalid"));
        return;
      }
    } catch (e2: any) {
      showMsg(t("login.title"), prettyErr(e2));
    } finally {
      setLoginLoading(false);
    }
  }

  async function onResetPassword() {
    const e = email.trim().toLowerCase();
    if (!e) {
      showMsg(t("login.resetTitle"), t("login.enterEmail"));
      return;
    }
    setResetLoading(true);
    const redirectUrl = getRedirectTo();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;

      showMsg(t("login.resetTitle"), t("login.resetSent"));
    } catch (e2: any) {
      showMsg(t("login.resetTitle"), prettyErr(e2));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 10 }}>
      <Text style={{ fontSize: 28, fontWeight: "900" }}>{t("login.title")}</Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text style={{ fontSize: 12, opacity: 0.7 }}>{t("common.language")}:</Text>
        {(["de", "pl", "en"] as SupportedLanguage[]).map((l) => (
          <Pressable
            key={l}
            onPress={() => pickLang(l)}
            style={{
              borderWidth: 1,
              borderColor: l === current ? "#111" : "#ccc",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
              opacity: l === current ? 1 : 0.8,
            }}
          >
            <Text style={{ fontWeight: "900" }}>{l.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder={t("common.email")}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

      <View style={{ position: "relative" }}>
        <TextInput
          placeholder={t("common.password")}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, paddingRight: 48, borderRadius: 10 }}
        />
        <Pressable
          onPress={() => setShowPassword(!showPassword)}
          style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁"}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onLogin}
        disabled={loginLoading}
        style={{
          borderWidth: 1,
          borderColor: "#111",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          opacity: loginLoading ? 0.6 : 1,
        }}
      >
        {loginLoading ? <ActivityIndicator /> : <Text style={{ fontWeight: "900" }}>{t("login.button")}</Text>}
      </Pressable>

      <Pressable
        onPress={onResetPassword}
        disabled={resetDisabled}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          opacity: resetDisabled ? 0.5 : 1,
        }}
      >
        {resetLoading ? <ActivityIndicator /> : <Text style={{ fontWeight: "900" }}>{t("login.resetButton")}</Text>}
      </Pressable>
    </View>
  );
}