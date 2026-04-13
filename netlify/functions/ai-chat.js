const { createClient } = require("@supabase/supabase-js");
const { getApiKeys } = require("./lib/get-api-keys");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://bsapp-management.netlify.app";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SYSTEM_PROMPT = `Du bist ein KI-Bauassistent in der BSapp-Plattform für Baustellenmanagement.

Deine Aufgaben:
- Fragen zu Bauprojekten, Aufgaben, Zeitplanung und Ressourcen beantworten
- Bei deutschen Baunormen (VOB/B, DIN, HOAI) und Vorschriften helfen
- Baustellenberichte und Dokumentation erstellen
- Arbeitsschutz- und Sicherheitshinweise geben
- Bei Material- und Werkzeugplanung unterstützen
- Tagesberichte und Protokolle formulieren

Regeln:
- Antworte in der Sprache des Benutzers (Deutsch, Polnisch oder Englisch)
- Sei präzise und praxisorientiert
- Verweise auf relevante Normen und Vorschriften wenn passend
- Wenn du Projektdaten erhältst, beziehe dich darauf in deinen Antworten
- Formatiere Antworten übersichtlich mit Aufzählungen wenn sinnvoll`;

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

async function getProjectContext(projectId, token) {
  if (!projectId || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: project } = await supabase
    .from("projects")
    .select("name, description, status, budget, start_date, end_date, location")
    .eq("id", projectId)
    .single();

  if (!project) return null;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, priority, due_date")
    .eq("project_id", projectId)
    .limit(20);

  return { project, tasks: tasks || [] };
}

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
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  }

  // Get API keys from DB or env
  const { anthropicKey } = await getApiKeys();
  if (!anthropicKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "AI not configured" }) };
  }

  // Verify JWT
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const profile = await verifyUser(token);

  if (!profile) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const { messages, projectId, language } = JSON.parse(event.body || "{}");

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Messages required" }) };
    }

    // Limit message history to prevent token overflow
    const recentMessages = messages.slice(-20);

    // Build context
    let contextInfo = `\nBenutzer: ${profile.full_name || "Unbekannt"}, Rolle: ${profile.role}`;
    contextInfo += `\nBevorzugte Sprache: ${language || "de"}`;

    if (projectId) {
      const ctx = await getProjectContext(projectId, token);
      if (ctx) {
        contextInfo += `\n\nAktuelles Projekt: ${ctx.project.name}`;
        contextInfo += `\nStatus: ${ctx.project.status}`;
        if (ctx.project.description) contextInfo += `\nBeschreibung: ${ctx.project.description}`;
        if (ctx.project.budget) contextInfo += `\nBudget: ${ctx.project.budget} EUR`;
        if (ctx.project.location) contextInfo += `\nStandort: ${ctx.project.location}`;
        if (ctx.project.start_date) contextInfo += `\nStartdatum: ${ctx.project.start_date}`;
        if (ctx.project.end_date) contextInfo += `\nEnddatum: ${ctx.project.end_date}`;

        if (ctx.tasks.length > 0) {
          contextInfo += `\n\nAufgaben (${ctx.tasks.length}):`;
          ctx.tasks.forEach((t) => {
            contextInfo += `\n- ${t.title} [${t.status}${t.priority ? ", " + t.priority : ""}${t.due_date ? ", fällig: " + t.due_date : ""}]`;
          });
        }
      }
    }

    const systemPrompt = SYSTEM_PROMPT + contextInfo;

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "AI service error", details: response.status }),
      };
    }

    const result = await response.json();
    const assistantMessage = result.content?.[0]?.text || "";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: assistantMessage,
        usage: {
          input_tokens: result.usage?.input_tokens || 0,
          output_tokens: result.usage?.output_tokens || 0,
        },
      }),
    };
  } catch (err) {
    console.error("AI Chat error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Internal error" }),
    };
  }
};
