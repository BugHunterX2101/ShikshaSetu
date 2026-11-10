import { describe, it, expect } from 'vitest';
import {
  calculateGstReverseSplit,
  formatPaiseToRupees,
  formatPaiseToCurrency,
  formatGstSplit,
} from '../../src/domain/gst';

describe('TC-02: 18% GST SAC 999293 Reverse Split Engine', () => {
  it('correctly calculates split for standard payment ₹15,000.00 (1,500,000 paise)', () => {
    const res = calculateGstReverseSplit(1500000n);
    expect(res.cgstPaise).toBe(114407n);
    expect(res.sgstPaise).toBe(114407n);
    expect(res.taxablePaise).toBe(1271186n);
    expect(res.totalTaxPaise).toBe(228814n);
    expect(res.taxablePaise + res.cgstPaise + res.sgstPaise).toBe(1500000n);
    expect(res.rateBasisPoints).toBe(1800);
    expect(res.sacCode).toBe('999293');
    expect(res.isInterState).toBe(false);
  });

  it('correctly calculates split for JEE quarterly fee ₹30,000.00 (3,000,000 paise)', () => {
    const res = calculateGstReverseSplit(3000000n);
    expect(res.cgstPaise).toBe(228814n);
    expect(res.sgstPaise).toBe(228814n);
    expect(res.taxablePaise).toBe(2542372n);
    expect(res.taxablePaise + res.cgstPaise + res.sgstPaise).toBe(3000000n);
  });

  it('correctly calculates split for custom instalment ₹33,333.00 (3,333,300 paise)', () => {
    const res = calculateGstReverseSplit(3333300n);
    expect(res.cgstPaise).toBe(254235n);
    expect(res.sgstPaise).toBe(254235n);
    expect(res.taxablePaise).toBe(2824830n);
    expect(res.taxablePaise + res.cgstPaise + res.sgstPaise).toBe(3333300n);
  });

  it('correctly calculates split for NEET trimester fee ₹40,000.00 (4,000,000 paise)', () => {
    const res = calculateGstReverseSplit(4000000n);
    expect(res.cgstPaise).toBe(305085n);
    expect(res.sgstPaise).toBe(305085n);
    expect(res.taxablePaise).toBe(3389830n);
    expect(res.taxablePaise + res.cgstPaise + res.sgstPaise).toBe(4000000n);
  });

  it('correctly calculates split for full annual fee ₹1,20,000.00 (12,000,000 paise)', () => {
    const res = calculateGstReverseSplit(12000000n);
    expect(res.cgstPaise).toBe(915254n);
    expect(res.sgstPaise).toBe(915254n);
    expect(res.taxablePaise).toBe(10169492n);
    expect(res.taxablePaise + res.cgstPaise + res.sgstPaise).toBe(12000000n);
  });

  it('handles edge case of 0 paise correctly', () => {
    const res = calculateGstReverseSplit(0n);
    expect(res.taxablePaise).toBe(0n);
    expect(res.cgstPaise).toBe(0n);
    expect(res.sgstPaise).toBe(0n);
    expect(res.totalTaxPaise).toBe(0n);
  });

  it('handles edge case of 1 paisa correctly without drift', () => {
    const res = calculateGstReverseSplit(1n);
    expect(res.cgstPaise).toBe(0n);
    expect(res.sgstPaise).toBe(0n);
    expect(res.taxablePaise).toBe(1n);
    expect(res.taxablePaise + res.cgstPaise + res.sgstPaise).toBe(1n);
  });

  it('calculates inter-state IGST 18% correctly', () => {
    const res = calculateGstReverseSplit(1500000n, true);
    expect(res.isInterState).toBe(true);
    expect(res.cgstPaise).toBe(0n);
    expect(res.sgstPaise).toBe(0n);
    // T_igst = floor((36 * 1500000 + 118) / 236) = floor(54000118 / 236) = 228814n
    expect(res.igstPaise).toBe(228814n);
    expect(res.taxablePaise).toBe(1500000n - 228814n);
    expect(res.taxablePaise + res.igstPaise).toBe(1500000n);
  });

  it('proves mathematical invariants over 100,000 consecutive discrete paise values', () => {
    let checkedCount = 0;
    for (let g = 1; g <= 100000; g++) {
      const gross = BigInt(g);
      const split = calculateGstReverseSplit(gross);

      // Invariant 1: CGST must strictly equal SGST
      if (split.cgstPaise !== split.sgstPaise) {
        throw new Error(`Invariant violation: CGST !== SGST at gross = ${g}`);
      }

      // Invariant 2: Taxable + CGST + SGST must equal Gross to the exact paisa
      if (split.taxablePaise + split.cgstPaise + split.sgstPaise !== gross) {
        throw new Error(`Invariant violation: Taxable + CGST + SGST !== Gross at gross = ${g}`);
      }

      // Invariant 3: Taxable must be non-negative
      if (split.taxablePaise < 0n) {
        throw new Error(`Invariant violation: Taxable is negative at gross = ${g}`);
      }

      // Invariant 4: CGST must be non-negative
      if (split.cgstPaise < 0n) {
        throw new Error(`Invariant violation: CGST is negative at gross = ${g}`);
      }

      checkedCount++;
    }
    expect(checkedCount).toBe(100000);
  });

  it('rejects negative gross amounts with RangeError', () => {
    expect(() => calculateGstReverseSplit(-1n)).toThrow(RangeError);
  });

  it('formats paise into rupee decimal strings correctly', () => {
    expect(formatPaiseToRupees(1500000n)).toBe('15000.00');
    expect(formatPaiseToRupees(1271186n)).toBe('12711.86');
    expect(formatPaiseToRupees(5n)).toBe('0.05');
    expect(formatPaiseToRupees(-1500000n)).toBe('-15000.00');
  });

  it('formats paise into Indian Rupee currency strings', () => {
    expect(formatPaiseToCurrency(1500000n)).toBe('₹15,000.00');
    expect(formatPaiseToCurrency(12000000n)).toBe('₹1,20,000.00');
  });

  it('formats entire GST split object into human-readable rupee values', () => {
    const split = calculateGstReverseSplit(1500000n);
    const formatted = formatGstSplit(split);
    expect(formatted.gross).toBe('15000.00');
    expect(formatted.taxable).toBe('12711.86');
    expect(formatted.cgst).toBe('1144.07');
    expect(formatted.sgst).toBe('1144.07');
    expect(formatted.totalTax).toBe('2288.14');
  });
});
