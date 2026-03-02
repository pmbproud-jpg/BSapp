/**
 * Hook zarządzający GPS użytkownika w widoku profilu:
 * fetchLastLocation, fetchLocationHistory, toggleGPS.
 * Wydzielony z users/[id].tsx.
 */
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";

export function useUserGPS(userId: string | undefined, t: any) {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsTogglingLoading, setGpsTogglingLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchLastLocation = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await (supabaseAdmin.from("user_locations") as any)
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setLastLocation(data);
      } else {
        // Fallback: read from profiles.last_latitude/last_longitude
        const { data: profileData } = await (supabaseAdmin.from("profiles") as any)
          .select("last_latitude, last_longitude, last_location_at")
          .eq("id", userId)
          .single();
        if (profileData?.last_latitude && profileData?.last_longitude) {
          setLastLocation({
            latitude: profileData.last_latitude,
            longitude: profileData.last_longitude,
            recorded_at: profileData.last_location_at || new Date().toISOString(),
          });
        } else {
          setLastLocation(null);
        }
      }
    } catch (e) {
      console.error("Error fetching last location:", e);
    }
  }, [userId]);

  const fetchLocationHistory = useCallback(async (date: string) => {
    if (!userId) return;
    try {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const { data } = await (supabaseAdmin.from("user_locations") as any)
        .select("*")
        .eq("user_id", userId)
        .gte("recorded_at", dayStart)
        .lte("recorded_at", dayEnd)
        .order("recorded_at", { ascending: true });
      setLocationHistory(data || []);
    } catch (e) {
      console.error("Error fetching location history:", e);
      setLocationHistory([]);
    }
  }, [userId]);

  const toggleGPS = async (value: boolean) => {
    if (!userId) return;
    setGpsTogglingLoading(true);
    try {
      const { error } = await (supabaseAdmin.from("profiles") as any)
        .update({ gps_enabled: value })
        .eq("id", userId);
      if (error) throw error;
      setGpsEnabled(value);
      const msg = value
        ? (t("users.gps_enabled") || "GPS-Tracking aktiviert")
        : (t("users.gps_disabled") || "GPS-Tracking deaktiviert");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e) {
      console.error("Error toggling GPS:", e);
      const msg = t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setGpsTogglingLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return {
    gpsEnabled, setGpsEnabled,
    gpsTogglingLoading,
    lastLocation, setLastLocation,
    locationHistory, showHistory, setShowHistory,
    historyDate, setHistoryDate,
    fetchLastLocation, fetchLocationHistory, toggleGPS, formatTime,
  };
}
