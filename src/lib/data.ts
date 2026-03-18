// ─────────────────────────────────────────────
// Kedco FX — Data, Types & Per-Day Avg Logic
// ─────────────────────────────────────────────
//
// KEN'S AVERAGING RULE (per her requirement):
//
//  • Averaging is PER DAY only.
//  • Yesterday's unsold stock enters today at
//    yesterday's closing sell rate → this is the
//    "carry-in" cost basis for today.
//  • Each buy today is blended WITH the carry-in:
//      dailyAvg = (carryQty × carryRate + Σ(buyQty × buyRate))
//                 ÷ (carryQty + Σ buyQty)
//  • THAN per sell = (sellRate − dailyAvg) × unitsSold
//  • At EOD the avg RESETS. Tomorrow's carry-in =
//    today's closing sell rate. Previous days never
//    contaminate today's gain calculation.
//
// RATE PRECISION NOTE:
//  Rates vary wildly across currencies. Storing and
//  computing always use full float precision.
//  Display uses per-currency decimalPlaces so that:
//    VND 0.0022 → shows "0.0022" (not "0.00")
//    KWD 140.00 → shows "140.0000"
//    USD 58.05  → shows "58.0500"
//  Never round rates before computation — only round
//  for display.
//
// ─────────────────────────────────────────────

export interface CarryIn {
  qty: number;       // units carried in from yesterday
  rate: number;      // yesterday's closing sell rate (full precision)
  phpValue: number;  // carryQty × carryRate
}

export interface TodayBuy {
  qty: number;
  rate: number;      // today's buy rate (full precision)
  phpCost: number;   // qty × rate
}

export interface CurrencyPosition {
  code: string;
  name: string;
  flag: string;
  category: 'MAIN' | '2ND' | 'OTHERS';

  // How many decimal places this currency needs for display
  // e.g. VND=4, IDR=4, JPY=4, USD=4, KWD=4
  // Rule: if rate < 1, use 4. If rate < 10, use 4. Always 4 for safety.
  decimalPlaces: number;

  // ── Carry-in from yesterday ──
  carryIn: CarryIn;

  // ── Today's buy lots ──
  todayBuys: TodayBuy[];

  // ── Rate board ──
  todaySellRate: number;     // today's sell rate (full precision)

  // ── Computed by computePosition() ──
  totalQty: number;
  dailyAvgCost: number;      // PER-DAY weighted avg — resets daily
  stockValuePhp: number;     // totalQty × todaySellRate
  todayGainPerUnit: number;  // todaySellRate − dailyAvgCost
  unrealizedPHP: number;     // todayGainPerUnit × totalQty

  riderQty?: number;
}

export interface Transaction {
  id: string;
  time: string;
  type: 'BUY' | 'SELL';
  source: 'COUNTER' | 'RIDER';
  currency: string;
  foreignAmt: number;
  rate: number;
  phpAmt: number;
  than: number;   // (sellRate − dailyAvgCost) × units  |  0 for buys
  cashier: string;
  customer?: string;
}

export interface RiderState {
  name: string;
  status: 'IN_FIELD' | 'RETURNED' | 'OFF';
  dispatchTime: string;
  cashPHP: number;
  transactions: number;
  totalSoldPHP: number;
  totalBoughtPHP: number;
  marginPHP: number;
  positions: { currency: string; qty: number }[];
}

// ─────────────────────────────────────────────
// CORE FUNCTION: compute per-day position
// All arithmetic at full float precision.
// ─────────────────────────────────────────────
export function computePosition(
  carryIn: CarryIn,
  todayBuys: TodayBuy[],
  todaySellRate: number
): {
  totalQty: number;
  dailyAvgCost: number;
  stockValuePhp: number;
  todayGainPerUnit: number;
  unrealizedPHP: number;
} {
  const totalBuyQty  = todayBuys.reduce((s, b) => s + b.qty, 0);
  const totalBuyCost = todayBuys.reduce((s, b) => s + b.phpCost, 0);

  const totalQty  = carryIn.qty + totalBuyQty;
  const totalCost = carryIn.phpValue + totalBuyCost;

  // Per-day weighted average — never carry previous days
  const dailyAvgCost = totalQty > 0 ? totalCost / totalQty : 0;

  const stockValuePhp    = totalQty * todaySellRate;
  const todayGainPerUnit = todaySellRate - dailyAvgCost;
  const unrealizedPHP    = todayGainPerUnit * totalQty;

  return { totalQty, dailyAvgCost, stockValuePhp, todayGainPerUnit, unrealizedPHP };
}

