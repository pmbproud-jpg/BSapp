import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { useProjectPrediction, ProjectPrediction, RiskLevel } from "@/src/hooks/useProjectPrediction";
import { Ionicons } from "@expo/vector-icons";

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const RISK_ICONS: Record<RiskLevel, string> = {
  low: "checkmark-circle",
  medium: "alert-circle",
  high: "warning",
  critical: "flame",
};

function RiskBadge({ level, colors, t }: { level: RiskLevel; colors: any; t: any }) {
  const color = RISK_COLORS[level];
  return (
    <View style={[styles.riskBadge, { backgroundColor: color + "18" }]}>
      <Ionicons name={RISK_ICONS[level] as any} size={14} color={color} />
      <Text style={[styles.riskBadgeText, { color }]}>
        {t(`predictions.risk_${level}`)}
      </Text>
    </View>
  );
}

function FactorBar({ factor, colors, t }: { factor: ProjectPrediction["factors"][0]; colors: any; t: any }) {
  const barColor = factor.score >= 70 ? "#ef4444" : factor.score >= 40 ? "#f59e0b" : "#22c55e";
  return (
    <View style={styles.factorRow}>
      <View style={styles.factorHeader}>
        <Text style={[styles.factorName, { color: colors.text }]}>
          {t(`predictions.factor_${factor.name}`)}
        </Text>
        <Text style={[styles.factorScore, { color: barColor }]}>{Math.round(factor.score)}</Text>
      </View>
      <View style={[styles.factorBarBg, { backgroundColor: colors.border }]}>
        <View style={[styles.factorBarFill, { width: `${Math.min(factor.score, 100)}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.factorDesc, { color: colors.textMuted }]}>{factor.description}</Text>
    </View>
  );
}

function ProjectCard({ prediction, colors, t }: { prediction: ProjectPrediction; colors: any; t: any }) {
  const riskColor = RISK_COLORS[prediction.riskLevel];
  const s = prediction.stats;

  return (
    <View style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: riskColor, borderLeftWidth: 4 }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.projectName, { color: colors.text }]}>{prediction.projectName}</Text>
          {prediction.endDate && (
            <Text style={[styles.deadline, { color: colors.textSecondary }]}>
              {t("predictions.deadline")}: {prediction.endDate}
            </Text>
          )}
        </View>
        <RiskBadge level={prediction.riskLevel} colors={colors} t={t} />
      </View>

      {/* Risk score gauge */}
      <View style={styles.gaugeRow}>
        <View style={styles.gaugeContainer}>
          <View style={[styles.gaugeBg, { backgroundColor: colors.border }]}>
            <View style={[styles.gaugeFill, { width: `${prediction.riskScore}%`, backgroundColor: riskColor }]} />
          </View>
          <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>
            {t("predictions.risk_score")}: {prediction.riskScore}/100
          </Text>
        </View>
        {prediction.predictedDelay > 0 && (
          <View style={[styles.delayBadge, { backgroundColor: "#fef2f2" }]}>
            <Ionicons name="time-outline" size={14} color="#ef4444" />
            <Text style={styles.delayText}>+{prediction.predictedDelay} {t("predictions.days")}</Text>
          </View>
        )}
      </View>

      {/* Quick stats */}
      <View style={styles.quickStats}>
        <View style={styles.qStat}>
          <Text style={[styles.qStatValue, { color: colors.text }]}>{s.completionRate}%</Text>
          <Text style={[styles.qStatLabel, { color: colors.textMuted }]}>{t("predictions.completed")}</Text>
        </View>
        <View style={styles.qStat}>
          <Text style={[styles.qStatValue, { color: colors.text }]}>{s.blockedTasks}</Text>
          <Text style={[styles.qStatLabel, { color: colors.textMuted }]}>{t("predictions.blocked")}</Text>
        </View>
        <View style={styles.qStat}>
          <Text style={[styles.qStatValue, { color: colors.text }]}>{s.taskVelocity}/w</Text>
          <Text style={[styles.qStatLabel, { color: colors.textMuted }]}>{t("predictions.velocity")}</Text>
        </View>
        <View style={styles.qStat}>
          <Text style={[styles.qStatValue, { color: colors.text }]}>{s.daysRemaining < 0 ? s.daysRemaining : s.daysRemaining}</Text>
          <Text style={[styles.qStatLabel, { color: colors.textMuted }]}>{t("predictions.days_left")}</Text>
        </View>
      </View>

      {/* Risk factors */}
      <View style={styles.factorsSection}>
        {prediction.factors.map((f) => (
          <FactorBar key={f.name} factor={f} colors={colors} t={t} />
        ))}
      </View>

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <View style={[styles.recsSection, { borderTopColor: colors.border }]}>
          {prediction.recommendations.map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
              <Text style={[styles.recText, { color: colors.textSecondary }]}>
                {t(`predictions.rec_${rec}`)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PredictionsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { loading, predictions, analyzeProjects } = useProjectPrediction();

  useEffect(() => {
    analyzeProjects();
  }, []);

  const criticalCount = predictions.filter((p) => p.riskLevel === "critical").length;
  const highCount = predictions.filter((p) => p.riskLevel === "high").length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Ionicons name="trending-up" size={28} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{t("predictions.title")}</Text>
        <TouchableOpacity onPress={analyzeProjects} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t("predictions.analyzing")}</Text>
        </View>
      )}

      {!loading && predictions.length > 0 && (
        <>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
              <Text style={[styles.summaryValue, { color: "#ef4444" }]}>{criticalCount}</Text>
              <Text style={styles.summaryLabel}>{t("predictions.risk_critical")}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}>
              <Text style={[styles.summaryValue, { color: "#f97316" }]}>{highCount}</Text>
              <Text style={styles.summaryLabel}>{t("predictions.risk_high")}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <Text style={[styles.summaryValue, { color: "#22c55e" }]}>{predictions.length}</Text>
              <Text style={styles.summaryLabel}>{t("predictions.total_projects")}</Text>
            </View>
          </View>

          {predictions.map((p) => (
            <ProjectCard key={p.projectId} prediction={p} colors={colors} t={t} />
          ))}
        </>
      )}

      {!loading && predictions.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t("predictions.no_projects")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", flex: 1 },
  refreshBtn: { padding: 6 },
  loadingContainer: { alignItems: "center", paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: 14 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  summaryValue: { fontSize: 24, fontWeight: "700" },
  summaryLabel: { fontSize: 11, color: "#64748b", marginTop: 2, textAlign: "center" },
  projectCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  projectName: { fontSize: 16, fontWeight: "700" },
  deadline: { fontSize: 12, marginTop: 2 },
  riskBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  riskBadgeText: { fontSize: 12, fontWeight: "700" },
  gaugeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  gaugeContainer: { flex: 1 },
  gaugeBg: { height: 8, borderRadius: 4 },
  gaugeFill: { height: 8, borderRadius: 4 },
  gaugeLabel: { fontSize: 11, marginTop: 3 },
  delayBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  delayText: { fontSize: 12, fontWeight: "700", color: "#ef4444" },
  quickStats: { flexDirection: "row", marginBottom: 12 },
  qStat: { flex: 1, alignItems: "center" },
  qStatValue: { fontSize: 16, fontWeight: "700" },
  qStatLabel: { fontSize: 10, marginTop: 1 },
  factorsSection: { gap: 8, marginBottom: 10 },
  factorRow: { gap: 2 },
  factorHeader: { flexDirection: "row", justifyContent: "space-between" },
  factorName: { fontSize: 12, fontWeight: "600" },
  factorScore: { fontSize: 12, fontWeight: "700" },
  factorBarBg: { height: 4, borderRadius: 2 },
  factorBarFill: { height: 4, borderRadius: 2 },
  factorDesc: { fontSize: 10 },
  recsSection: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  recRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  recText: { fontSize: 12, flex: 1, lineHeight: 16 },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 15, marginTop: 12 },
});
