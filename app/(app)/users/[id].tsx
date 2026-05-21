/**
 * Ekran szczegolow uzytkownika.
 *
 * Przed v1.4.0 ten plik byl DUPLIKATEM users/index.tsx (renderowal liste).
 * Z tego powodu klik karty na liscie zmienial URL na /users/<id> ale uzytkownik
 * widzial nadal liste -- mylil sie wnioskujac ze "klik nie dziala".
 * Patrz CHANGELOG v1.3.1 - v1.3.9 (cala diagnostyka).
 *
 * Ten plik teraz pokazuje rzeczywiste szczegoly usera:
 * - dane podstawowe (full_name, email, phone, role, badge)
 * - status (aktywny / dezaktywowany, hide_email/phone, access_expires_at)
 * - akcje (back button do listy)
 *
 * Edycja roli / custom_permissions / reset hasla -- w osobnej iteracji.
 * Na razie minimalny czytelny detail view.
 */
import { usePermissions } from "@/src/hooks/usePermissions";
import { adminApi as supabaseAdmin } from "@/src/lib/supabase/adminApi";
import type { Database } from "@/src/lib/supabase/database.types";
import { useAuth } from "@/src/providers/AuthProvider";
import { openLink } from "@/src/utils/helpers";
import { getRoleColor, getRoleIcon } from "@/src/utils/roleHelpers";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function UserDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: currentUserProfile } = useAuth();
  const perms = usePermissions();

  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError(t("common.error") || "Brak ID użytkownika");
      setLoading(false);
      return;
    }
    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", id as string)
        .single();

      if (fetchError) throw fetchError;
      setUser(data as Profile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error || (t("users.not_found") || "Użytkownik nie znaleziony")}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
          <Text style={styles.backButtonText}>{t("common.back") || "Wróć"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const roleColor = getRoleColor(user.role);
  const roleIcon = getRoleIcon(user.role) as keyof typeof Ionicons.glyphMap;
  const canEdit = perms.canEditUser;
  const isOwnProfile = user.id === currentUserProfile?.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Back button */}
      <TouchableOpacity style={styles.topBackBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#1e293b" />
        <Text style={styles.topBackText}>{t("common.back") || "Wróć"}</Text>
      </TouchableOpacity>

      {/* Header karty */}
      <View style={styles.headerCard}>
        <View style={[styles.avatar, { backgroundColor: `${roleColor}20` }]}>
          <Ionicons name={roleIcon} size={48} color={roleColor} />
        </View>
        <Text style={styles.userName}>{user.full_name || user.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20` }]}>
          <Text style={[styles.roleBadgeText, { color: roleColor }]}>
            {t(`common.roles.${user.role}`) || user.role}
          </Text>
        </View>
        {isOwnProfile && (
          <Text style={styles.ownProfileHint}>
            {t("users.own_profile") || "To Twój profil"}
          </Text>
        )}
      </View>

      {/* Sekcja: dane kontaktowe */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("users.contact_data") || "Dane kontaktowe"}</Text>

        <TouchableOpacity
          style={styles.dataRow}
          onPress={() => openLink(`mailto:${user.email}`)}
          activeOpacity={0.6}
        >
          <Ionicons name="mail-outline" size={20} color="#64748b" />
          <View style={styles.dataRowContent}>
            <Text style={styles.dataLabel}>{t("users.email") || "Email"}</Text>
            <Text style={[styles.dataValue, styles.linkValue]}>
              {user.email}{user.hide_email ? " 🔒" : ""}
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {user.phone ? (
          <TouchableOpacity
            style={styles.dataRow}
            onPress={() => openLink(`tel:${user.phone}`)}
            activeOpacity={0.6}
          >
            <Ionicons name="call-outline" size={20} color="#64748b" />
            <View style={styles.dataRowContent}>
              <Text style={styles.dataLabel}>{t("users.phone") || "Telefon"}</Text>
              <Text style={[styles.dataValue, styles.linkValue]}>
                {user.phone}{user.hide_phone ? " 🔒" : ""}
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Sekcja: status / metadata */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("users.status_info") || "Informacje"}</Text>

        <View style={styles.dataRow}>
          <Ionicons name="shield-outline" size={20} color="#64748b" />
          <View style={styles.dataRowContent}>
            <Text style={styles.dataLabel}>{t("users.role") || "Rola"}</Text>
            <Text style={styles.dataValue}>{t(`common.roles.${user.role}`) || user.role}</Text>
          </View>
        </View>

        {user.access_expires_at ? (
          <View style={styles.dataRow}>
            <Ionicons name="time-outline" size={20} color="#64748b" />
            <View style={styles.dataRowContent}>
              <Text style={styles.dataLabel}>{t("users.access_expires") || "Dostęp wygasa"}</Text>
              <Text style={styles.dataValue}>
                {new Date(user.access_expires_at).toLocaleDateString("de-DE")}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.dataRow}>
          <Ionicons name="finger-print-outline" size={20} color="#64748b" />
          <View style={styles.dataRowContent}>
            <Text style={styles.dataLabel}>ID</Text>
            <Text style={[styles.dataValue, styles.idValue]} selectable>{user.id}</Text>
          </View>
        </View>
      </View>

      {/* TODO v1.4.x: akcje edycji (rola, custom_permissions, reset hasla, delete).
          Wersja minimalna 1.4.0 -- tylko podglad i back. */}
      {canEdit && !isOwnProfile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("users.actions") || "Akcje"}</Text>
          <Text style={styles.todoNote}>
            {t("users.edit_coming_soon") || "Edycja użytkownika z poziomu szczegółów — wkrótce. Na razie korzystaj z listy (Wyślij link / Reset hasła / Usuń)."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  errorText: {
    fontSize: 16,
    color: "#1e293b",
    marginVertical: 16,
    textAlign: "center",
  },
  topBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  topBackText: {
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500",
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ownProfileHint: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  dataRowContent: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  dataValue: {
    fontSize: 15,
    color: "#1e293b",
  },
  linkValue: {
    color: "#2563eb",
    textDecorationLine: "underline",
  },
  idValue: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "monospace",
  },
  todoNote: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    fontStyle: "italic",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
});
