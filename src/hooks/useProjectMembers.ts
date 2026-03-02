/**
 * Hook zarządzający członkami projektu: lista, dodawanie, usuwanie.
 * Wydzielony z projects/[id].tsx.
 */

import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database } from "@/src/lib/supabase/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectMember = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { full_name: string | null; email: string; role: string };
};

export function useProjectMembers(
  projectId: string | undefined,
  profile: any,
  project: Project | null,
  t: any,
  sendNotification: any,
  fetchAll: () => Promise<void>,
) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data, error } = await (supabaseAdmin.from("project_members") as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      // Pobierz profile członków
      const membersWithProfiles = await Promise.all(
        (data || []).map(async (m: any) => {
          const { data: prof } = await (supabaseAdmin.from("profiles") as any)
            .select("full_name, email, role")
            .eq("id", m.user_id)
            .single();
          return { ...m, profile: prof };
        })
      );
      setMembers(membersWithProfiles);
      return membersWithProfiles;
    } catch (error) {
      console.error("Error fetching members:", error);
      return [];
    }
  };

  const addMember = async (userId: string) => {
    try {
      const { error } = await (supabaseAdmin.from("project_members") as any)
        .insert({ project_id: projectId!, user_id: userId, role: "member" });
      if (error) throw error;

      // Sprawdź rolę dodawanego użytkownika i automatycznie ustaw PM/BL w projekcie
      const { data: addedUser } = await (supabaseAdmin.from("profiles") as any)
        .select("id, role, full_name, email")
        .eq("id", userId)
        .single();

      if (addedUser) {
        const updateData: any = {};

        if (addedUser.role === "project_manager") {
          updateData.project_manager_id = userId;
          const currentMembers = [...members, { user_id: userId, profile: addedUser }];
          const { data: memberProfiles } = await (supabaseAdmin.from("profiles") as any)
            .select("id, role")
            .in("id", currentMembers.map((m: any) => m.user_id));
          const blUser = (memberProfiles || []).find((p: any) => p.role === "bauleiter");
          if (blUser) updateData.bauleiter_id = blUser.id;
        }

        if (addedUser.role === "bauleiter") {
          updateData.bauleiter_id = userId;
          const proj: any = project;
          if (!proj?.project_manager_id) {
            const currentMembers = [...members, { user_id: userId, profile: addedUser }];
            const { data: memberProfiles } = await (supabaseAdmin.from("profiles") as any)
              .select("id, role")
              .in("id", currentMembers.map((m: any) => m.user_id));
            const pmUser = (memberProfiles || []).find((p: any) => p.role === "project_manager");
            if (pmUser) updateData.project_manager_id = pmUser.id;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await (supabaseAdmin.from("projects") as any)
            .update(updateData)
            .eq("id", projectId!);
        }
      }

      // Wyślij powiadomienie do dodanego użytkownika
      if (userId !== profile?.id) {
        const projName = project?.name || "";
        const title = t("notifications.project_member_title", "Nowy przydział do projektu");
        const body = `${t("notifications.project_member_body", "Zostałeś dodany do projektu")}: ${projName}`;
        sendNotification(userId, title, body, "project_member", { project_id: projectId, project_name: projName });
      }

      setShowAddMember(false);
      fetchAll();
    } catch (error: any) {
      console.error("Error adding member:", error);
      const msg = error.code === "23505" ? t("projects.member_already_exists") : t("common.error");
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert(t("common.error"), msg);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(`${t("projects.remove_member_confirm")} ${memberName}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            t("projects.remove_member_title"),
            `${t("projects.remove_member_confirm")} ${memberName}?`,
            [
              { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
              { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });
    if (!confirmed) return;

    try {
      const { error } = await (supabaseAdmin.from("project_members") as any)
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  const openAddMemberModal = async () => {
    setUsersLoading(true);
    setShowAddMember(true);
    try {
      const { data, error } = await (supabaseAdmin.from("profiles") as any)
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id)
        .order("full_name");
      if (error) throw error;
      const memberIds = members.map((m) => m.user_id);
      setAvailableUsers((data || []).filter((u: any) => !memberIds.includes(u.id)));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  return {
    members, setMembers,
    showAddMember, setShowAddMember,
    availableUsers,
    usersLoading,
    fetchMembers,
    addMember,
    removeMember,
    openAddMemberModal,
  };
}
