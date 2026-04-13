import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTranslation } from "react-i18next";
import { useAIChat, ChatMessage } from "@/src/hooks/useAIChat";
import { supabase } from "@/src/lib/supabase/client";
import { Ionicons } from "@expo/vector-icons";

type ProjectOption = {
  id: string;
  name: string;
};

// Quick suggestion buttons
function SuggestionChips({
  onPress,
  colors,
  t,
}: {
  onPress: (text: string) => void;
  colors: any;
  t: any;
}) {
  const suggestions = [
    { key: "daily_report", icon: "document-text-outline" as const },
    { key: "safety_check", icon: "shield-checkmark-outline" as const },
    { key: "vob_info", icon: "book-outline" as const },
    { key: "material_list", icon: "list-outline" as const },
  ];

  return (
    <View style={styles.suggestionsContainer}>
      <Text style={[styles.suggestionsTitle, { color: colors.textSecondary }]}>
        {t("ai_chat.suggestions.title")}
      </Text>
      <View style={styles.chipsRow}>
        {suggestions.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.chip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
            onPress={() => onPress(t(`ai_chat.suggestions.${s.key}`))}
          >
            <Ionicons name={s.icon} size={14} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.primary }]}>
              {t(`ai_chat.suggestions.${s.key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Single message bubble
function MessageBubble({ message, colors }: { message: ChatMessage; colors: any }) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.messageBubble,
        isUser
          ? [styles.userBubble, { backgroundColor: colors.primary }]
          : [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
      ]}
    >
      {!isUser && (
        <View style={styles.assistantHeader}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={[styles.assistantLabel, { color: colors.primary }]}>KI</Text>
        </View>
      )}
      <Text
        style={[
          styles.messageText,
          { color: isUser ? "#ffffff" : colors.text },
        ]}
        selectable
      >
        {message.content}
      </Text>
      <Text
        style={[
          styles.timestamp,
          { color: isUser ? "rgba(255,255,255,0.6)" : colors.textMuted },
        ]}
      >
        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );
}

export default function AIChatScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { t } = useTranslation();

  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [inputText, setInputText] = useState("");

  const { messages, loading, error, sendMessage, clearChat, cancelRequest } = useAIChat(selectedProjectId);
  const flatListRef = useRef<FlatList>(null);

  // Load projects for context picker
  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["planning", "active", "on_hold"])
        .order("name");
      if (data) setProjects(data);
    }
    loadProjects();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    sendMessage(text);
  }, [inputText, sendMessage]);

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    Alert.alert(t("ai_chat.clear"), t("ai_chat.clear_confirm"), [
      { text: t("ai_chat.cancel"), style: "cancel" },
      { text: t("common.ok"), onPress: clearChat, style: "destructive" },
    ]);
  }, [clearChat, t]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Project context selector */}
      <View style={[styles.contextBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.projectSelector, { borderColor: colors.border }]}
          onPress={() => setShowProjectPicker(!showProjectPicker)}
        >
          <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.projectText, { color: colors.text }]} numberOfLines={1}>
            {selectedProject ? selectedProject.name : t("ai_chat.all_projects")}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {messages.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Project picker dropdown */}
      {showProjectPicker && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.dropdownItem, !selectedProjectId && { backgroundColor: colors.primary + "15" }]}
            onPress={() => { setSelectedProjectId(undefined); setShowProjectPicker(false); }}
          >
            <Text style={[styles.dropdownText, { color: colors.text }]}>
              {t("ai_chat.all_projects")}
            </Text>
          </TouchableOpacity>
          {projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.dropdownItem, selectedProjectId === p.id && { backgroundColor: colors.primary + "15" }]}
              onPress={() => { setSelectedProjectId(p.id); setShowProjectPicker(false); }}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]} numberOfLines={1}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t("ai_chat.no_messages")}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {t("ai_chat.no_messages_desc")}
          </Text>
          <SuggestionChips onPress={handleSuggestion} colors={colors} t={t} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={[styles.thinkingBar, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>
            {t("ai_chat.thinking")}
          </Text>
          <TouchableOpacity onPress={cancelRequest}>
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={[styles.errorBar, { backgroundColor: "#fef2f2" }]}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          placeholder={t("ai_chat.placeholder")}
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={4000}
          editable={!loading}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() && !loading ? colors.primary : colors.border },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contextBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
  },
  projectSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  projectText: {
    flex: 1,
    fontSize: 14,
  },
  clearButton: {
    marginLeft: 10,
    padding: 6,
  },
  dropdown: {
    position: "absolute",
    top: 52,
    left: 10,
    right: 50,
    zIndex: 100,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 250,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  dropdownText: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  suggestionsContainer: {
    marginTop: 24,
    width: "100%",
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  messagesList: {
    padding: 12,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  assistantLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  thinkingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  thinkingText: {
    flex: 1,
    fontSize: 13,
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#ef4444",
    flex: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
});
