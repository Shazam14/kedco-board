/**
 * auditFormat.ts — pure formatting utilities for audit log entries.
 * No DOM, no React — safe to unit test in Node.
 */

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditEntry {
  id:         string;
  table:      string;
  record_id:  string;
  action:     AuditAction;
  changed_by: string;
  changed_at: string;          // ISO 8601
  old_value:  Record<string, unknown> | null;
  new_value:  Record<string, unknown> | null;
  note?:      string;
}

// ── Action label + colour ────────────────────────────────────────────────────

export const ACTION_COLOR: Record<AuditAction, string> = {
  CREATE: '#00d4aa',
  UPDATE: '#f5a623',
  DELETE: '#ff5c5c',
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: '+ CREATE',
  UPDATE: '✎ UPDATE',
  DELETE: '✕ DELETE',
};

export function actionColor(action: AuditAction): string {
  return ACTION_COLOR[action] ?? '#7a8ba8';
}

export function actionLabel(action: AuditAction): string {
  return ACTION_LABEL[action] ?? action;
}

// ── Table human label ────────────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  transactions: 'Transaction',
  rates:        'Rate',
  positions:    'Position',
  dispatches:   'Dispatch',
  users:        'User',
};

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

// ── Timestamp formatting ─────────────────────────────────────────────────────

/**
 * Format ISO timestamp → "Apr 14, 2026 · 14:32" in Philippine time.
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${date} · ${time}`;
}

// ── Diff computation ─────────────────────────────────────────────────────────

export interface FieldDiff {
  field:    string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Compare old_value and new_value objects, returning only the fields
 * that actually changed.  Returns [] for CREATE (no old) or DELETE (no new).
 */
export function diffValues(
  oldVal: Record<string, unknown> | null,
  newVal: Record<string, unknown> | null,
): FieldDiff[] {
  if (!oldVal || !newVal) return [];

  const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  const diffs: FieldDiff[] = [];

  for (const key of keys) {
    const o = oldVal[key];
    const n = newVal[key];
    // Use JSON stringify for deep comparison
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      diffs.push({ field: key, oldValue: o, newValue: n });
    }
  }

  return diffs;
}

// ── Summary line ─────────────────────────────────────────────────────────────

/**
 * One-line human description of an audit entry.
 * e.g. "cashier1 updated Transaction TXN-001 (rate, customer)"
 */
export function summariseEntry(entry: AuditEntry): string {
  const action = entry.action.toLowerCase() + 'd';
  const tbl    = tableLabel(entry.table);
  const diffs  = diffValues(entry.old_value, entry.new_value);
  const fields = diffs.length > 0 ? ` (${diffs.map(d => d.field).join(', ')})` : '';
  return `${entry.changed_by} ${action} ${tbl} ${entry.record_id}${fields}`;
}
