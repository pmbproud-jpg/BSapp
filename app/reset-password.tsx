import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase/client";

type Lang = "de" | "pl" | "en";

const UI = {
  de: {
    title: "Passwort zurücksetzen",
    info: "Bitte ein neues Passwort setzen.",
    loading: "Link wird geprüft…",
    missingTokens: "Der Link ist ungültig oder abgelaufen. Bitte neuen Link anfordern.",
    newPassword: "Neues Passwort",
    confirmPassword: "Passwort bestätigen",
    save: "Speichern",
    goLogin: "Zurück zum Login",
    mismatch: "Passwörter stimmen nicht überein.",
    tooShort: "Passwort zu kurz (min. 8 Zeichen).",
    success: "Passwort wurde geändert. Bitte einloggen.",
    genericError: "Fehler. Bitte erneut versuchen.",
  },
  pl: {
    title: "Reset hasła",
    info: "Ustaw nowe hasło.",
    loading: "Sprawdzam link…",
    missingTokens: "Link jest nieprawidłowy albo wygasł. Poproś o nowy link.",
    newPassword: "Nowe hasło",
    confirmPassword: "Potwierdź hasło",
    save: "Zapisz",
    goLogin: "Wróć do logowania",
    mismatch: "Hasła nie są takie same.",
    tooShort: "Hasło za krótkie (min. 8 znaków).",
    success: "Hasło zmienione. Zaloguj się ponownie.",
    genericError: "Błąd. Spróbuj ponownie.",
  },
  en: {
    title: "Reset password",
    info: "Set a new password.",
    loading: "Checking link…",
    missingTokens: "Link is invalid or expired. Request a new one.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    save: "Save",
    goLogin: "Back to login",
    mismatch: "Passwords do not match.",
    tooShort: "Password too short (min 8 chars).",
    success: "Password changed. Please log in again.",
    genericError: "Error. Please try again.",
  },
};

function extractTokens(url: string) {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  const raw = hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(raw);
  return {
    access_token: params.get("access_token") || "",
    refresh_token: params.get("refresh_token") || "",
    type: params.get("type") || "",
    error: params.get("error") || "",
    error_description: params.get("error_description") || "",
    raw,
  };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [lang] = useState<Lang>("de");
  const t = UI[lang];

  const [lastUrl, setLastUrl] = useState<string>("");
  const [status, setStatus] = useState<string>(t.loading);
  const [busy, setBusy] = useState<boolean>(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [canSetPassword, setCanSetPassword] = useState(false);
  const handledUrlRef = useRef<string>("");

  async function handleUrl(url: string) {
    if (!url || handledUrlRef.current === url) return;
    handledUrlRef.current = url;
    setLastUrl(url);

    const tok = extractTokens(url);
    if (tok.error || tok.error_description) {
      setStatus(tok.error_description || tok.error || t.missingTokens);
      setBusy(false);
      setCanSetPassword(false);
      return;
    }
    if (!tok.access_token || !tok.refresh_token) {
      setStatus(t.missingTokens);
      setBusy(false);
      setCanSetPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.setSession({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
      });
      if (error) {
        setStatus(`Fehler: ${error.message}`);
        setBusy(false);
        setCanSetPassword(false);
        return;
      }
      setStatus("Session OK.");
      setBusy(false);
      setCanSetPassword(true);
    } catch (e: any) {
      setStatus(`Fehler: ${e?.message || ""}`);
      setBusy(false);
      setCanSetPassword(false);
    }
  }

  useEffect(() => {
    let sub: any;
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      await handleUrl(initialUrl || "");
      sub = Linking.addEventListener("url", async (event) => {
        await handleUrl(event?.url || "");
      });
    })();
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, []);

  async function onSave() {
    if (!canSetPassword) {
      Alert.alert(t.title, t.missingTokens);
      return;
    }
    if (password.length < 8) {
      Alert.alert(t.title, t.tooShort);
      return;
    }
    if (password !== password2) {
      Alert.alert(t.title, t.mismatch);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert(t.title, `Fehler: ${error.message}`);
        setBusy(false);
        return;
      }
      await supabase.auth.signOut();
      Alert.alert(t.title, t.success);
      router.replace("/login");
    } catch {
      Alert.alert(t.title, t.genericError);
    } finally {
      setBusy(false);
    }
  }

  function goLogin() {
    router.replace("/login");
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>{t.title}</Text>
      <Text style={{ opacity: 0.8 }}>{t.info}</Text>
      <View style={{ padding: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 10 }}>
        <Text style={{ fontWeight: "700" }}>{status}</Text>
      </View>
      {!canSetPassword ? (
        <Pressable onPress={goLogin} style={{ padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" }}>
          <Text style={{ fontWeight: "800" }}>{t.goLogin}</Text>
        </Pressable>
      ) : (
        <>
          <TextInput
            placeholder={t.newPassword}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
          />
          <TextInput
            placeholder={t.confirmPassword}
            secureTextEntry
            value={password2}
            onChangeText={setPassword2}
            style={{ borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 10 }}
          />
          <Pressable
            onPress={onSave}
            disabled={busy}
            style={{ padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator /> : <Text style={{ fontWeight: "800" }}>{t.save}</Text>}
          </Pressable>
          <Pressable onPress={goLogin} style={{ padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" }}>
            <Text style={{ fontWeight: "800" }}>{t.goLogin}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}