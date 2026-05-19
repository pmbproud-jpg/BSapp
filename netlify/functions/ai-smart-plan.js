const { createClient } = require("@supabase/supabase-js");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://bsapp-management.netlify.app";
const { getApiKeys } = require("./lib/get-api-keys");
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function gatherPlanData(weekStart) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Active projects with priority tasks
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, location, end_date")
    .in("status", ["active", "planning"]);

  // Urgent / high-priority tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, project_id, assigned_to")
    .in("status", ["todo", "in_progress", "blocked"])
    .order("priority", { ascending: true })
    .limit(80);

  // Workers (with roles and GPS info)
  const { data: workers } = await supabase
    .from("profiles")
    .select("id, full_name, role, last_latitude, last_longitude")
    .in("role", ["worker", "bauleiter", "subcontractor"]);

  // Absences for the week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const { data: absences } = await supabase
    .from("user_absences")
    .select("user_id, type, start_date, end_date, status")
    .eq("status", "approved")
    .lte("start_date", weekEnd.toISOString().split("T")[0])
    .gte("end_date", weekStart);

  // Existing plan assignments for the week
  const { data: existingPlan } = await supabase
    .from("plan_assignments")
    .select("worker_id, day, project_id")
    .gte("day", weekStart)
    .lte("day", weekEnd.toISOString().split("T")[0]);

  // Vehicles
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, name, seats, license_plate")
    .eq("active", true);

  return {
    projects: projects || [],
    tasks: tasks || [],
    workers: workers || [],
    absences: absences || [],
    existingPlan: existingPlan || [],
    vehicles: vehicles || [],
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = getCorsHeaders(origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  if (origin !== ALLOWED_ORIGIN) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
  const { anthropicKey } = await getApiKeys();
  if (!anthropicKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "AI not configured" }) };

  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const profile = await verifyUser(token);
  if (!profile) return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };

  try {
    const { weekStart, language } = JSON.parse(event.body || "{}");
    if (!weekStart) return { statusCode: 400, headers, body: JSON.stringify({ error: "weekStart required (YYYY-MM-DD)" }) };

    const data = await gatherPlanData(weekStart);

    const langInstruction = language === "pl"
      ? "Antworte auf Polnisch."
      : language === "en"
        ? "Answer in English."
        : "Antworte auf Deutsch.";

    const systemPrompt = `Du bist ein KI-Planungsassistent für Baustellenmanagement.
${langInstruction}

Deine Aufgabe: Erstelle einen optimalen Wochenplan für die Zuweisung von Arbeitern zu Bauprojekten.

Berücksichtige:
1. Aufgabenprioritäten (urgent > high > medium > low)
2. Deadlines der Projekte
3. Abwesenheiten der Mitarbeiter
4. Bestehende Zuweisungen (nicht doppelt zuweisen)
5. Teamgröße und Auslastung
6. Blockierte Aufgaben (diese Projekte brauchen evtl. Problemlösung statt mehr Personal)

Antworte IMMER in folgendem JSON-Format:
{
  "suggestions": [
    {
      "day": "YYYY-MM-DD",
      "worker_id": "uuid",
      "worker_name": "Name",
      "project_id": "uuid",
      "project_name": "Projektname",
      "reason": "Warum dieser Arbeiter an diesem Tag auf dieses Projekt"
    }
  ],
  "warnings": ["Hinweise zu Engpässen, Konflikten, Risiken"],
  "summary": "Kurze Zusammenfassung des Plans (3-4 Sätze)"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Erstelle den Wochenplan für die Woche ab ${weekStart}.\n\nDaten:\n${JSON.stringify(data, null, 2)}`,
        }],
      }),
    });

    if (!response.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "AI service error" }) };
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    // Parse JSON
    let plan;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [], warnings: [text], summary: text };
    } catch {
      plan = { suggestions: [], warnings: [], summary: text };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...plan,
        weekStart,
        generatedAt: new Date().toISOString(),
        stats: {
          projects: data.projects.length,
          workers: data.workers.length,
          absences: data.absences.length,
          urgentTasks: data.tasks.filter((t) => t.priority === "urgent" || t.priority === "high").length,
        },
      }),
    };
  } catch (err) {
    console.error("Smart plan error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || "Internal error" }) };
  }
};
