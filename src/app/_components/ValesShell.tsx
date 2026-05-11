'use client';
import { useEffect, useState } from 'react';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

interface Balance {
  party_id: string;
  name: string;
  is_active: boolean;
  balance_php: number;
  entry_count: number;
  investor_id?: string | null;
  investor_name?: string | null;
}

interface AvailableInvestor {
  id: string;
  name: string;
}

interface Entry {
  id: string;
  party_id: string;
  party_name: string;
  amount_php: number;
  note: string | null;
  entry_date: string;
  created_by: string;
  created_at: string;
}

export default function ValesShell({ initial, role }: { initial: Balance[]; role: string }) {
  const [balances, setBalances] = useState<Balance[]>(initial);
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newInvestorId, setNewInvestorId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableInvestors, setAvailableInvestors] = useState<AvailableInvestor[]>([]);
  const [linkingPartyId, setLinkingPartyId] = useState<string | null>(null);

  async function reload() {
    const r = await fetch('/api/admin/vales/balances', { cache: 'no-store' });
    if (r.ok) setBalances(await r.json());
  }

  useEffect(() => {
    fetch('/api/admin/vales/available-investors', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) && setAvailableInvestors(d))
      .catch(() => {});
  }, []);

  async function setInvestorLink(party_id: string, investor_id: string | null) {
    await fetch(`/api/admin/vales/parties/${party_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investor_id: investor_id ?? '' }),
    });
    setLinkingPartyId(null);
    await reload();
  }

  async function addParty() {
    const name = newName.trim();
    if (!name) { setError('Name is required.'); return; }
    setSaving(true); setError(null);
    const r = await fetch('/api/admin/vales/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        note: newNote.trim() || undefined,
        investor_id: newInvestorId || undefined,
      }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.detail ?? 'Failed to add party.'); }
    else { setNewName(''); setNewNote(''); setNewInvestorId(''); await reload(); }
    setSaving(false);
  }

  async function toggleActive(p: Balance) {
    await fetch(`/api/admin/vales/parties/${p.party_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    await reload();
  }

  async function loadEntries(party_id: string) {
    if (entries[party_id]) return;
    const r = await fetch(`/api/admin/vales/parties/${party_id}/entries`, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      setEntries(prev => ({ ...prev, [party_id]: data }));
    }
  }

  useEffect(() => {
    if (openParty) loadEntries(openParty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParty]);

  const totalOwed = balances.reduce((s, b) => s + (b.balance_php > 0 ? b.balance_php : 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: 4 }}>
            INVESTOR / IOU LEDGER
          </div>
          <div style={{ ...Y, fontSize: 28, fontWeight: 800, color: 'var(--text-strong)' }}>
            Vale Parties
          </div>
          <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Running balance per party. <b>+</b> = drawer received cash (we owe). <b>−</b> = we returned more than received.
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 18, marginBottom: 18,
        }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 6 }}>
            TOTAL OUTSTANDING
          </div>
          <div style={{ ...Y, fontSize: 26, fontWeight: 800, color: 'var(--teal-300)' }}>
            {php(totalOwed)}
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, marginBottom: 18,
        }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
            ADD PARTY
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="party name (e.g. Ike)"
              style={{
                flex: '2 1 200px', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="note (optional)"
              style={{
                flex: '3 1 200px', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={addParty}
              disabled={saving || !newName.trim()}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: saving || !newName.trim() ? 'var(--border-subtle)' : 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
                color: saving || !newName.trim() ? 'var(--text-muted)' : '#000',
                ...Y, fontSize: 12, fontWeight: 800, cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              {saving ? 'SAVING…' : 'ADD'}
            </button>
          </div>
          {availableInvestors.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
                LINK TO INVESTOR (optional)
              </label>
              <select
                value={newInvestorId}
                onChange={e => setNewInvestorId(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', color: 'var(--text-strong)',
                  ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              >
                <option value="">— not an investor —</option>
                {availableInvestors.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginTop: 8 }}>✗ {error}</div>
          )}
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 0, overflow: 'hidden',
        }}>
          {balances.length === 0 && (
            <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
              No vale parties yet. Add one above.
            </div>
          )}
          {balances.map((b, idx) => {
            const isOpen = openParty === b.party_id;
            return (
              <div key={b.party_id} style={{ borderBottom: idx === balances.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <div
                  onClick={() => setOpenParty(isOpen ? null : b.party_id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 18px', cursor: 'pointer',
                    background: isOpen ? 'rgba(61,199,173,0.04)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ ...M, fontSize: 10, color: 'var(--text-faint)' }}>{isOpen ? '▾' : '▸'}</span>
                    <span style={{ ...Y, fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{b.name}</span>
                    {b.investor_name && (
                      <span style={{
                        ...M, fontSize: 9, color: 'var(--accent-gold)', letterSpacing: '0.1em',
                        padding: '2px 6px', border: '1px solid rgba(212,166,74,0.4)',
                        background: 'rgba(212,166,74,0.06)', borderRadius: 4,
                      }}>★ INVESTOR · {b.investor_name}</span>
                    )}
                    {!b.is_active && (
                      <span style={{ ...M, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.1em', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }}>INACTIVE</span>
                    )}
                    <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                      {b.entry_count} {b.entry_count === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <span style={{
                    ...Y, fontSize: 16, fontWeight: 800,
                    color: b.balance_php > 0 ? 'var(--teal-300)' : b.balance_php < 0 ? 'var(--accent-coral)' : 'var(--text-muted)',
                  }}>
                    {b.balance_php > 0 ? '+' : ''}{php(b.balance_php)}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 18px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>ENTRIES</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {(role === 'admin' || role === 'supervisor') && availableInvestors.length > 0 && (
                          linkingPartyId === b.party_id ? (
                            <select
                              autoFocus
                              defaultValue={b.investor_id ?? ''}
                              onChange={(e) => setInvestorLink(b.party_id, e.target.value || null)}
                              onBlur={() => setLinkingPartyId(null)}
                              style={{
                                background: 'var(--bg)', border: '1px solid var(--accent-gold)',
                                borderRadius: 6, padding: '4px 8px', color: 'var(--text-strong)',
                                ...M, fontSize: 11, outline: 'none',
                              }}
                            >
                              <option value="">— not an investor —</option>
                              {availableInvestors.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setLinkingPartyId(b.party_id); }}
                              style={{
                                ...M, fontSize: 10, padding: '4px 10px', borderRadius: 6,
                                border: '1px solid rgba(212,166,74,0.4)', background: 'transparent',
                                color: 'var(--accent-gold)', cursor: 'pointer', letterSpacing: '0.08em',
                              }}
                            >
                              {b.investor_id ? '★ RELINK' : '🔗 LINK INVESTOR'}
                            </button>
                          )
                        )}
                        {(role === 'admin' || role === 'supervisor') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleActive(b); }}
                            style={{
                              ...M, fontSize: 10, padding: '4px 10px', borderRadius: 6,
                              border: '1px solid var(--border)', background: 'transparent',
                              color: 'var(--text-muted)', cursor: 'pointer', letterSpacing: '0.08em',
                            }}
                          >
                            {b.is_active ? 'DEACTIVATE' : 'REACTIVATE'}
                          </button>
                        )}
                      </div>
                    </div>
                    {(entries[b.party_id] ?? []).length === 0 && (
                      <div style={{ ...M, fontSize: 11, color: 'var(--text-faint)', padding: 6 }}>No entries yet.</div>
                    )}
                    {(entries[b.party_id] ?? []).map(e => (
                      <div key={e.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '7px 0', borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ ...M, fontSize: 11, color: 'var(--text-strong)' }}>
                            {fmtDate(e.entry_date)}
                            <span style={{ color: 'var(--text-faint)', marginLeft: 8 }}>· {e.created_by}</span>
                          </span>
                          {e.note && <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>{e.note}</span>}
                        </div>
                        <span style={{
                          ...Y, fontSize: 13, fontWeight: 700,
                          color: e.amount_php > 0 ? 'var(--teal-300)' : 'var(--accent-coral)',
                        }}>
                          {e.amount_php > 0 ? '+' : ''}{php(e.amount_php)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
