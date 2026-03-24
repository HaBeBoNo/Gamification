/**
 * googleAuth.ts
 * Google OAuth2 helpers using @react-oauth/google + Google Identity Services.
 * Access token is persisted in localStorage under 'sektionen_google_token'.
 *
 * NOTE: This module operates entirely in the browser.
 * The `googleapis` Node.js package is NOT used — we use direct REST calls instead.
 */

import { supabase } from './supabase';

/**
 * Returns a valid Google provider_token from the current Supabase session,
 * automatically refreshing the session if the token is about to expire (within 5 minutes).
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (!supabase) return null;

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;

  // Check if token is about to expire (within 5 minutes)
  const expiresAt = session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;

  if (expiresAt - now < fiveMinutes) {
    // Refresh session
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) return null;
    return refreshed.session.provider_token || null;
  }

  return session.provider_token || null;
}

export const GOOGLE_TOKEN_KEY = 'sektionen_google_token';

export interface GoogleTokenData {
  access_token: string;
  expires_at: number; // Unix ms timestamp
  user_email?: string;
  user_name?: string;
  user_picture?: string;
}

// OAuth2 scopes required by the app
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

/** Persist token data to localStorage */
export function saveToken(data: GoogleTokenData): void {
  localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify(data));
}

/** Load token data from localStorage */
export function loadToken(): GoogleTokenData | null {
  try {
    const raw = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleTokenData;
  } catch {
    return null;
  }
}

/** Remove token from localStorage (sign out) */
export function clearToken(): void {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
}

/** Returns true if a valid, non-expired token exists */
export function isAuthenticated(): boolean {
  const token = loadToken();
  if (!token) return false;
  return Date.now() < token.expires_at;
}

/** Returns the raw access token string, or null if not authenticated */
export function getAccessToken(): string | null {
  const token = loadToken();
  if (!token || Date.now() >= token.expires_at) return null;
  return token.access_token;
}

/**
 * Build Authorization header value for Google API requests.
 * Usage: fetch(url, { headers: { Authorization: getAuthHeader() } })
 */
export function getAuthHeader(): string {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated with Google');
  return `Bearer ${token}`;
}

/**
 * Called after a successful @react-oauth/google token response.
 * Fetches user profile and persists full token data.
 *
 * @param accessToken - raw access_token from Google
 * @param expiresIn   - token lifetime in seconds (default 3600)
 */
export async function handleTokenResponse(
  accessToken: string,
  expiresIn: number = 3600
): Promise<GoogleTokenData> {
  // Fetch user profile using the People API
  let userInfo: { email?: string; name?: string; picture?: string } = {};
  try {
    const res = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      userInfo = {
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    }
  } catch {
    // Non-fatal — app works without user info
  }

  const tokenData: GoogleTokenData = {
    access_token: accessToken,
    expires_at: Date.now() + expiresIn * 1000,
    user_email: userInfo.email,
    user_name: userInfo.name,
    user_picture: userInfo.picture,
  };

  saveToken(tokenData);
  return tokenData;
}

/** Sign out: clear local token and revoke with Google */
export async function signOut(): Promise<void> {
  const token = getAccessToken();
  clearToken();
  if (token) {
    // Best-effort revocation — don't block on this
    fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {});
  }
}
