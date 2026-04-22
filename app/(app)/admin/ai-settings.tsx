import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { Ionicons } from "@expo/vector-icons";

type AIKeys = {
  anthropic_api_key: string;
  openai_api_key: string;
};

function maskKey(key: string): string {
  if (!key || key.length < 12) return key;
  return key.substring(0, 7) + "..." + key.substring(key.length - 4);
}

export default function AISettingsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Load existing keys
  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabaseAdmin
          .from("company_settings")
          .select("anthropic_api_key, openai_api_key")
          .limit(1)
          .single();

        if (data) {
          const d = data as { anthropic_api_key: string | null; openai_api_key: string | null };
          if (d.anthropic_api_key) {
            setHasAnthropicKey(true);
            setAnthropicKey(d.anthropic_api_key);
          }
          if (d.openai_api_key) {
            setHasOpenaiKey(true);
            setOpenaiKey(d.openai_api_key);
          }
        }
      } catch (e) {
        console.error("Error loading AI settings:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only update keys that have been changed (not masked)
      if (anthropicKey && (!hasAnthropicKey || showAnthropicKey)) {
        updateData.anthropic_api_key = anthropicKey;
      }
      if (openaiKey && (!hasOpenaiKey || showOpenaiKey)) {
        updateData.openai_api_key = openaiKey;
      }

      // Get the company settings ID
      const { data: settings } = await supabaseAdmin
        .from("company_settings")
        .select("id")
        .limit(1)
        .single();

      if (settings) {
        const { error } = await supabaseAdmin
          .from("company_settings")
          .update(updateData)
          .eq("id", (settings as { id: string }).id);

        if (error) throw error;
      }

      setHasAnthropicKey(!!anthropicKey);
      setHasOpenaiKey(!!openaiKey);
      setShowAnthropicKey(false);
      setShowOpenaiKey(false);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);

      if (Platform.OS === "web") {
        window.alert(t("ai_settings.saved"));
      } else {
        Alert.alert(t("common.success"), t("ai_settings.saved"));
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : null) || t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (keyType: "anthropic" | "openai") => {
    const confirm = () => {
      return new Promise<boolean>((resolve) => {
        if (Platform.OS === "web") {
          resolve(window.confirm(t("ai_settings.delete_confirm")));
        } else {
          Alert.alert(
            t("ai_settings.delete_key"),
            t("ai_settings.delete_confirm"),
            [
              { text: t("common.cancel"), onPress: () => resolve(false) },
              { text: t("common.delete"), onPress: () => resolve(true), style: "destructive" },
            ]
          );
        }
      });
    };

    if (!(await confirm())) return;

    try {
      const { data: settings } = await supabaseAdmin
        .from("company_settings")
        .select("id")
        .limit(1)
        .single();

      if (settings) {
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (keyType === "anthropic") {
          updateData.anthropic_api_key = null;
          setAnthropicKey("");
          setHasAnthropicKey(false);
        } else {
          updateData.openai_api_key = null;
          setOpenaiKey("");
          setHasOpenaiKey(false);
        }

        await supabaseAdmin
          .from("company_settings")
          .update(updateData)
          .eq("id", (settings as { id: string }).id);
      }
    } catch (e) {
      console.error("Error deleting key:", e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: "#8b5cf6" + "18" }]}>
          <Ionicons name="sparkles" size={24} color="#8b5cf6" />
        </View>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{t("ai_settings.title")}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t("ai_settings.description")}</Text>
        </View>
      </View>

      {/* Info box */}
      <View style={[styles.infoBox, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
        <Ionicons name="information-circle-outline" size={18} color="#3b82f6" />
        <Text style={styles.infoText}>{t("ai_settings.info")}</Text>
      </View>

      {/* Anthropic API Key */}
      <View style={[styles.keyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.keyHeader}>
          <View style={[styles.keyIcon, { backgroundColor: "#8b5cf6" + "15" }]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#8b5cf6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.keyTitle, { color: colors.text }]}>Anthropic (Claude)</Text>
            <Text style={[styles.keyDesc, { color: colors.textMuted }]}>
              {t("ai_settings.anthropic_desc")}
            </Text>
          </View>
          {hasAnthropicKey && (
            <View style={[styles.statusBadge, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={styles.statusActive}>{t("ai_settings.active")}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.keyInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            value={showAnthropicKey ? anthropicKey : (hasAnthropicKey ? maskKey(anthropicKey) : anthropicKey)}
            onChangeText={(v) => { setAnthropicKey(v); setShowAnthropicKey(true); }}
            placeholder="sk-ant-api03-..."
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showAnthropicKey && hasAnthropicKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hasAnthropicKey && (
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowAnthropicKey(!showAnthropicKey)}
            >
              <Ionicons name={showAnthropicKey ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {hasAnthropicKey && (
          <TouchableOpacity style={styles.deleteLink} onPress={() => handleDeleteKey("anthropic")}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={styles.deleteLinkText}>{t("ai_settings.delete_key")}</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.keyHint, { color: colors.textMuted }]}>
          {t("ai_settings.anthropic_hint")}
        </Text>
      </View>

      {/* OpenAI API Key */}
      <View style={[styles.keyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.keyHeader}>
          <View style={[styles.keyIcon, { backgroundColor: "#22c55e" + "15" }]}>
            <Ionicons name="mic-outline" size={20} color="#22c55e" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.keyTitle, { color: colors.text }]}>OpenAI (Whisper)</Text>
            <Text style={[styles.keyDesc, { color: colors.textMuted }]}>
              {t("ai_settings.openai_desc")}
            </Text>
          </View>
          {hasOpenaiKey && (
            <View style={[styles.statusBadge, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={styles.statusActive}>{t("ai_settings.active")}</Text>
            </View>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.keyInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            value={showOpenaiKey ? openaiKey : (hasOpenaiKey ? maskKey(openaiKey) : openaiKey)}
            onChangeText={(v) => { setOpenaiKey(v); setShowOpenaiKey(true); }}
            placeholder="sk-..."
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showOpenaiKey && hasOpenaiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hasOpenaiKey && (
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowOpenaiKey(!showOpenaiKey)}
            >
              <Ionicons name={showOpenaiKey ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {hasOpenaiKey && (
          <TouchableOpacity style={styles.deleteLink} onPress={() => handleDeleteKey("openai")}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={styles.deleteLinkText}>{t("ai_settings.delete_key")}</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.keyHint, { color: colors.textMuted }]}>
          {t("ai_settings.openai_hint")}
        </Text>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: saving ? colors.border : colors.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : savedFeedback ? (
          <Ionicons name="checkmark" size={20} color="#fff" />
        ) : (
          <Ionicons name="save-outline" size={20} color="#fff" />
        )}
        <Text style={styles.saveButtonText}>
          {savedFeedback ? t("ai_settings.saved") : t("common.save")}
        </Text>
      </TouchableOpacity>

      {/* Features list */}
      <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.featuresTitle, { color: colors.text }]}>{t("ai_settings.features_title")}</Text>
        {[
          { icon: "chatbubbles", label: t("ai_settings.feat_chat"), needs: "anthropic" },
          { icon: "document-text", label: t("ai_settings.feat_reports"), needs: "anthropic" },
          { icon: "mic", label: t("ai_settings.feat_voice"), needs: "both" },
          { icon: "calendar", label: t("ai_settings.feat_plan"), needs: "anthropic" },
          { icon: "trending-up", label: t("ai_settings.feat_predict"), needs: "none" },
          { icon: "analytics", label: t("ai_settings.feat_gps"), needs: "none" },
        ].map((feat, i) => {
          const ready =
            feat.needs === "none" ||
            (feat.needs === "anthropic" && hasAnthropicKey) ||
            (feat.needs === "openai" && hasOpenaiKey) ||
            (feat.needs === "both" && hasAnthropicKey && hasOpenaiKey);

          return (
            <View key={i} style={styles.featureRow}>
              <Ionicons name={feat.icon as keyof typeof Ionicons.glyphMap} size={16} color={ready ? "#22c55e" : colors.textMuted} />
              <Text style={[styles.featureLabel, { color: colors.text }]}>{feat.label}</Text>
              <Ionicons
                name={ready ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={ready ? "#22c55e" : colors.textMuted}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  headerIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 16,
  },
  infoText: { fontSize: 13, color: "#1e40af", flex: 1, lineHeight: 18 },
  keyCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  keyHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  keyIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  keyTitle: { fontSize: 15, fontWeight: "700" },
  keyDesc: { fontSize: 12, marginTop: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusActive: { fontSize: 11, fontWeight: "700", color: "#22c55e" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  keyInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  eyeButton: { padding: 8 },
  deleteLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  deleteLinkText: { fontSize: 12, color: "#ef4444" },
  keyHint: { fontSize: 11, marginTop: 8, lineHeight: 15 },
  saveButton: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    borderRadius: 12, paddingVertical: 14, marginTop: 4, marginBottom: 16, gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  featuresCard: { borderWidth: 1, borderRadius: 12, padding: 16 },
  featuresTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  featureLabel: { flex: 1, fontSize: 14 },
});
