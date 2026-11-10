import { describe, it, expect } from 'vitest';
import {
  calculateConsumedPaise,
  computeProRataRefund,
  computeProRataRefundFromDates,
  addCalendarDays,
  differenceInCalendarDays,
} from '../../src/domain/refund';

describe('TC-03: MoE Pro-Rata Refund Cases A through F', () => {
  const TUITION_NET = 12000000n; // ₹1,20,000.00 (12 million paise)
  const HOSTEL_NET = 6000000n; // ₹60,000.00 (6 million paise)
  const T = 360;

  it('Case A: Upfront full payer exits mid-course (e = 180, Paid = ₹1,20,000)', () => {
    const res = computeProRataRefund(
      '2026-10-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: TUITION_NET, courseDays: T }],
      180
    );

    expect(res.daysElapsed).toBe(180);
    expect(res.heads[0].consumedPaise).toBe(6000000n); // ₹60,000.00
    expect(res.heads[0].refundablePaise).toBe(6000000n); // ₹60,000.00
    expect(res.totalRefundablePaise).toBe(6000000n);
    expect(res.totalShortfallPaise).toBe(0n);
    expect(res.creditNoteRequired).toBe(true);
    expect(res.creditNoteTaxSplit?.taxablePaise).toBe(5084746n);
    expect(res.creditNoteTaxSplit?.cgstPaise).toBe(457627n);
    expect(res.creditNoteTaxSplit?.sgstPaise).toBe(457627n);
  });

  it('Case B: Instalment payer ahead of schedule exits (e = 216, Paid = ₹90,000)', () => {
    const res = computeProRataRefund(
      '2026-11-03',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 9000000n, courseDays: T }],
      216
    );

    expect(res.daysElapsed).toBe(216);
    expect(res.heads[0].consumedPaise).toBe(7200000n); // ₹72,000.00
    expect(res.heads[0].refundablePaise).toBe(1800000n); // ₹18,000.00
    expect(res.totalRefundablePaise).toBe(1800000n);
    expect(res.totalShortfallPaise).toBe(0n);
    expect(res.creditNoteRequired).toBe(true);
  });

  it('Case C: Part-paid student STU-0587 exits on 3 Nov 2026 (e = 216, Paid = ₹75,000)', () => {
    const res = computeProRataRefund(
      '2026-11-03',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7500000n, courseDays: T }],
      216
    );

    expect(res.daysElapsed).toBe(216);
    expect(res.heads[0].consumedPaise).toBe(7200000n); // ₹72,000.00
    expect(res.heads[0].refundablePaise).toBe(300000n); // ₹3,000.00
    expect(res.totalRefundablePaise).toBe(300000n);
    expect(res.totalShortfallPaise).toBe(0n);
  });

  it('Case D: Pre-batch exit on Day 0 (e = 0, Paid = ₹30,000)', () => {
    const res = computeProRataRefund(
      '2026-04-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 3000000n, courseDays: T }],
      0
    );

    expect(res.daysElapsed).toBe(0);
    expect(res.heads[0].consumedPaise).toBe(0n);
    expect(res.heads[0].refundablePaise).toBe(3000000n); // Full ₹30,000.00
    expect(res.totalRefundablePaise).toBe(3000000n);
    expect(res.totalShortfallPaise).toBe(0n);
  });

  it('Case E: Consumed exceeds paid (e = 216, Paid = ₹60,000, Consumed = ₹72,000)', () => {
    const res = computeProRataRefund(
      '2026-11-03',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 6000000n, courseDays: T }],
      216
    );

    expect(res.daysElapsed).toBe(216);
    expect(res.heads[0].consumedPaise).toBe(7200000n);
    expect(res.heads[0].refundablePaise).toBe(0n); // Floored at 0
    expect(res.heads[0].shortfallPaise).toBe(1200000n); // Shortfall ₹12,000.00 flagged
    expect(res.totalRefundablePaise).toBe(0n);
    expect(res.totalShortfallPaise).toBe(1200000n);
    expect(res.creditNoteRequired).toBe(false);
  });

  it('Case F: Multi-head exit without cross-subsidization (Tuition refund ₹18,000, Hostel shortfall ₹6,000)', () => {
    const res = computeProRataRefund(
      '2026-11-03',
      [
        { head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 9000000n, courseDays: T },
        { head: 'HOSTEL', netFeePaise: HOSTEL_NET, totalPaidPaise: 3000000n, courseDays: T },
      ],
      216
    );

    // Tuition: Net 120k, Paid 90k, Consumed 72k -> Refund 18k
    expect(res.heads[0].consumedPaise).toBe(7200000n);
    expect(res.heads[0].refundablePaise).toBe(1800000n);
    expect(res.heads[0].shortfallPaise).toBe(0n);

    // Hostel: Net 60k, Paid 30k, Consumed 36k -> Refund 0, Shortfall 6k
    expect(res.heads[1].consumedPaise).toBe(3600000n);
    expect(res.heads[1].refundablePaise).toBe(0n);
    expect(res.heads[1].shortfallPaise).toBe(600000n);

    // TOTAL: Strictly ₹18,000.00! NOT ₹12,000.00! (Hostel shortfall is NOT netted against tuition)
    expect(res.totalRefundablePaise).toBe(1800000n);
    expect(res.totalShortfallPaise).toBe(600000n);
  });

  it('proves mathematical invariant across all elapsed days e in [0, 360]', () => {
    const paidAmounts = [0n, 1500000n, 3000000n, 6000000n, 9000000n, 12000000n];

    for (const paid of paidAmounts) {
      for (let e = 0; e <= 360; e += 10) {
        const res = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: paid, courseDays: T }],
          e
        );

        const consumed = res.heads[0].consumedPaise;
        const refund = res.heads[0].refundablePaise;
        const shortfall = res.heads[0].shortfallPaise;

        // Invariant 1: Refund cannot be negative
        expect(refund >= 0n).toBe(true);

        // Invariant 2: Shortfall cannot be negative
        expect(shortfall >= 0n).toBe(true);

        // Invariant 3: Refund + min(Paid, Consumed) strictly equals Paid
        const minPaidConsumed = paid < consumed ? paid : consumed;
        expect(refund + minPaidConsumed).toBe(paid);

        // Invariant 4: If Consumed > Paid, Shortfall === Consumed - Paid and Refund === 0
        if (consumed > paid) {
          expect(shortfall).toBe(consumed - paid);
          expect(refund).toBe(0n);
        } else {
          expect(refund).toBe(paid - consumed);
          expect(shortfall).toBe(0n);
        }
      }
    }
  });
});

