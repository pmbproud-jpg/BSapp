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
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";
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
      console.log("[IMPORT] pickFile called, Platform:", Platform.OS);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });

      console.log("[IMPORT] DocumentPicker result:", JSON.stringify(result).substring(0, 200));
      if (result.canceled) return;

      setFileName(result.assets[0].name);
      console.log("[IMPORT] File selected:", result.assets[0].name, "URI:", result.assets[0].uri.substring(0, 100));
      await parseExcel(result.assets[0].uri);
    } catch (error) {
      console.error("[IMPORT] Error picking file:", error);
      if (Platform.OS === "web") {
        window.alert(t("projects.import.pick_error"));
      } else {
        Alert.alert(t("common.error"), t("projects.import.pick_error"));
      }
    }
  };

  const parseExcel = async (uri: string) => {
    setLoading(true);
    try {
      console.log("[IMPORT] parseExcel called, Platform:", Platform.OS);
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        console.log("[IMPORT] Blob size:", blob.size);
        const reader = new FileReader();

        reader.onerror = (err) => {
          console.error("[IMPORT] FileReader error:", err);
          setLoading(false);
          window.alert(t("projects.import.parse_error"));
        };

        reader.onload = (e) => {
          try {
            console.log("[IMPORT] FileReader onload fired");
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            console.log("[IMPORT] Workbook sheets:", workbook.SheetNames);
            processWorkbook(workbook);
          } catch (err) {
            console.error("[IMPORT] Error in onload:", err);
            setLoading(false);
            window.alert(t("projects.import.parse_error"));
          }
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
      console.error("[IMPORT] Error parsing Excel:", error);
      if (Platform.OS === "web") {
        window.alert(t("projects.import.parse_error"));
      } else {
        Alert.alert(t("common.error"), t("projects.import.parse_error"));
      }
      setLoading(false);
    }
  };

  const processWorkbook = (workbook: XLSX.WorkBook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Pobierz dane jako tablice (bez nagłówków) - każdy wiersz to array wartości
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log("[IMPORT] Total raw rows:", rawRows.length);

    if (rawRows.length === 0) {
      if (Platform.OS === "web") {
        window.alert(t("projects.import.no_valid_data"));
      } else {
        Alert.alert(t("common.error"), t("projects.import.no_valid_data"));
      }
      setLoading(false);
      return;
    }

    // Sprawdź czy pierwszy wiersz to nagłówki (nie-numeryczne wartości)
    const firstRow = rawRows[0];
    const hasHeader = firstRow && typeof firstRow[0] === "string" && isNaN(Number(firstRow[0]));
    const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

    console.log("[IMPORT] Has header:", hasHeader, "Data rows:", dataRows.length);
    if (firstRow) console.log("[IMPORT] First row:", JSON.stringify(firstRow));

    // Mapuj po kolejności kolumn: A=nr, B=nazwa, C=lokalizacja, D=data start, E=data koniec, F=budżet
    const projects: ImportedProject[] = dataRows.map((row: any[]) => {
      const str = (val: any) => (val != null ? String(val).trim() : "");
      return {
        project_number: str(row[0]),
        name: str(row[1]),
        location: str(row[2]),
        start_date: str(row[3]),
        end_date: str(row[4]),
        budget: parseFloat(str(row[5])) || undefined,
      };
    });

    // Wymagaj tylko żeby wiersz miał nr projektu LUB nazwę
    const validProjects = projects.filter((p) => p.project_number || p.name);
    console.log("[IMPORT] Valid projects:", validProjects.length);

    // Jeśli brak nr projektu, generuj automatycznie
    validProjects.forEach((p, i) => {
      if (!p.project_number) p.project_number = `IMP-${String(i + 1).padStart(3, "0")}`;
      if (!p.name) p.name = p.project_number;
    });

    if (validProjects.length === 0) {
      if (Platform.OS === "web") {
        window.alert(t("projects.import.no_valid_data"));
      } else {
        Alert.alert(t("common.error"), t("projects.import.no_valid_data"));
      }
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

      const { data, error } = await (supabaseAdmin
        .from("projects") as any)
        .insert(projectsToInsert)
        .select();

      if (error) throw error;

      if (Platform.OS === "web") {
        window.alert(t("projects.import.success", { count: data.length }));
      } else {
        Alert.alert(t("common.success"), t("projects.import.success", { count: data.length }));
      }
      router.replace("/projects");
    } catch (error: any) {
      console.error("Error importing projects:", error);
      
      // Sprawdź czy to błąd duplikatu
      const msg = error.code === "23505"
        ? t("projects.import.duplicate_error")
        : t("projects.import.error");
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert(t("common.error"), msg);
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
