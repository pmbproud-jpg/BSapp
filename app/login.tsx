import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import i18n, { setLanguage, SupportedLanguage } from "../src/i18n";
import { supabase } from "../src/lib/supabase/client";

const REDIRECT_TO = "bsapp://reset-password";

function prettyErr(err: any) {
  if (!err) return "";
  return String(err?.message || err?.error_description || err?.error || JSON.stringify(err));
}

export default function LoginScreen() {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [, force] = useState(0);

  const resetDisabled = useMemo(() => resetLoading, [resetLoading]);
  const current = (i18n.language as SupportedLanguage) || "de";

  async function pickLang(lang: SupportedLanguage) {
    try {
      await setLanguage(lang);
      force((x) => x + 1);
    } catch (e: any) {
      Alert.alert("i18n", prettyErr(e));
    }
  }

  async function onLogin() {
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      Alert.alert(t("login.title"), t("common.error"));
      return;
    }
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        Alert.alert(t("login.title"), t("login.invalid"));
        return;
      }
    } catch (e2: any) {
      Alert.alert(t("login.title"), prettyErr(e2));
    } finally {
      setLoginLoading(false);
    }
  }

  async function onResetPassword() {
    const e = email.trim().toLowerCase();
    if (!e) {
      Alert.alert(t("login.resetTitle"), t("login.enterEmail"));
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: REDIRECT_TO });
      if (error) {
        Alert.alert(t("login.resetTitle"), prettyErr(error));
        return;
      }
      Alert.alert(t("login.resetTitle"), t("login.resetSent"));
    } catch (e2: any) {
      Alert.alert(t("login.resetTitle"), prettyErr(e2));
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

      <TextInput
        placeholder={t("common.password")}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
      />

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