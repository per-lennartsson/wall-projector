import { apiJson } from '../lib/httpClient';

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

export function refresh(): Promise<TokenResponse> {
  return apiJson('/auth/refresh', { method: 'POST' });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiJson('/auth/logout', { method: 'POST' });
}

export function me(): Promise<UserOut> {
  return apiJson('/auth/me');
}
