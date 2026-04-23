/**
 * Wspólne style dla ekranu magazynu i jego sub-komponentów.
 * Wydzielone z magazyn.tsx (Faza 2 — rozbicie monolitu).
 */
import { StyleSheet } from "react-native";

export const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  title: { fontSize: 22, fontWeight: "700" },
  tabBar: { marginHorizontal: 16, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tabBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabBtnText: { fontSize: 12, fontWeight: "500", color: "#94a3b8" },
  actionRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12, flexWrap: "wrap" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  itemCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#dc262615", justifyContent: "center", alignItems: "center" },
  itemTitle: { fontSize: 15, fontWeight: "600" },
  itemMeta: { fontSize: 12 },
  mengeBadge: { backgroundColor: "#dc262620", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  mengeText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },
  detailRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  detailLabel: { width: 120, fontSize: 13, fontWeight: "600" },
  detailValue: { flex: 1, fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 500, borderRadius: 16, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", minWidth: 80 },
  userChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", marginRight: 6, marginBottom: 4 },
  userChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  userChipText: { fontSize: 12, fontWeight: "500", color: "#475569" },
});
