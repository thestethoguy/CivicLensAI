/**
 * CivicLens AI – Analysis Result Card
 * Displays the AI-extracted civic issue data in a structured, premium layout.
 */

import React, { useState } from 'react';
import { SeverityBadge } from './SeverityBadge';

const CATEGORY_ICONS = {
  'Pothole': '🕳️',
  'Broken Streetlight': '💡',
  'Water Leakage': '💧',
  'Waste Management': '🗑️',
  'Road Damage': '🛣️',
  'Drainage Issue': '🌊',
  'Illegal Dumping': '♻️',
  'Graffiti': '🎨',
  'Fallen Tree': '🌳',
  'Infrastructure Damage': '🏗️',
  'Other': '📍',
};

/**
 * @param {{
 *   result: import('../api/client').AnalyzeResponse,
 *   imagePreview: string,
 * }} props
 */
export function ResultCard({ result, imagePreview }) {
  const [draftCopied, setDraftCopied] = useState(false);
  const issue = result.issue;

  const categoryIcon = CATEGORY_ICONS[issue.category] || '📍';
  const reportedAt = new Date(issue.created_at).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(issue.municipal_draft);
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2500);
    } catch {
      // Clipboard API unavailable – select text as fallback
    }
  };

  return (
    <div className="animate-slide-in-right h-full overflow-y-auto pr-1">
      {/* ── Header strip ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-teal-400 font-semibold tracking-widest uppercase mb-1">
            Analysis Complete
          </p>
          <h2 className="text-2xl font-bold text-slate-100 leading-tight">
            {categoryIcon} {issue.category}
          </h2>
        </div>
        <SeverityBadge severity={issue.severity_level} size="lg" />
      </div>

      {/* ── Image + Meta grid ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Submitted image thumbnail */}
        <div className="rounded-xl overflow-hidden border border-slate-700/60 aspect-video bg-slate-900">
          <img
            src={imagePreview}
            alt="Submitted civic issue"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Meta cards */}
        <div className="flex flex-col gap-2">
          <MetaTile
            label="Coordinates"
            value={`${issue.latitude.toFixed(4)}°, ${issue.longitude.toFixed(4)}°`}
            icon="📍"
          />
          <MetaTile label="Status" value={issue.status} icon="📊" />
          <MetaTile label="Votes" value={String(issue.community_votes)} icon="🗳️" />
          <MetaTile label="Reported At" value={reportedAt} icon="🕐" />
        </div>
      </div>

      {/* ── Severity Rationale ── */}
      <Section title="Severity Assessment" icon="⚠️">
        <p className="text-slate-300 text-sm leading-relaxed">{issue.severity_rationale}</p>
      </Section>

      {/* ── AI Description ── */}
      <Section title="Technical Description" icon="🔬">
        <p className="text-slate-300 text-sm leading-relaxed">{issue.description}</p>
      </Section>

      {/* ── Municipal Draft ── */}
      <Section
        title="Auto-Generated Municipal Draft"
        icon="📋"
        action={
          <button
            id="copy-draft-btn"
            onClick={handleCopyDraft}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all duration-200 btn-press ${
              draftCopied
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-700/60 text-slate-300 border border-slate-600/40 hover:bg-teal-500/10 hover:text-teal-400 hover:border-teal-500/30'
            }`}
            aria-label="Copy municipal draft to clipboard"
          >
            {draftCopied ? '✓ Copied!' : 'Copy'}
          </button>
        }
      >
        <div className="relative">
          <textarea
            readOnly
            value={issue.municipal_draft}
            rows={8}
            className="w-full bg-slate-950/60 text-slate-300 text-xs leading-relaxed font-mono rounded-lg px-3 py-3 border border-slate-700/40 focus:border-teal-500/40 placeholder-slate-600 transition-colors"
            aria-label="Municipal draft email"
          />
          <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        </div>
      </Section>

      {/* ── Issue ID footer ── */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-600 font-mono border-t border-slate-800 pt-3">
        <span>Issue ID: {issue.id.slice(0, 8)}…</span>
        <span className="text-teal-600">Powered by Gemini 1.5 Flash</span>
      </div>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

function MetaTile({ label, value, icon }) {
  return (
    <div className="glass rounded-lg px-3 py-2 flex items-center gap-2 card-hover">
      <span className="text-base flex-shrink-0" role="img" aria-label={label}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action }) {
  return (
    <div className="glass rounded-xl p-4 mb-3 card-hover">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base" role="img" aria-label={title}>{icon}</span>
          <h3 className="text-sm font-semibold text-teal-300 tracking-wide uppercase">
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
