import { useState, useRef, useCallback } from 'react';

/**
 * Format a raw numeric string with thousand-comma separators.
 * Preserves a trailing dot (mid-decimal entry) and up to maxDp decimal digits.
 * Examples: '1234'  → '1,234'
 *           '1234.5' → '1,234.5'
 *           '57.'    → '57.'    (keeps dot while user is still typing)
 */
function applyFormat(val: string, maxDp: number): string {
  const stripped = val.replace(/[^0-9.]/g, '');
  const dot = stripped.indexOf('.');
  let intPart = dot === -1 ? stripped : stripped.slice(0, dot);
  const decPart = dot === -1 ? undefined : stripped.slice(dot + 1, dot + 1 + maxDp);
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (intPart === '' && decPart === undefined) return '';
  return decPart !== undefined ? `${intPart}.${decPart}` : intPart;
}

/**
 * Drop-in replacement for useState on numeric <input> fields.
 *
 * - Formats with thousand commas live as the user types.
 * - Restores cursor position after each reformat so mid-number editing works.
 * - Exposes `raw` (no commas) for arithmetic / API submission.
 *
 * Usage:
 *   const amtInput = useNumberInput('', 8);
 *   <input ref={amtInput.ref} value={amtInput.value}
 *          onChange={amtInput.onChange} onFocus={amtInput.onFocus} />
 *   const numeric = +amtInput.raw;
 */
export function useNumberInput(initial = '', maxDp = 8) {
  const [value, _setValue] = useState(() => applyFormat(initial, maxDp));
  const ref = useRef<HTMLInputElement>(null);

  /** Set value programmatically (e.g. auto-fill, clear after submit). */
  const setValue = useCallback((v: string) => {
    _setValue(applyFormat(v, maxDp));
  }, [maxDp]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const cursor = el.selectionStart ?? 0;

    // Count significant chars (digits + dot) before the cursor in the browser's
    // raw value — this lets us restore the cursor to the right spot after
    // commas are inserted or removed.
    const sigBefore = el.value.slice(0, cursor).replace(/[^0-9.]/g, '').length;

    const formatted = applyFormat(el.value, maxDp);
    _setValue(formatted);

    // After React re-renders, re-position the cursor
    requestAnimationFrame(() => {
      const input = ref.current;
      if (!input) return;
      let count = 0;
      let newCursor = formatted.length; // default: end
      for (let i = 0; i < formatted.length; i++) {
        if (count === sigBefore) { newCursor = i; break; }
        if (/[0-9.]/.test(formatted[i])) count++;
      }
      input.setSelectionRange(newCursor, newCursor);
    });
  }, [maxDp]);

  const onFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  /** Numeric string stripped of commas — safe for parseFloat / arithmetic. */
  const raw = value.replace(/,/g, '');

  return { value, setValue, raw, ref, onChange, onFocus };
}
