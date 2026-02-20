import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  Linking,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/src/lib/supabase/client";
import { supabaseAdmin } from "@/src/lib/supabase/adminClient";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  uploaded_by?: string;
};

type FileAttachmentsProps = {
  attachments: Attachment[];
  entityType: "task" | "project";
  entityId: string;
  canUpload: boolean;
  canDelete?: boolean;
  onRefresh: () => void;
  folderId?: string;
};

// Thumbnail component that loads signed URL for private bucket images
function AttachmentThumbnail({ fileUrl }: { fileUrl: string }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Extract storage path from full Supabase URL
        let storagePath = fileUrl;
        const marker = "/storage/v1/object/public/attachments/";
        const idx = fileUrl.indexOf(marker);
        if (idx !== -1) storagePath = decodeURIComponent(fileUrl.substring(idx + marker.length));

        const { data, error } = await supabaseAdmin.storage
          .from("attachments")
          .createSignedUrl(storagePath, 3600);
        if (!error && data?.signedUrl && mounted) {
          setThumbUrl(data.signedUrl);
        }
      } catch (e) {
        console.error("Thumbnail error:", e);
      }
    })();
    return () => { mounted = false; };
  }, [fileUrl]);

  if (!thumbUrl) {
    return (
      <View style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="small" color="#94a3b8" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: thumbUrl }}
      style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: "#e2e8f0" }}
      resizeMode="cover"
    />
  );
}

