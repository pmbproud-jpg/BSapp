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

/**
 * Step 1: Transcribe audio via OpenAI Whisper API
 */
async function transcribeAudio(audioBase64, mimeType) {
  // Convert base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // Determine file extension from mime type
  const extMap = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
  };
  const ext = extMap[mimeType] || "webm";

  // Build multipart form data manually
  const boundary = "----VoiceReportBoundary" + Date.now();
  const parts = [];

  // File part
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="recording.${ext}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const filePart = Buffer.from(parts[0]);
  const fileEnd = Buffer.from("\r\n");

  // Model part
  const modelPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
  );

  // Response format
  const formatPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`
  );

  // End boundary
  const endPart = Buffer.from(`--${boundary}--\r\n`);

  const body = Buffer.concat([filePart, audioBuffer, fileEnd, modelPart, formatPart, endPart]);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Whisper error:", response.status, errText);
    throw new Error(`Whisper API error: ${response.status}`);
  }

  const result = await response.json();
  return {
    text: result.text || "",
    language: result.language || "unknown",
    duration: result.duration || 0,
  };
}

/**
 * Step 2: Format transcription into structured report via Claude
 * - Always generates German version (for official documentation)
 * - Also returns original language version (for worker to verify)
 */
async function formatReport(transcription, detectedLang, workerName, workerRole, projectName) {
  const systemPrompt = `Du bist ein Assistent für Baustellendokumentation.
Du erhältst eine Sprachaufnahme eines Bauarbeiters, die automatisch transkribiert wurde.

Deine Aufgabe:
1. Erstelle einen strukturierten Arbeitsbericht auf DEUTSCH (immer Deutsch, egal welche Sprache gesprochen wurde)
2. Erstelle denselben Bericht in der ORIGINALSPRACHE des Arbeiters (${detectedLang})

Der Bericht soll folgende Struktur haben:
- Datum und Uhrzeit
- Mitarbeiter und Rolle
- Projekt (falls bekannt)
- Ausgeführte Arbeiten (strukturiert mit Mengen, Einheiten, Räumen/Orten)
- Material/Werkzeug (falls erwähnt)
- Besondere Hinweise/Probleme (falls erwähnt)
- Arbeitszeit (falls erwähnt)

Regeln:
- Extrahiere Mengen (Meter, Stück, m², etc.) und stelle sie klar dar
- Extrahiere Raum-/Ortsbezüge (z.B. "Raum 204", "Erdgeschoss", "Keller")
- Korrigiere offensichtliche Transkriptionsfehler
- Verwende Fachbegriffe des Bauwesens
- Halte den Bericht kompakt und professionell

Antworte IMMER in folgendem JSON-Format:
{
  "report_de": "... der vollständige Bericht auf Deutsch ...",
  "report_original": "... derselbe Bericht in der Originalsprache des Arbeiters ...",
  "detected_language": "${detectedLang}",
  "extracted_data": {
    "tasks": [{"description": "...", "quantity": "...", "unit": "...", "location": "..."}],
    "materials": [{"name": "...", "quantity": "..."}],
    "issues": ["..."],
    "work_hours": "..."
  }
}`;

  const userMessage = `Transkription der Sprachaufnahme von ${workerName} (${workerRole})${projectName ? `, Projekt: ${projectName}` : ""}:

"${transcription}"

Erstelle den strukturierten Arbeitsbericht.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude error:", response.status, errText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";

  // Parse JSON from Claude response
  try {
    // Find JSON in response (Claude may wrap it in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("JSON parse error:", e);
  }

  // Fallback: return raw text
  return {
    report_de: text,
    report_original: text,
    detected_language: detectedLang,
    extracted_data: { tasks: [], materials: [], issues: [], work_hours: null },
  };
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
  const { anthropicKey, openaiKey } = await getApiKeys();
  if (!anthropicKey || !openaiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "AI services not configured" }) };
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const profile = await verifyUser(token);
  if (!profile) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const { audioBase64, mimeType, projectId, projectName } = JSON.parse(event.body || "{}");

    if (!audioBase64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "audioBase64 required" }) };
    }

    // Step 1: Transcribe
    const transcription = await transcribeAudio(audioBase64, mimeType || "audio/webm");

    if (!transcription.text || transcription.text.trim().length < 3) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          error: null,
          transcription: "",
          report_de: "",
          report_original: "",
          detected_language: "unknown",
          extracted_data: null,
          message: "No speech detected",
        }),
      };
    }

    // Step 2: Format into report
    const formatted = await formatReport(
      transcription.text,
      transcription.language,
      profile.full_name || "Unbekannt",
      profile.role || "worker",
      projectName || null
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transcription: transcription.text,
        detected_language: transcription.language,
        duration: transcription.duration,
        report_de: formatted.report_de,
        report_original: formatted.report_original,
        extracted_data: formatted.extracted_data,
        worker: profile.full_name,
        generatedAt: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error("Voice report error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Internal error" }),
    };
  }
};
