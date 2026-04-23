/**
 * Modal dodawania pracownika do planu na konkretny dzien.
 * Wydzielony z projects/[id].tsx (Faza 2 step 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { useProjectPlanWorkers } from "@/src/hooks/useProjectPlanWorkers";

import { styles } from "../styles";

type PlanWorkersHook = ReturnType<typeof useProjectPlanWorkers>;

type Props = {
  planWorkers: PlanWorkersHook;
  teamDate: string;
};

export function AddPlanWorkerModal({ planWorkers, teamDate }: Props) {
  const { t } = useTranslation();
  const {
    showAddPlanWorker, setShowAddPlanWorker,
    planWorkerCandidates, planWorkerSearch, setPlanWorkerSearch,
    addingPlanWorker, addPlanWorkerManually,
  } = planWorkers;

  return (
    <Modal visible={showAddPlanWorker} transparent animationType="slide" onRequestClose={() => setShowAddPlanWorker(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{t("projects.add_worker_to_plan")}</Text>
              <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {new Date(teamDate).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddPlanWorker(false)}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, gap: 6 }}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: "#1e293b", padding: 0 }}
              placeholder="Name suchen..."
              placeholderTextColor="#94a3b8"
              value={planWorkerSearch}
              onChangeText={setPlanWorkerSearch}
            />
            {planWorkerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPlanWorkerSearch("")}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
          {addingPlanWorker ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={planWorkerCandidates.filter((u) => {
                if (!planWorkerSearch.trim()) return true;
                const q = planWorkerSearch.toLowerCase();
                return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
              })}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={<Text style={styles.emptyText}>{t("projects.no_available_workers")}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userPickerItem} onPress={() => addPlanWorkerManually(item.id, teamDate)}>
                  <Ionicons name="person-circle-outline" size={28} color="#f59e0b" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.userPickerName}>{item.full_name || item.email}</Text>
                    <Text style={styles.userPickerEmail}>{item.role ? `${item.role}` : item.email}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color="#10b981" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
