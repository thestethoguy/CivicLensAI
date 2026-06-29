/**
 * CivicLens AI – Root Application Component  (Phase 2 update)
 *
 * Navigation: state-based tab switcher between
 *   - "report"    → Phase 1: Issue Intake Form
 *   - "dashboard" → Phase 2: Live Geo-Mapping Dashboard
 */

import React, { useState, useEffect } from 'react';
import { IntakeForm } from './components/IntakeForm';
import Dashboard from './components/Dashboard';
import { listIssues } from './api/client';
import './index.css';

// ── Navigation config ──────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: 'dashboard', label: 'Live Dashboard', icon: '🗺️',  shortLabel: 'Dashboard' },
  { id: 'report',    label: 'Report Issue',   icon: '📸',  shortLabel: 'Report'    },
];

// ── Header ─────────────────────────────────────────────────────────────────────

function Header({ activeTab, onTabChange }) {
  return (
    <header className="relative z-20 px-4 sm:px-6 py-4 border-b border-slate-800/60 flex-shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

        {/* Logo & Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center glow-teal">
            <span className="text-xl" role="img" aria-label="CivicLens logo">🔭</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-white tracking-tight leading-none">
              CivicLens<span className="text-teal-400">AI</span>
            </h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">
              Autonomous Hyperlocal Issue Resolution
            </p>
          </div>
        </div>

        {/* Tab Nav */}
        <nav
          className="flex items-center bg-slate-900/80 border border-slate-700/50 rounded-xl p-1 gap-1"
          role="tablist"
          aria-label="Main navigation"
        >
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                transition-all duration-200 btn-press
                ${activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}
              `}
            >
              <span role="img" aria-hidden="true">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>

        {/* Status indicators */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <StatusPill label="Gemini Flash" active />
          <StatusPill label="MongoDB" active />
          <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-teal-400">v2.0</span>
        </div>
      </div>
    </header>
  );
}

function StatusPill({ label, active }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/40">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'}`} />
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </div>
  );
}

// ── Stats Bar (Phase 1 view only) ──────────────────────────────────────────────

function StatsBar({ stats }) {
  const items = [
    { icon: '📊', label: 'Total Reports',   value: stats.total    },
    { icon: '🔴', label: 'High Severity',   value: stats.high     },
    { icon: '🟡', label: 'Medium Severity', value: stats.medium   },
    { icon: '✅', label: 'Resolved',        value: stats.resolved },
  ];
  return (
    <div className="px-4 sm:px-6 py-3 border-b border-slate-800/40 flex-shrink-0">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label} className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 card-hover">
            <span className="text-lg" role="img" aria-label={item.label}>{item.icon}</span>
            <div>
              <p className="text-xs text-slate-500 leading-none">{item.label}</p>
              <p className="text-lg font-bold text-slate-100 leading-tight">
                {stats.loading
                  ? <span className="inline-block w-8 h-4 bg-slate-700 rounded animate-pulse" />
                  : (item.value ?? '—')
                }
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="px-6 py-4 border-t border-slate-800/40 flex-shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
        <span>© 2026 CivicLens AI — Vibe2Ship Hackathon</span>
        <span className="font-mono">FastAPI + MongoDB · Google Gemini 1.5 Flash · Google Maps</span>
      </div>
    </footer>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  // Default to the new dashboard view
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ loading: true, total: 0, high: 0, medium: 0, resolved: 0 });

  // Fetch quick stats for the Phase 1 StatsBar (only needed on "report" tab)
  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await listIssues();
        const issues = data.issues || [];
        setStats({
          loading: false,
          total:    issues.length,
          high:     issues.filter((i) => i.severity_level === 'High').length,
          medium:   issues.filter((i) => i.severity_level === 'Medium').length,
          resolved: issues.filter((i) => i.status === 'Resolved').length,
        });
      } catch {
        setStats({ loading: false, total: 0, high: 0, medium: 0, resolved: 0 });
      }
    }
    if (activeTab === 'report') fetchStats();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-950 grid-bg flex flex-col">
      {/* Ambient background orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-0 w-48 h-48 bg-blue-500/4 rounded-full blur-3xl pointer-events-none" />

      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Conditionally show the StatsBar only on the Report tab */}
      {activeTab === 'report' && <StatsBar stats={stats} />}

      {/* ── Main content area ───────────────────────────────────────────────── */}
      <main className="flex-1 px-4 sm:px-6 py-6 min-h-0">
        <div className="max-w-7xl mx-auto h-full">

          {/* Phase 2: Live Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="h-full animate-fade-in">
              <Dashboard />
            </div>
          )}

          {/* Phase 1: Report an Issue */}
          {activeTab === 'report' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-5 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full" />
                  <h2 className="text-lg font-bold text-slate-100">Report a Civic Issue</h2>
                </div>
                <p className="text-sm text-slate-500 ml-3">
                  Upload a photo — our AI auditor will classify, assess severity, and draft a formal municipal report.
                </p>
              </div>
              <div className="glass rounded-2xl p-5">
                <IntakeForm />
              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
