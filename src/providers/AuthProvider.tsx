import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { Alert, Platform } from "react-native";
import { supabase } from "../lib/supabase/client";
import i18n from "../i18n";
import type { Database } from "../lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let initialFetchDone = false;

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) {
        initialFetchDone = true;
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) {
        // Skip if initial fetch already handles this user
        if (initialFetchDone && fetchingRef.current) return;
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (!mountedRef.current) return;

      // Sprawdź wygaśnięcie dostępu dla podwykonawców
      const prof = data as Profile & { access_expires_at?: string };
      if (prof?.role === "subcontractor" && prof?.access_expires_at) {
        const expiresAt = new Date(prof.access_expires_at);
        if (expiresAt < new Date()) {
          const msg = i18n.t("auth.access_expired", "Twój dostęp wygasł. Skontaktuj się z administratorem.");
          if (Platform.OS === "web") {
            window.alert(msg);
          } else {
            Alert.alert(i18n.t("auth.access_expired_title", "Dostęp wygasł"), msg);
          }
          await supabase.auth.signOut();
          if (!mountedRef.current) return;
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }
      }

      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id]);

  // Auto-refresh profile every 60s to pick up permission changes
  useEffect(() => {
    if (!session?.user?.id) return;
    const interval = setInterval(() => {
      fetchProfile(session.user.id);
    }, 60_000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
