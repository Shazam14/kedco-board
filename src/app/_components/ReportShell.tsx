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
  code: string; name: string; flag: string; category: string;
  sort_order?: number; decimal_places: number;
  buy_count: number; buy_qty: number; buy_php: number;
  sell_count: number; sell_qty: number; sell_php: number;
  than: number;
}
interface PositionRow {
  code: string; name: string; flag: string; category: string;
  sort_order?: number; decimal_places: number;
  carry_in_qty: number; carry_in_rate: number; carry_in_php: number;
}
interface StockRow {
  code: string; name: string; flag: string; category: string;
  sort_order: number; decimal_places: number;
  carry_in_qty: number; buy_qty: number; sell_qty: number;
  stocks_left_qty: number; rate: number; stocks_left_php: number | null;
}
interface CashierRow {
  cashier: string;
  buy_count: number; buy_php: number;
  sell_count: number; sell_php: number;
  than: number;
  commission: number;
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
  total_opening_stock_php?: number;
  total_bought_php: number;
  total_sold_php: number;
  total_than: number;
  total_commission: number;
  opening_positions?: PositionRow[];
  by_currency: CurrencyRow[];
  by_cashier: CashierRow[];
  transactions: TxnRow[];
}

function buildStockSummary(report: Report): StockRow[] {
  const catOrder: Record<string, number> = { MAIN: 0, '2ND': 1, OTHERS: 2 };
  const posMap = Object.fromEntries((report.opening_positions ?? []).map(p => [p.code, p]));
  const txnMap = Object.fromEntries((report.by_currency ?? []).map(r => [r.code, r]));
  const codes = Array.from(new Set([
    ...(report.opening_positions ?? []).map(p => p.code),
    ...(report.by_currency ?? []).map(r => r.code),
  ]));
  return codes.map(code => {
    const pos = posMap[code];
    const txn = txnMap[code];
    const meta = pos ?? txn!;
    const carry_in_qty  = pos?.carry_in_qty   ?? 0;
    const carry_in_rate = pos?.carry_in_rate  ?? 0;
    const buy_qty       = txn?.buy_qty        ?? 0;
    const buy_php       = txn?.buy_php        ?? 0;
    const sell_qty      = txn?.sell_qty       ?? 0;
    const total_in      = carry_in_qty + buy_qty;
    // weighted daily avg cost: blends opening inventory with today's buys
    const rawRate = total_in > 0
      ? (carry_in_qty * carry_in_rate + buy_php) / total_in
      : carry_in_rate;
    // round to same precision as carry_in_rate (e.g. 0.45→2dp, 0.3704→4dp, 59.55→2dp)
    const rateDP = carry_in_rate ? (carry_in_rate.toString().split('.')[1]?.length ?? 2) : 2;
    const rate = Math.round(rawRate * Math.pow(10, rateDP)) / Math.pow(10, rateDP);
    const stocks_left_qty = carry_in_qty + buy_qty - sell_qty;
    return {
      code,
      name:            meta.name,
      flag:            meta.flag,
      category:        meta.category ?? 'OTHERS',
      sort_order:      meta.sort_order ?? 99,
      decimal_places:  meta.decimal_places,
      carry_in_qty, buy_qty, sell_qty, stocks_left_qty, rate,
      stocks_left_php: rate > 0 ? Math.round(stocks_left_qty * rate * 100) / 100 : null,
    };
  }).sort((a, b) => {
    const ca = catOrder[a.category] ?? 9;
    const cb = catOrder[b.category] ?? 9;
    return ca !== cb ? ca - cb : a.sort_order - b.sort_order;
  });
}

