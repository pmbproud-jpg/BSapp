/**
 * Helper to get API keys — first from DB (company_settings), then fallback to env vars.
 * This allows admin to set keys from within the app UI.
 */
const { createClient } = require("@supabase/supabase-js");

let cachedKeys = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getApiKeys() {
  // Return cached if fresh
  if (cachedKeys && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedKeys;
  }

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let dbAnthropicKey = null;
  let dbOpenaiKey = null;

  // Try to read from database
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data } = await supabase
        .from("company_settings")
        .select("anthropic_api_key, openai_api_key")
        .limit(1)
        .single();

      if (data) {
        dbAnthropicKey = data.anthropic_api_key || null;
        dbOpenaiKey = data.openai_api_key || null;
      }
    } catch (e) {
      // Silently fail — columns may not exist yet
      console.warn("Could not read API keys from DB:", e.message);
    }
  }

  // DB keys take priority over env vars
  const keys = {
    anthropicKey: dbAnthropicKey || process.env.ANTHROPIC_API_KEY || null,
    openaiKey: dbOpenaiKey || process.env.OPENAI_API_KEY || null,
  };

  cachedKeys = keys;
  cacheTimestamp = Date.now();

  return keys;
}

module.exports = { getApiKeys };
