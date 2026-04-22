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

interface Expense {
  id: string;
  amount_php: number;
  category: string;
  description?: string;
  recorded_by: string;
}

const php = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpensePanel({ username }: { username: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('OFFICE_SUPPLIES');
  const [desc, setDesc]         = useState('');
  const [amount, setAmount]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [editId, setEditId]     = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/counter/expenses');
    if (res.ok) setExpenses(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!amount || +amount <= 0) { setError('Enter a valid amount'); return; }
    if (category === 'OTHERS' && !desc.trim()) { setError('Description required for Others'); return; }
    setSaving(true); setError(null);
    const url    = editId ? `/api/counter/expenses/${editId}` : '/api/counter/expenses';
    const method = editId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_php: +amount, category, description: desc || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.detail ?? 'Failed'); }
    else {
      setExpenses(prev => editId ? prev.map(e => e.id === editId ? data : e) : [data, ...prev]);
      setShowForm(false); setEditId(null); setAmount(''); setDesc(''); setCategory('OFFICE_SUPPLIES');
    }
    setSaving(false);
  }

  function startEdit(e: Expense) {
    setEditId(e.id); setCategory(e.category); setDesc(e.description ?? '');
    setAmount(String(e.amount_php)); setShowForm(true); setError(null);
  }

  const total = expenses.reduce((s, e) => s + e.amount_php, 0);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em' }}>PETTY CASH / EXPENSES</div>
          <span style={{ ...Y, fontSize: 18, fontWeight: 800, color: '#ff5c5c' }}>{php(total)}</span>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditId(null); setError(null); setAmount(''); setDesc(''); setCategory('OFFICE_SUPPLIES'); }}
          style={{ ...M, fontSize: 11, padding: '7px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: showForm ? 'var(--surface2)' : 'rgba(255,92,92,0.15)', color: showForm ? 'var(--muted)' : '#ff5c5c' }}
        >
          {showForm ? 'Cancel' : '+ Expense'}
        </button>
      </div>

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
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>

            <input
              type="text"
              placeholder={category === 'OTHERS' ? 'Description (required)' : 'Description (optional)'}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              style={{ background: 'var(--surface)', border: `1px solid ${category === 'OTHERS' && !desc.trim() ? 'rgba(255,92,92,0.5)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none' }}
            />

            <input
              type="number"
              placeholder="Amount (PHP)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0.01" step="0.01"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: '#e2e6f0', ...M, fontSize: 14, outline: 'none' }}
            />

            {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c' }}>{error}</div>}

            <button
              onClick={submit} disabled={saving}
              style={{ ...M, fontSize: 12, fontWeight: 700, padding: '10px', borderRadius: 8, border: 'none', background: saving ? 'var(--surface2)' : 'rgba(255,92,92,0.8)', color: '#fff', cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </div>
      )}

      {expenses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {expenses.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{CATEGORY_LABELS[e.category] ?? e.category}</div>
                {e.description && <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{e.description}</div>}
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>by {e.recorded_by}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ ...Y, fontSize: 14, fontWeight: 700, color: '#ff5c5c' }}>{php(e.amount_php)}</span>
                {e.recorded_by === username && (
                  <button onClick={() => startEdit(e)} style={{ ...M, fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>✎</button>
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
