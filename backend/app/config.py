"""
app/config.py
─────────────
Centralised settings loaded from environment variables via pydantic-settings.
lru_cache ensures the Settings object is instantiated exactly once at startup.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────────────
    app_name: str = "PhishCatch AI"
    app_env: str = "development"

    # ── Database ─────────────────────────────────────────────────────────
    # Defaults to a local SQLite file — no installation required.
    # Override with a full PostgreSQL URL in .env for production.
    database_url: str = "sqlite+aiosqlite:///./phishcatch.db"

    # ── JWT ──────────────────────────────────────────────────────────────
    secret_key: str    # required – no default
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # ── AI ───────────────────────────────────────────────────────────────
    openai_api_key: str = "ollama"   # Ollama ignores the key; any non-empty value works
    openai_model: str = "llama3.2"
    # Leave empty for OpenAI; set to http://localhost:11434/v1 for Ollama
    openai_base_url: str = "http://localhost:11434/v1"
    # Set to true to skip the LLM entirely and always use the rule-based engine
    rule_based_only: bool = False
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    # ── Rate Limiting ─────────────────────────────────────────────────────
    rate_limit_analysis_per_hour: int = 20

    # ── CORS ─────────────────────────────────────────────────────────────
    allowed_origins: str = "http://localhost:3000"

    # ── Input Constraints ────────────────────────────────────────────────
    max_email_input_bytes: int = 51200  # 50 KB

    # ── Derived helpers ──────────────────────────────────────────────────
    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @field_validator("secret_key")
    @classmethod
    def secret_key_min_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters for security.")
        return v


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached singleton Settings instance.
    FastAPI dependency: Depends(get_settings)
    """
    return Settings()
