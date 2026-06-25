const SESSION_KEY = 'user_session';

/** 前端会话最长保留时间（JWT 更短时以 JWT 为准） */
export const SESSION_DURATION = 24 * 60 * 60 * 1000;

let logoutTimer = null;

function parseJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** JWT 过期时间戳（毫秒），解析失败返回 null */
export function getJwtExpiresAt(token) {
  if (!token || String(token).startsWith('mock_token_')) return null;
  const payload = parseJwtPayload(token);
  if (payload?.exp) return payload.exp * 1000;
  return null;
}

/** 会话实际失效时间 = min(前端 expiresAt, JWT exp) */
export function getSessionExpiresAt(session) {
  if (!session) return null;
  const jwtExp = session.token ? getJwtExpiresAt(session.token) : null;
  const localExp = session.expiresAt || null;
  if (jwtExp && localExp) return Math.min(jwtExp, localExp);
  return jwtExp || localExp;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiresAt = getSessionExpiresAt(session);
    if (expiresAt && expiresAt <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function isAuthenticated() {
  const session = getSession();
  return Boolean(session?.token && getAuthToken());
}

export function getOwnerId() {
  const session = getSession();
  return session?.userId || null;
}

export function saveSession(partial) {
  const prev = getSession() || {};
  const session = { ...prev, ...partial };

  if (session.token) {
    const jwtExp = getJwtExpiresAt(session.token);
    const localExp = session.expiresAt || Date.now() + SESSION_DURATION;
    session.expiresAt = jwtExp ? Math.min(localExp, jwtExp) : localExp;
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.token) {
    localStorage.setItem('token', session.token);
  } else {
    localStorage.removeItem('token');
  }
  return session;
}

export function getAuthToken() {
  const session = getSession();
  const token = session?.token;
  if (token && !String(token).startsWith('mock_token_')) {
    return token;
  }
  const direct = localStorage.getItem('token');
  if (direct && !direct.startsWith('mock_token_')) {
    return direct;
  }
  return null;
}

export function clearSession() {
  clearLogoutTimer();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('token');
}

export function clearLogoutTimer() {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }
}

/**
 * 在 JWT/会话到期时刻主动登出
 * @param { (reason: string) => void } onExpire
 */
export function scheduleAutoLogout(onExpire) {
  clearLogoutTimer();
  const session = getSession();
  if (!session?.token) return;

  const expiresAt = getSessionExpiresAt(session);
  if (!expiresAt) return;

  const delay = expiresAt - Date.now();
  if (delay <= 0) {
    onExpire('登录已过期，请重新登录');
    return;
  }

  logoutTimer = setTimeout(() => {
    onExpire('登录已超时，请重新登录');
  }, delay);
}

/** API 401 / 请求前校验失败：清会话并通知 AuthSession 跳转登录 */
export function handleUnauthorized(reason = '登录已过期，请重新登录') {
  clearSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { reason } }));
  }
}
