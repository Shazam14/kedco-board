/**
 * parseId — ID barcode/QR data parser for AMLA compliance.
 *
 * Handles three Philippine ID formats:
 *   1. PhilSys QR      — JSON payload from the PSA national ID QR code
 *   2. Driver's Licence — PDF417 barcode, LTO pipe-delimited format
 *   3. Newline-encoded  — key:value or plain-line IDs (some passports, other IDs)
 *
 * Falls back to returning the raw string as the name if none match,
 * so the cashier always gets something to work with rather than an error.
 */

export interface ParsedID {
  name:     string;   // Full name, normalised to "FIRST [MIDDLE] LAST"
  idNumber: string;   // ID / licence / PCN number, empty string if not found
  raw:      string;   // Original unmodified scan result
}

// ── 1. PhilSys QR ─────────────────────────────────────────────────────────

/**
 * PhilSys QR encodes a JSON payload. Field names vary slightly across
 * card generations — we try every known variant.
 */
export function parsePhilSys(raw: string): ParsedID | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const firstName  = str(data.firstName  ?? data.first_name  ?? data.fn ?? data.givenName  ?? data.given_name);
  const middleName = str(data.middleName ?? data.middle_name ?? data.mn ?? data.middleInitial ?? '');
  const lastName   = str(data.lastName   ?? data.last_name   ?? data.ln ?? data.familyName  ?? data.family_name);
  const pcn        = str(data.pcn ?? data.psn ?? data.philsysNumber ?? data.cardNumber ?? data.id ?? '');

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
  if (!fullName) return null;

  return { name: fullName, idNumber: pcn, raw };
}

// ── 2. Philippine Driver's Licence PDF417 ─────────────────────────────────

/** Matches LTO licence numbers: letter + digits + hyphens (e.g. N01-12-345678) */
const LTO_LICENCE_RE = /^[A-Z]\d{2}-\d{2}-\d{6,}$/;

/** Matches plain numeric IDs of 8+ digits */
const NUMERIC_ID_RE = /^\d{8,}$/;

/**
 * LTO PDF417 barcode format (pipe-delimited).
 * Typical layout: LAST, FIRST MIDDLE | LICENCE_NO | DOB | ADDRESS | ...
 * Name part is all-caps alphabetic, may contain comma as last/first separator.
 */
export function parseDriversLicence(raw: string): ParsedID | null {
  if (!raw.includes('|')) return null;

  const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  // Find licence number
  const idNumber = parts.find(p => LTO_LICENCE_RE.test(p) || NUMERIC_ID_RE.test(p)) ?? '';

  // Find name part: all-caps alpha, spaces, commas, dots, hyphens, min 4 chars
  const namePart = parts.find(p => /^[A-Z\s,.\-]+$/.test(p) && p.length >= 4);
  if (!namePart) return null;

  // "DELA CRUZ, JUAN PABLO" → "JUAN PABLO DELA CRUZ"
  const name = namePart.includes(',')
    ? namePart.split(',').map(s => s.trim()).reverse().join(' ').trim()
    : namePart.trim();

  return { name, idNumber, raw };
}

// ── 3. Newline / key-value encoded IDs ────────────────────────────────────

/**
 * Some IDs (older passports, PRC cards) encode data as:
 *   Name: Juan Dela Cruz
 *   ID No: 123456789
 * or plain lines where the first proper-cased line is the name.
 */
export function parseNewlineEncoded(raw: string): ParsedID | null {
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const getValue = (line: string) =>
    line.includes(':') ? line.split(':').slice(1).join(':').trim() : line.trim();

  const nameLine = lines.find(l =>
    /name/i.test(l) ||
    // Proper-cased full name pattern (e.g. "Juan Pablo Dela Cruz")
    /^[A-Z][a-z]+([\s-][A-Z][a-z]+){1,4}$/.test(l)
  );

  const idLine = lines.find(l =>
    /\b(no\.?|number|id|licence|license|pcn|psn)\b/i.test(l) ||
    NUMERIC_ID_RE.test(l.replace(/[^0-9]/g, ''))
  );

  if (!nameLine) return null;

  return {
    name:     getValue(nameLine),
    idNumber: idLine ? getValue(idLine).replace(/[^A-Z0-9\-]/gi, '') : '',
    raw,
  };
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Try each parser in order. If none match, return the raw text as the name
 * so the cashier always has something to review/edit rather than an error.
 */
export function parseIdScan(raw: string): ParsedID {
  return (
    parsePhilSys(raw) ??
    parseDriversLicence(raw) ??
    parseNewlineEncoded(raw) ??
    { name: raw.length <= 120 ? raw.trim() : raw.slice(0, 120).trim(), idNumber: '', raw }
  );
}
