import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform, Alert } from "react-native";
import { supabase } from "../lib/supabase/client";
import { supabaseAdmin } from "../lib/supabase/adminClient";
import { useAuth } from "./AuthProvider";

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

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
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

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
        .update({ read: true })
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
        .update({ read: true })
        .eq("user_id", profile.id)
        .eq("read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const sendNotification = async (
    userId: string,
    title: string,
    body: string,
    type: string = "info",
    data: any = null
  ) => {
    try {
      await (supabaseAdmin.from("notifications") as any).insert({
        user_id: userId,
        title,
        body,
        type,
        data,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
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
