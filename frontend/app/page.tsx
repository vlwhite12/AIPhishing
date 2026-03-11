/**
 * app/page.tsx
 * ─────────────
 * Root route — immediately redirects to /dashboard.
 * Middleware handles unauthenticated users by bouncing them back to /login.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
