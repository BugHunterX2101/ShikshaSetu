/**
 * Sequential Gapless Receipt and Credit Note Numbering
 * File: src/domain/receipt.ts
 *
 * Statutory Reference:
 * - Rule 46 of CGST Rules 2017: Tax invoice / receipt must contain a consecutive serial number
 *   not exceeding sixteen characters, in one or multiple series, containing alphabets or numerals
 *   or special characters (hyphen or dash and slash symbol), unique for a financial year.
 * - Format for Receipts: RCP/YY-YY/XXXXXX (exactly 16 characters), e.g. 'RCP/26-27/000412'.
 * - Format for Credit Notes: CN/YY-YY/XXXXXX (15 characters), e.g. 'CN/26-27/000001'.
 * - Financial Year runs from April 1 through March 31.
 */

export type DocumentKind = 'RCP' | 'CN';

export interface DocumentNumberComponents {
  kind: DocumentKind;
  financialYear: string; // e.g. '26-27'
  sequenceNumber: number; // 1..999999
}

export const RECEIPT_REGEX = /^RCP\/(\d{2}-\d{2})\/(\d{6})$/;
export const CREDIT_NOTE_REGEX = /^CN\/(\d{2}-\d{2})\/(\d{6})$/;
export const DOCUMENT_REGEX = /^(RCP|CN)\/(\d{2}-\d{2})\/(\d{6})$/;

/**
 * Computes Indian Financial Year string ('26-27') from a date in IST (+05:30).
 * Indian FY starts April 1 and ends March 31.
 */
export function getFinancialYear(dateInput: Date | string): string {
  let date: Date;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    } else {
      date = new Date(dateInput);
    }
  } else {
    date = dateInput;
  }

  // Adjust to IST (+05:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + istOffsetMs);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth() + 1; // 1-12

  const startYear = month >= 4 ? year : year - 1;
  const startShort = startYear % 100;
  const endShort = (startYear + 1) % 100;

  return `${String(startShort).padStart(2, '0')}-${String(endShort).padStart(2, '0')}`;
}

/**
 * Formats a gapless receipt number: 'RCP/26-27/000412' (16 chars)
 */
export function formatReceiptNumber(financialYear: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 999999) {
    throw new RangeError(`Receipt sequence must be an integer between 1 and 999999, got ${seq}`);
  }
  if (!/^\d{2}-\d{2}$/.test(financialYear)) {
    throw new Error(`Invalid financial year format: ${financialYear}, expected YY-YY`);
  }
  const formatted = `RCP/${financialYear}/${String(seq).padStart(6, '0')}`;
  if (formatted.length > 16) {
    throw new Error(`Receipt number exceeds GST Rule 46 16-character limit: ${formatted}`);
  }
  return formatted;
}

/**
 * Formats a gapless credit note number: 'CN/26-27/000001' (15 chars)
 */
export function formatCreditNoteNumber(financialYear: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 999999) {
    throw new RangeError(`Credit note sequence must be an integer between 1 and 999999, got ${seq}`);
  }
  if (!/^\d{2}-\d{2}$/.test(financialYear)) {
    throw new Error(`Invalid financial year format: ${financialYear}, expected YY-YY`);
  }
  return `CN/${financialYear}/${String(seq).padStart(6, '0')}`;
}

/**
 * Parses a formatted document number into kind, FY, and sequence number.
 */
export function parseDocumentNumber(docNo: string): DocumentNumberComponents {
  const match = docNo.match(DOCUMENT_REGEX);
  if (!match) {
    throw new Error(`Invalid document number format: ${docNo}`);
  }
  return {
    kind: match[1] as DocumentKind,
    financialYear: match[2],
    sequenceNumber: parseInt(match[3], 10),
  };
}

/**
 * Validates that a string conforms to GST Rule 46 syntax for receipts or credit notes.
 */
export function isValidDocumentNumber(docNo: string): boolean {
  return DOCUMENT_REGEX.test(docNo);
}
