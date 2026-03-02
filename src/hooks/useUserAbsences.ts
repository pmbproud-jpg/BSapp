/**
 * Hook zarządzający nieobecnościami użytkownika:
 * fetchAbsences, saveAbsence, approveAbsence, rejectAbsence, deleteAbsence,
 * getCalendarDays, kalendarz, formularz.
 * Wydzielony z users/[id].tsx.
 */
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { countWorkdays } from "@/src/utils/helpers";

export function useUserAbsences(
  userId: string | undefined,
  currentUserId: string | undefined,
  t: any,
) {
  const [absences, setAbsences] = useState<any[]>([]);
  const [absCalMonth, setAbsCalMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [absShowForm, setAbsShowForm] = useState(false);
  const [absType, setAbsType] = useState<string>("vacation");
  const [absDateFrom, setAbsDateFrom] = useState("");
  const [absDateTo, setAbsDateTo] = useState("");
  const [absShowFromPicker, setAbsShowFromPicker] = useState(false);
  const [absShowToPicker, setAbsShowToPicker] = useState(false);
  const [absNote, setAbsNote] = useState("");
  const [absSaving, setAbsSaving] = useState(false);
  const [vacationDaysTotal, setVacationDaysTotal] = useState(26);

  const absenceTypes = [
    { key: "vacation", label: t("users.abs_vacation") || "Urlaub", color: "#ef4444" },
    { key: "sick_leave", label: t("users.abs_sick") || "Krankmeldung", color: "#f59e0b" },
    { key: "special_leave", label: t("users.abs_special") || "Sonderurlaub", color: "#8b5cf6" },
    { key: "training", label: t("users.abs_training") || "Schulung", color: "#3b82f6" },
    { key: "unexcused", label: t("users.abs_unexcused") || "Unentschuldigt", color: "#64748b" },
  ];

  const absTypeColor = (type: string) => absenceTypes.find((a) => a.key === type)?.color || "#94a3b8";
  const absTypeLabel = (type: string) => absenceTypes.find((a) => a.key === type)?.label || type;

  const statusLabel = (s: string) => {
    if (s === "pending") return t("users.abs_pending") || "Ausstehend";
    if (s === "approved") return t("users.abs_approved") || "Genehmigt";
    if (s === "rejected") return t("users.abs_rejected") || "Abgelehnt";
    return s;
  };
  const statusColor = (s: string) => s === "approved" ? "#10b981" : s === "rejected" ? "#ef4444" : "#f59e0b";

  const usedVacationDays = absences
    .filter((a: any) => a.type === "vacation" && a.status !== "rejected")
    .reduce((sum: number, a: any) => sum + (a.days || 0), 0);

  const fetchAbsences = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await (supabaseAdmin.from("user_absences") as any)
        .select("*, approver:profiles!user_absences_approved_by_fkey(full_name)")
        .eq("user_id", userId)
        .order("date_from", { ascending: false });
      setAbsences(data || []);
    } catch (e) {
      console.error("Error fetching absences:", e);
      setAbsences([]);
    }
  }, [userId]);

  const saveAbsence = async () => {
    if (!userId || !absDateFrom || !absDateTo) {
      const msg = t("users.abs_dates_required") || "Bitte Datum angeben";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    if (absDateFrom > absDateTo) {
      const msg = t("users.abs_invalid_range") || "Startdatum muss vor Enddatum liegen";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
      return;
    }
    setAbsSaving(true);
    try {
      const days = countWorkdays(absDateFrom, absDateTo);
      const isSickLeave = absType === "sick_leave";
      await (supabaseAdmin.from("user_absences") as any).insert({
        user_id: userId,
        type: absType,
        date_from: absDateFrom,
        date_to: absDateTo,
        days,
        note: absNote.trim() || null,
        status: isSickLeave ? "approved" : "pending",
        approved_by: isSickLeave ? currentUserId : null,
        approved_at: isSickLeave ? new Date().toISOString() : null,
      });
      setAbsShowForm(false);
      setAbsDateFrom(""); setAbsDateTo(""); setAbsNote(""); setAbsType("vacation");
      fetchAbsences();
      const msg = isSickLeave
        ? (t("users.abs_saved_approved") || "Abwesenheit eingetragen und genehmigt")
        : (t("users.abs_saved_pending") || "Antrag eingereicht — wartet auf Genehmigung");
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message || "Error");
    } finally { setAbsSaving(false); }
  };

  const approveAbsence = async (absId: string) => {
    try {
      await (supabaseAdmin.from("user_absences") as any)
        .update({ status: "approved", approved_by: currentUserId, approved_at: new Date().toISOString() })
        .eq("id", absId);
      fetchAbsences();
      const msg = t("users.abs_approved") || "Genehmigt";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message);
    }
  };

  const rejectAbsence = async (absId: string) => {
    try {
      await (supabaseAdmin.from("user_absences") as any)
        .update({ status: "rejected", approved_by: currentUserId, approved_at: new Date().toISOString() })
        .eq("id", absId);
      fetchAbsences();
      const msg = t("users.abs_rejected") || "Abgelehnt";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.success"), msg);
    } catch (e: any) {
      Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message);
    }
  };

  const deleteAbsence = async (absId: string) => {
    const confirmMsg = t("users.abs_delete_confirm") || "Abwesenheit löschen?";
    const doDelete = async () => {
      try {
        await (supabaseAdmin.from("user_absences") as any).delete().eq("id", absId);
        fetchAbsences();
      } catch (e: any) {
        Platform.OS === "web" ? window.alert(e?.message || "Error") : Alert.alert(t("common.error"), e?.message);
      }
    };
    if (Platform.OS === "web") { if (window.confirm(confirmMsg)) doDelete(); }
    else Alert.alert(t("common.confirm"), confirmMsg, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: doDelete }]);
  };

  // Calendar helper: get days in month with absence markers
  const getCalendarDays = (monthStr: string) => {
    const [y, m] = monthStr.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday=0
    const days: { day: number; date: string; absences: any[] }[] = [];
    for (let i = 0; i < startDow; i++) days.push({ day: 0, date: "", absences: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayAbs = absences.filter((a: any) => a.status !== "rejected" && dateStr >= a.date_from && dateStr <= a.date_to);
      days.push({ day: d, date: dateStr, absences: dayAbs });
    }
    return days;
  };

  return {
    absences, absCalMonth, setAbsCalMonth,
    absShowForm, setAbsShowForm,
    absType, setAbsType,
    absDateFrom, setAbsDateFrom,
    absDateTo, setAbsDateTo,
    absShowFromPicker, setAbsShowFromPicker,
    absShowToPicker, setAbsShowToPicker,
    absNote, setAbsNote,
    absSaving,
    vacationDaysTotal, setVacationDaysTotal,
    absenceTypes, absTypeColor, absTypeLabel,
    statusLabel, statusColor,
    usedVacationDays,
    fetchAbsences, saveAbsence, approveAbsence, rejectAbsence, deleteAbsence,
    getCalendarDays,
  };
}
