'use client';

/**
 * IDScanner — camera-based QR/barcode reader for AMLA ID capture.
 * Supports: PhilSys QR, Philippine driver's licence PDF417, passport MRZ text.
 * Uses @zxing/browser (dynamically imported — no SSR).
 *
 * Usage:
 *   <IDScanner onScan={({ name, idNumber }) => { ... }} onClose={() => { ... }} />
 */

import { useEffect, useRef, useState } from 'react';
import { parseIdScan, type ParsedID } from '@/lib/parseId';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };

export type ScannedID = ParsedID;

interface Props {
  onScan:  (result: ScannedID) => void;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function IDScanner({ onScan, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const [status,   setStatus]   = useState<'loading' | 'scanning' | 'error'>('loading');
  const [errMsg,   setErrMsg]   = useState('');
  const [preview,  setPreview]  = useState<ScannedID | null>(null);

  useEffect(() => {
    let live = true;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (!live || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        setStatus('scanning');

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result, err) => {
            if (!live || !result) return;
            const parsed = parseIdScan(result.getText());
            setPreview(parsed);
          }
        );

        if (live) controlsRef.current = controls;
      } catch (e: unknown) {
        if (live) {
          const msg = e instanceof Error ? e.message : 'Camera unavailable';
          setErrMsg(
            msg.toLowerCase().includes('permission')
              ? 'Camera permission denied. Allow camera access and try again.'
              : msg
          );
          setStatus('error');
        }
      }
    }

    start();

    return () => {
      live = false;
      controlsRef.current?.stop();
    };
  }, []);

  function confirm() {
    if (!preview) return;
    onScan(preview);
  }

  function retry() {
    setPreview(null);
  }

  return (
    /* Backdrop */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ ...M, fontSize: 11, color: '#00d4aa', letterSpacing: '0.12em' }}>
              ID SCANNER
            </div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
              PhilSys · Driver&apos;s Licence · Passport
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--muted)', borderRadius: 6,
              padding: '4px 10px', cursor: 'pointer', ...M, fontSize: 11,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Camera view */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            playsInline
            muted
          />

          {/* Scanning frame overlay */}
          {status === 'scanning' && !preview && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 220, height: 220, position: 'relative',
              }}>
                {/* Corner brackets */}
                {[
                  { top: 0,    left: 0,    borderTop: '3px solid #00d4aa', borderLeft:  '3px solid #00d4aa', borderRadius: '8px 0 0 0' },
                  { top: 0,    right: 0,   borderTop: '3px solid #00d4aa', borderRight: '3px solid #00d4aa', borderRadius: '0 8px 0 0' },
                  { bottom: 0, left: 0,    borderBottom: '3px solid #00d4aa', borderLeft:  '3px solid #00d4aa', borderRadius: '0 0 0 8px' },
                  { bottom: 0, right: 0,   borderBottom: '3px solid #00d4aa', borderRight: '3px solid #00d4aa', borderRadius: '0 0 8px 0' },
                ].map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s as React.CSSProperties }} />
                ))}
                {/* Scan line animation */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '50%',
                  height: 2, background: 'rgba(0,212,170,0.7)',
                  animation: 'scanline 1.8s ease-in-out infinite',
                }} />
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {status === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ ...M, fontSize: 11, color: '#00d4aa' }}>Starting camera…</div>
            </div>
          )}

          {/* Error overlay */}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
            }}>
              <div style={{ fontSize: 28 }}>📷</div>
              <div style={{ ...M, fontSize: 11, color: '#ff5c5c', textAlign: 'center' }}>{errMsg}</div>
            </div>
          )}

          {/* Scan result preview */}
          {preview && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
            }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>NAME DETECTED</div>
                <div style={{ ...M, fontSize: 15, color: '#e2e6f0', fontWeight: 600 }}>{preview.name}</div>
                {preview.idNumber && (
                  <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    ID: {preview.idNumber}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={retry}
                  style={{
                    padding: '8px 18px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--muted)', ...M, fontSize: 11, cursor: 'pointer',
                  }}
                >
                  ↺ Rescan
                </button>
                <button
                  onClick={confirm}
                  style={{
                    padding: '8px 24px', borderRadius: 8,
                    border: 'none', background: '#00d4aa',
                    color: '#000', ...M, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Use This
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {status === 'scanning' && !preview && (
          <div style={{
            padding: '12px 18px', textAlign: 'center',
            ...M, fontSize: 10, color: 'var(--muted)',
          }}>
            Point camera at the QR code or barcode on the ID
          </div>
        )}
      </div>

      {/* Scan line CSS animation */}
      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(-80px); opacity: 0.4; }
          50%  { opacity: 1; }
          100% { transform: translateY(80px);  opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
