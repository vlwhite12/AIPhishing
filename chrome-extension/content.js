"use strict";

/**
 * content.js — PhishCatch AI Gmail DOM Extractor
 * ─────────────────────────────────────────────────
 * Injected into https://mail.google.com/* at document_idle.
 * Responds synchronously to {action: "extractEmail"} messages.
 *
 * Gmail DOM notes
 * ───────────────
 * Gmail obfuscates most class names, but these keys have been stable
 * through many UI iterations and are the most widely documented:
 *
 *   h2.hP          — Subject line of the open email / thread
 *   .gD[email]     — Sender <span> whose `email` attribute holds the
 *                    raw RFC-5322 address (display name is textContent)
 *   .a3s.aiL       — Rendered email body container; multiple instances
 *                    appear in a thread (one per message).  We read ALL
 *                    of them so the AI sees the full conversation context.
 *
 * If Gmail changes these selectors a future update to this file is needed;
 * the popup will show a descriptive "could not extract" error in the interim.
 */

// ── Selectors ─────────────────────────────────────────────────────────────────
const SEL_SUBJECT = "h2.hP";
const SEL_SENDER  = ".gD[email], span[email]";
const SEL_BODY    = ".a3s.aiL";

// ── Block-level tags for text extraction ──────────────────────────────────────
const BLOCK_TAGS = new Set([
  "p", "div", "br", "tr", "li", "blockquote", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "td", "th", "article", "section", "header", "footer",
]);

// ── Core extractor ────────────────────────────────────────────────────────────

/**
 * Walks the DOM and converts block-level elements to newlines so the
 * resulting plain text preserves paragraph structure, without cloning
 * the DOM or using innerHTML (safe against mutation/injection).
 */
function nodeToText(root) {
  const parts = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    // Skip hidden content (e.g. collapsed quoted-reply sections)
    const style = node.style;
    if (style && (style.display === "none" || style.visibility === "hidden")) return;
    if (node.hidden) return;

    if (tag === "br") {
      parts.push("\n");
      return;
    }

    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) parts.push("\n");

    node.childNodes.forEach(walk);

    if (isBlock) parts.push("\n");
  }

  walk(root);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extracts the currently open/focused email thread from Gmail's DOM.
 * Returns a structured object or null when no email is open.
 */
function extractEmail() {
  const subjectEl = document.querySelector(SEL_SUBJECT);
  const senderEl  = document.querySelector(SEL_SENDER);
  const bodyEls   = document.querySelectorAll(SEL_BODY);

  // Nothing open — user is on inbox list view
  if (!subjectEl && bodyEls.length === 0) return null;

  const subject    = (subjectEl?.textContent ?? "").trim() || "(no subject)";
  const senderAddr = senderEl?.getAttribute("email") ?? "";
  const senderName = (senderEl?.textContent ?? "").trim();
  const from       = senderAddr
    ? `${senderName} <${senderAddr}>`
    : senderName || "unknown sender";

  // Concatenate all messages in the thread with a separator
  const bodyParts = Array.from(bodyEls)
    .map(nodeToText)
    .filter(Boolean);

  const body = bodyParts.length > 0
    ? bodyParts.join("\n\n--- (next message in thread) ---\n\n")
    : "(no body)";

  const fullText = `From: ${from}\nSubject: ${subject}\n\n${body}`;

  return { sender: from, subject, body, fullText };
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "extractEmail") return false;

  const data = extractEmail();
  if (data) {
    sendResponse({ ok: true, data });
  } else {
    sendResponse({
      ok: false,
      error: "No email is open. Click on an email in Gmail first.",
    });
  }
  // Return false — response is synchronous, no need to keep channel open.
  return false;
});
