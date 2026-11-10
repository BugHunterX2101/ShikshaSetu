/**
 * Tally Prime XML & CSV Export Generator
 * File: src/domain/tallyExport.ts
 *
 * Accounting Conventions:
 * - Tally Prime uses double-entry balancing where all ledger line items sum strictly to 0.00.
 * - Sign Rule:
 *     Debited ledger:  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE> with a negative amount (e.g. -15000.00)
 *     Credited ledger: <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>  with a positive amount (e.g. 12711.86)
 * - Sum check: -15000.00 + 12711.86 + 1144.07 + 1144.07 === 0.00
 * - Deterministic GUID: SHA-256(centreCode:voucherNumber) formatted as 8-4-4-4-12 UUID.
 * - CSV formula injection sanitation: Prefix cell values starting with =, +, -, @ with '.
 */

import { createHash } from 'node:crypto';
import { PaymentMode } from './cashLimit';
import { formatPaiseToRupees } from './gst';

export interface TallyReceiptEntry {
  centreCode: string;
  voucherNumber: string; // 'RCP/26-27/000412'
  date: string; // 'YYYY-MM-DD'
  studentCode: string;
  narration: string;
  paymentMode: PaymentMode;
  grossPaise: bigint;
  taxablePaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise?: bigint;
  bankLedgerName?: string;
  feeLedgerName?: string;
  cgstLedgerName?: string;
  sgstLedgerName?: string;
  igstLedgerName?: string;
}

export interface TallyCreditNoteEntry {
  centreCode: string;
  voucherNumber: string; // 'CN/26-27/000001'
  date: string; // 'YYYY-MM-DD'
  studentCode: string;
  narration: string;
  refundGrossPaise: bigint;
  refundTaxablePaise: bigint;
  refundCgstPaise: bigint;
  refundSgstPaise: bigint;
  refundIgstPaise?: bigint;
  bankLedgerName?: string;
  feeLedgerName?: string;
  cgstLedgerName?: string;
  sgstLedgerName?: string;
  igstLedgerName?: string;
}

/**
 * Escapes XML special characters: &, <, >, ", '
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Computes deterministic RFC 4122-style UUID from SHA-256(centreCode:voucherNumber).
 */
