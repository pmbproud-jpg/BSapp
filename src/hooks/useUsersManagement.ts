/**
 * Hook zarządzający operacjami CRUD na użytkownikach.
 * Wydzielony z users/index.tsx.
 */

import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { supabase } from "@/src/lib/supabase/client";
import { sendPasswordEmail } from "@/src/lib/sendEmail";
import { isValidEmail } from "@/src/utils/helpers";
import * as XLSX from "xlsx";

interface ImportedUser {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

export function useUsersManagement(
  profile: any,
  t: any,
  fetchUsers: () => Promise<void>,
  defaultPassword?: string | null,
) {
  // ─── Add User ───
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", phone: "", role: "worker" as string });

  // ─── Subcontractor ───
  const [showAddSubcontractor, setShowAddSubcontractor] = useState(false);
  const [addSubLoading, setAddSubLoading] = useState(false);
  const [newSub, setNewSub] = useState({ full_name: "", email: "", phone: "", access_expires_at: "" });

  // ─── Import ───
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportedUser[]>([]);
  const [importFileName, setImportFileName] = useState("");

  const createUser = async () => {
    if (!newUser.full_name.trim()) {
      const msg = t("users.name_required") || "Vollständiger Name ist erforderlich";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    if (!newUser.email.trim() || !isValidEmail(newUser.email)) {
      const msg = t("users.email_required") || "Bitte gültige E-Mail eingeben";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    setAddUserLoading(true);
    try {
      const tempPassword = defaultPassword || `Temp${Date.now()}!`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newUser.email.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: newUser.full_name.trim(), phone: newUser.phone.trim() || "" },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("User not created");

      await new Promise((r) => setTimeout(r, 1500));

      const { error: profileError } = await supabaseAdmin.from("profiles")
        .update({
          full_name: newUser.full_name.trim(),
          phone: newUser.phone.trim() || null,
          role: newUser.role,
          company_id: profile?.company_id,
        })
        .eq("id", authData.user.id);

      if (profileError) console.error("Profile update error:", profileError);

      setNewUser({ full_name: "", email: "", phone: "", role: "worker" });
      setShowAddUser(false);
      fetchUsers();

      const msg = t("users.created_success") || "Benutzer erfolgreich erstellt";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (error: any) {
      console.error("Error creating user:", error);
      const msg = error?.message || t("users.create_error") || "Fehler beim Erstellen des Benutzers";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    } finally {
      setAddUserLoading(false);
    }
  };

  const createSubcontractor = async () => {
    if (!newSub.full_name.trim()) {
      const msg = t("users.name_required") || "Vollständiger Name ist erforderlich";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    if (!newSub.email.trim() || !isValidEmail(newSub.email)) {
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
      const tempPassword = defaultPassword || `Sub${Date.now()}!`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newSub.email.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: newSub.full_name.trim(), phone: newSub.phone.trim() || "" },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("User not created");

      await new Promise((r) => setTimeout(r, 1500));

      const { error: profileError } = await supabaseAdmin.from("profiles")
        .update({
          full_name: newSub.full_name.trim(),
          phone: newSub.phone.trim() || null,
          role: "subcontractor",
          company_id: profile?.company_id,
          access_expires_at: newSub.access_expires_at,
        })
        .eq("id", authData.user.id);

      if (profileError) console.error("Profile update error:", profileError);

      const savedEmail = newSub.email.trim();
      const savedExpiry = newSub.access_expires_at;
      setNewSub({ full_name: "", email: "", phone: "", access_expires_at: "" });
      setShowAddSubcontractor(false);
      fetchUsers();

      const msg = `${t("users.subcontractors.created_success") || "Subunternehmer erstellt"}\n\nLogin: ${savedEmail}\n${t("users.subcontractors.temp_password") || "Temporäres Passwort"}: ${tempPassword}\n${t("users.subcontractors.expires") || "Läuft ab"}: ${savedExpiry}`;
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
      const { error } = await supabaseAdmin.from("profiles")
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

  const sendInviteLink = async (userEmail: string, userName: string) => {
    try {
      const redirectUrl = `${process.env.EXPO_PUBLIC_APP_URL || "https://bsapp-management.netlify.app"}/reset-password`;

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

      const emailResult = await sendPasswordEmail(userEmail, userName, actionLink);

      if (emailResult.success) {
        const msg = `✅ E-Mail mit Passwort-Link wurde an ${userEmail} gesendet.`;
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      } else {
        console.warn("Email send failed:", emailResult.error);
        const msg = `⚠️ E-Mail konnte nicht gesendet werden.\n\nLink wurde generiert — bitte manuell weiterleiten.`;
        if (Platform.OS === "web") {
          await navigator.clipboard.writeText(actionLink).catch(() => {});
          window.alert(`${msg}\n\nLink wurde in die Zwischenablage kopiert.`);
        } else {
          Alert.alert("Info", msg, [
            {
              text: "Link teilen",
              onPress: () => {
                const { Share: NativeShare } = require("react-native");
                NativeShare.share({ message: `Passwort erstellen für BSapp:\n${actionLink}` }).catch(() => {});
              },
            },
            { text: "OK" },
          ]);
        }
      }
    } catch (error: any) {
      console.error("Error sending invite:", error);
      const msg = error?.message || t("common.error");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    }
  };

  const deleteUser = async (userId: string) => {
    const doDelete = async () => {
      try {
        const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
        if (profileError) console.error("Profile delete error:", profileError);

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        fetchUsers();
        const msg = t("users.deleted_success") || "Benutzer gelöscht";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      } catch (error: any) {
        console.error("Error deleting user:", error);
        const msg = error?.message || t("users.delete_error") || "Fehler beim Löschen des Benutzers";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(t("users.delete_confirm_message") || "Möchten Sie diesen Benutzer wirklich löschen?")) doDelete();
    } else {
      Alert.alert(
        t("users.delete_confirm_title") || "Benutzer löschen",
        t("users.delete_confirm_message") || "Möchten Sie diesen Benutzer wirklich löschen?",
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.delete"), style: "destructive", onPress: doDelete },
        ],
      );
    }
  };

  // ─── Import Excel ───
  const processWorkbook = (workbook: XLSX.WorkBook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const nonEmptyRows = allRows.filter((row) => row.some((cell: any) => cell != null && String(cell).trim() !== ""));

    if (nonEmptyRows.length === 0) {
      setImportLoading(false);
      const msg = t("users.import.no_valid_data");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    const isEmailCheck = (v: any) => isValidEmail(String(v));
    const isPhone = (v: any) => /^\+?\d[\d\s\-]{5,}$/.test(String(v).trim());
    const isRole = (v: any) => {
      const roles = ["admin", "management", "project_manager", "bauleiter", "worker", "office_worker", "logistics", "purchasing", "bl", "pm"];
      return roles.includes(String(v).trim().toLowerCase());
    };
    const isHeaderName = (v: any) =>
      /^(imi|nazw|name|email|e-mail|mail|tel|phone|handy|mobil|rola|role|funkcja|position|stanowisko|vorname|nachname)/i.test(String(v).trim());

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
      let full_name = ""; let email = ""; let phone = ""; let role = "worker";

      if (headerMap) {
        if (nameCol != null) full_name = cells[nameCol] || "";
        if (emailCol != null) email = cells[emailCol] || "";
        if (phoneCol != null) phone = cells[phoneCol] || "";
        if (roleCol != null) { const rv = cells[roleCol].toLowerCase(); role = roleMap[rv] || rv; }
      }

      if (!full_name || !email) {
        for (let i = 0; i < cells.length; i++) {
          const v = cells[i];
          if (!v) continue;
          if (!email && isEmailCheck(v)) { email = v; continue; }
          if (!phone && isPhone(v)) { phone = v; continue; }
          if (!role || role === "worker") { if (isRole(v)) { const rv = v.toLowerCase(); role = roleMap[rv] || rv; continue; } }
          if (!full_name && v.length > 1 && !isEmailCheck(v) && !isPhone(v) && !isRole(v)) { full_name = v; }
        }
      }

      if (!validRoles.includes(role)) role = "worker";
      return { full_name, email, phone, role };
    });

    const validUsers = importedUsers.filter((u) => u.full_name.length > 0);

    if (validUsers.length === 0) {
      setImportLoading(false);
      const msg = t("users.import.no_valid_data");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    setImportPreview(validUsers);
    setImportLoading(false);
  };

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
      reader.onerror = () => { window.alert(t("users.import.parse_error")); setImportLoading(false); };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const pickFileNative = async () => {
    try {
      const DocumentPicker = require("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setImportFileName(asset.name);
      setImportLoading(true);
      const FileSystem = require("expo-file-system");
      const fileContent = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = XLSX.read(fileContent, { type: "base64" });
      processWorkbook(workbook);
    } catch (error) {
      console.error("Error picking/parsing file:", error);
      Alert.alert(t("common.error"), t("users.import.parse_error"));
      setImportLoading(false);
    }
  };

  const importUsers = async () => {
    if (importPreview.length === 0) return;
    const usersWithEmail = importPreview.filter((u) => u.email.length > 0);
    const skippedNoEmail = importPreview.length - usersWithEmail.length;

    if (usersWithEmail.length === 0) {
      const msg = t("users.import.no_valid_data") + (skippedNoEmail > 0 ? `\n(${skippedNoEmail} ohne E-Mail)` : "");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    setImportLoading(true);
    try {
      const createdUsers: string[] = [];
      const errors: string[] = [];

      for (const user of usersWithEmail) {
        try {
          const tempPassword = defaultPassword || `Temp${Math.random().toString(36).slice(2)}!`;
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: user.email, password: tempPassword, email_confirm: true,
            user_metadata: { full_name: user.full_name, phone: user.phone || "" },
          });
          if (authError) throw authError;
          if (!authData.user) throw new Error("User not created");
          createdUsers.push(user.email);
        } catch (error: any) {
          console.error(`Error creating user ${user.email}:`, error);
          errors.push(`${user.email}: ${error.message}`);
        }
      }

      if (createdUsers.length > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        for (const user of usersWithEmail) {
          try {
            const { data: profileData } = await (supabase.from("profiles") as any).select("id").eq("email", user.email).maybeSingle();
            if (profileData) {
              await supabaseAdmin.from("profiles")
                .update({ full_name: user.full_name, phone: user.phone || null, role: user.role, company_id: profile?.company_id })
                .eq("id", profileData.id);
            }
          } catch (err) { console.error(`Error updating profile for ${user.email}:`, err); }
        }
      }

      const successMsg = `${createdUsers.length} Benutzer importiert` + (skippedNoEmail > 0 ? ` (${skippedNoEmail} übersprungen - keine E-Mail)` : "");

      if (createdUsers.length > 0) {
        Platform.OS === "web" ? window.alert(successMsg) : Alert.alert(t("common.success"), successMsg);
        setImportPreview([]); setImportFileName(""); setShowImport(false);
        fetchUsers();
      }

      if (errors.length > 0) {
        const errMsg = t("users.import.partial_error") + "\n\n" + errors.slice(0, 3).join("\n");
        Platform.OS === "web" ? window.alert(errMsg) : Alert.alert(t("common.error"), errMsg);
      }
    } catch (error: any) {
      console.error("Error importing users:", error);
      Platform.OS === "web" ? window.alert(t("users.import.error")) : Alert.alert(t("common.error"), t("users.import.error"));
    } finally {
      setImportLoading(false);
    }
  };

  const resetUserPassword = async (userId: string) => {
    if (!defaultPassword) {
      const msg = t("settings.no_default_pw", "Najpierw ustaw domyślne hasło w Admin → Hasła");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    const doReset = async () => {
      try {
        const { error } = await supabaseAdmin.auth.admin.updateUser(userId, { password: defaultPassword });
        if (error) throw error;
        const msg = t("settings.reset_pw_success", "Hasło zostało zresetowane do domyślnego");
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
      } catch (error: any) {
        console.error("Error resetting password:", error);
        const msg = error?.message || t("common.error");
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(t("settings.reset_pw_confirm", "Czy na pewno chcesz zresetować hasło tego użytkownika do domyślnego?"))) doReset();
    } else {
      Alert.alert(
        t("settings.reset_password", "Reset hasła"),
        t("settings.reset_pw_confirm", "Czy na pewno chcesz zresetować hasło tego użytkownika do domyślnego?"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("settings.reset_password", "Reset"), style: "destructive", onPress: doReset },
        ],
      );
    }
  };

  const resetAllUsersPasswords = async (users: { id: string; role: string }[]) => {
    if (!defaultPassword) {
      const msg = t("settings.no_default_pw", "Najpierw ustaw domyślne hasło w Admin → Hasła");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }

    const nonAdmins = users.filter(u => u.role !== "admin");
    if (nonAdmins.length === 0) {
      const msg = t("settings.no_users_to_reset", "Brak użytkowników do zresetowania");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.info", "Info"), msg);
      return;
    }

    const doResetAll = async () => {
      let success = 0;
      let errors = 0;
      for (const user of nonAdmins) {
        try {
          const { error } = await supabaseAdmin.auth.admin.updateUser(user.id, { password: defaultPassword });
          if (error) throw error;
          success++;
        } catch {
          errors++;
        }
      }
      const msg = t("settings.reset_all_result", "Zresetowano: {{success}}, błędy: {{errors}}")
        .replace("{{success}}", String(success))
        .replace("{{errors}}", String(errors));
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    };

    const confirmMsg = t("settings.reset_all_confirm", "Czy na pewno chcesz zresetować hasła {{count}} użytkowników? Administratorzy zostaną pominięci.")
      .replace("{{count}}", String(nonAdmins.length));

    if (Platform.OS === "web") {
      if (window.confirm(confirmMsg)) doResetAll();
    } else {
      Alert.alert(
        t("settings.reset_all_passwords", "Reset wszystkich haseł"),
        confirmMsg,
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("settings.reset_password", "Reset"), style: "destructive", onPress: doResetAll },
        ],
      );
    }
  };

  return {
    // Add user
    showAddUser, setShowAddUser, addUserLoading, newUser, setNewUser, createUser,
    // Subcontractor
    showAddSubcontractor, setShowAddSubcontractor, addSubLoading, newSub, setNewSub,
    createSubcontractor, renewAccess,
    // Import
    showImport, setShowImport, importLoading, importPreview, setImportPreview, importFileName, setImportFileName,
    pickFileWeb, pickFileNative, importUsers,
    // Actions
    sendInviteLink, deleteUser, resetUserPassword, resetAllUsersPasswords,
  };
}
