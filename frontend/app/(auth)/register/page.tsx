"use client";

/**
 * app/(auth)/register/page.tsx
 * ─────────────────────────────
 * Registration form. On success, auto-logs the user in and redirects
 * to the dashboard (handled by authStore.register which chains login).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

// ── Schema ────────────────────────────────────────────────────────────────
// Mirrors backend UserRegisterRequest validation so errors surface client-side
// before hitting the network.

const schema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required.")
      .email("Please enter a valid email address."),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .max(50, "Username must be under 50 characters.")
      .regex(
        /^[a-zA-Z0-9_\-]+$/,
        "Username can only contain letters, numbers, _ and -"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128)
      .refine(
        (v) => /[a-zA-Z]/.test(v) && /\d/.test(v),
        "Password must contain at least one letter and one number."
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

// ── Component ────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const registerAction = useAuthStore((s) => s.register);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email, username, password }: FormValues) => {
    setApiError(null);
    try {
      await registerAction(email, username, password);
      // Set the session hint cookie
      document.cookie = `phishcatch_session=1; path=/; SameSite=Strict; max-age=${60 * 60}`;
      router.push("/dashboard");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Registration failed.");
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-sm text-slate-400 mt-1">
          Free to use. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <Field label="Email address" error={errors.email?.message}>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass(!!errors.email)}
          />
        </Field>

        {/* Username */}
        <Field
          label="Username"
          hint="Letters, numbers, _ and - only"
          error={errors.username?.message}
        >
          <input
            {...register("username")}
            type="text"
            autoComplete="username"
            placeholder="your_handle"
            className={inputClass(!!errors.username)}
          />
        </Field>

        {/* Password */}
        <Field
          label="Password"
          hint="Minimum 8 characters, at least 1 letter and 1 number"
          error={errors.password?.message}
        >
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn(inputClass(!!errors.password), "pr-10")}
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
        </Field>

        {/* Confirm Password */}
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <input
            {...register("confirmPassword")}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass(!!errors.confirmPassword)}
          />
        </Field>

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
              Creating account…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Create account
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
          Sign in
        </Link>
      </p>
    </>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function inputClass(hasError: boolean) {
  return cn(
    "w-full bg-slate-800 border rounded-lg px-4 py-2.5 text-sm text-slate-100",
    "placeholder-slate-500 focus:outline-none focus:ring-2 transition",
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-600 focus:ring-blue-500"
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