export default function FileAttachments({
  attachments,
  entityType,
  entityId,
  canUpload,
  canDelete,
  onRefresh,
  folderId,
}: FileAttachmentsProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const isImage = (fileType: string) => {
    return fileType?.startsWith("image/");
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes("pdf")) return "document-text";
    if (fileType?.includes("word") || fileType?.includes("doc")) return "document";
    if (fileType?.includes("excel") || fileType?.includes("sheet") || fileType?.includes("xls")) return "grid";
    if (fileType?.includes("zip") || fileType?.includes("rar")) return "archive";
    if (isImage(fileType)) return "image";
    return "document-attach";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const requestPermissions = async () => {
    if (Platform.OS !== "web") {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== "granted" || libraryStatus !== "granted") {
        Alert.alert(
          t("attachments.permission_required"),
          t("attachments.permission_message")
        );
        return false;
      }
    }
    return true;
  };

  const uploadFile = async (uri: string, fileName: string, fileType: string) => {
    setShowPicker(false);
    setUploading(true);
    try {
      // Sanitize file name for Supabase Storage
      const sanitized = fileName
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
      const filePath = `${entityType}/${entityId}/${Date.now()}_${sanitized}`;

      let fileSize = 0;

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileSize = blob.size;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("attachments")
          .upload(filePath, blob, { contentType: fileType, upsert: false });
        if (uploadError) throw uploadError;
      } else {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;

        const base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64" as any,
        });

        // Decode base64 to Uint8Array (Hermes-safe)
        const binaryStr = global.atob
          ? global.atob(base64Data)
          : base64Decode(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const { error: uploadError } = await supabaseAdmin.storage
          .from("attachments")
          .upload(filePath, bytes.buffer, { contentType: fileType, upsert: false });
        if (uploadError) throw uploadError;
      }

      // Get the full public URL (for storing in DB, even though bucket is private)
      const { data: urlData } = supabaseAdmin.storage
        .from("attachments")
        .getPublicUrl(filePath);

      // Save attachment record to task_attachments or project_attachments
      const tableName = entityType === "task" ? "task_attachments" : "project_attachments";
      const foreignKey = entityType === "task" ? "task_id" : "project_id";

      const insertData: any = {
        [foreignKey]: entityId,
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_type: fileType,
        file_size: fileSize,
      };
      if (folderId && entityType === "project") {
        insertData.folder_id = folderId;
      }
      const { error: dbError } = await (supabaseAdmin.from(tableName) as any).insert(insertData);

      if (dbError) throw dbError;

      if (Platform.OS === "web") {
        window.alert(t("attachments.upload_success"));
      } else {
        Alert.alert(t("common.success"), t("attachments.upload_success"));
      }
      onRefresh();
    } catch (error: any) {
      console.error("Upload error:", error);
      const msg = error?.message || t("attachments.upload_error");
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert(t("common.error"), msg);
      }
    } finally {
      setUploading(false);
    }
  };

  // Pure JS base64 decode (fallback for Hermes where atob may not exist)
  const base64Decode = (input: string): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let str = input.replace(/=+$/, "");
    let output = "";
    for (let i = 0; i < str.length; i += 4) {
      const a = chars.indexOf(str.charAt(i));
      const b = chars.indexOf(str.charAt(i + 1));
      const c = chars.indexOf(str.charAt(i + 2));
      const d = chars.indexOf(str.charAt(i + 3));
      output += String.fromCharCode((a << 2) | (b >> 4));
      if (c !== -1 && c !== 64) output += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d !== -1 && d !== 64) output += String.fromCharCode(((c & 3) << 6) | d);
    }
    return output;
  };

  // Extract storage path from full Supabase URL
  // e.g. https://xxx.supabase.co/storage/v1/object/public/attachments/project/123/file.jpg
  // -> project/123/file.jpg
  const extractStoragePath = (fullUrl: string): string => {
    const marker = "/storage/v1/object/public/attachments/";
    const idx = fullUrl.indexOf(marker);
    if (idx !== -1) return decodeURIComponent(fullUrl.substring(idx + marker.length));
    // fallback: try signed URL marker
    const marker2 = "/storage/v1/object/sign/attachments/";
    const idx2 = fullUrl.indexOf(marker2);
    if (idx2 !== -1) {
      const path = fullUrl.substring(idx2 + marker2.length);
      return decodeURIComponent(path.split("?")[0]);
    }
    return fullUrl;
  };

  // Get a viewable signed URL for a storage file
  const getSignedUrl = async (fileUrl: string): Promise<string | null> => {
    try {
      const storagePath = extractStoragePath(fileUrl);
      const { data, error } = await supabaseAdmin.storage
        .from("attachments")
        .createSignedUrl(storagePath, 3600);
      if (error) throw error;
      return data?.signedUrl || null;
    } catch (e) {
      console.error("Error getting signed URL:", e);
      return null;
    }
  };

  const pickImage = async (useCamera: boolean) => {
    if (Platform.OS === "web") {
      // On web, use file input for images
      pickDocumentWeb("image/*");
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.uri.split("/").pop() || `image_${Date.now()}.jpg`;
        const fileType = asset.mimeType || "image/jpeg";
        await uploadFile(asset.uri, fileName, fileType);
      }
    } catch (error: any) {
      console.error("Image picker error:", error);
      Alert.alert(t("common.error"), error?.message || t("attachments.pick_error"));
    }
  };

  // Web-specific file picker using hidden input
  const pickDocumentWeb = (accept: string = "*/*") => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      try {
        await uploadFile(uri, file.name, file.type || "application/octet-stream");
      } finally {
        URL.revokeObjectURL(uri);
      }
    };
    input.click();
  };

  const pickDocument = async () => {
    if (Platform.OS === "web") {
      pickDocumentWeb();
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await uploadFile(asset.uri, asset.name, asset.mimeType || "application/octet-stream");
      }
    } catch (error: any) {
      console.error("Document picker error:", error);
      Alert.alert(t("common.error"), error?.message || t("attachments.pick_error"));
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    const doDelete = async () => {
      try {
        // Delete from storage
        const storagePath = extractStoragePath(attachment.file_url);
        await supabaseAdmin.storage
          .from("attachments")
          .remove([storagePath]);

        // Delete from database
        const tableName = entityType === "task" ? "task_attachments" : "project_attachments";
        const { error } = await (supabaseAdmin
          .from(tableName) as any)
          .delete()
          .eq("id", attachment.id);

        if (error) throw error;
        onRefresh();
      } catch (error) {
        console.error("Delete error:", error);
        if (Platform.OS === "web") {
          window.alert(t("attachments.delete_error"));
        } else {
          Alert.alert(t("common.error"), t("attachments.delete_error"));
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(t("attachments.delete_message"))) {
        doDelete();
      }
    } else {
      Alert.alert(
        t("attachments.delete_title"),
        t("attachments.delete_message"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.delete"), style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const openImage = async (fileUrl: string) => {
    const url = await getSignedUrl(fileUrl);
    if (url) setSelectedImage(url);
  };

  const openFile = async (attachment: Attachment) => {
    try {
      const url = await getSignedUrl(attachment.file_url);
      if (!url) {
        const msg = "Datei konnte nicht geöffnet werden";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
        return;
      }
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(t("common.error"), "Datei kann nicht geöffnet werden");
        }
      }
    } catch (e) {
      console.error("Error opening file:", e);
      const msg = "Fehler beim Öffnen der Datei";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert(t("common.error"), msg);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("attachments.title")}</Text>
        <Text style={styles.count}>{attachments.length}</Text>
      </View>

      {/* Attachment List */}
      {attachments.length === 0 ? (
        <Text style={styles.emptyText}>{t("attachments.empty")}</Text>
      ) : (
        <View style={styles.attachmentsList}>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentItem}>
              {isImage(attachment.file_type) ? (
                <TouchableOpacity onPress={() => openImage(attachment.file_url)}>
                  <AttachmentThumbnail fileUrl={attachment.file_url} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => openFile(attachment)} style={styles.fileIconContainer}>
                  <Ionicons
                    name={getFileIcon(attachment.file_type)}
                    size={32}
                    color="#64748b"
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.attachmentInfo} onPress={() => isImage(attachment.file_type) ? openImage(attachment.file_url) : openFile(attachment)}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {attachment.file_name}
                </Text>
                <Text style={styles.fileSize}>
                  {formatFileSize(attachment.file_size)}
                  {!isImage(attachment.file_type) && " · Tippen zum Öffnen"}
                </Text>
              </TouchableOpacity>
              {(canDelete ?? canUpload) && (
                <TouchableOpacity
                  onPress={() => deleteAttachment(attachment)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Upload Button */}
      {canUpload && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => setShowPicker(true)}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={24} color="#2563eb" />
              <Text style={styles.uploadText}>{t("attachments.add")}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Picker Modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>{t("attachments.select_source")}</Text>
            
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => pickImage(true)}
            >
              <Ionicons name="camera" size={28} color="#2563eb" />
              <Text style={styles.pickerOptionText}>{t("attachments.take_photo")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => pickImage(false)}
            >
              <Ionicons name="images" size={28} color="#10b981" />
              <Text style={styles.pickerOptionText}>{t("attachments.choose_photo")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerOption}
              onPress={pickDocument}
            >
              <Ionicons name="document" size={28} color="#f59e0b" />
              <Text style={styles.pickerOptionText}>{t("attachments.choose_file")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imagePreviewModal}>
          <TouchableOpacity
            style={styles.closePreviewButton}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color="#ffffff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  count: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 16,
  },
  attachmentsList: {
    gap: 8,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
  },
  fileIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: "#64748b",
  },
  deleteButton: {
    padding: 8,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderStyle: "dashed",
    gap: 8,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2563eb",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModal: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 20,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 16,
  },
  pickerOptionText: {
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500",
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
  },
  imagePreviewModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closePreviewButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
});
