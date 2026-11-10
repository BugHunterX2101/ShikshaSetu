/**
 * MoE 2024 & Rajasthan Coaching Act 2025 Pro-Rata Refund Calculator
 * File: src/domain/refund.ts
 *
 * Statutory References:
 * - Ministry of Education (MoE) 2024 Guidelines for Regulation of Coaching Centres:
 *   Pro-rata refund of fee for the remaining period within 10 calendar days.
 * - Rajasthan Coaching Centres (Control and Regulation) Act 2025 s.13(4):
 *   Pro-rata refund of fees for the remaining period within ten days, hostel and mess included.
 * - Rule: Zero cross-subsidization between heads (Tuition, Hostel, Mess).
 *   Each head's refund is floored at zero: Refund_h = max(0, Paid_h - Consumed_h).
 *   Shortfall is tracked for Director review but never charged to the departing student (FR-REF-06).
 * - Exact Integer Paise Math:
 *   Consumed_h = floor((2 * N_h * e + T_h) / (2 * T_h))
 */

import { calculateGstReverseSplit, GstSplit } from './gst';

export type FeeHeadType = 'TUITION' | 'HOSTEL' | 'MESS';

export interface RefundHeadInput {
  head: FeeHeadType;
  netFeePaise: bigint; // Total net course fee after scholarship
  totalPaidPaise: bigint; // Total paid to date for this head
  courseDays?: number; // Defaults to 360 days
}

export interface RefundHeadResult {
  head: FeeHeadType;
  netFeePaise: bigint;
  paidPaise: bigint;
  courseDays: number;
  consumedPaise: bigint;
  refundablePaise: bigint;
  shortfallPaise: bigint;
}

export interface RefundCalculation {
  daysElapsed: number;
  totalCourseDays: number;
  receivedOn: string; // YYYY-MM-DD
  slaDueDate: string; // receivedOn + 10 calendar days
  daysRemaining?: number; // Days until SLA deadline from asOfDate
  isOverdue: boolean;
  heads: RefundHeadResult[];
  totalPaidPaise: bigint;
  totalConsumedPaise: bigint;
  totalRefundablePaise: bigint;
  totalShortfallPaise: bigint;
  creditNoteRequired: boolean;
  creditNoteTaxSplit?: GstSplit;
}

/**
 * Calculates consumed fee in integer paise using exact round-half-up integer division.
 * Formula: round_half_up(N * e / T) = floor((2 * N * e + T) / (2 * T))
 */
export function calculateConsumedPaise(
  netFeePaise: bigint,
  elapsedDays: number,
  totalDays: number
): bigint {
  if (totalDays <= 0) {
    throw new RangeError('Total course days must be strictly greater than zero');
  }
  if (netFeePaise < 0n) {
    throw new RangeError('Net fee cannot be negative');
  }

  // Elapsed days clamped between 0 and totalDays
  const clampedElapsed = Math.max(0, Math.min(elapsedDays, totalDays));
  if (clampedElapsed === 0) return 0n;
  if (clampedElapsed === totalDays) return netFeePaise;

  const e = BigInt(clampedElapsed);
  const t = BigInt(totalDays);
  return (2n * netFeePaise * e + t) / (2n * t);
}

/**
 * Adds calendar days to an ISO YYYY-MM-DD date string using UTC arithmetic.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Computes difference in calendar days between two ISO YYYY-MM-DD dates using UTC boundaries.
 */
