import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase/client";
import i18n from "../src/i18n";

type Lang = "de" | "pl" | "en";

const UI = {
  de: {
    title: "Passwort erstellen",
    info: "Erstellen Sie Ihr Passwort, um sich einzuloggen.",
    loading: "Link wird geprüft…",
    missingTokens: "Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link bei Ihrem Administrator an.",
    newPassword: "Neues Passwort",
    confirmPassword: "Passwort bestätigen",
    save: "Passwort speichern",
    goLogin: "Zurück zum Login",
    mismatch: "Passwörter stimmen nicht überein.",
    tooShort: "Passwort zu kurz (min. 8 Zeichen).",
    success: "Passwort wurde erstellt! Sie können sich jetzt einloggen.",
    genericError: "Fehler. Bitte erneut versuchen.",
    ready: "Bitte geben Sie Ihr neues Passwort ein.",
  },
  pl: {
    title: "Utwórz hasło",
    info: "Utwórz swoje hasło, aby się zalogować.",
    loading: "Sprawdzam link…",
    missingTokens: "Link jest nieprawidłowy lub wygasł. Poproś administratora o nowy link.",
    newPassword: "Nowe hasło",
    confirmPassword: "Potwierdź hasło",
    save: "Zapisz hasło",
    goLogin: "Wróć do logowania",
    mismatch: "Hasła nie są takie same.",
    tooShort: "Hasło za krótkie (min. 8 znaków).",
    success: "Hasło zostało utworzone! Możesz się teraz zalogować.",
    genericError: "Błąd. Spróbuj ponownie.",
    ready: "Wpisz swoje nowe hasło.",
  },
  en: {
    title: "Create password",
    info: "Create your password to log in.",
    loading: "Checking link…",
    missingTokens: "Link is invalid or expired. Ask your administrator for a new link.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    save: "Save password",
    goLogin: "Back to login",
    mismatch: "Passwords do not match.",
    tooShort: "Password too short (min 8 chars).",
    success: "Password created! You can now log in.",
    genericError: "Error. Please try again.",
    ready: "Please enter your new password.",
  },
};

