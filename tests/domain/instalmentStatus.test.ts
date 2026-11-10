import { describe, it, expect } from 'vitest';
import {
  computeInstalmentStatus,
  classifyAgeingBucket,
  calculateAgeing,
} from '../../src/domain/instalmentStatus';

describe('TC-01: Instalment Status & Due Dates on 2 Nov 2026', () => {
  const AS_OF_DATE = '2026-11-02';

  it('correctly evaluates STU-0412 as PAID with ₹0 balance', () => {
    const res = computeInstalmentStatus(3000000n, 3000000n, '2026-07-10', AS_OF_DATE);
    expect(res.state).toBe('PAID');
    expect(res.balancePaise).toBe(0n);
    expect(res.labelEn).toBe('Paid');
    expect(res.labelHi).toBe('चुकाया गया');
  });

  it('correctly evaluates STU-0587 as PART_PAID_OVERDUE (23 days late, ₹15,000 balance)', () => {
    const res = computeInstalmentStatus(3000000n, 1500000n, '2026-10-10', AS_OF_DATE);
    expect(res.state).toBe('PART_PAID_OVERDUE');
    expect(res.balancePaise).toBe(1500000n);
    expect(res.daysDiff).toBe(23);
    expect(res.labelEn).toBe('Part paid, 23 days overdue');
    expect(res.labelHi).toBe('आंशिक भुगतान, 23 दिन अतिदेय');
  });

  it('correctly evaluates STU-0219 as UPCOMING (due in 13 days, ₹40,000 balance)', () => {
    const res = computeInstalmentStatus(4000000n, 0n, '2026-11-15', AS_OF_DATE);
    expect(res.state).toBe('UPCOMING');
    expect(res.balancePaise).toBe(4000000n);
    expect(res.daysDiff).toBe(-13);
    expect(res.labelEn).toBe('Due in 13 days');
    expect(res.labelHi).toBe('13 दिन में देय');
  });

  it('correctly handles boundary d = 0 (Due today)', () => {
    const res = computeInstalmentStatus(3000000n, 0n, '2026-11-02', AS_OF_DATE);
    expect(res.state).toBe('UPCOMING');
    expect(res.labelEn).toBe('Due today');
    expect(res.labelHi).toBe('आज देय');
  });

  it('correctly handles boundary d = 1 (1 day overdue)', () => {
    const res = computeInstalmentStatus(3000000n, 0n, '2026-11-01', AS_OF_DATE);
    expect(res.state).toBe('OVERDUE');
    expect(res.labelEn).toBe('1 day overdue');
    expect(res.labelHi).toBe('1 दिन अतिदेय');
  });

  it('correctly handles cancelled instalment on refund', () => {
    const res = computeInstalmentStatus(
      3000000n,
      0n,
      '2027-01-10',
      AS_OF_DATE,
      '2026-11-02T10:00:00Z'
    );
    expect(res.state).toBe('CANCELLED_ON_REFUND');
    expect(res.balancePaise).toBe(0n);
    expect(res.labelEn).toBe('Cancelled');
    expect(res.labelHi).toBe('रद्द');
  });
});

describe('TC-06: Ageing Buckets Boundary and Sum Conservation', () => {
  it('correctly classifies boundary days: 0, 1, 30, 31, 60, 61 days', () => {
    expect(classifyAgeingBucket(0)).toBe('NOT_DUE');
    expect(classifyAgeingBucket(-5)).toBe('NOT_DUE');
    expect(classifyAgeingBucket(1)).toBe('D1_30');
    expect(classifyAgeingBucket(30)).toBe('D1_30');
    expect(classifyAgeingBucket(31)).toBe('D31_60');
    expect(classifyAgeingBucket(60)).toBe('D31_60');
    expect(classifyAgeingBucket(61)).toBe('D61_PLUS');
    expect(classifyAgeingBucket(95)).toBe('D61_PLUS');
  });

  it('verifies that bucket sums strictly equal total open balance', () => {
    const AS_OF = '2026-11-02';
    const sampleItems = [
      { amountDuePaise: 3000000n, amountPaidPaise: 1500000n, dueDateStr: '2026-10-10' }, // d = 23 -> D1_30: 15,000
      { amountDuePaise: 4000000n, amountPaidPaise: 0n, dueDateStr: '2026-11-15' }, // d = -13 -> NOT_DUE: 40,000
      { amountDuePaise: 3000000n, amountPaidPaise: 0n, dueDateStr: '2026-09-20' }, // d = 43 -> D31_60: 30,000
      { amountDuePaise: 3000000n, amountPaidPaise: 0n, dueDateStr: '2026-08-01' }, // d = 93 -> D61_PLUS: 30,000
      { amountDuePaise: 3000000n, amountPaidPaise: 3000000n, dueDateStr: '2026-07-01' }, // Paid -> 0
    ];

    const summary = calculateAgeing(sampleItems, AS_OF);

    expect(summary.d1_30Paise).toBe(1500000n);
    expect(summary.notDuePaise).toBe(4000000n);
    expect(summary.d31_60Paise).toBe(3000000n);
    expect(summary.d61_plusPaise).toBe(3000000n);
    expect(summary.totalOpenPaise).toBe(11500000n);
    expect(
      summary.notDuePaise + summary.d1_30Paise + summary.d31_60Paise + summary.d61_plusPaise
    ).toBe(summary.totalOpenPaise);
  });
});
