/**
 * Unit tests for src/lib/auditFormat.ts
 * Pure logic — no DOM, no React, no network.
 */

import { describe, it, expect } from 'vitest';
import {
  actionColor, actionLabel, tableLabel,
  formatTimestamp, diffValues, summariseEntry,
  type AuditEntry,
} from '../../src/lib/auditFormat';

// ── actionColor ──────────────────────────────────────────────────────────────

describe('actionColor', () => {
  it('returns green for CREATE', () => expect(actionColor('CREATE')).toBe('#00d4aa'));
  it('returns amber for UPDATE', () => expect(actionColor('UPDATE')).toBe('#f5a623'));
  it('returns red for DELETE',   () => expect(actionColor('DELETE')).toBe('#ff5c5c'));
});

// ── actionLabel ──────────────────────────────────────────────────────────────

describe('actionLabel', () => {
  it('prefixes CREATE with +',  () => expect(actionLabel('CREATE')).toBe('+ CREATE'));
  it('prefixes UPDATE with ✎', () => expect(actionLabel('UPDATE')).toBe('✎ UPDATE'));
  it('prefixes DELETE with ✕', () => expect(actionLabel('DELETE')).toBe('✕ DELETE'));
});

// ── tableLabel ───────────────────────────────────────────────────────────────

describe('tableLabel', () => {
  it('maps known table names', () => {
    expect(tableLabel('transactions')).toBe('Transaction');
    expect(tableLabel('rates')).toBe('Rate');
    expect(tableLabel('positions')).toBe('Position');
    expect(tableLabel('dispatches')).toBe('Dispatch');
    expect(tableLabel('users')).toBe('User');
  });

  it('returns the raw name for unknown tables', () => {
    expect(tableLabel('some_new_table')).toBe('some_new_table');
  });
});

// ── formatTimestamp ──────────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('formats a valid ISO timestamp', () => {
    // Use a fixed UTC time to avoid TZ-dependent test flakiness
    const iso = '2026-04-14T06:32:00.000Z';
    const result = formatTimestamp(iso);
    // Should contain the date and time components
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/·/);      // separator present
  });

  it('returns the raw string for an invalid date', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
  });

  it('returns the raw string for an empty string', () => {
    expect(formatTimestamp('')).toBe('');
  });
});

// ── diffValues ───────────────────────────────────────────────────────────────

describe('diffValues', () => {
  it('returns changed fields between two objects', () => {
    const old = { rate: 55.00, currency: 'USD' };
    const nw  = { rate: 55.50, currency: 'USD' };
    const diffs = diffValues(old, nw);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual({ field: 'rate', oldValue: 55.00, newValue: 55.50 });
  });

  it('returns empty array when nothing changed', () => {
    const obj = { rate: 55.00, currency: 'USD' };
    expect(diffValues(obj, { ...obj })).toHaveLength(0);
  });

  it('detects added fields', () => {
    const diffs = diffValues({ rate: 55 }, { rate: 55, customer: 'Juan' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('customer');
    expect(diffs[0].oldValue).toBeUndefined();
    expect(diffs[0].newValue).toBe('Juan');
  });

  it('detects removed fields', () => {
    const diffs = diffValues({ rate: 55, customer: 'Juan' }, { rate: 55 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('customer');
    expect(diffs[0].oldValue).toBe('Juan');
    expect(diffs[0].newValue).toBeUndefined();
  });

  it('returns [] when old_value is null (CREATE)', () => {
    expect(diffValues(null, { rate: 55 })).toHaveLength(0);
  });

  it('returns [] when new_value is null (DELETE)', () => {
    expect(diffValues({ rate: 55 }, null)).toHaveLength(0);
  });

  it('returns [] when both are null', () => {
    expect(diffValues(null, null)).toHaveLength(0);
  });

  it('handles nested object comparison correctly', () => {
    const diffs = diffValues(
      { meta: { a: 1 } },
      { meta: { a: 2 } },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('meta');
  });
});

// ── summariseEntry ───────────────────────────────────────────────────────────

describe('summariseEntry', () => {
  const base: AuditEntry = {
    id:         'AUD-001',
    table:      'transactions',
    record_id:  'TXN-001',
    action:     'UPDATE',
    changed_by: 'cashier1',
    changed_at: '2026-04-14T06:00:00.000Z',
    old_value:  { rate: 55.00 },
    new_value:  { rate: 55.50 },
  };

  it('includes the username', () => {
    expect(summariseEntry(base)).toContain('cashier1');
  });

  it('includes the table label', () => {
    expect(summariseEntry(base)).toContain('Transaction');
  });

  it('includes the record ID', () => {
    expect(summariseEntry(base)).toContain('TXN-001');
  });

  it('lists changed fields for UPDATE', () => {
    expect(summariseEntry(base)).toContain('rate');
  });

  it('shows "created" for CREATE', () => {
    const entry: AuditEntry = { ...base, action: 'CREATE', old_value: null };
    expect(summariseEntry(entry)).toContain('created');
  });

  it('shows "deleted" for DELETE', () => {
    const entry: AuditEntry = { ...base, action: 'DELETE', new_value: null };
    expect(summariseEntry(entry)).toContain('deleted');
  });

  it('does not list fields for CREATE (no old_value to diff)', () => {
    const entry: AuditEntry = { ...base, action: 'CREATE', old_value: null };
    // diffValues(null, new) = [] so no parenthetical
    expect(summariseEntry(entry)).not.toContain('(');
  });
});
