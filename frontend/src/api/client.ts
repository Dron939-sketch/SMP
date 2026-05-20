import type {
  AppSettings,
  AssistantAskResponse,
  AssistantGreeting,
  AssistantMessage,
  DashboardPayload,
  ShareLink,
  Test,
  User,
} from "../types";

const BASE = ""; // vite proxy handles /api/*

let _token: string | null = localStorage.getItem("bp_token");
let _refresh: string | null = localStorage.getItem("bp_refresh");

export function setTokens(access: string, refresh: string) {
  _token = access;
  _refresh = refresh;
  localStorage.setItem("bp_token", access);
  localStorage.setItem("bp_refresh", refresh);
}

export function clearTokens() {
  _token = _refresh = null;
  localStorage.removeItem("bp_token");
  localStorage.removeItem("bp_refresh");
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (_token) headers.set("Authorization", `Bearer ${_token}`);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");

  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`HTTP ${r.status}: ${body.slice(0, 300)}`);
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return r.json();
  return (await r.text()) as unknown as T;
}

export const auth = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me: () => request<User>("/api/auth/me"),
  consent: () => request<User>("/api/auth/consent", { method: "POST" }),
};

export const tests = {
  list: () => request<Test[]>("/api/tests"),
  get: (id: string) => request<Test>(`/api/tests/${id}`),
  getShared: (token: string) => request<Test>(`/api/tests/shared/${token}`),
  submit: (id: string, body: { cycle_tag: string; answers: unknown[] }) =>
    request(`/api/tests/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitShared: (token: string, body: { cycle_tag: string; answers: unknown[] }) =>
    request(`/api/tests/shared/${token}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createShare: (id: string, body: { cycle_tag: string; expires_in_days: number; note?: string }) =>
    request<ShareLink>(`/api/tests/${id}/share`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listShares: (id: string) => request<ShareLink[]>(`/api/tests/${id}/share`),
};

export const dashboard = {
  political: (cycle_tag?: string) =>
    request<DashboardPayload>(
      `/api/dashboard/political-officer${cycle_tag ? `?cycle_tag=${cycle_tag}` : ""}`
    ),
  refreshAdvisor: () =>
    request<unknown>(`/api/dashboard/advisor/refresh`, { method: "POST" }),
  exportXlsx: (cycle_tag?: string) =>
    `/api/dashboard/export/xlsx${cycle_tag ? `?cycle_tag=${cycle_tag}` : ""}`,
};

export const admin = {
  getSettings: () => request<AppSettings>("/api/admin/settings"),
  updateSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) =>
    request<AppSettings>(`/api/admin/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  reset: () =>
    request<{ deleted: Record<string, number> }>("/api/admin/reset", {
      method: "POST",
    }),
};

export const assistant = {
  greeting: () => request<AssistantGreeting>("/api/assistant/greeting"),
  ask: (question: string, history: AssistantMessage[], enableSearch = false) =>
    request<AssistantAskResponse>("/api/assistant/ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        history,
        include_dashboard_context: true,
        enable_web_search: enableSearch,
      }),
    }),
  speak: async (text: string): Promise<Blob | null> => {
    if (!_token) return null;
    const r = await fetch(`${BASE}/api/assistant/speak`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) return null;
    return r.blob();
  },
  listen: async (audio: Blob): Promise<string | null> => {
    if (!_token) return null;
    const fd = new FormData();
    fd.append("audio", audio, "speech.webm");
    const r = await fetch(`${BASE}/api/assistant/listen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${_token}` },
      body: fd,
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.transcript || null;
  },
};