export function differenceInCalendarDays(laterDateStr: string, earlierDateStr: string): number {
  const [y1, m1, d1] = laterDateStr.split('-').map(Number);
  const [y2, m2, d2] = earlierDateStr.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

/**
 * Computes pro-rata refund for a set of fee heads given elapsed days or dates.
 * Flexible signature supports:
 *  - computeProRataRefund(receivedOn, batchStartDate, heads, fixedDaysElapsed, asOfDate)
 *  - computeProRataRefund(receivedOn, heads, elapsedDays, asOfDate)
 */
export function computeProRataRefund(
  receivedOn: string,
  batchStartDateOrHeads: string | RefundHeadInput[],
  headsOrElapsedDays: RefundHeadInput[] | number,
  fixedDaysElapsedOrAsOfDate?: number | string,
  asOfDateParam?: string
): RefundCalculation {
  let heads: RefundHeadInput[];
  let elapsedDays: number;
  let asOfDate: string | undefined;

  if (typeof batchStartDateOrHeads === 'string') {
    // Called as: (receivedOn, batchStartDate, heads, fixedDaysElapsed?, asOfDate?)
    const batchStartDate = batchStartDateOrHeads;
    heads = headsOrElapsedDays as RefundHeadInput[];

    if (typeof fixedDaysElapsedOrAsOfDate === 'number') {
      elapsedDays = fixedDaysElapsedOrAsOfDate;
      asOfDate = asOfDateParam;
    } else {
      elapsedDays = Math.max(0, differenceInCalendarDays(receivedOn, batchStartDate));
      asOfDate = fixedDaysElapsedOrAsOfDate;
    }
  } else {
    // Called as: (receivedOn, heads, elapsedDays, asOfDate?)
    heads = batchStartDateOrHeads;
    elapsedDays = headsOrElapsedDays as number;
    asOfDate = fixedDaysElapsedOrAsOfDate as string | undefined;
  }

  let totalPaid = 0n;
  let totalConsumed = 0n;
  let totalRefundable = 0n;
  let totalShortfall = 0n;
  let maxCourseDays = 360;

  const headResults: RefundHeadResult[] = heads.map((h) => {
    const courseDays = h.courseDays ?? 360;
    maxCourseDays = Math.max(maxCourseDays, courseDays);
    const consumed = calculateConsumedPaise(h.netFeePaise, elapsedDays, courseDays);

    // Floor at zero per head: no cross-subsidization
    const refundable = h.totalPaidPaise > consumed ? h.totalPaidPaise - consumed : 0n;
    const shortfall = consumed > h.totalPaidPaise ? consumed - h.totalPaidPaise : 0n;

    totalPaid += h.totalPaidPaise;
    totalConsumed += consumed;
    totalRefundable += refundable;
    totalShortfall += shortfall;

    return {
      head: h.head,
      netFeePaise: h.netFeePaise,
      paidPaise: h.totalPaidPaise,
      courseDays,
      consumedPaise: consumed,
      refundablePaise: refundable,
      shortfallPaise: shortfall,
    };
  });

  const slaDueDate = addCalendarDays(receivedOn, 10);
  const daysRemaining = asOfDate ? differenceInCalendarDays(slaDueDate, asOfDate) : undefined;
  const isOverdue = daysRemaining !== undefined ? daysRemaining < 0 : false;

  const creditNoteRequired = totalRefundable > 0n;
  const creditNoteTaxSplit = creditNoteRequired
    ? calculateGstReverseSplit(totalRefundable)
    : undefined;

  return {
    daysElapsed: Math.max(0, Math.min(elapsedDays, maxCourseDays)),
    totalCourseDays: maxCourseDays,
    receivedOn,
    slaDueDate,
    daysRemaining,
    isOverdue,
    heads: headResults,
    totalPaidPaise: totalPaid,
    totalConsumedPaise: totalConsumed,
    totalRefundablePaise: totalRefundable,
    totalShortfallPaise: totalShortfall,
    creditNoteRequired,
    creditNoteTaxSplit,
  };
}

/**
 * Calculates pro-rata refund from calendar dates (batch start vs withdrawal received date).
 */
export function computeProRataRefundFromDates(
  receivedOn: string,
  batchStartDate: string,
  heads: RefundHeadInput[],
  enrolmentDate?: string,
  asOfDate?: string
): RefundCalculation {
  const effectiveStartDate =
    enrolmentDate && enrolmentDate > batchStartDate ? enrolmentDate : batchStartDate;
  const elapsedDays = Math.max(0, differenceInCalendarDays(receivedOn, effectiveStartDate));
  return computeProRataRefund(receivedOn, heads, elapsedDays, asOfDate);
}
