export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Same-origin /api/... fetch. NextAuth's session cookie rides along
 * automatically (same-origin requests always send cookies), so unlike the
 * pre-rebuild split-service version there's no bearer token to attach and no
 * manual 401-triggered refresh dance — the session cookie is a long-lived
 * signed JWT that NextAuth itself keeps valid. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`/api${path}`, { ...init, credentials: 'same-origin' });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
