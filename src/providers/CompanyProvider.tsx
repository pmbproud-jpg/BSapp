import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { adminApi as supabaseAdmin } from "../lib/supabase/adminApi";
import { useAuth } from "./AuthProvider";

type CompanySettings = {
  id: string;
  company_name: string;
  logo_url: string | null;
  default_password: string | null;
};

type CompanyContextType = {
  companyName: string;
  logoUrl: string | null;
  defaultPassword: string | null;
  loading: boolean;
  updateCompany: (name: string, logoUrl: string | null) => Promise<void>;
  updateDefaultPassword: (password: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType>({
  companyName: "Building Solutions GmbH",
  logoUrl: null,
  defaultPassword: null,
  loading: false,
  updateCompany: async () => {},
  updateDefaultPassword: async () => {},
  refresh: async () => {},
});

export function useCompany() {
  return useContext(CompanyContext);
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin.from("company_settings")
        .select("id, company_name, logo_url, default_password")
        .limit(1)
        .single();
      if (!error && data) {
        // If logo_url is a public URL from private bucket, regenerate signed URL
        if (data.logo_url && data.logo_url.includes("/storage/v1/object/public/attachments/")) {
          const path = data.logo_url.split("/storage/v1/object/public/attachments/")[1];
          if (path) {
            const { data: signedData } = await supabaseAdmin.storage
              .from("attachments")
              .createSignedUrl(path, 60 * 60 * 24 * 30);
            if (signedData?.signedUrl) {
              data.logo_url = signedData.signedUrl;
              // Update in DB so next time it loads faster
              await supabaseAdmin.from("company_settings")
                .update({ logo_url: signedData.signedUrl })
                .eq("id", data.id);
            }
          }
        }
        setSettings(data);
      }
    } catch (e) {
      console.error("Error fetching company settings:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateCompany = async (name: string, logoUrl: string | null) => {
    if (!settings?.id) return;
    try {
      const { error } = await supabaseAdmin.from("company_settings")
        .update({
          company_name: name,
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        })
        .eq("id", settings.id);
      if (error) throw error;
      setSettings({ ...settings, company_name: name, logo_url: logoUrl });
    } catch (e) {
      console.error("Error updating company settings:", e);
      throw e;
    }
  };

  const updateDefaultPassword = async (password: string) => {
    if (!settings?.id) return;
    try {
      const { error } = await supabaseAdmin.from("company_settings")
        .update({
          default_password: password,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id || null,
        })
        .eq("id", settings.id);
      if (error) throw error;
      setSettings({ ...settings, default_password: password });
    } catch (e) {
      console.error("Error updating default password:", e);
      throw e;
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        companyName: settings?.company_name || "Building Solutions GmbH",
        logoUrl: settings?.logo_url || null,
        defaultPassword: settings?.default_password || null,
        loading,
        updateCompany,
        updateDefaultPassword,
        refresh: fetchSettings,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}
