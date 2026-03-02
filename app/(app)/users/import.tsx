import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import * as XLSX from "xlsx";

type ImportedUser = {
  full_name: string;
  email: string;
  phone?: string;
  role: string;
};

export default function ImportUsersScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportedUser[]>([]);
  const [fileName, setFileName] = useState("");

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setFileName(result.assets[0].name);
      await parseExcel(result.assets[0].uri);
    } catch (error) {
      console.error("Error picking file:", error);
      Alert.alert(t("common.error"), t("users.import.pick_error"));
    }
  };

  const parseExcel = async (uri: string) => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          processWorkbook(workbook);
        };

        reader.readAsArrayBuffer(blob);
      } else {
        const FileSystem = require("expo-file-system");
        const fileContent = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const workbook = XLSX.read(fileContent, { type: "base64" });
        processWorkbook(workbook);
      }
    } catch (error) {
      console.error("Error parsing Excel:", error);
      Alert.alert(t("common.error"), t("users.import.parse_error"));
      setLoading(false);
    }
  };

  const processWorkbook = (workbook: XLSX.WorkBook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const users: ImportedUser[] = jsonData.map((row: any) => ({
      full_name:
        row["Imię i Nazwisko"] ||
        row["Full Name"] ||
        row["Name"] ||
        "",
      email: row["Email"] || row["E-mail"] || "",
      phone:
        row["Telefon"] ||
        row["Phone"] ||
        row["Tel"] ||
        row["Nr tel"] ||
        "",
      role: (row["Funkcja"] || row["Role"] || "worker").toLowerCase(),
    }));

    // Walidacja ról
    const validRoles = ["admin", "management", "project_manager", "bauleiter", "worker"];
    const validUsers = users.filter((u) => {
      if (!u.email || !u.full_name) return false;
      if (!validRoles.includes(u.role)) u.role = "worker";
      return true;
    });

    if (validUsers.length === 0) {
      Alert.alert(t("common.error"), t("users.import.no_valid_data"));
      setLoading(false);
      return;
    }

    setPreview(validUsers);
    setLoading(false);
  };

  const importUsers = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    try {
      // Najpierw utwórz konta w Supabase Auth
      const createdUsers: string[] = [];
      const errors: string[] = [];

      for (const user of preview) {
        try {
          const tempPassword = `Temp${Math.random().toString(36).slice(2)}!`;

          // Use admin client to create user (bypasses email confirmation)
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: user.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: user.full_name,
              phone: user.phone || "",
            },
          });

          if (authError) throw authError;
          if (!authData.user) throw new Error("User not created");

          createdUsers.push(user.email);
        } catch (error: any) {
          console.error(`Error creating user ${user.email}:`, error);
          errors.push(`${user.email}: ${error.message}`);
        }
      }

      // Wait for database trigger to create profiles
      if (createdUsers.length > 0) {
        await new Promise((r) => setTimeout(r, 2000));

        // Update profiles with roles and company_id
        for (const user of preview) {
          try {
            const { data: profileData } = await (supabase.from("profiles") as any)
              .select("id")
              .eq("email", user.email)
              .maybeSingle();

            if (profileData) {
              await (supabaseAdmin.from("profiles") as any)
                .update({
                  full_name: user.full_name,
                  phone: user.phone || null,
                  role: user.role,
                  company_id: profile?.company_id,
                })
                .eq("id", profileData.id);
            }
          } catch (err) {
            console.error(`Error updating profile for ${user.email}:`, err);
          }
        }
      }

      if (createdUsers.length > 0) {
        const msg = `Zaimportowano ${createdUsers.length} użytkowników`;
        if (Platform.OS === "web") {
          window.alert(msg);
          router.back();
        } else {
          Alert.alert(
            t("common.success"),
            msg,
            [{ text: t("common.ok"), onPress: () => router.back() }]
          );
        }
      }

      if (errors.length > 0) {
        const errMsg = t("users.import.partial_error") + "\n\n" + errors.slice(0, 3).join("\n");
        if (Platform.OS === "web") window.alert(errMsg);
        else Alert.alert(t("common.error"), errMsg);
      }
    } catch (error: any) {
      console.error("Error importing users:", error);
      Alert.alert(t("common.error"), t("users.import.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("users.import.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.instructions}>
          <Ionicons name="information-circle" size={24} color="#2563eb" />
          <View style={styles.instructionsText}>
            <Text style={styles.instructionsTitle}>
              {t("users.import.instructions_title")}
            </Text>
            <Text style={styles.instructionsBody}>
              {t("users.import.instructions_body")}
            </Text>
            <Text style={styles.instructionsExample}>
              Imię i Nazwisko | Email | Telefon | Funkcja{"\n"}
              Jan Kowalski | jan@example.com | +48 123 456 789 | bauleiter
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickFile}
          disabled={loading}
        >
          <Ionicons name="cloud-upload-outline" size={32} color="#2563eb" />
          <Text style={styles.uploadButtonText}>
            {fileName || t("users.import.select_file")}
          </Text>
          <Text style={styles.uploadButtonHint}>
            {t("users.import.supported_formats")}
          </Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        )}

        {preview.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>
              {t("users.import.preview")} ({preview.length})
            </Text>

            {preview.map((user, index) => (
              <View key={index} style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Ionicons name="person-circle" size={24} color="#2563eb" />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>{user.full_name}</Text>
                    <Text style={styles.previewEmail}>{user.email}</Text>
                    {user.phone && (
                      <Text style={styles.previewPhone}>📞 {user.phone}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: getRoleColor(user.role) + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        { color: getRoleColor(user.role) },
                      ]}
                    >
                      {t(`common.roles.${user.role}`)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.importButton}
              onPress={importUsers}
              disabled={loading}
            >
              <Text style={styles.importButtonText}>
                {t("users.import.import_all")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    admin: "#ef4444",
    management: "#f59e0b",
    project_manager: "#3b82f6",
    bauleiter: "#10b981",
    worker: "#64748b",
  };
  return colors[role] || "#64748b";
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
    padding: 16,
  },
  instructions: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  instructionsText: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 8,
  },
  instructionsBody: {
    fontSize: 14,
    color: "#1e40af",
    marginBottom: 8,
    lineHeight: 20,
  },
  instructionsExample: {
    fontSize: 11,
    color: "#3b82f6",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: "#eff6ff",
    padding: 8,
    borderRadius: 4,
  },
  uploadButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginTop: 12,
  },
  uploadButtonHint: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 12,
  },
  previewSection: {
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  previewEmail: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 2,
  },
  previewPhone: {
    fontSize: 12,
    color: "#64748b",
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  importButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
