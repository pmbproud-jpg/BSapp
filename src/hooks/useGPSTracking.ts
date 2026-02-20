import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import * as Location from "expo-location";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
import { useAuth } from "@/src/providers/AuthProvider";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useGPSTracking() {
  const { profile } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const gpsEnabled = !!(profile as any)?.gps_enabled;
  const userId = profile?.id;

  const sendLocation = useCallback(async () => {
    if (!userId) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await (supabaseAdmin.from("user_locations") as any).insert({
        user_id: userId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        altitude: loc.coords.altitude,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        recorded_at: new Date(loc.timestamp).toISOString(),
      });
    } catch (e) {
      // Silently fail — GPS may not be available
      console.warn("GPS tracking error:", e);
    }
  }, [userId]);

  useEffect(() => {
    if (!gpsEnabled || !userId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send immediately on enable
    sendLocation();

    // Then every INTERVAL_MS
    intervalRef.current = setInterval(sendLocation, INTERVAL_MS);

    // Listen for app state changes (resume from background)
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        sendLocation();
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, [gpsEnabled, userId, sendLocation]);
}
