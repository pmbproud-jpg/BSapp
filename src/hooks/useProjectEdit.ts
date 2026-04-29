/**
 * Hook zarządzający edycją projektu: formularz, zapis.
 * Wydzielony z projects/[id].tsx.
 *
 * Faza 3 commit 7: migracja saveEditProject na useMutation.
 * - 1 useMutation: saveEditProject (update projektu + opcjonalny upsert PM/BL do members)
 * - fetchAllUsers pozostaje imperative -- one-shot lazy load przy otwarciu modala,
 *   nie warto plodzic useQuery dla jednorazowego pobrania.
 *
 * onSuccess: invalidate projectKeys.details + projectMembersKey + fallback fetchAll().
 * fetchAll() jako fallback jeśli Realtime nie jest aktywny na danej tabeli.
 */

import { useState } from "react";
import { Alert } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database } from "@/src/lib/supabase/database.types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { isValidDate } from "@/src/utils/helpers";
import { projectKeys } from "./useProjectData";
import { projectMembersKey } from "./useProjectMembers";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
// useProjectEdit używa tylko user_id z listy członków (sprawdzenie obecności PM/BL w zespole),
// więc sygnatura przyjmuje minimalny subset. Kompatybilne z typem ProjectMember z useProjectMembers.
type ProjectMemberLite = { user_id: string };
type ProfileLite = Pick<Profile, "id" | "full_name" | "email" | "role">;

type EditForm = {
  name: string;
  description: string;
  location: string;
  status: string;
  budget: string;
  start_date: string;
  end_date: string;
  project_manager_id: string;
  bauleiter_id: string;
};

export function useProjectEdit(
  projectId: string | undefined,
  profile: Profile | null,
  project: Project | null,
  members: ProjectMemberLite[],
  t: TFunction,
  fetchAll: () => Promise<void>,
) {
  const qc = useQueryClient();
  const safeId = projectId ?? "";

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", description: "", location: "", status: "planning",
    budget: "", start_date: "", end_date: "",
    project_manager_id: "", bauleiter_id: "",
  });
  const [allUsers, setAllUsers] = useState<ProfileLite[]>([]);
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
      setAllUsers(((data ?? []) as ProfileLite[]));
    } catch (e) { console.error("Error fetching all users:", e); }
  };

  const openEditProject = async () => {
    if (!project) return;
    setEditForm({
      name: project.name || "",
      description: project.description || "",
      location: project.location || "",
      status: project.status || "planning",
      budget: project.budget ? String(project.budget) : "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      project_manager_id: project.project_manager_id || "",
      bauleiter_id: project.bauleiter_id || "",
    });
    try {
      const { data } = await supabaseAdmin.from("profiles")
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id ?? "")
        .order("full_name");
      setAllUsers(((data ?? []) as ProfileLite[]));
    } catch (e) { console.error(e); }
    setShowEditModal(true);
  };

  // ── Mutation: zapis edycji projektu ──
  const saveProjectMutation = useMutation({
    mutationFn: async (form: EditForm) => {
      let blId = form.bauleiter_id || null;

      // Jesli PM jest ustawiony a BL nie -- szukaj BL automatycznie w zespole
      if (form.project_manager_id && !blId) {
        const memberIds = members.map((m) => m.user_id);
        if (memberIds.length > 0) {
          const { data: memberProfiles } = await supabaseAdmin.from("profiles")
            .select("id, role")
            .in("id", memberIds);
          const blUser = ((memberProfiles ?? []) as Pick<Profile, "id" | "role">[]).find((p) => p.role === "bauleiter");
          if (blUser) blId = blUser.id;
        }
      }

      const updateData: Database["public"]["Tables"]["projects"]["Update"] = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        status: form.status as Project["status"],
        project_manager_id: form.project_manager_id || null,
        bauleiter_id: blId,
        start_date: form.start_date && isValidDate(form.start_date) ? form.start_date : null,
        end_date: form.end_date && isValidDate(form.end_date) ? form.end_date : null,
      };
      if (form.budget) {
        const budgetNum = parseFloat(form.budget);
        updateData.budget = isNaN(budgetNum) || budgetNum < 0 ? null : budgetNum;
      } else {
        updateData.budget = null;
      }

      // Jesli PM jest ustawiony, dodaj go do zespolu jesli jeszcze nie jest
      if (form.project_manager_id) {
        const pmInTeam = members.some((m) => m.user_id === form.project_manager_id);
        if (!pmInTeam) {
          await supabaseAdmin.from("project_members")
            .upsert({ project_id: safeId, user_id: form.project_manager_id, role: "member" }, { onConflict: "project_id,user_id" });
        }
      }
      // Jesli BL jest ustawiony, dodaj go do zespolu jesli jeszcze nie jest
      if (blId) {
        const blInTeam = members.some((m) => m.user_id === blId);
        if (!blInTeam) {
          await supabaseAdmin.from("project_members")
            .upsert({ project_id: safeId, user_id: blId, role: "member" }, { onConflict: "project_id,user_id" });
        }
      }

      const { error } = await supabaseAdmin.from("projects").update(updateData).eq("id", safeId);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowEditModal(false);
      // Invalidate konkretnych kluczy (project details + members -- bo PM/BL upsert)
      qc.invalidateQueries({ queryKey: projectKeys.details(safeId) });
      qc.invalidateQueries({ queryKey: projectMembersKey(safeId) });
      // Fallback fetchAll() -- na wypadek gdy Realtime nie jest wlaczony na 'projects' lub 'project_members'.
      // Po pelnej migracji Realtime mozna usunac.
      fetchAll();
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      Alert.alert(t("common.error"), t("projects.update_error"));
    },
  });

  const saveEditProject = () => {
    if (!editForm.name.trim()) {
      Alert.alert(t("common.error"), t("projects.name_required"));
      return;
    }
    saveProjectMutation.mutate(editForm);
  };

  return {
    showEditModal, setShowEditModal,
    editForm, setEditForm,
    editSaving: saveProjectMutation.isPending,
    allUsers,
    showPMPicker, setShowPMPicker,
    showBLPicker, setShowBLPicker,
    fetchAllUsers,
    openEditProject,
    saveEditProject,
  };
}
