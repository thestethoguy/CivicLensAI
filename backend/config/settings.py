"""
CivicLens AI – Application Configuration
Loads settings from environment variables or a .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Central configuration object for the CivicLens AI backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────────
    APP_NAME: str = "CivicLens AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── MongoDB ────────────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "civiclens"

    # ── Google AI Studio ───────────────────────────────────────────────────────
    GOOGLE_API_KEY: str = ""

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton of the application settings."""
    return Settings()
