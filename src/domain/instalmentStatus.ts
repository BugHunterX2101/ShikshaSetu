/**
 * Instalment Status State Machine & Multi-Centre Ageing Buckets
 * File: src/domain/instalmentStatus.ts
 *
 * Requirements:
 * - TC-01: Deterministic state calculation from amounts, due date, and viewing date (Anchor: 2026-11-02).
 *   STU-0412 -> PAID (₹0 balance, 'Paid' / 'चुकाया गया')
 *   STU-0587 -> PART_PAID_OVERDUE (23 days late, ₹15,000 balance, 'Part paid, 23 days overdue' / 'आंशिक भुगतान, 23 दिन अतिदेय')
 *   STU-0219 -> UPCOMING (due in 13 days, ₹40,000 balance, 'Due in 13 days' / '13 दिन में देय')
 *   Boundaries: d = 0 ('Due today' / 'आज देय'), d = 1 ('1 day overdue' / '1 दिन अतिदेय').
 * - TC-06: Multi-centre ageing buckets (NOT_DUE: d <= 0, D1_30: 1 <= d <= 30, D31_60: 31 <= d <= 60, D61_PLUS: d >= 61).
 *   Invariant: Buckets sum strictly to total open balance.
 */

export type InstalmentState =
  | 'CANCELLED_ON_REFUND'
  | 'PAID'
  | 'UPCOMING'
  | 'PART_PAID_UPCOMING'
  | 'OVERDUE'
  | 'PART_PAID_OVERDUE';

export interface InstalmentStatusResult {
  state: InstalmentState;
  balancePaise: bigint;
  daysDiff: number; // positive = overdue, negative = days until due
  labelEn: string;
  labelHi: string;
}

export type AgeingBucket = 'NOT_DUE' | 'D1_30' | 'D31_60' | 'D61_PLUS';

export interface AgeingSummary {
  notDuePaise: bigint;
  d1_30Paise: bigint;
  d31_60Paise: bigint;
  d61_plusPaise: bigint;
  totalOpenPaise: bigint;
}

/**
 * Computes instalment status and bilingual labels given amount due, paid, due date, and as-of date.
 */
export function computeInstalmentStatus(
  amountDuePaise: bigint,
  amountPaidPaise: bigint,
  dueDateStr: string,
  asOfDateStr: string,
  cancelledAt?: string | null
): InstalmentStatusResult {
  if (cancelledAt) {
    return {
      state: 'CANCELLED_ON_REFUND',
      balancePaise: 0n,
      daysDiff: 0,
      labelEn: 'Cancelled',
      labelHi: 'रद्द',
    };
  }

  const balancePaise = amountPaidPaise >= amountDuePaise ? 0n : amountDuePaise - amountPaidPaise;
  const isFullyPaid = amountPaidPaise >= amountDuePaise;
  const isPartPaid = amountPaidPaise > 0n && amountPaidPaise < amountDuePaise;

  const [dueY, dueM, dueD] = dueDateStr.split('-').map(Number);
  const [asOfY, asOfM, asOfD] = asOfDateStr.split('-').map(Number);
  const dueUtc = Date.UTC(dueY, dueM - 1, dueD);
  const asOfUtc = Date.UTC(asOfY, asOfM - 1, asOfD);
  const diffDays = Math.round((asOfUtc - dueUtc) / (1000 * 60 * 60 * 24));

  if (isFullyPaid) {
    return {
      state: 'PAID',
      balancePaise: 0n,
      daysDiff: diffDays,
      labelEn: 'Paid',
      labelHi: 'चुकाया गया',
    };
  }

  if (diffDays <= 0) {
    const daysUntil = -diffDays;
    const state = isPartPaid ? 'PART_PAID_UPCOMING' : 'UPCOMING';
    const dueLabelEn = daysUntil === 0 ? 'Due today' : `Due in ${daysUntil} days`;
    const dueLabelHi = daysUntil === 0 ? 'आज देय' : `${daysUntil} दिन में देय`;

    return {
      state,
      balancePaise,
      daysDiff: diffDays,
      labelEn: isPartPaid ? `Part paid, ${dueLabelEn.toLowerCase()}` : dueLabelEn,
      labelHi: isPartPaid ? `आंशिक भुगतान, ${dueLabelHi}` : dueLabelHi,
    };
  }

  // Overdue (diffDays >= 1)
  const state = isPartPaid ? 'PART_PAID_OVERDUE' : 'OVERDUE';
  const overdueEn = diffDays === 1 ? '1 day overdue' : `${diffDays} days overdue`;
  const overdueHi = `${diffDays} दिन अतिदेय`;

  return {
    state,
    balancePaise,
    daysDiff: diffDays,
    labelEn: isPartPaid ? `Part paid, ${overdueEn}` : overdueEn,
    labelHi: isPartPaid ? `आंशिक भुगतान, ${overdueHi}` : overdueHi,
  };
}

/**
 * Classifies days overdue into standard ageing buckets.
 * NOT_DUE: <= 0 days
 * D1_30: 1 to 30 days
 * D31_60: 31 to 60 days
 * D61_PLUS: >= 61 days
 */
export function classifyAgeingBucket(daysOverdue: number): AgeingBucket {
  if (daysOverdue <= 0) return 'NOT_DUE';
  if (daysOverdue <= 30) return 'D1_30';
  if (daysOverdue <= 60) return 'D31_60';
  return 'D61_PLUS';
}

/**
 * Calculates multi-centre ageing totals across a list of items.
 * Guarantees that bucket amounts sum strictly to total open balance.
 */
export function calculateAgeing(
  items: Array<{ amountDuePaise: bigint; amountPaidPaise: bigint; dueDateStr: string }>,
  asOfDateStr: string
): AgeingSummary {
  const [asOfY, asOfM, asOfD] = asOfDateStr.split('-').map(Number);
  const asOfUtc = Date.UTC(asOfY, asOfM - 1, asOfD);

  let notDuePaise = 0n;
  let d1_30Paise = 0n;
  let d31_60Paise = 0n;
  let d61_plusPaise = 0n;

  for (const item of items) {
    if (item.amountPaidPaise >= item.amountDuePaise) continue;
    const openPaise = item.amountDuePaise - item.amountPaidPaise;

    const [dueY, dueM, dueD] = item.dueDateStr.split('-').map(Number);
    const dueUtc = Date.UTC(dueY, dueM - 1, dueD);
    const diffDays = Math.round((asOfUtc - dueUtc) / (1000 * 60 * 60 * 24));
    const bucket = classifyAgeingBucket(diffDays);

    switch (bucket) {
      case 'NOT_DUE':
        notDuePaise += openPaise;
        break;
      case 'D1_30':
        d1_30Paise += openPaise;
        break;
      case 'D31_60':
        d31_60Paise += openPaise;
        break;
      case 'D61_PLUS':
        d61_plusPaise += openPaise;
        break;
    }
  }

  const totalOpenPaise = notDuePaise + d1_30Paise + d31_60Paise + d61_plusPaise;
  return { notDuePaise, d1_30Paise, d31_60Paise, d61_plusPaise, totalOpenPaise };
}
