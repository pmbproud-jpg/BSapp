import { usePermissions } from "@/src/hooks/usePermissions";
import { sendPasswordEmail } from "@/src/lib/sendEmail";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { openLink } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import * as XLSX from "xlsx";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ImportedUser = {
  full_name: string;
  email: string;
  phone: string;
  role: string;
};

export default function UsersScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedUser[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "worker" as string,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "role">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "subcontractors">("users");
  const [showAddSubcontractor, setShowAddSubcontractor] = useState(false);
  const [addSubLoading, setAddSubLoading] = useState(false);
  const [newSub, setNewSub] = useState({ full_name: "", email: "", phone: "", access_expires_at: "" });

  const perms = usePermissions();
  const isAdmin = perms.isAdmin;
  const isManagement = perms.isManagement;
  const canViewUsers = perms.canViewUsers;
  const canEditUsers = perms.canEditUser;
  const canDeleteUser = perms.canDeleteUser;
  const canChangeRole = perms.canChangeUserRole;
  const canManageSubs = perms.canManageSubcontractor;

  useEffect(() => {
    if (!canViewUsers && !canManageSubs) {
      router.replace("/dashboard");
      return;
    }
    if (!canViewUsers && canManageSubs) {
      setActiveTab("subcontractors");
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "#ef4444",
      management: "#f59e0b",
      project_manager: "#3b82f6",
      bauleiter: "#10b981",
      worker: "#64748b",
      subcontractor: "#8b5cf6",
      office_worker: "#06b6d4",
      logistics: "#f97316",
      purchasing: "#ec4899",
      warehouse_manager: "#7c3aed",
    };
    return colors[role] || "#94a3b8";
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      admin: "shield-checkmark",
      management: "business",
      project_manager: "briefcase",
      bauleiter: "construct",
      worker: "hammer",
      subcontractor: "people",
      office_worker: "desktop",
      logistics: "cube",
      purchasing: "cart",
      warehouse_manager: "file-tray-stacked",
    };
    return icons[role] || "person";
  };

  // ---- ADD USER ----
  const roleOptions = [
    { value: "admin", label: "Admin", icon: "shield-checkmark" as keyof typeof Ionicons.glyphMap },
    { value: "management", label: t("common.roles.management") || "Geschäftsleitung", icon: "business" as keyof typeof Ionicons.glyphMap },
    { value: "project_manager", label: "PM", icon: "briefcase" as keyof typeof Ionicons.glyphMap },
    { value: "bauleiter", label: "BL", icon: "construct" as keyof typeof Ionicons.glyphMap },
    { value: "office_worker", label: t("common.roles.office_worker") || "Büroangestellter", icon: "desktop" as keyof typeof Ionicons.glyphMap },
    { value: "logistics", label: t("common.roles.logistics") || "Logistik", icon: "cube" as keyof typeof Ionicons.glyphMap },
    { value: "purchasing", label: t("common.roles.purchasing") || "Einkauf", icon: "cart" as keyof typeof Ionicons.glyphMap },
    { value: "worker", label: t("common.roles.worker") || "Mitarbeiter", icon: "hammer" as keyof typeof Ionicons.glyphMap },
    { value: "warehouse_manager", label: t("common.roles.warehouse_manager") || "Lagerverwalter", icon: "file-tray-stacked" as keyof typeof Ionicons.glyphMap },
  ];

  const createUser = async () => {
    if (!newUser.full_name.trim()) {
      if (Platform.OS === "web") window.alert(t("users.name_required") || "Vollständiger Name ist erforderlich");
      else Alert.alert(t("common.error"), t("users.name_required") || "Vollständiger Name ist erforderlich");
      return;
    }
    if (!newUser.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email.trim())) {
      if (Platform.OS === "web") window.alert(t("users.email_required") || "Bitte gültige E-Mail eingeben");
      else Alert.alert(t("common.error"), t("users.email_required") || "Bitte gültige E-Mail eingeben");
      return;
    }

    setAddUserLoading(true);
    try {
      const tempPassword = `Temp${Date.now()}!`;

      // Use admin client to create user (bypasses email confirmation, triggers profile creation)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newUser.email.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: newUser.full_name.trim(),
          phone: newUser.phone.trim() || "",
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("User not created");

      const userId = authData.user.id;

      // Wait for database trigger to create profile, then update with role/company
      await new Promise((r) => setTimeout(r, 1500));

      const { error: profileError } = await (supabaseAdmin.from("profiles") as any)
        .update({
          full_name: newUser.full_name.trim(),
          phone: newUser.phone.trim() || null,
          role: newUser.role,
          company_id: profile?.company_id,
        })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      setNewUser({ full_name: "", email: "", phone: "", role: "worker" });
      setShowAddUser(false);
      fetchUsers();

      if (Platform.OS === "web") window.alert(t("users.created_success") || "Benutzer erfolgreich erstellt");
      else Alert.alert(t("common.success"), t("users.created_success") || "Benutzer erfolgreich erstellt");
    } catch (error: any) {
      console.error("Error creating user:", error);
      const msg = error?.message || t("users.create_error") || "Fehler beim Erstellen des Benutzers";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    } finally {
      setAddUserLoading(false);
    }
  };

  // ---- SUBCONTRACTOR ----
  const createSubcontractor = async () => {
    if (!newSub.full_name.trim()) {
      const msg = t("users.name_required") || "Vollständiger Name ist erforderlich";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    if (!newSub.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSub.email.trim())) {
      const msg = t("users.email_required") || "Bitte gültige E-Mail eingeben";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    if (!newSub.access_expires_at) {
      const msg = t("users.subcontractors.expiry_required") || "Bitte Ablaufdatum des Zugangs eingeben";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    setAddSubLoading(true);
    try {
      const tempPassword = `Sub${Date.now()}!`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newSub.email.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: newSub.full_name.trim(),
          phone: newSub.phone.trim() || "",
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("User not created");

      const userId = authData.user.id;
      await new Promise((r) => setTimeout(r, 1500));

      const { error: profileError } = await (supabaseAdmin.from("profiles") as any)
        .update({
          full_name: newSub.full_name.trim(),
          phone: newSub.phone.trim() || null,
          role: "subcontractor",
          company_id: profile?.company_id,
          access_expires_at: newSub.access_expires_at,
        })
        .eq("id", userId);

      if (profileError) console.error("Profile update error:", profileError);

      setNewSub({ full_name: "", email: "", phone: "", access_expires_at: "" });
      setShowAddSubcontractor(false);
      fetchUsers();

      const msg = `${t("users.subcontractors.created_success") || "Subunternehmer erstellt"}\n\nLogin: ${newSub.email.trim()}\n${t("users.subcontractors.temp_password") || "Temporäres Passwort"}: ${tempPassword}\n${t("users.subcontractors.expires") || "Läuft ab"}: ${newSub.access_expires_at}`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (error: any) {
      console.error("Error creating subcontractor:", error);
      const msg = error?.message || t("common.error");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally {
      setAddSubLoading(false);
    }
  };

  const renewAccess = async (userId: string, newDate: string) => {
    try {
      const { error } = await (supabaseAdmin.from("profiles") as any)
        .update({ access_expires_at: newDate })
        .eq("id", userId);
      if (error) throw error;
      fetchUsers();
      const msg = t("users.subcontractors.access_renewed") || "Zugang erneuert";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (error) {
      console.error("Error renewing access:", error);
      Platform.OS === "web" ? window.alert(t("common.error")) : Alert.alert(t("common.error"), t("common.error"));
    }
  };

  // ---- IMPORT EXCEL ----
  const pickFileWeb = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setImportFileName(file.name);
      setImportLoading(true);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          processWorkbook(workbook);
        } catch (err) {
          console.error("Error parsing Excel:", err);
          window.alert(t("users.import.parse_error"));
          setImportLoading(false);
        }
      };
      reader.onerror = () => {
        window.alert(t("users.import.parse_error"));
        setImportLoading(false);
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const pickFileNative = async () => {
    try {
      const DocumentPicker = require("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setImportFileName(asset.name);
      setImportLoading(true);
      const FileSystem = require("expo-file-system");
      const fileContent = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const workbook = XLSX.read(fileContent, { type: "base64" });
      processWorkbook(workbook);
    } catch (error) {
      console.error("Error picking/parsing file:", error);
      Alert.alert(t("common.error"), t("users.import.parse_error"));
      setImportLoading(false);
    }
  };

  const processWorkbook = (workbook: XLSX.WorkBook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const nonEmptyRows = allRows.filter((row) =>
      row.some((cell: any) => cell != null && String(cell).trim() !== "")
    );

    if (nonEmptyRows.length === 0) {
      setImportLoading(false);
      if (Platform.OS === "web") { window.alert(t("users.import.no_valid_data")); }
      else { Alert.alert(t("common.error"), t("users.import.no_valid_data")); }
      return;
    }

    const isEmail = (v: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
    const isPhone = (v: any) => /^\+?\d[\d\s\-]{5,}$/.test(String(v).trim());
    const isRole = (v: any) => {
      const roles = ["admin", "management", "project_manager", "bauleiter", "worker", "office_worker", "logistics", "purchasing", "bl", "pm"];
      return roles.includes(String(v).trim().toLowerCase());
    };
    const isHeaderName = (v: any) =>
      /^(imi|nazw|name|email|e-mail|mail|tel|phone|handy|mobil|rola|role|funkcja|position|stanowisko|vorname|nachname)/i.test(
        String(v).trim()
      );

    const firstRow = nonEmptyRows[0];
    const firstRowIsHeader = firstRow.some((cell: any) => isHeaderName(cell));

    let dataRows: any[][];
    let headerMap: Record<string, number> | null = null;

    if (firstRowIsHeader && nonEmptyRows.length > 1) {
      const headers = firstRow.map((h: any) => String(h).trim().toLowerCase());
      headerMap = {};
      headers.forEach((h: string, i: number) => { headerMap![h] = i; });
      dataRows = nonEmptyRows.slice(1);
    } else {
      dataRows = nonEmptyRows;
    }

    const nameRegex = /imi|nazw|name|vorname|nachname/i;
    const emailRegex = /email|e-mail|mail/i;
    const phoneRegex = /tel|phone|handy|mobil/i;
    const roleRegex = /rol|funkcja|position|stanowisko/i;

    const findColByHeader = (regex: RegExp): number | null => {
      if (!headerMap) return null;
      for (const [key, idx] of Object.entries(headerMap)) {
        if (regex.test(key)) return idx;
      }
      return null;
    };

    const nameCol = findColByHeader(nameRegex);
    const emailCol = findColByHeader(emailRegex);
    const phoneCol = findColByHeader(phoneRegex);
    const roleCol = findColByHeader(roleRegex);

    const roleMap: Record<string, string> = { bl: "bauleiter", pm: "project_manager" };
    const validRoles = ["admin", "management", "project_manager", "bauleiter", "worker", "office_worker", "logistics", "purchasing"];

    const importedUsers: ImportedUser[] = dataRows.map((row) => {
      const cells = row.map((c: any) => (c != null ? String(c).trim() : ""));
      let full_name = "";
      let email = "";
      let phone = "";
      let role = "worker";

      if (headerMap) {
        if (nameCol != null) full_name = cells[nameCol] || "";
        if (emailCol != null) email = cells[emailCol] || "";
        if (phoneCol != null) phone = cells[phoneCol] || "";
        if (roleCol != null) {
          const rv = cells[roleCol].toLowerCase();
          role = roleMap[rv] || rv;
        }
      }

      if (!full_name || !email) {
        for (let i = 0; i < cells.length; i++) {
          const v = cells[i];
          if (!v) continue;
          if (!email && isEmail(v)) { email = v; continue; }
          if (!phone && isPhone(v)) { phone = v; continue; }
          if (!role || role === "worker") {
            if (isRole(v)) { const rv = v.toLowerCase(); role = roleMap[rv] || rv; continue; }
          }
          if (!full_name && v.length > 1 && !isEmail(v) && !isPhone(v) && !isRole(v)) {
            full_name = v;
          }
        }
      }

      if (!validRoles.includes(role)) role = "worker";
      return { full_name, email, phone, role };
    });

    const validUsers = importedUsers.filter((u) => u.full_name.length > 0);

    if (validUsers.length === 0) {
      setImportLoading(false);
      if (Platform.OS === "web") { window.alert(t("users.import.no_valid_data")); }
      else { Alert.alert(t("common.error"), t("users.import.no_valid_data")); }
      return;
    }

    setImportPreview(validUsers);
    setImportLoading(false);
  };

  const importUsers = async () => {
    if (importPreview.length === 0) return;

    const usersWithEmail = importPreview.filter((u) => u.email.length > 0);
    const skippedNoEmail = importPreview.length - usersWithEmail.length;

    if (usersWithEmail.length === 0) {
      const msg = t("users.import.no_valid_data") + (skippedNoEmail > 0 ? `\n(${skippedNoEmail} ohne E-Mail)` : "");
      if (Platform.OS === "web") { window.alert(msg); } else { Alert.alert(t("common.error"), msg); }
      return;
    }

    setImportLoading(true);
    try {
      const createdUsers: string[] = [];
      const errors: string[] = [];

      for (const user of usersWithEmail) {
        try {
          const tempPassword = `Temp${Math.random().toString(36).slice(2)}!`;

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

      // Wait for database trigger to create profiles, then update roles
      if (createdUsers.length > 0) {
        await new Promise((r) => setTimeout(r, 2000));

        for (const user of usersWithEmail) {
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

      const successMsg = `${createdUsers.length} Benutzer importiert` +
        (skippedNoEmail > 0 ? ` (${skippedNoEmail} übersprungen - keine E-Mail)` : "");

      if (createdUsers.length > 0) {
        if (Platform.OS === "web") { window.alert(successMsg); } else { Alert.alert(t("common.success"), successMsg); }
        setImportPreview([]);
        setImportFileName("");
        setShowImport(false);
        fetchUsers();
      }

      if (errors.length > 0) {
        const errMsg = t("users.import.partial_error") + "\n\n" + errors.slice(0, 3).join("\n");
        if (Platform.OS === "web") { window.alert(errMsg); } else { Alert.alert(t("common.error"), errMsg); }
      }
    } catch (error: any) {
      console.error("Error importing users:", error);
      if (Platform.OS === "web") { window.alert(t("users.import.error")); } else { Alert.alert(t("common.error"), t("users.import.error")); }
    } finally {
      setImportLoading(false);
    }
  };
  // ---- END IMPORT ----

  const sendInviteLink = async (userEmail: string, userName: string) => {
    try {
      const redirectUrl = "https://bsapp-management.netlify.app/reset-password";

      // 1. Generate link via admin API (no rate limit, always works)
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: userEmail,
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;

      let actionLink = data?.properties?.action_link || "";
      if (actionLink) {
        try {
          const u = new URL(actionLink);
          u.searchParams.set("redirect_to", redirectUrl);
          actionLink = u.toString();
        } catch {}
      }
      if (!actionLink) throw new Error("Link konnte nicht generiert werden.");

      // 2. Send email via Resend
      const emailResult = await sendPasswordEmail(userEmail, userName, actionLink);

      if (emailResult.success) {
        const msg = `✅ E-Mail mit Passwort-Link wurde an ${userEmail} gesendet.`;
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert(t("common.success"), msg);
        }
      } else {
        // Email failed — fallback to clipboard/share
        console.warn("Email send failed:", emailResult.error);
        const msg = `⚠️ E-Mail konnte nicht gesendet werden.\n\nLink wurde generiert — bitte manuell weiterleiten.`;
        if (Platform.OS === "web") {
          await navigator.clipboard.writeText(actionLink).catch(() => {});
          window.alert(`${msg}\n\nLink wurde in die Zwischenablage kopiert.`);
        } else {
          Alert.alert(
            "Info",
            msg,
            [
              {
                text: "Link teilen",
                onPress: () => {
                  const { Share: NativeShare } = require("react-native");
                  NativeShare.share({
                    message: `Passwort erstellen für BSapp:\n${actionLink}`,
                  }).catch(() => {});
                },
              },
              { text: "OK" },
            ]
          );
        }
      }
    } catch (error: any) {
      console.error("Error sending invite:", error);
      const msg = error?.message || t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    }
  };

  const deleteUser = async (userId: string) => {
    const doDelete = async () => {
      try {
        // 1. Delete profile first
        const { error: profileError } = await (supabaseAdmin.from("profiles") as any)
          .delete()
          .eq("id", userId);
        if (profileError) console.error("Profile delete error:", profileError);

        // 2. Delete auth user
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        fetchUsers();
        const msg = t("users.deleted_success") || "Benutzer gelöscht";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert(t("common.success"), msg);
      } catch (error: any) {
        console.error("Error deleting user:", error);
        const msg = error?.message || t("users.delete_error") || "Fehler beim Löschen des Benutzers";
        if (Platform.OS === "web") window.alert(msg);
        else Alert.alert(t("common.error"), msg);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        (t("users.delete_confirm_message") || "Möchten Sie diesen Benutzer wirklich löschen?")
      );
      if (confirmed) doDelete();
    } else {
      Alert.alert(
        t("users.delete_confirm_title") || "Benutzer löschen",
        t("users.delete_confirm_message") || "Möchten Sie diesen Benutzer wirklich löschen?",
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.delete"), style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const renderUser = ({ item }: { item: Profile }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => router.push(`/users/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.userHeader}>
        <View style={styles.userIcon}>
          <Ionicons
            name={getRoleIcon(item.role)}
            size={24}
            color={getRoleColor(item.role)}
          />
        </View>
        <View style={styles.userInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
              {item.full_name || item.email}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: `${getRoleColor(item.role)}20` },
                ]}
              >
                <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                  {t(`common.roles.${item.role}`)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" style={{ marginLeft: 6 }} />
            </View>
          </View>
          {(item as any).hide_email && !(isAdmin || isManagement) ? null : (
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); openLink(`mailto:${item.email}`); }} activeOpacity={0.6}>
              <Text style={[styles.userEmail, { color: "#2563eb", textDecorationLine: "underline" }]} numberOfLines={1}>
                {item.email}{(item as any).hide_email ? " 🔒" : ""}
              </Text>
            </TouchableOpacity>
          )}
          {item.phone ? (
            (item as any).hide_phone && !(isAdmin || isManagement) ? null : (
              <TouchableOpacity style={styles.contactRow} onPress={(e) => { e.stopPropagation(); openLink(`tel:${item.phone}`); }} activeOpacity={0.6}>
                <Ionicons name="call" size={14} color="#2563eb" />
                <Text style={[styles.contactText, { color: "#2563eb", textDecorationLine: "underline" }]}>
                  {item.phone}{(item as any).hide_phone ? " 🔒" : ""}
                </Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>
      </View>

      {canEditUsers && item.id !== profile?.id && (
        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}
            onPress={(e) => { e.stopPropagation(); sendInviteLink(item.email, item.full_name || item.email); }}
          >
            <Ionicons name="mail-outline" size={18} color="#2563eb" />
            <Text style={[styles.actionButtonText, { color: "#2563eb" }]}>
              {t("users.send_invite") || "Link senden"}
            </Text>
          </TouchableOpacity>
          {canDeleteUser && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={(e) => { e.stopPropagation(); deleteUser(item.id); }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                {t("common.delete")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (!canViewUsers && !canManageSubs) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const subcontractors = users.filter((u) => u.role === "subcontractor");
  const regularUsers = users.filter((u) => u.role !== "subcontractor");

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const renderSubcontractor = ({ item }: { item: Profile }) => {
    const expired = isExpired((item as any).access_expires_at);
    return (
      <TouchableOpacity
        style={[styles.userCard, expired && { borderColor: "#ef4444", borderWidth: 1.5 }]}
        onPress={() => router.push(`/users/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.userHeader}>
          <View style={[styles.userIcon, { backgroundColor: expired ? "#fef2f2" : "#f5f3ff" }]}>
            <Ionicons name="people" size={24} color={expired ? "#ef4444" : "#8b5cf6"} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.full_name || item.email}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            {(item as any).access_expires_at ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Ionicons name={expired ? "alert-circle" : "time-outline"} size={14} color={expired ? "#ef4444" : "#8b5cf6"} />
                <Text style={{ fontSize: 12, color: expired ? "#ef4444" : "#8b5cf6", fontWeight: "600" }}>
                  {expired
                    ? (t("users.subcontractors.expired") || "Abgelaufen")
                    : `${t("users.subcontractors.expires") || "Läuft ab"}: ${new Date((item as any).access_expires_at).toLocaleDateString("de-DE")}`}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: expired ? "#fef2f220" : "#8b5cf620" }]}>
            <Text style={[styles.roleText, { color: expired ? "#ef4444" : "#8b5cf6" }]}>
              {expired ? (t("users.subcontractors.expired") || "Abgelaufen") : (t("common.roles.subcontractor") || "Subunternehmer")}
            </Text>
          </View>
        </View>
        {canManageSubs && expired && (
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#8b5cf610", paddingVertical: 8, borderRadius: 8, marginTop: 8, gap: 6 }}
            onPress={() => {
              const newDate = new Date();
              newDate.setMonth(newDate.getMonth() + 1);
              const dateStr = newDate.toISOString().split("T")[0];
              renewAccess(item.id, dateStr);
            }}
          >
            <Ionicons name="refresh" size={16} color="#8b5cf6" />
            <Text style={{ color: "#8b5cf6", fontWeight: "600", fontSize: 13 }}>{t("users.subcontractors.renew_30_days") || "30 Tage verlängern"}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab bar: Użytkownicy / Podwykonawcy */}
      {!showAddUser && !showImport && !showAddSubcontractor && (
        <View style={styles.tabBar}>
          {canViewUsers && (
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "users" && styles.tabBtnActive]}
              onPress={() => setActiveTab("users")}
            >
              <Ionicons name="people" size={18} color={activeTab === "users" ? "#2563eb" : "#64748b"} />
              <Text style={[styles.tabBtnText, activeTab === "users" && styles.tabBtnTextActive]}>
                {t("users.title") || "Benutzer"} ({regularUsers.length})
              </Text>
            </TouchableOpacity>
          )}
          {canManageSubs && (
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "subcontractors" && styles.tabBtnActive]}
              onPress={() => setActiveTab("subcontractors")}
            >
              <Ionicons name="people-circle" size={18} color={activeTab === "subcontractors" ? "#8b5cf6" : "#64748b"} />
              <Text style={[styles.tabBtnText, activeTab === "subcontractors" && { color: "#8b5cf6" }]}>
                {t("users.subcontractors.title") || "Subunternehmer"} ({subcontractors.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ─── TAB: PODWYKONAWCY ─── */}
      {activeTab === "subcontractors" && !showAddSubcontractor ? (
        <>
          {subcontractors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-circle-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t("users.subcontractors.empty") || "Keine Subunternehmer"}</Text>
            </View>
          ) : (
            <FlatList
              data={subcontractors}
              renderItem={renderSubcontractor}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
            />
          )}
          {canManageSubs && (
            <View style={styles.fabRow}>
              <TouchableOpacity style={[styles.fab, { backgroundColor: "#8b5cf6" }]} onPress={() => setShowAddSubcontractor(true)}>
                <Ionicons name="person-add" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : activeTab === "subcontractors" && showAddSubcontractor ? (
        <ScrollView style={styles.importContent}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={() => { setShowAddSubcontractor(false); setNewSub({ full_name: "", email: "", phone: "", access_expires_at: "" }); }}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.importTitle}>{t("users.subcontractors.add") || "Subunternehmer hinzufügen"}</Text>
          </View>

          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>{t("users.full_name") || "Vollständiger Name"} *</Text>
            <TextInput style={styles.addUserInput} value={newSub.full_name} onChangeText={(v) => setNewSub({ ...newSub, full_name: v })} placeholder="Max Mustermann" placeholderTextColor="#94a3b8" />
          </View>
          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>Email *</Text>
            <TextInput style={styles.addUserInput} value={newSub.email} onChangeText={(v) => setNewSub({ ...newSub, email: v })} placeholder="jan@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>{t("users.phone") || "Telefon"}</Text>
            <TextInput style={styles.addUserInput} value={newSub.phone} onChangeText={(v) => setNewSub({ ...newSub, phone: v })} placeholder="+48 123 456 789" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
          </View>
          <View style={styles.addUserField}>
            <Text style={styles.addUserLabel}>{t("users.subcontractors.access_until") || "Zugang bis"} *</Text>
            <TextInput style={styles.addUserInput} value={newSub.access_expires_at} onChangeText={(v) => setNewSub({ ...newSub, access_expires_at: v })} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {[30, 60, 90].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#8b5cf610", borderWidth: 1, borderColor: "#8b5cf6" }}
                  onPress={() => {
                    const d = new Date(); d.setDate(d.getDate() + days);
                    setNewSub({ ...newSub, access_expires_at: d.toISOString().split("T")[0] });
                  }}
                >
                  <Text style={{ color: "#8b5cf6", fontWeight: "600", fontSize: 12 }}>{days} {t("users.subcontractors.days") || "Tage"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: "#f5f3ff", borderRadius: 12, padding: 14, marginHorizontal: 16, marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="information-circle" size={20} color="#8b5cf6" />
              <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "600" }}>{t("users.subcontractors.info_title") || "Information"}</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>
              {t("users.subcontractors.info_desc") || "Der Subunternehmer erhält Login und temporäres Passwort. Nach Ablauf des Zugangsdatums kann er sich nicht mehr anmelden. Der Zugang kann jederzeit erneuert werden."}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.createButton, addSubLoading && { opacity: 0.6 }, { backgroundColor: "#8b5cf6", marginHorizontal: 16, marginTop: 16 }]}
            onPress={createSubcontractor}
            disabled={addSubLoading}
          >
            {addSubLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.importButtonText}>{t("users.subcontractors.create") || "Subunternehmer erstellen"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : showAddUser ? (
        <ScrollView style={styles.importContent}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={() => { setShowAddUser(false); setNewUser({ full_name: "", email: "", phone: "", role: "worker" }); }}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.importTitle}>{t("users.add_user") || "Benutzer hinzufügen"}</Text>
          </View>

          <View style={styles.addUserForm}>
            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>{t("users.full_name") || "Vollständiger Name"} *</Text>
              <TextInput
                style={styles.addUserInput}
                value={newUser.full_name}
                onChangeText={(text) => setNewUser({ ...newUser, full_name: text })}
                placeholder="Max Mustermann"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>Email *</Text>
              <TextInput
                style={styles.addUserInput}
                value={newUser.email}
                onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                placeholder="max@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>{t("users.phone") || "Telefon"}</Text>
              <TextInput
                style={styles.addUserInput}
                value={newUser.phone}
                onChangeText={(text) => setNewUser({ ...newUser, phone: text })}
                placeholder="+49 123 456 789"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.addUserField}>
              <Text style={styles.addUserLabel}>{t("users.role") || "Funktion"} *</Text>
              <View style={styles.roleGrid}>
                {roleOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.roleOption,
                      newUser.role === opt.value && styles.roleOptionActive,
                      newUser.role === opt.value && { borderColor: getRoleColor(opt.value) },
                    ]}
                    onPress={() => setNewUser({ ...newUser, role: opt.value })}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={newUser.role === opt.value ? getRoleColor(opt.value) : "#94a3b8"}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        newUser.role === opt.value && { color: getRoleColor(opt.value), fontWeight: "700" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.importButton, addUserLoading && { opacity: 0.6 }]}
              onPress={createUser}
              disabled={addUserLoading}
            >
              {addUserLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.importButtonText}>{t("users.create") || "Benutzer erstellen"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : showImport ? (
        <ScrollView style={styles.importContent}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={() => { setShowImport(false); setImportPreview([]); setImportFileName(""); }}>
              <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.importTitle}>{t("users.import.title")}</Text>
          </View>

          <View style={styles.instructions}>
            <Ionicons name="information-circle" size={24} color="#2563eb" />
            <View style={styles.instructionsText}>
              <Text style={styles.instructionsTitle}>{t("users.import.instructions_title")}</Text>
              <Text style={styles.instructionsBody}>{t("users.import.instructions_body")}</Text>
              <Text style={styles.instructionsExample}>
                Name | Email | Telefon | Funktion{"\n"}
                Max Mustermann | max@example.com | +49 123 456 789 | bauleiter
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={Platform.OS === "web" ? pickFileWeb : pickFileNative}
            disabled={importLoading}
          >
            <Ionicons name="cloud-upload-outline" size={32} color="#2563eb" />
            <Text style={styles.uploadButtonText}>
              {importFileName || t("users.import.select_file")}
            </Text>
            <Text style={styles.uploadButtonHint}>{t("users.import.supported_formats")}</Text>
          </TouchableOpacity>

          {importLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
          )}

          {importPreview.length > 0 && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>
                {t("users.import.preview")} ({importPreview.length})
              </Text>
              {importPreview.map((user, index) => (
                <View key={index} style={styles.previewCard}>
                  <View style={styles.previewRow}>
                    <Ionicons name="person-circle" size={24} color="#2563eb" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewName}>{user.full_name}</Text>
                      {user.email ? <Text style={styles.previewEmail}>{user.email}</Text> : null}
                      {user.phone ? <Text style={styles.previewPhone}>{user.phone}</Text> : null}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(user.role)}20` }]}>
                      <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
                        {t(`common.roles.${user.role}`)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.importButton} onPress={importUsers} disabled={importLoading}>
                <Text style={styles.importButtonText}>{t("users.import.import_all")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          {regularUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>{t("users.empty")}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
            <View style={styles.searchSortBar}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t("users.search_placeholder") || "Nach Name oder E-Mail suchen..."}
                  placeholderTextColor="#94a3b8"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === "name" && styles.sortBtnActive]}
                  onPress={() => { if (sortBy === "name") setSortAsc(!sortAsc); else { setSortBy("name"); setSortAsc(true); } }}
                >
                  <Ionicons name="text" size={14} color={sortBy === "name" ? "#2563eb" : "#64748b"} />
                  <Text style={[styles.sortBtnText, sortBy === "name" && styles.sortBtnTextActive]}>{t("users.full_name")}</Text>
                  {sortBy === "name" && <Ionicons name={sortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortBtn, sortBy === "role" && styles.sortBtnActive]}
                  onPress={() => { if (sortBy === "role") setSortAsc(!sortAsc); else { setSortBy("role"); setSortAsc(true); } }}
                >
                  <Ionicons name="shield" size={14} color={sortBy === "role" ? "#2563eb" : "#64748b"} />
                  <Text style={[styles.sortBtnText, sortBy === "role" && styles.sortBtnTextActive]}>{t("users.role")}</Text>
                  {sortBy === "role" && <Ionicons name={sortAsc ? "arrow-up" : "arrow-down"} size={12} color="#2563eb" />}
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={regularUsers
                .filter((u) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (u.full_name || "").toLowerCase().includes(q) ||
                    (u.email || "").toLowerCase().includes(q) ||
                    t(`common.roles.${u.role}`).toLowerCase().includes(q);
                })
                .sort((a, b) => {
                  let cmp = 0;
                  if (sortBy === "name") {
                    cmp = (a.full_name || "").localeCompare(b.full_name || "");
                  } else {
                    cmp = (a.role || "").localeCompare(b.role || "");
                  }
                  return sortAsc ? cmp : -cmp;
                })}
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#2563eb"
                />
              }
            />
            </View>
          )}

          {canEditUsers && (
            <View style={styles.fabRow}>
              <TouchableOpacity style={[styles.fab, styles.fabSecondary]} onPress={() => setShowImport(true)}>
                <Ionicons name="cloud-upload-outline" size={24} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.fab} onPress={() => setShowAddUser(true)}>
                <Ionicons name="person-add" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 120,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
    flexShrink: 1,
  },
  userEmail: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  contactText: {
    fontSize: 13,
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
  userActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
  },
  deleteButtonText: {
    color: "#ef4444",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    textAlign: "center",
  },
  fabRow: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  fabSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  importContent: {
    flex: 1,
    padding: 16,
  },
  importHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  importTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
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
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  importButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 32,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  addUserForm: {
    gap: 20,
  },
  addUserField: {
    gap: 8,
  },
  addUserLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  addUserInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  roleOptionActive: {
    backgroundColor: "#f8fafc",
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  searchSortBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1e293b",
    paddingVertical: 0,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  sortBtnActive: {
    backgroundColor: "#dbeafe",
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  sortBtnTextActive: {
    color: "#2563eb",
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  tabBtnTextActive: {
    color: "#2563eb",
  },
  createButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
