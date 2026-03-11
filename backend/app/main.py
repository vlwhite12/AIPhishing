"""
app/main.py
────────────
FastAPI application factory.

Wires together:
  • CORS middleware (origin whitelist from config)
  • Rate limiting (slowapi, per-user JWT identity)
  • All routers
  • Trusted host validation in production
  • Global exception handlers for clean error responses

Architecture note: All database table creation is deferred to Alembic
migrations. `create_all` is intentionally absent from production code.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from limits import parse as parse_limit
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import get_settings
from app.routers import analysis_router, auth_router, history_router
from app.services.ai_engine import get_ai_engine

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Rate Limiter
# ─────────────────────────────────────────────────────────────────────────────
settings = get_settings()


def _get_user_identifier(request: Request) -> str:
    """
    Use the authenticated user's JWT subject (UUID) as the rate-limit key
    when available, falling back to IP address for anonymous endpoints.
    This prevents a single user from consuming the shared IP quota.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use the raw token as the key; it's opaque but unique per user session.
        # A decoded user ID would be cleaner but requires async context here.
        token = auth_header[7:]
        # Use last 12 chars of token (unique suffix) to avoid logging full tokens
        return f"token:{token[-12:]}" if len(token) > 12 else get_remote_address(request)
    return get_remote_address(request)


limiter = Limiter(key_func=_get_user_identifier)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Runs on startup and shutdown."""
    logger.info("PhishCatch AI backend starting up (env=%s)", settings.app_env)

    # Run database migrations in a thread so the event loop stays free to
    # respond to healthcheck requests while migrations execute.
    try:
        import asyncio, subprocess, sys
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                capture_output=True, text=True, timeout=60,
            ),
        )
        if result.returncode == 0:
            logger.info("Alembic migrations applied successfully.")
        else:
            logger.error("Alembic migration failed:\n%s", result.stderr)
    except Exception as exc:
        logger.error("Alembic migration error: %s", exc)

    # Warm up Ollama only when not in rule-based-only mode
    if settings.openai_base_url and not settings.rule_based_only:
        import asyncio
        async def _warmup():
            try:
                engine = get_ai_engine()
                await engine._client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[{"role": "user", "content": "hi"}],
                    max_tokens=1,
                    timeout=30.0,
                )
                logger.info("Ollama warmup complete — model loaded into RAM.")
            except Exception as exc:
                logger.warning("Ollama warmup skipped: %s", exc)
        asyncio.create_task(_warmup())
    yield
    logger.info("PhishCatch AI backend shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# App Factory
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PhishCatch AI API",
    description="AI-powered phishing email analysis backend.",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# CORS must be added BEFORE SlowAPIMiddleware so it is outermost in the stack.
# In development, allow all origins so local frontend/extension work without
# any configuration. In production, restrict to the configured whitelist.
if settings.is_production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    )
else:
    # Development: wildcard origins — allow_credentials MUST be False with "*"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ── Rate Limiter Middleware ────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── Trusted Host (production hardening) ──────────────────────────────────────
# Only enable if a custom domain is configured — Railway's generated domains
# change per deploy so we skip this check there.
if settings.is_production and settings.trusted_hosts:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[h.strip() for h in settings.trusted_hosts.split(",")],
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(
    analysis_router,
    # Apply rate limiting at the router level via the decorator on the endpoint.
)
app.include_router(history_router)


# ─────────────────────────────────────────────────────────────────────────────
# Global Exception Handlers
# ─────────────────────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all for unhandled exceptions.
    Returns a generic 500 without leaking stack traces to the client.
    Full traceback is logged server-side.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Health Check (no auth – used by load balancers / k8s probes)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", include_in_schema=False)
async def health_check() -> dict:
    return {"status": "ok", "service": settings.app_name}