// ─────────────────────────────────────────────
// DISPLAY HELPER — always use this, never
// manually call .toFixed() on a rate
// ─────────────────────────────────────────────
export function fmtRate(rate: number, decimalPlaces: number): string {
  return rate.toFixed(decimalPlaces);
}

// ─────────────────────────────────────────────
// RAW CURRENCY DATA — all 26 currencies
// Rates sourced from published rate board image
// (Core Pacific, March 15 2026) as reference.
// Carry-in rates = yesterday's approx closing.
// ─────────────────────────────────────────────
const RAW_CURRENCIES: Omit<CurrencyPosition,
  'totalQty'|'dailyAvgCost'|'stockValuePhp'|'todayGainPerUnit'|'unrealizedPHP'>[] = [

  // ── MAIN ──────────────────────────────────
  {
    code:'USD', name:'US Dollar', flag:'🇺🇸', category:'MAIN', decimalPlaces:4,
    todaySellRate: 58.0500,
    carryIn:  { qty: 1_200, rate: 57.8000, phpValue: 1_200 * 57.8000 },
    todayBuys:[ { qty: 300, rate: 57.5000, phpCost: 300 * 57.5000 },
                { qty: 350, rate: 57.6000, phpCost: 350 * 57.6000 } ],
    riderQty: 1_200,
  },
  {
    code:'JPY', name:'Japanese Yen', flag:'🇯🇵', category:'MAIN', decimalPlaces:4,
    todaySellRate: 0.3000,
    carryIn:  { qty: 180_000, rate: 0.2950, phpValue: 180_000 * 0.2950 },
    todayBuys:[ { qty: 50_000, rate: 0.2920, phpCost: 50_000 * 0.2920 },
                { qty: 50_000, rate: 0.2930, phpCost: 50_000 * 0.2930 } ],
    riderQty: 50_000,
  },
  {
    code:'KRW', name:'Korean Won', flag:'🇰🇷', category:'MAIN', decimalPlaces:4,
    todaySellRate: 0.0360,
    carryIn:  { qty: 350_000, rate: 0.0355, phpValue: 350_000 * 0.0355 },
    todayBuys:[ { qty: 100_000, rate: 0.0352, phpCost: 100_000 * 0.0352 } ],
  },

  // ── 2ND ───────────────────────────────────
  {
    code:'EUR', name:'Euro', flag:'🇪🇺', category:'2ND', decimalPlaces:4,
    todaySellRate: 55.0000,
    carryIn:  { qty: 170, rate: 54.5000, phpValue: 170 * 54.5000 },
    todayBuys:[ { qty: 150, rate: 54.2000, phpCost: 150 * 54.2000 } ],
  },
  {
    code:'GBP', name:'British Pound', flag:'🇬🇧', category:'2ND', decimalPlaces:4,
    todaySellRate: 63.5000,
    carryIn:  { qty: 120, rate: 63.0000, phpValue: 120 * 63.0000 },
    todayBuys:[ { qty: 60,  rate: 62.8000, phpCost: 60 * 62.8000 } ],
  },
  {
    code:'SGD', name:'Singapore Dollar', flag:'🇸🇬', category:'2ND', decimalPlaces:4,
    todaySellRate: 36.5000,
    carryIn:  { qty: 240, rate: 36.2000, phpValue: 240 * 36.2000 },
    todayBuys:[ { qty: 300, rate: 36.0000, phpCost: 300 * 36.0000 } ],
  },
  {
    code:'AUD', name:'Australian Dollar', flag:'🇦🇺', category:'2ND', decimalPlaces:4,
    todaySellRate: 31.5000,
    carryIn:  { qty: 150, rate: 31.2000, phpValue: 150 * 31.2000 },
    todayBuys:[ { qty: 140, rate: 31.0000, phpCost: 140 * 31.0000 } ],
  },
  {
    code:'HKD', name:'Hong Kong Dollar', flag:'🇭🇰', category:'2ND', decimalPlaces:4,
    todaySellRate: 6.1000,
    carryIn:  { qty: 2_000, rate: 6.0500, phpValue: 2_000 * 6.0500 },
    todayBuys:[ { qty: 1_200, rate: 6.0000, phpCost: 1_200 * 6.0000 } ],
  },
  {
    code:'CNY', name:'Chinese Yuan', flag:'🇨🇳', category:'2ND', decimalPlaces:4,
    todaySellRate: 6.8000,
    carryIn:  { qty: 1_400, rate: 6.7500, phpValue: 1_400 * 6.7500 },
    todayBuys:[ { qty: 700, rate: 6.7000, phpCost: 700 * 6.7000 } ],
  },
  {
    code:'MYR', name:'Malaysian Ringgit', flag:'🇲🇾', category:'2ND', decimalPlaces:4,
    todaySellRate: 11.5000,
    carryIn:  { qty: 380, rate: 11.3000, phpValue: 380 * 11.3000 },
    todayBuys:[ { qty: 240, rate: 11.2000, phpCost: 240 * 11.2000 } ],
  },
  {
    code:'NZD', name:'New Zealand Dollar', flag:'🇳🇿', category:'2ND', decimalPlaces:4,
    todaySellRate: 27.0000,
    carryIn:  { qty: 80,  rate: 26.8000, phpValue: 80 * 26.8000 },
    todayBuys:[ { qty: 50,  rate: 26.6000, phpCost: 50 * 26.6000 } ],
  },
  {
    code:'TWD', name:'Taiwan Dollar', flag:'🇹🇼', category:'2ND', decimalPlaces:4,
    todaySellRate: 1.3800,
    carryIn:  { qty: 50_000, rate: 1.3600, phpValue: 50_000 * 1.3600 },
    todayBuys:[ { qty: 20_000, rate: 1.3500, phpCost: 20_000 * 1.3500 } ],
  },
  {
    code:'THB', name:'Thai Baht', flag:'🇹🇭', category:'2ND', decimalPlaces:4,
    todaySellRate: 1.3300,
    carryIn:  { qty: 5_500, rate: 1.3100, phpValue: 5_500 * 1.3100 },
    todayBuys:[ { qty: 3_000, rate: 1.3000, phpCost: 3_000 * 1.3000 } ],
  },

  // ── OTHERS ────────────────────────────────
  {
    code:'SAR', name:'Saudi Riyal', flag:'🇸🇦', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 11.3000,
    carryIn:  { qty: 800, rate: 11.1500, phpValue: 800 * 11.1500 },
    todayBuys:[ { qty: 400, rate: 11.0000, phpCost: 400 * 11.0000 } ],
  },
  {
    code:'AED', name:'UAE Dirham', flag:'🇦🇪', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 11.3500,
    carryIn:  { qty: 500, rate: 11.2000, phpValue: 500 * 11.2000 },
    todayBuys:[ { qty: 300, rate: 11.1000, phpCost: 300 * 11.1000 } ],
  },
  {
    code:'QAR', name:'Qatar Riyal', flag:'🇶🇦', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 11.2500,
    carryIn:  { qty: 200, rate: 11.1000, phpValue: 200 * 11.1000 },
    todayBuys:[ { qty: 100, rate: 11.0000, phpCost: 100 * 11.0000 } ],
  },
  {
    code:'KWD', name:'Kuwaiti Dinar', flag:'🇰🇼', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 140.0000,
    carryIn:  { qty: 10, rate: 138.5000, phpValue: 10 * 138.5000 },
    todayBuys:[ { qty: 5,  rate: 138.0000, phpCost: 5 * 138.0000 } ],
  },
  {
    code:'BHD', name:'Bahrain Dinar', flag:'🇧🇭', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 120.0000,
    carryIn:  { qty: 8,  rate: 118.5000, phpValue: 8 * 118.5000 },
    todayBuys:[ { qty: 4,  rate: 118.0000, phpCost: 4 * 118.0000 } ],
  },
  {
    code:'OMR', name:'Omani Rial', flag:'🇴🇲', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 118.0000,
    carryIn:  { qty: 8,  rate: 116.5000, phpValue: 8 * 116.5000 },
    todayBuys:[ { qty: 4,  rate: 116.0000, phpCost: 4 * 116.0000 } ],
  },
  {
    code:'CHF', name:'Swiss Franc', flag:'🇨🇭', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 58.5000,
    carryIn:  { qty: 90, rate: 58.1000, phpValue: 90 * 58.1000 },
    todayBuys:[ { qty: 60, rate: 57.9000, phpCost: 60 * 57.9000 } ],
  },
  {
    code:'CAD', name:'Canadian Dollar', flag:'🇨🇦', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 34.0000,
    carryIn:  { qty: 260, rate: 33.7000, phpValue: 260 * 33.7000 },
    todayBuys:[ { qty: 150, rate: 33.5000, phpCost: 150 * 33.5000 } ],
  },
  {
    code:'SEK', name:'Swedish Krona', flag:'🇸🇪', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 3.3000,
    carryIn:  { qty: 2_000, rate: 3.2500, phpValue: 2_000 * 3.2500 },
    todayBuys:[ { qty: 1_000, rate: 3.2200, phpCost: 1_000 * 3.2200 } ],
  },
  {
    code:'NOK', name:'Norwegian Krone', flag:'🇳🇴', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 3.4000,
    carryIn:  { qty: 1_500, rate: 3.3500, phpValue: 1_500 * 3.3500 },
    todayBuys:[ { qty: 800, rate: 3.3200, phpCost: 800 * 3.3200 } ],
  },
  {
    code:'DKK', name:'Danish Krone', flag:'🇩🇰', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 6.0000,
    carryIn:  { qty: 1_000, rate: 5.9500, phpValue: 1_000 * 5.9500 },
    todayBuys:[ { qty: 500, rate: 5.9000, phpCost: 500 * 5.9000 } ],
  },
  {
    // IDR: rate is ~0.0031 — MUST store 4 decimal places
    // displaying as 0.00 would be dead wrong
    code:'IDR', name:'Indonesian Rupiah', flag:'🇮🇩', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 0.0031,
    carryIn:  { qty: 20_000_000, rate: 0.0030, phpValue: 20_000_000 * 0.0030 },
    todayBuys:[ { qty: 5_000_000, rate: 0.0030, phpCost: 5_000_000 * 0.0030 } ],
  },
  {
    // VND: rate is ~0.0022 — same precision issue as IDR
    code:'VND', name:'Vietnamese Dong', flag:'🇻🇳', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 0.0022,
    carryIn:  { qty: 50_000_000, rate: 0.0021, phpValue: 50_000_000 * 0.0021 },
    todayBuys:[ { qty: 10_000_000, rate: 0.0021, phpCost: 10_000_000 * 0.0021 } ],
  },
  {
    code:'BND', name:'Brunei Dollar', flag:'🇧🇳', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 38.0000,
    carryIn:  { qty: 100, rate: 37.7000, phpValue: 100 * 37.7000 },
    todayBuys:[ { qty: 50,  rate: 37.5000, phpCost: 50 * 37.5000 } ],
  },
  {
    code:'INR', name:'Indian Rupee', flag:'🇮🇳', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 0.3000,
    carryIn:  { qty: 100_000, rate: 0.2950, phpValue: 100_000 * 0.2950 },
    todayBuys:[ { qty: 50_000, rate: 0.2920, phpCost: 50_000 * 0.2920 } ],
  },
  {
    code:'JOD', name:'Jordan Dinar', flag:'🇯🇴', category:'OTHERS', decimalPlaces:4,
    todaySellRate: 60.0000,
    carryIn:  { qty: 5,  rate: 59.5000, phpValue: 5 * 59.5000 },
    todayBuys:[ { qty: 3,  rate: 59.0000, phpCost: 3 * 59.0000 } ],
  },
];

