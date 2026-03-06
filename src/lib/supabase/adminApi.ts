/**
 * Admin API Client — secure proxy for Supabase admin operations.
 *
 * Instead of using supabaseAdmin (which exposes Service Role Key on frontend),
 * this client sends requests to /.netlify/functions/supabase-admin which
 * executes them server-side after JWT verification.
 *
 * API is designed to be a drop-in replacement for supabaseAdmin:
 *   supabaseAdmin.from("profiles").select("*").eq("id", x)
 *   →  adminApi.from("profiles").select("*").eq("id", x)
 *
 * Storage:
 *   supabaseAdmin.storage.from("bucket").upload(path, data, opts)
 *   →  adminApi.storage.from("bucket").upload(path, data, opts)
 *
 * Auth:
 *   supabaseAdmin.auth.admin.createUser(opts)
 *   →  adminApi.auth.admin.createUser(opts)
 */

import { Platform } from "react-native";
import { supabase } from "./client";

const PROXY_URL = Platform.OS === "web"
  ? "/.netlify/functions/supabase-admin"
  : `${process.env.EXPO_PUBLIC_APP_URL || "https://bsapp-management.netlify.app"}/.netlify/functions/supabase-admin`;

// ─── Helpers ───

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function callProxy(body: Record<string, any>): Promise<{ data: any; error: any }> {
  try {
    const token = await getAuthToken();
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return {
        data: null,
        error: {
          message: result.error || `HTTP ${response.status}`,
          details: result.details || null,
        },
      };
    }

    return { data: result.data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err.message || "Network error", details: null },
    };
  }
}

// Convert blob/ArrayBuffer/Uint8Array to base64 string
async function toBase64(input: any): Promise<string> {
  // Already base64 string
  if (typeof input === "string") return input;

  // Blob (web)
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data:...;base64, prefix
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  // ArrayBuffer
  if (input instanceof ArrayBuffer) {
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa !== "undefined") return btoa(binary);
    // Node fallback
    return Buffer.from(bytes).toString("base64");
  }

  // Uint8Array
  if (input instanceof Uint8Array) {
    let binary = "";
    for (let i = 0; i < input.length; i++) {
      binary += String.fromCharCode(input[i]);
    }
    if (typeof btoa !== "undefined") return btoa(binary);
    return Buffer.from(input).toString("base64");
  }

  throw new Error("Unsupported data type for storage upload");
}

// ─── Filter type ───

type Filter = {
  type: string;
  column?: string;
  value?: any;
  operator?: string;
  from?: number;
  to?: number;
};

// ─── Query Builder (mimics Supabase PostgREST builder) ───

