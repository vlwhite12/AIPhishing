"use strict";

/**
 * popup.js — PhishCatch AI Popup State Machine
 * ──────────────────────────────────────────────
 * Four views cycle in this order depending on auth + analysis state:
 *
 *   loading → login  (unauthenticated)
 *   loading → analyze (authenticated, waiting for user to click)
 *   analyze → analyze (with error banner if something went wrong)
 *   analyze → results (successful analysis)
 *   results → analyze (user clicks "Analyse Another Email")
 *
 * All API calls are delegated to background.js so the JWT token never
 * leaves the service-worker context.
 *
 *   popup.js  ──sendMessage──▶  background.js  ──fetch──▶  FastAPI
 *   popup.js  ◀──response────   background.js  ◀──json───  FastAPI
 *
 * For email extraction, popup.js talks directly to content.js
 * (running inside the Gmail tab) via chrome.tabs.sendMessage:
 *
 *   popup.js  ──sendMessage──▶  content.js (Gmail tab)
 *   popup.js  ◀──response────   content.js
 */

// ── Arc math ──────────────────────────────────────────────────────────────────
// Full length of the semicircle arc: π × radius(80) ≈ 251.33
const ARC_LENGTH = Math.PI * 80;

// ── Risk styling maps ──────────────────────────────────────────────────────────
const RISK_COLOR = {
  safe:     "#22c55e",
  low:      "#14b8a6",
  medium:   "#f59e0b",
  high:     "#f97316",
  critical: "#ef4444",
};

const RISK_LABEL = {
  safe:     "Safe",
  low:      "Low Risk",
  medium:   "Medium Risk",
  high:     "High Risk",
  critical: "Critical",
};

// ── DOM shortcuts ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const VIEW_IDS = ["view-loading", "view-login", "view-analyze", "view-results"];

// ── View management ────────────────────────────────────────────────────────────
function showView(name) {
  VIEW_IDS.forEach((id) => {
    $(`view-${name}`) === $(id)
      ? $(id).removeAttribute("hidden")
      : $(id).setAttribute("hidden", "");
  });
  // Show sign-out button for all views except loading + login
  const hideLogout = name === "loading" || name === "login";
  $("btn-logout").hidden = hideLogout;
}

// ── Initialisation ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Read auth state directly from session storage and show the correct view
  // immediately — no intermediate loading screen needed.
  chrome.storage.session
    .get("jwt_token")
    .then(({ jwt_token }) => {
      showView(jwt_token ? "analyze" : "login");
    })
    .catch(() => {
      showView("login");
    });

  $("form-login").addEventListener("submit", onLogin);
  $("btn-analyze").addEventListener("click", onAnalyze);
  $("btn-logout").addEventListener("click", onLogout);
  $("btn-new-scan").addEventListener("click", () => {
    // Hide any stale error from prior run
    $("analyze-error").hidden = true;
    showView("analyze");
  });
});

// ── Login ──────────────────────────────────────────────────────────────────────
async function onLogin(e) {
  e.preventDefault();

  const email    = $("input-email").value.trim();
  const password = $("input-password").value;
  const errEl    = $("login-error");

  errEl.hidden = true;
  setLoading("btn-login", "btn-login-label", "btn-login-spinner", true, "Signing in…");

  const result = await sendBg({ action: "login", credentials: { email, password } });

  setLoading("btn-login", "btn-login-label", "btn-login-spinner", false, "Sign in");

  if (result.error) {
    showBanner(errEl, result.error);
    return;
  }

  showView("analyze");
}

// ── Logout ──────────────────────────────────────────────────────────────────────
async function onLogout() {
  await sendBg({ action: "logout" });
  // Clear sensitive fields before switching to the login screen
  $("input-email").value = "";
  $("input-password").value = "";
  $("login-error").hidden = true;
  showView("login");
}

