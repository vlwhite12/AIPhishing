"use client";

/**
 * components/layout/Navbar.tsx
 * ──────────────────────────────
 * Sticky top navigation bar shared across all authenticated pages.
 * Handles logout (clears auth store + session cookie + redirects to /login).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, LogOut, ShieldAlert } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Analyse", icon: ShieldAlert },
  { href: "/history", label: "History", icon: History },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    // Expire the session hint cookie
    document.cookie =
      "phishcatch_session=; path=/; SameSite=Strict; max-age=0";
    router.push("/login");
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <ShieldAlert className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight hidden sm:block">
            PhishCatch <span className="text-blue-400">AI</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-slate-800 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {user && (
            <span className="text-xs text-slate-500 hidden md:block truncate max-w-[140px]">
              {user.username}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800/50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
