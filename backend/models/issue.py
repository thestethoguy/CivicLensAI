"""
CivicLens AI – Pydantic Data Models
Defines the Issue document schema and all related request/response schemas.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Enumerations ───────────────────────────────────────────────────────────────

class SeverityLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class IssueStatus(str, Enum):
    REPORTED = "Reported"
    VERIFIED = "Verified"
    IN_PROGRESS = "In-Progress"
    RESOLVED = "Resolved"


class IssueCategory(str, Enum):
    POTHOLE = "Pothole"
    BROKEN_STREETLIGHT = "Broken Streetlight"
    WATER_LEAKAGE = "Water Leakage"
    WASTE_MANAGEMENT = "Waste Management"
    ROAD_DAMAGE = "Road Damage"
    DRAINAGE_ISSUE = "Drainage Issue"
    ILLEGAL_DUMPING = "Illegal Dumping"
    GRAFFITI = "Graffiti"
    FALLEN_TREE = "Fallen Tree"
    INFRASTRUCTURE_DAMAGE = "Infrastructure Damage"
    OTHER = "Other"


# ── AI Analysis Schema ─────────────────────────────────────────────────────────

class AIAnalysisResult(BaseModel):
    """Structured JSON payload returned by Gemini Vision."""

    category: str = Field(..., description="Civic issue category identified by the AI.")
    severity: SeverityLevel = Field(..., description="Severity level: Low, Medium, or High.")
    severity_rationale: str = Field(
        ..., description="Two-sentence structural rationale for the severity level."
    )
    clean_description: str = Field(
        ..., description="Detailed, formalized breakdown of the observed issue."
    )
    municipal_draft: str = Field(
        ..., description="Auto-generated high-urgency email draft for local authorities."
    )

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v: str) -> str:
        return v.strip().title()


# ── MongoDB Document Schema ────────────────────────────────────────────────────

class GeoPoint(BaseModel):
    """GeoJSON Point for MongoDB 2dsphere index compatibility."""

    type: str = Field(default="Point", frozen=True)
    coordinates: list[float] = Field(
        ..., description="[longitude, latitude] per GeoJSON spec."
    )

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v: list[float]) -> list[float]:
        if len(v) != 2:
            raise ValueError("coordinates must have exactly 2 elements: [longitude, latitude]")
        lon, lat = v
        if not (-180 <= lon <= 180):
            raise ValueError(f"Longitude must be between -180 and 180, got {lon}")
        if not (-90 <= lat <= 90):
            raise ValueError(f"Latitude must be between -90 and 90, got {lat}")
        return v


class IssueDocument(BaseModel):
    """Full MongoDB document schema for a civic issue report."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    image_url: str = Field(default="", description="URL/path to the uploaded image.")
    category: str = Field(..., description="Civic issue category.")
    severity_level: SeverityLevel = Field(..., description="AI-assessed severity.")
    severity_rationale: str = Field(default="", description="Rationale for severity assessment.")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location: GeoPoint = Field(..., description="GeoJSON point for spatial queries.")
    description: str = Field(..., description="Formalized AI-generated issue description.")
    status: IssueStatus = Field(default=IssueStatus.REPORTED)
    community_votes: int = Field(default=0, ge=0)
    structural_payload: str = Field(
        default="", description="JSON string with AI analysis + municipal draft."
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def build_geo_point(cls, values: dict[str, Any]) -> dict[str, Any]:
        """Auto-build GeoJSON location from lat/lon if not already provided."""
        if "location" not in values or values.get("location") is None:
            lat = values.get("latitude")
            lon = values.get("longitude")
            if lat is not None and lon is not None:
                values["location"] = {
                    "type": "Point",
                    "coordinates": [float(lon), float(lat)],
                }
        return values


# ── API Response Models ────────────────────────────────────────────────────────

class IssueResponse(BaseModel):
    """Serializable response model returned to the client."""

    id: str
    image_url: str
    category: str
    severity_level: SeverityLevel
    severity_rationale: str
    latitude: float
    longitude: float
    description: str
    status: IssueStatus
    community_votes: int
    municipal_draft: str
    created_at: datetime

    model_config = {"populate_by_name": True}


class AnalyzeResponse(BaseModel):
    """Top-level response for the /analyze endpoint."""

    success: bool = True
    message: str = "Issue analyzed and recorded successfully."
    issue: IssueResponse


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    success: bool = False
    message: str
    detail: Optional[str] = None
