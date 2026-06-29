/**
 * CivicLens AI – Dashboard Component  (Phase 3 update)
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  🏆 Civic Points Badge (top-right)                      │
 *   │  Metric Cards × 3  (glassmorphism)                      │
 *   ├──────────────────────────────────┬──────────────────────┤
 *   │  IssueMap  (60%)                 │  IssueFeed  (40%)    │
 *   └──────────────────────────────────┴──────────────────────┘
 */

import React, { useEffect, useState } from 'react';
import IssueMap from './IssueMap';
import IssueFeed from './IssueFeed';
import { fetchIssues, fetchIssuesSummary } from '../api/client';

// ── Civic Points Badge ─────────────────────────────────────────────────────────

function CivicPointsBadge({ points }) {
  const tier =
    points >= 500 ? { label: 'Civic Hero',    color: 'from-yellow-400 to-amber-500',  glow: 'shadow-amber-500/40'  } :
    points >= 200 ? { label: 'City Guardian', color: 'from-teal-400  to-cyan-500',    glow: 'shadow-teal-500/40'   } :
    points >= 50  ? { label: 'Active Citizen',color: 'from-violet-400 to-purple-500', glow: 'shadow-violet-500/40' } :
                    { label: 'Newcomer',       color: 'from-slate-400  to-slate-500',  glow: 'shadow-slate-500/20'  };

  return (
    <div
      className={`
        relative flex items-center gap-3 px-4 py-2.5 rounded-2xl
        bg-slate-900/80 border border-slate-700/50
        shadow-lg ${tier.glow} backdrop-blur-md
        transition-all duration-500
      `}
    >
      {/* Animated trophy */}
      <span className="text-2xl animate-bounce" style={{ animationDuration: '2s' }}>🏆</span>

      <div>
        <p className="text-xs text-slate-500 leading-none font-medium">Civic Points</p>
        <p className={`text-xl font-extrabold leading-tight bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
          {points.toLocaleString()}
        </p>
      </div>

      {/* Tier label pill */}
      <span className={`
        absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full
        bg-gradient-to-r ${tier.color} text-white shadow-md
      `}>
        {tier.label}
      </span>
    </div>
  );
}

// ── Metric Card ────────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, loading, accent, description }) {
  const accentMap = {
    teal:    { glow: 'shadow-teal-500/20',    border: 'border-teal-500/20',    text: 'text-teal-400',    bg: 'from-teal-500/10 to-transparent'    },
    red:     { glow: 'shadow-red-500/20',     border: 'border-red-500/20',     text: 'text-red-400',     bg: 'from-red-500/10 to-transparent'     },
    emerald: { glow: 'shadow-emerald-500/20', border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'from-emerald-500/10 to-transparent'  },
  };
  const a = accentMap[accent] ?? accentMap.teal;

  return (
    <div className={`relative glass rounded-2xl p-5 card-hover overflow-hidden border ${a.border} shadow-lg ${a.glow}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${a.bg} pointer-events-none`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">{label}</p>
          <p className={`text-4xl font-extrabold ${a.text} leading-none tracking-tight`}>
            {loading
              ? <span className="inline-block w-16 h-9 bg-slate-700/60 rounded-lg animate-pulse align-middle" />
              : (value ?? '—')
            }
          </p>
          <p className="text-xs text-slate-600 mt-2">{description}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.bg} border ${a.border} flex items-center justify-center text-2xl flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${a.bg}`} />
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [issues,         setIssues]         = useState([]);
  const [summary,        setSummary]        = useState(null);
  const [loadingMap,     setLoadingMap]     = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [lastRefresh,    setLastRefresh]    = useState(null);
  // Phase 3: Gamification
  const [civicPoints,    setCivicPoints]    = useState(0);

  const loadData = async () => {
    try {
      const res = await fetchIssues();
      setIssues(res.issues ?? []);
    } catch (err) {
      console.error('[Dashboard] fetchIssues failed:', err);
    } finally {
      setLoadingMap(false);
    }

    try {
      const res = await fetchIssuesSummary();
      setSummary(res.summary ?? null);
    } catch (err) {
      console.error('[Dashboard] fetchIssuesSummary failed:', err);
    } finally {
      setLoadingSummary(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 60_000);
    return () => clearInterval(timer);
  }, []);

  const metrics = [
    { icon: '📊', label: 'Total Reports',  value: summary?.total_reports,   accent: 'teal',    description: 'All civic issues logged in the system'         },
    { icon: '🚨', label: 'Severe Issues',  value: summary?.severe_issues,   accent: 'red',     description: 'High-severity issues requiring urgent action'  },
    { icon: '✅', label: 'Resolved',       value: summary?.resolved_issues, accent: 'emerald', description: 'Successfully resolved by municipal teams'       },
  ];

  return (
    <div className="flex flex-col h-full gap-5">

      {/* ── Section header + Civic Points ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full" />
            <h2 className="text-lg font-bold text-slate-100">Live Geo-Intelligence Dashboard</h2>
          </div>
          <p className="text-sm text-slate-500 ml-3">
            Real-time civic issue monitoring across your municipality.
          </p>
        </div>

        {/* Right cluster: Civic Points + Refresh */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastRefresh && (
            <span className="text-xs text-slate-600 hidden lg:block">
              Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            id="dashboard-refresh-btn"
            onClick={() => { setLoadingMap(true); setLoadingSummary(true); loadData(); }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg
                       bg-slate-800/80 text-slate-400 border border-slate-700/50
                       hover:bg-slate-700/80 hover:text-teal-400 hover:border-teal-500/30
                       active:scale-95 transition-all duration-150 btn-press"
          >
            ↻ Refresh
          </button>

          {/* 🏆 Civic Points Badge */}
          <CivicPointsBadge points={civicPoints} />
        </div>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-shrink-0">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} loading={loadingSummary} />
        ))}
      </div>

      {/* ── Map + Feed Split ──────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0" style={{ minHeight: '520px' }}>

        {/* Left: Map (60%) */}
        <div className="lg:w-[60%] flex flex-col min-h-[420px] lg:min-h-0">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full" />
              <span className="text-sm font-semibold text-slate-300">Issue Heatmap</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />High</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Medium</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Low</span>
            </div>
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden border border-slate-700/30 shadow-xl shadow-black/30 relative">
            {loadingMap && (
              <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 rounded-2xl">
                <div className="text-center animate-pulse">
                  <div className="text-4xl">🌐</div>
                  <p className="mt-2 text-slate-400 text-sm">Fetching issue data…</p>
                </div>
              </div>
            )}
            <IssueMap issues={issues} />
          </div>
        </div>

        {/* Right: Feed (40%) */}
        <div className="lg:w-[40%] flex flex-col min-h-[360px] lg:min-h-0">
          <div className="flex-1 glass rounded-2xl border border-slate-700/30 shadow-xl shadow-black/20 overflow-hidden">
            <IssueFeed
              issues={issues}
              loading={loadingMap}
              civicPoints={civicPoints}
              setCivicPoints={setCivicPoints}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