describe('TC-03b: Pro-Rata Refund from Calendar Dates & 10-Calendar-Day SLA', () => {
  const TUITION_NET = 12000000n;

  it('correctly calculates Case C on 3 Nov 2026 (e = 216 days, SLA deadline = 13 Nov 2026)', () => {
    const res = computeProRataRefundFromDates(
      '2026-11-03',
      '2026-04-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7500000n }],
      undefined,
      '2026-11-03'
    );

    expect(res.daysElapsed).toBe(216);
    expect(res.slaDueDate).toBe('2026-11-13');
    expect(res.daysRemaining).toBe(10);
    expect(res.isOverdue).toBe(false);
    expect(res.heads[0].consumedPaise).toBe(7200000n);
    expect(res.totalRefundablePaise).toBe(300000n); // ₹3,000.00
  });

  it('correctly calculates Case C on Demo Anchor Date 2 Nov 2026 (e = 215 days, SLA = 12 Nov 2026)', () => {
    const res = computeProRataRefundFromDates(
      '2026-11-02',
      '2026-04-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7500000n }],
      undefined,
      '2026-11-02'
    );

    expect(res.daysElapsed).toBe(215);
    expect(res.slaDueDate).toBe('2026-11-12');
    expect(res.daysRemaining).toBe(10);
    // Consumed = floor((2 * 12,000,000 * 215 + 360) / 720) = floor(5160000360 / 720) = 7,166,667 paise
    expect(res.heads[0].consumedPaise).toBe(7166667n);
    // Refund = 7,500,000 - 7,166,667 = 333,333 paise (₹3,333.33)
    expect(res.totalRefundablePaise).toBe(333333n);
  });

  it('correctly calculates Case B on Demo Anchor Date 2 Nov 2026 (e = 215 days, Paid = ₹90,000)', () => {
    const res = computeProRataRefundFromDates(
      '2026-11-02',
      '2026-04-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 9000000n }],
      undefined,
      '2026-11-02'
    );

    expect(res.daysElapsed).toBe(215);
    expect(res.heads[0].consumedPaise).toBe(7166667n);
    // Refund = 9,000,000 - 7,166,667 = 1,833,333 paise (₹18,333.33)
    expect(res.totalRefundablePaise).toBe(1833333n);
  });

  it('correctly tracks SLA countdown urgency and marks overdue when deadline passes', () => {
    const receivedOn = '2026-11-03';
    // SLA deadline is 2026-11-13 (10 calendar days later)

    const beforeDeadline = computeProRataRefundFromDates(
      receivedOn,
      '2026-04-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7500000n }],
      undefined,
      '2026-11-10'
    );
    expect(beforeDeadline.slaDueDate).toBe('2026-11-13');
    expect(beforeDeadline.daysRemaining).toBe(3);
    expect(beforeDeadline.isOverdue).toBe(false);

    const afterDeadline = computeProRataRefundFromDates(
      receivedOn,
      '2026-04-01',
      [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7500000n }],
      undefined,
      '2026-11-15'
    );
    expect(afterDeadline.daysRemaining).toBe(-2);
    expect(afterDeadline.isOverdue).toBe(true);
  });
});