export function generateVoucherGuid(centreCode: string, voucherNumber: string): string {
  const hash = createHash('sha256')
    .update(`${centreCode}:${voucherNumber}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Converts 'YYYY-MM-DD' to Tally format 'YYYYMMDD'
 */
export function formatTallyDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Resolves standard ledger name based on payment mode.
 */
export function resolveBankLedgerName(mode: PaymentMode, customName?: string): string {
  if (customName) return customName;
  switch (mode) {
    case 'CASH':
      return 'Cash-in-Hand';
    case 'UPI':
    case 'NET_BANKING':
    case 'DEBIT_CARD':
    case 'CREDIT_CARD':
      return 'Razorpay Clearing';
    case 'CHEQUE':
    case 'DEMAND_DRAFT':
      return 'Cheque Clearing Account';
    case 'NEFT':
    case 'RTGS':
      return 'Bank Current Account';
    default:
      return 'Bank Account';
  }
}

/**
 * Generates single <VOUCHER> XML string for a Receipt voucher.
 * Enforces zero-sum double-entry rule.
 */
export function buildReceiptVoucherXml(entry: TallyReceiptEntry): string {
  const {
    centreCode,
    voucherNumber,
    date,
    narration,
    paymentMode,
    grossPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise = 0n,
    feeLedgerName = 'Coaching Fees',
    cgstLedgerName = 'Output CGST',
    sgstLedgerName = 'Output SGST',
    igstLedgerName = 'Output IGST',
  } = entry;

  // Zero-sum integrity check
  const calculatedSum = taxablePaise + cgstPaise + sgstPaise + igstPaise;
  if (calculatedSum !== grossPaise) {
    throw new Error(
      `Receipt Voucher ${voucherNumber} does not balance! Gross: ${grossPaise}, Credits: ${calculatedSum}`
    );
  }

  const guid = generateVoucherGuid(centreCode, voucherNumber);
  const tallyDate = formatTallyDate(date);
  const bankLedger = resolveBankLedgerName(paymentMode, entry.bankLedgerName);

  // Inverted sign convention: Debited bank ledger has ISDEEMEDPOSITIVE Yes with negative amount
  const debitAmount = `-${formatPaiseToRupees(grossPaise)}`;
  const taxableAmount = formatPaiseToRupees(taxablePaise);
  const cgstAmount = formatPaiseToRupees(cgstPaise);
  const sgstAmount = formatPaiseToRupees(sgstPaise);

  let xml = `<VOUCHER VCHTYPE="Receipt" ACTION="Create" GUID="${guid}">`;
  xml += `<DATE>${tallyDate}</DATE>`;
  xml += `<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>`;
  xml += `<VOUCHERNUMBER>${escapeXml(voucherNumber)}</VOUCHERNUMBER>`;
  xml += `<NARRATION>${escapeXml(narration)}</NARRATION>`;

  // Bank debit entry (Negative amount)
  xml += `<ALLLEDGERENTRIES.LIST>`;
  xml += `<LEDGERNAME>${escapeXml(bankLedger)}</LEDGERNAME>`;
  xml += `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`;
  xml += `<AMOUNT>${debitAmount}</AMOUNT>`;
  xml += `</ALLLEDGERENTRIES.LIST>`;

  // Coaching fees credit entry (Positive amount)
  xml += `<ALLLEDGERENTRIES.LIST>`;
  xml += `<LEDGERNAME>${escapeXml(feeLedgerName)}</LEDGERNAME>`;
  xml += `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`;
  xml += `<AMOUNT>${taxableAmount}</AMOUNT>`;
  xml += `</ALLLEDGERENTRIES.LIST>`;

  // CGST credit entry
  if (cgstPaise > 0n) {
    xml += `<ALLLEDGERENTRIES.LIST>`;
    xml += `<LEDGERNAME>${escapeXml(cgstLedgerName)}</LEDGERNAME>`;
    xml += `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`;
    xml += `<AMOUNT>${cgstAmount}</AMOUNT>`;
    xml += `</ALLLEDGERENTRIES.LIST>`;
  }

  // SGST credit entry
  if (sgstPaise > 0n) {
    xml += `<ALLLEDGERENTRIES.LIST>`;
    xml += `<LEDGERNAME>${escapeXml(sgstLedgerName)}</LEDGERNAME>`;
    xml += `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`;
    xml += `<AMOUNT>${sgstAmount}</AMOUNT>`;
    xml += `</ALLLEDGERENTRIES.LIST>`;
  }

  // IGST credit entry (if inter-state)
  if (igstPaise > 0n) {
    xml += `<ALLLEDGERENTRIES.LIST>`;
    xml += `<LEDGERNAME>${escapeXml(igstLedgerName)}</LEDGERNAME>`;
    xml += `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`;
    xml += `<AMOUNT>${formatPaiseToRupees(igstPaise)}</AMOUNT>`;
    xml += `</ALLLEDGERENTRIES.LIST>`;
  }

  xml += `</VOUCHER>`;
  return xml;
}

/**
 * Generates single <VOUCHER> XML string for a Credit Note voucher.
 * In a Credit Note for refund:
 *  - Bank / Payer is credited: ISDEEMEDPOSITIVE No with positive amount
 *  - Coaching fees and Output taxes are debited (reversed): ISDEEMEDPOSITIVE Yes with negative amount
 */
export function buildCreditNoteVoucherXml(entry: TallyCreditNoteEntry): string {
  const {
    centreCode,
    voucherNumber,
    date,
    narration,
    refundGrossPaise,
    refundTaxablePaise,
    refundCgstPaise,
    refundSgstPaise,
    refundIgstPaise = 0n,
    bankLedgerName = 'Bank Current Account',
    feeLedgerName = 'Coaching Fees',
    cgstLedgerName = 'Output CGST',
    sgstLedgerName = 'Output SGST',
    igstLedgerName = 'Output IGST',
  } = entry;

  const calculatedSum = refundTaxablePaise + refundCgstPaise + refundSgstPaise + refundIgstPaise;
  if (calculatedSum !== refundGrossPaise) {
    throw new Error(
      `Credit Note Voucher ${voucherNumber} does not balance! Gross: ${refundGrossPaise}, Debits: ${calculatedSum}`
    );
  }

  const guid = generateVoucherGuid(centreCode, voucherNumber);
  const tallyDate = formatTallyDate(date);

  let xml = `<VOUCHER VCHTYPE="Credit Note" ACTION="Create" GUID="${guid}">`;
  xml += `<DATE>${tallyDate}</DATE>`;
  xml += `<VOUCHERTYPENAME>Credit Note</VOUCHERTYPENAME>`;
  xml += `<VOUCHERNUMBER>${escapeXml(voucherNumber)}</VOUCHERNUMBER>`;
  xml += `<NARRATION>${escapeXml(narration)}</NARRATION>`;

  // Fee debit reversal (Negative amount)
  xml += `<ALLLEDGERENTRIES.LIST>`;
  xml += `<LEDGERNAME>${escapeXml(feeLedgerName)}</LEDGERNAME>`;
  xml += `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`;
  xml += `<AMOUNT>-${formatPaiseToRupees(refundTaxablePaise)}</AMOUNT>`;
  xml += `</ALLLEDGERENTRIES.LIST>`;

  // CGST debit reversal
  if (refundCgstPaise > 0n) {
    xml += `<ALLLEDGERENTRIES.LIST>`;
    xml += `<LEDGERNAME>${escapeXml(cgstLedgerName)}</LEDGERNAME>`;
    xml += `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`;
    xml += `<AMOUNT>-${formatPaiseToRupees(refundCgstPaise)}</AMOUNT>`;
    xml += `</ALLLEDGERENTRIES.LIST>`;
  }

  // SGST debit reversal
  if (refundSgstPaise > 0n) {
    xml += `<ALLLEDGERENTRIES.LIST>`;
    xml += `<LEDGERNAME>${escapeXml(sgstLedgerName)}</LEDGERNAME>`;
    xml += `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`;
    xml += `<AMOUNT>-${formatPaiseToRupees(refundSgstPaise)}</AMOUNT>`;
    xml += `</ALLLEDGERENTRIES.LIST>`;
  }

  // IGST debit reversal
  if (refundIgstPaise > 0n) {
    xml += `<ALLLEDGERENTRIES.LIST>`;
    xml += `<LEDGERNAME>${escapeXml(igstLedgerName)}</LEDGERNAME>`;
    xml += `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>`;
    xml += `<AMOUNT>-${formatPaiseToRupees(refundIgstPaise)}</AMOUNT>`;
    xml += `</ALLLEDGERENTRIES.LIST>`;
  }

  // Bank credit payout (Positive amount)
  xml += `<ALLLEDGERENTRIES.LIST>`;
  xml += `<LEDGERNAME>${escapeXml(bankLedgerName)}</LEDGERNAME>`;
  xml += `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>`;
  xml += `<AMOUNT>${formatPaiseToRupees(refundGrossPaise)}</AMOUNT>`;
  xml += `</ALLLEDGERENTRIES.LIST>`;

  xml += `</VOUCHER>`;
  return xml;
}

/**
 * Builds complete Tally XML import envelope wrapping multiple vouchers.
 */
export function buildTallyXmlEnvelope(vouchersXml: string[]): string {
  let xml = `<ENVELOPE>`;
  xml += `<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>`;
  xml += `<BODY><IMPORTDATA><REQUESTDATA>`;
  xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF">`;
  xml += vouchersXml.join('');
  xml += `</TALLYMESSAGE>`;
  xml += `</REQUESTDATA></IMPORTDATA></BODY>`;
  xml += `</ENVELOPE>`;
  return xml;
}

/**
 * Sanitizes a single cell against CSV formula injection.
 * Prefixes cells starting with '=', '+', '-', '@' with a single quote.
 */
export function sanitizeCsvCell(val: string | number): string {
  const str = String(val);
  if (str.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(str[0])) {
    return `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates audit CSV for financial reconciliation and Tally verification.
 */
export function generateTallyAuditCsv(entries: TallyReceiptEntry[]): string {
  const headers = [
    'Date',
    'VoucherNumber',
    'CentreCode',
    'StudentCode',
    'PaymentMode',
    'GrossAmount',
    'TaxableBase',
    'CGST',
    'SGST',
    'VoucherType',
  ];

  const lines = [headers.join(',')];

  for (const e of entries) {
    const row = [
      sanitizeCsvCell(e.date),
      sanitizeCsvCell(e.voucherNumber),
      sanitizeCsvCell(e.centreCode),
      sanitizeCsvCell(e.studentCode),
      sanitizeCsvCell(e.paymentMode),
      sanitizeCsvCell(formatPaiseToRupees(e.grossPaise)),
      sanitizeCsvCell(formatPaiseToRupees(e.taxablePaise)),
      sanitizeCsvCell(formatPaiseToRupees(e.cgstPaise)),
      sanitizeCsvCell(formatPaiseToRupees(e.sgstPaise)),
      sanitizeCsvCell('Receipt'),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
