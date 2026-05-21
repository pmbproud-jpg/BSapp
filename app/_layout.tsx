import React, { useEffect, useState, Component } from "react";
import { ActivityIndicator, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { AuthProvider, useAuth } from "../src/providers/AuthProvider";
import { ThemeProvider } from "../src/providers/ThemeProvider";
import { NotificationProvider } from "../src/providers/NotificationProvider";
import { CompanyProvider } from "../src/providers/CompanyProvider";
import i18n, { initI18n } from "../src/i18n";
import { queryClient } from "../src/lib/queryClient";
import UpdateChecker from "../src/components/UpdateChecker";

// ── Sentry init (observability) ──
// DSN z EXPO_PUBLIC_SENTRY_DSN (publiczny -- Sentry DSN z designu nie jest sekretem,
// idzie do bundla klienta). Region DE (Niemcy) -- zgodny z DSGVO.
// Bez DSN init no-op, aplikacja dziala normalnie.
//
// MINIMALNA konfiguracja po v1.3.4 hotfix:
//   - tracesSampleRate i enableAutoSessionTracking USUNIETE -- wpadly w jakims
//     hooku routera Expo i blokowaly nawigacje (klik w karte nie otwieral
//     szczegolow nawet po usunieciu Sentry.wrap w v1.3.1). Auto-tracking
//     nawigacji odlozony do osobnej iteracji z reactNavigationIntegration.
//   - Zostaje: error capture przez Sentry.captureException w ErrorBoundary
//     oraz unhandled errors auto-przechwytywane przez SDK.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
});

// ── DIAGNOSTYKA v1.3.7: global click listener (tylko web, do usuniecia po naprawie) ──
// User po v1.3.6 zglosil ze klik w karte usera nadal nie dziala mimo zmiany
// TouchableOpacity -> Pressable. console.log w onPress NIE pojawia sie. To znaczy
// ze klik w ogole nie trafia do React handler. Global listener pokaze co dokladnie
// element DOM dostaje click event -- pomoze zidentyfikowac overlay/blocker.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // eslint-disable-next-line no-console
    console.log("[GLOBAL CLICK]", {
      tag: target.tagName,
      className: target.className,
      ariaHidden: target.closest("[aria-hidden='true']") ? "INSIDE_ARIA_HIDDEN" : "no",
      defaultPrevented: e.defaultPrevented,
      eventPhase: e.eventPhase,
    });
  }, true); // useCapture=true -- lapie click w capture phase PRZED bubble
}

// ErrorBoundary — łapie błędy React i pokazuje ekran awaryjny zamiast crashu.
// componentDidCatch wysyla blad do Sentry przed pokazaniem fallbacku userowi.
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f8fafc" }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 8, textAlign: "center" }}>{i18n.t("common.something_went_wrong")}</Text>
          <Text style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24 }}>{this.state.error?.message || i18n.t("common.unknown_error")}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: "#2563eb", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{i18n.t("common.try_again")}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Komponent który obsługuje automatyczne przekierowania
function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Poczekaj aż Expo Router rozwiąże URL — segments może być puste przy pierwszym renderze
    if ((segments as string[]).length === 0) return;

    const inAuthGroup = segments[0] === "(app)";

    if (!session && inAuthGroup) {
      router.replace("/login");
    } else if (session && !inAuthGroup && segments[0] !== "reset-password") {
      router.replace("/(app)/dashboard");
    }
  }, [session, loading, segments]);

  return (
    <>
      <UpdateChecker />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initI18n();
      } catch (e) {
        console.warn("initI18n error", e);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <NotificationProvider>
                <CompanyProvider>
                  <RootLayoutNav />
                </CompanyProvider>
              </NotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Bez Sentry.wrap -- w v1.3.0 wprowadzony Sentry.wrap powodowal regresje
// nawigacji w Expo Router 6 (router.push przestawal dzialac na TouchableOpacity
// kart na liscie userow/projektow). Wrap wymaga dodatkowej konfiguracji
// reactNavigationIntegration ktora dla Expo Router jest skomplikowana.
// Bez wrapa nadal mamy: Sentry.init (capture exceptions), ErrorBoundary
// captureException, Sentry.setUser w AuthProvider. To wystarczy zeby
// crashe trafialy do dashboardu. Auto-tracking nawigacji odlozony.
export default RootLayout;