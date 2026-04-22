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

// ─── Typy publiczne ───

// PostgREST operator values mogą być dowolnymi prymitywami (lub ich tablicami dla .in()).
export type FilterValue = string | number | boolean | null | Date | string[] | number[];

// Odpowiedź z proxy — kształt mirroruje Supabase PostgrestResponse.
export type AdminError = {
  message: string;
  details: unknown;
  code?: string;
  hint?: string;
};
// Default dla `T` to `any` — setki istniejących call sites zakładają
// `const { data } = await adminApi.from(...)...` i używają `data.foo`.
// Migrujemy je na konkretne typy stopniowo (AdminResponse<Project[]> itp.)
// w ramach Fazy 1. Przy pełnej migracji defaultem stanie się `unknown`.
//
// Discriminated union: po `if (error) throw error;` TypeScript wie że
// `data` jest T (non-null). Eliminuje potrzebę null-checks w call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminResponse<T = any> =
  | { data: T; error: null }
  | { data: null; error: AdminError };

// Wiersz / wiersze wejściowe dla insert/update/upsert.
export type RowInput = Record<string, unknown>;

// Typ body requesta do proxy — opaque na zewnątrz, używany tylko wewnętrznie.
type ProxyRequestBody = Record<string, unknown>;

// Storage file body — Supabase SDK akceptuje wiele typów.
export type StorageFileBody = Blob | ArrayBuffer | Uint8Array | string;

// ─── Helpers ───

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function callProxy<T = unknown>(body: ProxyRequestBody): Promise<AdminResponse<T>> {
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

    const result = (await response.json()) as {
      data?: T;
      error?: string;
      details?: { code?: string; hint?: string; message?: string } | null;
    };

    if (!response.ok || result.error) {
      return {
        data: null,
        error: {
          message: result.error || `HTTP ${response.status}`,
          details: result.details ?? null,
          code: result.details?.code,
          hint: result.details?.hint,
        },
      };
    }

    return { data: result.data as T, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return {
      data: null,
      error: { message, details: null },
    };
  }
}

// Convert blob/ArrayBuffer/Uint8Array to base64 string
async function toBase64(input: StorageFileBody): Promise<string> {
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

// ─── Filter ───

type Filter = {
  type: string;
  column?: string;
  value?: FilterValue | Record<string, FilterValue>;
  operator?: string;
  from?: number;
  to?: number;
};

type QueryAction = "select" | "insert" | "update" | "upsert" | "delete";

// ─── Query Builder (mimics Supabase PostgREST builder) ───
//
// Thenable — tak jak PostgrestBuilder w supabase-js. Awaiting instancji
// wywołuje _execute() i zwraca AdminResponse<T>. Generic T pozwala caller-om
// określić kształt oczekiwanych danych (np. `await adminApi.from("projects")
// .select("id,name").then<Project[]>(r => r.data)`).

class QueryBuilder {
  private _table: string;
  private _action: QueryAction = "select";
  private _selectColumns: string = "*";
  private _filters: Filter[] = [];
  private _order: { column: string; ascending: boolean }[] = [];
  private _limit?: number;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _data: RowInput | RowInput[] | null = null;
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

  insert(data: RowInput | RowInput[]) {
    this._action = "insert";
    this._data = data;
    return this;
  }

  upsert(data: RowInput | RowInput[], options?: { onConflict?: string }) {
    this._action = "upsert";
    this._data = data;
    if (options?.onConflict) this._onConflict = options.onConflict;
    return this;
  }

  update(data: RowInput) {
    this._action = "update";
    this._data = data;
    return this;
  }

  delete() {
    this._action = "delete";
    return this;
  }

  // ─── Filters ───

  eq(column: string, value: FilterValue) {
    this._filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: FilterValue) {
    this._filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, value: readonly unknown[]) {
    this._filters.push({ type: "in", column, value: value as string[] | number[] });
    return this;
  }

  is(column: string, value: FilterValue) {
    this._filters.push({ type: "is", column, value });
    return this;
  }

  gte(column: string, value: FilterValue) {
    this._filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: FilterValue) {
    this._filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column: string, value: FilterValue) {
    this._filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column: string, value: FilterValue) {
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

  not(column: string, operator: string, value: FilterValue) {
    this._filters.push({ type: "not", column, operator, value });
    return this;
  }

  contains(column: string, value: FilterValue) {
    this._filters.push({ type: "contains", column, value });
    return this;
  }

  match(value: Record<string, FilterValue>) {
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

  // ─── Execute (thenable) ───

  then<TResult1 = AdminResponse, TResult2 = never>(
    resolve: (value: AdminResponse) => TResult1 | PromiseLike<TResult1>,
    reject?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<AdminResponse> {
    const params: Record<string, unknown> = {};

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
  // Accessing private fields przez ominięcie TS narrowing.
  // `this` ma kształt QueryBuilder, ale _action/_selectAfter są private.
  // Reinterpretujemy jako mutable record — akcja chainowania po insert/update/upsert.
  const self = this as unknown as {
    _action: QueryAction;
    _selectAfter?: string;
  };
  if (
    self._action === "insert" ||
    self._action === "update" ||
    self._action === "upsert"
  ) {
    self._selectAfter = columns;
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
    fileBody: StorageFileBody,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<AdminResponse<{ path: string }>> {
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
    expiresIn: number = 3600,
  ): Promise<AdminResponse<{ signedUrl: string }>> {
    return callProxy({
      type: "storage",
      bucket: this._bucket,
      action: "createSignedUrl",
      params: { path, expiresIn },
    });
  }

  async remove(paths: string[]): Promise<AdminResponse<{ name: string }[]>> {
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

// Minimalna struktura user'a zwracanego z auth.admin.*
export type AuthAdminUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  created_at?: string;
};

export type AuthAdminLink = {
  properties?: { action_link?: string; hashed_token?: string };
  user?: AuthAdminUser;
};

class AuthAdminApi {
  async createUser(opts: {
    email: string;
    password: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
  }): Promise<AdminResponse<{ user: AuthAdminUser }>> {
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

  async deleteUser(userId: string): Promise<AdminResponse<{ user: AuthAdminUser }>> {
    return callProxy({
      type: "auth",
      action: "deleteUser",
      params: { userId },
    });
  }

  async updateUser(userId: string, opts: { password: string }): Promise<AdminResponse<{ user: AuthAdminUser }>> {
    return callProxy({
      type: "auth",
      action: "updateUser",
      params: { userId, password: opts.password },
    });
  }

  async generateLink(opts: {
    type: string;
    email: string;
    options?: Record<string, unknown>;
  }): Promise<AdminResponse<AuthAdminLink>> {
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
