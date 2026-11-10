// tests/ui/m3_challenger_2_statutory_stress.test.ts
/**
 * Milestone 3 Challenger 2: Adversarial Stress & Statutory Gate Verification
 * 
 * Targeted Verification Areas:
 * 1. Section 269ST cash enforcement boundary testing:
 *    - ₹1,99,999.99 (allowed) vs ₹2,00,000.00 (rejected with RFC 9457 HTTP 422 Problem Details)
 *    - Daily aggregate cumulative limit tracking
 *    - Non-cash payment exemptions
 * 2. Segregation of Duties on refunds:
 *    - Accounts Exec raiser cannot approve their own refund draft (HTTP 403)
 *    - Director raiser cannot approve their own refund draft (HTTP 403)
 *    - Director approval of Accounts Exec draft succeeds (HTTP 200)
 * 3. MoE refund pro-rata calculator cases A through F and 10-day statutory SLA countdown:
 *    - Cases A, B, C, D, E, F with zero cross-subsidization and zero floor rules
 *    - Statutory 10-calendar-day SLA countdown and overdue detection
 * 4. Student STU-0587 deterministic dropout score of exactly 79 (F=32, A=28, S=19):
 *    - Formula breakdown, deterministic invariant across 1,000 loops, risk queue API, 14-day hold
 * 5. Balanced zero-sum double-entry vouchers in Tally export XML:
 *    - Mathematical invariant (-Gross + Taxable + CGST + SGST === 0.00)
 *    - Deterministic SHA-256 GUIDs and CSV formula injection sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import {
  validateCashPayment,
  validateCashLimit,
  SECTION_269ST_LIMIT_PAISE,
} from '@/src/domain/cashLimit';
import {
  computeProRataRefund,
  computeProRataRefundFromDates,
  differenceInCalendarDays,
} from '@/src/domain/refund';
import {
  calculateDropoutRiskScore,
  calculateFalseFlagSuppressionDate,
  isRiskFlagSuppressed,
} from '@/src/domain/riskScore';
import {
  buildReceiptVoucherXml,
  buildCreditNoteVoucherXml,
  generateVoucherGuid,
  sanitizeCsvCell,
  TallyCreditNoteEntry,
} from '@/src/domain/tallyExport';

// Route Handlers
import { POST as offlinePost } from '@/app/api/payments/offline/route';
import { POST as calculatePost } from '@/app/api/admin/refunds/calculate/route';
import { POST as approvePost } from '@/app/api/admin/refunds/[id]/approve/route';
import { POST as settlePost } from '@/app/api/admin/refunds/[id]/settle/route';
import { GET as riskQueueGet } from '@/app/api/admin/refunds/risk-queue/route';
import { GET as tallyGet } from '@/app/api/export/tally/route';

describe('Milestone 3 Challenger 2: Adversarial Statutory Gates & Stress Test Suite', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // =========================================================================
  // TASK 1: SECTION 269ST CASH ENFORCEMENT BOUNDARY TESTING
  // =========================================================================
  describe('Task 1: Section 269ST Cash Limit Boundary Enforcement (₹1,99,999.99 vs ₹2,00,000.00)', () => {
    it('1.1 Pure Domain: ₹1,99,999.99 (19,999,999 paise) is permitted with 1 paisa remaining allowance', () => {
      const amountPaise = 19_999_999n; // ₹1,99,999.99
      const result = validateCashPayment(amountPaise);

      expect(result.allowed).toBe(true);
      expect(result.limitPaise).toBe(SECTION_269ST_LIMIT_PAISE);
      expect(result.attemptedPaise).toBe(amountPaise);
      expect(result.error).toBeUndefined();

      // Deep domain check
      const detailed = validateCashLimit({ mode: 'CASH', amountPaise });
      expect(detailed.allowed).toBe(true);
      expect(detailed.remainingAllowancePaise).toBe(1n); // exactly 1 paisa left before statutory cap
    });

    it('1.2 Pure Domain: ₹2,00,000.00 (20,000,000 paise) is strictly rejected with RFC 9457 HTTP 422 Problem Details', () => {
      const amountPaise = 20_000_000n; // ₹2,00,000.00
      const result = validateCashPayment(amountPaise);

      expect(result.allowed).toBe(false);
      expect(result.limitPaise).toBe(SECTION_269ST_LIMIT_PAISE);
      expect(result.attemptedPaise).toBe(amountPaise);
      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(422);
      expect(result.error?.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(result.error?.type).toBe('https://shikshasetu.example.in/errors/cash-limit-exceeded');
      expect(result.error?.title).toBe('Section 269ST Cash Limit Exceeded');
      expect(result.error?.detail).toContain('prohibited under Section 269ST');
    });

    it('1.3 API Gateway: Cashier records cash of ₹1,99,999.99 (19,999,999 paise) -> HTTP 201 Created and gapless receipt', async () => {
      const req = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0587',
          instalmentId: 'inst-0587-3',
          amountPaise: '19999999', // ₹1,99,999.99
          mode: 'CASH',
          reference: 'CSH-BOUNDARY-ALLOWED',
          payerName: 'Sunita Sharma',
          paymentDate: '2026-11-02',
          remarks: 'Section 269ST upper allowed boundary test',
        }),
      });

      const res = await offlinePost(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);
      expect(data.amountPaise).toBe('19999999');
    });

    it('1.4 API Gateway: Cashier records cash of ₹2,00,000.00 (20,000,000 paise) -> HTTP 422 Unprocessable Entity with RFC 9457', async () => {
      const repo = getRepository();
      const receiptsBefore = repo.getReceiptsByStudentId('stu-0587').length;

      const req = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0587',
          instalmentId: 'inst-0587-3',
          amountPaise: '20000000', // ₹2,00,000.00
          mode: 'CASH',
          reference: 'CSH-BOUNDARY-REJECTED',
          payerName: 'Sunita Sharma',
          paymentDate: '2026-11-02',
          remarks: 'Section 269ST threshold rejection test',
        }),
      });

      const res = await offlinePost(req);
      expect(res.status).toBe(422);

      const problem = await res.json();
      expect(problem.status).toBe(422);
      expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(problem.type).toBe('https://shikshasetu.example.in/errors/cash-limit-exceeded');
      expect(problem.title).toBe('Section 269ST Cash Limit Exceeded');
      expect(problem.detail).toContain('₹2,00,000');

      // Invariant: No receipt was burned
      const receiptsAfter = repo.getReceiptsByStudentId('stu-0587').length;
      expect(receiptsAfter).toBe(receiptsBefore);
    });

    it('1.5 Daily Cumulative Boundary Stress: Two ₹1,00,000 cash payments on same day reject the 2nd with HTTP 422', async () => {
      // 1. Payment 1: ₹1,00,000 (10,000,000 paise)
      const res1 = await offlinePost(
        new Request('http://localhost:3000/api/payments/offline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-role': 'ACCOUNTS_EXEC',
            'x-demo-user-id': 'usr-acc-01',
          },
          body: JSON.stringify({
            studentId: 'stu-0587',
            instalmentId: 'inst-0587-3',
            amountPaise: '10000000',
            mode: 'CASH',
            reference: 'CSH-100K-1',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(res1.status).toBe(201);

      // 2. Payment 2: ₹1,00,000 on SAME day -> Cumulative = ₹2,00,000.00 -> Rejected under Section 269ST
      const res2 = await offlinePost(
        new Request('http://localhost:3000/api/payments/offline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-role': 'ACCOUNTS_EXEC',
            'x-demo-user-id': 'usr-acc-01',
          },
          body: JSON.stringify({
            studentId: 'stu-0587',
            instalmentId: 'inst-0587-4',
            amountPaise: '10000000',
            mode: 'CASH',
            reference: 'CSH-100K-2',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(res2.status).toBe(422);
      const problem = await res2.json();
      expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(problem.title).toBe('Section 269ST Daily Cash Limit Exceeded');
    });

    it('1.6 Non-Cash Payments (Cheque / POS Card / Bank Transfer) of ₹3,00,000 are not restricted by Section 269ST', async () => {
      const res = await offlinePost(
        new Request('http://localhost:3000/api/payments/offline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-role': 'ACCOUNTS_EXEC',
            'x-demo-user-id': 'usr-acc-01',
          },
          body: JSON.stringify({
            studentId: 'stu-0587',
            instalmentId: 'inst-0587-3',
            amountPaise: '30000000', // ₹3,00,000.00
            mode: 'CHEQUE',
            reference: 'CHQ-HDFC-99120',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.amountPaise).toBe('30000000');
    });
  });

  // =========================================================================
  // TASK 2: SEGREGATION OF DUTIES ON REFUNDS
  // =========================================================================
  describe('Task 2: Segregation of Duties on Refunds (Raiser Cannot Approve Own Draft)', () => {
    it('2.1 Accounts Executive who raises refund draft cannot approve it (HTTP 403 REFUND_SELF_APPROVAL_FORBIDDEN)', async () => {
      const repo = getRepository();

      // Step 1: Accounts Executive raises refund draft
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Withdrawal request',
        actorUserId: 'usr-acc-01',
      });
      expect(refund.status).toBe('DRAFT');
      expect(refund.raisedBy).toBe('usr-acc-01');

      // Step 2: Same Accounts Executive attempts to approve the draft
      const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
      });

      const res = await approvePost(req, { params: Promise.resolve({ id: refund.id }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');
      expect(data.error.messageEn).toContain('Segregation of Duties');
      expect(data.error.messageHi).toContain('कर्तव्यों का पृथक्करण');
    });

    it('2.2 Director Self-Approval Adversarial Bypass: Director who raises refund CANNOT approve their own draft', async () => {
      const repo = getRepository();

      // Step 1: Director usr-dir-01 raises refund draft directly
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Executive withdrawal authorization',
        actorUserId: 'usr-dir-01',
      });
      expect(refund.status).toBe('DRAFT');
      expect(refund.raisedBy).toBe('usr-dir-01');

      // Step 2: Director attempts to approve their OWN draft
      const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const res = await approvePost(req, { params: Promise.resolve({ id: refund.id }) });
      expect(res.status).toBe(403);
      const data = await res.json();

      // Invariant: Segregation of Duties takes precedence over Director authority
      expect(data.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');
      expect(data.error.messageEn).toBe('Segregation of Duties: Approver cannot be the raiser of the refund');

      // Invariant: Repository layer also rejects self-approval
      await expect(repo.approveRefund(refund.id, 'usr-dir-01')).rejects.toThrow(
        'Segregation of Duties: Approver cannot be the raiser of the refund'
      );
    });

    it('2.3 Director approves refund raised by Accounts Executive -> Status APPROVED, cancels unpaid instalments & auto-suppresses reminders', async () => {
      const repo = getRepository();

      // 1. Raised by Accounts Exec
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Official withdrawal',
        actorUserId: 'usr-acc-01',
      });

      // 2. Approved by Director (different user)
      const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const res = await approvePost(req, { params: Promise.resolve({ id: refund.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.refund.status).toBe('APPROVED');
      expect(data.refund.approvedBy).toBe('usr-dir-01');

      // Verify student status changed to WITHDRAWN
      const student = repo.getStudentById('stu-0587')!;
      expect(student.status).toBe('WITHDRAWN');

      // Verify unpaid instalment is cancelled
      const instalments = repo.getInstalmentsByStudentId('stu-0587');
      const inst4 = instalments.find((i) => i.seqNo === 4)!;
      expect(inst4.cancelledAt).not.toBeNull();
      expect(inst4.refundId).toBe(refund.id);

      // Verify settlement generates Credit Note
      const reqSettle = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          settlementMode: 'BANK_TRANSFER',
          bankReference: 'NEFT-M3-CHALLENGER-2',
        }),
      });

      const resSettle = await settlePost(reqSettle, { params: Promise.resolve({ id: refund.id }) });
      expect(resSettle.status).toBe(200);
      const settleData = await resSettle.json();
      expect(settleData.refund.status).toBe('SETTLED');
      expect(settleData.creditNote.number).toMatch(/^CN\/26-27\/\d{6}$/);
    });
  });

  // =========================================================================
  // TASK 3: MOE PRO-RATA REFUND CASES A THROUGH F & 10-DAY SLA COUNTDOWN
  // =========================================================================
  describe('Task 3: MoE Pro-Rata Refund Calculator (Cases A to F) & 10-Day Statutory SLA', () => {
    const TUITION_NET = 12_000_000n; // ₹1,20,000.00
    const HOSTEL_NET = 6_000_000n;   // ₹60,000.00
    const COURSE_DAYS = 360;

    it('3.1 Case A: Upfront full payer exits mid-course (e = 180, Paid = ₹1,20,000)', () => {
      const res = computeProRataRefund(
        '2026-10-01',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: TUITION_NET, courseDays: COURSE_DAYS }],
        180
      );

      expect(res.daysElapsed).toBe(180);
      expect(res.heads[0].consumedPaise).toBe(6_000_000n); // ₹60,000.00
      expect(res.heads[0].refundablePaise).toBe(6_000_000n); // ₹60,000.00
      expect(res.totalRefundablePaise).toBe(6_000_000n);
      expect(res.totalShortfallPaise).toBe(0n);
      expect(res.creditNoteRequired).toBe(true);
      expect(res.creditNoteTaxSplit?.taxablePaise).toBe(5_084_746n);
      expect(res.creditNoteTaxSplit?.cgstPaise).toBe(457_627n);
      expect(res.creditNoteTaxSplit?.sgstPaise).toBe(457_627n);
    });

    it('3.2 Case B: Instalment payer ahead of schedule exits (e = 216, Paid = ₹90,000)', () => {
      const res = computeProRataRefund(
        '2026-11-03',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 9_000_000n, courseDays: COURSE_DAYS }],
        216
      );

      expect(res.daysElapsed).toBe(216);
      expect(res.heads[0].consumedPaise).toBe(7_200_000n); // ₹72,000.00
      expect(res.heads[0].refundablePaise).toBe(1_800_000n); // ₹18,000.00
      expect(res.totalRefundablePaise).toBe(1_800_000n);
      expect(res.totalShortfallPaise).toBe(0n);
      expect(res.creditNoteRequired).toBe(true);
    });

    it('3.3 Case C: Part-paid student STU-0587 exits on 3 Nov 2026 (e = 216, Paid = ₹75,000)', () => {
      const res = computeProRataRefund(
        '2026-11-03',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7_500_000n, courseDays: COURSE_DAYS }],
        216
      );

      expect(res.daysElapsed).toBe(216);
      expect(res.heads[0].consumedPaise).toBe(7_200_000n); // ₹72,000.00
      expect(res.heads[0].refundablePaise).toBe(300_000n);  // ₹3,000.00
      expect(res.totalRefundablePaise).toBe(300_000n);
      expect(res.totalShortfallPaise).toBe(0n);
    });

    it('3.4 Case D: Pre-batch exit on Day 0 (e = 0, Paid = ₹30,000)', () => {
      const res = computeProRataRefund(
        '2026-04-01',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 3_000_000n, courseDays: COURSE_DAYS }],
        0
      );

      expect(res.daysElapsed).toBe(0);
      expect(res.heads[0].consumedPaise).toBe(0n);
      expect(res.heads[0].refundablePaise).toBe(3_000_000n); // 100% full refund
      expect(res.totalRefundablePaise).toBe(3_000_000n);
      expect(res.totalShortfallPaise).toBe(0n);
    });

    it('3.5 Case E: Consumed exceeds paid (e = 216, Paid = ₹60,000, Consumed = ₹72,000)', () => {
      const res = computeProRataRefund(
        '2026-11-03',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 6_000_000n, courseDays: COURSE_DAYS }],
        216
      );

      expect(res.daysElapsed).toBe(216);
      expect(res.heads[0].consumedPaise).toBe(7_200_000n);
      expect(res.heads[0].refundablePaise).toBe(0n); // Floored at 0 (never negative)
      expect(res.heads[0].shortfallPaise).toBe(1_200_000n); // Shortfall ₹12,000 flagged, never charged
      expect(res.totalRefundablePaise).toBe(0n);
      expect(res.totalShortfallPaise).toBe(1_200_000n);
      expect(res.creditNoteRequired).toBe(false);
    });

    it('3.6 Case F: Multi-head exit without cross-subsidization (Tuition refund ₹18,000, Hostel shortfall ₹6,000)', () => {
      const res = computeProRataRefund(
        '2026-11-03',
        [
          { head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 9_000_000n, courseDays: COURSE_DAYS },
          { head: 'HOSTEL', netFeePaise: HOSTEL_NET, totalPaidPaise: 3_000_000n, courseDays: COURSE_DAYS },
        ],
        216
      );

      // Tuition: Consumed 72k, Paid 90k -> Refund 18k
      expect(res.heads[0].consumedPaise).toBe(7_200_000n);
      expect(res.heads[0].refundablePaise).toBe(1_800_000n);
      expect(res.heads[0].shortfallPaise).toBe(0n);

      // Hostel: Consumed 36k, Paid 30k -> Refund 0, Shortfall 6k
      expect(res.heads[1].consumedPaise).toBe(3_600_000n);
      expect(res.heads[1].refundablePaise).toBe(0n);
      expect(res.heads[1].shortfallPaise).toBe(600_000n);

      // TOTAL INVARIANT: Total refundable is strictly ₹18,000.00! NOT ₹12,000.00!
      expect(res.totalRefundablePaise).toBe(1_800_000n);
      expect(res.totalShortfallPaise).toBe(600_000n);
    });

    it('3.7 10-Calendar-Day Statutory SLA Countdown & Overdue Tracking', () => {
      const receivedOn = '2026-11-02';

      // SLA due date must be strictly 10 calendar days later: 2026-11-12
      const onReceiptDay = computeProRataRefundFromDates(
        receivedOn,
        '2026-04-01',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7_500_000n }],
        undefined,
        '2026-11-02'
      );
      expect(onReceiptDay.slaDueDate).toBe('2026-11-12');
      expect(onReceiptDay.daysRemaining).toBe(10);
      expect(onReceiptDay.isOverdue).toBe(false);

      // 5 days elapsed (as of 2026-11-07): 5 days remaining
      const midway = computeProRataRefundFromDates(
        receivedOn,
        '2026-04-01',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7_500_000n }],
        undefined,
        '2026-11-07'
      );
      expect(midway.daysRemaining).toBe(5);
      expect(midway.isOverdue).toBe(false);

      // Exactly on deadline day (2026-11-12): 0 days remaining, not overdue
      const deadlineDay = computeProRataRefundFromDates(
        receivedOn,
        '2026-04-01',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7_500_000n }],
        undefined,
        '2026-11-12'
      );
      expect(deadlineDay.daysRemaining).toBe(0);
      expect(deadlineDay.isOverdue).toBe(false);

      // 1 day past deadline (2026-11-13): -1 days remaining, marked overdue
      const overdue = computeProRataRefundFromDates(
        receivedOn,
        '2026-04-01',
        [{ head: 'TUITION', netFeePaise: TUITION_NET, totalPaidPaise: 7_500_000n }],
        undefined,
        '2026-11-13'
      );
      expect(overdue.daysRemaining).toBe(-1);
      expect(overdue.isOverdue).toBe(true);
    });

    it('3.8 Refund Calculation API Endpoint verifies statutory calculation over HTTP', async () => {
      const req = new Request('http://localhost:3000/api/admin/refunds/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'STU-0412',
          receivedOn: '2026-11-02',
        }),
      });

      const res = await calculatePost(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.studentCode).toBe('STU-0412');
      expect(data.receivedOn).toBe('2026-11-02');
      expect(data.slaDueDate).toBe('2026-11-12');
      expect(differenceInCalendarDays(data.slaDueDate, data.receivedOn)).toBe(10);
      expect(data.daysElapsed).toBeGreaterThan(0);
      expect(data.heads.length).toBeGreaterThan(0);
      expect(BigInt(data.totalRefundablePaise)).toBeGreaterThan(0n);
    });
  });

  // =========================================================================
  // TASK 4: STUDENT STU-0587 DETERMINISTIC DROPOUT SCORE = 79
  // =========================================================================
  describe('Task 4: Student STU-0587 Deterministic Dropout Risk Score (F=32, A=28, S=19 => 79 HIGH)', () => {
    it('4.1 Canonical STU-0587 Factor Verification: R = 32 + 28 + 19 = 79 (HIGH)', () => {
      const result = calculateDropoutRiskScore({
        worstOverdueDays: 23,
        isPartPaid: true,
        attendancePercent: 69,
        prevAttendancePercent: 88,
        testOldPercentile: 78,
        testNewPercentile: 59,
      });

      expect(result.fScore).toBe(32);
      expect(result.aScore).toBe(28);
      expect(result.sScore).toBe(19);
      expect(result.score).toBe(79);
      expect(result.severity).toBe('HIGH');
      expect(result.taskCreated).toBe(true);
      expect(result.rationaleEn).toContain('Dropout Risk Score: 79/100 (HIGH)');
      expect(result.rationaleHi).toContain('ड्रॉपआउट जोखिम स्कोर: 79/100 (उच्च)');
    });

    it('4.2 Determinism Stress Test: 1,000 consecutive calculations produce identical score 79 without float jitter', () => {
      for (let i = 0; i < 1000; i++) {
        const res = calculateDropoutRiskScore({
          worstOverdueDays: 23,
          isPartPaid: true,
          attendancePercent: 69,
          prevAttendancePercent: 88,
          testOldPercentile: 78,
          testNewPercentile: 59,
        });

        expect(res.score).toBe(79);
        expect(res.fScore).toBe(32);
        expect(res.aScore).toBe(28);
        expect(res.sScore).toBe(19);
      }
    });

    it('4.3 Explainable AI Risk Queue API returns STU-0587 with exact factor scores', async () => {
      const req = new Request('http://localhost:3000/api/admin/refunds/risk-queue', {
        headers: {
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const res = await riskQueueGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      const stu0587 = data.items.find((item: any) => item.studentCode === 'STU-0587');
      expect(stu0587).toBeDefined();
      expect(stu0587.score).toBe(79);
      expect(stu0587.severity).toBe('HIGH');
      expect(stu0587.components.financialOverdueScore).toBe(32);
      expect(stu0587.components.attendanceDropScore).toBe(28);
      expect(stu0587.components.academicScoreDrop).toBe(19);
    });

    it('4.4 14-Day False-Flag Hold: Dismissal on 2 Nov 2026 holds flag until 16 Nov 2026', () => {
      const dismissalDate = new Date('2026-11-02T10:00:00Z');
      const suppressionDate = calculateFalseFlagSuppressionDate(dismissalDate, 14);

      // Verify exact 14 calendar days added
      expect(suppressionDate.toISOString().slice(0, 10)).toBe('2026-11-16');

      // During 14-day hold window (e.g. 15 Nov): suppressed
      const activeHoldDate = new Date('2026-11-15T12:00:00Z');
      expect(isRiskFlagSuppressed(activeHoldDate, suppressionDate)).toBe(true);

      // After 14-day hold window expires (e.g. 17 Nov): not suppressed
      const expiredHoldDate = new Date('2026-11-17T12:00:00Z');
      expect(isRiskFlagSuppressed(expiredHoldDate, suppressionDate)).toBe(false);
    });
  });

  // =========================================================================
  // TASK 5: BALANCED ZERO-SUM DOUBLE-ENTRY VOUCHERS IN TALLY EXPORT XML
  // =========================================================================
  describe('Task 5: Balanced Zero-Sum Double-Entry Vouchers in Tally Export XML', () => {
    it('5.1 Mathematical Zero-Sum Double-Entry Invariant: -Gross + Taxable + CGST + SGST === 0.00 across all receipts', async () => {
      const req = new Request('http://localhost:3000/api/export/tally?format=xml&fromDate=2026-04-01&toDate=2026-11-02', {
        headers: {
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
      });

      const res = await tallyGet(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/xml');

      const xml = await res.text();
      expect(xml).toContain('<ENVELOPE>');
      expect(xml).toContain('<VOUCHER VCHTYPE="Receipt"');

      // Extract every <VOUCHER> block
      const voucherBlocks = xml.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/g) || [];
      expect(voucherBlocks.length).toBeGreaterThan(0);

      for (const vBlock of voucherBlocks) {
        // Extract ledger entry lines
        const entryMatches = vBlock.match(/<ALLLEDGERENTRIES\.LIST>[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/g) || [];
        expect(entryMatches.length).toBeGreaterThanOrEqual(2);

        let voucherSumRupees = 0;
        let foundDebit = false;
        let foundCredit = false;

        for (const entry of entryMatches) {
          const isDeemedPos = /<ISDEEMEDPOSITIVE>(.*?)<\/ISDEEMEDPOSITIVE>/.exec(entry)?.[1];
          const amountStr = /<AMOUNT>(.*?)<\/AMOUNT>/.exec(entry)?.[1];
          expect(amountStr).toBeDefined();

          const amount = parseFloat(amountStr!);
          voucherSumRupees += amount;

          if (isDeemedPos === 'Yes') {
            foundDebit = true;
            expect(amount).toBeLessThan(0); // Debited amount must be negative in Tally sign convention
          } else if (isDeemedPos === 'No') {
            foundCredit = true;
            expect(amount).toBeGreaterThanOrEqual(0); // Credited amount must be positive
          }
        }

        expect(foundDebit).toBe(true);
        expect(foundCredit).toBe(true);

        // Strict double-entry balance check: sum must equal 0.00 to exact paisa
        expect(Math.abs(voucherSumRupees)).toBeLessThan(0.001);
      }
    });

    it('5.2 Deterministic Voucher GUID format conforming to RFC 4122 (8-4-4-4-12)', () => {
      const guid = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
      const rfc4122Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(guid).toMatch(rfc4122Regex);

      // Invariant: GUID is deterministic across multiple calls
      const guid2 = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
      expect(guid).toBe(guid2);
    });

    it('5.3 Credit Note Tally Vouchers balance to zero: -FeeDebits + BankCredit === 0.00', () => {
      const cnEntry: TallyCreditNoteEntry = {
        centreCode: 'JPR-GPL',
        voucherNumber: 'CN/26-27/000001',
        date: '2026-11-02',
        studentCode: 'STU-0412',
        narration: 'MoE Pro-Rata Refund Credit Note',
        refundGrossPaise: 2_630_137n,   // ₹26,301.37
        refundTaxablePaise: 2_228_930n, // ₹22,289.30
        refundCgstPaise: 200_604n,      // ₹2,006.04
        refundSgstPaise: 200_603n,      // ₹2,006.03
      };

      const xml = buildCreditNoteVoucherXml(cnEntry);
      expect(xml).toContain('<VOUCHER VCHTYPE="Credit Note"');

      // Check sum of ledger amounts in generated XML
      const amounts = (xml.match(/<AMOUNT>(.*?)<\/AMOUNT>/g) || []).map((m) =>
        parseFloat(m.replace(/<\/?AMOUNT>/g, ''))
      );

      const total = amounts.reduce((acc, curr) => acc + curr, 0);
      expect(Math.abs(total)).toBeLessThan(0.001);
    });

    it('5.4 CSV Formula Injection Sanitization prevents spreadsheet execution attacks', async () => {
      // Test malicious formula injections
      expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvCell('+12345')).toBe("'+12345");
      expect(sanitizeCsvCell('-500')).toBe("'-500");
      expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeCsvCell('\tmalicious')).toBe("'\tmalicious");

      // Normal strings remain unaffected
      expect(sanitizeCsvCell('RCP/26-27/000412')).toBe('RCP/26-27/000412');
      expect(sanitizeCsvCell('Rahul Sharma')).toBe('Rahul Sharma');
    });
  });
});
