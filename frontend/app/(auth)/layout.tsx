/**
 * app/(auth)/layout.tsx
 * ──────────────────────
 * Shared layout for the unauthenticated routes: /login and /register.
 * Centred card on a dark gradient background with the app brand at the top.
 */
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 mb-8 group">
        <div className="p-2 bg-blue-600 rounded-xl group-hover:bg-blue-500 transition-colors">
          <ShieldAlert className="h-6 w-6 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">
          PhishCatch <span className="text-blue-400">AI</span>
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8">
        {children}
      </div>

      <p className="mt-6 text-xs text-slate-600 text-center">
        AI-assisted analysis — always verify results with your security team.
      </p>
    </div>
  );
}
