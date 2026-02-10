import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";

type ImportedProject = {
  project_number: string;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
};

export default function ImportProjectsScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportedProject[]>([]);
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
      Alert.alert(t("common.error"), t("projects.import.pick_error"));
    }
  };

  const parseExcel = async (uri: string) => {
    setLoading(true);
    try {
      // Dla web: użyj FileReader
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
        // Dla mobile: użyj expo-file-system
        const FileSystem = require("expo-file-system");
        const fileContent = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const workbook = XLSX.read(fileContent, { type: "base64" });
        processWorkbook(workbook);
      }
    } catch (error) {
      console.error("Error parsing Excel:", error);
      Alert.alert(t("common.error"), t("projects.import.parse_error"));
      setLoading(false);
    }
  };

  const processWorkbook = (workbook: XLSX.WorkBook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const projects: ImportedProject[] = jsonData.map((row: any) => ({
      project_number: row["Nr Projektu"] || row["Project Number"] || row["Nr"] || "",
      name: row["Nazwa Projektu"] || row["Project Name"] || row["Nazwa"] || row["Name"] || "",
      location: row["Lokalizacja"] || row["Location"] || "",
      start_date: row["Data rozpoczęcia"] || row["Start Date"] || "",
      end_date: row["Data zakończenia"] || row["End Date"] || "",
      budget: parseFloat(row["Budżet"] || row["Budget"] || "0") || undefined,
    }));

    // Filtruj puste projekty
    const validProjects = projects.filter((p) => p.project_number && p.name);

    if (validProjects.length === 0) {
      Alert.alert(
        t("common.error"),
        t("projects.import.no_valid_data")
      );
      setLoading(false);
      return;
    }

    setPreview(validProjects);
    setLoading(false);
  };

  const importProjects = async () => {
    if (preview.length === 0) return;

    setLoading(true);
    try {
      const projectsToInsert = preview.map((p) => ({
        project_number: p.project_number,
        name: p.name,
        location: p.location || null,
        start_date: p.start_date || null,
        end_date: p.end_date || null,
        budget: p.budget || null,
        status: "planning" as const,
        company_id: profile?.company_id,
        created_by: profile?.id,
      }));

      const { data, error } = await supabase
        .from("projects")
        .insert(projectsToInsert)
        .select();

      if (error) throw error;

      Alert.alert(
        t("common.success"),
        t("projects.import.success", { count: data.length }),
        [
          {
            text: t("common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error("Error importing projects:", error);
      
      // Sprawdź czy to błąd duplikatu
      if (error.code === "23505") {
        Alert.alert(
          t("common.error"),
          t("projects.import.duplicate_error")
        );
      } else {
        Alert.alert(t("common.error"), t("projects.import.error"));
      }
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
        <Text style={styles.headerTitle}>{t("projects.import.title")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.instructions}>
          <Ionicons name="information-circle" size={24} color="#2563eb" />
          <View style={styles.instructionsText}>
            <Text style={styles.instructionsTitle}>
              {t("projects.import.instructions_title")}
            </Text>
            <Text style={styles.instructionsBody}>
              {t("projects.import.instructions_body")}
            </Text>
            <Text style={styles.instructionsExample}>
              {t("projects.import.example")}
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
            {fileName || t("projects.import.select_file")}
          </Text>
          <Text style={styles.uploadButtonHint}>
            {t("projects.import.supported_formats")}
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
              {t("projects.import.preview")} ({preview.length})
            </Text>

            {preview.map((project, index) => (
              <View key={index} style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewNumber}>
                    #{project.project_number}
                  </Text>
                  <Text style={styles.previewName}>{project.name}</Text>
                </View>
                {project.location && (
                  <Text style={styles.previewDetail}>
                    📍 {project.location}
                  </Text>
                )}
                {project.budget && (
                  <Text style={styles.previewDetail}>
                    💰 {project.budget.toLocaleString()} €
                  </Text>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={styles.importButton}
              onPress={importProjects}
              disabled={loading}
            >
              <Text style={styles.importButtonText}>
                {t("projects.import.import_all")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
    fontSize: 12,
    color: "#3b82f6",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
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
    marginBottom: 8,
  },
  previewNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 4,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  previewDetail: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
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
