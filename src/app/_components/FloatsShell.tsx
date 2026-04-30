'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNumberInput } from '@/hooks/useNumberInput';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const Y: React.CSSProperties = { fontFamily: 'var(--font-sans)' };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CashierFloat {
  cashier_username: string;
  cashier_name: string;
  float_amount: number | null;
  float_id: string | null;
}

function FloatRow({ cashier, onSave }: {
  cashier: CashierFloat;
  onSave: (username: string, amount: number) => Promise<void>;
}) {
  const amtInput = useNumberInput(cashier.float_amount?.toString() ?? '', 2);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const amt = parseFloat(amtInput.raw);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(true);
    await onSave(cashier.cashier_username, amt);
    setSaving(false);
  }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ ...Y, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{cashier.cashier_name}</div>
        <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{cashier.cashier_username}</div>
      </div>
      {cashier.float_amount !== null && (
        <div style={{ ...M, fontSize: 12, color: 'var(--teal-300)', minWidth: 80, textAlign: 'right' }}>
          {php(cashier.float_amount)}
        </div>
      )}
      <input
        type="text" inputMode="decimal" placeholder="Opening float"
        ref={amtInput.ref} value={amtInput.value}
        onChange={amtInput.onChange} onFocus={amtInput.onFocus}
        style={{ width: 140, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }}
      />
      <button onClick={handleSave} disabled={saving}
        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--teal-600)', color: '#fff', ...M, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {saving ? '…' : cashier.float_amount !== null ? 'Update' : 'Set Float'}
      </button>
    </div>
  );
}

export default function FloatsShell({
  cashierFloats: initialFloats, username,
}: {
  cashierFloats: CashierFloat[];
  username: string;
}) {
  const router = useRouter();
  useIdleTimeout(20);

  const [cashierFloats, setCashierFloats] = useState<CashierFloat[]>(initialFloats);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleSetFloat(cashierUsername: string, amount: number) {
    const res = await fetch('/api/treasurer/float', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashier_username: cashierUsername, amount_php: amount }),
    });
    if (res.ok) {
      const data = await res.json();
      setCashierFloats(prev => prev.map(c =>
        c.cashier_username === cashierUsername
          ? { ...c, float_amount: data.amount_php, float_id: data.id }
          : c
      ));
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: '60px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--text-on-teal)', fontFamily: 'var(--font-display)',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
              Kedco <span style={{ color: 'var(--teal-300)' }}>FX</span>
            </div>
            <div style={{ ...M, fontSize: 9, color: 'var(--text-faint)', marginTop: -1 }}>
              Treasurer · Cashier Floats
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-strong)' }}>{username}</span>
          </div>
          <a href="/supervisor" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            ← HUB
          </a>
          <button onClick={handleLogout} style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
          }}>
            LOGOUT
          </button>
        </div>
      </nav>

      <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>
            SET OPENING FLOAT PER CASHIER — cashiers will see this pre-filled when they open their shift
          </div>
          {cashierFloats.length === 0 && (
            <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
              No cashier accounts found.
            </div>
          )}
          {cashierFloats.map(c => (
            <FloatRow key={c.cashier_username} cashier={c} onSave={handleSetFloat} />
          ))}
        </div>
      </div>
    </div>
  );
}
