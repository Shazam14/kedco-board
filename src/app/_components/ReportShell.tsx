'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
  // Accrual report: SELL PHP / THAN above are inclusive of PENDING. These
  // fields surface the PENDING piece separately so we can show a badge.
  sell_php_pending?: number;
  than_pending?: number;
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
  closing_qty: number; closing_rate: number; closing_php: number;
}
interface CashierRow {
  cashier: string;
  buy_count: number; buy_php: number;
  sell_count: number; sell_php: number;
  than: number;
  commission: number;
}
interface PaymentSliceRow {
  id: string;
  method: string;
  amount_php: number;
  status: 'RECEIVED' | 'PENDING';
  reference_no?: string | null;
}
interface TxnRow {
  id: string; time: string; type: string; source: string;
  currency: string; foreign_amt: number; rate: number;
  php_amt: number; than: number; cashier: string; customer: string;
  payment_status?: 'RECEIVED' | 'PENDING';
  payments?: PaymentSliceRow[];
}
interface PaymentMethodRow {
  method: string;
  buy_count: number; buy_php: number;
  sell_count: number;
  sell_php: number;            // accrual (received + pending)
  sell_php_received: number;
  sell_php_pending: number;
}
interface SafeMovementRow {
  id: string;
  amount_php: number;          // signed: + deposit, − withdrawal
  reason: string;
  note?: string | null;
  actor_username: string;
  created_at: string;
}
interface SafeBlock {
  movements: SafeMovementRow[];
  today_net: number;
}
interface PesoBlock {
  opening_php: number | null;
  closing_php: number | null;
  bale_php?: number;
  vault_returns_php?: number;
  cheques_cleared_php?: number;
  expenses_php?: number;
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
  // Accrual: total_sold_php / total_than above include PENDING. These split
  // out the PENDING piece for the receivables badge.
  total_sold_php_pending?: number;
  total_than_pending?: number;
  pending_count?: number;
  opening_positions?: PositionRow[];
  stock_summary?: StockRow[];
  total_closing_stock_php?: number;
  by_currency: CurrencyRow[];
  by_cashier: CashierRow[];
  by_payment_method?: PaymentMethodRow[];
  safe?: SafeBlock;
  peso?: PesoBlock;
  transactions: TxnRow[];
}


