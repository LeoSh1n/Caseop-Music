const SESSION_TOKEN_KEY = 'sonata_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredSessionToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const rawText = await res.text();
  let parsed: unknown = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const trimmed = rawText.trim().toLowerCase();
      if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
        throw new Error(
          `서버 응답 형식 오류 (${res.status}): API가 JSON 대신 HTML을 반환했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.`,
        );
      }
      throw new Error(
        `서버 응답을 해석할 수 없습니다 (${res.status}): ${rawText.slice(0, 120)}`,
      );
    }
  }

  if (!res.ok) {
    const errMsg =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `요청에 실패했습니다 (${res.status})`;
    throw new Error(errMsg);
  }

  return (parsed ?? {}) as T;
}
