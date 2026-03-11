"use strict";

/**
 * background.js — PhishCatch AI Service Worker
 * ──────────────────────────────────────────────
 * Handles all communication with the FastAPI backend.
 *
 * Why do API calls live here (not in popup.js)?
 * ─────────────────────────────────────────────
 * Service-worker fetch requests to URLs listed in `host_permissions`
 * bypass the browser's CORS checks entirely — Chrome's extension
 * runtime handles the cross-origin grant. Popup pages (chrome-extension://
 * origin) would also bypass CORS for host_permission URLs, BUT routing
 * everything through the service worker centralises auth-token access and
 * means the JWT is never touched by any web-page context.
 *
 * JWT Storage: chrome.storage.session
 * ────────────────────────────────────
 * • Memory-only — cleared automatically when the browser session ends.
 * • Not accessible from web-page scripts (extension storage is isolated).
 * • Shared safely between the service worker, popup, and content scripts
 *   without ever exposing the token to localStorage or a cookie.
 */

// ── Configuration ─────────────────────────────────────────────────────────────
// TODO: replace with your actual Railway URL after deploying
const API_BASE = "https://aiphishing-production.up.railway.app";

// ── Message router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {

    case "getAuthState":
      chrome.storage.session
        .get("jwt_token")
        .then(({ jwt_token }) => sendResponse({ isAuthenticated: !!jwt_token }));
      return true; // keep the message channel open for the async response

    case "login":
      handleLogin(message.credentials)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    case "logout":
      chrome.storage.session
        .remove("jwt_token")
        .then(() => sendResponse({ ok: true }));
      return true;

    case "analyze":
      handleAnalyze(message.emailText)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    default:
      return false;
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * FastAPI's OAuth2PasswordRequestForm expects `username` (not `email`)
 * and `application/x-www-form-urlencoded` encoding.
 */
async function handleLogin({ email, password }) {
  const resp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: email, password }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail ?? `Login failed (HTTP ${resp.status})`);
  }

  const { access_token } = await resp.json();

  // Store in session-scoped extension storage — never in localStorage or cookies.
  await chrome.storage.session.set({ jwt_token: access_token });
  return { ok: true };
}

// ── Analysis ──────────────────────────────────────────────────────────────────

async function handleAnalyze(emailText) {
  const { jwt_token } = await chrome.storage.session.get("jwt_token");

  if (!jwt_token) {
    throw new Error("Not authenticated. Please sign in first.");
  }

  const resp = await fetch(`${API_BASE}/api/analysis/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt_token}`,
    },
    body: JSON.stringify({ email_text: emailText }),
  });

  // Expired / invalidated token — clear it so the popup shows the login form.
  if (resp.status === 401) {
    await chrome.storage.session.remove("jwt_token");
    throw new Error("Session expired. Please sign in again.");
  }

  if (resp.status === 429) {
    throw new Error("Rate limit reached. Please wait a moment and try again.");
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail ?? `Analysis failed (HTTP ${resp.status})`);
  }

  return resp.json();
}
