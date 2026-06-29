/**
 * CivicLens AI – API Client
 * Centralized Axios-free fetch wrapper for all backend communication.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function _get(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Server error: ${response.status}`);
  }
  return data;
}

// ── Phase 1: Intake Pipeline ──────────────────────────────────────────────────

/**
 * Analyzes a civic issue image using the backend AI pipeline.
 *
 * @param {File} imageFile   - The image file to analyze.
 * @param {number} latitude  - Latitude coordinate.
 * @param {number} longitude - Longitude coordinate.
 * @returns {Promise<Object>} - The parsed JSON response from the server.
 */
export async function analyzeIssue(imageFile, latitude, longitude) {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));

  const response = await fetch(`${API_BASE_URL}/api/v1/report/analyze`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type header — browser sets it automatically with boundary
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.detail || data?.message || `Server error: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

/**
 * @deprecated Use fetchIssues() instead.
 * Legacy call used by Phase 1 StatsBar (still works via the old intake router).
 */
export async function listIssues() {
  const response = await fetch(`${API_BASE_URL}/api/v1/report/issues`);
  if (!response.ok) throw new Error(`Failed to fetch issues: ${response.status}`);
  return response.json();
}

// ── Phase 2: Dashboard Endpoints ──────────────────────────────────────────────

/**
 * Fetches all civic issues from the new /api/v1/issues endpoint.
 * Returns { success, issues: IssueDoc[], count }.
 *
 * @returns {Promise<Object>}
 */
export async function fetchIssues() {
  return _get('/api/v1/issues');
}

/**
 * Fetches aggregate summary metrics for the dashboard header cards.
 * Returns { success, summary: { total_reports, severe_issues, resolved_issues } }.
 *
 * @returns {Promise<Object>}
 */
export async function fetchIssuesSummary() {
  return _get('/api/v1/issues/summary');
}

// ── Phase 3: Verification Engine ──────────────────────────────────────────────

/**
 * Calls the Community Consensus Agent to verify a specific issue.
 * Increments community_votes, stores AI agent_analysis, and may auto-promote
 * the issue status to "Verified" (at 3 votes).
 *
 * @param {string} id  - The issue document ID.
 * @returns {Promise<Object>}  { success, message, community_votes, status, agent_analysis, issue }
 */
export async function verifyIssue(id) {
  const response = await fetch(`${API_BASE_URL}/api/v1/issues/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Verification failed: ${response.status}`);
  }
  return data;
}