// ─────────────────────────────────────────────
// Build computed positions — per-day avg logic
// ─────────────────────────────────────────────
export const CURRENCIES: CurrencyPosition[] = RAW_CURRENCIES.map(raw => {
  const computed = computePosition(raw.carryIn, raw.todayBuys, raw.todaySellRate);
  return { ...raw, ...computed };
});

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
export const OPENING_CAPITAL = 1_000_000;
export const PHP_CASH        = 359_600;

export const RIDER: RiderState = {
  name: 'Jun-Jun', status: 'IN_FIELD', dispatchTime: '10:30 AM',
  cashPHP: 277_050, transactions: 4,
  totalSoldPHP: 145_800, totalBoughtPHP: 68_750, marginPHP: 3_420,
  positions: [
    { currency: 'USD', qty: 1_200 },
    { currency: 'JPY', qty: 50_000 },
    { currency: 'EUR', qty: 80 },
  ],
};

// ─────────────────────────────────────────────
// RECENT TRANSACTIONS
// THAN = (sellRate − dailyAvgCost) × units
// Computed from actual dailyAvgCost above.
// BUY transactions have than: 0 (no gain yet).
// ─────────────────────────────────────────────

// Helper to get daily avg for a currency code
const getAvg = (code: string) =>
  CURRENCIES.find(c => c.code === code)?.dailyAvgCost ?? 0;

