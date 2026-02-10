import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "bsapp_theme_mode";

export const lightColors = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceVariant: "#f1f5f9",
  text: "#1e293b",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  primary: "#2563eb",
  primaryLight: "#dbeafe",
  success: "#10b981",
  successLight: "#d1fae5",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  danger: "#ef4444",
  dangerLight: "#fee2e2",
  purple: "#8b5cf6",
  purpleLight: "#ede9fe",
  card: "#ffffff",
  headerBg: "#ffffff",
  tabBarBg: "#ffffff",
  inputBg: "#f8fafc",
  overlay: "rgba(0,0,0,0.5)",
};

export const darkColors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceVariant: "#334155",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  border: "#334155",
  borderLight: "#1e293b",
  primary: "#3b82f6",
  primaryLight: "#1e3a5f",
  success: "#10b981",
  successLight: "#064e3b",
  warning: "#f59e0b",
  warningLight: "#78350f",
  danger: "#ef4444",
  dangerLight: "#7f1d1d",
  purple: "#a78bfa",
  purpleLight: "#4c1d95",
  card: "#1e293b",
  headerBg: "#1e293b",
  tabBarBg: "#1e293b",
  inputBg: "#334155",
  overlay: "rgba(0,0,0,0.7)",
};

export type ThemeColors = typeof lightColors;

type ThemeContextType = {
  colors: ThemeColors;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  isDark: false,
  themeMode: "light",
  setThemeMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const stored = Platform.OS === "web"
        ? window.localStorage.getItem(THEME_STORAGE_KEY)
        : await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeModeState(stored);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoaded(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      if (Platform.OS === "web") {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
      } else {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    } catch (e) {
      // ignore
    }
  };

  const isDark =
    themeMode === "dark" || (themeMode === "system" && systemScheme === "dark");

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
