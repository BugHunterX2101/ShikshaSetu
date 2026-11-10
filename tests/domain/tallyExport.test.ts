import { describe, it, expect } from 'vitest';
import {
  buildReceiptVoucherXml,
  buildCreditNoteVoucherXml,
  buildTallyXmlEnvelope,
  generateVoucherGuid,
  formatTallyDate,
  sanitizeCsvCell,
  generateTallyAuditCsv,
  TallyReceiptEntry,
  TallyCreditNoteEntry,
} from '../../src/domain/tallyExport';

describe('Tally Prime XML & CSV Balanced Double-Entry Exporter', () => {
  const sampleReceipt: TallyReceiptEntry = {
    centreCode: 'JPR-GPL',
    voucherNumber: 'RCP/26-27/000412',
    date: '2026-11-02',
    studentCode: 'STU-0412',
    narration: 'Term fee instalment 2 payment',
    paymentMode: 'UPI',
    grossPaise: 1500000n, // ₹15,000.00
    taxablePaise: 1271186n, // ₹12,711.86
    cgstPaise: 114407n, // ₹1,144.07
    sgstPaise: 114407n, // ₹1,144.07
  };

  it('generates zero-sum balanced Receipt voucher XML (-Gross + Taxable + CGST + SGST = 0.00)', () => {
    const xml = buildReceiptVoucherXml(sampleReceipt);

    // Verify voucher structure
    expect(xml).toContain('<VOUCHER VCHTYPE="Receipt" ACTION="Create"');
    expect(xml).toContain('<VOUCHERNUMBER>RCP/26-27/000412</VOUCHERNUMBER>');
    expect(xml).toContain('<DATE>20261102</DATE>');

    // Debited bank ledger has ISDEEMEDPOSITIVE Yes with negative amount
    expect(xml).toContain('<LEDGERNAME>Razorpay Clearing</LEDGERNAME>');
    expect(xml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
    expect(xml).toContain('<AMOUNT>-15000.00</AMOUNT>');

    // Credited fees ledger has ISDEEMEDPOSITIVE No with positive amount
    expect(xml).toContain('<LEDGERNAME>Coaching Fees</LEDGERNAME>');
    expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    expect(xml).toContain('<AMOUNT>12711.86</AMOUNT>');

    // Credited tax ledgers
    expect(xml).toContain('<LEDGERNAME>Output CGST</LEDGERNAME>');
    expect(xml).toContain('<AMOUNT>1144.07</AMOUNT>');
    expect(xml).toContain('<LEDGERNAME>Output SGST</LEDGERNAME>');
  });

  it('rejects an unbalanced voucher where credits do not sum to gross', () => {
    const unbalancedReceipt: TallyReceiptEntry = {
      ...sampleReceipt,
      taxablePaise: 1200000n, // Short by 711.86
    };

    expect(() => buildReceiptVoucherXml(unbalancedReceipt)).toThrow(Error);
  });

  it('generates deterministic SHA-256 GUID formatted as RFC 4122 UUID', () => {
    const guid1 = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
    const guid2 = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
    const guidOther = generateVoucherGuid('JPR-VSH', 'RCP/26-27/000412');

    // Deterministic idempotency
    expect(guid1).toBe(guid2);
    expect(guid1).not.toBe(guidOther);

    // Format check: 8-4-4-4-12 hex characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(uuidRegex.test(guid1)).toBe(true);
  });

  it('generates balanced Credit Note voucher XML for pro-rata refunds', () => {
    const sampleCreditNote: TallyCreditNoteEntry = {
      centreCode: 'JPR-GPL',
      voucherNumber: 'CN/26-27/000001',
      date: '2026-11-03',
      studentCode: 'STU-0412',
      narration: 'Pro-rata refund on course exit',
      refundGrossPaise: 1800000n, // ₹18,000.00
      refundTaxablePaise: 1525424n, // ₹15,254.24
      refundCgstPaise: 137288n, // ₹1,372.88
      refundSgstPaise: 137288n, // ₹1,372.88
    };

    const xml = buildCreditNoteVoucherXml(sampleCreditNote);

    expect(xml).toContain('<VOUCHER VCHTYPE="Credit Note"');
    expect(xml).toContain('<VOUCHERNUMBER>CN/26-27/000001</VOUCHERNUMBER>');

    // Debited tax & fee reversal (negative)
    expect(xml).toContain('<AMOUNT>-15254.24</AMOUNT>');
    expect(xml).toContain('<AMOUNT>-1372.88</AMOUNT>');

    // Credited bank payout (positive)
    expect(xml).toContain('<AMOUNT>18000.00</AMOUNT>');
  });

  it('wraps vouchers into full Tally XML Import envelope', () => {
    const voucherXml = buildReceiptVoucherXml(sampleReceipt);
    const envelope = buildTallyXmlEnvelope([voucherXml]);

    expect(envelope).toContain('<ENVELOPE>');
    expect(envelope).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(envelope).toContain('<REQUESTDATA>');
    expect(envelope).toContain(voucherXml);
    expect(envelope).toContain('</ENVELOPE>');
  });

  it('sanitizes formula injection characters in CSV export', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvCell('+cmd')).toBe("'+cmd");
    expect(sanitizeCsvCell('-500')).toBe("'-500");
    expect(sanitizeCsvCell('@sum')).toBe("'@sum");
    expect(sanitizeCsvCell('Normal text')).toBe('Normal text');
  });

  it('generates valid Tally audit CSV with correct headers and sanitized cells', () => {
    const csv = generateTallyAuditCsv([sampleReceipt]);
    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'Date,VoucherNumber,CentreCode,StudentCode,PaymentMode,GrossAmount,TaxableBase,CGST,SGST,VoucherType'
    );
    expect(lines[1]).toContain('RCP/26-27/000412');
    expect(lines[1]).toContain('15000.00');
    expect(lines[1]).toContain('12711.86');
    expect(lines[1]).toContain('1144.07');
  });
});
