import { translateText } from "@/src/hooks/useAutoTranslate";
import { useProjectPlansData } from "@/src/hooks/useProjectPlansData";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import { useAuth } from "@/src/providers/AuthProvider";
import { useNotifications } from "@/src/providers/NotificationProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import type { ThemeColors } from "@/src/providers/ThemeProvider";

import { MobilePlanZoomView } from "../_components/projectPlans/MobilePlanZoomView";
import { PdfRenderer } from "../_components/projectPlans/PdfRenderer";
import { PlanListView } from "../_components/projectPlans/PlanListView";

// ─── Types ───────────────────────────────────────────────────
type Plan = {
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
};

type Pin = {
  id: string;
  plan_id: string;
  x_percent: number;
  y_percent: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  assigned_to: string | null;
  due_date: string | null;
  task_id: string | null;
  photos: string[];
  created_by: string | null;
  created_at: string;
  assignee?: { full_name: string; role: string } | null;
};

type Props = {
  projectId: string;
  workers: { id: string; full_name?: string | null; role?: string | null }[];
  onTaskCreated?: () => void;
  onBack?: () => void;
  initialPlanId?: string;
  initialPinId?: string;
};

// ─── Constants ───────────────────────────────────────────────
const PIN_SIZE = 40;
const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#10b981",
  closed: "#64748b",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
};
const CATEGORIES = [
  "electrical",
  "plumbing",
  "structural",
  "finishing",
  "hvac",
  "fire_safety",
  "insulation",
  "other",
];