function printReport(report: Report, hideThan = false) {
  const php = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dpMap: Record<string, number> = Object.fromEntries(report.by_currency.map(r => [r.code, r.decimal_places]));
  const fmtFx = (amt: number, code: string) => { const dp = dpMap[code] ?? 2; return amt.toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp }); };
  const dateLabel = new Date(report.date + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();

  const CATEGORY_LABEL: Record<string, string> = { MAIN: 'Main Currencies', '2ND': '2nd Currencies', OTHERS: 'Others' };
  const categories = ['MAIN', '2ND', 'OTHERS'];

  const pendingBadge = (n: number) =>
    n > 0 ? `<div style="font-size:9px;color:#c47000;font-weight:700;margin-top:2px">⏳ ${php(n)}</div>` : '';

  const currencyRows = categories.map(cat => {
    const rows = report.by_currency.filter(r => r.category === cat);
    if (!rows.length) return '';
    const tot = {
      buy_count:  rows.reduce((s, r) => s + r.buy_count,  0),
      buy_php:    rows.reduce((s, r) => s + r.buy_php,    0),
      sell_count: rows.reduce((s, r) => s + r.sell_count, 0),
      sell_php:   rows.reduce((s, r) => s + r.sell_php,   0),
      than:       rows.reduce((s, r) => s + r.than,       0),
      sell_php_pending: rows.reduce((s, r) => s + (r.sell_php_pending ?? 0), 0),
    };
    return `
      <tr style="background:#f0f0f0"><td colspan="8" style="padding:6px 8px;font-weight:700;font-size:11px;letter-spacing:0.1em">${CATEGORY_LABEL[cat] ?? cat}</td></tr>
      ${rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
          <td style="padding:7px 8px;font-weight:700">${r.flag} ${r.code}</td>
          <td style="color:#555">${r.name}</td>
          <td style="text-align:right;color:#2255cc">${r.buy_count || '—'}</td>
          <td style="text-align:right;color:#2255cc">${r.buy_qty > 0 ? r.buy_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
          <td style="text-align:right;color:#2255cc;font-weight:600">${r.buy_php > 0 ? php(r.buy_php) : '—'}</td>
          <td style="text-align:right;color:#c47000">${r.sell_count || '—'}</td>
          <td style="text-align:right;color:#c47000">${r.sell_qty > 0 ? r.sell_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
          <td style="text-align:right;color:#c47000;font-weight:600">${r.sell_php > 0 ? php(r.sell_php) : '—'}${pendingBadge(r.sell_php_pending ?? 0)}</td>
        </tr>
      `).join('')}
      <tr style="background:#e8e8e8;font-weight:700">
        <td colspan="2" style="padding:6px 8px;font-size:11px">${CATEGORY_LABEL[cat]} subtotal</td>
        <td style="text-align:right;color:#2255cc">${tot.buy_count}</td>
        <td></td>
        <td style="text-align:right;color:#2255cc">${php(tot.buy_php)}</td>
        <td style="text-align:right;color:#c47000">${tot.sell_count}</td>
        <td></td>
        <td style="text-align:right;color:#c47000">${php(tot.sell_php)}${pendingBadge(tot.sell_php_pending)}</td>
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
      ${hasComm ? `<td style="text-align:right;color:${r.commission !== 0 ? '#007a55' : '#999'};font-weight:700">${r.commission !== 0 ? (r.commission > 0 ? '+' : '') + php(r.commission) : '—'}</td>` : ''}
    </tr>`).join('');

  const txnRows = report.transactions.map((t, i) => {
    const pending = t.payment_status === 'PENDING';
    const slices = t.payments ?? [];
    const isMulti = slices.length > 1;
    const bg = pending ? '#fff7e6' : (i % 2 === 0 ? '#fff' : '#fafafa');
    const main = `
    <tr style="background:${bg}">
      <td style="padding:6px 8px;font-size:10px;color:${pending ? '#c47000' : '#555'};font-weight:${pending ? 700 : 400}">${pending ? '⏳ ' : ''}${t.id}${isMulti ? `<span style="margin-left:6px;font-size:8px;color:#888;font-weight:700">SPLIT +${slices.length - 1}</span>` : ''}</td>
      <td style="color:#555">${t.time}</td>
      <td style="font-weight:700;color:${t.type === 'BUY' ? '#2255cc' : '#c47000'}">${t.type}</td>
      <td style="color:#555">${t.source === 'RIDER' ? 'RIDER' : 'CTR'}</td>
      <td style="font-weight:700">${t.currency}</td>
      <td style="text-align:right">${fmtFx(t.foreign_amt, t.currency)}</td>
      <td style="text-align:right;color:${t.type === 'BUY' ? '#2255cc' : '#c47000'}">${t.rate}</td>
      <td style="text-align:right;font-weight:600">${php(t.php_amt)}</td>
      <td style="font-size:10px;color:#555">${t.cashier}</td>
      <td style="font-size:10px;color:${pending ? '#c47000' : '#555'}">${pending ? 'PENDING — ' : ''}${t.customer || '—'}</td>
    </tr>`;
    const sliceRows = isMulti ? slices.map(s => `
    <tr style="background:${bg}">
      <td colspan="2" style="padding:3px 8px 3px 24px;font-size:9px;color:#888">└ ${s.method}</td>
      <td colspan="6" style="padding:3px 8px;font-size:10px;color:${s.status === 'PENDING' ? '#c47000' : '#555'}">
        <span style="font-weight:700;color:#000">${php(s.amount_php)}</span>
        <span style="margin-left:12px;font-weight:${s.status === 'PENDING' ? 700 : 400}">${s.status === 'PENDING' ? '⏳ PENDING' : 'RECEIVED'}</span>
        ${s.reference_no ? `<span style="margin-left:12px;color:#888">ref: ${s.reference_no}</span>` : ''}
      </td>
      <td colspan="2"></td>
    </tr>`).join('') : '';
    return main + sliceRows;
  }).join('');

  const methodRows = (report.by_payment_method ?? []).map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:7px 8px;font-weight:700">${r.method}</td>
      <td style="text-align:right;color:#2255cc">${r.buy_count || '—'}</td>
      <td style="text-align:right;color:#2255cc;font-weight:600">${r.buy_php > 0 ? php(r.buy_php) : '—'}</td>
      <td style="text-align:right;color:#c47000">${r.sell_count || '—'}</td>
      <td style="text-align:right;color:#c47000;font-weight:600">${r.sell_php > 0 ? php(r.sell_php) : '—'}</td>
      <td style="text-align:right;color:${r.sell_php_pending > 0 ? '#c47000' : '#999'};font-weight:${r.sell_php_pending > 0 ? 700 : 400}">${r.sell_php_pending > 0 ? php(r.sell_php_pending) : '—'}</td>
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
      <div class="summary-box"><div class="label">TOTAL SOLD</div><div class="value" style="color:#c47000">${php(report.total_sold_php)}</div>${(report.total_sold_php_pending ?? 0) > 0 ? `<div style="font-size:10px;color:#c47000;font-weight:700;margin-top:6px">⏳ pending: ${php(report.total_sold_php_pending!)}</div>` : ''}</div>
      ${hideThan ? '' : `<div class="summary-box"><div class="label">TOTAL THAN</div><div class="value" style="color:#007a55">${php(report.total_than)}</div>${(report.total_than_pending ?? 0) > 0 ? `<div style="font-size:10px;color:#c47000;font-weight:700;margin-top:6px">⏳ pending: ${php(report.total_than_pending!)}</div>` : ''}</div>`}
      ${hasComm ? `<div class="summary-box"><div class="label">TOTAL COMM</div><div class="value" style="color:#007a55">${report.total_commission > 0 ? '+' : ''}${php(report.total_commission)}</div></div>` : ''}
      <div class="summary-box"><div class="label">OPENING PESO</div><div class="value" style="color:#555">${report.peso?.opening_php != null ? php(report.peso.opening_php) : '—'}</div></div>
      <div class="summary-box"><div class="label">CLOSING PESO</div><div class="value" style="color:#007a55">${report.peso?.closing_php != null ? php(report.peso.closing_php) : '—'}</div></div>
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
    ${report.peso && report.peso.opening_php !== null ? `
    <div class="flow" style="font-size:11px;flex-wrap:wrap">
      <div class="flow-item"><div class="fl">OPENING PESO</div><div class="fv" style="color:#555">${php(report.peso.opening_php)}</div></div>
      <div class="flow-op">+</div>
      <div class="flow-item"><div class="fl">SOLD</div><div class="fv" style="color:#c47000">${php(report.total_sold_php)}</div></div>
      <div class="flow-op">−</div>
      <div class="flow-item"><div class="fl">BOUGHT</div><div class="fv" style="color:#2255cc">${php(report.total_bought_php)}</div></div>
      <div class="flow-op">+</div>
      <div class="flow-item"><div class="fl">BALE</div><div class="fv" style="color:#555">${php(report.peso.bale_php ?? 0)}</div></div>
      <div class="flow-op">−</div>
      <div class="flow-item"><div class="fl">RETURNS</div><div class="fv" style="color:#555">${php(report.peso.vault_returns_php ?? 0)}</div></div>
      <div class="flow-op">+</div>
      <div class="flow-item"><div class="fl">CHEQUES</div><div class="fv" style="color:#555">${php(report.peso.cheques_cleared_php ?? 0)}</div></div>
      <div class="flow-op">−</div>
      <div class="flow-item"><div class="fl">EXPENSES</div><div class="fv" style="color:#555">${php(report.peso.expenses_php ?? 0)}</div></div>
      <div class="flow-op">=</div>
      <div class="flow-item"><div class="fl">CLOSING PESO</div><div class="fv" style="color:#007a55">${report.peso.closing_php != null ? php(report.peso.closing_php) : '—'}</div></div>
    </div>` : ''}

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
        const stockRows = report.stock_summary ?? [];
        return categories.map(cat => {
          const rows = stockRows.filter(r => r.category === cat);
          if (!rows.length) return '';
          const catLeftPhp = rows.reduce((s, r) => s + r.closing_php, 0);
          return `
            <tr style="background:#f0f0f0"><td colspan="8" style="padding:6px 8px;font-weight:700;font-size:11px;letter-spacing:0.1em">${CATEGORY_LABEL[cat] ?? cat}</td></tr>
            ${rows.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                <td style="padding:7px 8px;font-weight:700">${r.flag} ${r.code}</td>
                <td style="color:#555">${r.name}</td>
                <td style="text-align:right;color:#555">${r.carry_in_qty > 0 ? r.carry_in_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
                <td style="text-align:right;color:#2255cc">${r.buy_qty > 0 ? r.buy_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
                <td style="text-align:right;color:#c47000">${r.sell_qty > 0 ? r.sell_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places }) : '—'}</td>
                <td style="text-align:right;font-weight:700">${r.closing_qty.toLocaleString('en-PH', { minimumFractionDigits: r.decimal_places, maximumFractionDigits: r.decimal_places })}</td>
                <td style="text-align:right;color:#555">${r.closing_rate > 0 ? r.closing_rate : '—'}</td>
                <td style="text-align:right;font-weight:600">${r.closing_php > 0 ? php(r.closing_php) : '—'}</td>
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
        ${th('CURRENCY')}${th('NAME')}${th('BUY #','right')}${th('BUY QTY','right')}${th('BUY PHP','right')}${th('SELL #','right')}${th('SELL QTY','right')}${th('SELL PHP','right')}
      </tr></thead>
      <tbody>${currencyRows}</tbody>
      <tfoot><tr style="background:#111;color:#fff;font-weight:900">
        <td colspan="2" style="padding:8px;font-size:12px">GRAND TOTAL</td>
        <td></td><td></td>
        <td style="text-align:right;padding:8px;font-size:13px">${php(report.total_bought_php)}</td>
        <td></td><td></td>
        <td style="text-align:right;padding:8px;font-size:13px">${php(report.total_sold_php)}${(report.total_sold_php_pending ?? 0) > 0 ? `<div style="font-size:9px;color:#ffb061;font-weight:700;margin-top:2px">⏳ ${php(report.total_sold_php_pending!)}</div>` : ''}</td>
      </tr></tfoot>
    </table>

    <h2>PER-CASHIER SUMMARY</h2>
    <table>
      <thead><tr>${th('CASHIER')}${th('BUY TXN','right')}${th('BOUGHT (PHP)','right')}${th('SELL TXN','right')}${th('SOLD (PHP)','right')}${hasComm ? th('COMM','right') : ''}</tr></thead>
      <tbody>${cashierRows}</tbody>
    </table>

    ${methodRows ? `
    <h2>BY PAYMENT METHOD</h2>
    <table>
      <thead><tr>${th('METHOD')}${th('BUY #','right')}${th('BUY PHP','right')}${th('SELL #','right')}${th('SELL PHP','right')}${th('⏳ PENDING','right')}</tr></thead>
      <tbody>${methodRows}</tbody>
    </table>` : ''}

    <h2>TRANSACTION LOG</h2>
    <table>
      <thead><tr>${th('RECEIPT')}${th('TIME')}${th('TYPE')}${th('SRC')}${th('CCY')}${th('FOREIGN','right')}${th('RATE','right')}${th('PHP','right')}${th('CASHIER')}${th('CUST')}</tr></thead>
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
  hideThan = false,
  role = 'admin',
  phpCapital = null,
}: {
  report: Report | null;
  selectedDate: string;
  hideThan?: boolean;
  role?: string;
  phpCapital?: number | null;
}) {
  const isTreasurer = role === 'supervisor';
  const router  = useRouter();
  const [date, setDate] = useState(selectedDate || report?.date || '');
  const [isPending, startTransition] = useTransition();

  function goToDate(d: string) {
    startTransition(() => {
      router.push(`/admin/report${d ? `?date=${d}` : ''}`);
    });
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
    sell_php_pending: rows.reduce((s, r) => s + (r.sell_php_pending ?? 0), 0),
    than_pending:     rows.reduce((s, r) => s + (r.than_pending ?? 0),     0),
  });

  const openingStock = report?.total_opening_stock_php ?? 0;
  const openingPositions = report?.opening_positions ?? [];
  const stockSummary = report?.stock_summary ?? [];

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
              onChange={e => {
                setDate(e.target.value);
                if (e.target.value.length === 10) goToDate(e.target.value);
              }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 12px', color: isPending ? 'var(--muted)' : '#e2e6f0', ...M, fontSize: 12, outline: 'none',
                opacity: isPending ? 0.7 : 1,
              }}
            />
            <button
              onClick={() => report && printReport(report, hideThan)}
              style={{
                padding: '6px 18px', borderRadius: 6,
                border: '1px solid rgba(0,212,170,0.35)',
                background: 'rgba(0,212,170,0.1)', color: '#00d4aa',
                ...M, fontSize: 11, cursor: 'pointer',
              }}
            >
              🖨 Print / Save PDF
            </button>
            <a href={isTreasurer ? '/supervisor' : '/admin'} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', ...M, fontSize: 11, textDecoration: 'none' }}>
              {isTreasurer ? '← HUB' : '← Admin'}
            </a>
          </div>
        </nav>

        {/* ── LOADING OVERLAY ── */}
        {isPending && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '20px 32px',
              display: 'flex', alignItems: 'center', gap: 12,
              ...M, fontSize: 13, color: '#e2e6f0',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </path>
              </svg>
              Loading report…
            </div>
          </div>
        )}

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
              {phpCapital !== null && (
                <div data-testid="php-capital-chip" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  marginTop: 12, padding: '6px 14px', borderRadius: 999,
                  background: 'rgba(0,212,170,0.10)', border: '1px solid rgba(0,212,170,0.35)',
                }}>
                  <span style={{ ...M, fontSize: 9, color: '#00d4aa', letterSpacing: '0.18em', fontWeight: 700 }}>PHP CAPITAL</span>
                  <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#00d4aa' }}>{php(phpCapital)}</span>
                </div>
              )}
            </div>

            {/* ── SUMMARY BOXES ── */}
            {(() => {
              const baseCount = (report.total_commission !== 0 ? 5 : 4) - (hideThan ? 1 : 0);
              const summaryCount = baseCount + 2; // + OPENING PESO + CLOSING PESO
              const soldPending = report.total_sold_php_pending ?? 0;
              const thanPending = report.total_than_pending ?? 0;
              const openPeso  = report.peso?.opening_php ?? null;
              const closePeso = report.peso?.closing_php ?? null;
              const boxes = [
                { label: 'OPENING STOCK', value: php(openingStock), color: '#aab4c8' },
                { label: 'TOTAL BOUGHT',  value: php(report.total_bought_php),        color: '#5b8cff' },
                { label: 'TOTAL SOLD',    value: php(report.total_sold_php),           color: '#f5a623', pending: soldPending },
                ...(hideThan ? [] : [{ label: 'TOTAL THAN', value: php(report.total_than), color: '#00d4aa', pending: thanPending }]),
                ...(report.total_commission !== 0 ? [{ label: 'TOTAL COMM', value: (report.total_commission > 0 ? '+' : '') + php(report.total_commission), color: '#00d4aa' }] : []),
                { label: 'OPENING PESO', value: openPeso  !== null ? php(openPeso)  : '—', color: '#aab4c8', testid: 'peso-opening' },
                { label: 'CLOSING PESO', value: closePeso !== null ? php(closePeso) : '—', color: '#00d4aa', testid: 'peso-closing' },
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${summaryCount},1fr)`, gap: 16 }}>
                  {boxes.map(s => (
                    <div key={s.label} className="print-card" data-testid={('testid' in s ? s.testid : undefined)} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '18px 24px',
                    }}>
                      <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 8 }}>{s.label}</div>
                      <div className="print-accent" style={{ ...Y, fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      {('pending' in s) && (s.pending ?? 0) > 0 && (
                        <div style={{ ...M, fontSize: 10, color: '#c47000', fontWeight: 700, marginTop: 6, letterSpacing: '0.04em' }}>
                          ⏳ pending: {php(s.pending!)}
                        </div>
                      )}
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

            {/* ── PESO MOVEMENT (treasurer drawer breakdown) ── */}
            {report.peso && report.peso.opening_php !== null && (() => {
              const p = report.peso!;
              const open    = p.opening_php ?? 0;
              const close   = p.closing_php;
              const bale    = p.bale_php ?? 0;
              const ret     = p.vault_returns_php ?? 0;
              const cheq    = p.cheques_cleared_php ?? 0;
              const exp     = p.expenses_php ?? 0;
              const sold    = report.total_sold_php;
              const bought  = report.total_bought_php;
              const item = (label: string, value: string, color: string) => (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>{label}</div>
                  <div style={{ ...Y, fontSize: 14, fontWeight: 800, color }}>{value}</div>
                </div>
              );
              const op = (sym: string) => (
                <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: 'var(--muted)', padding: '0 2px' }}>{sym}</div>
              );
              return (
                <div data-testid="peso-flow" className="print-card" style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  {item('OPENING PESO', php(open), '#aab4c8')}
                  {op('+')} {item('SOLD', php(sold), '#f5a623')}
                  {op('−')} {item('BOUGHT', php(bought), '#5b8cff')}
                  {op('+')} {item('BALE', php(bale), '#aab4c8')}
                  {op('−')} {item('RETURNS', php(ret), '#aab4c8')}
                  {op('+')} {item('CHEQUES', php(cheq), '#aab4c8')}
                  {op('−')} {item('EXPENSES', php(exp), '#aab4c8')}
                  {op('=')}
                  {item('CLOSING PESO', close !== null ? php(close) : '—', '#00d4aa')}
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
              const totalClosingPhp = report?.total_closing_stock_php ?? stockSummary.reduce((s, r) => s + r.closing_php, 0);
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
                    const catPhp = rows.reduce((s, r) => s + r.closing_php, 0);
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
                              {fmtQty(r, r.closing_qty)}
                            </span>
                            <span style={{ ...M, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                              {r.closing_rate > 0 ? r.closing_rate : '—'}
                            </span>
                            <span style={{ ...M, fontSize: 11, fontWeight: 600, color: '#aab4c8', textAlign: 'right' }}>
                              {r.closing_php > 0 ? php(r.closing_php) : '—'}
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
                display: 'grid', gridTemplateColumns: (hideThan ? '110px 1fr 80px 90px 110px 80px 90px 110px' : '110px 1fr 80px 90px 110px 80px 90px 110px 100px'),
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
                {!hideThan && <span style={{ textAlign: 'right' }}>THAN</span>}
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

                    {rows.map((r, i) => {
                      const sellPending = r.sell_php_pending ?? 0;
                      const thanPending = r.than_pending ?? 0;
                      return (
                      <div key={r.code} style={{
                        display: 'grid',
                        gridTemplateColumns: (hideThan ? '110px 1fr 80px 90px 110px 80px 90px 110px' : '110px 1fr 80px 90px 110px 80px 90px 110px 100px'),
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
                        <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span>{r.sell_php > 0 ? php(r.sell_php) : '—'}</span>
                          {sellPending > 0 && (
                            <span style={{ fontSize: 9, color: '#c47000', fontWeight: 700 }}>⏳ {php(sellPending)}</span>
                          )}
                        </span>
                        {!hideThan && (
                          <span style={{ ...M, fontSize: 11, color: r.than > 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span>{r.than > 0 ? php(r.than) : '—'}</span>
                            {thanPending > 0 && (
                              <span style={{ fontSize: 9, color: '#c47000', fontWeight: 700 }}>⏳ {php(thanPending)}</span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                    })}

                    {/* Category subtotal */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: (hideThan ? '110px 1fr 80px 90px 110px 80px 90px 110px' : '110px 1fr 80px 90px 110px 80px 90px 110px 100px'),
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
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span>{php(tot.sell_php)}</span>
                        {tot.sell_php_pending > 0 && (
                          <span style={{ fontSize: 9, color: '#c47000', fontWeight: 700 }}>⏳ {php(tot.sell_php_pending)}</span>
                        )}
                      </span>
                      {!hideThan && (
                        <span style={{ ...M, fontSize: 11, color: '#00d4aa', textAlign: 'right', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span>{tot.than > 0 ? php(tot.than) : '—'}</span>
                          {tot.than_pending > 0 && (
                            <span style={{ fontSize: 9, color: '#c47000', fontWeight: 700 }}>⏳ {php(tot.than_pending)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: (hideThan ? '110px 1fr 80px 90px 110px 80px 90px 110px' : '110px 1fr 80px 90px 110px 80px 90px 110px 100px'),
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
                <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#f5a623', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span>{php(report.total_sold_php)}</span>
                  {(report.total_sold_php_pending ?? 0) > 0 && (
                    <span style={{ ...M, fontSize: 9, color: '#c47000', fontWeight: 700 }}>⏳ {php(report.total_sold_php_pending!)}</span>
                  )}
                </span>
                {!hideThan && (
                  <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#00d4aa', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span>{php(report.total_than)}</span>
                    {(report.total_than_pending ?? 0) > 0 && (
                      <span style={{ ...M, fontSize: 9, color: '#c47000', fontWeight: 700 }}>⏳ {php(report.total_than_pending!)}</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* ── BY CASHIER (replaces CASHIER sheet) ── */}
            {(() => {
              const showComm = report.by_cashier.some(r => r.commission !== 0);
              const cols = hideThan
                ? (showComm ? '160px 80px 130px 80px 130px 110px' : '160px 80px 130px 80px 130px')
                : (showComm ? '160px 80px 130px 80px 130px 130px 110px' : '160px 80px 130px 80px 130px 130px');
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
                    {!hideThan && <span style={{ textAlign: 'right' }}>THAN</span>}
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
                      {!hideThan && (
                        <span style={{ ...M, fontSize: 11, color: r.than > 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right' }}>
                          {r.than > 0 ? php(r.than) : '—'}
                        </span>
                      )}
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

            {/* ── BY PAYMENT METHOD (slice-level aggregate, Phase 4) ── */}
            {(report.by_payment_method ?? []).length > 0 && (() => {
              const rows = report.by_payment_method!;
              const totals = {
                buy_count: rows.reduce((s, r) => s + r.buy_count, 0),
                buy_php:   rows.reduce((s, r) => s + r.buy_php,   0),
                sell_count:        rows.reduce((s, r) => s + r.sell_count, 0),
                sell_php:          rows.reduce((s, r) => s + r.sell_php,   0),
                sell_php_pending:  rows.reduce((s, r) => s + r.sell_php_pending, 0),
              };
              const COL = '160px 80px 130px 80px 130px 130px';
              return (
                <div data-testid="report-by-method" className="print-card" style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>By Payment Method</div>
                    <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      Slice-level money flow — counts and PHP totals per method, split by direction
                    </div>
                  </div>
                  <div className="print-thead" style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  }}>
                    <span>METHOD</span>
                    <span style={{ textAlign: 'right' }}>BUY #</span>
                    <span style={{ textAlign: 'right' }}>BUY PHP</span>
                    <span style={{ textAlign: 'right' }}>SELL #</span>
                    <span style={{ textAlign: 'right' }}>SELL PHP</span>
                    <span style={{ textAlign: 'right' }}>⏳ PENDING</span>
                  </div>
                  {rows.map((r, i) => (
                    <div key={r.method} data-testid={`method-row-${r.method}`} style={{
                      display: 'grid', gridTemplateColumns: COL,
                      padding: '10px 20px', borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      alignItems: 'center',
                    }}>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0', fontWeight: 700 }}>{r.method}</span>
                      <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>{r.buy_count || '—'}</span>
                      <span style={{ ...M, fontSize: 11, color: '#5b8cff', textAlign: 'right' }}>
                        {r.buy_php > 0 ? php(r.buy_php) : '—'}
                      </span>
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>{r.sell_count || '—'}</span>
                      <span style={{ ...M, fontSize: 11, color: '#f5a623', textAlign: 'right' }}>
                        {r.sell_php > 0 ? php(r.sell_php) : '—'}
                      </span>
                      <span style={{ ...M, fontSize: 11, color: r.sell_php_pending > 0 ? '#c47000' : 'var(--muted)', textAlign: 'right', fontWeight: r.sell_php_pending > 0 ? 700 : 400 }}>
                        {r.sell_php_pending > 0 ? php(r.sell_php_pending) : '—'}
                      </span>
                    </div>
                  ))}
                  <div style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '10px 20px', background: 'rgba(0,212,170,0.07)',
                    borderTop: '1px solid rgba(0,212,170,0.3)',
                  }}>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#00d4aa' }}>TOTAL</span>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#5b8cff', textAlign: 'right' }}>{totals.buy_count}</span>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#5b8cff', textAlign: 'right' }}>{php(totals.buy_php)}</span>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#f5a623', textAlign: 'right' }}>{totals.sell_count}</span>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: '#f5a623', textAlign: 'right' }}>{php(totals.sell_php)}</span>
                    <span style={{ ...Y, fontSize: 12, fontWeight: 800, color: totals.sell_php_pending > 0 ? '#c47000' : 'var(--muted)', textAlign: 'right' }}>
                      {totals.sell_php_pending > 0 ? php(totals.sell_php_pending) : '—'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* ── SAFE / VAULT MOVEMENTS ── */}
            {report.safe && (report.safe.movements.length > 0 || report.safe.today_net !== 0) && (() => {
              const s = report.safe!;
              const COL = '160px 90px 1fr 130px';
              return (
                <div data-testid="report-safe" className="print-card" style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ ...Y, fontSize: 14, fontWeight: 800 }}>Safe / Vault Movements</div>
                      <div className="print-muted" style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        Cash in/out of the shared PHP vault
                      </div>
                    </div>
                    <div style={{
                      ...M, fontSize: 13, fontWeight: 800,
                      color: s.today_net > 0 ? '#00d4aa' : s.today_net < 0 ? '#f5a623' : 'var(--muted)',
                    }}>
                      NET {s.today_net > 0 ? '+' : s.today_net < 0 ? '−' : ''}₱{Math.abs(s.today_net).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="print-thead" style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  }}>
                    <span>REASON</span>
                    <span>BY</span>
                    <span>NOTE</span>
                    <span style={{ textAlign: 'right' }}>AMOUNT</span>
                  </div>
                  {s.movements.map((m, i) => (
                    <div key={m.id} data-testid={`safe-row-${m.id}`} style={{
                      display: 'grid', gridTemplateColumns: COL,
                      padding: '10px 20px', borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      alignItems: 'center',
                    }}>
                      <span style={{ ...M, fontSize: 11, color: '#e2e6f0', fontWeight: 700 }}>{m.reason}</span>
                      <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{m.actor_username}</span>
                      <span style={{ ...M, fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.note ?? '—'}</span>
                      <span style={{
                        ...M, fontSize: 11, textAlign: 'right', fontWeight: 700,
                        color: m.amount_php > 0 ? '#00d4aa' : '#f5a623',
                      }}>{m.amount_php > 0 ? '+' : m.amount_php < 0 ? '−' : ''}₱{Math.abs(m.amount_php).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              <div style={{ overflowX: 'auto' }}>
              <div className="print-thead" style={{
                display: 'grid', gridTemplateColumns: (hideThan ? '110px 60px 50px 46px 60px 80px 90px 90px 80px 1fr' : '110px 60px 50px 46px 60px 80px 90px 90px 80px 80px 1fr'),
                minWidth: 786,
                padding: '8px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
              }}>
                <span>RECEIPT</span><span>TIME</span><span>TYPE</span><span>SRC</span>
                <span>CCY</span><span style={{ textAlign: 'right' }}>FOREIGN</span>
                <span style={{ textAlign: 'right' }}>RATE</span>
                <span style={{ textAlign: 'right' }}>PHP</span>
                {!hideThan && <span style={{ textAlign: 'right' }}>THAN</span>}
                <span>CASHIER</span><span>CUST</span>
              </div>
              {report.transactions.map((t, i) => {
                const slices = t.payments ?? [];
                const isMulti = slices.length > 1;
                return (
                <div key={t.id}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: (hideThan ? '110px 60px 50px 46px 60px 80px 90px 90px 80px 1fr' : '110px 60px 50px 46px 60px 80px 90px 90px 80px 80px 1fr'),
                  minWidth: 786,
                  padding: '8px 20px', borderBottom: isMulti ? 'none' : '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                  alignItems: 'center',
                }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                    {t.id}
                    {isMulti && <span data-testid={`split-chip-${t.id}`} style={{ marginLeft: 6, fontSize: 8, color: '#aab4c8', fontWeight: 700, letterSpacing: '0.05em' }}>SPLIT +{slices.length - 1}</span>}
                  </span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                  <span style={{ ...M, fontSize: 11, fontWeight: 700, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623' }}>{t.type}</span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.source === 'RIDER' ? 'RIDER' : 'CTR'}</span>
                  <span style={{ ...M, fontSize: 12, color: '#e2e6f0', fontWeight: 700 }}>{t.currency}</span>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0', textAlign: 'right' }}>{fmtFxScreen(t.foreign_amt, t.currency)}</span>
                  <span style={{ ...M, fontSize: 11, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623', textAlign: 'right' }}>{t.rate}</span>
                  <span style={{ ...M, fontSize: 11, color: '#e2e6f0', textAlign: 'right' }}>{php(t.php_amt)}</span>
                  {!hideThan && (
                    <span style={{ ...M, fontSize: 11, color: t.than > 0 ? '#00d4aa' : 'var(--muted)', textAlign: 'right' }}>
                      {t.than > 0 ? php(t.than) : '—'}
                    </span>
                  )}
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.cashier}
                  </span>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.customer ?? '—'}
                  </span>
                </div>
                {isMulti && slices.map(s => (
                  <div key={s.id} data-testid={`slice-row-${t.id}-${s.method}`} style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr',
                    minWidth: 786,
                    padding: '4px 20px 4px 40px',
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.025)',
                    alignItems: 'center',
                  }}>
                    <span style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                      └ {s.method}
                    </span>
                    <span style={{ ...M, fontSize: 10, color: s.status === 'PENDING' ? '#c47000' : 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#e2e6f0' }}>{php(s.amount_php)}</span>
                      <span style={{ fontWeight: s.status === 'PENDING' ? 700 : 400 }}>{s.status === 'PENDING' ? '⏳ PENDING' : 'RECEIVED'}</span>
                      {s.reference_no && <span>ref: {s.reference_no}</span>}
                    </span>
                  </div>
                ))}
                </div>
                );
              })}
              </div>{/* end overflowX:auto */}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
