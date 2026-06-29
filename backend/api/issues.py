"""
CivicLens AI – Issues Router  (Phase 2 + Phase 3)

Routes:
  GET  /api/v1/issues             – List all issues (serialised for React).
  GET  /api/v1/issues/summary     – Aggregate dashboard metrics.
  POST /api/v1/issues/{id}/verify – Community Consensus Agent verification.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from config.database import get_issues_collection
from services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/issues",
    tags=["Issues Dashboard"],
)


# ── Serialisation helper ───────────────────────────────────────────────────────

def _serialize_issue(issue: dict) -> dict:
    """
    Convert a raw MongoDB document into a JSON-safe dict.
    • `_id`  → string `id`
    • Drops raw GeoJSON `location` (lat/lon scalars are kept)
    • Coerces datetime → ISO-8601 string
    """
    issue["id"] = str(issue.pop("_id", ""))
    issue.pop("location", None)

    for ts_field in ("created_at", "updated_at"):
        val = issue.get(ts_field)
        if val is not None and hasattr(val, "isoformat"):
            issue[ts_field] = val.isoformat()

    return issue


# ── GET /api/v1/issues ─────────────────────────────────────────────────────────

@router.get(
    "",
    summary="List all reported civic issues",
    description=(
        "Returns up to 200 civic issue documents sorted by newest first. "
        "All MongoDB ObjectIds are serialised to plain strings for React consumption."
    ),
)
async def list_all_issues() -> JSONResponse:
    """Fetch and return all issues from MongoDB, serialised for the frontend."""
    try:
        collection = get_issues_collection()
        cursor = collection.find({}).sort("created_at", -1).limit(200)
        issues = await cursor.to_list(length=200)
        issues = [_serialize_issue(doc) for doc in issues]
        return JSONResponse(content={"success": True, "issues": issues, "count": len(issues)})
    except Exception as exc:
        logger.exception("Failed to retrieve issues list.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database read failed: {exc}",
        ) from exc


# ── GET /api/v1/issues/summary ─────────────────────────────────────────────────

@router.get(
    "/summary",
    summary="Aggregate dashboard metrics",
    description=(
        "Returns high-level counts used by the dashboard metric cards: "
        "total_reports, severe_issues (High severity), and resolved_issues."
    ),
)
async def issues_summary() -> JSONResponse:
    """Three lightweight count_documents queries for the dashboard header."""
    try:
        collection = get_issues_collection()
        total_reports   = await collection.count_documents({})
        severe_issues   = await collection.count_documents({"severity_level": "High"})
        resolved_issues = await collection.count_documents({"status": "Resolved"})
        return JSONResponse(
            content={
                "success": True,
                "summary": {
                    "total_reports":   total_reports,
                    "severe_issues":   severe_issues,
                    "resolved_issues": resolved_issues,
                },
            }
        )
    except Exception as exc:
        logger.exception("Failed to compute issues summary.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Aggregation failed: {exc}",
        ) from exc


# ── POST /api/v1/issues/{id}/verify ───────────────────────────────────────────

_VERIFICATION_SYSTEM = """
You are the CivicLens Community Consensus Agent — an AI specialist that evaluates
civic issue reports for authenticity and community impact.

CRITICAL RULES:
1. Respond ONLY with a single valid JSON object. No markdown, no prose outside JSON.
2. All field values must be strings or integers as specified below.
3. "verification_score" MUST be an integer between 80 and 99 (inclusive).
4. "impact_analysis" MUST be exactly two sentences describing local impact.
5. "action_plan" MUST be exactly two short action steps (numbered 1 and 2).
"""

_VERIFICATION_PROMPT = """
Review this civic issue report and return a JSON object with EXACTLY these keys:

{{
  "verification_score": <integer 80–99>,
  "impact_analysis": "<Two sentences on local community impact.>",
  "action_plan": "<1. First action step. 2. Second action step.>"
}}

Issue Details:
  Category    : {category}
  Severity    : {severity}
  Description : {description}

