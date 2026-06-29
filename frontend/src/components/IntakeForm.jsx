/**
 * CivicLens AI – IntakeForm Component
 * Drag-and-drop image upload panel with geolocation capture and AI submission.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeIssue } from '../api/client';
import { useGeolocation } from '../hooks/useGeolocation';
import { AnalyzingState } from './AnalyzingState';
import { ResultCard } from './ResultCard';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_MB = 10;

/** Formats bytes to human-readable size string */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IntakeForm() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileError, setFileError] = useState(null);

  const [status, setStatus] = useState('idle'); // idle | analyzing | success | error
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);
  const { coords, locationError, locationStatus, requestLocation } = useGeolocation();

  // Silently request location as soon as the component mounts
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // ── File validation ──────────────────────────────────────────────────────────
  const validateAndSetFile = useCallback((file) => {
    setFileError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(`Unsupported file type "${file.type}". Please upload a JPEG, PNG, or WebP image.`);
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setFileError(`File too large (${sizeMB.toFixed(1)} MB). Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setStatus('idle');

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }, []);

  // ── Drag and drop handlers ───────────────────────────────────────────────────
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) validateAndSetFile(file);
  }, [validateAndSetFile]);

  const onFileInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [validateAndSetFile]);

  // ── Submission handler ───────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    const latitude = coords?.latitude ?? 28.6139;
    const longitude = coords?.longitude ?? 77.2090;

    setStatus('analyzing');
    setErrorMessage('');

    try {
      const data = await analyzeIssue(selectedFile, latitude, longitude);
      setResult(data);
      setStatus('success');
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setResult(null);
    setFileError(null);
    setStatus('idle');
    setErrorMessage('');
    requestLocation();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full h-full">
      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT PANEL – Image Upload
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Drop zone */}
        <div
          id="image-dropzone"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Image upload drop zone"
          onKeyDown={(e) => e.key === 'Enter' && !selectedFile && fileInputRef.current?.click()}
          className={`relative flex-1 min-h-[280px] rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
            ${dragOver
              ? 'dropzone-active'
              : selectedFile
              ? 'border-teal-600/50 bg-slate-900/60 cursor-default'
              : 'border-slate-700/60 bg-slate-900/40 hover:border-teal-600/60 hover:bg-slate-900/60'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={onFileInputChange}
            className="hidden"
            aria-label="Upload civic issue image"
          />

          {selectedFile && imagePreview ? (
            /* ── Image Preview ── */
            <div className="relative w-full h-full min-h-[280px]">
              <img
                src={imagePreview}
                alt="Selected civic issue"
                className="w-full h-full object-cover"
              />
              {/* Overlay with file info */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-950/90 to-transparent">
                <p className="text-xs font-semibold text-slate-200 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</p>
              </div>
              {/* Remove button */}
              <button
                id="remove-image-btn"
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-red-400 hover:border-red-500/50 transition-all btn-press"
                aria-label="Remove selected image"
              >
                ✕
              </button>
            </div>
          ) : (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full min-h-[280px] p-8 text-center">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                dragOver
                  ? 'bg-teal-500/20 scale-110'
                  : 'bg-slate-800/60'
              }`}>
                <svg className={`w-10 h-10 transition-colors duration-300 ${dragOver ? 'text-teal-400' : 'text-slate-500'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-slate-300 font-semibold text-base mb-1">
                {dragOver ? 'Release to upload' : 'Drop your image here'}
              </p>
              <p className="text-slate-500 text-sm mb-4">
                or <span className="text-teal-400 font-medium">browse files</span>
              </p>
              <p className="text-xs text-slate-600">JPEG, PNG, WebP · Max {MAX_FILE_SIZE_MB} MB</p>
            </div>
          )}
        </div>

        {/* File error */}
        {fileError && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 animate-fade-in">
            <span className="text-red-400 text-base flex-shrink-0">⚠</span>
            <p className="text-red-300 text-sm">{fileError}</p>
          </div>
        )}

        {/* Location status pill */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              locationStatus === 'granted'
                ? 'bg-teal-400 animate-pulse'
                : locationStatus === 'requesting'
                ? 'bg-amber-400 animate-pulse'
                : locationStatus === 'denied'
                ? 'bg-amber-500'
                : 'bg-slate-600'
            }`}
          />
          {locationStatus === 'granted' && coords && (
            <span className="text-teal-400">
              GPS: {coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}°
            </span>
          )}
          {locationStatus === 'requesting' && (
            <span className="text-amber-400">Acquiring GPS coordinates…</span>
          )}
          {locationStatus === 'denied' && (
            <span className="text-amber-500">{locationError}</span>
          )}
          {locationStatus === 'idle' && (
            <span className="text-slate-500">Waiting for location…</span>
          )}
        </div>

        {/* Analyze CTA */}
        <button
          id="analyze-btn"
          onClick={handleAnalyze}
          disabled={!selectedFile || status === 'analyzing'}
          aria-label="Analyze civic issue with AI"
          className={`w-full py-4 rounded-xl font-bold text-base tracking-wide transition-all duration-300 btn-press relative overflow-hidden
            ${selectedFile && status !== 'analyzing'
              ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-500 hover:to-teal-400 glow-teal cursor-pointer'
              : 'bg-slate-800/60 text-slate-600 cursor-not-allowed border border-slate-700/40'
            }`}
        >
          {status === 'analyzing' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-teal-300/50 border-t-teal-300 rounded-full animate-spin" />
              Processing…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🔍</span>
              Analyze with AI
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT PANEL – Analysis Results / States
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 glass rounded-2xl p-5 min-h-[400px] min-w-0">
        {status === 'idle' && (
          <EmptyResultState />
        )}

        {status === 'analyzing' && (
          <AnalyzingState />
        )}

        {status === 'success' && result && (
          <ResultCard result={result} imagePreview={imagePreview} />
        )}

        {status === 'error' && (
          <ErrorResultState message={errorMessage} onRetry={handleAnalyze} />
        )}
      </div>
    </div>
  );
}

// ── Sub-states ─────────────────────────────────────────────────────────────────

function EmptyResultState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-5">
        <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1 1 .03 2.798-1.345 2.798H4.744c-1.376 0-2.345-1.798-1.345-2.798L5 14.5" />
        </svg>
      </div>
      <h3 className="text-slate-400 font-semibold text-base mb-2">
        AI Analysis Panel
      </h3>
      <p className="text-slate-600 text-sm max-w-xs leading-relaxed">
        Upload a photo of a civic issue on the left. Our Gemini-powered AI auditor will classify the problem, assess severity, and generate a municipal report automatically.
      </p>
      <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
        {['Category & Classification', 'Severity Assessment', 'Technical Description', 'Municipal Email Draft'].map((item) => (
          <div key={item} className="flex items-center gap-3 text-left px-3 py-2 rounded-lg bg-slate-800/30">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />
            <span className="text-xs text-slate-500">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorResultState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center p-8 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
        <span className="text-4xl" role="img" aria-label="error">❌</span>
      </div>
      <h3 className="text-red-300 font-semibold text-lg mb-2">Analysis Failed</h3>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed mb-6">{message}</p>
      <button
        id="retry-btn"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 font-semibold text-sm hover:bg-red-500/25 transition-all btn-press"
      >
        Retry Analysis
      </button>
    </div>
  );
}
