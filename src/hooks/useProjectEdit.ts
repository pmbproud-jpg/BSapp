/**
 * Hook zarządzający edycją projektu: formularz, zapis.
 * Wydzielony z projects/[id].tsx.
 */

import { useState } from "react";
import { Alert } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database } from "@/src/lib/supabase/database.types";
import { isValidDate } from "@/src/utils/helpers";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export function useProjectEdit(
  projectId: string | undefined,
  profile: any,
  project: Project | null,
  members: any[],
  t: any,
  fetchAll: () => Promise<void>,
) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", description: "", location: "", status: "planning",
    budget: "", start_date: "", end_date: "",
    project_manager_id: "", bauleiter_id: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showPMPicker, setShowPMPicker] = useState(false);
  const [showBLPicker, setShowBLPicker] = useState(false);

  const fetchAllUsers = async () => {
    try {
      let query = supabaseAdmin.from("profiles")
        .select("id, full_name, email, role")
        .order("full_name");
      if (profile?.company_id) {
        query = query.eq("company_id", profile.company_id);
      }
      const { data } = await query;
      setAllUsers(data || []);
    } catch (e) { console.error("Error fetching all users:", e); }
  };

  const openEditProject = async () => {
    if (!project) return;
    const proj: any = project;
    setEditForm({
      name: project.name || "",
      description: project.description || "",
      location: project.location || "",
      status: project.status || "planning",
      budget: project.budget ? String(project.budget) : "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      project_manager_id: proj.project_manager_id || "",
      bauleiter_id: proj.bauleiter_id || "",
    });
    try {
      const { data } = await supabaseAdmin.from("profiles")
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id)
        .order("full_name");
      setAllUsers(data || []);
    } catch (e) { console.error(e); }
    setShowEditModal(true);
  };

  const saveEditProject = async () => {
    if (!editForm.name.trim()) {
      Alert.alert(t("common.error"), t("projects.name_required"));
      return;
    }
    setEditSaving(true);
    try {
      let blId = editForm.bauleiter_id || null;

      // Jeśli PM jest ustawiony a BL nie — szukaj BL automatycznie w zespole
      if (editForm.project_manager_id && !blId) {
        const memberIds = members.map((m: any) => m.user_id);
        if (memberIds.length > 0) {
          const { data: memberProfiles } = await supabaseAdmin.from("profiles")
            .select("id, role")
            .in("id", memberIds);
          const blUser = (memberProfiles || []).find((p: any) => p.role === "bauleiter");
          if (blUser) blId = blUser.id;
        }
      }

      const updateData: any = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        location: editForm.location.trim() || null,
        status: editForm.status,
        project_manager_id: editForm.project_manager_id || null,
        bauleiter_id: blId,
        start_date: editForm.start_date && isValidDate(editForm.start_date) ? editForm.start_date : null,
        end_date: editForm.end_date && isValidDate(editForm.end_date) ? editForm.end_date : null,
      };
      if (editForm.budget) {
        const budgetNum = parseFloat(editForm.budget);
        updateData.budget = isNaN(budgetNum) || budgetNum < 0 ? null : budgetNum;
      } else {
        updateData.budget = null;
      }

      // Jeśli PM jest ustawiony, dodaj go do zespołu jeśli jeszcze nie jest
      if (editForm.project_manager_id) {
        const pmInTeam = members.some((m: any) => m.user_id === editForm.project_manager_id);
        if (!pmInTeam) {
          await supabaseAdmin.from("project_members")
            .upsert({ project_id: projectId!, user_id: editForm.project_manager_id, role: "member" }, { onConflict: "project_id,user_id" });
        }
      }
      // Jeśli BL jest ustawiony, dodaj go do zespołu jeśli jeszcze nie jest
      if (blId) {
        const blInTeam = members.some((m: any) => m.user_id === blId);
        if (!blInTeam) {
          await supabaseAdmin.from("project_members")
            .upsert({ project_id: projectId!, user_id: blId, role: "member" }, { onConflict: "project_id,user_id" });
        }
      }

      const { error } = await supabaseAdmin.from("projects")
        .update(updateData)
        .eq("id", projectId!);
      if (error) throw error;
      setShowEditModal(false);
      fetchAll();
    } catch (error) {
      console.error("Error updating project:", error);
      Alert.alert(t("common.error"), t("projects.update_error"));
    } finally {
      setEditSaving(false);
    }
  };

  return {
    showEditModal, setShowEditModal,
    editForm, setEditForm,
    editSaving,
    allUsers,
    showPMPicker, setShowPMPicker,
    showBLPicker, setShowBLPicker,
    fetchAllUsers,
    openEditProject,
    saveEditProject,
  };
}
