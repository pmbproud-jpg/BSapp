import { useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTranslation } from "react-i18next";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type UsageInfo = {
  input_tokens: number;
  output_tokens: number;
};

const AI_CHAT_URL =
  Platform.OS === "web"
    ? "/.netlify/functions/ai-chat"
    : `${process.env.EXPO_PUBLIC_APP_URL || "https://bsapp-management.netlify.app"}/.netlify/functions/ai-chat`;

export function useAIChat(projectId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { i18n } = useTranslation();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      setError(null);

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || "";

        // Build API messages from history (exclude id/timestamp)
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        abortRef.current = new AbortController();

        const response = await fetch(AI_CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            projectId: projectId || null,
            language: i18n.language,
          }),
          signal: abortRef.current.signal,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "AI error");
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [messages, loading, projectId, i18n.language]
  );

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setError(null);
    setLoading(false);
  }, []);

  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setLoading(false);
    }
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat,
    cancelRequest,
  };
}
