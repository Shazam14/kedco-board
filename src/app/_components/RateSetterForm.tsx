'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyMeta } from '@/lib/types';

const S: Record<string, React.CSSProperties> = {
  card: { background:'#0f1117', border:'1px solid #1e2230', borderRadius:14, overflow:'hidden' },
  mono: { fontFamily:"'DM Mono',monospace" },
  syne: { fontFamily:"'Syne',sans-serif" },
};

function CategoryBlock({
  label, currencies, values, onChange,
}: {
  label: string;
  currencies: CurrencyMeta[];
  values: Record<string, { buy: string; sell: string }>;
  onChange: (code: string, field: 'buy' | 'sell', val: string) => void;
}) {
  const color = label === 'MAIN' ? '#00d4aa' : label === '2ND' ? '#5b8cff' : '#f5a623';
  return (
    <div style={S.card}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid #1e2230', background:`rgba(${label==='MAIN'?'0,212,170':label==='2ND'?'91,140,255':'245,166,35'},0.06)`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:8, height:8, borderRadius:2, background:color }} />
        <span style={{ ...S.syne, fontSize:12, fontWeight:700, color }}>{label}</span>
        <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{currencies.length} currencies</span>
      </div>

      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr 80px', padding:'8px 20px', borderBottom:'1px solid #1e2230', gap:12 }}>
        {['CURRENCY','BUY RATE','SELL RATE','STATUS'].map(h => (
          <span key={h} style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em' }}>{h}</span>
        ))}
      </div>

      {currencies.map((c, i) => {
        const v = values[c.code] ?? { buy:'', sell:'' };
        const hasValue = v.buy && v.sell;
        const spread = hasValue ? (parseFloat(v.sell) - parseFloat(v.buy)) : null;
        const spreadOk = spread !== null && spread > 0;

        return (
          <div key={c.code} style={{ display:'grid', gridTemplateColumns:'180px 1fr 1fr 80px', padding:'10px 20px', borderBottom:i<currencies.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', gap:12, alignItems:'center' }}>
            {/* Currency */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{c.flag}</span>
              <div>
                <div style={{ ...S.mono, fontSize:12, color:'#f5a623', fontWeight:600 }}>{c.code}</div>
                <div style={{ ...S.mono, fontSize:9, color:'#4a5468' }}>{c.name}</div>
              </div>
            </div>

            {/* Buy rate */}
            <input
              type="number"
              step="any"
              placeholder={`e.g. ${c.decimalPlaces === 4 ? '0.0000' : '0.00'}`}
              value={v.buy}
              onChange={e => onChange(c.code, 'buy', e.target.value)}
              style={{ background:'#161922', border:`1px solid ${v.buy ? '#5b8cff44' : '#1e2230'}`, borderRadius:6, padding:'8px 12px', color:'#5b8cff', fontFamily:"'DM Mono',monospace", fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }}
            />

            {/* Sell rate */}
            <div>
              <input
                type="number"
                step="any"
                placeholder={`e.g. ${c.decimalPlaces === 4 ? '0.0000' : '0.00'}`}
                value={v.sell}
                onChange={e => onChange(c.code, 'sell', e.target.value)}
                style={{ background:'#161922', border:`1px solid ${v.sell ? (spreadOk ? '#00d4aa44' : '#ff5c5c44') : '#1e2230'}`, borderRadius:6, padding:'8px 12px', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }}
              />
              {spread !== null && (
                <div style={{ ...S.mono, fontSize:9, marginTop:2, color: spreadOk ? '#00d4aa' : '#ff5c5c' }}>
                  {spreadOk ? `spread +${spread.toFixed(c.decimalPlaces)}` : 'sell must be > buy'}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={{ ...S.mono, fontSize:10, textAlign:'center' }}>
              {c.rateSet ? (
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

export default function RateSetterForm({ currencies }: { currencies: CurrencyMeta[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Initialize form values from existing rates
  const [values, setValues] = useState<Record<string, { buy: string; sell: string }>>(() => {
    const init: Record<string, { buy: string; sell: string }> = {};
    currencies.forEach(c => {
      init[c.code] = {
        buy:  c.todayBuyRate  != null ? String(c.todayBuyRate)  : '',
        sell: c.todaySellRate != null ? String(c.todaySellRate) : '',
      };
    });
    return init;
  });

  function handleChange(code: string, field: 'buy' | 'sell', val: string) {
    setValues(prev => ({ ...prev, [code]: { ...prev[code], [field]: val } }));
  }

  async function handleSave() {
    const toSave = currencies
      .filter(c => values[c.code]?.buy && values[c.code]?.sell)
      .map(c => ({
        code:      c.code,
        buy_rate:  parseFloat(values[c.code].buy),
        sell_rate: parseFloat(values[c.code].sell),
      }))
      .filter(r => r.sell_rate > r.buy_rate); // only valid spreads

    if (toSave.length === 0) {
      setResult({ ok: false, message: 'No valid rates to save. Check all sell rates are higher than buy rates.' });
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/rates', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(toSave),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message ?? data.error ?? 'Done' });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const setCount  = currencies.filter(c => values[c.code]?.buy && values[c.code]?.sell).length;
  const mainCurr  = currencies.filter(c => c.category === 'MAIN');
  const secondCurr = currencies.filter(c => c.category === '2ND');
  const othersCurr = currencies.filter(c => c.category === 'OTHERS');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Summary bar */}
      <div style={{ ...S.card, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid rgba(0,212,170,0.2)' }}>
        <div style={{ display:'flex', gap:24 }}>
          <div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:3 }}>CURRENCIES</div>
            <div style={{ ...S.syne, fontSize:22, fontWeight:800, color:'#e2e6f0' }}>{currencies.length}</div>
          </div>
          <div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:3 }}>RATES ENTERED</div>
            <div style={{ ...S.syne, fontSize:22, fontWeight:800, color: setCount === currencies.length ? '#00d4aa' : '#f5a623' }}>{setCount}</div>
          </div>
          <div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:3 }}>ALREADY SET TODAY</div>
            <div style={{ ...S.syne, fontSize:22, fontWeight:800, color:'#5b8cff' }}>{currencies.filter(c => c.rateSet).length}</div>
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
            disabled={saving}
            style={{ padding:'10px 28px', borderRadius:8, border:'none', background: saving ? '#1e2230' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: saving ? '#4a5468' : '#000', fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:800, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing:'0.02em' }}
          >
            {saving ? 'SAVING...' : `SAVE ${setCount} RATES`}
          </button>
        </div>
      </div>

      <CategoryBlock label="MAIN"   currencies={mainCurr}   values={values} onChange={handleChange} />
      <CategoryBlock label="2ND"    currencies={secondCurr} values={values} onChange={handleChange} />
      <CategoryBlock label="OTHERS" currencies={othersCurr} values={values} onChange={handleChange} />
    </div>
  );
}
