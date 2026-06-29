/**
 * CivicLens AI – IssueFeed Component  (Phase 3 update)
 *
 * Each card now has a wired-up "Verify Issue" button that:
 *  1. Shows "🤖 Agent Analyzing…" loading state.
 *  2. Calls verifyIssue(id) → Community Consensus Agent.
 *  3. On success: awards +50 Civic Points, expands the card to show
 *     the agent_analysis (score bar, impact analysis, action plan).
 *  4. Changes the button to a disabled "✅ Verified" state.
 *
 * Transitions use Tailwind's transition-all + duration-500 for smooth expansion.
 */

import React, { useState } from 'react';
import { verifyIssue } from '../api/client';

// ── Severity config ────────────────────────────────────────────────────────────

const SEVERITY = {
  High:   { bg: 'bg-red-500/15',     text: 'text-red-300',     border: 'border-red-500/30',     dot: 'bg-red-400',     bar: 'bg-red-500'     },
  Medium: { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/30',   dot: 'bg-amber-400',   bar: 'bg-amber-500'   },
  Low:    { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400', bar: 'bg-emerald-500' },
};
function sev(level) { return SEVERITY[level] ?? SEVERITY.Low; }

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Skeletons & empty states ───────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="glass rounded-xl p-4 space-y-3 animate-pulse">
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-slate-700/60 rounded-full" />
            <div className="h-5 w-24 bg-slate-800/60 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-800/60 rounded w-full" />
            <div className="h-3 bg-slate-800/60 rounded w-5/6" />
          </div>
          <div className="h-8 bg-slate-800/40 rounded-lg w-28" />
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <span className="text-5xl mb-3">📭</span>
      <p className="text-slate-400 font-medium">No issues reported yet</p>
      <p className="text-slate-600 text-sm mt-1">Use the "Report an Issue" tab to submit the first one.</p>
    </div>
  );
}

// ── Agent Analysis Panel (expandable section) ──────────────────────────────────

function AgentAnalysisPanel({ analysis }) {
  if (!analysis) return null;
  const score = analysis.verification_score ?? 85;

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3 animate-fade-in">

      {/* Verification Score */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-400">🤖 Verification Score</span>
          <span className="text-sm font-extrabold text-teal-400">{score}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Impact Analysis */}
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-3">
        <p className="text-xs font-semibold text-slate-400 mb-1">🏙️ Impact Analysis</p>
        <p className="text-xs text-slate-300 leading-relaxed">{analysis.impact_analysis}</p>
      </div>

      {/* Action Plan */}
      <div className="rounded-xl bg-teal-500/5 border border-teal-500/20 p-3">
        <p className="text-xs font-semibold text-teal-400 mb-1">📋 Action Plan</p>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{analysis.action_plan}</p>
      </div>

      {/* +50 Points badge */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
          +50 🏆 Civic Points Awarded
        </span>
      </div>
    </div>
  );
}

// ── Single Feed Card ───────────────────────────────────────────────────────────

function FeedCard({ issue, index, civicPoints, setCivicPoints }) {
  const [verifying,     setVerifying]     = useState(false);
  const [verified,      setVerified]      = useState(
    // Pre-mark as verified if already verified in DB
    issue.status === 'Verified' && issue.agent_analysis != null
  );
  const [agentAnalysis, setAgentAnalysis] = useState(
    issue.agent_analysis ?? null
  );
  const [errorMsg, setErrorMsg] = useState('');

  const s = sev(issue.severity_level);
  const draft   = issue.municipal_draft || issue.description || '';
  const snippet = draft.length > 160 ? draft.slice(0, 157) + '…' : draft;

  async function handleVerify() {
    if (verifying || verified) return;
    setVerifying(true);
    setErrorMsg('');
    try {
      const result = await verifyIssue(issue.id);
      setAgentAnalysis(result.agent_analysis);
      setVerified(true);
      // Award +50 Civic Points
      setCivicPoints((prev) => prev + 50);
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      className="glass rounded-xl p-4 card-hover animate-slide-up border border-slate-700/30
                 hover:border-teal-500/20 transition-all duration-500"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                            ${s.bg} ${s.text} border ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
            {issue.severity_level || 'Low'}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                           bg-slate-800/80 text-slate-300 border border-slate-700/50">
            {issue.category || 'Unknown'}
          </span>
          {verified && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                             bg-teal-500/15 text-teal-300 border border-teal-500/30">
              ✓ Verified
            </span>
          )}
        </div>
        <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">
          {timeAgo(issue.created_at)}
        </span>
      </div>

      {/* Municipal draft snippet */}
      <p className="text-xs text-slate-400 leading-relaxed mb-3 font-mono">{snippet}</p>

      {/* Coordinates */}
      {issue.latitude != null && (
        <div className="flex items-center gap-1 text-xs text-slate-600 mb-3">
          <span>📍</span>
          <span className="font-mono">
            {Number(issue.latitude).toFixed(4)}°N, {Number(issue.longitude).toFixed(4)}°E
          </span>
        </div>
      )}

      {/* Severity bar */}
      <div className="h-0.5 w-full bg-slate-800 rounded-full mb-3">
        <div
          className={`h-full rounded-full ${s.bar} transition-all duration-700`}
          style={{
            width: issue.severity_level === 'High' ? '100%'
                 : issue.severity_level === 'Medium' ? '60%' : '30%',
          }}
        />
      </div>

      {/* Footer: status + verify button */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-600">
          Status: <span className="text-slate-400 font-medium">{issue.status || 'Reported'}</span>
          {issue.community_votes > 0 && (
            <span className="ml-2 text-teal-600">· {issue.community_votes} vote{issue.community_votes !== 1 ? 's' : ''}</span>
          )}
        </span>

        <button
          id={`verify-btn-${issue.id}`}
          onClick={handleVerify}
          disabled={verifying || verified}
          className={`
            px-3 py-1.5 text-xs font-semibold rounded-lg
            transition-all duration-200 btn-press flex items-center gap-1.5
            ${verified
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30 cursor-default opacity-70'
              : verifying
                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/30 cursor-wait'
                : 'bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20 hover:border-teal-400/50 hover:text-teal-300 active:scale-95'
            }
          `}
        >
          {verifying
            ? <><span className="animate-spin">⚙️</span> Agent Analyzing…</>
            : verified
              ? <>✅ Verified</>
              : <>✓ Verify Issue</>
          }
        </button>
      </div>

      {/* Error message */}
      {errorMsg && (
        <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          ⚠️ {errorMsg}
        </p>
      )}

      {/* Agent analysis expansion (smooth transition) */}
      <div className={`overflow-hidden transition-all duration-500 ${agentAnalysis ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {agentAnalysis && <AgentAnalysisPanel analysis={agentAnalysis} />}
      </div>
    </div>
  );
}

// ── IssueFeed ──────────────────────────────────────────────────────────────────

export default function IssueFeed({ issues = [], loading = false, civicPoints = 0, setCivicPoints = () => {} }) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full" />
          <h3 className="text-sm font-bold text-slate-100">Live Issue Feed</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs text-teal-400 font-medium">{issues.length} active</span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <FeedSkeleton />
        ) : issues.length === 0 ? (
          <EmptyFeed />
        ) : (
          <div className="space-y-3 p-4">
            {issues.map((issue, i) => (
              <FeedCard
                key={issue.id ?? i}
                issue={issue}
                index={i}
                civicPoints={civicPoints}
                setCivicPoints={setCivicPoints}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
