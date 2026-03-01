"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SESSION_COOKIE_NAME = "ali_session";
const SESSION_CHANGE_EVENT = "ali-session-change";

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function canUseOfflineFallback() {
  if (typeof window === "undefined") return false;
  return isLocalHostname(window.location.hostname);
}

function emitSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function getApiCandidates() {
  if (typeof window === "undefined") return [API_URL];

  const list: string[] = [API_URL];
  const host = window.location.hostname;
  const isLocal = isLocalHostname(host);
  if (!isLocal) {
    // Prefer same-origin proxy in production to avoid CORS and stale client env issues.
    list.unshift("");
    // Cross-origin fallbacks in case proxy is not configured yet.
    list.push("https://account-lead-insights-api.onrender.com");
    if (host.endsWith(".onrender.com")) {
      const derived = host.replace("-web.onrender.com", "-api.onrender.com");
      if (derived !== host) {
        list.push(`https://${derived}`);
      }
    }
    return Array.from(new Set(list));
  }

  const localPort = "4000";
  list.push(`http://localhost:${localPort}`);
  list.push(`http://127.0.0.1:${localPort}`);
  return Array.from(new Set(list));
}

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ali_access_token") || "";
}

export function getRefreshToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ali_refresh_token") || "";
}

function hasSessionCookie() {
  if (typeof window === "undefined") return false;
  return document.cookie.includes(`${SESSION_COOKIE_NAME}=1`);
}

function writeSessionCookie(active: boolean) {
  if (typeof window === "undefined") return;
  if (active) {
    document.cookie = `${SESSION_COOKIE_NAME}=1; Path=/; Max-Age=2592000; SameSite=Lax`;
    return;
  }
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function isSignedIn() {
  return Boolean(getToken() || getRefreshToken() || hasSessionCookie());
}

export function getUserEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ali_user_email") || "";
}

export function setTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === "undefined") return;
  if (accessToken) {
    localStorage.setItem("ali_access_token", accessToken);
  } else {
    localStorage.removeItem("ali_access_token");
  }
  if (typeof refreshToken === "string") {
    if (refreshToken) localStorage.setItem("ali_refresh_token", refreshToken);
    else localStorage.removeItem("ali_refresh_token");
  }
  writeSessionCookie(Boolean(accessToken || getRefreshToken()));
  emitSessionChanged();
}

export function setUserEmail(email: string) {
  if (typeof window === "undefined") return;
  if (email) localStorage.setItem("ali_user_email", email);
  else localStorage.removeItem("ali_user_email");
  emitSessionChanged();
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("ali_access_token");
  localStorage.removeItem("ali_refresh_token");
  localStorage.removeItem("ali_user_email");
  writeSessionCookie(false);
  emitSessionChanged();
}

export function syncSessionCookieFromStorage() {
  if (typeof window === "undefined") return;
  writeSessionCookie(Boolean(getToken() || getRefreshToken() || getUserEmail()));
}

export function onSessionChange(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_CHANGE_EVENT, handler);
  return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
}

async function tryRefreshAccessToken(urls: string[]): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return "";

  for (const base of urls) {
    try {
      const response = await fetch(`${base}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store"
      });
      if (!response.ok) continue;
      const body = (await response.json().catch(() => ({}))) as { accessToken?: string };
      const newAccessToken = String(body.accessToken || "");
      if (!newAccessToken) continue;
      setTokens(newAccessToken, refreshToken);
      return newAccessToken;
    } catch {
      continue;
    }
  }

  return "";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const urls = getApiCandidates();
  let lastNetworkError: unknown = null;

  for (const base of urls) {
    try {
      let res = await fetch(`${base}${path}`, { ...options, headers, cache: "no-store" });
      if (res.status === 401) {
        const refreshedToken = await tryRefreshAccessToken(urls);
        if (refreshedToken) {
          token = refreshedToken;
          headers.set("Authorization", `Bearer ${token}`);
          res = await fetch(`${base}${path}`, { ...options, headers, cache: "no-store" });
        }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      return res.json();
    } catch (error) {
      const message = String((error as Error)?.message || "");
      const isNetworkError = message.includes("Failed to fetch") || message.includes("NetworkError");
      if (isNetworkError) {
        lastNetworkError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    lastNetworkError
      ? "Cannot reach API. Start all services with `npm run dev`, then refresh."
      : "Cannot reach API."
  );
}
