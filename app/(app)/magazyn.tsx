import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";

import { usePermissions } from "@/src/hooks/usePermissions";
import { useWarehouseMaterials } from "@/src/hooks/useWarehouseMaterials";
import { useWarehouseOrders } from "@/src/hooks/useWarehouseOrders";
import { useWarehouseTools } from "@/src/hooks/useWarehouseTools";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";

import { MaterialDetailView } from "./_components/magazyn/MaterialDetailView";
import { MaterialsTab } from "./_components/magazyn/MaterialsTab";
import { BaustellePickerModal } from "./_components/magazyn/modals/BaustellePickerModal";
import { MaterialEditModal } from "./_components/magazyn/modals/MaterialEditModal";
import { NotesDamagedModal } from "./_components/magazyn/modals/NotesDamagedModal";
import { OrderEditModal } from "./_components/magazyn/modals/OrderEditModal";
import { StatusUserModal } from "./_components/magazyn/modals/StatusUserModal";
import { ToolEditModal } from "./_components/magazyn/modals/ToolEditModal";
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

  // Z hookow uzywamy tylko: badge countery (items/materials/allOrders),
  // refresh + loadX, detail-view selection + edit/delete callbacks.
  // Reszta state/handlerow jest hermetyzowana w sub-komponentach (ToolsTab/MaterialsTab/OrdersTab)
  // i modalach (ToolEditModal/MaterialEditModal/...) przez prop hook.
  const { items, loading, refreshing, setRefreshing, selectedItem, setSelectedItem, openEdit, deleteItem, loadData } = tools;
  const { materials, matLoading, selectedMat, setSelectedMat, openEditMat, deleteMatItem, loadMaterials } = mats;
  const { allOrders, loadOrders } = orders;

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

      {/* ═══ MODALS ═══ */}
      <ToolEditModal tools={tools} />
      <MaterialEditModal mats={mats} />
      <StatusUserModal tools={tools} allUsers={allUsers} />
      <BaustellePickerModal tools={tools} allProjects={allProjects} />
      <OrderEditModal orders={orders} />
      <NotesDamagedModal tools={tools} />
    </ScrollView>
  );
}

