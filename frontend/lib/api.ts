/**
 * lib/api.ts
 * ──────────
 * Typed API client using axios.
 *
 * - Base URL comes from an env variable, NOT hardcoded.
 * - The JWT token is attached via a request interceptor.
 * - 401 responses trigger an automatic logout (token expired/revoked).
 * - Never surface raw axios errors to UI components; always throw typed APIError.
 */
import axios, { AxiosError, AxiosInstance } from "axios";
import {
  AIAnalysisResult,
  AnalyzeResponse,
  ScanDetail,
  ScanListResponse,
  TokenResponse,
  UserProfile,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 40_000, // 40 s – AI analysis can take time
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  // Token is stored in memory (not localStorage) to reduce XSS exposure.
  // It is managed by the useAuth store (Zustand).
  const token =
    typeof window !== "undefined"
      ? window.__phishcatch_token ?? null
      : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: normalise errors ───────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail: string }>) => {
    if (error.response?.status === 401) {
      // Token expired or revoked – clear auth state
      if (typeof window !== "undefined") {
        delete window.__phishcatch_token;
        // Let the auth store / middleware handle the redirect
        window.dispatchEvent(new Event("phishcatch:logout"));
      }
    }
    return Promise.reject(error);
  }
);

// Augment the Window interface for our in-memory token slot
declare global {
  interface Window {
    __phishcatch_token?: string;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract a readable error message from an axios error
// ─────────────────────────────────────────────────────────────────────────────

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error as AxiosError<{ detail: string }>).response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.code === "ECONNABORTED") return "The request timed out. Please try again.";
    if (!error.response) return "Unable to reach the server. Check your connection.";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Register a new user account.
   * Returns the created user profile (no token – user must then login).
   */
  register: async (
    email: string,
    username: string,
    password: string
  ): Promise<UserProfile> => {
    const { data } = await apiClient.post<UserProfile>("/api/auth/register", {
      email,
      username,
      password,
    });
    return data;
  },

  /**
   * Exchange credentials for a JWT access token.
   * Uses form-encoded body as required by FastAPI's OAuth2PasswordRequestForm.
   */
  login: async (identifier: string, password: string): Promise<TokenResponse> => {
    const form = new URLSearchParams();
    form.append("username", identifier);
    form.append("password", password);

    const { data } = await apiClient.post<TokenResponse>("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  /** Fetch the currently authenticated user's profile. */
  getMe: async (): Promise<UserProfile> => {
    const { data } = await apiClient.get<UserProfile>("/api/auth/me");
    return data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Analysis API
// ─────────────────────────────────────────────────────────────────────────────

export const analysisApi = {
  /**
   * Submit email text for AI phishing analysis.
   * Returns the risk score, red flags, and actionable advice.
   */
  analyze: async (emailText: string, label?: string): Promise<AnalyzeResponse> => {
    const { data } = await apiClient.post<AnalyzeResponse>("/api/analysis/analyze", {
      email_text: emailText,
      label: label ?? null,
    });
    return data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// History API
// ─────────────────────────────────────────────────────────────────────────────

export const historyApi = {
  /** Paginated list of the user's past scans. */
  list: async (page = 1, pageSize = 20): Promise<ScanListResponse> => {
    const { data } = await apiClient.get<ScanListResponse>("/api/history", {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  /** Full detail (including AI result) for a single scan. */
  get: async (scanId: string): Promise<ScanDetail> => {
    const { data } = await apiClient.get<ScanDetail>(`/api/history/${scanId}`);
    return data;
  },

  /** Permanently delete a scan. */
  delete: async (scanId: string): Promise<void> => {
    await apiClient.delete(`/api/history/${scanId}`);
  },
};

export default apiClient;
