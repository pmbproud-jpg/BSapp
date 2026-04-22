/**
 * Hook zarządzający członkami projektu: lista, dodawanie, usuwanie.
 * Wydzielony z projects/[id].tsx.
 */

import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database, Json } from "@/src/lib/supabase/database.types";
import type { TFunction } from "i18next";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileLite = Pick<Profile, "id" | "full_name" | "email" | "role">;
type ProjectMember = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { full_name: string | null; email: string; role: string };
};

type NotificationData = Record<string, Json | undefined>;
type SendNotificationFn = (
  userId: string,
  title: string,
  body: string,
  type?: string,
  data?: NotificationData,
) => Promise<void>;
type ProfileLike = { id?: string; company_id?: string | null };

export function useProjectMembers(
  projectId: string | undefined,
  profile: ProfileLike | null,
  project: Project | null,
  t: TFunction,
  sendNotification: SendNotificationFn,
  fetchAll: () => Promise<void>,
) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<ProfileLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabaseAdmin.from("project_members")
        .select("*")
        .eq("project_id", projectId!)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      // Pobierz profile członków jednym batch query (zamiast N+1)
      const rows = (data ?? []) as ProjectMember[];
      const userIds = rows.map((m) => m.user_id);
      const { data: profiles } = userIds.length > 0
        ? await supabaseAdmin.from("profiles")
            .select("id, full_name, email, role")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map(((profiles ?? []) as ProfileLite[]).map((p) => [p.id, p]));
      const membersWithProfiles: ProjectMember[] = rows.map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id)
          ? { full_name: profileMap.get(m.user_id)!.full_name, email: profileMap.get(m.user_id)!.email, role: profileMap.get(m.user_id)!.role }
          : undefined,
      }));
      setMembers(membersWithProfiles);
      return membersWithProfiles;
    } catch (error) {
      console.error("Error fetching members:", error);
      return [];
    }
  };

  const addMember = async (userId: string) => {
    try {
      const { error } = await supabaseAdmin.from("project_members")
        .insert({ project_id: projectId!, user_id: userId, role: "member" });
      if (error) throw error;

      // Sprawdź rolę dodawanego użytkownika i automatycznie ustaw PM/BL w projekcie
      const { data: addedUser } = await supabaseAdmin.from("profiles")
        .select("id, role, full_name, email")
        .eq("id", userId)
        .single();

      if (addedUser) {
        const updateData: Database["public"]["Tables"]["projects"]["Update"] = {};

        if (addedUser.role === "project_manager") {
          updateData.project_manager_id = userId;
          const currentMemberIds = [...members.map((m) => m.user_id), userId];
          const { data: memberProfiles } = await supabaseAdmin.from("profiles")
            .select("id, role")
            .in("id", currentMemberIds);
          const blUser = ((memberProfiles ?? []) as Pick<Profile, "id" | "role">[]).find((p) => p.role === "bauleiter");
          if (blUser) updateData.bauleiter_id = blUser.id;
        }

        if (addedUser.role === "bauleiter") {
          updateData.bauleiter_id = userId;
          if (!project?.project_manager_id) {
            const currentMemberIds = [...members.map((m) => m.user_id), userId];
            const { data: memberProfiles } = await supabaseAdmin.from("profiles")
              .select("id, role")
              .in("id", currentMemberIds);
            const pmUser = ((memberProfiles ?? []) as Pick<Profile, "id" | "role">[]).find((p) => p.role === "project_manager");
            if (pmUser) updateData.project_manager_id = pmUser.id;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin.from("projects")
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
    } catch (error: unknown) {
      console.error("Error adding member:", error);
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
      const msg = code === "23505" ? t("projects.member_already_exists") : t("common.error");
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
      const { error } = await supabaseAdmin.from("project_members")
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
      const { data, error } = await supabaseAdmin.from("profiles")
        .select("id, full_name, email, role")
        .eq("company_id", profile?.company_id ?? "")
        .order("full_name");
      if (error) throw error;
      const memberIds = members.map((m) => m.user_id);
      setAvailableUsers(((data ?? []) as ProfileLite[]).filter((u) => !memberIds.includes(u.id)));
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
