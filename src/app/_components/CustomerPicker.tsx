'use client';

import { useEffect, useRef, useState } from 'react';

const M = { fontFamily: '"Inter Tight", "SF Mono", monospace' };

export interface CustomerSuggestion {
  id: string;
  name: string;
  phone?: string | null;
}

interface Props {
  /** Free-text customer name (also used as the picker's input value). */
  value: string;
  /** Linked customer id when the user picked from the list, else null. */
  customerId: string | null;
  /** Fired on every change. `id` is null whenever the user types freely. */
  onChange: (name: string, customerId: string | null) => void;
  placeholder?: string;
  /**
   * Surface variant — controls the input chrome so the picker fits visually
   * inside both the cashier (compact) and rider (taller) forms.
   */
  variant?: 'counter' | 'rider';
  disabled?: boolean;
}

export default function CustomerPicker({
  value, customerId, onChange,
  placeholder = 'Name or reference',
  variant = 'rider',
  disabled = false,
}: Props) {
  const [open, setOpen]               = useState(false);
  const [results, setResults]         = useState<CustomerSuggestion[]>([]);
  const [adding, setAdding]           = useState(false);   // POST in flight
  const [addError, setAddError]       = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside closes the dropdown without losing typed value (walk-in path).
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search — fires whenever value changes and we don't already have a picked id.
  useEffect(() => {
    const q = value.trim();
    if (!open) return;
    if (q.length < 1) { setResults([]); return; }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&limit=8`);
        if (!res.ok) return;
        const data: CustomerSuggestion[] = await res.json();
        if (!cancelled) setResults(data);
      } catch {
        /* network blip — leave previous results */
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [value, open]);

  function pick(s: CustomerSuggestion) {
    onChange(s.name, s.id);
    setOpen(false);
  }

  async function addNew() {
    const name = value.trim();
    if (!name || adding) return;
    setAdding(true); setAddError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(typeof data?.detail === 'string' ? data.detail : 'Could not add');
        return;
      }
      onChange(data.name, data.id);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  // Show "+ Add" only when typed text doesn't exactly match an existing result.
  const trimmed = value.trim();
  const exactMatch = results.some(r => r.name.toLowerCase() === trimmed.toLowerCase());
  const showAdd = trimmed.length > 0 && !exactMatch && !customerId;

  const inputStyle = variant === 'counter'
    ? { width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '12px 14px', color: 'var(--text-strong)',
        ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
    : { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 16px', color: 'var(--text-strong)',
        ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} data-testid="customer-picker">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => {
          // Any keystroke severs the FK link — back to free-text/walk-in semantics.
          onChange(e.target.value, null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
      />
      {customerId && (
        <span
          data-testid="customer-picker-linked"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            ...M, fontSize: 9, letterSpacing: '0.1em',
            color: 'var(--teal-300)', background: 'rgba(61,199,173,0.12)',
            padding: '3px 7px', borderRadius: 4, pointerEvents: 'none',
          }}
        >
          ★ LINKED
        </span>
      )}

      {open && (results.length > 0 || showAdd) && (
        <div
          data-testid="customer-picker-dropdown"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, zIndex: 50, maxHeight: 240, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {results.map(s => (
            <button
              key={s.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'transparent',
                border: 'none', borderBottom: '1px solid var(--border)',
                color: 'var(--text-strong)', ...M, fontSize: 13, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              {s.phone && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s.phone}</div>
              )}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              data-testid="customer-picker-add"
              onMouseDown={e => { e.preventDefault(); void addNew(); }}
              disabled={adding}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px',
                background: 'rgba(61,199,173,0.06)', border: 'none',
                color: 'var(--teal-300)', ...M, fontSize: 12,
                cursor: adding ? 'wait' : 'pointer',
              }}
            >
              {adding ? 'Adding…' : <>+ Add &ldquo;{trimmed}&rdquo; as new customer</>}
            </button>
          )}
          {addError && (
            <div style={{ padding: '8px 14px', color: 'var(--accent-rose, salmon)', ...M, fontSize: 11 }}>
              {addError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
