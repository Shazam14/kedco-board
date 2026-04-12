'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_LABEL: Record<string, string> = {
  MAIN:   'Main Currencies',
  '2ND':  '2nd Currencies',
  OTHERS: 'Others',
};

interface CurrencyRow {
  code: string; name: string; flag: string; category: string; decimal_places: number;
  buy_count: number; buy_qty: number; buy_php: number;
  sell_count: number; sell_qty: number; sell_php: number;
  than: number;
}
interface CashierRow {
  cashier: string;
  buy_count: number; buy_php: number;
  sell_count: number; sell_php: number;
  than: number;
}
interface TxnRow {
  id: string; time: string; type: string; source: string;
  currency: string; foreign_amt: number; rate: number;
  php_amt: number; than: number; cashier: string; customer: string;
}
interface Report {
  date: string;
  generated_at: string;
  total_transactions: number;
  total_bought_php: number;
  total_sold_php: number;
  total_than: number;
  by_currency: CurrencyRow[];
  by_cashier: CashierRow[];
  transactions: TxnRow[];
}

export default function ReportShell({
  report,
  selectedDate,
}: {
  report: Report | null;
  selectedDate: string;
}) {
  const router  = useRouter();
  const [date, setDate] = useState(selectedDate);

  function goToDate(d: string) {
    router.push(`/admin/report${d ? `?date=${d}` : ''}`);
  }

  // Group currencies by category
  const categories = ['MAIN', '2ND', 'OTHERS'];
  const byCat = (cat: string) =>
    (report?.by_currency ?? []).filter(r => r.category === cat);

  const catTotal = (rows: CurrencyRow[]) => ({
    buy_count:  rows.reduce((s, r) => s + r.buy_count,  0),
    buy_php:    rows.reduce((s, r) => s + r.buy_php,    0),
    sell_count: rows.reduce((s, r) => s + r.sell_count, 0),
    sell_php:   rows.reduce((s, r) => s + r.sell_php,   0),
    than:       rows.reduce((s, r) => s + r.than,       0),
  });

  return (
    <>
      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-page { background: #fff !important; color: #000 !important; padding: 0 !important; }
          .print-card { background: #fff !important; border: 1px solid #ccc !important; color: #000 !important; }
          .print-thead { background: #f5f5f5 !important; color: #000 !important; }
          .print-muted { color: #555 !important; }
          .print-accent { color: #000 !important; font-weight: 700 !important; }
        }
      `}</style>

      <div className="print-page" style={{ minHeight: '100vh', background: '#080a10', color: '#e2e6f0' }}>

        {/* ── NAV (hidden on print) ── */}
        <nav className="no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', height: '56px', borderBottom: '1px solid #1e2230',
          background: 'rgba(15,17,23,0.96)', backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#00d4aa,#00a884)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#000',
            }}>K</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e6f0', ...Y }}>Kedco FX</div>
              <div style={{ ...M, fontSize: 9, color: '#4a5468', marginTop: -2 }}>Daily Report</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Date picker */}
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              onBlur={e => goToDate(e.target.value)}
              style={{
                background: '#0f1117', border: '1px solid #1e2230', borderRadius: 6,
                padding: '6px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={() => window.print()}
              style={{
                padding: '6px 18px', borderRadius: 6,
                border: '1px solid rgba(0,212,170,0.35)',
                background: 'rgba(0,212,170,0.1)', color: '#00d4aa',
                ...M, fontSize: 11, cursor: 'pointer',
              }}
            >
              🖨 Print / Save PDF
            </button>
            <a href="/admin" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #1e2230', color: '#4a5468', ...M, fontSize: 11, textDecoration: 'none' }}>
              ← Admin
            </a>
          </div>
        </nav>

        {/* ── NO DATA STATE ── */}
        {!report && (
          <div style={{ padding: '80px 32px', textAlign: 'center', ...M, fontSize: 13, color: '#4a5468' }}>
            No transactions found for this date.
          </div>
        )}

        {report && (
          <div style={{ padding: '32px 40px', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── REPORT HEADER ── */}
            <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '1px solid #1e2230' }}>
              <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>KEDCO FX — DAILY REPORT</div>
              <div style={{ ...M, fontSize: 12, color: '#4a5468' }}>
                {new Date(report.date + 'T00:00:00').toLocaleDateString('en-PH', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                }).toUpperCase()}
              </div>
              <div style={{ ...M, fontSize: 11, color: '#4a5468', marginTop: 4 }}>
                Generated {report.generated_at} · {report.total_transactions} transactions
              </div>
            </div>

            {/* ── SUMMARY BOXES ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {[
                { label: 'TOTAL BOUGHT', value: php(report.total_bought_php), color: '#5b8cff' },
                { label: 'TOTAL SOLD',   value: php(report.total_sold_php),   color: '#f5a623' },
                { label: 'TOTAL THAN',   value: php(report.total_than),       color: '#00d4aa' },
              ].map(s => (
                <div key={s.label} className="print-card" style={{
                  background: '#0f1117', border: '1px solid #1e2230',
                  borderRadius: 12, padding: '18px 24px',
                }}>
                  <div className="print-muted" style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', marginBottom: 8 }}>{s.label}</div>
                  <div className="print-accent" style={{ ...Y, fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* ── BY CURRENCY (replaces 6 books) ── */}
            <div className="print-card" style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2230' }}>
                <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Currency Breakdown</div>
                <div className="print-muted" style={{ ...M, fontSize: 10, color: '#4a5468', marginTop: 2 }}>
                  Replaces BUY × MAIN/2ND/OTHERS and SELL × MAIN/2ND/OTHERS books
                </div>
              </div>

              {/* Column headers */}
              <div className="print-thead" style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                padding: '8px 20px', background: '#161922', borderBottom: '1px solid #1e2230',
                ...M, fontSize: 9, color: '#4a5468', letterSpacing: '0.1em',
              }}>
                <span>CURRENCY</span><span>NAME</span>
                <span style={{ textAlign: 'right' }}>BUY #</span>
                <span style={{ textAlign: 'right' }}>BUY QTY</span>
                <span style={{ textAlign: 'right' }}>BUY PHP</span>
                <span style={{ textAlign: 'right' }}>SELL #</span>
                <span style={{ textAlign: 'right' }}>SELL QTY</span>
                <span style={{ textAlign: 'right' }}>SELL PHP</span>
                <span style={{ textAlign: 'right' }}>THAN</span>
              </div>

              {categories.map(cat => {
                const rows = byCat(cat);
                if (rows.length === 0) return null;
                const tot = catTotal(rows);
                return (
                  <div key={cat}>
                    {/* Category label */}
                    <div style={{
                      padding: '7px 20px',
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid #1e2230',
                      ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.15em',
                    }}>
                      {CATEGORY_LABEL[cat] ?? cat}
                    </div>

                    {rows.map((r, i) => (
                      <div key={r.code} style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                        padding: '9px 20px',
                        borderBottom: '1px solid #1e2230',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                        alignItems: 'center',
                      }}>
                        <span style={{ ...M, fontSize: 13, color: '#e2e6f0', fontWeight: 700 }}>
                          {r.flag} {r.code}
                        </span>
                        <span className="print-muted" style={{ ...M, fontSize: 11, color: '#4a5468' }}>{r.name}</span>
                        <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{r.buy_count || '—'}</span>
                        <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>
                          {r.buy_qty > 0 ? r.buy_qty.toLocaleString('en-PH', { maximumFractionDigits: r.decimal_places }) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>
                          {r.buy_php > 0 ? php(r.buy_php) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{r.sell_count || '—'}</span>
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>
                          {r.sell_qty > 0 ? r.sell_qty.toLocaleString('en-PH', { maximumFractionDigits: r.decimal_places }) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>
                          {r.sell_php > 0 ? php(r.sell_php) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: r.than > 0 ? '#00d4aa' : '#4a5468', textAlign: 'right' }}>
                          {r.than > 0 ? php(r.than) : '—'}
                        </span>
                      </div>
                    ))}

                    {/* Category subtotal */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                      padding: '8px 20px', borderBottom: '1px solid #1e2230',
                      background: 'rgba(255,255,255,0.05)',
                    }}>
                      <span style={{ ...M, fontSize: 10, color: '#4a5468', gridColumn: '1/3' }}>
                        {CATEGORY_LABEL[cat]} subtotal
                      </span>
                      <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{tot.buy_count}</span>
                      <span />
                      <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right', fontWeight: 700 }}>{php(tot.buy_php)}</span>
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{tot.sell_count}</span>
                      <span />
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right', fontWeight: 700 }}>{php(tot.sell_php)}</span>
                      <span style={{ ...M, fontSize: 11, color: '#00d4aa', textAlign: 'right', fontWeight: 700 }}>
                        {tot.than > 0 ? php(tot.than) : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                padding: '12px 20px',
                background: 'rgba(0,212,170,0.07)',
                borderTop: '1px solid rgba(0,212,170,0.3)',
              }}>
                <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#00d4aa', gridColumn: '1/3' }}>GRAND TOTAL</span>
                <span />
                <span />
                <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#5b8cff', textAlign: 'right' }}>{php(report.total_bought_php)}</span>
                <span />
                <span />
                <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#f5a623', textAlign: 'right' }}>{php(report.total_sold_php)}</span>
                <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#00d4aa', textAlign: 'right' }}>{php(report.total_than)}</span>
              </div>
            </div>

            {/* ── BY CASHIER (replaces CASHIER sheet) ── */}
            <div className="print-card" style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2230' }}>
                <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Per-Cashier Summary</div>
                <div className="print-muted" style={{ ...M, fontSize: 10, color: '#4a5468', marginTop: 2 }}>Replaces the CASHIER sheet</div>
              </div>
              <div className="print-thead" style={{
                display: 'grid', gridTemplateColumns: '160px 80px 130px 80px 130px 130px',
                padding: '8px 20px', background: '#161922', borderBottom: '1px solid #1e2230',
                ...M, fontSize: 9, color: '#4a5468', letterSpacing: '0.1em',
              }}>
                <span>CASHIER</span>
                <span style={{ textAlign: 'right' }}>BUY TXN</span>
                <span style={{ textAlign: 'right' }}>BOUGHT (PHP)</span>
                <span style={{ textAlign: 'right' }}>SELL TXN</span>
                <span style={{ textAlign: 'right' }}>SOLD (PHP)</span>
                <span style={{ textAlign: 'right' }}>THAN</span>
              </div>
              {report.by_cashier.map((r, i) => (
                <div key={r.cashier} style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 80px 130px 80px 130px 130px',
                  padding: '10px 20px', borderBottom: '1px solid #1e2230',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                  alignItems: 'center',
                }}>
                  <span style={{ ...M, fontSize: 13, color: '#e2e6f0', fontWeight: 700 }}>{r.cashier}</span>
                  <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{r.buy_count}</span>
                  <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{php(r.buy_php)}</span>
                  <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{r.sell_count}</span>
                  <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{php(r.sell_php)}</span>
                  <span style={{ ...M, fontSize: 11, color: r.than > 0 ? '#00d4aa' : '#4a5468', textAlign: 'right' }}>
                    {r.than > 0 ? php(r.than) : '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* ── FULL TRANSACTION LOG ── */}
            <div className="print-card" style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2230' }}>
                <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Transaction Log</div>
                <div className="print-muted" style={{ ...M, fontSize: 10, color: '#4a5468', marginTop: 2 }}>
                  All {report.total_transactions} transactions for the day
                </div>
              </div>
              <div className="print-thead" style={{
                display: 'grid', gridTemplateColumns: '110px 60px 50px 56px 70px 80px 100px 80px 110px 120px',
                padding: '8px 20px', background: '#161922', borderBottom: '1px solid #1e2230',
                ...M, fontSize: 9, color: '#4a5468', letterSpacing: '0.1em',
              }}>
                <span>RECEIPT</span><span>TIME</span><span>TYPE</span><span>SRC</span>
                <span>CCY</span><span style={{ textAlign: 'right' }}>FOREIGN</span>
                <span style={{ textAlign: 'right' }}>RATE</span>
                <span style={{ textAlign: 'right' }}>PHP</span>
                <span style={{ textAlign: 'right' }}>THAN</span>
                <span>CASHIER / CUST</span>
              </div>
              {report.transactions.map((t, i) => (
                <div key={t.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 60px 50px 56px 70px 80px 100px 80px 110px 120px',
                  padding: '8px 20px', borderBottom: '1px solid #1e2230',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                  alignItems: 'center',
                }}>
                  <span style={{ ...M, fontSize: 10, color: '#4a5468' }}>{t.id}</span>
                  <span style={{ ...M, fontSize: 10, color: '#4a5468' }}>{t.time}</span>
                  <span style={{ ...M, fontSize: 11, fontWeight: 700, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623' }}>{t.type}</span>
                  <span style={{ ...M, fontSize: 10, color: '#4a5468' }}>{t.source === 'RIDER' ? 'RIDER' : 'CTR'}</span>
                  <span style={{ ...M, fontSize: 12, color: '#e2e6f0', fontWeight: 700 }}>{t.currency}</span>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0', textAlign: 'right' }}>{t.foreign_amt.toLocaleString()}</span>
                  <span style={{ ...M, fontSize: 11, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623', textAlign: 'right' }}>{t.rate}</span>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0', textAlign: 'right' }}>{php(t.php_amt)}</span>
                  <span style={{ ...M, fontSize: 11, color: t.than > 0 ? '#00d4aa' : '#4a5468', textAlign: 'right' }}>
                    {t.than > 0 ? php(t.than) : '—'}
                  </span>
                  <span style={{ ...M, fontSize: 10, color: '#4a5468', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.cashier}{t.customer ? ` / ${t.customer}` : ''}
                  </span>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
