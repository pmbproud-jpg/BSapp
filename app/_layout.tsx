import React, { useEffect, useState, Component } from "react";
import { ActivityIndicator, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../src/providers/AuthProvider";
import { ThemeProvider } from "../src/providers/ThemeProvider";
import { NotificationProvider } from "../src/providers/NotificationProvider";
import { CompanyProvider } from "../src/providers/CompanyProvider";
import { initI18n } from "../src/i18n";
import UpdateChecker from "../src/components/UpdateChecker";

// ErrorBoundary — łapie błędy React i pokazuje ekran awaryjny zamiast crashu
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f8fafc" }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 8, textAlign: "center" }}>Coś poszło nie tak</Text>
          <Text style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24 }}>{this.state.error?.message || "Nieznany błąd"}</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: "#2563eb", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Spróbuj ponownie</Text>
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

export default function RootLayout() {
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
    </ErrorBoundary>
  );
}