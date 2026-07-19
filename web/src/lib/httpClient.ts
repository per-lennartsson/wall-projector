let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;
export function setRefreshHandler(fn: RefreshHandler | null): void {
  refreshHandler = fn;
}

// Coalesces concurrent 401s into a single refresh call rather than firing
// one refresh request per failed request.
let refreshPromise: Promise<string | null> | null = null;
async function doRefresh(): Promise<string | null> {
  if (!refreshHandler) return null;
  if (!refreshPromise) {
    refreshPromise = refreshHandler().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Same-origin /api/... fetch — attaches the bearer token, retries once via
 * refreshHandler on a 401 (see AuthContext, which wires refreshHandler to
 * POST /api/auth/refresh using the httpOnly refresh cookie). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doRequest = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  };
  let res = await doRequest();
  if (res.status === 401 && refreshHandler) {
    const newToken = await doRefresh();
    if (newToken) res = await doRequest();
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
