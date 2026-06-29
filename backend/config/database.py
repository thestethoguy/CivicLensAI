"""
CivicLens AI – MongoDB Database Helper
Manages a Motor async client and exposes the 'issues' collection.
"""

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo import IndexModel, ASCENDING, GEOSPHERE

from config.settings import get_settings

logger = logging.getLogger(__name__)

# ── Module-level singletons ────────────────────────────────────────────────────
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    """Open the Motor connection pool and ensure required indexes exist."""
    global _client, _db

    settings = get_settings()
    logger.info("Connecting to MongoDB at %s …", settings.MONGODB_URI)

    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=5_000,
        connectTimeoutMS=10_000,
        socketTimeoutMS=30_000,
    )

    _db = _client[settings.MONGODB_DB_NAME]

    # Verify the connection is live
    await _client.admin.command("ping")
    logger.info("MongoDB connection established – database: '%s'", settings.MONGODB_DB_NAME)

    await _ensure_indexes()


async def close_mongo_connection() -> None:
    """Gracefully close the Motor connection pool."""
    global _client
    if _client is not None:
        _client.close()
        logger.info("MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Return the active database instance (raises if not connected)."""
    if _db is None:
        raise RuntimeError(
            "Database is not initialised. "
            "Ensure connect_to_mongo() is called during application startup."
        )
    return _db


def get_issues_collection() -> AsyncIOMotorCollection:
    """Return the 'issues' collection."""
    return get_database()["issues"]


async def _ensure_indexes() -> None:
    """Create indexes on the issues collection (idempotent)."""
    collection = get_issues_collection()

    indexes = [
        IndexModel([("status", ASCENDING)], name="idx_status"),
        IndexModel([("category", ASCENDING)], name="idx_category"),
        IndexModel([("severity_level", ASCENDING)], name="idx_severity"),
        IndexModel([("created_at", ASCENDING)], name="idx_created_at"),
        # 2dsphere index for geospatial queries on the 'location' field
        IndexModel([("location", GEOSPHERE)], name="idx_location_geo"),
    ]

    await collection.create_indexes(indexes)
    logger.info("MongoDB indexes ensured on 'issues' collection.")
