"use client";

/**
 * components/dashboard/EmailAnalysisForm.tsx
 * ────────────────────────────────────────────
 * The main input form where users paste email text for analysis.
 *
 * Features:
 *  - react-hook-form + zod for client-side validation
 *  - Character / byte counter with soft warning
 *  - Loading state with animated indicator
 *  - Passes result up to parent via onResult callback
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Loader2, AlertTriangle, ClipboardPaste } from "lucide-react";

import { analysisApi, extractErrorMessage } from "@/lib/api";
import { AnalyzeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Validation Schema ─────────────────────────────────────────────────────────

const MAX_CHARS = 40_000; // Slightly below backend 50 KB cap (accounting for UTF-8 overhead)

const formSchema = z.object({
  emailText: z
    .string()
    .min(20, "Please paste more email content (minimum 20 characters).")
    .max(MAX_CHARS, `Email text must be under ${MAX_CHARS.toLocaleString()} characters.`),
  label: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface EmailAnalysisFormProps {
  onResult: (result: AnalyzeResponse) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailAnalysisForm({ onResult }: EmailAnalysisFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { emailText: "", label: "" },
  });

  const emailText = watch("emailText");
  const charCount = emailText?.length ?? 0;
  const nearLimit = charCount > MAX_CHARS * 0.85;

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    try {
      const result = await analysisApi.analyze(
        values.emailText,
        values.label || undefined
      );
      onResult(result);
    } catch (err) {
      setApiError(extractErrorMessage(err));
    }
  };

  const handlePasteExample = () => {
    // Demo email for quick testing — safe to hardcode as it's just UI scaffolding
    reset({
      emailText: `From: "PayPal Security" <security@paypa1-support.com>
Reply-To: noreply@mail-verification.xyz
Subject: URGENT: Your PayPal account has been limited!

Dear Valued Customer,

We have detected unusual activity on your PayPal account. Your account access has been temporarily limited.

To restore full access, you must verify your information within 24 hours or your account will be permanently suspended.

Click here to verify now: http://paypa1-secure-login.xyz/verify?token=a8f3k2

This is an automated message. Do not reply to this email.

PayPal Security Team`,
      label: "Demo phishing email",
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Analyse Email</h2>
            <p className="text-sm text-slate-400">
              Paste raw email headers + body, or just the body text
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePasteExample}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Try example
        </button>
      </div>

      {/* ── Optional Label ───────────────────────────────────────────────── */}
      <div>
        <input
          {...register("label")}
          type="text"
          placeholder='Optional label, e.g. "Suspicious PayPal email"'
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm
                     text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2
                     focus:ring-blue-500 transition"
        />
        {errors.label && (
          <p className="mt-1 text-xs text-red-400">{errors.label.message}</p>
        )}
      </div>

      {/* ── Email Text Area ──────────────────────────────────────────────── */}
      <div>
        <textarea
          {...register("emailText")}
          rows={14}
          placeholder={`Paste the full email here, including headers if available.\n\nExample headers to look for:\n  From:\n  Reply-To:\n  Received:\n  Subject:`}
          className={cn(
            "w-full bg-slate-800 border rounded-xl px-4 py-3 text-sm font-mono",
            "text-slate-200 placeholder-slate-600 resize-y focus:outline-none",
            "focus:ring-2 transition leading-relaxed",
            errors.emailText
              ? "border-red-500 focus:ring-red-500"
              : "border-slate-600 focus:ring-blue-500"
          )}
        />
        {/* Character counter */}
        <div className="flex items-center justify-between mt-1.5">
          {errors.emailText ? (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {errors.emailText.message}
            </p>
          ) : (
            <span />
          )}
          <span
            className={cn(
              "text-xs ml-auto",
              nearLimit ? "text-orange-400" : "text-slate-500"
            )}
          >
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── API Error Banner ─────────────────────────────────────────────── */}
      {apiError && (
        <div className="flex items-start gap-2 bg-red-950 border border-red-700 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{apiError}</p>
        </div>
      )}

      {/* ── Submit Button ────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6",
          "text-sm font-semibold transition-all duration-200",
          isSubmitting
            ? "bg-blue-800 text-blue-300 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-900/40"
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing with AI…
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" />
            Analyse for Phishing
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-600">
        Analysis is performed by an AI and may not catch all threats.
        Always apply human judgement before clicking links.
      </p>
    </form>
  );
}
