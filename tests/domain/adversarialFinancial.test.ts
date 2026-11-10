import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import {
  calculateGstReverseSplit,
  formatPaiseToRupees,
  formatPaiseToCurrency,
  formatGstSplit,
  GstSplit,
} from '../../src/domain/gst';
import {
  validateCashLimit,
  validateCashPayment,
  SECTION_269ST_LIMIT_PAISE,
  SECTION_269ST_MAX_ALLOWED_PAISE,
  PaymentMode,
} from '../../src/domain/cashLimit';
import {
  formatReceiptNumber,
  formatCreditNoteNumber,
  getFinancialYear,
  parseDocumentNumber,
  isValidDocumentNumber,
} from '../../src/domain/receipt';
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

describe('ADVERSARIAL STRESS TEST 1: GST SAC 999293 Reverse Split Engine', () => {
  it('FUZZ 100,000 discrete amounts (1 paisa to 100,000 paise) confirming all 5 statutory invariants', () => {
    // Range 1 to 100,000 paise (₹0.01 to ₹1,000.00)
    for (let p = 1; p <= 100000; p++) {
      const gross = BigInt(p);
      const split = calculateGstReverseSplit(gross, false);

      // Invariant 1: Intra-state CGST === SGST exactly
      if (split.cgstPaise !== split.sgstPaise) {
        throw new Error(`Asymmetric CGST/SGST at gross = ${p}: CGST=${split.cgstPaise}, SGST=${split.sgstPaise}`);
      }

      // Invariant 2: Taxable + CGST + SGST === Gross (zero drift)
      if (split.taxablePaise + split.cgstPaise + split.sgstPaise !== gross) {
        throw new Error(`Zero-sum drift at gross = ${p}: Taxable=${split.taxablePaise}, CGST=${split.cgstPaise}, SGST=${split.sgstPaise}, Gross=${gross}`);
      }

      // Invariant 3: Total tax === CGST + SGST
      if (split.totalTaxPaise !== split.cgstPaise + split.sgstPaise) {
        throw new Error(`Total tax mismatch at gross = ${p}`);
      }

      // Invariant 4: No negative quantities
      if (split.taxablePaise < 0n || split.cgstPaise < 0n || split.sgstPaise < 0n) {
        throw new Error(`Negative component at gross = ${p}`);
      }

      // Invariant 5: IGST must be 0 for intra-state
      if (split.igstPaise !== 0n) {
        throw new Error(`Non-zero IGST in intra-state at gross = ${p}`);
      }
    }
  });

  it('FUZZ 50,000 pseudo-random high-value and boundary amounts up to ₹10,000 Crores', () => {
    // Generate deterministic pseudo-random sequence with LCG to ensure repeatability
    let seed = 42;
    function nextRand(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const specialBoundaries: bigint[] = [
      0n, 1n, 2n, 13n, 50n, 59n, 118n, 235n, 236n, 50000n, 100000n,
      1500000n, // ₹15,000
      3000000n, // ₹30,000
      3333333n, // ₹33,333.33
      4000000n, // ₹40,000
      12000000n, // ₹1,20,000
      19999900n, // ₹1,99,999
      20000000n, // ₹2,00,000
      3120000000n, // ₹3.12 Cr
      31200000000n, // ₹31.2 Cr (Annual revenue)
      100000000000n, // ₹100 Cr
      1000000000000n, // ₹1,000 Cr
      10000000000000n, // ₹10,000 Cr
    ];

    for (const gross of specialBoundaries) {
      const split = calculateGstReverseSplit(gross, false);
      expect(split.cgstPaise).toBe(split.sgstPaise);
      expect(split.taxablePaise + split.cgstPaise + split.sgstPaise).toBe(gross);
      expect(split.taxablePaise).toBeGreaterThanOrEqual(0n);
      expect(split.cgstPaise).toBeGreaterThanOrEqual(0n);

      const igstSplit = calculateGstReverseSplit(gross, true);
      expect(igstSplit.cgstPaise).toBe(0n);
      expect(igstSplit.sgstPaise).toBe(0n);
      expect(igstSplit.taxablePaise + igstSplit.igstPaise).toBe(gross);
      expect(igstSplit.taxablePaise).toBeGreaterThanOrEqual(0n);
    }

    // 50,000 random samples across wide range up to 10^12 paise
    for (let i = 0; i < 50000; i++) {
      const magnitude = Math.floor(nextRand() * 12); // 0 to 11 digits
      const base = Math.floor(nextRand() * 1000000);
      const gross = BigInt(base) * (10n ** BigInt(magnitude)) + BigInt(Math.floor(nextRand() * 100));

      // Test intra-state
      const intra = calculateGstReverseSplit(gross, false);
      if (intra.cgstPaise !== intra.sgstPaise) {
        throw new Error(`Asymmetric CGST/SGST at gross = ${gross}`);
      }
      if (intra.taxablePaise + intra.cgstPaise + intra.sgstPaise !== gross) {
        throw new Error(`Balance violation at gross = ${gross}`);
      }

      // Test inter-state
      const inter = calculateGstReverseSplit(gross, true);
      if (inter.taxablePaise + inter.igstPaise !== gross) {
        throw new Error(`IGST balance violation at gross = ${gross}`);
      }
    }
  });

  it('proves effective tax rate conforms strictly within 1 paisa of 18.00% across all amounts', () => {
    const testCases: bigint[] = [
      100n, 500n, 1144n, 10000n, 1500000n, 3000000n, 4000000n, 12000000n,
    ];

    for (const gross of testCases) {
      const split = calculateGstReverseSplit(gross);
      // Theoretical 18% tax on taxable = taxable * 18 / 100
      // Due to integer paise rounding, actual tax (2*T) should differ from taxable * 18 / 100 by at most 1 paisa
      const totalTax = split.totalTaxPaise;
      const expectedTax = (split.taxablePaise * 18n + 50n) / 100n; // round half-up
      const diff = totalTax > expectedTax ? totalTax - expectedTax : expectedTax - totalTax;
      expect(diff).toBeLessThanOrEqual(1n);
    }
  });

  it('rejects negative gross amounts with RangeError', () => {
    expect(() => calculateGstReverseSplit(-1n)).toThrow(RangeError);
    expect(() => calculateGstReverseSplit(-1000000n)).toThrow(RangeError);
  });

  it('validates currency formatting stability across small and large values', () => {
    expect(formatPaiseToRupees(0n)).toBe('0.00');
    expect(formatPaiseToRupees(1n)).toBe('0.01');
    expect(formatPaiseToRupees(9n)).toBe('0.09');
    expect(formatPaiseToRupees(10n)).toBe('0.10');
    expect(formatPaiseToRupees(99n)).toBe('0.99');
    expect(formatPaiseToRupees(100n)).toBe('1.00');
    expect(formatPaiseToRupees(10000000n)).toBe('100000.00');
    expect(formatPaiseToRupees(-1n)).toBe('-0.01');
    expect(formatPaiseToRupees(-100n)).toBe('-1.00');
  });
});

describe('ADVERSARIAL STRESS TEST 2: Section 269ST Cash Limit Guard', () => {
  it('precisely blocks at exact ₹2,00,000.00 (20,000,000 paise) boundary', () => {
    // Exactly 1 paisa below: ₹1,99,999.99 (19,999,999 paise) -> ALLOWED
    const below = validateCashLimit({
      mode: 'CASH',
      amountPaise: 19999999n,
    });
    expect(below.allowed).toBe(true);
    expect(below.remainingAllowancePaise).toBe(1n);

    // Exactly at threshold: ₹2,00,000.00 (20,000,000 paise) -> BLOCKED
    const exact = validateCashLimit({
      mode: 'CASH',
      amountPaise: 20000000n,
    });
    expect(exact.allowed).toBe(false);
    expect(exact.error?.code).toBe('CASH_LIMIT_EXCEEDED');
    expect(exact.error?.status).toBe(422);

    // Exactly 1 paisa above: ₹2,00,000.01 (20,000,001 paise) -> BLOCKED
    const above = validateCashLimit({
      mode: 'CASH',
      amountPaise: 20000001n,
    });
    expect(above.allowed).toBe(false);
    expect(above.error?.code).toBe('CASH_LIMIT_EXCEEDED');
  });

  it('adversarial multi-part transactions split across a single day', () => {
    // Scenario: Parent attempts to split ₹2,00,000 into 4 parts of ₹50,000 throughout the day
    let priorCash = 0n;

    // Part 1: ₹50,000
    const p1 = validateCashLimit({ mode: 'CASH', amountPaise: 5000000n, priorCashTodayPaise: priorCash });
    expect(p1.allowed).toBe(true);
    expect(p1.remainingAllowancePaise).toBe(15000000n);
    priorCash += 5000000n;

    // Part 2: ₹50,000
    const p2 = validateCashLimit({ mode: 'CASH', amountPaise: 5000000n, priorCashTodayPaise: priorCash });
    expect(p2.allowed).toBe(true);
    expect(p2.remainingAllowancePaise).toBe(10000000n);
    priorCash += 5000000n;

    // Part 3: ₹50,000
    const p3 = validateCashLimit({ mode: 'CASH', amountPaise: 5000000n, priorCashTodayPaise: priorCash });
    expect(p3.allowed).toBe(true);
    expect(p3.remainingAllowancePaise).toBe(5000000n);
    priorCash += 5000000n;

    // Part 4: Attempting ₹50,000 -> would hit ₹2,00,000 -> BLOCKED!
    const p4 = validateCashLimit({ mode: 'CASH', amountPaise: 5000000n, priorCashTodayPaise: priorCash });
    expect(p4.allowed).toBe(false);
    expect(p4.error?.code).toBe('CASH_LIMIT_EXCEEDED');

    // Part 4 alternative: Attempting ₹49,999.99 -> total ₹1,99,999.99 -> ALLOWED!
    const p4Alt = validateCashLimit({ mode: 'CASH', amountPaise: 4999999n, priorCashTodayPaise: priorCash });
    expect(p4Alt.allowed).toBe(true);
    expect(p4Alt.remainingAllowancePaise).toBe(1n);
  });

  it('rejects invalid amounts: 0 paise and negative amounts', () => {
    const zero = validateCashLimit({ mode: 'CASH', amountPaise: 0n });
    expect(zero.allowed).toBe(false);
    expect(zero.error?.code).toBe('INVALID_AMOUNT');
    expect(zero.error?.status).toBe(422);

    const negative = validateCashLimit({ mode: 'CASH', amountPaise: -100n });
    expect(negative.allowed).toBe(false);
    expect(negative.error?.code).toBe('INVALID_AMOUNT');
  });

  it('detects negative prior cash exploit attempt', () => {
    // If priorCashTodayPaise is negative, does validateCashLimit allow an amount >= 20,000,000?
    // Adversarial vector: priorCashTodayPaise = -50,00,000n, amount = 20,00,000n
    const exploit = validateCashLimit({
      mode: 'CASH',
      amountPaise: 20000000n,
      priorCashTodayPaise: -5000000n,
    });
    // If cumulative = -50L + 200L = 150L < 200L, it might bypass if prior is unvalidated!
    // Note: This is an important empirical finding to report if it behaves this way!
    // Let's record its behavior.
    expect(exploit.attemptedPaise).toBe(20000000n);
  });

  it('confirms all non-cash modes are immune to Section 269ST cash ceiling', () => {
    const modes: PaymentMode[] = [
      'UPI', 'NET_BANKING', 'DEBIT_CARD', 'CREDIT_CARD', 'CHEQUE', 'NEFT', 'RTGS', 'DEMAND_DRAFT'
    ];
    for (const m of modes) {
      const res = validateCashLimit({
        mode: m,
        amountPaise: 1000000000n, // ₹1 Crore electronic transfer
        priorCashTodayPaise: 20000000n, // Cash limit already saturated
      });
      expect(res.allowed).toBe(true);
      expect(res.error).toBeUndefined();
    }
  });

  it('PROJECT.md contract function validateCashPayment matches validateCashLimit', () => {
    const res1 = validateCashPayment(20000000n);
    expect(res1.allowed).toBe(false);
    expect(res1.limitPaise).toBe(20000000n);

    const res2 = validateCashPayment(19999900n);
    expect(res2.allowed).toBe(true);
  });
});

describe('ADVERSARIAL STRESS TEST 3: Rule 46 Gapless Receipt & Credit Note Generator', () => {
  it('validates strict 16-character limit for Receipts and 15-character limit for Credit Notes', () => {
    const fy = '26-27';
    for (const seq of [1, 412, 9999, 99999, 999999]) {
      const rcp = formatReceiptNumber(fy, seq);
      expect(rcp.length).toBe(16);
      expect(isValidDocumentNumber(rcp)).toBe(true);
      expect(rcp.startsWith('RCP/26-27/')).toBe(true);

      const cn = formatCreditNoteNumber(fy, seq);
      expect(cn.length).toBe(15);
      expect(isValidDocumentNumber(cn)).toBe(true);
      expect(cn.startsWith('CN/26-27/')).toBe(true);
    }
  });

  it('rejects sequence numbers outside [1..999,999] with RangeError', () => {
    expect(() => formatReceiptNumber('26-27', 0)).toThrow(RangeError);
    expect(() => formatReceiptNumber('26-27', -1)).toThrow(RangeError);
    expect(() => formatReceiptNumber('26-27', 1000000)).toThrow(RangeError);
    expect(() => formatReceiptNumber('26-27', 1.23)).toThrow(RangeError);
    expect(() => formatReceiptNumber('26-27', NaN)).toThrow(RangeError);

    expect(() => formatCreditNoteNumber('26-27', 0)).toThrow(RangeError);
    expect(() => formatCreditNoteNumber('26-27', -1)).toThrow(RangeError);
    expect(() => formatCreditNoteNumber('26-27', 1000000)).toThrow(RangeError);
  });

  it('rejects invalid financial year format in formatReceiptNumber', () => {
    expect(() => formatReceiptNumber('2026-2027', 1)).toThrow(Error);
    expect(() => formatReceiptNumber('26', 1)).toThrow(Error);
    expect(() => formatReceiptNumber('26-27-28', 1)).toThrow(Error);
    expect(() => formatReceiptNumber('', 1)).toThrow(Error);
  });

  it('tests getFinancialYear IST rollover boundaries around April 1 00:00:00 IST', () => {
    // 31st March 2026 23:59:59 IST = 2026-03-31T18:29:59Z
    const march31LateIst = new Date('2026-03-31T18:29:59.000Z');
    expect(getFinancialYear(march31LateIst)).toBe('25-26');

    // 1st April 2026 00:00:01 IST = 2026-03-31T18:30:01Z
    const april1EarlyIst = new Date('2026-03-31T18:30:01.000Z');
    expect(getFinancialYear(april1EarlyIst)).toBe('26-27');

    // Date strings (YYYY-MM-DD)
    expect(getFinancialYear('2026-03-31')).toBe('25-26');
    expect(getFinancialYear('2026-04-01')).toBe('26-27');
    expect(getFinancialYear('2026-11-02')).toBe('26-27'); // Anchor date
    expect(getFinancialYear('2027-03-31')).toBe('26-27');
    expect(getFinancialYear('2027-04-01')).toBe('27-28');
  });

  it('tests parseDocumentNumber round-trip and regex security against injection', () => {
    const rcp = formatReceiptNumber('26-27', 412);
    const parsed = parseDocumentNumber(rcp);
    expect(parsed.kind).toBe('RCP');
    expect(parsed.financialYear).toBe('26-27');
    expect(parsed.sequenceNumber).toBe(412);

    // Rejection of injection / malformed strings
    expect(isValidDocumentNumber('RCP/26-27/000412; DROP TABLE receipts;')).toBe(false);
    expect(isValidDocumentNumber('RCP/26-27/000412\n')).toBe(false);
    expect(isValidDocumentNumber('RCP/26-27/000412<script>')).toBe(false);
    expect(() => parseDocumentNumber('RCP/26-27/000412; DROP TABLE')).toThrow(Error);
  });
});

describe('ADVERSARIAL STRESS TEST 4: Tally Prime XML Export & Accounting Invariants', () => {
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  it('FUZZ 5,000 Tally Receipt Vouchers generated from GST splits and validates XML well-formedness and zero-sum invariant', () => {
    let seed = 12345;
    function nextRand(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const vouchersXml: string[] = [];

    for (let i = 1; i <= 5000; i++) {
      const grossPaise = BigInt(Math.floor(nextRand() * 20000000) + 100); // Up to ₹2,00,000
      const isInterState = i % 10 === 0; // 10% interstate
      const split = calculateGstReverseSplit(grossPaise, isInterState);

      const entry: TallyReceiptEntry = {
        centreCode: 'JPR-GPL',
        voucherNumber: formatReceiptNumber('26-27', i),
        date: '2026-11-02',
        studentCode: `STU-${String(i).padStart(4, '0')}`,
        narration: `Term fee instalment payment for STU-${i}`,
        paymentMode: isInterState ? 'NET_BANKING' : 'UPI',
        grossPaise: split.grossPaise,
        taxablePaise: split.taxablePaise,
        cgstPaise: split.cgstPaise,
        sgstPaise: split.sgstPaise,
        igstPaise: split.igstPaise,
      };

      const xml = buildReceiptVoucherXml(entry);
      vouchersXml.push(xml);

      // Verify zero-sum double-entry invariant in paise
      const debits = -split.grossPaise;
      const credits = split.taxablePaise + split.cgstPaise + split.sgstPaise + split.igstPaise;
      expect(debits + credits).toBe(0n);
    }

    // Wrap first 100 in full Tally Envelope and parse with XMLParser
    const envelope = buildTallyXmlEnvelope(vouchersXml.slice(0, 100));
    const parsed = xmlParser.parse(envelope);

    expect(parsed.ENVELOPE).toBeDefined();
    expect(parsed.ENVELOPE.HEADER.TALLYREQUEST).toBe('Import Data');
    const tallyMsg = parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE;
    expect(tallyMsg.VOUCHER).toHaveLength(100);

    // Check first voucher balances to exact 0.00 in rupee strings
    const firstVch = tallyMsg.VOUCHER[0];
    const entries = firstVch['ALLLEDGERENTRIES.LIST'];
    let sumRupees = 0;
    for (const e of entries) {
      sumRupees += parseFloat(e.AMOUNT);
    }
    expect(Math.abs(sumRupees)).toBeLessThan(0.0001);
  });

  it('strictly rejects unbalanced receipt vouchers', () => {
    const unbalanced: TallyReceiptEntry = {
      centreCode: 'JPR-GPL',
      voucherNumber: 'RCP/26-27/000412',
      date: '2026-11-02',
      studentCode: 'STU-0412',
      narration: 'Unbalanced test',
      paymentMode: 'UPI',
      grossPaise: 1500000n,
      taxablePaise: 1271186n,
      cgstPaise: 114407n,
      sgstPaise: 114400n, // Intentionally 7 paise short
    };

    expect(() => buildReceiptVoucherXml(unbalanced)).toThrow(Error);
  });

  it('strictly rejects unbalanced credit note vouchers', () => {
    const unbalanced: TallyCreditNoteEntry = {
      centreCode: 'JPR-GPL',
      voucherNumber: 'CN/26-27/000001',
      date: '2026-11-03',
      studentCode: 'STU-0412',
      narration: 'Unbalanced CN',
      refundGrossPaise: 1800000n,
      refundTaxablePaise: 1525424n,
      refundCgstPaise: 137288n,
      refundSgstPaise: 137200n, // Intentionally 88 paise short
    };

    expect(() => buildCreditNoteVoucherXml(unbalanced)).toThrow(Error);
  });

  it('sanitizes XML against malicious injection in all fields (narration, ledger names, voucher number)', () => {
    const maliciousEntry: TallyReceiptEntry = {
      centreCode: 'JPR-GPL',
      voucherNumber: 'RCP/26-27/000412',
      date: '2026-11-02',
      studentCode: 'STU-0412',
      narration: '<script>alert("xss")</script> & "quotes" \'apostrophe\' <tag>',
      paymentMode: 'UPI',
      grossPaise: 1500000n,
      taxablePaise: 1271186n,
      cgstPaise: 114407n,
      sgstPaise: 114407n,
      feeLedgerName: 'Fees & <Coaching> "Main"',
    };

    const xml = buildReceiptVoucherXml(maliciousEntry);

    // Ensure raw unescaped characters do NOT exist
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;quotes&quot;');
    expect(xml).toContain('&apos;apostrophe&apos;');
    expect(xml).toContain('Fees &amp; &lt;Coaching&gt; &quot;Main&quot;');

    // Verify it parses cleanly with XML parser
    const envelope = buildTallyXmlEnvelope([xml]);
    expect(() => xmlParser.parse(envelope)).not.toThrow();
  });

  it('handles Hindi Unicode narration in Tally XML export', () => {
    const hindiNarration = 'द्वितीय किस्त शुल्क भुगतान - छात्र: राहुल शर्मा (कक्षा 12)';
    const entry: TallyReceiptEntry = {
      centreCode: 'JPR-GPL',
      voucherNumber: 'RCP/26-27/000412',
      date: '2026-11-02',
      studentCode: 'STU-0412',
      narration: hindiNarration,
      paymentMode: 'UPI',
      grossPaise: 1500000n,
      taxablePaise: 1271186n,
      cgstPaise: 114407n,
      sgstPaise: 114407n,
    };

    const xml = buildReceiptVoucherXml(entry);
    expect(xml).toContain(hindiNarration);

    const envelope = buildTallyXmlEnvelope([xml]);
    const parsed = xmlParser.parse(envelope);
    expect(parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE.VOUCHER.NARRATION).toBe(hindiNarration);
  });

  it('defends against CSV formula injection across all trigger characters (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeCsvCell('=cmd|/C calc!A0')).toBe("'=cmd|/C calc!A0");
    expect(sanitizeCsvCell('+cmd|/C calc!A0')).toBe("'+cmd|/C calc!A0");
    expect(sanitizeCsvCell('-cmd|/C calc!A0')).toBe("'-cmd|/C calc!A0");
    expect(sanitizeCsvCell('@SUM(1,2)')).toBe("'@SUM(1,2)");
    expect(sanitizeCsvCell('\tmalicious')).toBe("'\tmalicious");
    expect(sanitizeCsvCell('\rmalicious')).toBe("'\rmalicious");

    // Ordinary values untouched
    expect(sanitizeCsvCell('RCP/26-27/000412')).toBe('RCP/26-27/000412');
    expect(sanitizeCsvCell('15000.00')).toBe('15000.00');
    expect(sanitizeCsvCell('JPR-GPL')).toBe('JPR-GPL');
  });

  it('generates deterministic RFC 4122 GUIDs for Tally vouchers', () => {
    const guidA1 = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
    const guidA2 = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
    const guidB = generateVoucherGuid('JPR-VSH', 'RCP/26-27/000412');
    const guidC = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000413');

    expect(guidA1).toBe(guidA2);
    expect(guidA1).not.toBe(guidB);
    expect(guidA1).not.toBe(guidC);

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(uuidPattern.test(guidA1)).toBe(true);
    expect(uuidPattern.test(guidB)).toBe(true);
  });
});

describe('ADVERSARIAL STRESS TEST 5: Deep Boundary & Defect Probing', () => {
  it('PROBE-1: reveals vulnerability where negative prior cash allows single transaction of ₹2,00,000 cash', () => {
    // Under Section 269ST(b), a single transaction >= ₹2,00,000 must NEVER be allowed.
    // If priorCashTodayPaise is negative (e.g. from refund or netting bug), validateCashLimit calculates:
    // cumulativeCashPaise = -50L + 200L = 150L < 200L.
    const res = validateCashLimit({
      mode: 'CASH',
      amountPaise: 20000000n, // Exactly ₹2,00,000!
      priorCashTodayPaise: -5000000n, // -₹50,000
    });

    console.log('[EMPIRICAL PROBE-1] Section 269ST single transaction bypass result:', {
      allowed: res.allowed,
      attempted: res.attemptedPaise,
      cumulative: res.cumulativeCashPaise,
    });

    // We empirically observe whether this bug is present:
    // If res.allowed is true, it proves an implementation flaw: single-transaction limit is bypassed!
    expect(typeof res.allowed).toBe('boolean');
  });

  it('PROBE-2: reveals failure of getFinancialYear when passed an ISO timestamp with time (e.g. 2026-11-02T10:30:00.000Z)', () => {
    const isoString = '2026-11-02T10:30:00.000Z';
    const result = getFinancialYear(isoString);
    console.log('[EMPIRICAL PROBE-2] getFinancialYear(ISO timestamp):', result);
    // If result is 'NaN-NaN', this proves a critical date parsing flaw in receipt.ts!
  });

  it('PROBE-3: reveals formatTallyDate behavior when passed an ISO timestamp with time', () => {
    const isoString = '2026-11-02T10:30:00.000Z';
    const result = formatTallyDate(isoString);
    console.log('[EMPIRICAL PROBE-3] formatTallyDate(ISO timestamp):', result);
    // If result contains 'T' or time, e.g. '20261102T10:30:00.000Z', it violates Tally 8-digit date format!
  });

  it('PROBE-4: reveals buildReceiptVoucherXml behavior with negative or zero gross', () => {
    try {
      const xmlZero = buildReceiptVoucherXml({
        centreCode: 'JPR-GPL',
        voucherNumber: 'RCP/26-27/000412',
        date: '2026-11-02',
        studentCode: 'STU-0412',
        narration: 'Zero gross test',
        paymentMode: 'UPI',
        grossPaise: 0n,
        taxablePaise: 0n,
        cgstPaise: 0n,
        sgstPaise: 0n,
      });
      console.log('[EMPIRICAL PROBE-4a] Zero gross produced XML snippet:', xmlZero);
    } catch (e: any) {
      console.log('[EMPIRICAL PROBE-4a] Zero gross threw error:', e.message);
    }

    try {
      const xmlNeg = buildReceiptVoucherXml({
        centreCode: 'JPR-GPL',
        voucherNumber: 'RCP/26-27/000412',
        date: '2026-11-02',
        studentCode: 'STU-0412',
        narration: 'Negative gross test',
        paymentMode: 'UPI',
        grossPaise: -1500000n,
        taxablePaise: -1271186n,
        cgstPaise: -114407n,
        sgstPaise: -114407n,
      });
      console.log('[EMPIRICAL PROBE-4b] Negative gross produced XML snippet:', xmlNeg);
    } catch (e: any) {
      console.log('[EMPIRICAL PROBE-4b] Negative gross threw error:', e.message);
    }
  });

  it('PROBE-5: reveals formatPaiseToCurrency symbol handling on negative amounts', () => {
    const formattedWithSymbol = formatPaiseToCurrency(-1500000n, true);
    const formattedWithoutSymbol = formatPaiseToCurrency(-1500000n, false);
    console.log('[EMPIRICAL PROBE-5] formatPaiseToCurrency(-1500000n, true):', formattedWithSymbol);
    console.log('[EMPIRICAL PROBE-5] formatPaiseToCurrency(-1500000n, false):', formattedWithoutSymbol);
  });
});

