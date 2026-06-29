/**
 * CivicLens AI – Severity Badge Component
 * Renders a color-coded pill badge for civic issue severity levels.
 */

import React from 'react';

const SEVERITY_CONFIG = {
  High: {
    label: 'HIGH',
    className: 'badge-high',
    icon: '🔴',
    pulse: 'bg-red-500',
  },
  Medium: {
    label: 'MEDIUM',
    className: 'badge-medium',
    icon: '🟡',
    pulse: 'bg-amber-500',
  },
  Low: {
    label: 'LOW',
    className: 'badge-low',
    icon: '🟢',
    pulse: 'bg-green-500',
  },
};

/**
 * @param {{ severity: 'High' | 'Medium' | 'Low', size?: 'sm' | 'md' | 'lg' }} props
 */
export function SeverityBadge({ severity, size = 'md' }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Low;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wider ${config.className} ${sizeClasses}`}
      role="status"
      aria-label={`Severity: ${severity}`}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulse} opacity-75`}
        />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.pulse}`} />
      </span>
      {config.label}
    </span>
  );
}
