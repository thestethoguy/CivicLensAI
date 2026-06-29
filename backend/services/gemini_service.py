"""
CivicLens AI – Gemini Vision Service
Encapsulates all Google AI Studio / Gemini API interactions.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from config.settings import get_settings
from models.issue import AIAnalysisResult

logger = logging.getLogger(__name__)

# ── System Instruction ─────────────────────────────────────────────────────────
_SYSTEM_INSTRUCTION = """
You are a Professional Civil Engineering Auditor and Urban Infrastructure Assessment Specialist 
employed by a municipal government to evaluate civic issues reported by citizens. 
Your mandate is to objectively assess photographic evidence of public infrastructure damage, 
classify the issue type, evaluate its severity using established engineering criteria, 
and produce structured documentation for immediate municipal action.

CRITICAL RULES:
1. You MUST respond ONLY with a single, valid JSON object. Do NOT wrap it in markdown code fences.
2. Do NOT include any explanatory text outside the JSON structure.
3. All field values must be strings.
4. The "severity" field must be exactly one of: "Low", "Medium", or "High".
5. Base all assessments strictly on visible evidence in the image.
6. If the image does not depict a clear civic infrastructure issue, still return a valid JSON 
   with category "Other" and severity "Low".
"""

# ── Prompt Template ────────────────────────────────────────────────────────────
def _build_prompt(latitude: float, longitude: float) -> str:
    return f"""
Analyse the provided image of a potential civic infrastructure issue located at coordinates 
Latitude: {latitude:.6f}, Longitude: {longitude:.6f}.

Produce a structured JSON assessment with EXACTLY the following keys:

{{
  "category": "<Primary category from: Pothole, Broken Streetlight, Water Leakage, Waste Management, Road Damage, Drainage Issue, Illegal Dumping, Graffiti, Fallen Tree, Infrastructure Damage, Other>",
  "severity": "<Exactly one of: Low, Medium, High>",
  "severity_rationale": "<Exactly two sentences. Sentence 1: Describe the specific structural or safety evidence observed that determines this severity level. Sentence 2: State the potential public risk or consequence if left unaddressed.>",
  "clean_description": "<A detailed 3-5 sentence, technically precise, third-person description of the observed issue including: the type of damage, estimated extent/dimensions where visible, affected infrastructure components, and any secondary hazards present.>",
  "municipal_draft": "<A complete, professionally formatted, high-urgency email beginning with 'Subject: URGENT – Civic Infrastructure Issue Report – [Category] at Coordinates ({latitude:.6f}, {longitude:.6f})' followed by a formal body addressed to 'The Municipal Works Department' containing: date context, precise location, technical description, assessed severity, urgency recommendation, and a request for immediate inspection and remediation. Sign off as 'CivicLens AI Automated Reporting System'.>"
}}

Return ONLY the JSON object above. No preamble. No markdown. No trailing text.
"""


# ── Gemini Client Wrapper ──────────────────────────────────────────────────────
class GeminiVisionService:
    """Thread-safe singleton wrapper for the Gemini 2.5 Flash vision model."""

    _instance: GeminiVisionService | None = None
    _model: genai.GenerativeModel | None = None

    def __new__(cls) -> GeminiVisionService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self) -> None:
        """Configure the Gemini SDK and instantiate the model."""
        settings = get_settings()

        if not settings.GOOGLE_API_KEY:
            raise ValueError(
                "GOOGLE_API_KEY is not configured. "
                "Set it in your .env file or environment variables."
            )

        genai.configure(api_key=settings.GOOGLE_API_KEY)

        self._model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=_SYSTEM_INSTRUCTION,
            generation_config=genai.GenerationConfig(
                temperature=0.1,        # Low temperature for consistent structured output
                top_p=0.95,
                top_k=40,
                max_output_tokens=2048,
                response_mime_type="application/json",  # Force JSON MIME type
            ),
            safety_settings={
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
        )

        logger.info("Gemini Vision Service initialised with model: gemini-2.5-flash")

    @property
    def model(self) -> genai.GenerativeModel:
        if self._model is None:
            raise RuntimeError(
                "GeminiVisionService is not initialised. Call initialize() first."
            )
        return self._model

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        latitude: float,
        longitude: float,
    ) -> AIAnalysisResult:
        """
        Send an image to Gemini for civic issue analysis.

        Args:
            image_bytes: Raw bytes of the uploaded image.
            mime_type: MIME type of the image (e.g., 'image/jpeg').
            latitude: Approximate latitude of the reported issue.
            longitude: Approximate longitude of the reported issue.

        Returns:
            A validated AIAnalysisResult Pydantic model.

        Raises:
            ValueError: If the AI response cannot be parsed as valid JSON.
            RuntimeError: If the Gemini API call fails.
        """
        prompt = _build_prompt(latitude, longitude)

        image_part = {"mime_type": mime_type, "data": image_bytes}

        try:
            response = await self.model.generate_content_async(
                contents=[image_part, prompt],
                request_options={"timeout": 60},
            )
        except Exception as exc:
            logger.exception("Gemini API call failed.")
            raise RuntimeError(f"Gemini API request failed: {exc}") from exc

        raw_text = response.text.strip()
        logger.debug("Raw Gemini response: %s", raw_text[:500])

        parsed = _parse_json_response(raw_text)

        # Validate and coerce via Pydantic
        result = AIAnalysisResult(
            category=parsed.get("category", "Other"),
            severity=parsed.get("severity", "Low"),
            severity_rationale=parsed.get("severity_rationale", ""),
            clean_description=parsed.get("clean_description", ""),
            municipal_draft=parsed.get("municipal_draft", ""),
        )

        logger.info(
            "AI analysis complete – category: '%s', severity: '%s'",
            result.category,
            result.severity,
        )
        return result


def _parse_json_response(raw_text: str) -> dict[str, Any]:
    """
    Robustly parse a JSON object from the model's raw text response.
    Handles cases where the model wraps the JSON in markdown fences despite instructions.
    """
    # Strip markdown code fences if present
    fence_pattern = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)
    match = fence_pattern.search(raw_text)
    if match:
        raw_text = match.group(1)

    # Attempt direct parse
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    # Last-resort: find the first {...} block
    brace_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group())
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Failed to parse JSON from Gemini response. Raw text: {raw_text[:300]}"
            ) from exc

    raise ValueError(
        f"No JSON object found in Gemini response. Raw text: {raw_text[:300]}"
    )


# ── Module-level singleton ─────────────────────────────────────────────────────
gemini_service = GeminiVisionService()
