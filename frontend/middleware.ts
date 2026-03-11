/**
 * middleware.ts  (Next.js App Router middleware – runs on the Edge runtime)
 * ──────────────────────────────────────────────────────────────────────────
 * Route protection rules:
 *   - /dashboard and /history/* → require a valid session cookie
 *   - /login and /register      → redirect to /dashboard if already logged in
 *   - All other paths            → pass through
 *
 * Token strategy with the Edge runtime:
 * Because the JWT lives in JS memory (not a cookie or localStorage), the
 * middleware cannot read it directly. Instead, when the user logs in via the
 * client-side authStore we set a lightweight HttpOnly session cookie
 * (`phishcatch_session=1`) that acts purely as a "logged-in hint" for the
 * middleware. The actual JWT is still verified server-side on every API call.
 *
 * This prevents two annoyances:
 *   1. Unauthenticated users browsing to /dashboard see a flash of the
 *      protected page before the client-side guard kicks in.
 *   2. Authenticated users browsing to /login are immediately redirected
 *      rather than seeing the login form.
 *
 * The session cookie is set by the LoginForm component after a successful
 * login and cleared on logout.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/history"];

// Routes that should redirect to /dashboard if already authenticated
const AUTH_ROUTES = ["/login", "/register"];

// Name of the lightweight session hint cookie (not the JWT itself)
const SESSION_COOKIE = "phishcatch_session";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  // ── Redirect unauthenticated users away from protected pages ──────────
  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the originally requested path so we can redirect back after login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Redirect already-authenticated users away from auth pages ─────────
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on these paths (skip _next static, api routes, etc.)
  matcher: ["/dashboard/:path*", "/history/:path*", "/login", "/register"],
};
