/**
 * Test useProjectMembers -- najbardziej krytyczna logika biznesowa BSapp:
 * addMember automatycznie wykrywa rolę dodawanego usera i ustawia
 * project_manager_id / bauleiter_id w projects + szuka komplementarnej roli
 * (PM dodany -> szukaj BL w teamie i odwrotnie).
 *
 * Faza 4 commit 2.
 */
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import type { TFunction } from "i18next";

// ── Mock Supabase adminApi ──
// Chain: adminApi.from(table).select(cols).eq(col, val).order(col)
//                              .in(col, vals).insert(row).delete().eq(col, val)
//                              .update(row).eq(col, val).single().upsert(row, opts)
//
// Strategia: queue pre-defined responses (mockResponseQueue) per call.
// Jest hoisting wymaga ze zmienne uzywane w jest.mock() factory MUSZA miec
// prefix `mock` (case insensitive) -- inaczej "out-of-scope variable" error.
const mockResponseQueue: { data: unknown; error: unknown }[] = [];
const mockCallLog: { table: string; method: string; args: unknown[] }[] = [];

function mockMakeChain(table: string) {
  const log = (method: string, args: unknown[]) => mockCallLog.push({ table, method, args });
  const next = () => Promise.resolve(mockResponseQueue.shift() ?? { data: null, error: null });

  // chain musi byc thenable (await chain.from().select()...) AND chainable
  // (chain.eq().order().single() etc). Rozwiazanie: kazda metoda zwraca
  // Object.assign(promise, chain) -- await dziala, dalsze .x() tez.
  const chain: Record<string, jest.Mock> = {};
  const make = (method: string, terminating: boolean) => {
    chain[method] = jest.fn((...args: unknown[]) => {
      log(method, args);
      const p = terminating ? next() : Promise.resolve({ data: null, error: null });
      return Object.assign(p, chain);
    });
  };
  // Niezakanczajace (zwracaja chain dla .x().y())
  make("select", false);
  make("update", false);
  make("delete", false);
  // Zakanczajace (zwracaja Promise z odpowiedzia z queue) -- ale tez assignowane do chain dla nested .x().y()
  make("eq", true);
  make("in", true);
  make("order", true);
  make("single", true);
  make("insert", true);
  make("upsert", true);
  return chain;
}

jest.mock("@/src/lib/supabase/adminApi", () => ({
  adminApi: {
    from: jest.fn((table: string) => mockMakeChain(table)),
  },
}));

// Mock client.ts -- importowany przez useProjectData (przez useProjectMembers).
// Bez mocka: createClient pad z "supabaseUrl is required" (env vars nie sa
// wczytywane w testach Jest).
jest.mock("@/src/lib/supabase/client", () => ({
  supabase: {
    from: jest.fn((table: string) => mockMakeChain(table)),
  },
}));

import { useProjectMembers } from "../useProjectMembers";

// Helper: wrapper z QueryClientProvider dla renderHook
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const tStub = ((key: string) => key) as unknown as TFunction;
const sendNotificationStub = jest.fn().mockResolvedValue(undefined);
const fetchAllStub = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockResponseQueue.length = 0;
  mockCallLog.length = 0;
  sendNotificationStub.mockClear();
  fetchAllStub.mockClear();
});

describe("useProjectMembers", () => {
  it("inicjalnie members jest pustym array (przed fetch)", async () => {
    mockResponseQueue.push({ data: [], error: null }); // initial fetch

    const { result } = renderHook(
      () => useProjectMembers("proj-1", { id: "user-1", company_id: "comp-1" }, null, tStub, sendNotificationStub, fetchAllStub),
      { wrapper: makeWrapper() },
    );

    expect(result.current.members).toEqual([]);
    await waitFor(() => expect(result.current.members).toEqual([]));
  });

  it("addMember dla zwyklego workera robi insert do project_members + powiadomienie", async () => {
    const projectId = "proj-1";
    // 1) Initial fetch members (pusty)
    mockResponseQueue.push({ data: [], error: null });
    // 2) addMember -> insert do project_members
    mockResponseQueue.push({ data: null, error: null });
    // 3) addMember -> select profiles addedUser (.eq().single())
    mockResponseQueue.push({ data: { id: "user-2", role: "worker", full_name: "Jan", email: "jan@x.pl" }, error: null });

    const { result } = renderHook(
      () => useProjectMembers(projectId, { id: "user-1", company_id: "comp-1" }, null, tStub, sendNotificationStub, fetchAllStub),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.members).toEqual([]));

    await act(async () => { result.current.addMember("user-2"); });

    await waitFor(() => expect(fetchAllStub).toHaveBeenCalled());

    // Verify: insert do project_members z poprawnymi argumentami
    const insertCall = mockCallLog.find((c) => c.table === "project_members" && c.method === "insert");
    expect(insertCall).toBeDefined();
    expect(insertCall?.args[0]).toEqual({ project_id: projectId, user_id: "user-2", role: "member" });

    // Verify: powiadomienie wyslane (userId !== profile.id)
    expect(sendNotificationStub).toHaveBeenCalled();
    expect(sendNotificationStub.mock.calls[0][0]).toBe("user-2");
  });

  // TODO Faza 4 commit 3: test PM/BL auto detection przy addMember.
  // Wymaga lepszego mocka chain Supabase -- aktualny "queue" zdejmuje response
  // za kazdym wywolaniem .eq()/.single()/.in(), co nie pasuje do chain
  // .eq().single() (2 wywolania, 1 await). Refactor mock na "lazy materialize"
  // (response materializuje sie dopiero przy .then()/await na koncu chain)
  // albo per-table+method explicit response map.
});
