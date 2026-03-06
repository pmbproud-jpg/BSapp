import { adminApi } from "@/src/lib/supabase/adminApi";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Table metadata ───

type ColumnType = "text" | "number" | "boolean" | "enum" | "date" | "datetime" | "json" | "uuid";

interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  readonly?: boolean;
  enumValues?: string[];
  hidden?: boolean; // hide from table view (still in edit modal)
}

interface TableMeta {
  label: string;
  icon: string;
  color: string;
  columns: ColumnDef[];
}

const TABLE_META: Record<string, TableMeta> = {
  companies: {
    label: "Firmy",
    icon: "business",
    color: "#10b981",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "logo_url", label: "Logo URL", type: "text" },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
      { key: "updated_at", label: "Zaktualizowano", type: "datetime", readonly: true },
    ],
  },
  profiles: {
    label: "Użytkownicy",
    icon: "people",
    color: "#3b82f6",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "email", label: "Email", type: "text" },
      { key: "full_name", label: "Imię i nazwisko", type: "text" },
      { key: "role", label: "Rola", type: "enum", enumValues: ["admin", "management", "project_manager", "bauleiter", "worker", "subcontractor", "office_worker", "logistics", "purchasing", "warehouse_manager"] },
      { key: "phone", label: "Telefon", type: "text" },
      { key: "language", label: "Język", type: "enum", enumValues: ["de", "pl", "en"] },
      { key: "avatar_url", label: "Avatar URL", type: "text", hidden: true },
      { key: "hide_phone", label: "Ukryj telefon", type: "boolean" },
      { key: "hide_email", label: "Ukryj email", type: "boolean" },
      { key: "access_expires_at", label: "Wygaśnięcie dostępu", type: "datetime" },
      { key: "custom_permissions", label: "Uprawnienia", type: "json", hidden: true },
      { key: "company_id", label: "Firma", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
      { key: "updated_at", label: "Zaktualizowano", type: "datetime", readonly: true },
    ],
  },
  projects: {
    label: "Projekty",
    icon: "briefcase",
    color: "#10b981",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "description", label: "Opis", type: "text" },
      { key: "status", label: "Status", type: "enum", enumValues: ["planning", "active", "on_hold", "completed", "cancelled"] },
      { key: "budget", label: "Budżet", type: "number" },
      { key: "start_date", label: "Start", type: "date" },
      { key: "end_date", label: "Koniec", type: "date" },
      { key: "location", label: "Lokalizacja", type: "text" },
      { key: "project_manager_id", label: "Kierownik projektu", type: "uuid" },
      { key: "bauleiter_id", label: "Bauleiter", type: "uuid" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "company_id", label: "Firma", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
      { key: "updated_at", label: "Zaktualizowano", type: "datetime", readonly: true },
    ],
  },
  tasks: {
    label: "Zadania",
    icon: "checkbox",
    color: "#f59e0b",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "title", label: "Tytuł", type: "text" },
      { key: "description", label: "Opis", type: "text" },
      { key: "status", label: "Status", type: "enum", enumValues: ["todo", "in_progress", "completed", "blocked"] },
      { key: "priority", label: "Priorytet", type: "enum", enumValues: ["low", "medium", "high", "urgent"] },
      { key: "due_date", label: "Termin", type: "date" },
      { key: "completed_at", label: "Ukończono", type: "datetime" },
      { key: "assigned_to", label: "Przypisano do", type: "uuid" },
      { key: "assigned_by", label: "Przypisał", type: "uuid" },
      { key: "assigned_at", label: "Data przypisania", type: "datetime" },
      { key: "edited_by", label: "Edytował", type: "uuid" },
      { key: "edited_at", label: "Data edycji", type: "datetime" },
      { key: "notes_de", label: "Notatki DE", type: "text", hidden: true },
      { key: "notes_pl", label: "Notatki PL", type: "text", hidden: true },
      { key: "notes_en", label: "Notatki EN", type: "text", hidden: true },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
      { key: "updated_at", label: "Zaktualizowano", type: "datetime", readonly: true },
    ],
  },
  project_members: {
    label: "Członkowie projektu",
    icon: "people-circle",
    color: "#8b5cf6",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "user_id", label: "Użytkownik", type: "uuid" },
      { key: "role", label: "Rola", type: "text" },
      { key: "joined_at", label: "Dołączył", type: "datetime", readonly: true },
    ],
  },
  task_comments: {
    label: "Komentarze zadań",
    icon: "chatbubble",
    color: "#14b8a6",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "task_id", label: "Zadanie", type: "uuid" },
      { key: "user_id", label: "Użytkownik", type: "uuid" },
      { key: "comment", label: "Komentarz", type: "text" },
      { key: "language", label: "Język", type: "enum", enumValues: ["de", "pl", "en"] },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  task_assignees: {
    label: "Przypisania zadań",
    icon: "person-add",
    color: "#06b6d4",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "task_id", label: "Zadanie", type: "uuid" },
      { key: "user_id", label: "Użytkownik", type: "uuid" },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  task_attachments: {
    label: "Załączniki zadań",
    icon: "attach",
    color: "#ec4899",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "task_id", label: "Zadanie", type: "uuid" },
      { key: "file_url", label: "URL", type: "text" },
      { key: "file_name", label: "Nazwa pliku", type: "text" },
      { key: "file_type", label: "Typ", type: "text" },
      { key: "uploaded_by", label: "Dodał", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  project_attachments: {
    label: "Załączniki projektów",
    icon: "document-attach",
    color: "#f97316",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "file_url", label: "URL", type: "text" },
      { key: "file_name", label: "Nazwa pliku", type: "text" },
      { key: "file_type", label: "Typ", type: "text" },
      { key: "folder_id", label: "Folder", type: "uuid" },
      { key: "uploaded_by", label: "Dodał", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  automation_rules: {
    label: "Reguły automatyzacji",
    icon: "flash",
    color: "#eab308",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "trigger_type", label: "Wyzwalacz", type: "text" },
      { key: "action_type", label: "Akcja", type: "text" },
      { key: "config", label: "Konfiguracja", type: "json" },
      { key: "enabled", label: "Włączona", type: "boolean" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  vehicles: {
    label: "Pojazdy",
    icon: "car",
    color: "#64748b",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "license_plate", label: "Nr rejestracyjny", type: "text" },
      { key: "seats", label: "Miejsca", type: "number" },
      { key: "active", label: "Aktywny", type: "boolean" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  plan_assignments: {
    label: "Przypisania planu",
    icon: "calendar",
    color: "#0891b2",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "request_id", label: "Wniosek", type: "uuid" },
      { key: "worker_id", label: "Pracownik", type: "uuid" },
      { key: "vehicle_id", label: "Pojazd", type: "uuid" },
      { key: "day_of_week", label: "Dzień", type: "number" },
      { key: "departure_time", label: "Odjazd", type: "text" },
      { key: "start_time", label: "Start", type: "text" },
      { key: "end_time", label: "Koniec", type: "text" },
      { key: "assigned_by", label: "Przypisał", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  plan_requests: {
    label: "Wnioski planowe",
    icon: "hand-left",
    color: "#a855f7",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "week_start", label: "Tydzień", type: "date" },
      { key: "requested_by", label: "Wnioskujący", type: "uuid", readonly: true },
      { key: "status", label: "Status", type: "text" },
      { key: "notes", label: "Notatki", type: "text" },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
      { key: "updated_at", label: "Zaktualizowano", type: "datetime", readonly: true },
    ],
  },
  plan_request_workers: {
    label: "Pracownicy wniosków",
    icon: "people",
    color: "#7c3aed",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "request_id", label: "Wniosek", type: "uuid" },
      { key: "worker_id", label: "Pracownik", type: "uuid" },
    ],
  },
  user_absences: {
    label: "Nieobecności",
    icon: "calendar-clear",
    color: "#ef4444",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "user_id", label: "Użytkownik", type: "uuid" },
      { key: "type", label: "Typ", type: "enum", enumValues: ["vacation", "sick", "personal", "other"] },
      { key: "start_date", label: "Od", type: "date" },
      { key: "end_date", label: "Do", type: "date" },
      { key: "status", label: "Status", type: "enum", enumValues: ["pending", "approved", "rejected"] },
      { key: "reason", label: "Powód", type: "text" },
      { key: "approved_by", label: "Zatwierdzony przez", type: "uuid" },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  user_locations: {
    label: "Lokalizacje GPS",
    icon: "location",
    color: "#ef4444",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "user_id", label: "Użytkownik", type: "uuid" },
      { key: "latitude", label: "Lat", type: "number" },
      { key: "longitude", label: "Lng", type: "number" },
      { key: "accuracy", label: "Dokładność", type: "number" },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  notifications: {
    label: "Powiadomienia",
    icon: "notifications",
    color: "#3b82f6",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "user_id", label: "Użytkownik", type: "uuid" },
      { key: "title", label: "Tytuł", type: "text" },
      { key: "body", label: "Treść", type: "text" },
      { key: "type", label: "Typ", type: "text" },
      { key: "read", label: "Przeczytane", type: "boolean" },
      { key: "data", label: "Dane", type: "json", hidden: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  company_settings: {
    label: "Ustawienia firmy",
    icon: "business",
    color: "#10b981",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "company_name", label: "Nazwa", type: "text" },
      { key: "logo_url", label: "Logo URL", type: "text" },
      { key: "default_password", label: "Domyślne hasło", type: "text" },
      { key: "updated_at", label: "Zaktualizowano", type: "datetime", readonly: true },
    ],
  },
  warehouse_items: {
    label: "Magazyn — pozycje",
    icon: "cube",
    color: "#7c3aed",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "category", label: "Kategoria", type: "text" },
      { key: "quantity", label: "Ilość", type: "number" },
      { key: "unit", label: "Jednostka", type: "text" },
      { key: "min_quantity", label: "Min. ilość", type: "number" },
      { key: "location", label: "Lokalizacja", type: "text" },
      { key: "company_id", label: "Firma", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  warehouse_materials: {
    label: "Magazyn — materiały",
    icon: "construct",
    color: "#f97316",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "pozycja", label: "Pozycja", type: "text" },
      { key: "art_nr", label: "Nr artykułu", type: "text" },
      { key: "nazwa", label: "Nazwa", type: "text" },
      { key: "ilosc", label: "Ilość", type: "number" },
      { key: "dlugosc", label: "Długość", type: "text" },
      { key: "szerokosc", label: "Szerokość", type: "text" },
      { key: "wysokosc", label: "Wysokość", type: "text" },
      { key: "waga", label: "Waga", type: "text" },
      { key: "zamawiajacy", label: "Zamawiający", type: "text" },
      { key: "data_zamowienia", label: "Data zamówienia", type: "date" },
      { key: "data_dostawy", label: "Data dostawy", type: "date" },
      { key: "min_stan", label: "Min. stan", type: "number" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  project_material_orders: {
    label: "Zamówienia materiałów",
    icon: "cart",
    color: "#ec4899",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "material_id", label: "Materiał", type: "uuid" },
      { key: "quantity", label: "Ilość", type: "number" },
      { key: "status", label: "Status", type: "text" },
      { key: "ordered_by", label: "Zamówił", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  project_tool_orders: {
    label: "Zamówienia narzędzi",
    icon: "hammer",
    color: "#64748b",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "tool_name", label: "Narzędzie", type: "text" },
      { key: "quantity", label: "Ilość", type: "number" },
      { key: "status", label: "Status", type: "text" },
      { key: "ordered_by", label: "Zamówił", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  attachment_folders: {
    label: "Foldery załączników",
    icon: "folder",
    color: "#f59e0b",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "parent_id", label: "Rodzic", type: "uuid" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  project_plans: {
    label: "Plany budowlane",
    icon: "map",
    color: "#0891b2",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "project_id", label: "Projekt", type: "uuid" },
      { key: "name", label: "Nazwa", type: "text" },
      { key: "file_url", label: "URL pliku", type: "text" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
  plan_pins: {
    label: "Pinezki planów",
    icon: "pin",
    color: "#ef4444",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "plan_id", label: "Plan", type: "uuid" },
      { key: "task_id", label: "Zadanie", type: "uuid" },
      { key: "title", label: "Tytuł", type: "text" },
      { key: "description", label: "Opis", type: "text" },
      { key: "x", label: "X", type: "number" },
      { key: "y", label: "Y", type: "number" },
      { key: "color", label: "Kolor", type: "text" },
      { key: "created_by", label: "Twórca", type: "uuid", readonly: true },
      { key: "created_at", label: "Utworzono", type: "datetime", readonly: true },
    ],
  },
};

const TABLE_NAMES = Object.keys(TABLE_META);
const PAGE_SIZE = 20;

// ─── Component ───

export default function AdminDatabaseScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  // Edit modal
  const [editRow, setEditRow] = useState<any>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  // Table counts cache
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadTableCounts();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      setPage(0);
      fetchData(selectedTable, 0);
    }
  }, [selectedTable, sortColumn, sortAsc]);

  const loadTableCounts = async () => {
    const counts: Record<string, number> = {};
    // Load counts in parallel batches
    const promises = TABLE_NAMES.map(async (table) => {
      try {
        const { data } = await adminApi.from(table).select("id").limit(1000);
        counts[table] = Array.isArray(data) ? data.length : 0;
      } catch {
        counts[table] = 0;
      }
    });
    await Promise.all(promises);
    setTableCounts(counts);
  };

  const fetchData = async (table: string, pageNum: number) => {
    setLoading(true);
    try {
      const meta = TABLE_META[table];
      if (!meta) return;

      let query = adminApi.from(table).select("*");

      // Search — ilike on text columns
      if (search.trim()) {
        const textCols = meta.columns.filter(c => c.type === "text" || c.type === "enum");
        if (textCols.length > 0) {
          const orFilter = textCols.map(c => `${c.key}.ilike.%${search.trim()}%`).join(",");
          query = query.or(orFilter);
        }
      }

      query = query.order(sortColumn, { ascending: sortAsc });
      // Simple pagination via limit offset approach — we re-fetch
      // adminApi doesn't support .range(), so use limit
      query = query.limit(PAGE_SIZE * (pageNum + 1));

      const { data, error } = await query;
      if (error) {
        console.error("DB fetch error:", error);
        setRows([]);
        return;
      }

      const allData = Array.isArray(data) ? data : [];
      setTotalCount(allData.length);
      // Take only the current page slice
      const start = pageNum * PAGE_SIZE;
      setRows(allData.slice(start, start + PAGE_SIZE));
    } catch (e) {
      console.error("DB fetch exception:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    if (selectedTable) {
      setPage(0);
      fetchData(selectedTable, 0);
    }
  }, [selectedTable, search, sortColumn, sortAsc]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (selectedTable) fetchData(selectedTable, newPage);
  };

  const openEditModal = (row: any) => {
    setEditRow(row);
    setEditData({ ...row });
    setIsNewRecord(false);
  };

  const openNewModal = () => {
    if (!selectedTable) return;
    const meta = TABLE_META[selectedTable];
    const emptyData: Record<string, any> = {};
    meta.columns.forEach(col => {
      if (col.readonly) return;
      if (col.type === "boolean") emptyData[col.key] = false;
      else if (col.type === "number") emptyData[col.key] = 0;
      else emptyData[col.key] = "";
    });
    setEditRow({});
    setEditData(emptyData);
    setIsNewRecord(true);
  };

  const saveRecord = async () => {
    if (!selectedTable) return;
    setEditSaving(true);
    try {
      const meta = TABLE_META[selectedTable];
      const cleanData: Record<string, any> = {};

      meta.columns.forEach(col => {
        if (col.readonly) return;
        let val = editData[col.key];
        if (val === "" || val === undefined) val = null;
        if (col.type === "number" && val !== null) val = parseFloat(val);
        if (col.type === "boolean") val = !!val;
        if (col.type === "json" && typeof val === "string") {
          try { val = JSON.parse(val); } catch { /* keep string */ }
        }
        cleanData[col.key] = val;
      });

      if (isNewRecord) {
        const { error } = await adminApi.from(selectedTable).insert(cleanData);
        if (error) throw error;
      } else {
        const { error } = await adminApi.from(selectedTable).update(cleanData).eq("id", editRow.id);
        if (error) throw error;
      }

      setEditRow(null);
      fetchData(selectedTable, page);
      const msg = isNewRecord ? "Rekord dodany" : "Rekord zapisany";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      const msg = e?.message || "Błąd zapisu";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteRecord = async (row: any) => {
    if (!selectedTable) return;

    const doDelete = async () => {
      try {
        const { error } = await adminApi.from(selectedTable).delete().eq("id", row.id);
        if (error) throw error;
        fetchData(selectedTable, page);
      } catch (e: any) {
        const msg = e?.message || "Błąd usuwania";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert(t("common.error"), msg);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Czy na pewno chcesz usunąć ten rekord?")) {
        await doDelete();
      }
    } else {
      Alert.alert(
        "Usuń rekord",
        "Czy na pewno chcesz usunąć ten rekord?",
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.delete", "Usuń"), style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  // ─── Render helpers ───

  const formatCellValue = (value: any, type: ColumnType): string => {
    if (value === null || value === undefined) return "—";
    if (type === "boolean") return value ? "✓" : "✗";
    if (type === "datetime") return new Date(value).toLocaleString();
    if (type === "date") return value?.substring?.(0, 10) || String(value);
    if (type === "json") return JSON.stringify(value).substring(0, 50);
    if (type === "uuid") return String(value).substring(0, 8) + "…";
    return String(value).substring(0, 60);
  };

  const meta = selectedTable ? TABLE_META[selectedTable] : null;
  const visibleColumns = meta?.columns.filter(c => !c.hidden) || [];

  // ─── Table Picker ───

  const renderTablePicker = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t("admin.select_table", "Wybierz tabelę")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {TABLE_NAMES.map((table) => {
          const tm = TABLE_META[table];
          const isActive = selectedTable === table;
          return (
            <TouchableOpacity
              key={table}
              style={[
                styles.tableRow,
                { borderBottomColor: colors.borderLight },
                isActive && { backgroundColor: `${tm.color}10` },
              ]}
              onPress={() => {
                setSelectedTable(table);
                setSearch("");
                const hasCreatedAt = tm.columns.some(c => c.key === "created_at");
                setSortColumn(hasCreatedAt ? "created_at" : "id");
                setSortAsc(false);
                setShowTablePicker(false);
              }}
            >
              <Ionicons name={tm.icon as any} size={18} color={tm.color} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.tableName, { color: isActive ? tm.color : colors.text }]}>{tm.label}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{table}</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: `${tm.color}15` }]}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: tm.color }}>
                  {tableCounts[table] ?? "…"}
                </Text>
              </View>
              {isActive && <Ionicons name="checkmark-circle" size={18} color={tm.color} style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── Data View ───

  const renderDataView = () => {
    if (!selectedTable || !meta) return null;

    return (
      <View style={styles.section}>
        {/* Table header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            onPress={() => setShowTablePicker(true)}
          >
            <Ionicons name={meta.icon as any} size={20} color={meta.color} />
            <Text style={[styles.sectionTitle, { color: meta.color, marginBottom: 0 }]}>{meta.label}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: meta.color }]}
            onPress={openNewModal}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              {t("admin.add_record", "Dodaj")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg || "#f1f5f9", borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 13, color: colors.text }}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            placeholder={t("admin.search_records", "Szukaj w rekordach...")}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(""); if (selectedTable) { setPage(0); fetchData(selectedTable, 0); } }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearch} style={{ marginLeft: 6 }}>
            <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Data table */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>
              {t("admin.no_records", "Brak rekordów")}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Column headers */}
              <View style={[styles.headerRow, { backgroundColor: `${meta.color}08`, borderBottomColor: colors.border }]}>
                {visibleColumns.map((col) => (
                  <TouchableOpacity
                    key={col.key}
                    style={[styles.headerCell, col.type === "uuid" ? { width: 80 } : col.type === "boolean" ? { width: 60 } : { width: 140 }]}
                    onPress={() => handleSort(col.key)}
                  >
                    <Text style={[styles.headerText, { color: colors.text }]} numberOfLines={1}>{col.label}</Text>
                    {sortColumn === col.key && (
                      <Ionicons name={sortAsc ? "arrow-up" : "arrow-down"} size={12} color={meta.color} />
                    )}
                  </TouchableOpacity>
                ))}
                <View style={[styles.headerCell, { width: 80 }]}>
                  <Text style={[styles.headerText, { color: colors.text }]}>Akcje</Text>
                </View>
              </View>

              {/* Rows */}
              {rows.map((row, idx) => (
                <TouchableOpacity
                  key={row.id || idx}
                  style={[styles.dataRow, { backgroundColor: idx % 2 === 0 ? "transparent" : `${colors.border}30`, borderBottomColor: colors.borderLight }]}
                  onPress={() => openEditModal(row)}
                >
                  {visibleColumns.map((col) => (
                    <View key={col.key} style={[styles.dataCell, col.type === "uuid" ? { width: 80 } : col.type === "boolean" ? { width: 60 } : { width: 140 }]}>
                      <Text style={[styles.cellText, { color: col.type === "boolean" ? (row[col.key] ? "#10b981" : "#ef4444") : colors.text }]} numberOfLines={1}>
                        {formatCellValue(row[col.key], col.type)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.dataCell, { width: 80, flexDirection: "row", gap: 4 }]}>
                    <TouchableOpacity onPress={() => openEditModal(row)} style={styles.actionBtn}>
                      <Ionicons name="pencil" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteRecord(row)} style={styles.actionBtn}>
                      <Ionicons name="trash" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Pagination */}
        {rows.length > 0 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 0 && { opacity: 0.3 }]}
              onPress={() => page > 0 && handlePageChange(page - 1)}
              disabled={page === 0}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {t("admin.page", "Strona")} {page + 1}
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, rows.length < PAGE_SIZE && { opacity: 0.3 }]}
              onPress={() => rows.length >= PAGE_SIZE && handlePageChange(page + 1)}
              disabled={rows.length < PAGE_SIZE}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (selectedTable) fetchData(selectedTable, page); }}
              style={{ marginLeft: 12 }}
            >
              <Ionicons name="refresh" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─── Edit Modal ───

  const renderEditModal = () => {
    if (!editRow || !selectedTable) return null;
    const meta = TABLE_META[selectedTable];

    const modalContent = (
      <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {isNewRecord ? t("admin.new_record", "Nowy rekord") : t("admin.edit_record", "Edytuj rekord")}
          </Text>
          <TouchableOpacity onPress={() => setEditRow(null)}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>{meta.label} ({selectedTable})</Text>

        <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator>
          {meta.columns.map((col) => {
            if (col.readonly && isNewRecord) return null;
            const val = editData[col.key];

            return (
              <View key={col.key} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 4 }}>
                  {col.label} <Text style={{ fontWeight: "400", color: colors.textMuted }}>({col.key})</Text>
                  {col.readonly && <Text style={{ color: "#f59e0b" }}> readonly</Text>}
                </Text>

                {col.readonly ? (
                  <Text style={{ fontSize: 13, color: colors.textMuted, padding: 8, backgroundColor: colors.inputBg || "#f1f5f9", borderRadius: 8 }}>
                    {formatCellValue(val, col.type)}
                  </Text>
                ) : col.type === "boolean" ? (
                  <TouchableOpacity
                    style={[styles.boolToggle, { backgroundColor: val ? "#10b981" : "#cbd5e1" }]}
                    onPress={() => setEditData(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>
                      {val ? "TRUE" : "FALSE"}
                    </Text>
                  </TouchableOpacity>
                ) : col.type === "enum" ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {col.enumValues?.map(ev => (
                      <TouchableOpacity
                        key={ev}
                        style={[styles.enumChip, { backgroundColor: val === ev ? `${meta.color}20` : colors.inputBg || "#f1f5f9", borderColor: val === ev ? meta.color : colors.border }]}
                        onPress={() => setEditData(prev => ({ ...prev, [col.key]: ev }))}
                      >
                        <Text style={{ fontSize: 12, fontWeight: val === ev ? "700" : "400", color: val === ev ? meta.color : colors.text }}>{ev}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : col.type === "json" ? (
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg || "#f1f5f9", borderColor: colors.border, minHeight: 80 }]}
                    value={typeof val === "object" ? JSON.stringify(val, null, 2) : String(val || "")}
                    onChangeText={(text) => setEditData(prev => ({ ...prev, [col.key]: text }))}
                    multiline
                    textAlignVertical="top"
                  />
                ) : (
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg || "#f1f5f9", borderColor: colors.border }]}
                    value={String(val ?? "")}
                    onChangeText={(text) => setEditData(prev => ({ ...prev, [col.key]: text }))}
                    keyboardType={col.type === "number" ? "numeric" : "default"}
                    placeholder={col.type === "uuid" ? "uuid..." : ""}
                    placeholderTextColor={colors.textMuted}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveButton, editSaving && { opacity: 0.6 }, { backgroundColor: meta.color }]}
          onPress={saveRecord}
          disabled={editSaving}
        >
          {editSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {isNewRecord ? t("admin.create", "Utwórz") : t("common.save", "Zapisz")}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );

    return Platform.OS === "web" ? (
      <View style={[styles.modalOverlay, { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }]}>
        {modalContent}
      </View>
    ) : (
      <Modal visible transparent animationType="fade" onRequestClose={() => setEditRow(null)}>
        <View style={styles.modalOverlay}>{modalContent}</View>
      </Modal>
    );
  };

  // ─── Table picker modal (when already viewing a table) ───

  const renderTablePickerModal = () => {
    if (!showTablePicker) return null;

    const pickerContent = (
      <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "80%" }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{t("admin.select_table", "Wybierz tabelę")}</Text>
          <TouchableOpacity onPress={() => setShowTablePicker(false)}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {TABLE_NAMES.map((table) => {
            const tm = TABLE_META[table];
            return (
              <TouchableOpacity
                key={table}
                style={[styles.tableRow, { borderBottomColor: colors.borderLight }]}
                onPress={() => {
                  setSelectedTable(table);
                  setSearch("");
                  const hasCreatedAt = tm.columns.some(c => c.key === "created_at");
                  setSortColumn(hasCreatedAt ? "created_at" : "id");
                  setSortAsc(false);
                  setShowTablePicker(false);
                }}
              >
                <Ionicons name={tm.icon as any} size={18} color={tm.color} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.tableName, { color: colors.text }]}>{tm.label}</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: `${tm.color}15` }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: tm.color }}>
                    {tableCounts[table] ?? "…"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );

    return Platform.OS === "web" ? (
      <View style={[styles.modalOverlay, { position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }]}>
        {pickerContent}
      </View>
    ) : (
      <Modal visible transparent animationType="fade" onRequestClose={() => setShowTablePicker(false)}>
        <View style={styles.modalOverlay}>{pickerContent}</View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.pageHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="server" size={24} color="#3b82f6" />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("admin.database", "Baza danych")}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {selectedTable ? renderDataView() : renderTablePicker()}
      </ScrollView>

      {editRow && renderEditModal()}
      {renderTablePickerModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backButton: {
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  tableName: {
    fontSize: 14,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  // Data table
  headerRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
  },
  headerCell: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    gap: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dataRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  dataCell: {
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 12,
  },
  actionBtn: {
    padding: 4,
    borderRadius: 6,
  },
  // Pagination
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 16,
    paddingVertical: 8,
  },
  pageBtn: {
    padding: 8,
    borderRadius: 8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 560,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  boolToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  enumChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
});
