const { createClient } = require("@supabase/supabase-js");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://bsapp-management.netlify.app";
const { getApiKeys } = require("./lib/get-api-keys");
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Report type prompts ───

const REPORT_PROMPTS = {
  daily: `Erstelle einen professionellen Tagesbericht (Bautagebericht) für das Bauprojekt.
Der Bericht soll enthalten:
1. Kopfzeile: Projekt, Datum, Bauleiter
2. Wetterbedingungen (falls Informationen vorhanden, sonst auslassen)
3. Personalübersicht: Anzahl Arbeiter, anwesend/abwesend
4. Ausgeführte Arbeiten (basierend auf heute abgeschlossenen/bearbeiteten Aufgaben)
5. Materialverbrauch (falls Lagerdaten vorhanden)
6. Besondere Vorkommnisse / Probleme (blockierte Aufgaben)
7. Geplante Arbeiten für morgen (offene Aufgaben mit hoher Priorität)
8. Unterschriftsfeld

Formatiere als professionelles Dokument mit klarer Struktur.`,

  weekly: `Erstelle einen Wochenbericht für das Bauprojekt.
Der Bericht soll enthalten:
1. Projektstatus-Zusammenfassung (Fortschritt in %)
2. Erledigte Aufgaben diese Woche (mit Zuweisungen)
3. Offene / blockierte Aufgaben
4. Personalstatistik (GPS-Anwesenheit falls verfügbar)
5. Budget-Übersicht (Soll vs. Ist falls verfügbar)
6. Risiken und Probleme
7. Geplante Aktivitäten nächste Woche
8. Empfehlungen

Formatiere als strukturierten Managementbericht.`,

  monthly: `Erstelle einen monatlichen Projektstatusbericht.
Der Bericht soll enthalten:
1. Executive Summary (3-4 Sätze)
2. Projektkennzahlen (KPIs): Fortschritt, Budget, Zeitplan
3. Meilensteine: erreicht und ausstehend
4. Aufgabenstatistik: erledigt, offen, blockiert (mit Trend)
5. Personalauslastung
6. Kostenübersicht und Prognose
7. Risikobewertung (Top 3 Risiken)
8. Handlungsempfehlungen
9. Ausblick nächster Monat

Formatiere als professionellen Management-Report mit Kennzahlen.`,

  safety: `Erstelle eine Arbeitsschutz-Checkliste und Sicherheitsbeurteilung für die Baustelle.
Basierend auf den Projektdaten:
1. Allgemeine Sicherheitslage
2. Identifizierte Gefahren (basierend auf Aufgabentypen)
3. Erforderliche PSA (Persönliche Schutzausrüstung)
4. Prüfpunkte für die Baustelle (15-20 Punkte)
5. Notfallkontakte und -verfahren (Vorlage)
6. Dokumentationspflichten
7. Empfohlene Unterweisungsthemen

Formatiere als ausfüllbare Checkliste mit [ ] Checkboxen.`,
};

// ─── Helpers ───

function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function verifyUser(token) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();
  return profile;
}

async function gatherProjectData(projectId, reportType) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sections = {};

  // 1. Project details
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (!project) return null;
  sections.project = project;

  // 2. Tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, description, status, priority, due_date, created_at, completed_at, assigned_to")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  sections.tasks = tasks || [];

  // 3. Task stats
  const taskStats = {
    total: sections.tasks.length,
    todo: sections.tasks.filter((t) => t.status === "todo").length,
    in_progress: sections.tasks.filter((t) => t.status === "in_progress").length,
    completed: sections.tasks.filter((t) => t.status === "completed").length,
    blocked: sections.tasks.filter((t) => t.status === "blocked").length,
  };
  taskStats.completion_rate = taskStats.total > 0
    ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
  sections.taskStats = taskStats;

  // 4. Project members
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", projectId);
  if (members && members.length > 0) {
    const userIds = members.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", userIds);
    sections.members = profiles || [];
  } else {
    sections.members = [];
  }

  // 5. Recent task comments (for daily/weekly)
  if (reportType === "daily" || reportType === "weekly") {
    const daysBack = reportType === "daily" ? 1 : 7;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const { data: comments } = await supabase
      .from("task_comments")
      .select("content, created_at, task_id")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(30);
    sections.recentComments = comments || [];
  }

  // 6. Recently completed tasks (time-filtered)
  if (reportType === "daily") {
    const today = new Date().toISOString().split("T")[0];
    sections.todayCompleted = sections.tasks.filter(
      (t) => t.status === "completed" && t.completed_at && t.completed_at.startsWith(today)
    );
    sections.todayInProgress = sections.tasks.filter((t) => t.status === "in_progress");
    sections.todayBlocked = sections.tasks.filter((t) => t.status === "blocked");
  }

  // 7. Warehouse data (for daily/monthly)
  if (reportType === "daily" || reportType === "monthly") {
    const { data: materials } = await supabase
      .from("warehouse_materials")
      .select("name, quantity, unit, min_stock_quantity")
      .limit(50);
    sections.materials = materials || [];
    sections.lowStockMaterials = (materials || []).filter(
      (m) => m.min_stock_quantity && m.quantity <= m.min_stock_quantity
    );
  }

  // 8. Absences (for daily/weekly)
  if (reportType === "daily" || reportType === "weekly") {
    const today = new Date().toISOString().split("T")[0];
    const { data: absences } = await supabase
      .from("user_absences")
      .select("user_id, type, start_date, end_date, status")
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("status", "approved");
    sections.absences = absences || [];
  }

  return sections;
}

// ─── Handler ───

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  }
  const { anthropicKey } = await getApiKeys();
  if (!anthropicKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "AI not configured" }) };
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const profile = await verifyUser(token);
  if (!profile) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const { projectId, reportType, language } = JSON.parse(event.body || "{}");

    if (!projectId || !reportType) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "projectId and reportType required" }) };
    }

    const validTypes = Object.keys(REPORT_PROMPTS);
    if (!validTypes.includes(reportType)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid reportType. Valid: ${validTypes.join(", ")}` }) };
    }

    // Gather all project data
    const projectData = await gatherProjectData(projectId, reportType);
    if (!projectData) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Project not found" }) };
    }

    // Build prompt
    const langInstruction = language === "pl"
      ? "Schreibe den gesamten Bericht auf Polnisch."
      : language === "en"
        ? "Write the entire report in English."
        : "Schreibe den Bericht auf Deutsch.";

    const systemPrompt = `Du bist ein professioneller Bauprojekt-Berichtsersteller.
${langInstruction}
Datum heute: ${new Date().toISOString().split("T")[0]}
Ersteller: ${profile.full_name || "Unbekannt"} (${profile.role})`;

    const dataContext = `Hier sind die aktuellen Projektdaten:\n\n${JSON.stringify(projectData, null, 2)}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: `${REPORT_PROMPTS[reportType]}\n\n---\n\n${dataContext}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "AI service error" }) };
    }

    const result = await response.json();
    const reportText = result.content?.[0]?.text || "";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        report: reportText,
        reportType,
        projectName: projectData.project?.name || "",
        generatedAt: new Date().toISOString(),
        generatedBy: profile.full_name || "",
        taskStats: projectData.taskStats,
        usage: {
          input_tokens: result.usage?.input_tokens || 0,
          output_tokens: result.usage?.output_tokens || 0,
        },
      }),
    };
  } catch (err) {
    console.error("AI Report error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || "Internal error" }) };
  }
};
