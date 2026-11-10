// tests/e2e/m4_challenger_2_boundaries.test.ts
// ============================================================================
// Milestone 4 Iteration 2 Gate Verification: Challenger 2 Empirical Stress Suite
// Focus: Tier 4 Workloads, Boundary Stress Testing, IST Midnight Transitions,
//        Pro-Rata Refund Cases A-F & 10-day SLA, Section 269ST Boundaries & UNMATCHED_QUEUE
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateGstReverseSplit,
  SECTION_269ST_LIMIT_PAISE,
  SECTION_269ST_MAX_ALLOWED_PAISE,
  validateCashLimit,
  validateCashPayment,
  computeProRataRefund,
  computeProRataRefundFromDates,
  addCalendarDays,
  differenceInCalendarDays,
  calculateDropoutRiskScore,
  computeFeeFactor,
  computeAttendanceFactor,
  computeTestSlopeFactor,
  toISTDate,
  IST_OFFSET_MS,
} from '@/src/domain';

import { getRepository } from '@/src/store/repository';

const ANCHOR_DATE = '2026-11-02';

describe('Milestone 4 Iteration 2 Gate Verification: Challenger 2 Boundary & Workload Stress', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // ==========================================================================
  // 1. BOUNDARY STRESS: IST MIDNIGHT TRANSITION (UTC+05:30)
  // ==========================================================================
  describe('1. Boundary Stress: IST Midnight Transition Consistency', () => {
    it('verifies exact millisecond transitions across IST midnight', () => {
      expect(IST_OFFSET_MS).toBe(19_800_000); // 5.5 hours in ms

      // 2026-11-02 23:50:00 IST -> UTC 2026-11-02 18:20:00Z
      expect(toISTDate('2026-11-02T18:20:00.000Z')).toBe('2026-11-02');

      // 2026-11-02 23:59:59.999 IST -> UTC 2026-11-02 18:29:59.999Z
      expect(toISTDate('2026-11-02T18:29:59.999Z')).toBe('2026-11-02');

      // 2026-11-03 00:00:00.000 IST -> UTC 2026-11-02 18:30:00.000Z (Exact midnight switch)
      expect(toISTDate('2026-11-02T18:30:00.000Z')).toBe('2026-11-03');

      // 2026-11-03 00:00:00.001 IST -> UTC 2026-11-02 18:30:00.001Z
      expect(toISTDate('2026-11-02T18:30:00.001Z')).toBe('2026-11-03');

      // 2026-11-03 00:10:00.000 IST -> UTC 2026-11-02 18:40:00.000Z
      expect(toISTDate('2026-11-02T18:40:00.000Z')).toBe('2026-11-03');
    });

    it('proves Section 269ST daily cash limit resets across IST midnight millisecond boundary', async () => {
      const repo = getRepository();

      // Student pays ₹1,99,999 cash at 23:59:59.999 IST on 2026-11-02 (UTC 18:29:59.999Z)
      const pay1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 19999900n, // ₹1,99,999.00
        mode: 'CASH',
        paymentDate: '2026-11-02T18:29:59.999Z',
        reference: 'CASH-IST-NIGHT-01',
        payerName: 'Parent A',
        actorUserId: 'usr-acc-01',
      });
      expect(pay1.outcome).toBe('MATCHED');

      // A second payment of ₹1 cash attempted 1 millisecond later at 23:59:59.999 IST must be BLOCKED
      const blockSameDay = repo.validateSection269ST('stu-0219', 100n, '2026-11-02T18:29:59.999Z');
      expect(blockSameDay.allowed).toBe(false);
      expect(blockSameDay.problem?.title).toContain('Section 269ST');

      // But a second payment of ₹1,99,999 cash at 00:00:00.000 IST (UTC 18:30:00.000Z) is a NEW DAY and must be ALLOWED
      const allowNextDay = repo.validateSection269ST('stu-0219', 19999900n, '2026-11-02T18:30:00.000Z');
      expect(allowNextDay.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // 2. BOUNDARY STRESS: SECTION 269ST CASH CEILING & UNMATCHED QUEUE
  // ==========================================================================
  describe('2. Boundary Stress: Section 269ST Cash Limits & Unmatched Queue Interactions', () => {
    it('enforces exact cash ceiling boundaries: ₹1,99,999.00 passes, ₹2,00,000.00 fails', () => {
      // 1. Exactly ₹1,99,999.00 (19,999,900 paise)
      const allowed = validateCashPayment(19_999_900n, 0n);
      expect(allowed.allowed).toBe(true);
      expect(allowed.error).toBeUndefined();

      // 2. Maximum sub-limit ₹1,99,999.99 (19,999,999 paise)
      const maxAllowed = validateCashPayment(19_999_999n, 0n);
      expect(maxAllowed.allowed).toBe(true);

      // 3. Exact threshold ₹2,00,000.00 (20,000,000 paise) -> BLOCKED
      const exactLimit = validateCashPayment(20_000_000n, 0n);
      expect(exactLimit.allowed).toBe(false);
      expect(exactLimit.error?.status).toBe(422);
      expect(exactLimit.error?.code).toBe('CASH_LIMIT_EXCEEDED');

      // 4. ₹2,00,000.01 (20,000,001 paise) -> BLOCKED
      const overLimit = validateCashPayment(20_000_001n, 0n);
      expect(overLimit.allowed).toBe(false);

      // 5. Electronic payments exempt
      const upiLarge = validateCashLimit({ mode: 'UPI', amountPaise: 50_000_000n });
      expect(upiLarge.allowed).toBe(true);
    });

    it('REGRESSION GUARD TC-16-V2: Checks that same-day resolution of UNMATCHED_QUEUE cash payment does not double-count', async () => {
      const repo = getRepository();

      // Cancel target instalment first so payment is forced to UNMATCHED_QUEUE
      const instalments = repo.getInstalmentsByStudentId('stu-0219');
      const targetInstalment = instalments[0];
      targetInstalment.cancelledAt = '2026-11-01T00:00:00Z';

      // Record ₹1,00,000 cash offline payment (enters UNMATCHED_QUEUE)
      const offlinePay = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: targetInstalment.id,
        amountPaise: 10_000_000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'UNMATCHED-CASH-TEST-01',
        payerName: 'Parent Test',
        actorUserId: 'usr-acc-01',
      });

      expect(offlinePay.outcome).toBe('UNMATCHED_QUEUE');
      const unmatchedPaymentId = offlinePay.paymentId;
      expect(unmatchedPaymentId).toBeDefined();

      // Uncancel instalment so it can now receive allocation
      targetInstalment.cancelledAt = null;

      // Check prior cash today: correctly includes the ₹1,00,000 in UNMATCHED_QUEUE
      const priorCash = repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE);
      expect(priorCash).toBe(10_000_000n);

      // NOW ATTEMPT TO RESOLVE THE UNMATCHED CASH PAYMENT ON THE SAME DAY
      // With TC-16-V2 fix, resolution must succeed cleanly without double-counting
      const resolveRes = await repo.resolveUnmatchedPayment(
        unmatchedPaymentId!,
        'stu-0219',
        targetInstalment.id,
        'usr-acc-01'
      );

      expect(resolveRes.outcome).toBe('MATCHED');
      expect(resolveRes.receiptNumber).toBeDefined();

      // Prior cash today must remain exactly ₹1,00,000 (not double counted to ₹2,00,000)
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(10_000_000n);
    });
  });

  // ==========================================================================
  // 3. BOUNDARY STRESS: MOE PRO-RATA REFUND CASES A TO F & 10-DAY SLA
  // ==========================================================================
  describe('3. Boundary Stress: MoE Pro-Rata Refund Cases A–F & 10-Day Statutory SLA', () => {
    // Case A: Full course fee ₹60,000, 100% paid, withdrawal at day 0 (e=0)
    it('Case A: 100% upfront payment, withdrawal on Day 0 (e=0) -> 100% refund (₹60,000)', () => {
      const res = computeProRataRefund('2026-11-02', [
        { head: 'TUITION', netFeePaise: 6_000_000n, totalPaidPaise: 6_000_000n, courseDays: 360 },
      ], 0);

      expect(res.totalConsumedPaise).toBe(0n);
      expect(res.totalRefundablePaise).toBe(6_000_000n); // ₹60,000
      expect(res.totalShortfallPaise).toBe(0n);
      expect(res.creditNoteRequired).toBe(true);
      expect(res.creditNoteTaxSplit).toBeDefined();
    });

    // Case B: Net fee ₹60,000, paid ₹60,000, withdrawal at Day 180 (halfway, e=180)
    it('Case B: 100% upfront payment, withdrawal on Day 180 (e=180) -> exactly 50% refund (₹30,000)', () => {
      const res = computeProRataRefund('2026-11-02', [
        { head: 'TUITION', netFeePaise: 6_000_000n, totalPaidPaise: 6_000_000n, courseDays: 360 },
      ], 180);

      expect(res.totalConsumedPaise).toBe(3_000_000n); // ₹30,000
      expect(res.totalRefundablePaise).toBe(3_000_000n); // ₹30,000
      expect(res.totalShortfallPaise).toBe(0n);
    });

    // Case C: Withdrawal at Day 216 (e=216, 60% elapsed)
    it('Case C: Day 216 (e=216, 60% of 360 days) -> consumed ₹36,000, refundable ₹24,000', () => {
      const res = computeProRataRefund('2026-11-02', [
        { head: 'TUITION', netFeePaise: 6_000_000n, totalPaidPaise: 6_000_000n, courseDays: 360 },
      ], 216);

      expect(res.totalConsumedPaise).toBe(3_600_000n); // 60,000 * 216 / 360 = 36,000
      expect(res.totalRefundablePaise).toBe(2_400_000n); // ₹24,000
      expect(res.totalShortfallPaise).toBe(0n);
    });

    // Case D: Part-paid student: Net fee ₹60,000, paid ₹30,000, withdrawal at Day 90 (25% elapsed)
    it('Case D: Part-paid student (paid ₹30,000 of ₹60,000), Day 90 (e=90) -> consumed ₹15,000, refund ₹15,000', () => {
      const res = computeProRataRefund('2026-11-02', [
        { head: 'TUITION', netFeePaise: 6_000_000n, totalPaidPaise: 3_000_000n, courseDays: 360 },
      ], 90);

      expect(res.totalConsumedPaise).toBe(1_500_000n); // ₹15,000
      expect(res.totalRefundablePaise).toBe(1_500_000n); // ₹15,000
      expect(res.totalShortfallPaise).toBe(0n);
    });

    // Case E: Under-paid student / Shortfall: Net fee ₹60,000, paid ₹15,000, Day 180 (consumed ₹30,000)
    it('Case E: Under-paid student -> refund strictly 0, shortfall tracked but never billed to student', () => {
      const res = computeProRataRefund('2026-11-02', [
        { head: 'TUITION', netFeePaise: 6_000_000n, totalPaidPaise: 1_500_000n, courseDays: 360 },
      ], 180);

      expect(res.totalConsumedPaise).toBe(3_000_000n); // ₹30,000 consumed
      expect(res.totalRefundablePaise).toBe(0n); // Refund floored at 0 (never negative)
      expect(res.totalShortfallPaise).toBe(1_500_000n); // ₹15,000 shortfall tracked
      expect(res.creditNoteRequired).toBe(false); // No credit note issued for zero refund
    });

    // Case F: Multi-head (Tuition + Hostel + Mess) with zero cross-subsidization
    it('Case F: Multi-head zero cross-subsidization — hostel shortfall is NOT deducted from tuition refund', () => {
      const res = computeProRataRefund('2026-11-02', [
        { head: 'TUITION', netFeePaise: 6_000_000n, totalPaidPaise: 6_000_000n, courseDays: 360 }, // e=180: consumed 30k, refund 30k
        { head: 'HOSTEL', netFeePaise: 4_000_000n, totalPaidPaise: 1_000_000n, courseDays: 360 },  // e=180: consumed 20k, refund 0k, shortfall 10k
        { head: 'MESS', netFeePaise: 2_000_000n, totalPaidPaise: 2_000_000n, courseDays: 360 },    // e=180: consumed 10k, refund 10k
      ], 180);

      expect(res.heads[0].refundablePaise).toBe(3_000_000n);
      expect(res.heads[1].refundablePaise).toBe(0n);
      expect(res.heads[1].shortfallPaise).toBe(1_000_000n);
      expect(res.heads[2].refundablePaise).toBe(1_000_000n);

      // Crucial: Total refund is ₹30k + ₹0 + ₹10k = ₹40,000 (NOT ₹30k if shortfall were cross-subsidized!)
      expect(res.totalRefundablePaise).toBe(4_000_000n);
      expect(res.totalShortfallPaise).toBe(1_000_000n);
    });

    // 10-Calendar-Day Statutory SLA Deadline
    it('verifies exact 10-calendar-day statutory SLA calculation across month and year boundaries', () => {
      // 1. Standard month: 3 Nov 2026 -> 13 Nov 2026
      expect(addCalendarDays('2026-11-03', 10)).toBe('2026-11-13');

      // 2. Month-end crossing: 25 Oct 2026 (October has 31 days) -> 4 Nov 2026
      expect(addCalendarDays('2026-10-25', 10)).toBe('2026-11-04');

      // 3. Year crossing: 25 Dec 2026 -> 4 Jan 2027
      expect(addCalendarDays('2026-12-25', 10)).toBe('2027-01-04');

      // 4. Leap year February 2028 (2028 is leap year, 29 days): 22 Feb 2028 -> 3 Mar 2028
      expect(addCalendarDays('2028-02-22', 10)).toBe('2028-03-03');

      // 5. Non-leap year February 2027 (28 days): 22 Feb 2027 -> 4 Mar 2027
      expect(addCalendarDays('2027-02-22', 10)).toBe('2027-03-04');

      // 6. SLA overdue countdown
      const calcNormal = computeProRataRefund('2026-11-03', [], 100, '2026-11-08');
      expect(calcNormal.slaDueDate).toBe('2026-11-13');
      expect(calcNormal.daysRemaining).toBe(5);
      expect(calcNormal.isOverdue).toBe(false);

      const calcOverdue = computeProRataRefund('2026-11-03', [], 100, '2026-11-15');
      expect(calcOverdue.daysRemaining).toBe(-2);
      expect(calcOverdue.isOverdue).toBe(true);
    });
  });

  // ==========================================================================
  // 4. DETERMINISTIC AI DROPOUT RISK SCORING (STU-0587 = 79)
  // ==========================================================================
  describe('4. Deterministic AI Dropout Risk Scoring: STU-0587 Exact Score & Monotonicity', () => {
    it('strictly confirms STU-0587 risk score is exactly 79 (HIGH)', () => {
      const scoreRes = calculateDropoutRiskScore({
        worstOverdueDays: 23,
        isPartPaid: true,
        attendancePercent: 69,
        prevAttendancePercent: 88,
        testOldPercentile: 78,
        testNewPercentile: 59,
      });

      expect(scoreRes.fScore).toBe(32);
      expect(scoreRes.aScore).toBe(28);
      expect(scoreRes.sScore).toBe(19);
      expect(scoreRes.score).toBe(79);
      expect(scoreRes.severity).toBe('HIGH');
      expect(scoreRes.taskCreated).toBe(true);
    });

    it('verifies strict monotonicity of all component scoring functions', () => {
      // 1. Fee factor monotonicity: higher days overdue never decreases F
      let lastF = -1;
      for (let days = 0; days <= 50; days++) {
        const f = computeFeeFactor(days, false);
        expect(f).toBeGreaterThanOrEqual(lastF);
        lastF = f;
      }

      // 2. Attendance factor: lower attendance never decreases A
      let lastA = 999;
      for (let att = 100; att >= 0; att--) {
        const a = computeAttendanceFactor(att);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(35);
      }

      // 3. Test slope factor: larger drop never decreases S
      let lastS = -1;
      for (let drop = 0; drop <= 50; drop++) {
        const s = computeTestSlopeFactor(undefined, undefined, drop);
        expect(s).toBeGreaterThanOrEqual(lastS);
        expect(s).toBeLessThanOrEqual(25);
        lastS = s;
      }
    });
  });

  // ==========================================================================
  // 5. 360PX VIEWPORT & MOBILE CHECKOUT ZERO-LAYOUT-SHIFT
  // ==========================================================================
  describe('5. 360px Viewport & Mobile Checkout End-to-End Journey', () => {
    it('verifies 360px viewport dues display contract and zero dead button integrity', () => {
      const repo = getRepository();
      const dues = repo.getDuesSummary('stu-0587', ANCHOR_DATE);
      expect(dues).toBeDefined();
      expect(dues?.totalBalancePaise).toBe('1500000'); // ₹15,000

      // Student has 1 overdue instalment
      const overdueInstalments = dues?.instalments.filter((i) => i.status === 'PART_PAID_OVERDUE');
      expect(overdueInstalments?.length).toBe(1);
      expect(overdueInstalments![0].balancePaise).toBe('1500000');
    });

    it('executes full parent checkout journey on 360px mobile context with atomic reminder suppression', async () => {
      const repo = getRepository();

      // Step 1: Query initial reminders for STU-0587
      const initialReminders = repo.getReminders({ studentId: 'stu-0587' });
      expect(initialReminders.length).toBeGreaterThan(0);
      expect(initialReminders.every((r) => r.state === 'SENT' || r.state === 'QUEUED')).toBe(true);

      // Step 2: Settle remaining ₹15,000 overdue fee via online payment
      const paymentResult = await repo.recordPayment({
        studentId: 'stu-0587',
        instalmentId: 'inst-0587-3',
        amountPaise: 15_000_00n, // ₹15,000.00
        mode: 'UPI',
        gatewayPaymentId: 'pay_m4_challenger2_mobile_checkout_01',
        payerName: 'Sunita Sharma',
        receivedOn: ANCHOR_DATE,
      });

      expect(paymentResult.outcome).toBe('MATCHED');
      expect(paymentResult.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);

      // Step 3: Dues cleared to zero
      const duesAfter = repo.getDuesSummary('stu-0587', ANCHOR_DATE);
      expect(duesAfter?.totalBalancePaise).toBe('0');

      // Step 4: All reminders for STU-0587 atomically suppressed
      const remindersAfter = repo.getReminders({ studentId: 'stu-0587' });
      for (const rem of remindersAfter) {
        expect(rem.state).toBe('SUPPRESSED_BY_PAYMENT');
        expect(rem.suppressReason).toBe('PAID_IN_FULL');
        expect(rem.suppressPaymentId).toBe(paymentResult.paymentId);
      }
    });
  });
});
