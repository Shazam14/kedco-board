const TZ = 'Asia/Manila';

/**
 * Format a YYYY-MM-DD date string in Philippine time.
 * e.g. "2026-04-17" → "Apr 17, 2026"
 */
export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00+08:00').toLocaleDateString('en-PH', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Format an ISO timestamp string in Philippine time.
 * e.g. "2026-04-17T08:30:00Z" → "Apr 17, 2026 · 04:30 PM"
 */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-PH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

/**
 * Format an ISO timestamp — date + 24h time. Used in audit log.
 * e.g. "2026-04-17T08:30:00Z" → "Apr 17, 2026 · 16:30"
 */
export function fmtDateTimeAudit(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-PH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

/**
 * Today's date as YYYY-MM-DD in Philippine time.
 * Safe replacement for new Date().toISOString().slice(0, 10) which returns UTC.
 */
export function todayPHT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Current date formatted for display. e.g. "Thursday, April 17, 2026"
 */
export function todayLongPHT(): string {
  return new Date().toLocaleDateString('en-PH', {
    timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * Current time formatted for display. e.g. "04:32 PM"
 */
export function nowTimePHT(): string {
  return new Date().toLocaleTimeString('en-PH', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true,
  });
}
