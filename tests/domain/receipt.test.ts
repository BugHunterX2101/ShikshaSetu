import { describe, it, expect } from 'vitest';
import {
  formatReceiptNumber,
  formatCreditNoteNumber,
  getFinancialYear,
  parseDocumentNumber,
  isValidDocumentNumber,
} from '../../src/domain/receipt';

describe('Sequential Gapless Receipt & Credit Note Numbering', () => {
  it('formats sequential receipt numbers strictly adhering to GST Rule 46 16-char limit', () => {
    const rcpNo = formatReceiptNumber('26-27', 412);
    expect(rcpNo).toBe('RCP/26-27/000412');
    expect(rcpNo.length).toBe(16);
    expect(isValidDocumentNumber(rcpNo)).toBe(true);
  });

  it('formats sequential credit note numbers: CN/26-27/000001', () => {
    const cnNo = formatCreditNoteNumber('26-27', 1);
    expect(cnNo).toBe('CN/26-27/000001');
    expect(cnNo.length).toBe(15);
    expect(isValidDocumentNumber(cnNo)).toBe(true);
  });

  it('handles minimum sequence number (1) and maximum sequence number (999,999)', () => {
    const minRcp = formatReceiptNumber('26-27', 1);
    expect(minRcp).toBe('RCP/26-27/000001');

    const maxRcp = formatReceiptNumber('26-27', 999999);
    expect(maxRcp).toBe('RCP/26-27/999999');
    expect(maxRcp.length).toBe(16);
  });

  it('rejects sequence numbers outside valid integer bounds [1..999999]', () => {
    expect(() => formatReceiptNumber('26-27', 0)).toThrow(RangeError);
    expect(() => formatReceiptNumber('26-27', -5)).toThrow(RangeError);
    expect(() => formatReceiptNumber('26-27', 1000000)).toThrow(RangeError);
    expect(() => formatCreditNoteNumber('26-27', 0)).toThrow(RangeError);
  });

  it('rejects invalid financial year formats', () => {
    expect(() => formatReceiptNumber('2026-2027', 1)).toThrow(Error);
    expect(() => formatReceiptNumber('26', 1)).toThrow(Error);
  });

  it('computes Indian financial year correctly across April 1 boundary', () => {
    expect(getFinancialYear('2026-04-01')).toBe('26-27');
    expect(getFinancialYear('2026-11-02')).toBe('26-27');
    expect(getFinancialYear('2027-03-31')).toBe('26-27');
    expect(getFinancialYear('2027-04-01')).toBe('27-28');
    expect(getFinancialYear('2026-03-31')).toBe('25-26');
  });

  it('parses formatted document numbers into structured components', () => {
    const parsedRcp = parseDocumentNumber('RCP/26-27/000412');
    expect(parsedRcp.kind).toBe('RCP');
    expect(parsedRcp.financialYear).toBe('26-27');
    expect(parsedRcp.sequenceNumber).toBe(412);

    const parsedCn = parseDocumentNumber('CN/26-27/000042');
    expect(parsedCn.kind).toBe('CN');
    expect(parsedCn.financialYear).toBe('26-27');
    expect(parsedCn.sequenceNumber).toBe(42);
  });

  it('rejects malformed document numbers during parsing', () => {
    expect(() => parseDocumentNumber('INV/26-27/000412')).toThrow(Error);
    expect(() => parseDocumentNumber('RCP-26-27-000412')).toThrow(Error);
    expect(() => parseDocumentNumber('RCP/2026/000412')).toThrow(Error);
  });
});
