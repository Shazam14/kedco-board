'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

interface Bank { id: number; name: string; code: string; is_active: boolean; sort_order: number; }

export default function ManageBanksShell({ banks: initial }: { banks: Bank[] }) {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>(initial);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addBank() {
    if (!newName.trim() || !newCode.trim()) return;
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), code: newCode.trim().toUpperCase() }),
    });
    const data = await res.json();
    if (res.ok) {
      setBanks(prev => [...prev, data]);
      setNewName(''); setNewCode('');
    } else {
      setError(data.detail ?? data.error ?? 'Failed to add bank');
    }
    setSaving(false);
  }

  async function toggleActive(bank: Bank) {
    const res = await fetch('/api/admin/banks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bank.id, is_active: !bank.is_active }),
    });
    if (res.ok) {
      setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, is_active: !b.is_active } : b));
    }
  }

  const active   = banks.filter(b => b.is_active);
  const inactive = banks.filter(b => !b.is_active);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Manage Banks</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 700 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · BANKS</div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, marginBottom: 24 }}>Manage Banks & E-wallets</div>

        {/* Add new */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 14, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.12em', marginBottom: 14 }}>ADD NEW BANK / E-WALLET</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>FULL NAME</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Bank of Commerce"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>CODE</div>
              <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="e.g. BOC" maxLength={20}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ paddingTop: 17 }}>
              <button onClick={addBank} disabled={saving || !newName.trim() || !newCode.trim()}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: (!newName.trim() || !newCode.trim()) ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: (!newName.trim() || !newCode.trim()) ? 'var(--muted)' : '#000', ...Y, fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {saving ? '…' : '+ ADD'}
              </button>
            </div>
          </div>
          {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 10 }}>{error}</div>}
        </div>

        {/* Active list */}
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>ACTIVE ({active.length})</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
          {active.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < active.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...M, fontSize: 11, color: '#f5a623', fontWeight: 700, minWidth: 80 }}>{b.code}</span>
                <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>{b.name}</span>
              </div>
              <button onClick={() => toggleActive(b)}
                style={{ ...M, fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,92,92,0.3)', background: 'transparent', color: '#ff5c5c', cursor: 'pointer' }}>
                Deactivate
              </button>
            </div>
          ))}
          {active.length === 0 && <div style={{ ...M, fontSize: 11, color: 'var(--muted)', padding: '16px 20px' }}>No active banks.</div>}
        </div>

        {/* Inactive list */}
        {inactive.length > 0 && (
          <>
            <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>INACTIVE ({inactive.length})</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {inactive.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < inactive.length - 1 ? '1px solid var(--border)' : 'none', opacity: 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--muted)', minWidth: 80 }}>{b.code}</span>
                    <span style={{ ...M, fontSize: 12, color: 'var(--muted)' }}>{b.name}</span>
                  </div>
                  <button onClick={() => toggleActive(b)}
                    style={{ ...M, fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: '#00d4aa', cursor: 'pointer' }}>
                    Activate
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
