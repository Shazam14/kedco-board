/**
 * Unit tests for src/lib/parseId.ts
 *
 * Tests cover each parser independently, then the main parseIdScan()
 * fallback chain.  No camera / DOM / ZXing involved — pure logic only.
 */

import { describe, it, expect } from 'vitest';
import {
  parsePhilSys,
  parseDriversLicence,
  parseNewlineEncoded,
  parseIdScan,
} from '../../src/lib/parseId';

// ── parsePhilSys ─────────────────────────────────────────────────────────────

describe('parsePhilSys', () => {
  it('parses standard PhilSys fields (camelCase)', () => {
    const raw = JSON.stringify({
      firstName: 'Juan',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
      pcn: '1234-5678-9012',
    });
    const result = parsePhilSys(raw);
    expect(result?.name).toBe('Juan Santos Dela Cruz');
    expect(result?.idNumber).toBe('1234-5678-9012');
  });

  it('parses snake_case field names (alternate card generation)', () => {
    const raw = JSON.stringify({
      first_name: 'Maria',
      middle_name: '',
      last_name: 'Reyes',
      psn: '9999-0000-1111',
    });
    const result = parsePhilSys(raw);
    expect(result?.name).toBe('Maria Reyes');
    expect(result?.idNumber).toBe('9999-0000-1111');
  });

  it('parses abbreviated field names (fn / ln / pcn)', () => {
    const raw = JSON.stringify({ fn: 'Pedro', mn: 'B', ln: 'Soriano', pcn: 'PCN-001' });
    const result = parsePhilSys(raw);
    expect(result?.name).toBe('Pedro B Soriano');
    expect(result?.idNumber).toBe('PCN-001');
  });

  it('trims whitespace from names', () => {
    const raw = JSON.stringify({ firstName: '  Ana  ', lastName: '  Lopez  ', pcn: '111' });
    const result = parsePhilSys(raw);
    expect(result?.name).toBe('Ana Lopez');
  });

  it('omits empty middle name', () => {
    const raw = JSON.stringify({ firstName: 'Liza', middleName: '', lastName: 'Santos', pcn: '' });
    const result = parsePhilSys(raw);
    expect(result?.name).toBe('Liza Santos');
    expect(result?.idNumber).toBe('');
  });

  it('returns null when JSON has no name fields', () => {
    const raw = JSON.stringify({ dob: '1990-01-01', sex: 'F' });
    expect(parsePhilSys(raw)).toBeNull();
  });

  it('returns null for non-JSON input', () => {
    expect(parsePhilSys('DELA CRUZ|N01-12-123456')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parsePhilSys('')).toBeNull();
  });
});

// ── parseDriversLicence ──────────────────────────────────────────────────────

describe('parseDriversLicence', () => {
  it('parses standard LTO barcode — "LAST, FIRST MIDDLE|LICENCE|DOB"', () => {
    const raw = 'DELA CRUZ, JUAN PABLO|N01-12-345678|1990-05-15|Manila';
    const result = parseDriversLicence(raw);
    expect(result?.name).toBe('JUAN PABLO DELA CRUZ');
    expect(result?.idNumber).toBe('N01-12-345678');
  });

  it('reverses comma-separated last/first correctly', () => {
    const raw = 'SANTOS, MARIA CLARA|N02-23-456789';
    const result = parseDriversLicence(raw);
    expect(result?.name).toBe('MARIA CLARA SANTOS');
  });

  it('extracts licence number when name has no comma', () => {
    const raw = 'JOSE RIZAL|N03-34-567890|Cebu City';
    const result = parseDriversLicence(raw);
    expect(result?.name).toBe('JOSE RIZAL');
    expect(result?.idNumber).toBe('N03-34-567890');
  });

  it('handles numeric-only ID numbers (12+ digits)', () => {
    const raw = 'GARCIA, ANNA|123456789012|1985-03-22';
    const result = parseDriversLicence(raw);
    expect(result?.idNumber).toBe('123456789012');
  });

  it('returns null when there are no pipe characters', () => {
    expect(parseDriversLicence('Juan Dela Cruz')).toBeNull();
  });

  it('returns null when fewer than 2 non-empty parts', () => {
    expect(parseDriversLicence('|||')).toBeNull();
  });

  it('returns null when no all-caps name part found', () => {
    // All parts are numbers/dates — no alphabetic name
    const raw = '1990-01-01|123456789|Male';
    expect(parseDriversLicence(raw)).toBeNull();
  });
});

// ── parseNewlineEncoded ──────────────────────────────────────────────────────

describe('parseNewlineEncoded', () => {
  it('parses key:value newline format', () => {
    const raw = 'Name: Juan Dela Cruz\nID No: 987654321\nDOB: 1990-01-01';
    const result = parseNewlineEncoded(raw);
    expect(result?.name).toBe('Juan Dela Cruz');
    expect(result?.idNumber).toBe('987654321');
  });

  it('detects proper-cased name line without "Name:" label', () => {
    const raw = 'Juan Pablo Dela Cruz\n123456789\nManila';
    const result = parseNewlineEncoded(raw);
    expect(result?.name).toBe('Juan Pablo Dela Cruz');
  });

  it('returns null when only one non-empty line', () => {
    expect(parseNewlineEncoded('Juan Dela Cruz')).toBeNull();
  });

  it('returns null when no recognisable name line exists', () => {
    const raw = '1990-01-01\nManila\n987654321';
    expect(parseNewlineEncoded(raw)).toBeNull();
  });
});

// ── parseIdScan (fallback chain) ─────────────────────────────────────────────

describe('parseIdScan', () => {
  it('uses PhilSys parser when input is valid JSON', () => {
    const raw = JSON.stringify({ firstName: 'Ken', lastName: 'Colina', pcn: 'PCN-KEN-001' });
    const result = parseIdScan(raw);
    expect(result.name).toBe('Ken Colina');
    expect(result.idNumber).toBe('PCN-KEN-001');
  });

  it('falls through to driver\'s licence parser', () => {
    const raw = 'COLINA, KEN MARIE|N04-45-678901';
    const result = parseIdScan(raw);
    expect(result.name).toBe('KEN MARIE COLINA');
    expect(result.idNumber).toBe('N04-45-678901');
  });

  it('falls through to newline parser', () => {
    const raw = 'Name: Ken Colina\nLicence: 123456789';
    const result = parseIdScan(raw);
    expect(result.name).toBe('Ken Colina');
  });

  it('falls back to raw text when nothing matches', () => {
    const raw = 'SOME-UNRECOGNISED-QR-PAYLOAD-XYZ';
    const result = parseIdScan(raw);
    expect(result.name).toBe(raw);
    expect(result.idNumber).toBe('');
    expect(result.raw).toBe(raw);
  });

  it('truncates raw fallback name at 120 characters', () => {
    const raw = 'X'.repeat(200);
    const result = parseIdScan(raw);
    expect(result.name.length).toBe(120);
  });

  it('always preserves the original raw string', () => {
    const raw = JSON.stringify({ firstName: 'Ana', lastName: 'Reyes', pcn: '111' });
    expect(parseIdScan(raw).raw).toBe(raw);
  });
});
