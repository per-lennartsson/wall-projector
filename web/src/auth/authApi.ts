import { apiJson, ApiError } from '../lib/httpClient';

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  email: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function signup(email: string, password: string): Promise<TokenResponse> {
  return apiJson('/auth/signup', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password }) });
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiJson('/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password }) });
}

// Deliberately bypasses apiFetch: apiFetch's own 401 handling calls back into
// this refresh handler (see httpClient's refreshHandler wiring in
// AuthContext), so routing this call through apiFetch would make a failed
// refresh re-enter itself — the retry's doRefresh() coalesces onto the very
// promise it's nested inside, awaiting its own resolution forever.
export async function refresh(): Promise<TokenResponse> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  return res.json();
}

export function logout(): Promise<{ ok: boolean }> {
  return apiJson('/auth/logout', { method: 'POST' });
}

export function me(): Promise<UserOut> {
  return apiJson('/auth/me');
}
