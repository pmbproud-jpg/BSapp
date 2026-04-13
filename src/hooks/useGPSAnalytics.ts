/**
 * Hook do analizy danych GPS — geofencing, czas na budowie,
 * statystyki czasu pracy, automatyczne clock-in/clock-out.
 */
import { useState, useCallback } from "react";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";

// ─── Types ───

export type LocationPoint = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
};

export type GeofenceZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  projectId?: string;
};

export type WorkerDaySummary = {
  userId: string;
  userName: string;
  date: string;
  firstSeen: string | null;
  lastSeen: string | null;
  totalMinutesOnSite: number;
  totalPoints: number;
  avgAccuracy: number;
  zones: { zoneName: string; minutes: number }[];
};

export type SitePresence = {
  userId: string;
  userName: string;
  userRole: string;
  isOnSite: boolean;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastSeenAt: string | null;
  distanceToSite: number | null; // meters
};

// ─── Helpers ───

/** Haversine distance in meters between two GPS coordinates */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Check if a point is inside a geofence zone */
function isInZone(lat: number, lon: number, zone: GeofenceZone): boolean {
  return haversineDistance(lat, lon, zone.latitude, zone.longitude) <= zone.radius;
}

/** Calculate on-site minutes from ordered location points (5-min intervals) */
function calculateOnSiteMinutes(
  points: LocationPoint[],
  zones: GeofenceZone[]
): { totalMinutes: number; perZone: Map<string, number> } {
  const perZone = new Map<string, number>();
  let totalMinutes = 0;
  const intervalMinutes = 5; // GPS sends every 5 min

  for (const pt of points) {
    for (const zone of zones) {
      if (isInZone(pt.latitude, pt.longitude, zone)) {
        totalMinutes += intervalMinutes;
        perZone.set(zone.name, (perZone.get(zone.name) || 0) + intervalMinutes);
        break; // count once per interval
      }
    }
  }

  return { totalMinutes, perZone };
}

// ─── Hook ───

export function useGPSAnalytics() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get daily summary for a specific worker on a specific date.
   */
  const getWorkerDaySummary = useCallback(
    async (
      userId: string,
      userName: string,
      date: string,
      zones: GeofenceZone[]
    ): Promise<WorkerDaySummary | null> => {
      try {
        const dayStart = `${date}T00:00:00`;
        const dayEnd = `${date}T23:59:59`;

        const { data, error: fetchErr } = await supabaseAdmin
          .from("user_locations")
          .select("*")
          .eq("user_id", userId)
          .gte("recorded_at", dayStart)
          .lte("recorded_at", dayEnd)
          .order("recorded_at", { ascending: true });

        if (fetchErr || !data) return null;

        const points = data as LocationPoint[];
        if (points.length === 0) {
          return {
            userId, userName, date,
            firstSeen: null, lastSeen: null,
            totalMinutesOnSite: 0, totalPoints: 0,
            avgAccuracy: 0, zones: [],
          };
        }

        const { totalMinutes, perZone } = calculateOnSiteMinutes(points, zones);

        const accuracies = points
          .map((p) => p.accuracy)
          .filter((a): a is number => a !== null);

        return {
          userId,
          userName,
          date,
          firstSeen: points[0].recorded_at,
          lastSeen: points[points.length - 1].recorded_at,
          totalMinutesOnSite: totalMinutes,
          totalPoints: points.length,
          avgAccuracy: accuracies.length > 0
            ? Math.round(accuracies.reduce((s, v) => s + v, 0) / accuracies.length)
            : 0,
          zones: Array.from(perZone.entries()).map(([zoneName, minutes]) => ({
            zoneName, minutes,
          })),
        };
      } catch {
        return null;
      }
    },
    []
  );

  /**
   * Get real-time presence of all GPS-enabled workers relative to a site.
   */
  const getSitePresence = useCallback(
    async (siteZone: GeofenceZone): Promise<SitePresence[]> => {
      setLoading(true);
      setError(null);
      try {
        const { data: profiles, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, role, gps_enabled, last_latitude, last_longitude, last_location_at")
          .eq("gps_enabled", true);

        if (profileErr || !profiles) {
          setError("Failed to load profiles");
          return [];
        }

        const result: SitePresence[] = profiles.map((p: any) => {
          const hasLocation = p.last_latitude != null && p.last_longitude != null;
          const distance = hasLocation
            ? haversineDistance(p.last_latitude, p.last_longitude, siteZone.latitude, siteZone.longitude)
            : null;

          return {
            userId: p.id,
            userName: p.full_name || "?",
            userRole: p.role || "worker",
            isOnSite: distance !== null && distance <= siteZone.radius,
            lastLatitude: p.last_latitude,
            lastLongitude: p.last_longitude,
            lastSeenAt: p.last_location_at,
            distanceToSite: distance !== null ? Math.round(distance) : null,
          };
        });

        // Sort: on-site first, then by distance
        result.sort((a, b) => {
          if (a.isOnSite && !b.isOnSite) return -1;
          if (!a.isOnSite && b.isOnSite) return 1;
          return (a.distanceToSite ?? Infinity) - (b.distanceToSite ?? Infinity);
        });

        return result;
      } catch (e: any) {
        setError(e.message || "Error");
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get team summary for a date — all GPS-enabled workers.
   */
  const getTeamDaySummary = useCallback(
    async (date: string, zones: GeofenceZone[]): Promise<WorkerDaySummary[]> => {
      setLoading(true);
      setError(null);
      try {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, gps_enabled")
          .eq("gps_enabled", true);

        if (!profiles) return [];

        const summaries: WorkerDaySummary[] = [];
        for (const p of profiles) {
          const summary = await getWorkerDaySummary(
            p.id, (p as any).full_name || "?", date, zones
          );
          if (summary) summaries.push(summary);
        }

        // Sort by on-site time desc
        summaries.sort((a, b) => b.totalMinutesOnSite - a.totalMinutesOnSite);

        return summaries;
      } catch (e: any) {
        setError(e.message || "Error");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [getWorkerDaySummary]
  );

  /**
   * Get location trail for a worker on a date (for map rendering).
   */
  const getWorkerTrail = useCallback(
    async (userId: string, date: string): Promise<LocationPoint[]> => {
      try {
        const dayStart = `${date}T00:00:00`;
        const dayEnd = `${date}T23:59:59`;

        const { data } = await supabaseAdmin
          .from("user_locations")
          .select("*")
          .eq("user_id", userId)
          .gte("recorded_at", dayStart)
          .lte("recorded_at", dayEnd)
          .order("recorded_at", { ascending: true });

        return (data as LocationPoint[]) || [];
      } catch {
        return [];
      }
    },
    []
  );

  return {
    loading,
    error,
    getWorkerDaySummary,
    getSitePresence,
    getTeamDaySummary,
    getWorkerTrail,
    // Exported utils
    haversineDistance,
    isInZone,
  };
}
