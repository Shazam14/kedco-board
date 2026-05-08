/**
 * Format a typed PHP amount with `en-PH` thousands separators while the user
 * is editing. Preserves a leading `-` and up to 2 decimals.
 */
export function formatAmountInput(raw: string): string {
  if (!raw) return '';
  const negative = raw.trimStart().startsWith('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return negative ? '-' : '';
  const [intRaw, decRaw] = cleaned.split('.');
  const intFormatted = intRaw ? Number(intRaw).toLocaleString('en-PH') : '';
  const out = decRaw !== undefined ? `${intFormatted}.${decRaw.slice(0, 2)}` : intFormatted;
  return (negative ? '-' : '') + out;
}

export const parseAmountInput = (raw: string) => parseFloat(raw.replace(/,/g, ''));
