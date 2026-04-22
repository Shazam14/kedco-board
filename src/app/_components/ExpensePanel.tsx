'use client';
import { useState, useEffect } from 'react';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const CATEGORIES = [
  'OFFICE_SUPPLIES', 'UTILITIES', 'TRANSPORTATION', 'MEALS',
  'MAINTENANCE', 'SALARY_ADVANCE', 'BANK_CHARGES', 'OTHERS',
];

const CATEGORY_LABELS: Record<string, string> = {
  OFFICE_SUPPLIES: 'Office Supplies',
  UTILITIES:       'Utilities',
  TRANSPORTATION:  'Transportation',
  MEALS:           'Meals',
  MAINTENANCE:     'Maintenance',
  SALARY_ADVANCE:  'Salary Advance',
  BANK_CHARGES:    'Bank Charges',
  OTHERS:          'Others',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:  '#f5a623',
  APPROVED: '#00d4aa',
  REJECTED: '#ff5c5c',
};

interface Expense {
  id: string;
  date: string;
  amount_php: number;
  category: string;
  description?: string;
  recorded_by: string;
  status: string;
  approved_by?: string;
}

const php = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpensePanel({ role }: { role: string }) {
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [category, setCategory]   = useState('OFFICE_SUPPLIES');
  const [desc, setDesc]           = useState('');
  const [amount, setAmount]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [editId, setEditId]       = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/counter/expenses');
    if (res.ok) setExpenses(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!amount || +amount <= 0) { setError('Enter a valid amount'); return; }
    if (category === 'OTHERS' && !desc.trim()) { setError('Description required for Others'); return; }
    setSaving(true); setError(null);
    const url  = editId ? `/api/counter/expenses/${editId}` : '/api/counter/expenses';
    const method = editId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_php: +amount, category, description: desc || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.detail ?? 'Failed'); }
    else {
      setExpenses(prev => editId
        ? prev.map(e => e.id === editId ? data : e)
        : [data, ...prev]);
      setShowForm(false); setEditId(null); setAmount(''); setDesc(''); setCategory('OFFICE_SUPPLIES');
    }
    setSaving(false);
  }

  async function approve(id: string) {
    const res = await fetch(`/api/counter/expenses/${id}/approve`, { method: 'POST' });
    if (res.ok) setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: 'APPROVED' } : e));
  }

  async function reject(id: string) {
    const res = await fetch(`/api/counter/expenses/${id}/reject`, { method: 'POST' });
    if (res.ok) setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: 'REJECTED' } : e));
  }

  function startEdit(e: Expense) {
    setEditId(e.id); setCategory(e.category); setDesc(e.description ?? '');
    setAmount(String(e.amount_php)); setShowForm(true); setError(null);
  }

  const totalApproved = expenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + e.amount_php, 0);
  const pendingCount  = expenses.filter(e => e.status === 'PENDING').length;

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em' }}>
            PETTY CASH / EXPENSES
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
            <span style={{ ...Y, fontSize: 18, fontWeight: 800, color: '#ff5c5c' }}>{php(totalApproved)}</span>
            {pendingCount > 0 && (
              <span style={{ ...M, fontSize: 10, color: '#f5a623', alignSelf: 'center' }}>
                {pendingCount} pending approval
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditId(null); setError(null); setAmount(''); setDesc(''); setCategory('OFFICE_SUPPLIES'); }}
          style={{
            ...M, fontSize: 11, padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            border: 'none', background: showForm ? 'var(--surface2)' : 'rgba(255,92,92,0.15)',
            color: showForm ? 'var(--muted)' : '#ff5c5c',
          }}
        >
          {showForm ? 'Cancel' : '+ Expense'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: 12 }}>
            {editId ? 'EDIT EXPENSE' : 'NEW EXPENSE'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none' }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>

            {category === 'OTHERS' && (
              <input
                type="text"
                placeholder="Description (required)"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ background: 'var(--surface)', border: `1px solid ${!desc.trim() ? 'rgba(255,92,92,0.5)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none' }}
              />
            )}

            {category !== 'OTHERS' && (
              <input
                type="text"
                placeholder="Description (optional)"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none' }}
              />
            )}

            <input
              type="number"
              placeholder="Amount (PHP)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: '#e2e6f0', ...M, fontSize: 14, outline: 'none' }}
            />

            {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c' }}>{error}</div>}

            <button
              onClick={submit}
              disabled={saving}
              style={{ ...M, fontSize: 12, fontWeight: 700, padding: '10px', borderRadius: 8, border: 'none', background: saving ? 'var(--surface2)' : 'rgba(255,92,92,0.8)', color: '#fff', cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {expenses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {expenses.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{CATEGORY_LABELS[e.category] ?? e.category}</span>
                  <span style={{
                    ...M, fontSize: 8, padding: '1px 5px', borderRadius: 3,
                    color: STATUS_COLOR[e.status] ?? 'var(--muted)',
                    background: `${STATUS_COLOR[e.status] ?? '#888'}18`,
                    border: `1px solid ${STATUS_COLOR[e.status] ?? '#888'}44`,
                  }}>{e.status}</span>
                </div>
                {e.description && <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{e.description}</div>}
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>by {e.recorded_by}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ ...Y, fontSize: 14, fontWeight: 700, color: '#ff5c5c' }}>{php(e.amount_php)}</span>
                {/* Edit — only on same-day items that aren't rejected */}
                {e.status !== 'REJECTED' && (
                  <button onClick={() => startEdit(e)} style={{ ...M, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>✎</button>
                )}
                {/* Admin approve/reject on pending */}
                {role === 'admin' && e.status === 'PENDING' && (
                  <>
                    <button onClick={() => approve(e.id)} style={{ ...M, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(0,212,170,0.4)', background: 'rgba(0,212,170,0.08)', color: '#00d4aa', cursor: 'pointer' }}>✓</button>
                    <button onClick={() => reject(e.id)} style={{ ...M, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(255,92,92,0.4)', background: 'rgba(255,92,92,0.08)', color: '#ff5c5c', cursor: 'pointer' }}>✕</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {expenses.length === 0 && !showForm && (
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', padding: '12px 0' }}>No expenses recorded today.</div>
      )}
    </div>
  );
}