Return ONLY the JSON. No preamble. No markdown fences.
"""


def _parse_agent_json(raw: str) -> dict[str, Any]:
    """Robustly extract JSON from the agent's raw response text."""
    # Strip markdown fences
    clean = re.sub(r"```(?:json)?", "", raw, flags=re.IGNORECASE).replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError as exc:
            raise ValueError(f"Cannot parse agent JSON: {raw[:300]}") from exc
    raise ValueError(f"No JSON object found in agent response: {raw[:300]}")


@router.post(
    "/{issue_id}/verify",
    summary="Community Consensus Agent – verify a civic issue",
    description=(
        "Invokes the Gemini Community Consensus Agent to verify an issue. "
        "Increments community_votes; auto-promotes status to 'Verified' at 3 votes. "
        "Stores the AI analysis in agent_analysis on the document."
    ),
    status_code=status.HTTP_200_OK,
)
async def verify_issue(issue_id: str) -> JSONResponse:
    """
    Phase 3 verification pipeline:
    1. Resolve the issue_id to a MongoDB document (UUID string or ObjectId).
    2. Call the Gemini Community Consensus Agent.
    3. Update: increment community_votes, store agent_analysis, maybe promote status.
    4. Return the fully updated, serialised document.
    """
    collection = get_issues_collection()

    # ── 1. Resolve document by _id ─────────────────────────────────────────────
    # The _id is stored as a UUID string (set by IssueDocument), not an ObjectId.
    doc = await collection.find_one({"_id": issue_id})

    # Fallback: try interpreting as a BSON ObjectId
    if doc is None:
        try:
            doc = await collection.find_one({"_id": ObjectId(issue_id)})
        except (InvalidId, Exception):
            pass

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue '{issue_id}' not found.",
        )

    # ── 2. Build and send prompt to Gemini ────────────────────────────────────
    prompt = _VERIFICATION_PROMPT.format(
        category=doc.get("category", "Unknown"),
        severity=doc.get("severity_level", "Low"),
        description=(doc.get("description") or doc.get("clean_description") or "No description")[:500],
    )

    try:
        import google.generativeai as genai
        from config.settings import get_settings

        settings = get_settings()
        genai.configure(api_key=settings.GOOGLE_API_KEY)

        agent_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=_VERIFICATION_SYSTEM,
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                top_p=0.95,
                max_output_tokens=512,
                response_mime_type="application/json",
            ),
        )
        response = await agent_model.generate_content_async(
            contents=[prompt],
            request_options={"timeout": 45},
        )
        raw_text = response.text.strip()
        logger.debug("Agent raw response: %s", raw_text[:400])
        agent_data = _parse_agent_json(raw_text)

    except Exception as exc:
        logger.exception("Community Consensus Agent call failed.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI agent unavailable: {exc}",
        ) from exc

    # Clamp score to the expected range
    score = agent_data.get("verification_score", 85)
    try:
        score = max(80, min(99, int(score)))
    except (TypeError, ValueError):
        score = 85

    agent_analysis = {
        "verification_score": score,
        "impact_analysis":    str(agent_data.get("impact_analysis", "")),
        "action_plan":        str(agent_data.get("action_plan", "")),
        "verified_at":        datetime.now(timezone.utc).isoformat(),
    }

    # ── 3. Update MongoDB ──────────────────────────────────────────────────────
    current_votes = int(doc.get("community_votes", 0))
    new_votes = current_votes + 1
    new_status = "Verified" if new_votes >= 3 else doc.get("status", "Reported")

    update_result = await collection.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "community_votes":  new_votes,
                "agent_analysis":   agent_analysis,
                "status":           new_status,
                "updated_at":       datetime.now(timezone.utc),
            }
        },
    )

    if update_result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database update failed: document not matched.",
        )

    logger.info(
        "Issue '%s' verified – votes: %d, status: %s, score: %d",
        issue_id, new_votes, new_status, score,
    )

    # ── 4. Fetch updated document and return ──────────────────────────────────
    updated_doc = await collection.find_one({"_id": doc["_id"]})
    serialised  = _serialize_issue(updated_doc)

    return JSONResponse(
        content={
            "success":        True,
            "message":        f"Issue verified. Community votes: {new_votes}. Status: {new_status}.",
            "community_votes": new_votes,
            "status":         new_status,
            "agent_analysis": agent_analysis,
            "issue":          serialised,
        }
    )
