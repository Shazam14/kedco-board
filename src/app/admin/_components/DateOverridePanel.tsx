'use client';

import { useEffect, useState } from 'react';

export default function DateOverridePanel() {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/test-date')
      .then(r => r.json())
      .then(d => {
        setActiveDate(d.test_date ?? null);
        if (d.test_date) setInput(d.test_date);
      })
      .catch(() => {});
  }, []);

  async function handleSet() {
    if (!input) return;
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/admin/test-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: input }),
    });
    const data = await res.json();
    if (res.ok) {
      setActiveDate(input);
      setMsg('Date override active.');
    } else {
      setMsg(data.detail ?? 'Failed to set date.');
    }
    setSaving(false);
  }

  async function handleClear() {
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/admin/test-date', { method: 'DELETE' });
    if (res.ok) {
      setActiveDate(null);
      setInput('');
      setMsg('Cleared — back to real date.');
    }
    setSaving(false);
  }

  const today = new Date().toISOString().split('T')[0];
  const isOverrideActive = activeDate !== null && activeDate !== today;

  return (
    <div style={{
      background: isOverrideActive ? '#2a1a00' : 'var(--surface)',
      border: `1px solid ${isOverrideActive ? '#f5a62366' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {isOverrideActive && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#f5a623,transparent)' }} />
      )}
      <div style={{ fontSize: 22, marginBottom: 12 }}>📅</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: '#e2e6f0', marginBottom: 4 }}>
        Date Override
        {isOverrideActive && (
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#f5a623', marginLeft: 10, letterSpacing: '0.1em' }}>
            ACTIVE
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
        {isOverrideActive
          ? `System is running as ${activeDate}. All entries will be posted on this date.`
          : 'System is using the real date. Set a date below to override.'}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: '#e2e6f0',
            fontFamily: "'DM Mono',monospace",
            fontSize: 12,
            padding: '6px 10px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSet}
          disabled={saving || !input}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            background: '#f5a623',
            color: '#000',
            fontFamily: "'DM Mono',monospace",
            fontSize: 11,
            fontWeight: 700,
            cursor: saving || !input ? 'not-allowed' : 'pointer',
            opacity: saving || !input ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Set Date'}
        </button>
        {isOverrideActive && (
          <button
            onClick={handleClear}
            disabled={saving}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted)',
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Clear / Back to Today
          </button>
        )}
      </div>

      {msg && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#f5a623', marginTop: 10 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
