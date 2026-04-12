'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PositionMeta } from '@/lib/api';

const S: Record<string, React.CSSProperties> = {
  card: { background:'#0f1117', border:'1px solid #1e2230', borderRadius:14, overflow:'hidden' },
  mono: { fontFamily:"'DM Mono',monospace" },
  syne: { fontFamily:"'Syne',sans-serif" },
};

function CategoryBlock({
  label, positions, values, onChange,
}: {
  label: string;
  positions: PositionMeta[];
  values: Record<string, { qty: string; rate: string }>;
  onChange: (code: string, field: 'qty' | 'rate', val: string) => void;
}) {
  const color = label === 'MAIN' ? '#00d4aa' : label === '2ND' ? '#5b8cff' : '#f5a623';
  const rgb   = label === 'MAIN' ? '0,212,170'  : label === '2ND' ? '91,140,255' : '245,166,35';
  return (
    <div style={S.card}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid #1e2230', background:`rgba(${rgb},0.06)`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:8, height:8, borderRadius:2, background:color }} />
        <span style={{ ...S.syne, fontSize:12, fontWeight:700, color }}>{label}</span>
        <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{positions.length} currencies</span>
      </div>

      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr 80px', padding:'8px 20px', borderBottom:'1px solid #1e2230', gap:12 }}>
        {['CURRENCY', 'CARRY-IN QTY', 'CARRY-IN RATE (PHP)', 'STATUS'].map(h => (
          <span key={h} style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em' }}>{h}</span>
        ))}
      </div>

      {positions.map((p, i) => {
        const v = values[p.code] ?? { qty:'', rate:'' };
        const hasValue = v.qty !== '' && v.rate !== '';
        const qtyNum   = parseFloat(v.qty);
        const rateNum  = parseFloat(v.rate);
        const valid    = hasValue && qtyNum >= 0 && rateNum > 0;
        const phpValue = valid ? qtyNum * rateNum : null;

        return (
          <div key={p.code} style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr 80px', padding:'10px 20px', borderBottom:i<positions.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', gap:12, alignItems:'center' }}>
            {/* Currency */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{p.flag}</span>
              <div>
                <div style={{ ...S.mono, fontSize:12, color:'#f5a623', fontWeight:600 }}>{p.code}</div>
                <div style={{ ...S.mono, fontSize:9, color:'#4a5468' }}>{p.name}</div>
              </div>
            </div>

            {/* Qty */}
            <div>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={v.qty}
                onChange={e => onChange(p.code, 'qty', e.target.value)}
                style={{ background:'#161922', border:`1px solid ${v.qty !== '' ? '#5b8cff44' : '#1e2230'}`, borderRadius:6, padding:'8px 12px', color:'#5b8cff', ...S.mono, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }}
              />
              {phpValue !== null && (
                <div style={{ ...S.mono, fontSize:9, marginTop:2, color:'#4a5468' }}>
                  ≈ ₱{Math.round(phpValue).toLocaleString('en-PH')}
                </div>
              )}
            </div>

            {/* Rate */}
            <div>
              <input
                type="number"
                step="any"
                min="0"
                placeholder={p.decimalPlaces === 4 ? '0.0000' : '0.00'}
                value={v.rate}
                onChange={e => onChange(p.code, 'rate', e.target.value)}
                style={{ background:'#161922', border:`1px solid ${v.rate !== '' ? (rateNum > 0 ? '#00d4aa44' : '#ff5c5c44') : '#1e2230'}`, borderRadius:6, padding:'8px 12px', color:'#00d4aa', ...S.mono, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }}
              />
              <div style={{ ...S.mono, fontSize:9, marginTop:2, color:'#4a5468' }}>
                yesterday&apos;s closing sell rate
              </div>
            </div>

            {/* Status */}
            <div style={{ ...S.mono, fontSize:10, textAlign:'center' }}>
              {p.positionSet ? (
                <span style={{ color:'#00d4aa', background:'rgba(0,212,170,0.1)', padding:'3px 8px', borderRadius:20, border:'1px solid rgba(0,212,170,0.2)' }}>SET</span>
              ) : (
                <span style={{ color:'#4a5468' }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PositionSetterForm({ positions }: { positions: PositionMeta[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [values, setValues] = useState<Record<string, { qty: string; rate: string }>>(() => {
    const init: Record<string, { qty: string; rate: string }> = {};
    positions.forEach(p => {
      init[p.code] = {
        qty:  p.carryInQty  > 0 ? String(p.carryInQty)  : '',
        rate: p.carryInRate > 0 ? String(p.carryInRate) : '',
      };
    });
    return init;
  });

  function handleChange(code: string, field: 'qty' | 'rate', val: string) {
    setValues(prev => ({ ...prev, [code]: { ...prev[code], [field]: val } }));
  }

  async function handleSave() {
    const toSave = positions
      .filter(p => {
        const v = values[p.code];
        return v?.qty !== '' && v?.rate !== '' && parseFloat(v.rate) > 0 && parseFloat(v.qty) >= 0;
      })
      .map(p => ({
        currency_code: p.code,
        carry_in_qty:  parseFloat(values[p.code].qty),
        carry_in_rate: parseFloat(values[p.code].rate),
      }));

    if (toSave.length === 0) {
      setResult({ ok: false, message: 'No valid positions to save. Enter qty and a positive rate.' });
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const res  = await fetch('/api/admin/positions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(toSave),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message ?? data.detail ?? 'Done' });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const filledCount = positions.filter(p => {
    const v = values[p.code];
    return v?.qty !== '' && v?.rate !== '';
  }).length;
  const alreadySet  = positions.filter(p => p.positionSet).length;

  const main    = positions.filter(p => p.category === 'MAIN');
  const second  = positions.filter(p => p.category === '2ND');
  const others  = positions.filter(p => p.category === 'OTHERS');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Summary bar */}
      <div style={{ ...S.card, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid rgba(91,140,255,0.2)' }}>
        <div style={{ display:'flex', gap:24 }}>
          <div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:3 }}>CURRENCIES</div>
            <div style={{ ...S.syne, fontSize:22, fontWeight:800, color:'#e2e6f0' }}>{positions.length}</div>
          </div>
          <div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:3 }}>ENTERED</div>
            <div style={{ ...S.syne, fontSize:22, fontWeight:800, color: filledCount > 0 ? '#5b8cff' : '#4a5468' }}>{filledCount}</div>
          </div>
          <div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:3 }}>ALREADY SET</div>
            <div style={{ ...S.syne, fontSize:22, fontWeight:800, color: alreadySet > 0 ? '#00d4aa' : '#4a5468' }}>{alreadySet}</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {result && (
            <div style={{ ...S.mono, fontSize:11, color: result.ok ? '#00d4aa' : '#ff5c5c', background: result.ok ? 'rgba(0,212,170,0.08)' : 'rgba(255,92,92,0.08)', border:`1px solid ${result.ok ? 'rgba(0,212,170,0.2)' : 'rgba(255,92,92,0.2)'}`, borderRadius:8, padding:'8px 14px' }}>
              {result.ok ? '✓ ' : '✗ '}{result.message}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || filledCount === 0}
            style={{ padding:'10px 28px', borderRadius:8, border:'none', background: (saving || filledCount === 0) ? '#1e2230' : 'linear-gradient(135deg,#5b8cff,#3a6bef)', color: (saving || filledCount === 0) ? '#4a5468' : '#fff', ...S.syne, fontSize:13, fontWeight:800, cursor: (saving || filledCount === 0) ? 'not-allowed' : 'pointer', letterSpacing:'0.02em' }}
          >
            {saving ? 'SAVING...' : `SAVE ${filledCount} POSITIONS`}
          </button>
        </div>
      </div>

      <CategoryBlock label="MAIN"   positions={main}   values={values} onChange={handleChange} />
      <CategoryBlock label="2ND"    positions={second} values={values} onChange={handleChange} />
      <CategoryBlock label="OTHERS" positions={others} values={values} onChange={handleChange} />
    </div>
  );
}
