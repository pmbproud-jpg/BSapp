/**
 * Netlify Function — Secure Supabase Admin Proxy
 * 
 * Accepts authenticated requests from the frontend and executes them
 * using the Service Role Key (which is only available server-side).
 * 
 * Supported operation types:
 *   1. DB operations:      { type: "db",      table, action, params }
 *   2. Storage operations:  { type: "storage", bucket, action, params }
 *   3. Auth admin ops:      { type: "auth",    action, params }
 * 
 * Legacy format (no type field) is treated as DB operation for backward compat.
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Service Role Key MUSI być ustawiony w Netlify env variables (bez prefiksu EXPO_PUBLIC_)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is not set in environment variables");
}
const ALLOWED_ORIGIN = "https://bsapp-management.netlify.app";

// Tables that are allowed to be accessed via this proxy
const ALLOWED_TABLES = new Set([
  "profiles", "projects", "project_members", "tasks", "task_assignees",
  "task_attachments", "project_attachments",
  "vehicles", "plan_assignments", "plan_requests", "plan_request_workers",
  "user_absences", "user_locations", "notifications", "company_settings",
  "warehouse_items", "warehouse_materials", "project_material_orders",
  "project_tool_orders", "attachment_folders", "project_plans", "plan_pins",
]);

// DB actions that are allowed
const ALLOWED_DB_ACTIONS = new Set([
  "select", "insert", "update", "upsert", "delete",
]);

// Storage buckets that are allowed
const ALLOWED_BUCKETS = new Set([
  "attachments", "project-plans",
]);

// Storage actions that are allowed
const ALLOWED_STORAGE_ACTIONS = new Set([
  "upload", "getPublicUrl", "createSignedUrl", "remove",
]);

// Auth admin actions that are allowed
const ALLOWED_AUTH_ACTIONS = new Set([
  "createUser", "deleteUser", "generateLink",
]);

function getHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

// ─── Apply filters to a query builder ───
function applyFilters(query, filters) {
  for (const f of filters) {
    if (f.type === "eq") query = query.eq(f.column, f.value);
    else if (f.type === "neq") query = query.neq(f.column, f.value);
    else if (f.type === "in") query = query.in(f.column, f.value);
    else if (f.type === "is") query = query.is(f.column, f.value);
    else if (f.type === "gte") query = query.gte(f.column, f.value);
    else if (f.type === "lte") query = query.lte(f.column, f.value);
    else if (f.type === "gt") query = query.gt(f.column, f.value);
    else if (f.type === "lt") query = query.lt(f.column, f.value);
    else if (f.type === "like") query = query.like(f.column, f.value);
    else if (f.type === "ilike") query = query.ilike(f.column, f.value);
    else if (f.type === "or") query = query.or(f.value);
    else if (f.type === "not") query = query.not(f.column, f.operator, f.value);
    else if (f.type === "contains") query = query.contains(f.column, f.value);
    else if (f.type === "containedBy") query = query.containedBy(f.column, f.value);
    else if (f.type === "textSearch") query = query.textSearch(f.column, f.value);
    else if (f.type === "match") query = query.match(f.value);
    else if (f.type === "range") query = query.range(f.from, f.to);
    else if (f.type === "maybeSingle") query = query.maybeSingle();
  }
  return query;
}

// ─── Handle DB operations ───
async function handleDb(adminClient, body) {
  const { table, action, params } = body;

  if (!table || !action) {
    return { statusCode: 400, body: { error: "Missing table or action" } };
  }
  if (!ALLOWED_TABLES.has(table)) {
    return { statusCode: 403, body: { error: `Table '${table}' not allowed` } };
  }
  if (!ALLOWED_DB_ACTIONS.has(action)) {
    return { statusCode: 403, body: { error: `Action '${action}' not allowed` } };
  }

  let query = adminClient.from(table);

  switch (action) {
    case "select": {
      const { select = "*", filters = [], order, limit, single, maybeSingle } = params || {};
      query = query.select(select);
      query = applyFilters(query, filters);
      if (order) {
        for (const o of (Array.isArray(order) ? order : [order])) {
          query = query.order(o.column, { ascending: o.ascending !== false });
        }
      }
      if (limit) query = query.limit(limit);
      if (single) query = query.single();
      else if (maybeSingle) query = query.maybeSingle();
      break;
    }
    case "insert": {
      const { data, onConflict, select: sel, single, maybeSingle } = params || {};
      if (onConflict) {
        query = query.upsert(data, { onConflict });
      } else {
        query = query.insert(data);
      }
      if (sel) query = query.select(sel);
      if (single) query = query.single();
      else if (maybeSingle) query = query.maybeSingle();
      break;
    }
    case "upsert": {
      const { data, onConflict, select: sel, single, maybeSingle } = params || {};
      query = query.upsert(data, onConflict ? { onConflict } : undefined);
      if (sel) query = query.select(sel);
      if (single) query = query.single();
      else if (maybeSingle) query = query.maybeSingle();
      break;
    }
    case "update": {
      const { data, filters = [], select: sel, single, maybeSingle } = params || {};
      query = query.update(data);
      query = applyFilters(query, filters);
      if (sel) query = query.select(sel);
      if (single) query = query.single();
      else if (maybeSingle) query = query.maybeSingle();
      break;
    }
    case "delete": {
      const { filters = [] } = params || {};
      query = query.delete();
      query = applyFilters(query, filters);
      break;
    }
  }

  const { data, error } = await query;
  if (error) {
    return { statusCode: 400, body: { error: error.message, details: error } };
  }
  return { statusCode: 200, body: { data } };
}

// ─── Handle Storage operations ───
async function handleStorage(adminClient, body) {
  const { bucket, action, params } = body;

  if (!bucket || !action) {
    return { statusCode: 400, body: { error: "Missing bucket or action" } };
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return { statusCode: 403, body: { error: `Bucket '${bucket}' not allowed` } };
  }
  if (!ALLOWED_STORAGE_ACTIONS.has(action)) {
    return { statusCode: 403, body: { error: `Storage action '${action}' not allowed` } };
  }

  const storage = adminClient.storage.from(bucket);

  switch (action) {
    case "upload": {
      const { path, base64, contentType, upsert = false } = params || {};
      if (!path || !base64) {
        return { statusCode: 400, body: { error: "Missing path or base64 data" } };
      }
      const buffer = Buffer.from(base64, "base64");
      const { data, error } = await storage.upload(path, buffer, {
        contentType: contentType || "application/octet-stream",
        upsert,
      });
      if (error) {
        return { statusCode: 400, body: { error: error.message, details: error } };
      }
      return { statusCode: 200, body: { data } };
    }
    case "getPublicUrl": {
      const { path } = params || {};
      if (!path) {
        return { statusCode: 400, body: { error: "Missing path" } };
      }
      const { data } = storage.getPublicUrl(path);
      return { statusCode: 200, body: { data } };
    }
    case "createSignedUrl": {
      const { path, expiresIn = 3600 } = params || {};
      if (!path) {
        return { statusCode: 400, body: { error: "Missing path" } };
      }
      const { data, error } = await storage.createSignedUrl(path, expiresIn);
      if (error) {
        return { statusCode: 400, body: { error: error.message, details: error } };
      }
      return { statusCode: 200, body: { data } };
    }
    case "remove": {
      const { paths } = params || {};
      if (!paths || !Array.isArray(paths)) {
        return { statusCode: 400, body: { error: "Missing paths array" } };
      }
      const { data, error } = await storage.remove(paths);
      if (error) {
        return { statusCode: 400, body: { error: error.message, details: error } };
      }
      return { statusCode: 200, body: { data } };
    }
  }

  return { statusCode: 400, body: { error: "Unknown storage action" } };
}

// ─── Handle Auth Admin operations ───
async function handleAuth(adminClient, body) {
  const { action, params } = body;

  if (!action) {
    return { statusCode: 400, body: { error: "Missing action" } };
  }
  if (!ALLOWED_AUTH_ACTIONS.has(action)) {
    return { statusCode: 403, body: { error: `Auth action '${action}' not allowed` } };
  }

  switch (action) {
    case "createUser": {
      const { email, password, email_confirm = true, user_metadata } = params || {};
      if (!email || !password) {
        return { statusCode: 400, body: { error: "Missing email or password" } };
      }
      const opts = { email, password, email_confirm };
      if (user_metadata) opts.user_metadata = user_metadata;
      const { data, error } = await adminClient.auth.admin.createUser(opts);
      if (error) {
        return { statusCode: 400, body: { error: error.message, details: error } };
      }
      return { statusCode: 200, body: { data } };
    }
    case "deleteUser": {
      const { userId } = params || {};
      if (!userId) {
        return { statusCode: 400, body: { error: "Missing userId" } };
      }
      const { data, error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        return { statusCode: 400, body: { error: error.message, details: error } };
      }
      return { statusCode: 200, body: { data } };
    }
    case "generateLink": {
      const { type, email, options } = params || {};
      if (!type || !email) {
        return { statusCode: 400, body: { error: "Missing type or email" } };
      }
      const { data, error } = await adminClient.auth.admin.generateLink({
        type,
        email,
        options: options || {},
      });
      if (error) {
        return { statusCode: 400, body: { error: error.message, details: error } };
      }
      return { statusCode: 200, body: { data } };
    }
  }

  return { statusCode: 400, body: { error: "Unknown auth action" } };
}

// ─── Main handler ───
exports.handler = async (event) => {
  const origin = event.headers?.origin || "";
  const headers = getHeaders(origin);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured: missing service role key" }) };
  }

  // Verify user is authenticated via their JWT
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "No auth token" }) };
  }

  try {
    // Verify the JWT using anon client
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid token" }) };
    }

    // Create admin client
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request
    const body = JSON.parse(event.body || "{}");
    const opType = body.type || "db"; // default to "db" for backward compat

    let result;
    switch (opType) {
      case "db":
        result = await handleDb(adminClient, body);
        break;
      case "storage":
        result = await handleStorage(adminClient, body);
        break;
      case "auth":
        result = await handleAuth(adminClient, body);
        break;
      default:
        result = { statusCode: 400, body: { error: `Unknown operation type '${opType}'` } };
    }

    return {
      statusCode: result.statusCode,
      headers,
      body: JSON.stringify(result.body),
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || "Internal error" }) };
  }
};
