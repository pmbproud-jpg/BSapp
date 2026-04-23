/**
 * Modal dodawania stalego czlonka do projektu (uprawniony do edycji).
 * Wydzielony z projects/[id].tsx (Faza 2 step 2).
 */
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View } from "react-native";

import type { useProjectMembers } from "@/src/hooks/useProjectMembers";

import { styles } from "../styles";

type MembersHook = ReturnType<typeof useProjectMembers>;

type Props = {
  members: MembersHook;
};

export function AddMemberModal({ members }: Props) {
  const { t } = useTranslation();
  const {
    showAddMember, setShowAddMember,
    availableUsers, usersLoading, addMember,
  } = members;

  return (
    <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("team.add_members")}</Text>
            <TouchableOpacity onPress={() => setShowAddMember(false)}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          {usersLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />
          ) : availableUsers.length === 0 ? (
            <Text style={styles.emptyText}>{t("team.no_available_users")}</Text>
          ) : (
            <FlatList
              data={availableUsers}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userPickerItem} onPress={() => addMember(item.id)}>
                  <Ionicons name="person-circle-outline" size={28} color="#3b82f6" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.userPickerName}>{item.full_name || item.email}</Text>
                    <Text style={styles.userPickerEmail}>{item.email}</Text>
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
