/**
 * CSV Bulk Student Academic Upload Parser & Validation Engine
 * File: src/domain/csvUpload.ts
 *
 * Implements PRD § 11.1 (TC-19) and FR-RSK-01:
 * - Line-by-line validation of student academic records (studentCode, attendancePercent, testPercentile)
 * - Structured error reporting with exact line numbers
 * - SHA-256 hash computation for duplicate file detection
 * - All-or-nothing rollback atomicity
 */

import crypto from 'crypto';

export interface CsvAcademicRow {
  lineNumber: number;
  studentCode: string;
  attendancePercent: number;
  testPercentile: number;
}

export interface CsvLineError {
  lineNumber: number;
  studentCode?: string;
  field?: string;
  error: string;
}

export interface CsvParseResult {
  valid: boolean;
  fileHash: string;
  totalLines: number;
  validRows: CsvAcademicRow[];
  errors: CsvLineError[];
}

/**
 * Computes deterministic SHA-256 hash of CSV content.
 */
export function computeCsvSha256(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Parses and validates academic CSV content line-by-line.
 */
export function parseAcademicCsv(content: string): CsvParseResult {
  const fileHash = computeCsvSha256(content);
  const errors: CsvLineError[] = [];
  const validRows: CsvAcademicRow[] = [];

  if (!content || !content.trim()) {
    return {
      valid: false,
      fileHash,
      totalLines: 0,
      validRows: [],
      errors: [{ lineNumber: 1, error: 'CSV file is empty' }],
    };
  }

  const rawLines = content.split(/\r?\n/);
  if (rawLines.length === 0) {
    return {
      valid: false,
      fileHash,
      totalLines: 0,
      validRows: [],
      errors: [{ lineNumber: 1, error: 'CSV file contains no rows' }],
    };
  }

  // Header validation
  const header = rawLines[0].trim();
  const headerCols = header.split(',').map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const hasExpectedHeaders =
    headerCols.length >= 3 &&
    (headerCols[0].includes('student') || headerCols[0].includes('code')) &&
    headerCols[1].includes('attendance') &&
    (headerCols[2].includes('test') || headerCols[2].includes('percentile') || headerCols[2].includes('score'));

  if (!hasExpectedHeaders) {
    errors.push({
      lineNumber: 1,
      error: 'Invalid CSV header. Expected: studentCode,attendancePercent,testPercentile',
    });
  }

  for (let i = 1; i < rawLines.length; i++) {
    const lineNumber = i + 1; // 1-based index
    const line = rawLines[i].trim();
    if (!line) continue; // skip trailing empty lines

    const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) {
      errors.push({
        lineNumber,
        error: `Incomplete row: expected 3 columns, found ${cols.length}`,
      });
      continue;
    }

    const [rawStudentCode, rawAtt, rawTest] = cols;

    // 1. studentCode validation
    const studentCode = rawStudentCode.trim().toUpperCase();
    if (!studentCode) {
      errors.push({
        lineNumber,
        field: 'studentCode',
        error: 'studentCode cannot be empty',
      });
      continue;
    }

    // 2. attendancePercent validation (0 to 100)
    const attendancePercent = parseFloat(rawAtt);
    let hasRowError = false;

    if (isNaN(attendancePercent) || attendancePercent < 0 || attendancePercent > 100) {
      errors.push({
        lineNumber,
        studentCode,
        field: 'attendancePercent',
        error: `Invalid attendance percentage '${rawAtt}'. Must be a number between 0 and 100.`,
      });
      hasRowError = true;
    }

    // 3. testPercentile validation (0 to 100)
    const testPercentile = parseFloat(rawTest);
    if (isNaN(testPercentile) || testPercentile < 0 || testPercentile > 100) {
      errors.push({
        lineNumber,
        studentCode,
        field: 'testPercentile',
        error: `Invalid test percentile '${rawTest}'. Must be a number between 0 and 100.`,
      });
      hasRowError = true;
    }

    if (!hasRowError) {
      validRows.push({
        lineNumber,
        studentCode,
        attendancePercent,
        testPercentile,
      });
    }
  }

  return {
    valid: errors.length === 0,
    fileHash,
    totalLines: rawLines.length,
    validRows: errors.length === 0 ? validRows : [],
    errors,
  };
}
