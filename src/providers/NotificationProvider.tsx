import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform, Alert } from "react-native";
import { supabase } from "../lib/supabase/client";
import { supabaseAdmin } from "../lib/supabase/adminClient";
import { useAuth } from "./AuthProvider";
import { useTranslation } from "react-i18next";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title_de: string;
  title_pl: string;
  title_en: string;
  message_de: string | null;
  message_pl: string | null;
  message_en: string | null;
  data: any;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  data: any;
  created_at: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (userId: string, title: string, body: string, type?: string, data?: any) => Promise<void>;
  clearAll: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  sendNotification: async () => {},
  clearAll: async () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const lang = (i18n.language || "de").substring(0, 2) as "de" | "pl" | "en";

  const mapRow = useCallback((row: NotificationRow): Notification => {
    const l = lang;
    return {
      id: row.id,
      user_id: row.user_id,
      title: row[`title_${l}`] || row.title_de || row.title_pl || row.title_en || "",
      body: row[`message_${l}`] || row.message_de || row.message_pl || row.message_en || "",
      type: row.type,
      read: !!row.read_at,
      data: row.data,
      created_at: row.created_at,
    };
  }, [lang]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("notifications") as any)
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications((data || []).map(mapRow));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, mapRow]);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
      // Poll every 30 seconds for new notifications
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [profile?.id, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await (supabase.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;
    try {
      await (supabase.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", profile.id)
        .is("read_at", null);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const KNOWN_TYPES = new Set([
    "task_assigned", "task_updated", "task_completed", "task_overdue",
    "project_updated", "comment_added", "deadline_reminder", "custom",
    "plan_assignment", "project_member",
  ]);

  const sendNotification = async (
    userId: string,
    title: string,
    body: string,
    type: string = "custom",
    data: any = null
  ) => {
    try {
      const safeType = KNOWN_TYPES.has(type) ? type : "custom";
      const payload = {
        user_id: userId,
        type: safeType,
        title_de: title,
        title_pl: title,
        title_en: title,
        message_de: body,
        message_pl: body,
        message_en: body,
        data: { ...data, original_type: type !== safeType ? type : undefined },
      };
      console.log("[sendNotification] Sending:", JSON.stringify(payload));
      const { data: result, error } = await (supabaseAdmin.from("notifications") as any).insert(payload).select();
      if (error) {
        console.error("[sendNotification] DB error:", JSON.stringify(error));
      } else {
        console.log("[sendNotification] OK, inserted:", result);
      }
    } catch (error) {
      console.error("[sendNotification] Exception:", error);
    }
  };

  const clearAll = async () => {
    if (!profile?.id) return;
    try {
      await (supabase.from("notifications") as any)
        .delete()
        .eq("user_id", profile.id);
      setNotifications([]);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        sendNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
