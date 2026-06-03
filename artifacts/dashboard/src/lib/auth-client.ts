/**
 * auth-client.ts — Typed API client for Phase 14 auth endpoints.
 * Handles token storage, refresh, and request signing.
 */

const API_BASE = "/api/v1";

// ---------------------------------------------------------------------------
// Token storage (in-memory primary + localStorage fallback for persistence)
// ---------------------------------------------------------------------------

let _accessToken: string | null = null;
let _refreshToken: string | null = null;

export function setTokens(access: string, refresh: string): void {
  _accessToken = access;
  _refreshToken = refresh;
  try {
    localStorage.setItem("qf_access_token", access);
    localStorage.setItem("qf_refresh_token", refresh);
  } catch { /* storage unavailable */ }
}

export function clearTokens(): void {
  _accessToken = null;
  _refreshToken = null;
  try {
    localStorage.removeItem("qf_access_token");
    localStorage.removeItem("qf_refresh_token");
  } catch { /* storage unavailable */ }
}

export function loadTokensFromStorage(): boolean {
  try {
    const access = localStorage.getItem("qf_access_token");
    const refresh = localStorage.getItem("qf_refresh_token");
    if (access && refresh) {
      _accessToken = access;
      _refreshToken = refresh;
      return true;
    }
  } catch { /* storage unavailable */ }
  return false;
}

export function getAccessToken(): string | null { return _accessToken; }
export function getRefreshToken(): string | null { return _refreshToken; }

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

let _refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  const rt = _refreshToken ?? localStorage.getItem("qf_refresh_token");
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) { clearTokens(); return false; }
    const data = await res.json();
    setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return true;
  } catch { return false; }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && _refreshToken) {
    if (!_refreshPromise) _refreshPromise = attemptRefresh().finally(() => { _refreshPromise = null; });
    const refreshed = await _refreshPromise;
    if (refreshed) return apiFetch<T>(path, options, false);
    clearTokens();
    window.dispatchEvent(new CustomEvent("auth:logout"));
    throw new ApiError(401, "SESSION_EXPIRED", "Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: "UNKNOWN_ERROR", message: res.statusText } }));
    const err = body.error ?? { code: "UNKNOWN_ERROR", message: res.statusText };
    throw new ApiError(res.status, err.code ?? "UNKNOWN_ERROR", err.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Auth API calls
// ---------------------------------------------------------------------------

export interface SafeUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export async function apiRegister(data: { email: string; password: string; firstName?: string; lastName?: string; organizationName?: string }) {
  return apiFetch<{ user: SafeUser; tokens: AuthTokens }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiLogin(data: { email: string; password: string; rememberMe?: boolean }) {
  return apiFetch<{ user: SafeUser; tokens: AuthTokens; organizationId: string | null }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiLogout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" }).catch(() => {});
}

export async function apiGetMe() {
  return apiFetch<{
    user: SafeUser;
    roles: string[];
    permissions: string[];
    memberships: unknown[];
    preferences: unknown;
    settings: unknown;
  }>("/auth/me");
}

export async function apiUpdateMe(data: { firstName?: string; lastName?: string; avatarUrl?: string | null }) {
  return apiFetch<{ user: SafeUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiForgotPassword(email: string) {
  return apiFetch<{ message: string }>("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
}

export async function apiResetPassword(token: string, newPassword: string) {
  return apiFetch<{ message: string }>("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, newPassword }) });
}

export async function apiChangePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ message: string }>("/auth/password/change", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function apiVerifyEmail(token: string) {
  return apiFetch<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
}

export async function apiResendVerification() {
  return apiFetch<{ message: string }>("/auth/verify-email/resend", { method: "POST" });
}

export async function apiListSessions() {
  return apiFetch<{ sessions: unknown[]; total: number }>("/auth/sessions");
}

export async function apiRevokeSession(sessionId: string) {
  return apiFetch<{ message: string }>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
}

export async function apiRevokeAllSessions() {
  return apiFetch<{ message: string }>("/auth/sessions", { method: "DELETE" });
}

export async function apiListApiKeys() {
  return apiFetch<{ data: unknown[]; total: number }>("/auth/api-keys");
}

export async function apiCreateApiKey(data: { name: string; permissions: string[]; organizationId?: string | null; expiresInDays?: number }) {
  return apiFetch<{ apiKey: unknown; rawKey: string; warning: string }>("/auth/api-keys", { method: "POST", body: JSON.stringify(data) });
}

export async function apiRevokeApiKey(keyId: string) {
  return apiFetch<{ message: string }>(`/auth/api-keys/${keyId}`, { method: "DELETE" });
}

export async function apiListUsers() {
  return apiFetch<{ data: SafeUser[]; total: number }>("/users");
}

export async function apiListOrganizations() {
  return apiFetch<{ data: unknown[]; total: number }>("/organizations");
}

export async function apiGetOrganization(orgId: string) {
  return apiFetch<{ organization: unknown }>(`/organizations/${orgId}`);
}

export async function apiListMembers(orgId: string) {
  return apiFetch<{ data: unknown[]; total: number }>(`/organizations/${orgId}/members`);
}

export async function apiSendInvitation(orgId: string, data: { email: string; roleToAssign: string }) {
  return apiFetch<{ invitation: unknown }>(`/organizations/${orgId}/invitations`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiListSecurityEvents(params?: { userId?: string; eventType?: string; severity?: string; limit?: number }) {
  const q = new URLSearchParams(params as Record<string, string> ?? {}).toString();
  return apiFetch<{ data: unknown[]; total: number }>(`/security/events${q ? `?${q}` : ""}`);
}

export async function apiListAuditEvents(params?: { actorId?: string; resource?: string; action?: string; limit?: number }) {
  const q = new URLSearchParams(params as Record<string, string> ?? {}).toString();
  return apiFetch<{ data: unknown[]; total: number }>(`/audit/events${q ? `?${q}` : ""}`);
}

export async function apiListRoles() {
  return apiFetch<{ data: unknown[]; total: number }>("/rbac/roles");
}

export async function apiListPermissions() {
  return apiFetch<{ data: unknown[]; total: number }>("/rbac/permissions");
}
