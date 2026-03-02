import LocalizedDatePicker from "@/components/LocalizedDatePicker";
import { translateText } from "@/src/hooks/useAutoTranslate";
import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { base64Decode } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type TaskStatus = "todo" | "in_progress" | "completed" | "blocked";
type TaskPriority = "low" | "medium" | "high";
type User = Database["public"]["Tables"]["profiles"]["Row"];

export default function NewTaskScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { sendNotification } = useNotifications();
  const { project_id } = useLocalSearchParams<{ project_id: string }>();
  const [loading, setLoading] = useState(false);

  // Guard: redirect if user cannot create tasks
  if (!perms.canCreateTask) {
    router.replace("/projects" as any);
    return null;
  }
  const [translating, setTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedDesc, setTranslatedDesc] = useState("");
  const [translateDir, setTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");
  const [projectName, setProjectName] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [planUsers, setPlanUsers] = useState<User[]>([]);
  const [projectUsers, setProjectUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: [] as string[],
    due_date: null as Date | null,
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
  });

  const statusOptions: TaskStatus[] = ["todo", "in_progress", "completed", "blocked"];
  const priorityOptions: TaskPriority[] = ["low", "medium", "high"];

  // Pending attachments (before task is saved)
  type PendingFile = { uri: string; name: string; type: string };
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!project_id) {
      Alert.alert(t("common.error"), "Project ID is required");
      router.back();
      return;
    }
    fetchProjectName();
    fetchUsers();
  }, [project_id]);

  const fetchProjectName = async () => {
    if (!project_id) return;
    try {
      const { data, error } = await (supabase
        .from("projects") as any)
        .select("name")
        .eq("id", project_id)
        .single();

      if (error) throw error;
      setProjectName((data as any)?.name || "");
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  };

  const fetchUsers = async () => {
    if (!project_id) return;
    try {
      let planWorkerIds: string[] = [];

      // 1. Pracownicy z planu dziennego
      const { data: planReqs } = await (supabaseAdmin.from("plan_requests") as any)
        .select("id")
        .eq("project_id", project_id);

      if (planReqs && planReqs.length > 0) {
        const reqIds = planReqs.map((r: any) => r.id);
        const { data: planAssign } = await (supabaseAdmin.from("plan_assignments") as any)
          .select("worker_id")
          .in("request_id", reqIds);

        if (planAssign && planAssign.length > 0) {
          planWorkerIds = [...new Set(planAssign.map((a: any) => a.worker_id))] as string[];
          const { data: pw } = await (supabaseAdmin.from("profiles") as any)
            .select("*")
            .in("id", planWorkerIds)
            .order("full_name");
          setPlanUsers(pw || []);
        }
      }

      // 2. Członkowie projektu (bez tych z planu)
      const { data: members } = await (supabaseAdmin.from("project_members") as any)
        .select("user_id")
        .eq("project_id", project_id);

      if (members && members.length > 0) {
        const memberIds = members.map((m: any) => m.user_id).filter((mid: string) => !planWorkerIds.includes(mid));
        if (memberIds.length > 0) {
          const { data: mp } = await (supabaseAdmin.from("profiles") as any)
            .select("*")
            .in("id", memberIds)
            .order("full_name");
          setProjectUsers(mp || []);
        }
      }

      // 3. Fallback: wszyscy (jeśli brak planu i członków)
      const allPlan = planWorkerIds.length > 0 ? planWorkerIds : [];
      const allMembers = members ? members.map((m: any) => m.user_id) : [];
      const combined = [...new Set([...allPlan, ...allMembers])];
      if (combined.length > 0) {
        const { data: cp } = await (supabaseAdmin.from("profiles") as any)
          .select("*")
          .in("id", combined)
          .order("full_name");
        setUsers(cp || []);
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("full_name");
        if (error) throw error;
        setUsers(data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Formatowanie daty do ISO string dla bazy danych
  const formatDateForDB = (date: Date | null): string | null => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleTranslate = async () => {
    if (!formData.title.trim() && !formData.description.trim()) return;
    setTranslating(true);
    setTranslatedTitle(""); setTranslatedDesc("");
    try {
      if (formData.title.trim()) {
        const r = await translateText(formData.title, translateDir);
        setTranslatedTitle(r);
      }
      if (formData.description.trim()) {
        const r = await translateText(formData.description, translateDir);
        setTranslatedDesc(r);
      }
    } catch (e) {
      console.error("Translation error:", e);
    } finally {
      setTranslating(false);
    }
  };

  const applyTranslation = () => {
    const tag = translateDir === "pl|de" ? "[DE]" : "[PL]";
    const newTitle = translatedTitle
      ? `${formData.title}\n${tag} ${translatedTitle}`
      : formData.title;
    const newDesc = translatedDesc
      ? `${formData.description}\n\n${tag} ${translatedDesc}`
      : formData.description;
    setFormData({ ...formData, title: newTitle, description: newDesc });
    setTranslatedTitle("");
    setTranslatedDesc("");
  };

  // --- File / Photo pickers ---
  const pickImageFromGallery = async () => {
    setShowFilePicker(false);
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert(t("common.error"), "Permission required"); return; }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        setPendingFiles((prev) => [...prev, { uri: a.uri, name: a.uri.split("/").pop() || `img_${Date.now()}.jpg`, type: a.mimeType || "image/jpeg" }]);
      }
    } catch (e) { console.error("Pick image error:", e); }
  };

  const takePhoto = async () => {
    setShowFilePicker(false);
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") { Alert.alert(t("common.error"), "Camera permission required"); return; }
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        setPendingFiles((prev) => [...prev, { uri: a.uri, name: a.uri.split("/").pop() || `photo_${Date.now()}.jpg`, type: a.mimeType || "image/jpeg" }]);
      }
    } catch (e) { console.error("Take photo error:", e); }
  };

  const pickDocument = async () => {
    setShowFilePicker(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets[0]) {
        const a = result.assets[0];
        setPendingFiles((prev) => [...prev, { uri: a.uri, name: a.name || `file_${Date.now()}`, type: a.mimeType || "application/octet-stream" }]);
      }
    } catch (e) { console.error("Pick document error:", e); }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPendingFiles = async (taskId: string) => {
    for (const file of pendingFiles) {
      try {
        const sanitized = file.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_");
        const filePath = `task/${taskId}/${Date.now()}_${sanitized}`;
        let fileSize = 0;

        if (Platform.OS === "web") {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          fileSize = blob.size;
          const { error: uploadError } = await supabaseAdmin.storage.from("attachments").upload(filePath, blob, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;
        } else {
          const fileInfo = await FileSystem.getInfoAsync(file.uri);
          fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;
          const base64Data = await FileSystem.readAsStringAsync(file.uri, { encoding: "base64" as any });
          const binaryStr = global.atob ? global.atob(base64Data) : base64Decode(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }
          const { error: uploadError } = await supabaseAdmin.storage.from("attachments").upload(filePath, bytes.buffer, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;
        }

        const { data: urlData } = supabaseAdmin.storage.from("attachments").getPublicUrl(filePath);
        await (supabaseAdmin.from("task_attachments") as any).insert({
          task_id: taskId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: fileSize,
        });
      } catch (e) {
        console.error("Error uploading file:", file.name, e);
      }
    }
  };

  const handleSubmit = async () => {
    console.log("[TASK] handleSubmit called, title:", formData.title, "project_id:", project_id);
    if (!formData.title.trim()) {
      Alert.alert(t("common.error"), t("tasks.title_required"));
      return;
    }

    setLoading(true);
    const taskData: any = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      project_id: project_id,
      status: formData.status || "todo",
      priority: formData.priority || "medium",
      created_by: profile?.id || null,
    };

    // Backward compat: zapisz pierwszego przypisanego w assigned_to
    if (formData.assigned_to.length > 0) {
      taskData.assigned_to = formData.assigned_to[0];
      taskData.assigned_by = profile?.id || null;
      taskData.assigned_at = new Date().toISOString();
    }
    if (formData.due_date) {
      taskData.due_date = formatDateForDB(formData.due_date);
    }

    try {
      console.log("[TASK] Inserting task:", JSON.stringify(taskData, null, 2));

      let { data, error } = await (supabaseAdmin
        .from("tasks") as any)
        .insert(taskData)
        .select()
        .single();

      // Fallback: jeśli created_by nie istnieje w bazie, spróbuj bez
      if (error && (error.message?.includes("created_by") || error.code === "PGRST204")) {
        console.warn("[TASK] Retrying without created_by...");
        delete taskData.created_by;
        const retry = await (supabaseAdmin.from("tasks") as any).insert(taskData).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      // Insert all assignees into task_assignees table
      if (formData.assigned_to.length > 0 && data?.id) {
        const assigneeRows = formData.assigned_to.map((uid) => ({
          task_id: data.id,
          user_id: uid,
          assigned_by: profile?.id || null,
        }));
        const { error: assignError } = await (supabaseAdmin.from("task_assignees") as any).insert(assigneeRows);
        if (assignError) console.warn("[TASK] Error inserting task_assignees:", assignError);
      }

      // Wyślij powiadomienia do przypisanych pracowników
      if (formData.assigned_to.length > 0 && data?.id) {
        for (const uid of formData.assigned_to) {
          if (uid !== profile?.id) {
            const title = t("notifications.task_assigned_title", "Nowe zadanie");
            const body = `${formData.title.trim()}${projectName ? ` • ${projectName}` : ""}`;
            sendNotification(uid, title, body, "task_assigned", { task_id: data.id, project_id: project_id });
          }
        }
      }

      // Upload pending files if any
      if (pendingFiles.length > 0 && data?.id) {
        setUploading(true);
        await uploadPendingFiles(data.id);
        setUploading(false);
      }

      if (Platform.OS === "web") {
        window.alert(t("tasks.created_success"));
      } else {
        Alert.alert(t("common.success"), t("tasks.created_success"));
      }
      // Wróć do projektu, nie do dashboard
      router.replace(`/projects/${project_id}` as any);
    } catch (error: any) {
      console.error("Error creating task:", JSON.stringify(error, null, 2));
      console.error("Task data was:", JSON.stringify(taskData, null, 2));
      const errMsg = error?.message || error?.details || t("tasks.create_error");
      if (Platform.OS === "web") {
        window.alert(errMsg);
      } else {
        Alert.alert(t("common.error"), errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => project_id ? router.replace(`/projects/${project_id}` as any) : router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("tasks.new")}{projectName ? ` — ${projectName}` : ""}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("tasks.title")} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder={t("tasks.title_placeholder")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder={t("tasks.description_placeholder")}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Auto-translate PL↔DE */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Ionicons name="language" size={18} color="#64748b" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b" }}>Übersetzen</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: translateDir === "pl|de" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                onPress={() => { setTranslateDir("pl|de"); setTranslatedTitle(""); setTranslatedDesc(""); }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: translateDir === "pl|de" ? "#fff" : "#64748b" }}>PL → DE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: translateDir === "de|pl" ? "#2563eb" : "#f1f5f9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                onPress={() => { setTranslateDir("de|pl"); setTranslatedTitle(""); setTranslatedDesc(""); }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: translateDir === "de|pl" ? "#fff" : "#64748b" }}>DE → PL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                onPress={handleTranslate}
                disabled={translating || (!formData.title.trim() && !formData.description.trim())}
              >
                {translating ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Ionicons name="swap-horizontal" size={16} color="#2563eb" />
                )}
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563eb" }}>Übersetzen</Text>
              </TouchableOpacity>
            </View>

            {(translatedTitle || translatedDesc) ? (
              <View style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
                {translatedTitle ? (
                  <View style={{ marginBottom: translatedDesc ? 6 : 0 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                      {translateDir === "pl|de" ? "Titel (DE):" : "Tytuł (PL):"}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#166534" }}>{translatedTitle}</Text>
                  </View>
                ) : null}
                {translatedDesc ? (
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", marginBottom: 2 }}>
                      {translateDir === "pl|de" ? "Beschreibung (DE):" : "Opis (PL):"}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#166534" }}>{translatedDesc}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#16a34a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                  onPress={applyTranslation}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>Übersetzung einfügen</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t("tasks.assigned_to")}
              {formData.assigned_to.length > 0 && (
                <Text style={{ color: "#2563eb", fontWeight: "700" }}> ({formData.assigned_to.length})</Text>
              )}
            </Text>
            <TouchableOpacity
              style={[
                styles.selectOption,
                formData.assigned_to.length === 0 && styles.selectOptionActive,
                { alignSelf: "flex-start", marginBottom: 8 },
              ]}
              onPress={() => setFormData({ ...formData, assigned_to: [] })}
            >
              <Text
                style={[
                  styles.selectOptionText,
                  formData.assigned_to.length === 0 && styles.selectOptionTextActive,
                ]}
              >
                — {t("common.none")}
              </Text>
            </TouchableOpacity>

            {planUsers.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#10b981", marginBottom: 4, textTransform: "uppercase" }}>
                  {t("plan.workers_from_plan")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {planUsers.map((user) => {
                    const selected = formData.assigned_to.includes(user.id);
                    return (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.selectOption,
                          selected && styles.selectOptionActive,
                          { borderColor: "#10b981", flexDirection: "row", alignItems: "center", gap: 4 },
                        ]}
                        onPress={() => {
                          const next = selected
                            ? formData.assigned_to.filter((uid) => uid !== user.id)
                            : [...formData.assigned_to, user.id];
                          setFormData({ ...formData, assigned_to: next });
                        }}
                      >
                        <Ionicons name={selected ? "checkbox" : "square-outline"} size={16} color={selected ? "#fff" : "#64748b"} />
                        <Text
                          style={[styles.selectOptionText, selected && styles.selectOptionTextActive]}
                          numberOfLines={1}
                        >
                          {user.full_name || user.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {projectUsers.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>
                  {t("tasks.project_members") || "Członkowie projektu"}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                  {projectUsers.map((user) => {
                    const selected = formData.assigned_to.includes(user.id);
                    return (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.selectOption,
                          selected && styles.selectOptionActive,
                          { flexDirection: "row", alignItems: "center", gap: 4 },
                        ]}
                        onPress={() => {
                          const next = selected
                            ? formData.assigned_to.filter((uid) => uid !== user.id)
                            : [...formData.assigned_to, user.id];
                          setFormData({ ...formData, assigned_to: next });
                        }}
                      >
                        <Ionicons name={selected ? "checkbox" : "square-outline"} size={16} color={selected ? "#fff" : "#64748b"} />
                        <Text
                          style={[styles.selectOptionText, selected && styles.selectOptionTextActive]}
                          numberOfLines={1}
                        >
                          {user.full_name || user.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {planUsers.length === 0 && projectUsers.length === 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {users.map((user) => {
                  const selected = formData.assigned_to.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.selectOption,
                        selected && styles.selectOptionActive,
                        { flexDirection: "row", alignItems: "center", gap: 4 },
                      ]}
                      onPress={() => {
                        const next = selected
                          ? formData.assigned_to.filter((uid) => uid !== user.id)
                          : [...formData.assigned_to, user.id];
                        setFormData({ ...formData, assigned_to: next });
                      }}
                    >
                      <Ionicons name={selected ? "checkbox" : "square-outline"} size={16} color={selected ? "#fff" : "#64748b"} />
                      <Text
                        style={[styles.selectOptionText, selected && styles.selectOptionTextActive]}
                        numberOfLines={1}
                      >
                        {user.full_name || user.email}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.priorityLabel")}</Text>
            <View style={styles.statusGrid}>
              {priorityOptions.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.statusOption,
                    formData.priority === priority && styles.statusOptionActive,
                    formData.priority === priority && priority === "high" && styles.priorityHigh,
                  ]}
                  onPress={() => setFormData({ ...formData, priority })}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      formData.priority === priority &&
                        styles.statusOptionTextActive,
                    ]}
                  >
                    {t(`tasks.priority.${priority}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("tasks.statusLabel")}</Text>
            <View style={styles.statusGrid}>
              {statusOptions.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    formData.status === status && styles.statusOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, status })}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      formData.status === status &&
                        styles.statusOptionTextActive,
                    ]}
                  >
                    {t(`tasks.status.${status}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <LocalizedDatePicker
              label={t("tasks.due_date")}
              value={formData.due_date}
              onChange={(date) => setFormData({ ...formData, due_date: date })}
              placeholder={t("common.select_date")}
              minimumDate={new Date()}
            />
          </View>

          {/* Attachments section */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("attachments.title") || "Załączniki"}</Text>
            {pendingFiles.length > 0 && (
              <View style={{ gap: 8, marginBottom: 12 }}>
                {pendingFiles.map((file, index) => (
                  <View key={index} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#e2e8f0" }}>
                    {file.type.startsWith("image/") ? (
                      <Image source={{ uri: file.uri }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }} />
                    ) : (
                      <Ionicons name="document-attach" size={24} color="#64748b" style={{ marginRight: 10 }} />
                    )}
                    <Text style={{ flex: 1, fontSize: 13, color: "#334155" }} numberOfLines={1}>{file.name}</Text>
                    <TouchableOpacity onPress={() => removePendingFile(index)} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
                onPress={pickImageFromGallery}
              >
                <Ionicons name="image-outline" size={18} color="#2563eb" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563eb" }}>{t("attachments.gallery") || "Galeria"}</Text>
              </TouchableOpacity>
              {Platform.OS !== "web" && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f0fdf4", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera-outline" size={18} color="#16a34a" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#16a34a" }}>{t("attachments.camera") || "Aparat"}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef3c7", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
                onPress={pickDocument}
              >
                <Ionicons name="document-outline" size={18} color="#d97706" />
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#d97706" }}>{t("attachments.file") || "Plik"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (loading || uploading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploading}
          >
            <Text style={styles.submitButtonText}>
              {uploading ? (t("attachments.uploading") || "Przesyłanie...") : loading ? t("common.loading") : t("tasks.create")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginLeft: 12,
    textAlign: "center",
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  horizontalSelectContainer: {
    flexDirection: "row",
    gap: 8,
  },
  selectContainer: {
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    minWidth: 60,
  },
  selectOptionActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  selectOptionTextActive: {
    color: "#ffffff",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  statusOptionActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  priorityHigh: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  statusOptionTextActive: {
    color: "#ffffff",
  },
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