// ─── Component ───────────────────────────────────────────────
export default function ProjectPlans({ projectId, workers, onTaskCreated, onBack, initialPlanId, initialPinId }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors: tc, isDark } = useTheme();
  const { sendNotification } = useNotifications();

  // ─── Data hook ─────────────────────────────────────────────
  const plansData = useProjectPlansData(projectId, profile?.id, initialPlanId);
  const {
    plans, selectedPlan, setSelectedPlan, loadingPlans, uploadingPlan,
    showPlanList, setShowPlanList,
    fetchPlans, deletePlan: deletePlanAction,
    showUploadModal, setShowUploadModal,
    uploadName, setUploadName, uploadFloor, setUploadFloor,
    uploadDescription, setUploadDescription, uploadFile, setUploadFile,
    pickFile, pickImage, uploadPlan,
    pins, loadingPins, fetchPins,
    savePin: savePinAction, deletePin: deletePinAction, addPinPhoto: addPinPhotoAction,
  } = plansData;

  // State: pin UI
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [addingPin, setAddingPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [showPinListPanel, setShowPinListPanel] = useState(false);

  // State: pin form
  const [pinTitle, setPinTitle] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinStatus, setPinStatus] = useState("open");
  const [pinPriority, setPinPriority] = useState("medium");
  const [pinCategory, setPinCategory] = useState("");
  const [pinAssignedTo, setPinAssignedTo] = useState<string | null>(null);
  const [pinDueDate, setPinDueDate] = useState("");
  const [pinPhotos, setPinPhotos] = useState<string[]>([]);

  // State: zoom/pan
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<View>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planViewRef = useRef<any>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [screenshotHint, setScreenshotHint] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // State: pin translation
  const [pinTranslating, setPinTranslating] = useState(false);
  const [pinTranslatedTitle, setPinTranslatedTitle] = useState("");
  const [pinTranslatedDesc, setPinTranslatedDesc] = useState("");
  const [pinTranslateDir, setPinTranslateDir] = useState<"pl|de" | "de|pl">("pl|de");

  // State: filters & UI
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showPinDetail, setShowPinDetail] = useState(false);
  const [editingPin, setEditingPin] = useState<Pin | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    fetchPlans();
  }, [projectId]);

  useEffect(() => {
    if (selectedPlan) {
      fetchPins(selectedPlan.id);
    }
  }, [selectedPlan?.id]);

  // Highlight pin when navigating from task
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null);
  useEffect(() => {
    if (initialPinId && pins.length > 0) {
      const targetPin = pins.find((p) => p.id === initialPinId);
      if (targetPin) {
        setHighlightedPinId(targetPin.id);
        const timer = setTimeout(() => setHighlightedPinId(null), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [initialPinId, pins]);

  // ─── Pin Actions (wrappers around hook) ─────────────────────
  const handlePlanPress = (evt: import("react-native").GestureResponderEvent) => {
    if (!addingPin || !selectedPlan) return;
    const { locationX, locationY } = evt.nativeEvent;
    const x = Math.max(0, Math.min(100, (locationX / (containerSize.width || 1)) * 100));
    const y = Math.max(0, Math.min(100, (locationY / (containerSize.height || 1)) * 100));
    setPinTitle(""); setPinDescription(""); setPinStatus("open"); setPinPriority("medium");
    setPinCategory(""); setPinAssignedTo(null); setPinDueDate(""); setPinPhotos([]);
    // Partial Pin — hook akceptuje (przy nowym pinie tworzy pełny obiekt).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEditingPin({ x_percent: x, y_percent: y } as any);
    setShowPinDetail(true);
    setAddingPin(false);
  };

  const savePin = async () => {
    setSavingPin(true);
    try {
      await savePinAction(
        { title: pinTitle, description: pinDescription, status: pinStatus, priority: pinPriority, category: pinCategory, assignedTo: pinAssignedTo, dueDate: pinDueDate, photos: pinPhotos },
        editingPin,
        sendNotification,
        t,
        () => { setShowPinDetail(false); setEditingPin(null); onTaskCreated?.(); },
      );
    } catch (e: unknown) {
      console.error("Error saving pin:", e);
      const msg = (e instanceof Error ? e.message : null) || "Error";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    } finally {
      setSavingPin(false);
    }
  };

  const deletePin = async (pinId: string) => {
    await deletePinAction(pinId, t);
    setShowPinDetail(false);
    setEditingPin(null);
  };

  const deletePlan = async (planId: string) => {
    await deletePlanAction(planId, t);
  };

  const addPinPhoto = async () => {
    await addPinPhotoAction(pinPhotos, setPinPhotos);
  };

  // ─── Filtered pins ─────────────────────────────────────────
  const filteredPins = useMemo(() => {
    if (!statusFilter) return pins;
    return pins.filter((p) => p.status === statusFilter);
  }, [pins, statusFilter]);

  // ─── Pin stats ──────────────────────────────────────────────
  const pinStats = useMemo(() => {
    const s = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const p of pins) {
      if (p.status in s) (s as Record<string, number>)[p.status]++;
    }
    return s;
  }, [pins]);

  // ─── Helpers ────────────────────────────────────────────────
  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      open: t("plans.status_open", "Otwarte"),
      in_progress: t("plans.status_in_progress", "W toku"),
      resolved: t("plans.status_resolved", "Rozwiązane"),
      closed: t("plans.status_closed", "Zamknięte"),
    };
    return labels[s] || s;
  };

  const priorityLabel = (p: string) => {
    const labels: Record<string, string> = {
      low: t("plans.priority_low", "Niski"),
      medium: t("plans.priority_medium", "Średni"),
      high: t("plans.priority_high", "Wysoki"),
      critical: t("plans.priority_critical", "Krytyczny"),
    };
    return labels[p] || p;
  };

  const categoryLabel = (c: string) => {
    const labels: Record<string, string> = {
      electrical: t("plans.cat_electrical", "Elektryka"),
      plumbing: t("plans.cat_plumbing", "Hydraulika"),
      structural: t("plans.cat_structural", "Konstrukcja"),
      finishing: t("plans.cat_finishing", "Wykończenie"),
      hvac: t("plans.cat_hvac", "HVAC"),
      fire_safety: t("plans.cat_fire_safety", "P.poż"),
      insulation: t("plans.cat_insulation", "Izolacja"),
      other: t("plans.cat_other", "Inne"),
    };
    return labels[c] || c;
  };

  // ─── Zoom controls ─────────────────────────────────────────
  const zoomIn = () => setScale((s) => Math.min(s + 0.3, 5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.3, 0.5));
  const resetZoom = () => { setScale(1); setTranslateX(0); setTranslateY(0); };

  // ─── Refs for drag + zoom ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollContainerRef = useRef<any>(null);
  const addingPinRef = useRef(addingPin);
  addingPinRef.current = addingPin;
  const translateXRef = useRef(translateX);
  translateXRef.current = translateX;
  const translateYRef = useRef(translateY);
  translateYRef.current = translateY;

  // ─── Screenshot (web: key S or button) ─────────────────────
  const takeScreenshot = async () => {
    if (Platform.OS !== "web" || !planViewRef.current) return;
    try {
      // Load html2canvas from CDN if not loaded
      // html2canvas loaded from CDN — external lib bez typów.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const canvas = await w.html2canvas(planViewRef.current, { useCORS: true, scale: 1 });
      const dataUrl = canvas.toDataURL("image/png");
      // Convert to blob and upload
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `pins/screenshot_${Date.now()}.png`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("project-plans")
        .upload(fileName, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabaseAdmin.storage
        .from("project-plans")
        .getPublicUrl(fileName);
      setPinPhotos((prev) => [...prev, urlData.publicUrl]);
      // Show hint
      setScreenshotHint(true);
      setTimeout(() => setScreenshotHint(false), 2000);
    } catch (e) {
      console.error("Screenshot error:", e);
    }
  };

  // ─── Wheel zoom + Drag-to-pan: attach native DOM listeners ──
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const draggingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !selectedPlan) return;
    const el = scrollContainerRef.current;
    if (!el || !el.addEventListener) return;

    // --- Wheel → zoom ---
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const next = Math.max(0.3, Math.min(6, scaleRef.current + delta));
      setScale(next);
    };

    // --- Mousedown → start drag ---
    const handleMouseDown = (e: MouseEvent) => {
      if (addingPinRef.current) return;
      if (e.button !== 0) return;
      e.preventDefault();
      draggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: translateXRef.current,
        ty: translateYRef.current,
      };
    };

    // --- Mousemove → drag ---
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setTranslateX(dragStartRef.current.tx + dx);
      setTranslateY(dragStartRef.current.ty + dy);
    };

    // --- Mouseup → stop drag ---
    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        setIsDragging(false);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectedPlan]);

  // Keyboard shortcut: S = screenshot
  useEffect(() => {
    if (Platform.OS !== "web" || !selectedPlan) return;
    const handler = (e: KeyboardEvent) => {
      // Don't capture if typing in input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        takeScreenshot();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPlan, pinPhotos]);

  // ─── RENDER: Plan List ──────────────────────────────────────
  if (showPlanList || !selectedPlan) {
    return (
      <PlanListView
        plans={plans}
        loadingPlans={loadingPlans}
        onSelectPlan={(plan) => { setSelectedPlan(plan); setShowPlanList(false); }}
        onDelete={deletePlan}
        onUpload={() => setShowUploadModal(true)}
        onBack={onBack}
        uploadModal={renderUploadModal()}
      />
    );
  }

  // ─── RENDER: Plan Viewer with Pins ──────────────────────────
  function renderUploadModal() {
    return (
      <Modal visible={showUploadModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: isDark ? tc.surface : "#fff", borderRadius: 16, padding: 20, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: tc.text }}>{t("plans.upload", "Dodaj plan")}</Text>
              <TouchableOpacity onPress={() => { setShowUploadModal(false); setUploadFile(null); }}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Name */}
              <Text style={{ fontSize: 14, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>{t("plans.plan_name", "Nazwa planu")} *</Text>
              <TextInput
                value={uploadName}
                onChangeText={setUploadName}
                placeholder={t("plans.plan_name_placeholder", "np. Parter - Instalacja elektryczna")}
                placeholderTextColor={tc.textMuted}
                style={{ backgroundColor: tc.inputBg, borderWidth: 1, borderColor: tc.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: tc.text, marginBottom: 14 }}
              />

              {/* Floor */}
              <Text style={{ fontSize: 14, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>{t("plans.floor_level", "Piętro / Poziom")}</Text>
              <TextInput
                value={uploadFloor}
                onChangeText={setUploadFloor}
                placeholder={t("plans.floor_placeholder", "np. Parter, Piętro 1, Dach")}
                placeholderTextColor={tc.textMuted}
                style={{ backgroundColor: tc.inputBg, borderWidth: 1, borderColor: tc.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: tc.text, marginBottom: 14 }}
              />

              {/* Description */}
              <Text style={{ fontSize: 14, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>{t("plans.description", "Opis")}</Text>
              <TextInput
                value={uploadDescription}
                onChangeText={setUploadDescription}
                placeholder={t("plans.description_placeholder", "Opcjonalny opis...")}
                placeholderTextColor={tc.textMuted}
                multiline
                numberOfLines={3}
                style={{ backgroundColor: tc.inputBg, borderWidth: 1, borderColor: tc.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: tc.text, marginBottom: 14, minHeight: 70, textAlignVertical: "top" }}
              />

              {/* File picker */}
              <Text style={{ fontSize: 14, fontWeight: "600", color: tc.textSecondary, marginBottom: 6 }}>{t("plans.file", "Plik")} *</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#dbeafe", paddingVertical: 12, borderRadius: 8 }}
                  onPress={pickImage}
                >
                  <Ionicons name="image-outline" size={20} color="#2563eb" />
                  <Text style={{ color: "#2563eb", fontWeight: "600" }}>{t("plans.pick_image", "Zdjęcie")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fee2e2", paddingVertical: 12, borderRadius: 8 }}
                  onPress={pickFile}
                >
                  <Ionicons name="document-outline" size={20} color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontWeight: "600" }}>PDF</Text>
                </TouchableOpacity>
              </View>
              {uploadFile && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f0fdf4", padding: 10, borderRadius: 8, marginBottom: 14 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={{ color: "#10b981", fontWeight: "600", flex: 1 }} numberOfLines={1}>
                    {uploadFile.name || "Wybrany plik"}
                  </Text>
                  <TouchableOpacity onPress={() => setUploadFile(null)}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Upload button */}
              <TouchableOpacity
                style={{
                  backgroundColor: (!uploadFile || !uploadName.trim()) ? "#94a3b8" : tc.primary,
                  borderRadius: 8,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginTop: 8,
                }}
                onPress={uploadPlan}
                disabled={!uploadFile || !uploadName.trim() || uploadingPlan}
              >
                {uploadingPlan ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{t("plans.upload_btn", "Prześlij plan")}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  function renderPinDetailModal() {
    const isNew = !editingPin?.id;
    return (
      <Modal visible={showPinDetail} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: isDark ? tc.surface : "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: tc.text }}>
                {isNew ? t("plans.new_pin", "Nowa pinezka") : t("plans.edit_pin", "Edytuj pinezkę")}
              </Text>
              <TouchableOpacity onPress={() => { setShowPinDetail(false); setEditingPin(null); }}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={lbl(tc)}>{t("plans.pin_title", "Tytuł")} *</Text>
              <TextInput
                value={pinTitle}
                onChangeText={setPinTitle}
                placeholder={t("plans.pin_title_placeholder", "np. Podłączenie gniazdek elektrycznych")}
                placeholderTextColor={tc.textMuted}
                style={inp(tc)}
              />

              {/* Description */}
              <Text style={lbl(tc)}>{t("plans.pin_description", "Opis")}</Text>
              <TextInput
                value={pinDescription}
                onChangeText={setPinDescription}
                placeholder={t("plans.pin_desc_placeholder", "Szczegóły...")}
                placeholderTextColor={tc.textMuted}
                multiline
                numberOfLines={3}
                style={[inp(tc), { minHeight: 70, textAlignVertical: "top" }]}
              />

              {/* Auto-translate PL↔DE */}
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Ionicons name="language" size={18} color={tc.textMuted} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: tc.textMuted }}>{t("plans.translate", "Tłumaczenie")}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: pinTranslateDir === "pl|de" ? "#2563eb" : (isDark ? tc.surfaceVariant : "#f1f5f9"), paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                    onPress={() => { setPinTranslateDir("pl|de"); setPinTranslatedTitle(""); setPinTranslatedDesc(""); }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: pinTranslateDir === "pl|de" ? "#fff" : tc.textSecondary }}>PL → DE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: pinTranslateDir === "de|pl" ? "#2563eb" : (isDark ? tc.surfaceVariant : "#f1f5f9"), paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                    onPress={() => { setPinTranslateDir("de|pl"); setPinTranslatedTitle(""); setPinTranslatedDesc(""); }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: pinTranslateDir === "de|pl" ? "#fff" : tc.textSecondary }}>DE → PL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: isDark ? "#1e3a5f" : "#eff6ff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
                    onPress={async () => {
                      setPinTranslating(true);
                      setPinTranslatedTitle(""); setPinTranslatedDesc("");
                      try {
                        if (pinTitle.trim()) {
                          const r = await translateText(pinTitle, pinTranslateDir);
                          setPinTranslatedTitle(r);
                        }
                        if (pinDescription.trim()) {
                          const r = await translateText(pinDescription, pinTranslateDir);
                          setPinTranslatedDesc(r);
                        }
                      } catch (e) { console.error("Translation error:", e); }
                      finally { setPinTranslating(false); }
                    }}
                    disabled={pinTranslating || (!pinTitle.trim() && !pinDescription.trim())}
                  >
                    {pinTranslating ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Ionicons name="swap-horizontal" size={16} color="#2563eb" />
                    )}
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563eb" }}>{t("plans.translate_btn", "Tłumacz")}</Text>
                  </TouchableOpacity>
                </View>
                {(pinTranslatedTitle || pinTranslatedDesc) ? (
                  <View style={{ backgroundColor: isDark ? "#14532d" : "#f0fdf4", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: isDark ? "#166534" : "#bbf7d0" }}>
                    {pinTranslatedTitle ? (
                      <View style={{ marginBottom: pinTranslatedDesc ? 6 : 0 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#86efac" : "#166534", marginBottom: 2 }}>
                          {pinTranslateDir === "pl|de" ? "Titel (DE):" : "Tytuł (PL):"}
                        </Text>
                        <Text style={{ fontSize: 13, color: isDark ? "#bbf7d0" : "#166534" }}>{pinTranslatedTitle}</Text>
                      </View>
                    ) : null}
                    {pinTranslatedDesc ? (
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#86efac" : "#166534", marginBottom: 2 }}>
                          {pinTranslateDir === "pl|de" ? "Beschreibung (DE):" : "Opis (PL):"}
                        </Text>
                        <Text style={{ fontSize: 13, color: isDark ? "#bbf7d0" : "#166534" }}>{pinTranslatedDesc}</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#16a34a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => {
                        const tag = pinTranslateDir === "pl|de" ? "[DE]" : "[PL]";
                        if (pinTranslatedTitle) setPinTitle((prev) => `${prev}\n${tag} ${pinTranslatedTitle}`);
                        if (pinTranslatedDesc) setPinDescription((prev) => `${prev}\n\n${tag} ${pinTranslatedDesc}`);
                        setPinTranslatedTitle(""); setPinTranslatedDesc("");
                      }}
                    >
                      <Ionicons name="add-circle" size={14} color="#fff" />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{t("plans.apply_translation", "Dodaj tłumaczenie")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {/* Status */}
              <Text style={lbl(tc)}>{t("plans.pin_status", "Status")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: pinStatus === s ? STATUS_COLORS[s] : (isDark ? tc.surfaceVariant : "#f1f5f9"),
                    }}
                    onPress={() => setPinStatus(s)}
                  >
                    <Text style={{ color: pinStatus === s ? "#fff" : tc.textSecondary, fontWeight: "600", fontSize: 13 }}>
                      {statusLabel(s)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Priority */}
              <Text style={lbl(tc)}>{t("plans.pin_priority", "Priorytet")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: pinPriority === p ? PRIORITY_COLORS[p] : (isDark ? tc.surfaceVariant : "#f1f5f9"),
                    }}
                    onPress={() => setPinPriority(p)}
                  >
                    <Text style={{ color: pinPriority === p ? "#fff" : tc.textSecondary, fontWeight: "600", fontSize: 13 }}>
                      {priorityLabel(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category */}
              <Text style={lbl(tc)}>{t("plans.pin_category", "Kategoria")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: pinCategory === c ? tc.primary : (isDark ? tc.surfaceVariant : "#f1f5f9"),
                    }}
                    onPress={() => setPinCategory(pinCategory === c ? "" : c)}
                  >
                    <Text style={{ color: pinCategory === c ? "#fff" : tc.textSecondary, fontWeight: "600", fontSize: 12 }}>
                      {categoryLabel(c)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Assigned to */}
              <Text style={lbl(tc)}>{t("plans.assigned_to", "Przypisany do")}</Text>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: tc.inputBg,
                  borderWidth: 1,
                  borderColor: tc.border,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  marginBottom: 6,
                }}
                onPress={() => setShowWorkerPicker(!showWorkerPicker)}
              >
                <Text style={{ color: pinAssignedTo ? tc.text : tc.textMuted, fontSize: 15 }}>
                  {pinAssignedTo
                    ? workers.find((w) => w.id === pinAssignedTo)?.full_name || "?"
                    : t("plans.select_worker", "Wybierz pracownika...")}
                </Text>
                <Ionicons name="chevron-down" size={18} color={tc.textMuted} />
              </TouchableOpacity>
              {showWorkerPicker && (
                <View style={{ maxHeight: 150, borderWidth: 1, borderColor: tc.border, borderRadius: 8, marginBottom: 14, backgroundColor: isDark ? tc.surface : "#fff" }}>
                  <ScrollView>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tc.borderLight }}
                      onPress={() => { setPinAssignedTo(null); setShowWorkerPicker(false); }}
                    >
                      <Text style={{ color: tc.textMuted, fontStyle: "italic" }}>{t("common.none", "Brak")}</Text>
                    </TouchableOpacity>
                    {workers.map((w) => (
                      <TouchableOpacity
                        key={w.id}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: tc.borderLight,
                          backgroundColor: pinAssignedTo === w.id ? (isDark ? "#1e3a5f" : "#dbeafe") : "transparent",
                        }}
                        onPress={() => { setPinAssignedTo(w.id); setShowWorkerPicker(false); }}
                      >
                        <Text style={{ color: tc.text, fontSize: 14 }}>{w.full_name}</Text>
                        <Text style={{ color: tc.textMuted, fontSize: 11 }}>{w.role}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Due date */}
              <Text style={lbl(tc)}>{t("plans.due_date", "Termin")}</Text>
              <TextInput
                value={pinDueDate}
                onChangeText={setPinDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={tc.textMuted}
                style={[inp(tc), { marginBottom: 14 }]}
              />

              {/* Photos */}
              <Text style={lbl(tc)}>{t("plans.photos", "Zdjęcia")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {pinPhotos.map((url, i) => (
                  <View key={i} style={{ position: "relative" }}>
                    <Image source={{ uri: url }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                    <TouchableOpacity
                      style={{ position: "absolute", top: -4, right: -4, backgroundColor: "#ef4444", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
                      onPress={() => setPinPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={{ width: 70, height: 70, borderRadius: 8, borderWidth: 2, borderColor: tc.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}
                  onPress={addPinPhoto}
                >
                  <Ionicons name="camera-outline" size={24} color={tc.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                {!isNew && (
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#fee2e2", borderRadius: 8, paddingVertical: 14, alignItems: "center" }}
                    onPress={() => editingPin?.id && deletePin(editingPin.id)}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 15 }}>{t("common.delete")}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{
                    flex: 2,
                    backgroundColor: !pinTitle.trim() ? "#94a3b8" : tc.primary,
                    borderRadius: 8,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                  onPress={savePin}
                  disabled={!pinTitle.trim() || savingPin}
                >
                  {savingPin ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("common.save")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ─── Render pins helper ──────────────────────────────────────
  const isMobile = Platform.OS !== "web";
  const pinScale = isMobile ? 0.7 : 1;

  function renderPins() {
    return filteredPins.map((pin) => {
      const color = STATUS_COLORS[pin.status] || "#ef4444";
      const catIcon = pin.category === "electrical" ? "flash" : pin.category === "plumbing" ? "water" : pin.category === "structural" ? "construct" : pin.category === "fire_safety" ? "flame" : pin.category === "hvac" ? "thermometer" : "flag";
      const isHighlighted = highlightedPinId === pin.id;
      const hScale = isHighlighted ? 1.5 : 1;
      return (
        <TouchableOpacity
          key={pin.id}
          style={{
            position: "absolute",
            left: `${pin.x_percent}%`,
            top: `${pin.y_percent}%`,
            marginLeft: -6,
            marginTop: -((PIN_SIZE * pinScale * hScale) + (isMobile ? 8 : 18)),
            zIndex: isHighlighted ? 50 : 10,
          }}
          onPress={() => {
            setHighlightedPinId(null);
            setPinTitle(pin.title);
            setPinDescription(pin.description || "");
            setPinStatus(pin.status);
            setPinPriority(pin.priority);
            setPinCategory(pin.category || "");
            setPinAssignedTo(pin.assigned_to);
            setPinDueDate(pin.due_date || "");
            setPinPhotos(pin.photos || []);
            setPinTranslatedTitle(""); setPinTranslatedDesc("");
            setEditingPin(pin);
            setShowPinDetail(true);
          }}
        >
          {/* Highlight ring for pin navigated from task */}
          {isHighlighted && (
            <View style={{
              position: "absolute",
              top: -8,
              left: -8,
              right: -8,
              bottom: -8,
              borderRadius: 12,
              borderWidth: 3,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59,130,246,0.15)",
            }} />
          )}
          <View style={{ alignItems: "flex-start", transform: [{ scale: hScale }], transformOrigin: "bottom left" }}>
            {/* Flag head */}
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isHighlighted ? "#3b82f6" : color,
              paddingHorizontal: 8 * pinScale,
              paddingVertical: 5 * pinScale,
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              borderBottomRightRadius: 6,
              minWidth: PIN_SIZE * pinScale,
              ...(isHighlighted ? {
                borderWidth: 2,
                borderColor: "#fff",
              } : {}),
              ...(Platform.OS === "web" ? {
                boxShadow: isHighlighted ? "0 0 16px rgba(59,130,246,0.7), 0 2px 8px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.35)",
              } : {
                shadowColor: isHighlighted ? "#3b82f6" : "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isHighlighted ? 0.7 : 0.35,
                shadowRadius: isHighlighted ? 8 : 4,
                elevation: isHighlighted ? 12 : 6,
              }),
            }}>
              <Ionicons name={catIcon as keyof typeof Ionicons.glyphMap} size={Math.round(14 * pinScale)} color="#fff" />
              <Text style={{ color: "#fff", fontSize: Math.round(10 * pinScale), fontWeight: "700", marginLeft: 4, maxWidth: isMobile ? 60 : 90 }} numberOfLines={1}>
                {pin.title}
              </Text>
            </View>
            {/* Pin needle / pole */}
            <View style={{
              width: isMobile ? 2 : 3,
              height: isMobile ? 8 : 18,
              backgroundColor: color,
              marginLeft: 0,
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
            }} />
            {/* Dot at bottom (tip) */}
            <View style={{
              width: isMobile ? 5 : 7,
              height: isMobile ? 5 : 7,
              borderRadius: 4,
              backgroundColor: color,
              marginLeft: isMobile ? -1 : -2,
              marginTop: -1,
              borderWidth: isMobile ? 1 : 1.5,
              borderColor: "#fff",
            }} />
          </View>
        </TouchableOpacity>
      );
    });
  }

  // ─── Mobile: fullscreen modal for plan view ─────────────────
  if (Platform.OS !== "web") {
    return (
      <Modal visible={true} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: isDark ? "#0f172a" : "#fff" }}>
          {/* Minimal header: back arrow + plan name */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: Platform.OS === "android" ? 36 : 50,
            paddingBottom: 10,
            paddingHorizontal: 12,
            backgroundColor: isDark ? tc.surface : "#fff",
            borderBottomWidth: 1,
            borderBottomColor: tc.border,
          }}>
            <TouchableOpacity
              style={{ padding: 6, marginRight: 8 }}
              onPress={() => { setShowPlanList(true); setSelectedPlan(null); }}
            >
              <Ionicons name="arrow-back" size={24} color={tc.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: tc.text, flex: 1 }} numberOfLines={1}>
              {selectedPlan.name}
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: addingPin ? "#10b981" : (isDark ? tc.surfaceVariant : "#f1f5f9"),
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
              onPress={() => setAddingPin(!addingPin)}
            >
              <Ionicons name="flag-outline" size={14} color={addingPin ? "#fff" : tc.primary} />
              <Text style={{ color: addingPin ? "#fff" : tc.primary, fontWeight: "600", fontSize: 11 }}>
                {addingPin ? t("plans.tap_plan", "Kliknij") : "📌"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Adding pin overlay hint */}
          {addingPin && (
            <View style={{ position: "absolute", bottom: 30, left: 0, right: 0, alignItems: "center", zIndex: 100 }}>
              <View style={{ backgroundColor: "#10b981", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                  📌 {t("plans.tap_to_place", "Kliknij na plan aby umieścić pinezkę")}
                </Text>
              </View>
            </View>
          )}

          {/* Plan image with pins — fullscreen with pinch-to-zoom */}
          <MobilePlanZoomView
            isDark={isDark}
            addingPin={addingPin}
            containerRef={containerRef}
            planViewRef={planViewRef}
            setContainerSize={setContainerSize}
            handlePlanPress={handlePlanPress}
            selectedPlan={selectedPlan}
            renderPins={renderPins}
          />
        </View>

        {/* Modals */}
        {renderUploadModal()}
        {renderPinDetailModal()}
      </Modal>
    );
  }

  // ─── Web: normal inline view ───────────────────────────────
  return (
    <View style={{ flex: 1, position: "relative" }}>
      {/* ── Sticky top header ── */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 4,
        backgroundColor: isDark ? tc.surface : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: tc.border,
        zIndex: 20,
      }}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 8 }}
          onPress={() => { setShowPlanList(true); setSelectedPlan(null); }}
        >
          <Ionicons name="arrow-back" size={22} color={tc.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: "700", color: tc.text, flex: 1 }} numberOfLines={1}>
          {selectedPlan.name}
        </Text>
      </View>

      {/* ── Sticky filters row ── */}
      {pins.length > 0 && (
        <View style={{
          flexDirection: "row",
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 4,
          flexWrap: "wrap",
          backgroundColor: isDark ? tc.surface : "#fff",
          borderBottomWidth: 1,
          borderBottomColor: tc.border,
          zIndex: 20,
        }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: !statusFilter ? tc.primary : (isDark ? tc.surfaceVariant : "#f1f5f9"),
            }}
            onPress={() => setStatusFilter(null)}
          >
            <Text style={{ color: !statusFilter ? "#fff" : tc.textSecondary, fontWeight: "600", fontSize: 12 }}>
              {t("plans.all", "Wszystkie")} ({pins.length})
            </Text>
          </TouchableOpacity>
          {(["open", "in_progress", "resolved", "closed"] as const).map((s) => {
            const count = (pinStats as Record<string, number>)[s] || 0;
            if (count === 0) return null;
            return (
              <TouchableOpacity
                key={s}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: statusFilter === s ? STATUS_COLORS[s] : (isDark ? tc.surfaceVariant : "#f1f5f9"),
                }}
                onPress={() => setStatusFilter(statusFilter === s ? null : s)}
              >
                <Text style={{ color: statusFilter === s ? "#fff" : STATUS_COLORS[s], fontWeight: "600", fontSize: 12 }}>
                  {statusLabel(s)} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Sticky toolbar ── */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 4,
        flexWrap: "wrap",
        backgroundColor: isDark ? tc.surface : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: tc.border,
        zIndex: 20,
      }}>
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: addingPin ? "#10b981" : (isDark ? tc.surfaceVariant : "#f1f5f9"),
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          onPress={() => setAddingPin(!addingPin)}
        >
          <Ionicons name="flag-outline" size={16} color={addingPin ? "#fff" : tc.primary} />
          <Text style={{ color: addingPin ? "#fff" : tc.primary, fontWeight: "600", fontSize: 13 }}>
            {addingPin ? t("plans.tap_plan", "Kliknij na plan") : t("plans.add_pin", "Dodaj pinezkę")}
          </Text>
        </TouchableOpacity>

        {filteredPins.length > 0 && (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: showPinListPanel ? tc.primary : (isDark ? tc.surfaceVariant : "#f1f5f9"),
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
            }}
            onPress={() => setShowPinListPanel(!showPinListPanel)}
          >
            <Ionicons name="list-outline" size={16} color={showPinListPanel ? "#fff" : tc.primary} />
            <Text style={{ color: showPinListPanel ? "#fff" : tc.primary, fontWeight: "600", fontSize: 12 }}>
              {t("plans.pin_list", "Lista pinezek")} ({filteredPins.length})
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: isDark ? tc.surfaceVariant : "#fef3c7",
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          onPress={takeScreenshot}
        >
          <Ionicons name="camera-outline" size={16} color="#d97706" />
          <Text style={{ color: "#d97706", fontWeight: "600", fontSize: 12 }}>Screenshot (S)</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={zoomOut} style={{ padding: 6, backgroundColor: isDark ? tc.surfaceVariant : "#f1f5f9", borderRadius: 6 }}>
          <Ionicons name="remove" size={18} color={tc.text} />
        </TouchableOpacity>
        <Text style={{ color: tc.textSecondary, fontSize: 12, fontWeight: "600" }}>{Math.round(scale * 100)}%</Text>
        <TouchableOpacity onPress={zoomIn} style={{ padding: 6, backgroundColor: isDark ? tc.surfaceVariant : "#f1f5f9", borderRadius: 6 }}>
          <Ionicons name="add" size={18} color={tc.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={resetZoom} style={{ padding: 6, backgroundColor: isDark ? tc.surfaceVariant : "#f1f5f9", borderRadius: 6 }}>
          <Ionicons name="scan-outline" size={18} color={tc.text} />
        </TouchableOpacity>
      </View>

      {/* ── Collapsible pin list panel ── */}
      {showPinListPanel && filteredPins.length > 0 && (
        <ScrollView style={{
          maxHeight: 180,
          borderBottomWidth: 1,
          borderBottomColor: tc.border,
          backgroundColor: isDark ? tc.surface : "#fff",
        }} showsVerticalScrollIndicator>
          {filteredPins.map((pin) => (
            <TouchableOpacity
              key={pin.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? tc.surfaceVariant : "#f1f5f9",
              }}
              onPress={() => {
                setPinTitle(pin.title);
                setPinDescription(pin.description || "");
                setPinStatus(pin.status);
                setPinPriority(pin.priority);
                setPinCategory(pin.category || "");
                setPinAssignedTo(pin.assigned_to);
                setPinDueDate(pin.due_date || "");
                setPinPhotos(pin.photos || []);
                setPinTranslatedTitle(""); setPinTranslatedDesc("");
                setEditingPin(pin);
                setShowPinDetail(true);
              }}
            >
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                backgroundColor: STATUS_COLORS[pin.status] || "#ef4444",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}>
                <Ionicons name="flag" size={12} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: tc.text }} numberOfLines={1}>{pin.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PRIORITY_COLORS[pin.priority] }} />
                  <Text style={{ fontSize: 10, color: tc.textMuted }}>{priorityLabel(pin.priority)}</Text>
                  {pin.category ? (
                    <Text style={{ fontSize: 10, color: tc.textMuted }}>· {categoryLabel(pin.category)}</Text>
                  ) : null}
                  {pin.assignee ? (
                    <Text style={{ fontSize: 10, color: tc.primary }}>· {pin.assignee.full_name}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={{ fontSize: 10, color: tc.textMuted }}>{statusLabel(pin.status)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Screenshot hint toast ── */}
      {screenshotHint && (
        <View style={{ position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 100 }}>
          <View style={{ backgroundColor: "#10b981", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Screenshot zapisany!</Text>
          </View>
        </View>
      )}

      {/* ── Adding pin overlay hint ── */}
      {addingPin && (
        <View style={{ position: "absolute", bottom: 20, left: 0, right: 0, alignItems: "center", zIndex: 100 }}>
          <View style={{ backgroundColor: "#10b981", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              📌 {t("plans.tap_to_place", "Kliknij na plan aby umieścić pinezkę")}
            </Text>
          </View>
        </View>
      )}

      {/* ── Plan image with pins — fills all remaining space ── */}
      <View
        ref={scrollContainerRef}
        style={{
          flex: 1,
          backgroundColor: isDark ? "#0f172a" : "#f8fafc",
          overflow: "auto",
          cursor: isDragging ? "grabbing" : (addingPin ? "crosshair" : "grab"),
          userSelect: "none",
        } as unknown as import("react-native").ViewStyle}
      >
        <View
          ref={(ref) => { containerRef.current = ref; planViewRef.current = ref; }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainerSize({ width, height });
          }}
          style={{
            position: "relative",
            transform: [{ translateX }, { translateY }, { scale }],
            transformOrigin: "top left",
          }}
          {...(addingPin ? {
            onClick: (e: React.MouseEvent<HTMLElement>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setPinTitle("");
              setPinDescription("");
              setPinStatus("open");
              setPinPriority("medium");
              setPinCategory("");
              setPinAssignedTo(null);
              setPinDueDate("");
              setPinPhotos([]);
              setPinTranslatedTitle(""); setPinTranslatedDesc("");
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setEditingPin({ x_percent: Math.max(0, Math.min(100, x)), y_percent: Math.max(0, Math.min(100, y)) } as any);
              setShowPinDetail(true);
              setAddingPin(false);
            }
          } : {})}
        >
          {selectedPlan.file_type === "image" ? (
            <Image
              source={{ uri: selectedPlan.file_url }}
              style={{ width: "100%", aspectRatio: 1.414 }}
              resizeMode="contain"
              onLoad={() => {
                Image.getSize(selectedPlan.file_url, (w, h) => setImageSize({ width: w, height: h }));
              }}
            />
          ) : (
            <PdfRenderer url={selectedPlan.file_url} />
          )}
          {renderPins()}
        </View>
      </View>

      {/* Modals */}
      {renderUploadModal()}
      {renderPinDetailModal()}
    </View>
  );
}

// ─── Style helpers ────────────────────────────────────────────
const lbl = (tc: ThemeColors) => ({
  fontSize: 14,
  fontWeight: "600" as const,
  color: tc.textSecondary,
  marginBottom: 6,
  marginTop: 4,
});

const inp = (tc: ThemeColors) => ({
  backgroundColor: tc.inputBg,
  borderWidth: 1,
  borderColor: tc.border,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
  color: tc.text,
  marginBottom: 10,
});