// ── Analyse ────────────────────────────────────────────────────────────────────
async function onAnalyze() {
  const errEl = $("analyze-error");
  errEl.hidden = true;

  setLoading("btn-analyze", "btn-analyze-label", "btn-analyze-spinner", true, "Analysing…");

  try {
    // 1. Confirm we're on a Gmail tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.startsWith("https://mail.google.com")) {
      throw new Error("Navigate to Gmail and open an email, then click Analyse.");
    }

    // 2. Ask the content script to extract the open email's text
    let extractResult;
    try {
      extractResult = await chrome.tabs.sendMessage(tab.id, { action: "extractEmail" });
    } catch {
      // sendMessage throws when no listener is present (content script not yet injected)
      throw new Error(
        "Could not connect to the Gmail tab. " +
        "Try refreshing Gmail, then click Analyse again."
      );
    }

    if (!extractResult?.ok) {
      throw new Error(extractResult?.error ?? "Failed to extract the email.");
    }

    // 3. Send extracted text to the backend via the background service worker
    const analysis = await sendBg({
      action: "analyze",
      emailText: extractResult.data.fullText,
    });

    if (analysis.error) throw new Error(analysis.error);

    // 4. Render and show the results
    renderResults(analysis);
    showView("results");

  } catch (err) {
    showBanner(errEl, err.message);
  } finally {
    setLoading("btn-analyze", "btn-analyze-label", "btn-analyze-spinner", false, "Analyse This Email");
  }
}

// ── Render results ─────────────────────────────────────────────────────────────

/**
 * Populates the results view from an AnalyzeResponse object.
 * All user-supplied / API-returned text is set via .textContent —
 * never via innerHTML — to prevent any XSS from malformed API data.
 */
function renderResults(data) {
  const { analysis } = data;
  const score    = typeof analysis.risk_score === "number" ? analysis.risk_score : 0;
  const level    = (analysis.risk_level ?? "safe").toLowerCase().trim();
  const summary  = analysis.summary ?? "";
  const redFlags = Array.isArray(analysis.red_flags) ? analysis.red_flags : [];

  // Arc fill
  const fillLen = (score / 100) * ARC_LENGTH;
  const arcEl   = $("arc-fill");
  arcEl.setAttribute("stroke-dasharray", `${fillLen.toFixed(2)} ${ARC_LENGTH.toFixed(2)}`);
  arcEl.setAttribute("stroke", RISK_COLOR[level] ?? "#3b82f6");

  // Score number
  const numEl = $("score-number");
  numEl.textContent = String(score);
  numEl.style.color = RISK_COLOR[level] ?? "#f8fafc";

  // Risk badge
  const badgeEl = $("risk-badge");
  // Keep class names to known safe values — strip anything unexpected
  const safeLevel   = /^(safe|low|medium|high|critical)$/.test(level) ? level : "safe";
  badgeEl.className = `risk-badge risk-${safeLevel}`;
  badgeEl.textContent = RISK_LABEL[safeLevel] ?? safeLevel;

  // Summary
  $("result-summary").textContent = summary;

  // Red flags
  const sectionEl = $("red-flags-section");
  const listEl    = $("red-flags-list");
  listEl.innerHTML = ""; // clear previous run

  if (redFlags.length > 0) {
    sectionEl.removeAttribute("hidden");
    redFlags.forEach((flag) => {
      const sev      = (flag.severity ?? "info").toLowerCase().replace(/[^a-z]/g, "");
      const safeSev  = /^(critical|high|medium|low|info)$/.test(sev) ? sev : "info";

      const li = document.createElement("li");
      li.className = "flag-item";

      const sevEl = document.createElement("span");
      sevEl.className   = `flag-sev sev-${safeSev}`;
      sevEl.textContent = flag.severity ?? safeSev;

      const titleEl = document.createElement("div");
      titleEl.className   = "flag-title";
      titleEl.textContent = flag.title ?? flag.category ?? "";

      const descEl = document.createElement("div");
      descEl.className   = "flag-desc";
      descEl.textContent = flag.description ?? "";

      li.append(sevEl, titleEl, descEl);
      listEl.appendChild(li);
    });
  } else {
    sectionEl.setAttribute("hidden", "");
  }

  // Scroll results back to the top in case of a repeated scan
  $("view-results").scrollTop = 0;
}

// ── Utility helpers ────────────────────────────────────────────────────────────

/**
 * Sends a message to the background service worker and returns a Promise
 * that resolves with the response.  Falls back to an error object if Chrome
 * fires a runtime.lastError (e.g. service worker not yet ready).
 */
function sendBg(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response ?? { error: "No response received." });
      }
    });
  });
}

function showBanner(el, message) {
  el.textContent = message;
  el.removeAttribute("hidden");
}

function setLoading(btnId, labelId, spinnerId, isLoading, labelText) {
  $(btnId).disabled      = isLoading;
  $(labelId).textContent = labelText;
  $(spinnerId).hidden    = !isLoading;
}
