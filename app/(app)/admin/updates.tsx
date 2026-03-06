import { useTheme } from "@/src/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const APP_VERSION = "1.0.0";
const BUILD_DATE = "2026-03-06";
const EAS_BUILD_URL = "https://expo.dev/accounts/pmb.proud/projects/BSapp/builds/7fa6fcda-65ab-4c8a-8a87-053d0b3222c7";
const NETLIFY_URL = "https://app.netlify.com/sites/bsapp-management";
const SUPABASE_URL = "https://supabase.com/dashboard";
const WEB_APP_URL = "https://bsapp-management.netlify.app";

export default function AdminUpdatesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const openUrl = (url: string) => {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  const links = [
    { label: "Web App (Netlify)", url: WEB_APP_URL, icon: "globe", color: "#00c7b7" },
    { label: "Netlify Dashboard", url: NETLIFY_URL, icon: "cloud", color: "#00c7b7" },
    { label: "Supabase Dashboard", url: SUPABASE_URL, icon: "server", color: "#3ecf8e" },
    { label: "EAS Build (APK)", url: EAS_BUILD_URL, icon: "phone-portrait", color: "#4630eb" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="cloud-download" size={24} color="#ef4444" />
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("admin.updates", "Aktualizacje")}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("admin.app_info", "Informacje o aplikacji")}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                {t("admin.version", "Wersja")}
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>v{APP_VERSION}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                {t("admin.build_date", "Data buildu")}
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{BUILD_DATE}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                {t("admin.platform", "Platforma")}
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {Platform.OS === "web" ? "Web" : Platform.OS === "android" ? "Android" : "iOS"}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Stack</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>Expo + Supabase + Netlify</Text>
            </View>
          </View>
        </View>

        {/* QR Code for APK download */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("admin.download_apk", "Pobierz APK (Android)")}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center" }]}>
            {Platform.OS === "web" ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(EAS_BUILD_URL)}`}
                alt="QR Code"
                style={{ width: 200, height: 200, borderRadius: 8 }}
              />
            ) : (
              <View style={{ alignItems: "center" }}>
                <Ionicons name="qr-code" size={80} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                  {t("admin.qr_web_only", "Kod QR dostępny na wersji web")}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: "#4630eb" }]}
              onPress={() => openUrl(EAS_BUILD_URL)}
            >
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginLeft: 8 }}>
                {t("admin.download", "Pobierz APK")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("admin.quick_links", "Szybkie linki")}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {links.map((link, idx) => (
              <View key={link.url}>
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => openUrl(link.url)}
                >
                  <Ionicons name={link.icon as any} size={20} color={link.color} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.linkLabel, { color: colors.text }]}>{link.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }} numberOfLines={1}>{link.url}</Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {idx < links.length - 1 && <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />}
              </View>
            ))}
          </View>
        </View>

        {/* How to update */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("admin.how_to_update", "Jak zaktualizować?")}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: "#3b82f6" }]}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>1</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Web</Text>
                <Text style={[styles.stepDesc, { color: colors.textMuted }]}>
                  Push na branch "main" → Netlify automatycznie builduje i deployuje
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: "#10b981" }]}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>2</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Android (APK)</Text>
                <Text style={[styles.stepDesc, { color: colors.textMuted }]}>
                  npx eas-cli build --platform android --profile preview{"\n"}
                  Nowy APK → wyślij link lub QR użytkownikom
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: "#f59e0b" }]}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>3</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Baza danych</Text>
                <Text style={[styles.stepDesc, { color: colors.textMuted }]}>
                  Migracje SQL wykonuj w Supabase Dashboard → SQL Editor
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Installation page link */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.installButton, { borderColor: colors.border }]}
            onPress={() => openUrl(`${WEB_APP_URL}/docs/instrukcja-instalacji.html`)}
          >
            <Ionicons name="document-text" size={20} color="#3b82f6" />
            <Text style={{ color: "#3b82f6", fontWeight: "600", fontSize: 14, marginLeft: 8 }}>
              {t("admin.installation_page", "Strona instalacji dla użytkowników")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backButton: {
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 2,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  installButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