function printReport(report: Report) {
  const php = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dpMap: Record<string, number> = Object.fromEntries(report.by_currency.map(r => [r.code, r.decimal_places]));
  const fmtFx = (amt: number, code: string) => { const dp = dpMap[code] ?? 2; return amt.toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp }); };
  const dateLabel = new Date(report.date + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();

  const CATEGORY_LABEL: Record<string, string> = { MAIN: 'Main Currencies', '2ND': '2nd Currencies', OTHERS: 'Others' };
  const categories = ['MAIN', '2ND', 'OTHERS'];

  const currencyRows = categories.map(cat => {
    const rows = report.by_currency.filter(r => r.category === cat);
    if (!rows.length) return '';
    const tot = {
      buy_count:  rows.reduce((s, r) => s + r.buy_count,  0),
      buy_php:    rows.reduce((s, r) => s + r.buy_php,    0),
      sell_count: rows.reduce((s, r) => s + r.sell_count, 0),
      sell_php:   rows.reduce((s, r) => s + r.sell_php,   0),
      than:       rows.reduce((s, r) => s + r.than,       0),
    };
    return `
      <tr style="background:#f0f0f0"><td colspan="9" style="padding:6px 8px;font-weight:700;font-size:11px;letter-spacing:0.1em">${CATEGORY_LABEL[cat] ?? cat}</td></tr>
      ${rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
          <td style="padding:7px 8px;font-weight:700">${r.flag} ${r.code}</td>
          <td style="color:#555">${r.name}</td>
          <td style="text-align:right;color:#2255cc">${r.buy_count || '—'}</td>
          <td style="text-align:right;color:#2255cc">${r.buy_qty > 0 ? r.buy_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
          <td style="text-align:right;color:#2255cc;font-weight:600">${r.buy_php > 0 ? php(r.buy_php) : '—'}</td>
          <td style="text-align:right;color:#c47000">${r.sell_count || '—'}</td>
          <td style="text-align:right;color:#c47000">${r.sell_qty > 0 ? r.sell_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
          <td style="text-align:right;color:#c47000;font-weight:600">${r.sell_php > 0 ? php(r.sell_php) : '—'}</td>
          <td style="text-align:right;color:${r.than > 0 ? '#007a55' : '#999'};font-weight:600">${r.than > 0 ? php(r.than) : '—'}</td>
        </tr>
      `).join('')}
      <tr style="background:#e8e8e8;font-weight:700">
        <td colspan="2" style="padding:6px 8px;font-size:11px">${CATEGORY_LABEL[cat]} subtotal</td>
        <td style="text-align:right;color:#2255cc">${tot.buy_count}</td>
        <td></td>
        <td style="text-align:right;color:#2255cc">${php(tot.buy_php)}</td>
        <td style="text-align:right;color:#c47000">${tot.sell_count}</td>
        <td></td>
        <td style="text-align:right;color:#c47000">${php(tot.sell_php)}</td>
        <td style="text-align:right;color:#007a55">${tot.than > 0 ? php(tot.than) : '—'}</td>
      </tr>`;
  }).join('');

  const hasComm = report.total_commission !== 0;
  const cashierRows = report.by_cashier.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:7px 8px;font-weight:700">${r.cashier}</td>
      <td style="text-align:right;color:#2255cc">${r.buy_count}</td>
      <td style="text-align:right;color:#2255cc;font-weight:600">${php(r.buy_php)}</td>
      <td style="text-align:right;color:#c47000">${r.sell_count}</td>
      <td style="text-align:right;color:#c47000;font-weight:600">${php(r.sell_php)}</td>
      <td style="text-align:right;color:${r.than > 0 ? '#007a55' : '#999'};font-weight:700">${r.than > 0 ? php(r.than) : '—'}</td>
      ${hasComm ? `<td style="text-align:right;color:${r.commission !== 0 ? '#007a55' : '#999'};font-weight:700">${r.commission !== 0 ? (r.commission > 0 ? '+' : '') + php(r.commission) : '—'}</td>` : ''}
    </tr>`).join('');

  const txnRows = report.transactions.map((t, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:6px 8px;font-size:10px;color:#555">${t.id}</td>
      <td style="color:#555">${t.time}</td>
      <td style="font-weight:700;color:${t.type === 'BUY' ? '#2255cc' : '#c47000'}">${t.type}</td>
      <td style="color:#555">${t.source === 'RIDER' ? 'RIDER' : 'CTR'}</td>
      <td style="font-weight:700">${t.currency}</td>
      <td style="text-align:right">${fmtFx(t.foreign_amt, t.currency)}</td>
      <td style="text-align:right;color:${t.type === 'BUY' ? '#2255cc' : '#c47000'}">${t.rate}</td>
      <td style="text-align:right;font-weight:600">${php(t.php_amt)}</td>
      <td style="text-align:right;color:${t.than > 0 ? '#007a55' : '#999'}">${t.than > 0 ? php(t.than) : '—'}</td>
      <td style="font-size:10px;color:#555">${t.cashier}</td>
      <td style="font-size:10px;color:#555">${t.customer ?? '—'}</td>
    </tr>`).join('');

  const th = (label: string, align = 'left') =>
    `<th style="padding:7px 8px;background:#222;color:#fff;text-align:${align};font-size:10px;letter-spacing:0.08em;white-space:nowrap">${label}</th>`;

  const openingStockPhp = report.total_opening_stock_php ?? 0;
  const closingEstimate = openingStockPhp + report.total_bought_php - report.total_sold_php;

  const positionRows = categories.map(cat => {
    const rows = (report.opening_positions ?? []).filter(r => r.category === cat);
    if (!rows.length) return '';
    const catTotal = rows.reduce((s, r) => s + r.carry_in_php, 0);
    return `
      <tr style="background:#f0f0f0"><td colspan="5" style="padding:6px 8px;font-weight:700;font-size:11px;letter-spacing:0.1em">${CATEGORY_LABEL[cat] ?? cat}</td></tr>
      ${rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
          <td style="padding:7px 8px;font-weight:700">${r.flag} ${r.code}</td>
          <td style="color:#555">${r.name}</td>
          <td style="text-align:right">${r.carry_in_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places })}</td>
          <td style="text-align:right;color:#555">${r.carry_in_rate}</td>
          <td style="text-align:right;font-weight:600">${php(r.carry_in_php)}</td>
        </tr>`).join('')}
      <tr style="background:#e8e8e8;font-weight:700">
        <td colspan="2" style="padding:6px 8px;font-size:11px">${CATEGORY_LABEL[cat]} subtotal</td>
        <td></td><td></td>
        <td style="text-align:right">${php(catTotal)}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Kedco FX Daily Report — ${report.date}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; padding: 24px; }
      h1 { font-family: Arial, sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.02em; }
      h2 { font-family: Arial, sans-serif; font-size: 13px; font-weight: 800; margin: 20px 0 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
      td { padding: 7px 8px; border-bottom: 1px solid #e0e0e0; }
      .summary { display: flex; gap: 16px; margin-bottom: 16px; }
      .summary-box { flex: 1; border: 1px solid #ccc; border-radius: 6px; padding: 12px 16px; }
      .summary-box .label { font-size: 9px; color: #555; letter-spacing: 0.15em; margin-bottom: 4px; }
      .summary-box .value { font-size: 20px; font-weight: 900; font-family: Arial, sans-serif; }
      .flow { display:flex; align-items:center; gap:12px; background:#f5f5f5; border:1px solid #ddd; border-radius:6px; padding:12px 16px; margin-bottom:24px; font-family:Arial,sans-serif; }
      .flow-item { text-align:center; }
      .flow-item .fl { font-size:9px; color:#555; letter-spacing:0.1em; }
      .flow-item .fv { font-size:15px; font-weight:900; }
      .flow-op { font-size:20px; font-weight:900; color:#999; }
      @media print { body { padding: 12px; } }
    </style>
  </head><body>
    <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #000">
      <h1>KEDCO FX — DAILY REPORT</h1>
      <div style="font-size:12px;color:#555;margin-top:4px">${dateLabel}</div>
      <div style="font-size:11px;color:#888;margin-top:2px">Generated ${report.generated_at} · ${report.total_transactions} transactions</div>
    </div>

    <div class="summary">
      <div class="summary-box"><div class="label">OPENING STOCK</div><div class="value" style="color:#555">${php(openingStockPhp)}</div></div>
      <div class="summary-box"><div class="label">TOTAL BOUGHT</div><div class="value" style="color:#2255cc">${php(report.total_bought_php)}</div></div>
      <div class="summary-box"><div class="label">TOTAL SOLD</div><div class="value" style="color:#c47000">${php(report.total_sold_php)}</div></div>
      <div class="summary-box"><div class="label">TOTAL THAN (MARGIN)</div><div class="value" style="color:#007a55">${php(report.total_than)}</div></div>
      ${hasComm ? `<div class="summary-box"><div class="label">TOTAL COMM</div><div class="value" style="color:#007a55">${report.total_commission > 0 ? '+' : ''}${php(report.total_commission)}</div></div>` : ''}
    </div>
    <div class="flow">
      <div class="flow-item"><div class="fl">OPENING STOCK</div><div class="fv" style="color:#555">${php(openingStockPhp)}</div></div>
      <div class="flow-op">+</div>
      <div class="flow-item"><div class="fl">BOUGHT</div><div class="fv" style="color:#2255cc">${php(report.total_bought_php)}</div></div>
      <div class="flow-op">−</div>
      <div class="flow-item"><div class="fl">SOLD</div><div class="fv" style="color:#c47000">${php(report.total_sold_php)}</div></div>
      <div class="flow-op">=</div>
      <div class="flow-item"><div class="fl">CLOSING STOCK EST.</div><div class="fv" style="color:#007a55">${php(closingEstimate)}</div></div>
    </div>

    <h2>OPENING POSITIONS</h2>
    <table>
      <thead><tr>
        ${th('CURRENCY')}${th('NAME')}${th('CARRY-IN QTY','right')}${th('CARRY-IN RATE','right')}${th('VALUE (PHP)','right')}
      </tr></thead>
      <tbody>${positionRows}</tbody>
      <tfoot><tr style="background:#111;color:#fff;font-weight:900">
        <td colspan="4" style="padding:8px;font-size:12px">TOTAL OPENING STOCK</td>
        <td style="text-align:right;padding:8px;font-size:13px">${php(openingStockPhp)}</td>
      </tr></tfoot>
    </table>

    <h2>STOCK SUMMARY (END OF DAY)</h2>
    <table>
      <thead><tr>
        ${th('CURRENCY')}${th('NAME')}${th('CARRY-IN','right')}${th('+ BOUGHT','right')}${th('− SOLD','right')}${th('STOCKS LEFT','right')}${th('RATE','right')}${th('VALUE PHP','right')}
      </tr></thead>
      <tbody>${(() => {
        const stockRows = buildStockSummary(report);
        return categories.map(cat => {
          const rows = stockRows.filter(r => r.category === cat);
          if (!rows.length) return '';
          const catLeftPhp = rows.reduce((s, r) => s + (r.stocks_left_php ?? 0), 0);
          return `
            <tr style="background:#f0f0f0"><td colspan="8" style="padding:6px 8px;font-weight:700;font-size:11px;letter-spacing:0.1em">${CATEGORY_LABEL[cat] ?? cat}</td></tr>
            ${rows.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                <td style="padding:7px 8px;font-weight:700">${r.flag} ${r.code}</td>
                <td style="color:#555">${r.name}</td>
                <td style="text-align:right;color:#555">${r.carry_in_qty > 0 ? r.carry_in_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
                <td style="text-align:right;color:#2255cc">${r.buy_qty > 0 ? r.buy_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
                <td style="text-align:right;color:#c47000">${r.sell_qty > 0 ? r.sell_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
                <td style="text-align:right;font-weight:700">${r.stocks_left_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places })}</td>
                <td style="text-align:right;color:#555">${r.rate > 0 ? r.rate : '—'}</td>
                <td style="text-align:right;font-weight:600">${r.stocks_left_php !== null ? php(r.stocks_left_php) : '—'}</td>
              </tr>`).join('')}
            <tr style="background:#e8e8e8;font-weight:700">
              <td colspan="7" style="padding:6px 8px;font-size:11px">${CATEGORY_LABEL[cat]} subtotal</td>
              <td style="text-align:right">${php(catLeftPhp)}</td>
            </tr>`;
        }).join('');
      })()}</tbody>
      <tfoot><tr style="background:#111;color:#fff;font-weight:900">
        <td colspan="7" style="padding:8px;font-size:12px">TOTAL CLOSING STOCK (EST.)</td>
        <td style="text-align:right;padding:8px;font-size:13px">${php(closingEstimate)}</td>
      </tr></tfoot>
    </table>

    <h2>CURRENCY BREAKDOWN</h2>
    <table>
      <thead><tr>
        ${th('CURRENCY')}${th('NAME')}${th('BUY #','right')}${th('BUY QTY','right')}${th('BUY PHP','right')}${th('SELL #','right')}${th('SELL QTY','right')}${th('SELL PHP','right')}${th('THAN','right')}
      </tr></thead>
      <tbody>${currencyRows}</tbody>
      <tfoot><tr style="background:#111;color:#fff;font-weight:900">
        <td colspan="2" style="padding:8px;font-size:12px">GRAND TOTAL</td>
        <td></td><td></td>
        <td style="text-align:right;padding:8px;font-size:13px">${php(report.total_bought_php)}</td>
        <td></td><td></td>
        <td style="text-align:right;padding:8px;font-size:13px">${php(report.total_sold_php)}</td>
        <td style="text-align:right;padding:8px;font-size:13px;color:#4ade80">${php(report.total_than)}</td>
      </tr></tfoot>
    </table>

    <h2>PER-CASHIER SUMMARY</h2>
    <table>
      <thead><tr>${th('CASHIER')}${th('BUY TXN','right')}${th('BOUGHT (PHP)','right')}${th('SELL TXN','right')}${th('SOLD (PHP)','right')}${th('THAN','right')}${hasComm ? th('COMM','right') : ''}</tr></thead>
      <tbody>${cashierRows}</tbody>
    </table>

    <h2>TRANSACTION LOG</h2>
    <table>
      <thead><tr>${th('RECEIPT')}${th('TIME')}${th('TYPE')}${th('SRC')}${th('CCY')}${th('FOREIGN','right')}${th('RATE','right')}${th('PHP','right')}${th('THAN','right')}${th('CASHIER')}${th('CUST')}</tr></thead>
      <tbody>${txnRows}</tbody>
    </table>

    <div style="text-align:center;font-size:10px;color:#aaa;margin-top:16px;padding-top:12px;border-top:1px solid #ddd">
      Kedco FX · Pusok, Lapu-Lapu City · Confidential — For Internal Use Only
    </div>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
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

  // dp lookup for on-screen foreign amount formatting
  const dpMap: Record<string, number> = Object.fromEntries(
    (report?.by_currency ?? []).map(r => [r.code, r.decimal_places])
  );
  const fmtFxScreen = (amt: number, code: string) => {
    const dp = dpMap[code] ?? 2;
    return amt.toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  };

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

  const openingStock = report?.total_opening_stock_php ?? 0;
  const openingPositions = report?.opening_positions ?? [];
  const stockSummary = report ? buildStockSummary(report) : [];

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

      <div className="print-page" style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>

        {/* ── NAV (hidden on print) ── */}
        <nav className="no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)',
          background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
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
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Daily Report</div>
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
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={() => report && printReport(report)}
              style={{
                padding: '6px 18px', borderRadius: 6,
                border: '1px solid rgba(0,212,170,0.35)',
                background: 'rgba(0,212,170,0.1)', color: '#00d4aa',
                ...M, fontSize: 11, cursor: 'pointer',
              }}
            >
              🖨 Print / Save PDF
            </button>
            <a href="/admin" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', ...M, fontSize: 11, textDecoration: 'none' }}>
              ← Admin
            </a>
          </div>
        </nav>

        {/* ── NO DATA STATE ── */}
        {!report && (
          <div style={{ padding: '80px 32px', textAlign: 'center', ...M, fontSize: 13, color: 'var(--muted)' }}>
            No transactions found for this date.
          </div>
        )}

        {report && (
          <div style={{ padding: '32px 40px', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── REPORT HEADER ── */}
            <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>KEDCO FX — DAILY REPORT</div>
              <div style={{ ...M, fontSize: 12, color: 'var(--muted)' }}>
                {new Date(report.date + 'T00:00:00').toLocaleDateString('en-PH', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                }).toUpperCase()}
              </div>
              <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Generated {report.generated_at} · {report.total_transactions} transactions
              </div>
            </div>

            {/* ── SUMMARY BOXES ── */}
            {(() => {
              const cols = report.total_commission !== 0 ? 5 : 4;
              const boxes = [
                { label: 'OPENING STOCK', value: php(openingStock), color: '#aab4c8' },
                { label: 'TOTAL BOUGHT',  value: php(report.total_bought_php),        color: '#5b8cff' },
                { label: 'TOTAL SOLD',    value: php(report.total_sold_php),           color: '#f5a623' },
                { label: 'TOTAL THAN',    value: php(report.total_than),               color: '#00d4aa' },
                ...(report.total_commission !== 0 ? [{ label: 'TOTAL COMM', value: (report.total_commission > 0 ? '+' : '') + php(report.total_commission), color: '#00d4aa' }] : []),
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 16 }}>
                  {boxes.map(s => (
                    <div key={s.label} className="print-card" style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '18px 24px',
                    }}>
                      <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 8 }}>{s.label}</div>
                      <div className="print-accent" style={{ ...Y, fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── STOCK MOVEMENT ── */}
            {(() => {
              const closing = openingStock + report.total_bought_php - report.total_sold_php;
              const item = (label: string, value: string, color: string) => (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>{label}</div>
                  <div style={{ ...Y, fontSize: 16, fontWeight: 800, color }}>{value}</div>
                </div>
              );
              const op = (sym: string) => (
                <div style={{ ...Y, fontSize: 20, fontWeight: 800, color: 'var(--muted)', padding: '0 4px' }}>{sym}</div>
              );
              return (
                <div className="print-card" style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 24px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                }}>
                  {item('OPENING STOCK', php(openingStock), '#aab4c8')}
                  {op('+')}
                  {item('BOUGHT', php(report.total_bought_php), '#5b8cff')}
                  {op('−')}
                  {item('SOLD', php(report.total_sold_php), '#f5a623')}
                  {op('=')}
                  {item('CLOSING STOCK EST.', php(closing), '#00d4aa')}
                </div>
              );
            })()}

            {/* ── OPENING POSITIONS ── */}
            {openingPositions.length > 0 && (() => {
              const posByCat = (cat: string) => openingPositions.filter(r => r.category === cat);
              const catPhpTotal = (rows: PositionRow[]) => rows.reduce((s, r) => s + r.carry_in_php, 0);
              return (
                <div className="print-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Opening Positions</div>
                    <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      Carry-in stock from previous day — basis for today's averaging
                    </div>
                  </div>
                  {/* Column headers */}
                  <div className="print-thead" style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 120px 120px 130px',
                    padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  }}>
                    <span>CURRENCY</span><span>NAME</span>
                    <span style={{ textAlign: 'right' }}>CARRY-IN QTY</span>
                    <span style={{ textAlign: 'right' }}>CARRY-IN RATE</span>
                    <span style={{ textAlign: 'right' }}>VALUE (PHP)</span>
                  </div>
                  {categories.map(cat => {
                    const rows = posByCat(cat);
                    if (!rows.length) return null;
                    const total = catPhpTotal(rows);
                    return (
                      <div key={cat}>
                        <div style={{
                          padding: '7px 20px', background: 'rgba(255,255,255,0.03)',
                          borderBottom: '1px solid var(--border)',
                          ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em',
                        }}>
                          {CATEGORY_LABEL[cat] ?? cat}
                        </div>
                        {rows.map((r, i) => (
                          <div key={r.code} style={{
                            display: 'grid', gridTemplateColumns: '110px 1fr 120px 120px 130px',
                            padding: '9px 20px', borderBottom: '1px solid var(--border)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                            alignItems: 'center',
                          }}>
                            <span style={{ ...M, fontSize: 13, fontWeight: 700 }}>{r.flag} {r.code}</span>
                            <span className="print-muted" style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{r.name}</span>
                            <span style={{ ...M, fontSize: 11, textAlign: 'right' }}>
                              {r.carry_in_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places })}
                            </span>
                            <span className="print-muted" style={{ ...M, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{r.carry_in_rate}</span>
                            <span style={{ ...M, fontSize: 11, fontWeight: 700, textAlign: 'right' }}>{php(r.carry_in_php)}</span>
                          </div>
                        ))}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '110px 1fr 120px 120px 130px',
                          padding: '8px 20px', borderBottom: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.05)',
                        }}>
                          <span style={{ ...M, fontSize: 10, color: 'var(--muted)', gridColumn: '1/5' }}>{CATEGORY_LABEL[cat]} subtotal</span>
                          <span style={{ ...M, fontSize: 11, fontWeight: 700, textAlign: 'right' }}>{php(total)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Grand total */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 120px 120px 130px',
                    padding: '12px 20px', background: 'rgba(170,180,200,0.1)',
                    borderTop: '1px solid rgba(170,180,200,0.3)',
                  }}>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#aab4c8', gridColumn: '1/5' }}>TOTAL OPENING STOCK</span>
                    <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#aab4c8', textAlign: 'right' }}>{php(openingStock)}</span>
                  </div>
                </div>
              );
            })()}

            {/* ── STOCK SUMMARY ── */}
            {stockSummary.length > 0 && (() => {
              const COL = '110px 1fr 110px 100px 100px 120px 80px 130px';
              const byCat = (cat: string) => stockSummary.filter(r => r.category === cat);
              const fmtQty = (r: StockRow, qty: number) =>
                qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places });
              const totalClosingPhp = stockSummary.reduce((s, r) => s + (r.stocks_left_php ?? 0), 0);
              return (
                <div className="print-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Stock Summary</div>
                    <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      Carry-in + bought − sold = stocks left · replaces STOCKSLEFT sheet
                    </div>
                  </div>
                  <div className="print-thead" style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  }}>
                    <span>CURRENCY</span><span>NAME</span>
                    <span style={{ textAlign: 'right' }}>CARRY-IN</span>
                    <span style={{ textAlign: 'right' }}>+ BOUGHT</span>
                    <span style={{ textAlign: 'right' }}>− SOLD</span>
                    <span style={{ textAlign: 'right' }}>STOCKS LEFT</span>
                    <span style={{ textAlign: 'right' }}>RATE</span>
                    <span style={{ textAlign: 'right' }}>VALUE PHP</span>
                  </div>
                  {categories.map(cat => {
                    const rows = byCat(cat);
                    if (!rows.length) return null;
                    const catPhp = rows.reduce((s, r) => s + (r.stocks_left_php ?? 0), 0);
                    return (
                      <div key={cat}>
                        <div style={{ padding: '7px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em' }}>
                          {CATEGORY_LABEL[cat] ?? cat}
                        </div>
                        {rows.map((r, i) => (
                          <div key={r.code} style={{
                            display: 'grid', gridTemplateColumns: COL,
                            padding: '9px 20px', borderBottom: '1px solid var(--border)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                            alignItems: 'center',
                          }}>
                            <span style={{ ...M, fontSize: 13, fontWeight: 700, color: '#e2e6f0' }}>{r.flag} {r.code}</span>
                            <span className="print-muted" style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{r.name}</span>
                            <span style={{ ...M, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                              {r.carry_in_qty > 0 ? fmtQty(r, r.carry_in_qty) : '—'}
                            </span>
                            <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>
                              {r.buy_qty > 0 ? fmtQty(r, r.buy_qty) : '—'}
                            </span>
                            <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>
                              {r.sell_qty > 0 ? fmtQty(r, r.sell_qty) : '—'}
                            </span>
                            <span style={{ ...M, fontSize: 12, fontWeight: 700, color: '#e2e6f0', textAlign: 'right' }}>
                              {fmtQty(r, r.stocks_left_qty)}
                            </span>
                            <span style={{ ...M, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                              {r.rate > 0 ? r.rate : '—'}
                            </span>
                            <span style={{ ...M, fontSize: 11, fontWeight: 600, color: '#aab4c8', textAlign: 'right' }}>
                              {r.stocks_left_php !== null ? php(r.stocks_left_php) : '—'}
                            </span>
                          </div>
                        ))}
                        <div style={{
                          display: 'grid', gridTemplateColumns: COL,
                          padding: '8px 20px', borderBottom: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.05)',
                        }}>
                          <span style={{ ...M, fontSize: 10, color: 'var(--muted)', gridColumn: '1/8' }}>{CATEGORY_LABEL[cat]} subtotal</span>
                          <span style={{ ...M, fontSize: 11, fontWeight: 700, color: '#aab4c8', textAlign: 'right' }}>{php(catPhp)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '12px 20px', background: 'rgba(170,180,200,0.08)',
                    borderTop: '1px solid rgba(170,180,200,0.3)',
                  }}>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#aab4c8', gridColumn: '1/8' }}>TOTAL CLOSING STOCK (EST.)</span>
                    <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#aab4c8', textAlign: 'right' }}>{php(totalClosingPhp)}</span>
                  </div>
                </div>
              );
            })()}

            {/* ── BY CURRENCY (replaces 6 books) ── */}
            <div className="print-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Currency Breakdown</div>
                <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  Replaces BUY × MAIN/2ND/OTHERS and SELL × MAIN/2ND/OTHERS books
                </div>
              </div>

              {/* Column headers */}
              <div className="print-thead" style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
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
                      borderBottom: '1px solid var(--border)',
                      ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em',
                    }}>
                      {CATEGORY_LABEL[cat] ?? cat}
                    </div>

                    {rows.map((r, i) => (
                      <div key={r.code} style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                        padding: '9px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                        alignItems: 'center',
                      }}>
                        <span style={{ ...M, fontSize: 13, color: '#e2e6f0', fontWeight: 700 }}>
                          {r.flag} {r.code}
                        </span>
                        <span className="print-muted" style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{r.name}</span>
                        <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{r.buy_count || '—'}</span>
                        <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>
                          {r.buy_qty > 0 ? r.buy_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>
                          {r.buy_php > 0 ? php(r.buy_php) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{r.sell_count || '—'}</span>
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>
                          {r.sell_qty > 0 ? r.sell_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>
                          {r.sell_php > 0 ? php(r.sell_php) : '—'}
                        </span>
                        <span style={{ ...M, fontSize: 11, color: r.than > 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right' }}>
                          {r.than > 0 ? php(r.than) : '—'}
                        </span>
                      </div>
                    ))}

                    {/* Category subtotal */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr 80px 90px 110px 80px 90px 110px 100px',
                      padding: '8px 20px', borderBottom: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.05)',
                    }}>
                      <span style={{ ...M, fontSize: 10, color: 'var(--muted)', gridColumn: '1/3' }}>
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
            {(() => {
              const showComm = report.by_cashier.some(r => r.commission !== 0);
              const cols = showComm
                ? '160px 80px 130px 80px 130px 130px 110px'
                : '160px 80px 130px 80px 130px 130px';
              return (
                <div className="print-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Per-Cashier Summary</div>
                    <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Replaces the CASHIER sheet</div>
                  </div>
                  <div className="print-thead" style={{
                    display: 'grid', gridTemplateColumns: cols,
                    padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  }}>
                    <span>CASHIER</span>
                    <span style={{ textAlign: 'right' }}>BUY TXN</span>
                    <span style={{ textAlign: 'right' }}>BOUGHT (PHP)</span>
                    <span style={{ textAlign: 'right' }}>SELL TXN</span>
                    <span style={{ textAlign: 'right' }}>SOLD (PHP)</span>
                    <span style={{ textAlign: 'right' }}>THAN</span>
                    {showComm && <span style={{ textAlign: 'right' }}>COMM</span>}
                  </div>
                  {report.by_cashier.map((r, i) => (
                    <div key={r.cashier} style={{
                      display: 'grid',
                      gridTemplateColumns: cols,
                      padding: '10px 20px', borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      alignItems: 'center',
                    }}>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0', fontWeight: 700 }}>{r.cashier}</span>
                      <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{r.buy_count}</span>
                      <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{php(r.buy_php)}</span>
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{r.sell_count}</span>
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{php(r.sell_php)}</span>
                      <span style={{ ...M, fontSize: 11, color: r.than > 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right' }}>
                        {r.than > 0 ? php(r.than) : '—'}
                      </span>
                      {showComm && (
                        <span style={{ ...M, fontSize: 11, color: r.commission !== 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right', fontWeight: r.commission !== 0 ? 700 : 400 }}>
                          {r.commission !== 0 ? (r.commission > 0 ? '+' : '') + php(r.commission) : '—'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── FULL TRANSACTION LOG ── */}
            <div className="print-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Transaction Log</div>
                <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  All {report.total_transactions} transactions for the day
                </div>
              </div>
              <div className="print-thead" style={{
                display: 'grid', gridTemplateColumns: '110px 60px 50px 46px 60px 80px 90px 90px 80px 80px 1fr',
                padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
              }}>
                <span>RECEIPT</span><span>TIME</span><span>TYPE</span><span>SRC</span>
                <span>CCY</span><span style={{ textAlign: 'right' }}>FOREIGN</span>
                <span style={{ textAlign: 'right' }}>RATE</span>
                <span style={{ textAlign: 'right' }}>PHP</span>
                <span style={{ textAlign: 'right' }}>THAN</span>
                <span>CASHIER</span><span>CUST</span>
              </div>
              {report.transactions.map((t, i) => (
                <div key={t.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 60px 50px 46px 60px 80px 90px 90px 80px 80px 1fr',
                  padding: '8px 20px', borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                  alignItems: 'center',
                }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.id}</span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                  <span style={{ ...M, fontSize: 11, fontWeight: 700, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623' }}>{t.type}</span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.source === 'RIDER' ? 'RIDER' : 'CTR'}</span>
                  <span style={{ ...M, fontSize: 12, color: '#e2e6f0', fontWeight: 700 }}>{t.currency}</span>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0', textAlign: 'right' }}>{fmtFxScreen(t.foreign_amt, t.currency)}</span>
                  <span style={{ ...M, fontSize: 11, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623', textAlign: 'right' }}>{t.rate}</span>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0', textAlign: 'right' }}>{php(t.php_amt)}</span>
                  <span style={{ ...M, fontSize: 11, color: t.than > 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right' }}>
                    {t.than > 0 ? php(t.than) : '—'}
                  </span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.cashier}
                  </span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.customer ?? '—'}
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
