/**
 * Hook zarządzający danymi planów budowlanych i pinów.
 * Wydzielony z ProjectPlans.tsx.
 */

import { useState } from "react";
import { Alert, Platform } from "react-native";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

interface Plan {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  floor_level: string | null;
  file_url: string;
  file_type: string;
  version: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

interface Pin {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  x_percent: number;
  y_percent: number;
  status: string;
  priority: string;
  category: string | null;
  assigned_to: string | null;
  assignee?: { full_name: string; role: string } | null;
  due_date: string | null;
  task_id: string | null;
  photos: string[];
  created_by: string | null;
  created_at: string;
}

export function useProjectPlansData(
  projectId: string,
  profileId: string | undefined,
  initialPlanId?: string,
) {
  // State: plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [uploadingPlan, setUploadingPlan] = useState(false);

  // State: pins
  const [pins, setPins] = useState<Pin[]>([]);
  const [loadingPins, setLoadingPins] = useState(false);

  // State: upload form
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFloor, setUploadFloor] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<any>(null);

  // State: plan list view
  const [showPlanList, setShowPlanList] = useState(true);

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data, error } = await supabaseAdmin.from("project_plans")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPlans(data || []);
      if (data && data.length > 0 && !selectedPlan) {
        if (initialPlanId) {
          const targetPlan = data.find((p: Plan) => p.id === initialPlanId);
          if (targetPlan) {
            setSelectedPlan(targetPlan);
            setShowPlanList(false);
            return;
          }
        }
        setSelectedPlan(data[0]);
        setShowPlanList(false);
      }
    } catch (e) {
      console.error("Error fetching plans:", e);
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchPins = async (planId: string) => {
    setLoadingPins(true);
    try {
      const { data, error } = await supabaseAdmin.from("plan_pins")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const assigneeIds = [...new Set((data || []).filter((p: any) => p.assigned_to).map((p: any) => p.assigned_to))];
      let assigneeMap = new Map<string, any>();
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabaseAdmin.from("profiles")
          .select("id, full_name, role")
          .in("id", assigneeIds);
        assigneeMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      }
      setPins((data || []).map((p: any) => ({
        ...p,
        photos: Array.isArray(p.photos) ? p.photos : [],
        assignee: p.assigned_to ? assigneeMap.get(p.assigned_to) || null : null,
      })));
    } catch (e) {
      console.error("Error fetching pins:", e);
    } finally {
      setLoadingPins(false);
    }
  };

  // ─── Upload Plan ────────────────────────────────────────────
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadFile(result.assets[0]);
      }
    } catch (e) {
      console.error("Error picking file:", e);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadFile(result.assets[0]);
      }
    } catch (e) {
      console.error("Error picking image:", e);
    }
  };

  const uploadPlan = async () => {
    if (!uploadFile || !uploadName.trim()) return;
    setUploadingPlan(true);
    try {
      const ext = uploadFile.name?.split(".").pop() || uploadFile.uri?.split(".").pop() || "png";
      const fileType = ext === "pdf" ? "pdf" : "image";
      const fileName = `${projectId}/${Date.now()}_${uploadName.replace(/\s+/g, "_")}.${ext}`;

      const response = await fetch(uploadFile.uri);
      const fileBody = await response.blob();

      const { error: uploadError } = await supabaseAdmin.storage
        .from("project-plans")
        .upload(fileName, fileBody, {
          contentType: ext === "pdf" ? "application/pdf" : `image/${ext}`,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from("project-plans")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabaseAdmin.from("project_plans").insert({
        project_id: projectId,
        name: uploadName.trim(),
        description: uploadDescription.trim() || null,
        floor_level: uploadFloor.trim() || null,
        file_url: urlData.publicUrl,
        file_type: fileType,
        created_by: profileId,
      });
      if (insertError) throw insertError;

      setUploadName("");
      setUploadFloor("");
      setUploadDescription("");
      setUploadFile(null);
      setShowUploadModal(false);
      fetchPlans();
    } catch (e: any) {
      console.error("Error uploading plan:", e);
      const msg = e?.message || "Upload error";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    } finally {
      setUploadingPlan(false);
    }
  };

  // ─── Pin CRUD ───────────────────────────────────────────────
  const pinStatusToTaskStatus = (ps: string): string => {
    if (ps === "open") return "todo";
    if (ps === "in_progress") return "in_progress";
    if (ps === "resolved" || ps === "closed") return "completed";
    return "todo";
  };

  const savePin = async (
    pinFormData: {
      title: string;
      description: string;
      status: string;
      priority: string;
      category: string;
      assignedTo: string | null;
      dueDate: string;
      photos: string[];
    },
    editingPin: any,
    sendNotification: (userId: string, title: string, body: string, type: string, data: any) => void,
    t: any,
    onSuccess: () => void,
  ) => {
    if (!pinFormData.title.trim() || !selectedPlan) return;

    const pinData: any = {
      plan_id: selectedPlan.id,
      title: pinFormData.title.trim(),
      description: pinFormData.description.trim() || null,
      status: pinFormData.status,
      priority: pinFormData.priority,
      category: pinFormData.category || null,
      assigned_to: pinFormData.assignedTo || null,
      due_date: pinFormData.dueDate || null,
      photos: pinFormData.photos,
      created_by: profileId,
    };

    const taskData: any = {
      title: `📌 ${pinData.title}`,
      description: pinData.description ? `[Plan: ${selectedPlan.name}]\n${pinData.description}` : `[Plan: ${selectedPlan.name}]`,
      project_id: projectId,
      status: pinStatusToTaskStatus(pinData.status),
      priority: pinData.priority === "critical" ? "high" : pinData.priority,
      created_by: profileId || null,
    };
    if (pinData.assigned_to) {
      taskData.assigned_to = pinData.assigned_to;
      taskData.assigned_by = profileId || null;
      taskData.assigned_at = new Date().toISOString();
    }
    if (pinData.due_date) {
      taskData.due_date = pinData.due_date;
    }

    if (editingPin?.id) {
      // Update existing pin
      const { error } = await supabaseAdmin.from("plan_pins")
        .update({
          title: pinData.title,
          description: pinData.description,
          status: pinData.status,
          priority: pinData.priority,
          category: pinData.category,
          assigned_to: pinData.assigned_to,
          due_date: pinData.due_date,
          photos: pinData.photos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPin.id);
      if (error) throw error;

      // Sync linked task
      if (editingPin.task_id) {
        await supabaseAdmin.from("tasks")
          .update({
            title: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            assigned_to: pinData.assigned_to || null,
            due_date: pinData.due_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPin.task_id);

        await supabaseAdmin.from("task_assignees").delete().eq("task_id", editingPin.task_id);
        if (pinData.assigned_to) {
          await supabaseAdmin.from("task_assignees").insert({
            task_id: editingPin.task_id,
            user_id: pinData.assigned_to,
            assigned_by: profileId || null,
          });

          if (pinData.assigned_to !== editingPin.assigned_to && pinData.assigned_to !== profileId) {
            const notifTitle = t("notifications.task_assigned_title", "Nowe zadanie");
            const notifBody = `📌 ${pinData.title} • ${selectedPlan.name}`;
            sendNotification(pinData.assigned_to, notifTitle, notifBody, "task_assigned", {
              task_id: editingPin.task_id,
              project_id: projectId,
            });
          }
        }
      }
    } else {
      // Create new pin + task
      pinData.x_percent = editingPin?.x_percent ?? 50;
      pinData.y_percent = editingPin?.y_percent ?? 50;

      let newTask: any = null;
      let taskError: any = null;
      {
        const res = await supabaseAdmin.from("tasks")
          .insert(taskData)
          .select("id")
          .single();
        newTask = res.data;
        taskError = res.error;
      }

      if (taskError && (taskError.message?.includes("created_by") || taskError.code === "PGRST204")) {
        delete taskData.created_by;
        const retry = await supabaseAdmin.from("tasks")
          .insert(taskData)
          .select("id")
          .single();
        newTask = retry.data;
        taskError = retry.error;
      }

      if (taskError) {
        console.warn("Error creating task for pin:", taskError);
      }

      if (newTask?.id) {
        pinData.task_id = newTask.id;

        if (pinData.assigned_to) {
          await supabaseAdmin.from("task_assignees").insert({
            task_id: newTask.id,
            user_id: pinData.assigned_to,
            assigned_by: profileId || null,
          });
        }

        if (pinData.assigned_to && pinData.assigned_to !== profileId) {
          const notifTitle = t("notifications.task_assigned_title", "Nowe zadanie");
          const notifBody = `📌 ${pinData.title} • ${selectedPlan.name}`;
          sendNotification(pinData.assigned_to, notifTitle, notifBody, "task_assigned", {
            task_id: newTask.id,
            project_id: projectId,
          });
        }
      }

      const { error } = await supabaseAdmin.from("plan_pins").insert(pinData);
      if (error) throw error;
    }

    fetchPins(selectedPlan.id);
    onSuccess();
  };

  const deletePin = async (pinId: string, t: any) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(t("common.delete") + "?")
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t("common.delete"), t("common.confirm") + "?", [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed || !selectedPlan) return;
    try {
      const pinToDelete = pins.find((p) => p.id === pinId);
      if (pinToDelete?.task_id) {
        await supabaseAdmin.from("task_assignees").delete().eq("task_id", pinToDelete.task_id);
        await supabaseAdmin.from("tasks").delete().eq("id", pinToDelete.task_id);
      }
      await supabaseAdmin.from("plan_pins").delete().eq("id", pinId);
      fetchPins(selectedPlan.id);
    } catch (e) {
      console.error("Error deleting pin:", e);
    }
  };

  const deletePlan = async (planId: string, t: any) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(t("common.delete") + "?")
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t("common.delete"), t("common.confirm") + "?", [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.delete"), style: "destructive", onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      await supabaseAdmin.from("project_plans").delete().eq("id", planId);
      if (selectedPlan?.id === planId) {
        setSelectedPlan(null);
        setShowPlanList(true);
      }
      fetchPlans();
    } catch (e) {
      console.error("Error deleting plan:", e);
    }
  };

  const addPinPhoto = async (currentPhotos: string[], setPhotos: (photos: string[]) => void) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() || "jpg";
      const fileName = `pin-photos/${projectId}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabaseAdmin.storage
        .from("attachments")
        .upload(fileName, blob, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from("attachments")
        .getPublicUrl(fileName);

      setPhotos([...currentPhotos, urlData.publicUrl]);
    } catch (e) {
      console.error("Error uploading pin photo:", e);
    }
  };

  return {
    // Plans
    plans, selectedPlan, setSelectedPlan, loadingPlans, uploadingPlan,
    showPlanList, setShowPlanList,
    fetchPlans, deletePlan,
    // Upload form
    showUploadModal, setShowUploadModal,
    uploadName, setUploadName, uploadFloor, setUploadFloor,
    uploadDescription, setUploadDescription, uploadFile, setUploadFile,
    pickFile, pickImage, uploadPlan,
    // Pins
    pins, loadingPins, fetchPins,
    savePin, deletePin, addPinPhoto,
    pinStatusToTaskStatus,
  };
}