function showMsg(title: string, msg: string) {
  if (Platform.OS === "web") window.alert(msg);
  else Alert.alert(title, msg);
}

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
  const detectedLang = (i18n.language?.slice(0, 2) || "de") as Lang;
  const lang = (["de", "pl", "en"].includes(detectedLang) ? detectedLang : "de") as Lang;
  const t = UI[lang];

  const [status, setStatus] = useState<string>(t.loading);
  const [busy, setBusy] = useState<boolean>(true);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [canSetPassword, setCanSetPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    let ready = false;

    function activate(email: string) {
      if (ready) return;
      ready = true;
      setUserEmail(email);
      setStatus(t.ready);
      setBusy(false);
      setCanSetPassword(true);
    }

    // 1. Listen for PASSWORD_RECOVERY — the session in this event comes from the
    //    recovery token in the URL, so session.user.email = invited user (not admin).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        activate(session.user?.email || "");
      }
    });
    subscriptionRef.current = subscription;

    // 2. Fallback: if detectSessionInUrl already consumed the token before our listener
    //    registered, wait then check. Also handles manual token parsing for native.
    setTimeout(async () => {
      if (ready) return;

      // On web, try to manually parse tokens from URL and set session
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const url = window.location.href;
        const tok = extractTokens(url);
        if (tok.access_token && tok.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: tok.access_token,
            refresh_token: tok.refresh_token,
          });
          if (!error) {
            const { data: { session } } = await supabase.auth.getSession();
            activate(session?.user?.email || "");
            return;
          }
        }
      }

      // Check if session already exists (token was auto-consumed)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        activate(session.user?.email || "");
      } else {
        // Native fallback
        if (Platform.OS !== "web") {
          try {
            const url = (await Linking.getInitialURL()) || "";
            const tok = extractTokens(url);
            if (tok.access_token && tok.refresh_token) {
              const { error } = await supabase.auth.setSession({
                access_token: tok.access_token,
                refresh_token: tok.refresh_token,
              });
              if (!error) {
                const { data: { session: s } } = await supabase.auth.getSession();
                activate(s?.user?.email || "");
                return;
              }
            }
          } catch {}
        }
        setStatus(t.missingTokens);
        setBusy(false);
      }
    }, 2000);

    // Native deep link listener
    let linkSub: any;
    if (Platform.OS !== "web") {
      linkSub = Linking.addEventListener("url", async (event) => {
        const tok = extractTokens(event?.url || "");
        if (tok.access_token && tok.refresh_token) {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: tok.access_token,
              refresh_token: tok.refresh_token,
            });
            if (!error) {
              const { data: { session } } = await supabase.auth.getSession();
              activate(session?.user?.email || "");
            }
          } catch {}
        }
      });
    }

    return () => {
      subscriptionRef.current?.unsubscribe();
      try { linkSub?.remove?.(); } catch {}
    };
  }, []);

  async function onSave() {
    if (!canSetPassword) {
      showMsg(t.title, t.missingTokens);
      return;
    }
    if (password.length < 8) {
      showMsg(t.title, t.tooShort);
      return;
    }
    if (password !== password2) {
      showMsg(t.title, t.mismatch);
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const savedEmail = session?.user?.email || userEmail || "";

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        showMsg(t.title, error.message);
        setBusy(false);
        return;
      }

      await supabase.auth.signOut();
      setUserEmail(savedEmail);
      setDone(true);
      setCanSetPassword(false);
    } catch {
      showMsg(t.title, t.genericError);
    } finally {
      setBusy(false);
    }
  }

  function goLogin() {
    if (userEmail) {
      router.replace(`/login?email=${encodeURIComponent(userEmail)}`);
    } else {
      router.replace("/login");
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12, maxWidth: 420, alignSelf: "center", width: "100%" }}>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: "#1e293b" }}>{t.title}</Text>
        <Text style={{ fontSize: 14, color: "#64748b", marginTop: 4, textAlign: "center" }}>{t.info}</Text>
      </View>

      {busy && !done && (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ marginTop: 8, color: "#64748b" }}>{status}</Text>
        </View>
      )}

      {!busy && !canSetPassword && !done && (
        <View style={{ gap: 12 }}>
          <View style={{ padding: 16, backgroundColor: "#fef2f2", borderRadius: 12, borderWidth: 1, borderColor: "#fecaca" }}>
            <Text style={{ color: "#dc2626", fontWeight: "600", textAlign: "center" }}>{status}</Text>
          </View>
          <Pressable onPress={goLogin} style={{ padding: 14, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" }}>
            <Text style={{ fontWeight: "800", color: "#fff" }}>{t.goLogin}</Text>
          </Pressable>
        </View>
      )}

      {done && (
        <View style={{ gap: 12 }}>
          <View style={{ padding: 16, backgroundColor: "#f0fdf4", borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0" }}>
            <Text style={{ color: "#16a34a", fontWeight: "700", textAlign: "center", fontSize: 15 }}>{t.success}</Text>
          </View>
          <Pressable onPress={goLogin} style={{ padding: 14, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" }}>
            <Text style={{ fontWeight: "800", color: "#fff", fontSize: 16 }}>{t.goLogin}</Text>
          </Pressable>
        </View>
      )}

      {canSetPassword && !done && (
        <View style={{ gap: 10 }}>
          {userEmail ? (
            <View style={{ padding: 14, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" }}>
              <Text style={{ color: "#64748b", fontSize: 13, textAlign: "center" }}>Login</Text>
              <Text style={{ color: "#1e293b", fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 2 }}>{userEmail}</Text>
            </View>
          ) : null}
          <View style={{ padding: 12, backgroundColor: "#eff6ff", borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe" }}>
            <Text style={{ color: "#2563eb", fontWeight: "600", textAlign: "center" }}>{status}</Text>
          </View>
          <View style={{ position: "relative" }}>
            <TextInput
              placeholder={t.newPassword}
              secureTextEntry={!showPass1}
              value={password}
              onChangeText={setPassword}
              style={{ borderWidth: 1, borderColor: "#cbd5e1", padding: 14, paddingRight: 48, borderRadius: 12, fontSize: 16, backgroundColor: "#fff" }}
            />
            <Pressable
              onPress={() => setShowPass1(!showPass1)}
              style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 18 }}>{showPass1 ? "🙈" : "👁"}</Text>
            </Pressable>
          </View>
          <View style={{ position: "relative" }}>
            <TextInput
              placeholder={t.confirmPassword}
              secureTextEntry={!showPass2}
              value={password2}
              onChangeText={setPassword2}
              style={{ borderWidth: 1, borderColor: "#cbd5e1", padding: 14, paddingRight: 48, borderRadius: 12, fontSize: 16, backgroundColor: "#fff" }}
            />
            <Pressable
              onPress={() => setShowPass2(!showPass2)}
              style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 18 }}>{showPass2 ? "🙈" : "👁"}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={onSave}
            disabled={busy}
            style={{ padding: 14, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: "800", color: "#fff", fontSize: 16 }}>{t.save}</Text>}
          </Pressable>
          <Pressable onPress={goLogin} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ fontWeight: "600", color: "#64748b" }}>{t.goLogin}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}