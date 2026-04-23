import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

import { orderStatusColors } from "@/src/constants/colors";
import { usePermissions } from "@/src/hooks/usePermissions";
import { MAT_FIELDS, useWarehouseMaterials } from "@/src/hooks/useWarehouseMaterials";
import { useWarehouseOrders } from "@/src/hooks/useWarehouseOrders";
import { FIELDS, useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";

import { MaterialDetailView } from "./_components/magazyn/MaterialDetailView";
import { MaterialsTab } from "./_components/magazyn/MaterialsTab";
import { OrdersTab } from "./_components/magazyn/OrdersTab";
import { ToolDetailView } from "./_components/magazyn/ToolDetailView";
import { ToolsTab } from "./_components/magazyn/ToolsTab";
import { s } from "./_components/magazyn/styles";

export default function MagazynScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const perms = usePermissions();
  const { colors: tc } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<"tools" | "materials" | "orders">("tools");

  // Users for assignment
  const [allUsers, setAllUsers] = useState<{ id: string; full_name: string }[]>([]);
  // Projects for baustelle picker
  const [allProjects, setAllProjects] = useState<{ id: string; name: string; project_number: string | null; location: string | null }[]>([]);

  // ─── Hooks ───
  const tools = useWarehouseTools(profile?.id ?? undefined, allUsers, t);
  const mats = useWarehouseMaterials(profile?.id ?? undefined, profile?.full_name ?? undefined, t);
  const orders = useWarehouseOrders(t);

  // Destructure tylko fragmenty hooka uzywane bezposrednio w magazyn.tsx
  // (modale, refresh, detail view callbacks). Reszta jest obslugiwana
  // wewnatrz sub-komponentow (ToolsTab) przez prop `tools`.
  const {
    items,
    loading, refreshing, setRefreshing,
    showModal, setShowModal, editingItem, form, setForm, saving,
    selectedItem, setSelectedItem,
    openEdit, saveItem, deleteItem,
    showStatusUserModal, setShowStatusUserModal,
    statusUserItem, statusUserSearch, setStatusUserSearch,
    assignStatusToUser,
    showNotesModal, setShowNotesModal,
    notesItem, notesText, setNotesText,
    notesDamaged, setNotesDamaged, notesSaving, saveNotes,
    showBaustellePicker, setShowBaustellePicker,
    baustelleSearch, setBaustelleSearch,
    loadData,
  } = tools;

  // Tylko fragmenty hooka uzywane w magazyn.tsx (modale, refresh, badge counter, detail).
  // Reszta state/handlerow trafia do MaterialsTab przez prop `mats`.
  const {
    materials, matLoading,
    showMatModal, setShowMatModal, editingMat, matForm, setMatForm, matSaving,
    selectedMat, setSelectedMat,
    openEditMat, saveMatItem, deleteMatItem,
    loadMaterials,
  } = mats;

  // Tylko fragmenty hooka uzywane w magazyn.tsx (badge counter, edit modal, refresh).
  // Reszta state/handlerow trafia do OrdersTab przez prop `orders`.
  const {
    allOrders,
    showOrderEditModal, setShowOrderEditModal,
    editingOrder, orderForm, setOrderForm, orderSaving,
    loadOrders, saveOrder, deleteOrder,
  } = orders;

  const canManage = perms.canEditWarehouse;
  const canManageMaterials = perms.canEditWarehouse || perms.canOrderMaterials;

  const loadUsers = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      const rows = (data ?? []) as { id: string; full_name: string | null }[];
      setAllUsers(rows.filter((u) => u.full_name).map((u) => ({ id: u.id, full_name: u.full_name || "" })));
    } catch (e) { console.error("Error loading users:", e); }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabaseAdmin.from("projects").select("id, name, project_number, location").order("name");
      if (error) throw error;
      setAllProjects(data || []);
    } catch (e) { console.error("Error loading projects:", e); }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadMaterials();
      loadUsers();
      loadProjects();
      loadOrders();
    }, [])
  );


  // ── RENDER ──
  if (loading && matLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (selectedItem) {
    return (
      <ToolDetailView
        item={selectedItem}
        allUsers={allUsers}
        canManage={canManage}
        onBack={() => setSelectedItem(null)}
        onEdit={openEdit}
        onDelete={deleteItem}
      />
    );
  }

  if (selectedMat) {
    return (
      <MaterialDetailView
        item={selectedMat}
        canManage={canManageMaterials}
        onBack={() => setSelectedMat(null)}
        onEdit={openEditMat}
        onDelete={deleteMatItem}
      />
    );
  }

  return (
    <ScrollView
      style={[s.container, { backgroundColor: tc.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); loadMaterials(); }} />}
    >
      {/* Header */}
      <View style={s.titleRow}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={tc.text} />
        </TouchableOpacity>
        <Ionicons name="cube" size={28} color="#dc2626" />
        <Text style={[s.title, { color: tc.text }]}>{t("magazyn.title") || "Lager"}</Text>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ flexGrow: 1 }}>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === "tools" && { borderBottomColor: "#dc2626", borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("tools")}
        >
          <Ionicons name="construct" size={16} color={activeTab === "tools" ? "#dc2626" : tc.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === "tools" && { color: "#dc2626", fontWeight: "700" }]} numberOfLines={1}>
            {t("magazyn.tools_tab") || "Werkzeuge"} ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === "materials" && { borderBottomColor: "#f97316", borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("materials")}
        >
          <Ionicons name="layers" size={16} color={activeTab === "materials" ? "#f97316" : tc.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === "materials" && { color: "#f97316", fontWeight: "700" }]} numberOfLines={1}>
            {t("magazyn.materials_tab") || "Materialien"} ({materials.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === "orders" && { borderBottomColor: "#2563eb", borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("orders")}
        >
          <Ionicons name="cart" size={16} color={activeTab === "orders" ? "#2563eb" : tc.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === "orders" && { color: "#2563eb", fontWeight: "700" }]} numberOfLines={1}>
            {t("magazyn.orders_tab") || "Bestellungen"} ({allOrders.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ═══ TOOLS TAB ═══ */}
      {activeTab === "tools" && (
        <ToolsTab tools={tools} canManage={canManage} />
      )}

      {/* ═══ MATERIALS TAB ═══ */}
      {activeTab === "materials" && (
        <MaterialsTab mats={mats} canManageMaterials={canManageMaterials} />
      )}

      {/* ═══ ORDERS TAB ═══ */}
      {activeTab === "orders" && (
        <OrdersTab orders={orders} canManageMaterials={canManageMaterials} />
      )}

      <View style={{ height: 40 }} />

      {/* Add/Edit Tool Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>
                {editingItem ? (t("magazyn.edit_item") || "Werkzeug bearbeiten") : (t("magazyn.add_item") || "Werkzeug hinzufügen")}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {FIELDS.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                  {f.key === "status" ? (
                    <View>
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: form.assigned_to ? "#2563eb" : (tc.border || "#e2e8f0"), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: form.assigned_to ? "#eff6ff" : (tc.background || "#fff") }}
                        onPress={() => { setStatusUserSearch(""); setShowStatusUserModal(true); }}
                      >
                        <Ionicons name="person" size={18} color={form.assigned_to ? "#2563eb" : tc.textSecondary} />
                        <Text style={{ flex: 1, fontSize: 14, color: form.assigned_to ? "#2563eb" : tc.textSecondary, fontWeight: form.assigned_to ? "600" : "400" }}>
                          {form.status || t("magazyn.select_user")}
                        </Text>
                        {form.assigned_to ? (
                          <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, assigned_to: "", status: "" }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color="#2563eb" />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : f.key === "baustelle" ? (
                    <View>
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: form.baustelle ? "#10b981" : (tc.border || "#e2e8f0"), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: form.baustelle ? "#ecfdf5" : (tc.background || "#fff") }}
                        onPress={() => { setBaustelleSearch(""); setShowBaustellePicker(true); }}
                      >
                        <Ionicons name="business" size={18} color={form.baustelle ? "#10b981" : tc.textSecondary} />
                        <Text style={{ flex: 1, fontSize: 14, color: form.baustelle ? "#10b981" : tc.textSecondary, fontWeight: form.baustelle ? "600" : "400" }}>
                          {form.baustelle || t("magazyn.select_site")}
                        </Text>
                        {form.baustelle ? (
                          <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, baustelle: "" }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color="#10b981" />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={tc.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput
                      style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                      value={form[f.key]}
                      onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                      placeholder={f.labelDE}
                      placeholderTextColor={tc.textMuted || "#999"}
                      keyboardType="default"
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowModal(false)}>
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#dc2626" }]} onPress={saveItem} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Material Modal */}
      <Modal visible={showMatModal} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>
                {editingMat ? (t("magazyn.edit_material") || "Material bearbeiten") : (t("magazyn.add_material") || "Material hinzufügen")}
              </Text>
              <TouchableOpacity onPress={() => setShowMatModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {MAT_FIELDS.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={matForm[f.key]}
                    onChangeText={(v) => setMatForm((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.labelDE}
                    placeholderTextColor={tc.textMuted || "#999"}
                    keyboardType={f.numeric ? "decimal-pad" : "default"}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowMatModal(false)}>
                <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#f97316" }]} onPress={saveMatItem} disabled={matSaving}>
                {matSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status → User Assignment Modal */}
      <Modal visible={showStatusUserModal} transparent animationType="fade" onRequestClose={() => setShowStatusUserModal(false)}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card, maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: tc.text }]}>{t("magazyn.status_assigned")}</Text>
                <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }} numberOfLines={1}>{statusUserItem?.beschreibung || "—"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStatusUserModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchBox, { backgroundColor: tc.background, borderColor: tc.border, marginHorizontal: 0, marginBottom: 10 }]}>
              <Ionicons name="search" size={16} color={tc.textSecondary} />
              <TextInput
                style={[s.searchInput, { color: tc.text }]}
                placeholder={t("magazyn.search_user")}
                placeholderTextColor={tc.textSecondary}
                value={statusUserSearch}
                onChangeText={setStatusUserSearch}
              />
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10 }}
                onPress={() => assignStatusToUser(null)}
              >
                <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
                <Text style={{ fontSize: 14, color: "#ef4444", fontWeight: "600" }}>{t("magazyn.no_assignment")}</Text>
              </TouchableOpacity>
              {allUsers
                .filter((u) => !statusUserSearch.trim() || u.full_name.toLowerCase().includes(statusUserSearch.toLowerCase()))
                .map((u) => {
                  const isSelected = showModal ? form.assigned_to === u.id : statusUserItem?.assigned_to === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10, backgroundColor: isSelected ? "#2563eb10" : "transparent" }}
                      onPress={() => assignStatusToUser(u.id)}
                    >
                      <Ionicons name={isSelected ? "checkmark-circle" : "person-outline"} size={22} color={isSelected ? "#2563eb" : tc.textSecondary} />
                      <Text style={{ fontSize: 14, color: isSelected ? "#2563eb" : tc.text, fontWeight: isSelected ? "700" : "400" }}>{u.full_name}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Baustelle (Project) Picker Modal */}
      <Modal visible={showBaustellePicker} transparent animationType="fade" onRequestClose={() => setShowBaustellePicker(false)}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card, maxHeight: "80%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[s.modalTitle, { color: tc.text }]}>{t("magazyn.select_site")}</Text>
              <TouchableOpacity onPress={() => setShowBaustellePicker(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchBox, { borderColor: tc.border, backgroundColor: tc.background }]}>
              <Ionicons name="search" size={18} color={tc.textSecondary} />
              <TextInput
                style={[s.searchInput, { color: tc.text }]}
                placeholder={t("magazyn.search_site")}
                placeholderTextColor={tc.textMuted}
                value={baustelleSearch}
                onChangeText={setBaustelleSearch}
              />
              {baustelleSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBaustelleSearch("")}>
                  <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ flex: 1 }}>
              {allProjects
                .filter((p) => !baustelleSearch.trim() || p.name.toLowerCase().includes(baustelleSearch.toLowerCase()) || (p.project_number || "").toLowerCase().includes(baustelleSearch.toLowerCase()) || (p.location || "").toLowerCase().includes(baustelleSearch.toLowerCase()))
                .map((p) => {
                  const label = p.project_number ? `${p.project_number} – ${p.name}` : p.name;
                  const isSelected = form.baustelle === label || form.baustelle === p.name;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: tc.border || "#e2e8f0", gap: 10, backgroundColor: isSelected ? "#10b98110" : "transparent" }}
                      onPress={() => { setForm((prev) => ({ ...prev, baustelle: label })); setShowBaustellePicker(false); }}
                    >
                      <Ionicons name={isSelected ? "checkmark-circle" : "business-outline"} size={22} color={isSelected ? "#10b981" : tc.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: isSelected ? "#10b981" : tc.text, fontWeight: isSelected ? "700" : "500" }}>{label}</Text>
                        {p.location ? <Text style={{ fontSize: 11, color: tc.textMuted, marginTop: 2 }}>{p.location}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              {allProjects.length === 0 && (
                <Text style={{ textAlign: "center", color: tc.textMuted, paddingVertical: 20 }}>{t("magazyn.no_sites")}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Order Edit Modal */}
      <Modal visible={showOrderEditModal} animationType="slide" transparent onRequestClose={() => setShowOrderEditModal(false)}>
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[s.modalContent, { backgroundColor: tc.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: tc.text }]}>{t("magazyn.edit_order")}</Text>
                {editingOrder && (
                  <Text style={{ fontSize: 12, color: tc.textSecondary, marginTop: 2 }} numberOfLines={1}>
                    {editingOrder.order_type === "tool" ? (editingOrder.tool?.beschreibung || "—") : (editingOrder.material?.nazwa || "—")} — {editingOrder.project?.name || "—"}
                    {editingOrder.order_type === "tool" ? ` (${t("magazyn.tool")})` : ` (${t("magazyn.material")})`}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowOrderEditModal(false)}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
              {/* Erstellt — auto info */}
              {editingOrder && (
                <View style={{ marginBottom: 14, backgroundColor: tc.background || "#f8fafc", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: tc.border || "#e2e8f0" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Ionicons name="information-circle-outline" size={16} color={tc.textSecondary} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: tc.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("magazyn.order_info")}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={tc.textSecondary} />
                    <Text style={{ fontSize: 13, color: tc.text }}>
                      {t("magazyn.created")}: {editingOrder.created_at ? new Date(editingOrder.created_at).toLocaleDateString("de-DE") : "—"}{" "}
                      {editingOrder.created_at ? new Date(editingOrder.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="person-outline" size={14} color={tc.textSecondary} />
                    <Text style={{ fontSize: 13, color: tc.text }}>
                      {t("magazyn.created_by")}: {editingOrder.ordered_by_profile?.full_name || "—"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Status */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.status_label")}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { value: "pending", color: "#f59e0b", icon: "time-outline" as const },
                    { value: "ordered", color: "#3b82f6", icon: "cart-outline" as const },
                    { value: "delivered", color: "#10b981", icon: "checkmark-circle-outline" as const },
                  ].map((st) => {
                    const isActive = orderForm.status === st.value;
                    return (
                      <TouchableOpacity
                        key={st.value}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 6,
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                          borderWidth: 2, borderColor: isActive ? st.color : (tc.border || "#e2e8f0"),
                          backgroundColor: isActive ? `${st.color}15` : "transparent",
                        }}
                        onPress={() => setOrderForm((prev) => ({ ...prev, status: st.value }))}
                      >
                        <Ionicons name={st.icon} size={18} color={isActive ? st.color : tc.textSecondary} />
                        <Text style={{ fontSize: 13, fontWeight: isActive ? "700" : "500", color: isActive ? st.color : tc.text }}>
                          {t(`magazyn.order_status.${st.value}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Bestellt am — date picker */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.ordered_on")}</Text>
                {Platform.OS === "web" ? (
                  <View style={{ flexDirection: "row" }}>
                    <input
                      type="date"
                      value={orderForm.ordered_at}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderForm((prev) => ({ ...prev, ordered_at: e.target.value }))}
                      style={{
                        width: 200, maxWidth: "100%", padding: 10, fontSize: 14, borderRadius: 8,
                        border: `1px solid ${tc.border || "#e2e8f0"}`,
                        backgroundColor: tc.background || "#fff",
                        color: tc.text || "#1e293b",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        boxSizing: "border-box",
                      } as React.CSSProperties}
                    />
                  </View>
                ) : (
                  <TextInput
                    style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={orderForm.ordered_at}
                    onChangeText={(v) => setOrderForm((prev) => ({ ...prev, ordered_at: v }))}
                    placeholder="JJJJ-MM-TT"
                    placeholderTextColor={tc.textMuted || "#999"}
                  />
                )}
                <TouchableOpacity
                  style={{ marginTop: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#3b82f610" }}
                  onPress={() => setOrderForm((prev) => ({ ...prev, ordered_at: new Date().toISOString().slice(0, 10) }))}
                >
                  <Ionicons name="today-outline" size={14} color="#3b82f6" />
                  <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: "600" }}>{t("common.today")}</Text>
                </TouchableOpacity>
              </View>

              {/* Lieferung — date picker */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.delivery_planned")}</Text>
                {Platform.OS === "web" ? (
                  <View style={{ flexDirection: "row" }}>
                    <input
                      type="date"
                      value={orderForm.data_dostawy}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderForm((prev) => ({ ...prev, data_dostawy: e.target.value }))}
                      style={{
                        width: 200, maxWidth: "100%", padding: 10, fontSize: 14, borderRadius: 8,
                        border: `1px solid ${tc.border || "#e2e8f0"}`,
                        backgroundColor: tc.background || "#fff",
                        color: tc.text || "#1e293b",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        boxSizing: "border-box",
                      } as React.CSSProperties}
                    />
                  </View>
                ) : (
                  <TextInput
                    style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    value={orderForm.data_dostawy}
                    onChangeText={(v) => setOrderForm((prev) => ({ ...prev, data_dostawy: v }))}
                    placeholder="JJJJ-MM-TT"
                    placeholderTextColor={tc.textMuted || "#999"}
                  />
                )}
                <TouchableOpacity
                  style={{ marginTop: 4, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#10b98110" }}
                  onPress={() => setOrderForm((prev) => ({ ...prev, data_dostawy: new Date().toISOString().slice(0, 10) }))}
                >
                  <Ionicons name="today-outline" size={14} color="#10b981" />
                  <Text style={{ fontSize: 11, color: "#10b981", fontWeight: "600" }}>{t("common.today")}</Text>
                </TouchableOpacity>
              </View>

              {/* Anmerkung */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[s.fieldLabel, { color: tc.textSecondary }]}>{t("magazyn.notes")}</Text>
                <TextInput
                  style={[s.fieldInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background, minHeight: 70, textAlignVertical: "top" }]}
                  value={orderForm.uwagi}
                  onChangeText={(v) => setOrderForm((prev) => ({ ...prev, uwagi: v }))}
                  placeholder={t("magazyn.order_notes_placeholder")}
                  placeholderTextColor={tc.textMuted || "#999"}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 }]}
                onPress={() => editingOrder && deleteOrder(editingOrder.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontWeight: "600" }}>{t("common.delete") || "Löschen"}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={[s.modalBtn, { borderColor: tc.border, borderWidth: 1 }]} onPress={() => setShowOrderEditModal(false)}>
                  <Text style={{ color: tc.text, fontWeight: "600" }}>{t("common.cancel") || "Abbrechen"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#2563eb" }]} onPress={saveOrder} disabled={orderSaving}>
                  {orderSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>{t("common.save") || "Speichern"}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ NOTES / DAMAGED MODAL ═══ */}
      <Modal visible={showNotesModal} transparent animationType="fade" onRequestClose={() => setShowNotesModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: tc.card || "#fff", borderRadius: 16, padding: 20, width: "92%", maxWidth: 440, borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#e2e8f0") }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="chatbubble-ellipses" size={22} color={notesDamaged ? "#ef4444" : "#f59e0b"} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: tc.text }}>
                  {t("magazyn.notes_title") || "Uwagi"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotesModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={tc.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Item info */}
            {notesItem && (
              <View style={{ backgroundColor: notesDamaged ? "#fef2f2" : (tc.background || "#f8fafc"), borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: notesDamaged ? "#fca5a5" : (tc.border || "#e2e8f0") }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: tc.text }} numberOfLines={1}>
                  {notesItem.beschreibung || "—"}
                </Text>
                <Text style={{ fontSize: 11, color: tc.textSecondary, marginTop: 2 }}>
                  {notesItem.iv_pds || "—"} • {notesItem.hersteller || "—"} • SN: {notesItem.serial_nummer || "—"}
                </Text>
              </View>
            )}

            {/* Damaged checkbox */}
            <TouchableOpacity
              onPress={() => setNotesDamaged(!notesDamaged)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
                borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#e2e8f0"),
                backgroundColor: notesDamaged ? "#fef2f2" : "transparent",
                marginBottom: 14,
              }}
            >
              <View style={{
                width: 24, height: 24, borderRadius: 6,
                borderWidth: 2, borderColor: notesDamaged ? "#ef4444" : (tc.border || "#cbd5e1"),
                backgroundColor: notesDamaged ? "#ef4444" : "transparent",
                justifyContent: "center", alignItems: "center",
              }}>
                {notesDamaged && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Ionicons name="warning" size={18} color={notesDamaged ? "#ef4444" : tc.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: notesDamaged ? "#ef4444" : tc.text }}>
                {t("magazyn.damaged") || "Uszkodzone / Beschädigt"}
              </Text>
            </TouchableOpacity>

            {/* Notes text input */}
            <Text style={{ fontSize: 12, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>
              {t("magazyn.notes_label") || "Uwagi / Anmerkungen"}
            </Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: notesDamaged ? "#fca5a5" : (tc.border || "#e2e8f0"),
                borderRadius: 10, padding: 12, fontSize: 14, color: tc.text,
                backgroundColor: tc.background || "#fff",
                minHeight: 100, textAlignVertical: "top",
              }}
              value={notesText}
              onChangeText={setNotesText}
              placeholder={t("magazyn.notes_placeholder") || "Uwagi dotyczące tego przedmiotu..."}
              placeholderTextColor={tc.textMuted || "#999"}
              multiline
            />

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: tc.border || "#e2e8f0", alignItems: "center" }}
                onPress={() => setShowNotesModal(false)}
              >
                <Text style={{ color: tc.text, fontWeight: "600", fontSize: 14 }}>{t("common.cancel") || "Anuluj"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: notesDamaged ? "#ef4444" : "#2563eb", alignItems: "center" }}
                onPress={saveNotes}
                disabled={notesSaving}
              >
                {notesSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{t("common.save") || "Zapisz"}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

