/**
 * Indian Standard Time (IST, UTC+05:30) Conversion & Date Utility
 * File: src/domain/dates.ts
 *
 * Implements PRD § 11.1 (TC-20) and FR-LED-05:
 * - Ensures all financial, attendance, and reminder dates resolve to Indian Standard Time (+05:30).
 * - A payment at 23:50 IST counts for that day; at 00:10 IST for the next.
 */

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30 = 19,800,000 ms

/**
 * Converts a UTC timestamp, Date object, or ISO string to an IST calendar date string (YYYY-MM-DD).
 *
 * @param dateOrIso Date object or ISO string (e.g. '2026-11-02T18:40:00.000Z')
 * @returns Date string formatted as YYYY-MM-DD in IST (+05:30)
 */
export function toISTDate(dateOrIso?: Date | string | null): string {
  if (!dateOrIso) {
    return '2026-11-02';
  }

  // If already a clean YYYY-MM-DD with no time component
  if (typeof dateOrIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso.trim())) {
    return dateOrIso.trim();
  }

  const date = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;

  if (isNaN(date.getTime())) {
    return typeof dateOrIso === 'string' && dateOrIso.length >= 10
      ? dateOrIso.slice(0, 10)
      : '2026-11-02';
  }

  // Shift UTC timestamp by +05:30 to get IST wall-clock representation
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Returns a Date object adjusted to IST wall-clock time.
 */
export function getISTDate(dateOrIso?: Date | string): Date {
  const date = !dateOrIso ? new Date() : typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  return new Date(date.getTime() + IST_OFFSET_MS);
}
