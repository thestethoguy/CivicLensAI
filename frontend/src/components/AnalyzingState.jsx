/**
 * CivicLens AI – AI Analysis Loading State
 * A polished, humanized loading panel shown while Gemini processes the image.
 */

import React, { useState, useEffect } from 'react';

const ANALYSIS_STAGES = [
  { icon: '📡', text: 'Transmitting visual evidence to AI core…', duration: 2500 },
  { icon: '🔬', text: 'Running structural integrity assessment…', duration: 3000 },
  { icon: '🏛️', text: 'Cross-referencing civic engineering database…', duration: 2800 },
  { icon: '⚠️', text: 'Calculating severity & risk vectors…', duration: 2500 },
  { icon: '📋', text: 'Drafting municipal communication protocol…', duration: 3200 },
  { icon: '✅', text: 'Finalizing structured report payload…', duration: 2000 },
];

export function AnalyzingState() {
  const [currentStage, setCurrentStage] = useState(0);
  const [dots, setDots] = useState('');

  // Rotate through analysis stages
  useEffect(() => {
    let elapsed = 0;
    const timers = ANALYSIS_STAGES.map((stage, index) => {
      const timer = setTimeout(() => {
        setCurrentStage(index);
      }, elapsed);
      elapsed += stage.duration;
      return timer;
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Animate ellipsis dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const stage = ANALYSIS_STAGES[currentStage];
  const progress = ((currentStage + 1) / ANALYSIS_STAGES.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 animate-fade-in">
      {/* Central AI Orb */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-teal-900/60 to-teal-700/30 flex items-center justify-center scan-container glow-teal-strong">
          {/* Rotating ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-teal-400 border-r-teal-400/50 animate-spin" />
          {/* Inner ring counter-rotate */}
          <div
            className="absolute inset-3 rounded-full border border-teal-500/40 border-b-teal-300/70"
            style={{ animation: 'spin 1.5s linear infinite reverse' }}
          />
          {/* Icon */}
          <span className="text-4xl z-10 relative" role="img" aria-label="analyzing">
            {stage.icon}
          </span>
        </div>

        {/* Orbiting dots */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-teal-400 animate-pulse-dot"
            style={{
              top: '50%',
              left: '50%',
              marginTop: '-4px',
              marginLeft: '-4px',
              transform: `rotate(${i * 120}deg) translateX(52px)`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Headline */}
      <h3 className="text-xl font-bold text-teal-300 text-glow-teal mb-1 tracking-tight">
        AI Analyzing Visual Evidence{dots}
      </h3>
      <p className="text-slate-400 text-sm mb-6">Gemini 1.5 Flash — Civil Engineering Auditor Mode</p>

      {/* Current stage indicator */}
      <div className="glass rounded-xl px-5 py-3 mb-6 text-center max-w-xs">
        <p className="text-slate-300 text-sm font-medium">{stage.text}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Stage {currentStage + 1} of {ANALYSIS_STAGES.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage dots */}
      <div className="flex gap-2 mt-4">
        {ANALYSIS_STAGES.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i <= currentStage ? 'bg-teal-400' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