// Pre-compute THAN for sell transactions
const jpyAvg = getAvg('JPY');  // ~0.2938
const gbpAvg = getAvg('GBP');  // ~62.933
const usdAvg = getAvg('USD');  // ~57.696

export const RECENT_TXN: Transaction[] = [
  { id:'OR-00080412', time:'06:58 PM', type:'BUY',  source:'COUNTER', currency:'EUR', foreignAmt:150,    rate:54.2000, phpAmt:8_130,   than:0, cashier:'ADP28', customer:'Walk-in' },
  { id:'OR-00080411', time:'06:43 PM', type:'BUY',  source:'COUNTER', currency:'USD', foreignAmt:100,    rate:57.6000, phpAmt:5_760,   than:0, cashier:'ADP28' },
  // THAN: (0.3000 − jpyAvg) × 50,000
  { id:'RD-00000312', time:'06:15 PM', type:'SELL', source:'RIDER',   currency:'JPY', foreignAmt:50_000, rate:0.3000,  phpAmt:15_000,  than: parseFloat(((0.3000 - jpyAvg) * 50_000).toFixed(2)), cashier:'JUN', customer:'Hotel Okura' },
  // THAN: (63.5000 − gbpAvg) × 200
  { id:'OR-00080410', time:'06:02 PM', type:'SELL', source:'COUNTER', currency:'GBP', foreignAmt:200,    rate:63.5000, phpAmt:12_700,  than: parseFloat(((63.5000 - gbpAvg) * 200).toFixed(2)), cashier:'ADP28', customer:'Bravada Travel' },
  { id:'OR-00080409', time:'05:44 PM', type:'BUY',  source:'COUNTER', currency:'KRW', foreignAmt:100_000,rate:0.0352,  phpAmt:3_520,   than:0, cashier:'ADP28' },
  { id:'RD-00000311', time:'04:30 PM', type:'BUY',  source:'RIDER',   currency:'USD', foreignAmt:500,    rate:57.5000, phpAmt:28_750,  than:0, cashier:'JUN', customer:'JB Forex' },
  // THAN: (58.0500 − usdAvg) × 200
  { id:'OR-00080408', time:'04:12 PM', type:'SELL', source:'COUNTER', currency:'USD', foreignAmt:200,    rate:58.0500, phpAmt:11_610,  than: parseFloat(((58.0500 - usdAvg) * 200).toFixed(2)), cashier:'ADP28', customer:'Cebu Pacific Agent' },
  { id:'OR-00080407', time:'03:55 PM', type:'BUY',  source:'COUNTER', currency:'SGD', foreignAmt:300,    rate:36.0000, phpAmt:10_800,  than:0, cashier:'ADP28' },
];

// ─────────────────────────────────────────────
// AGGREGATES
// ─────────────────────────────────────────────
export const TOTAL_STOCK_VALUE  = CURRENCIES.reduce((s, c) => s + c.stockValuePhp, 0);
export const TOTAL_CAPITAL      = PHP_CASH + TOTAL_STOCK_VALUE;
export const TOTAL_UNREALIZED   = CURRENCIES.reduce((s, c) => s + c.unrealizedPHP, 0);
export const CAPITAL_GAIN       = TOTAL_CAPITAL - OPENING_CAPITAL;
export const TOTAL_THAN_TODAY   = RECENT_TXN.filter(t => t.type === 'SELL').reduce((s, t) => s + t.than, 0);
export const TOTAL_BOUGHT_TODAY = RECENT_TXN.filter(t => t.type === 'BUY').reduce((s, t) => s + t.phpAmt, 0);
export const TOTAL_SOLD_TODAY   = RECENT_TXN.filter(t => t.type === 'SELL').reduce((s, t) => s + t.phpAmt, 0);
