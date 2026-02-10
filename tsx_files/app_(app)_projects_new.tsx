import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";

type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export default function NewProjectScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
    budget: "",
    status: "planning" as ProjectStatus,
  });

  const statusOptions: ProjectStatus[] = [
    "planning",
    "active",
    "on_hold",
    "completed",
    "cancelled",
  ];

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert(t("common.error"), t("projects.name_required"));
      return;
    }

    setLoading(true);
    try {
      const projectData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        location: formData.location.trim() || null,
        status: formData.status,
        company_id: profile?.company_id,
        created_by: profile?.id,
      };

      if (formData.start_date) {
        projectData.start_date = formData.start_date;
      }
      if (formData.end_date) {
        projectData.end_date = formData.end_date;
      }
      if (formData.budget) {
        projectData.budget = parseFloat(formData.budget);
      }

      const { data, error } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      if (error) throw error;

      Alert.alert(t("common.success"), t("projects.created_success"), [
        {
          text: t("common.ok"),
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error creating project:", error);
      Alert.alert(t("common.error"), t("projects.create_error"));
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
        <Text style={styles.headerTitle}>{t("projects.new")}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("projects.name")} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder={t("projects.name_placeholder")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder={t("projects.description_placeholder")}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.location")}</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) =>
                setFormData({ ...formData, location: text })
              }
              placeholder={t("projects.location_placeholder")}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.statusLabel")}</Text>
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
                    {t(`projects.status.${status}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.start_date")}</Text>
            <TextInput
              style={styles.input}
              value={formData.start_date}
              onChangeText={(text) =>
                setFormData({ ...formData, start_date: text })
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.hint}>{t("projects.date_format")}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.end_date")}</Text>
            <TextInput
              style={styles.input}
              value={formData.end_date}
              onChangeText={(text) =>
                setFormData({ ...formData, end_date: text })
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.hint}>{t("projects.date_format")}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("projects.budget")}</Text>
            <TextInput
              style={styles.input}
              value={formData.budget}
              onChangeText={(text) => setFormData({ ...formData, budget: text })}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>{t("projects.budget_hint")}</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? t("common.loading") : t("projects.create")}
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
