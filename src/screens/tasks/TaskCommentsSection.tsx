/**
 * Sekcja komentarzy zadania:
 * - lista komentarzy z opcja tlumaczenia PL<->DE per komentarz
 * - input do dodawania nowego komentarza (gated przez canComment)
 * Wydzielona z tasks/[id].tsx (Faza 2 step 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";

import { translateText } from "@/src/hooks/useAutoTranslate";
import type { Database } from "@/src/lib/supabase/database.types";

import { styles } from "./styles";

type Comment = Database["public"]["Tables"]["task_comments"]["Row"] & {
  profiles?: { full_name: string };
};

type Props = {
  comments: Comment[];
  newComment: string;
  setNewComment: (v: string) => void;
  submittingComment: boolean;
  canComment: boolean;
  onAddComment: () => void;
};

export function TaskCommentsSection({
  comments, newComment, setNewComment, submittingComment, canComment, onAddComment,
}: Props) {
  const { t } = useTranslation();
  const [commentTranslations, setCommentTranslations] = useState<Record<string, string>>({});
  const [commentTranslatingId, setCommentTranslatingId] = useState<string | null>(null);
  const [commentTranslateDir, setCommentTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t("tasks.comments")}</Text>

      {comments.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Ionicons name="language" size={16} color="#64748b" />
          <TouchableOpacity
            style={{ backgroundColor: commentTranslateDir === "pl|de" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
            onPress={() => { setCommentTranslateDir("pl|de"); setCommentTranslations({}); }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: commentTranslateDir === "pl|de" ? "#fff" : "#64748b" }}>PL → DE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: commentTranslateDir === "de|pl" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
            onPress={() => { setCommentTranslateDir("de|pl"); setCommentTranslations({}); }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: commentTranslateDir === "de|pl" ? "#fff" : "#64748b" }}>DE → PL</Text>
          </TouchableOpacity>
        </View>
      )}

      {comments.length === 0 ? (
        <Text style={styles.emptyText}>{t("tasks.no_comments")}</Text>
      ) : (
        comments.map((comment) => (
          <View key={comment.id} style={styles.comment}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>
                {comment.profiles?.full_name || "Unknown"}
              </Text>
              <Text style={styles.commentDate}>
                {new Date(comment.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.comment}</Text>
            {commentTranslations[comment.id] ? (
              <View style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: 8, marginTop: 6, borderWidth: 1, borderColor: "#bbf7d0" }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                  {commentTranslateDir === "pl|de" ? "DE:" : "PL:"}
                </Text>
                <Text style={{ fontSize: 13, color: "#166534" }}>{commentTranslations[comment.id]}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start" }}
              disabled={commentTranslatingId === comment.id}
              onPress={async () => {
                setCommentTranslatingId(comment.id);
                try {
                  const result = await translateText(comment.comment, commentTranslateDir);
                  setCommentTranslations((prev) => ({ ...prev, [comment.id]: result }));
                } catch (e) { console.error("Comment translation error:", e); }
                finally { setCommentTranslatingId(null); }
              }}
            >
              {commentTranslatingId === comment.id ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Ionicons name="swap-horizontal" size={14} color="#2563eb" />
              )}
              <Text style={{ fontSize: 11, color: "#2563eb", fontWeight: "500" }}>
                {commentTranslations[comment.id] ? "↻" : "Übersetzen"}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {canComment && (
        <View style={styles.addComment}>
          <TextInput
            style={styles.commentInput}
            value={newComment}
            onChangeText={setNewComment}
            placeholder={t("tasks.add_comment")}
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.commentButton,
              (!newComment.trim() || submittingComment) &&
                styles.commentButtonDisabled,
            ]}
            onPress={onAddComment}
            disabled={!newComment.trim() || submittingComment}
          >
            <Ionicons name="send" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
