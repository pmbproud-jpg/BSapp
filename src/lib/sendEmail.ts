import { Platform } from "react-native";

function getBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_SITE_URL || "https://bsapp-management.netlify.app";
}

export async function sendPasswordEmail(
  to: string,
  userName: string,
  actionLink: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/.netlify/functions/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, userName, actionLink }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      return { success: false, error: result?.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}
