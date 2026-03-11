"use client";

/**
 * app/(auth)/login/page.tsx
 * ──────────────────────────
 * Login form using react-hook-form + zod.
 *
 * On success:
 *  1. Calls authStore.login() → fetches JWT + user profile.
 *  2. Sets the lightweight session hint cookie for Next.js middleware.
 *  3. Redirects to the callbackUrl (if present) or /dashboard.
 */
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  identifier: z
    .string()
    .min(1, "Please enter your email or username.")
    .max(254),
  password: z.string().min(1, "Please enter your password.").max(128),
});

type FormValues = z.infer<typeof schema>;

// ── Inner component (uses useSearchParams) ─────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ identifier, password }: FormValues) => {
    setApiError(null);
    try {
      await login(identifier, password);
      // Set the session hint cookie so middleware knows the user is logged in.
      // SameSite=Strict prevents CSRF; no HttpOnly here (JS needs to set/clear it).
      document.cookie = `phishcatch_session=1; path=/; SameSite=Strict; max-age=${60 * 60}`;
      router.push(callbackUrl);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Login failed.");
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-sm text-slate-400 mt-1">
          Sign in to analyse emails and view your history.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email / Username */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email or username
          </label>
          <input
            {...register("identifier")}
            type="text"
            autoComplete="username"
            placeholder="you@example.com"
            className={cn(
              "w-full bg-slate-800 border rounded-lg px-4 py-2.5 text-sm text-slate-100",
              "placeholder-slate-500 focus:outline-none focus:ring-2 transition",
              errors.identifier
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-600 focus:ring-blue-500"
            )}
          />
          {errors.identifier && (
            <p className="mt-1 text-xs text-red-400">{errors.identifier.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className={cn(
                "w-full bg-slate-800 border rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-100",
                "placeholder-slate-500 focus:outline-none focus:ring-2 transition",
                errors.password
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-600 focus:ring-blue-500"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* API Error */}
        {apiError && (
          <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
            {apiError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
            isSubmitting
              ? "bg-blue-800 text-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Sign in
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
          Create one
        </Link>
      </p>
    </>
  );
}

// ── Page export wrapped in Suspense (required for useSearchParams) ──────────

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
