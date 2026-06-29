"""
CivicLens AI – Issue Intake Router
POST /api/v1/report/analyze – Accepts an image upload + GPS coordinates,
runs Gemini Vision analysis, persists the result to MongoDB, and returns
the enriched issue document.
"""

from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from config.database import get_issues_collection
from models.issue import (
    AnalyzeResponse,
    ErrorResponse,
    IssueDocument,
    IssueResponse,
    IssueStatus,
)
from services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/report",
    tags=["Issue Intake"],
)

# ── Allowed MIME types ─────────────────────────────────────────────────────────
_ALLOWED_MIME_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"}
)
_MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Analyze a civic issue image with AI and store the report",
    description=(
        "Accepts a multipart/form-data upload containing an image file plus "
        "approximate GPS coordinates. The image is sent to Gemini 1.5 Flash for "
        "civic infrastructure analysis. The enriched result is persisted to MongoDB "
        "and returned to the client."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input (bad file type / size)"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "AI or database failure"},
    },
)
async def analyze_issue(
    file: Annotated[UploadFile, File(description="Image file of the civic issue (max 10 MB).")],
    latitude: Annotated[float, Form(description="Approximate latitude of the issue location.", ge=-90, le=90)],
    longitude: Annotated[float, Form(description="Approximate longitude of the issue location.", ge=-180, le=180)],
) -> JSONResponse:
    """
    Core intake pipeline:
    1. Validate the uploaded file (type + size).
    2. Read image bytes.
    3. Call Gemini Vision for structured AI analysis.
    4. Persist enriched document to MongoDB.
    5. Return the saved document to the client.
    """

    # ── 1. Validate file type ──────────────────────────────────────────────────
    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{mime_type}'. "
                f"Accepted types: {', '.join(sorted(_ALLOWED_MIME_TYPES))}"
            ),
        )

    # ── 2. Read image bytes and enforce size limit ──────────────────────────────
    image_bytes = await file.read()
    if len(image_bytes) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size {len(image_bytes) / 1_048_576:.1f} MB exceeds the 10 MB limit.",
        )

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    logger.info(
        "Received image '%s' (%.2f KB) at (%.6f, %.6f)",
        file.filename,
        len(image_bytes) / 1024,
        latitude,
        longitude,
    )

    # ── 3. Run Gemini Vision analysis ──────────────────────────────────────────
    try:
        ai_result = await gemini_service.analyze_image(
            image_bytes=image_bytes,
            mime_type=mime_type,
            latitude=latitude,
            longitude=longitude,
        )
    except ValueError as exc:
        logger.error("AI response parsing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI response parsing error: {exc}",
        ) from exc
    except RuntimeError as exc:
        logger.error("Gemini API call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service unavailable: {exc}",
        ) from exc

    # ── 4. Build and persist the MongoDB document ──────────────────────────────
    structural_payload = json.dumps(
        {
            "ai_category": ai_result.category,
            "ai_severity": ai_result.severity.value,
            "severity_rationale": ai_result.severity_rationale,
            "clean_description": ai_result.clean_description,
            "municipal_draft": ai_result.municipal_draft,
            "model": "gemini-1.5-flash",
            "image_filename": file.filename or "unknown",
        },
        ensure_ascii=False,
        indent=2,
    )

    issue_doc = IssueDocument(
        image_url=f"uploads/{file.filename or 'unknown'}",
        category=ai_result.category,
        severity_level=ai_result.severity,
        severity_rationale=ai_result.severity_rationale,
        latitude=latitude,
        longitude=longitude,
        description=ai_result.clean_description,
        status=IssueStatus.REPORTED,
        community_votes=0,
        structural_payload=structural_payload,
    )

    doc_dict = issue_doc.model_dump(by_alias=True)

    try:
        collection = get_issues_collection()
        insert_result = await collection.insert_one(doc_dict)
        logger.info("Issue document inserted: %s", insert_result.inserted_id)
    except Exception as exc:
        logger.exception("MongoDB insert failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database write failed: {exc}",
        ) from exc

    # ── 5. Build and return the response ──────────────────────────────────────
    response_payload = AnalyzeResponse(
        issue=IssueResponse(
            id=issue_doc.id,
            image_url=issue_doc.image_url,
            category=issue_doc.category,
            severity_level=issue_doc.severity_level,
            severity_rationale=issue_doc.severity_rationale,
            latitude=issue_doc.latitude,
            longitude=issue_doc.longitude,
            description=issue_doc.description,
            status=issue_doc.status,
            community_votes=issue_doc.community_votes,
            municipal_draft=ai_result.municipal_draft,
            created_at=issue_doc.created_at,
        )
    )

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=response_payload.model_dump(mode="json"),
    )


@router.get(
    "/issues",
    summary="List all reported civic issues",
    description="Returns the most recent 50 issues from the database.",
)
async def list_issues() -> JSONResponse:
    """Retrieve the latest 50 civic issue reports."""
    try:
        collection = get_issues_collection()
        cursor = collection.find({}).sort("created_at", -1).limit(50)
        issues = await cursor.to_list(length=50)

        # Convert ObjectId / _id to string for JSON serialisation
        for issue in issues:
            issue["id"] = str(issue.pop("_id", ""))
            if "location" in issue:
                del issue["location"]  # Remove raw GeoJSON from response
            if "created_at" in issue and hasattr(issue["created_at"], "isoformat"):
                issue["created_at"] = issue["created_at"].isoformat()
            if "updated_at" in issue and hasattr(issue["updated_at"], "isoformat"):
                issue["updated_at"] = issue["updated_at"].isoformat()

        return JSONResponse(content={"success": True, "issues": issues, "count": len(issues)})
    except Exception as exc:
        logger.exception("Failed to retrieve issues.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database read failed: {exc}",
        ) from exc
