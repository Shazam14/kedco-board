// Types that match the FastAPI response exactly (snake_case → camelCase)

export interface CurrencyPosition {
  code: string;
  name: string;
  flag: string;
  category: 'MAIN' | '2ND' | 'OTHERS';
  decimalPlaces: number;
  totalQty: number;
  dailyAvgCost: number;
  todayBuyRate: number;
  todaySellRate: number;
  stockValuePhp: number;
  todayGainPerUnit: number;
  unrealizedPHP: number;
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
  than: number;
  cashier: string;
  customer?: string;
  idNumber?: string;
  paymentMode?: string;
}

export interface CurrencyMeta {
  code: string;
  name: string;
  flag: string;
  category: string;
  decimalPlaces: number;
  todayBuyRate: number | null;
  todaySellRate: number | null;
  rateSet: boolean;
}

export interface DashboardSummary {
  date: string;
  openingCapital: number;
  phpCash: number;
  totalStockValue: number;
  totalCapital: number;
  totalUnrealized: number;
  totalThanToday: number;
  totalBoughtToday: number;
  totalSoldToday: number;
  positions: CurrencyPosition[];
  recentTransactions: Transaction[];
}