class QueryBuilder {
  private _table: string;
  private _action: string = "select";
  private _selectColumns: string = "*";
  private _filters: Filter[] = [];
  private _order: { column: string; ascending: boolean }[] = [];
  private _limit?: number;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _data: any = null;
  private _onConflict?: string;
  private _selectAfter?: string;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = "*") {
    this._action = "select";
    this._selectColumns = columns;
    return this;
  }

  insert(data: any) {
    this._action = "insert";
    this._data = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this._action = "upsert";
    this._data = data;
    if (options?.onConflict) this._onConflict = options.onConflict;
    return this;
  }

  update(data: any) {
    this._action = "update";
    this._data = data;
    return this;
  }

  delete() {
    this._action = "delete";
    return this;
  }

  // ─── Filters ───

  eq(column: string, value: any) {
    this._filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this._filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this._filters.push({ type: "in", column, value });
    return this;
  }

  is(column: string, value: any) {
    this._filters.push({ type: "is", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this._filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this._filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column: string, value: any) {
    this._filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column: string, value: any) {
    this._filters.push({ type: "lt", column, value });
    return this;
  }

  like(column: string, value: string) {
    this._filters.push({ type: "like", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this._filters.push({ type: "ilike", column, value });
    return this;
  }

  or(value: string) {
    this._filters.push({ type: "or", value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this._filters.push({ type: "not", column, operator, value });
    return this;
  }

  contains(column: string, value: any) {
    this._filters.push({ type: "contains", column, value });
    return this;
  }

  match(value: Record<string, any>) {
    this._filters.push({ type: "match", value });
    return this;
  }

  // ─── Modifiers ───

  order(column: string, options?: { ascending?: boolean }) {
    this._order.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this._limit = count;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  // After insert/update/upsert — .select("*")
  // Supabase allows: .insert(data).select("col")
  // We detect if action is not "select" and this is called after
  private _isChainedSelect = false;

  // ─── Execute (thenable) ───

  then(
    resolve: (value: { data: any; error: any }) => any,
    reject?: (reason: any) => any
  ) {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<{ data: any; error: any }> {
    const params: Record<string, any> = {};

    switch (this._action) {
      case "select":
        params.select = this._selectColumns;
        params.filters = this._filters;
        if (this._order.length > 0) params.order = this._order;
        if (this._limit) params.limit = this._limit;
        if (this._single) params.single = true;
        else if (this._maybeSingle) params.maybeSingle = true;
        break;

      case "insert":
        params.data = this._data;
        if (this._onConflict) params.onConflict = this._onConflict;
        if (this._selectAfter) params.select = this._selectAfter;
        if (this._selectAfter && this._single) params.single = true;
        if (this._selectAfter && this._maybeSingle) params.maybeSingle = true;
        break;

      case "upsert":
        params.data = this._data;
        if (this._onConflict) params.onConflict = this._onConflict;
        if (this._selectAfter) params.select = this._selectAfter;
        if (this._selectAfter && this._single) params.single = true;
        if (this._selectAfter && this._maybeSingle) params.maybeSingle = true;
        break;

      case "update":
        params.data = this._data;
        params.filters = this._filters;
        if (this._selectAfter) params.select = this._selectAfter;
        if (this._selectAfter && this._single) params.single = true;
        if (this._selectAfter && this._maybeSingle) params.maybeSingle = true;
        break;

      case "delete":
        params.filters = this._filters;
        break;
    }

    return callProxy({
      type: "db",
      table: this._table,
      action: this._action,
      params,
    });
  }
}

// ─── Patched QueryBuilder: handle .insert(data).select() chain ───
// Supabase allows .insert(data).select("*") to return inserted rows.
// We override .select() to detect if it's called after a mutation action.

const originalSelect = QueryBuilder.prototype.select;
QueryBuilder.prototype.select = function (columns: string = "*") {
  // If action is already set to a mutation, this is a chained .select()
  if (
    (this as any)._action === "insert" ||
    (this as any)._action === "update" ||
    (this as any)._action === "upsert"
  ) {
    (this as any)._selectAfter = columns;
    return this;
  }
  return originalSelect.call(this, columns);
};

// ─── Storage Builder ───

class StorageBucketApi {
  private _bucket: string;

  constructor(bucket: string) {
    this._bucket = bucket;
  }

  async upload(
    path: string,
    fileBody: any,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: any; error: any }> {
    const base64 = await toBase64(fileBody);
    return callProxy({
      type: "storage",
      bucket: this._bucket,
      action: "upload",
      params: {
        path,
        base64,
        contentType: options?.contentType || "application/octet-stream",
        upsert: options?.upsert || false,
      },
    });
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    // This is synchronous in Supabase SDK — we can compute it locally
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${this._bucket}/${path}`;
    return { data: { publicUrl } };
  }

  async createSignedUrl(
    path: string,
    expiresIn: number = 3600
  ): Promise<{ data: { signedUrl: string } | null; error: any }> {
    return callProxy({
      type: "storage",
      bucket: this._bucket,
      action: "createSignedUrl",
      params: { path, expiresIn },
    });
  }

  async remove(paths: string[]): Promise<{ data: any; error: any }> {
    return callProxy({
      type: "storage",
      bucket: this._bucket,
      action: "remove",
      params: { paths },
    });
  }
}

class StorageApi {
  from(bucket: string): StorageBucketApi {
    return new StorageBucketApi(bucket);
  }
}

// ─── Auth Admin Builder ───

class AuthAdminApi {
  async createUser(opts: {
    email: string;
    password: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, any>;
  }): Promise<{ data: any; error: any }> {
    return callProxy({
      type: "auth",
      action: "createUser",
      params: {
        email: opts.email,
        password: opts.password,
        email_confirm: opts.email_confirm !== false,
        user_metadata: opts.user_metadata,
      },
    });
  }

  async deleteUser(userId: string): Promise<{ data: any; error: any }> {
    return callProxy({
      type: "auth",
      action: "deleteUser",
      params: { userId },
    });
  }

  async updateUser(userId: string, opts: { password: string }): Promise<{ data: any; error: any }> {
    return callProxy({
      type: "auth",
      action: "updateUser",
      params: { userId, password: opts.password },
    });
  }

  async generateLink(opts: {
    type: string;
    email: string;
    options?: Record<string, any>;
  }): Promise<{ data: any; error: any }> {
    return callProxy({
      type: "auth",
      action: "generateLink",
      params: {
        type: opts.type,
        email: opts.email,
        options: opts.options || {},
      },
    });
  }
}

class AuthApi {
  admin = new AuthAdminApi();
}

// ─── Main adminApi object ───

export const adminApi = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
  storage: new StorageApi(),
  auth: new AuthApi(),
};
