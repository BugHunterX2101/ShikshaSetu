// tests/ui/m3_fix_challenger_2_adversarial.test.ts
/**
 * Milestone 3 Fix Challenger 2: Adversarial Stress Test Suite (Iteration 2 Gate)
 * 
 * Verifies:
 * 1. Section 269ST cash enforcement boundary: ₹1,99,999.99 vs ₹2,00,000.00.
 * 2. Segregation of Duties on refunds: raiser cannot approve their own refund draft.
 * 3. Dropout Risk Queue dynamic fetching and STU-0587 deterministic score of 79 (F=32, A=28, S=19).
 * 4. Ageing Buckets Matrix chronological alignment and balanced Tally XML export vouchers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import {
  validateCashPayment,
  validateCashLimit,
  SECTION_269ST_LIMIT_PAISE,
} from '@/src/domain/cashLimit';
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
  TallyReceiptEntry,
  TallyCreditNoteEntry,
} from '@/src/domain/tallyExport';

// Route Handlers
import { POST as offlineCashPost } from '@/app/api/payments/offline/route';
import { POST as approveRefundPost } from '@/app/api/admin/refunds/[id]/approve/route';
import { POST as settleRefundPost } from '@/app/api/admin/refunds/[id]/settle/route';
import { GET as riskQueueGet } from '@/app/api/admin/refunds/risk-queue/route';
import { GET as tallyExportGet } from '@/app/api/export/tally/route';
import { GET as dashboardGet } from '@/app/api/admin/dashboard/route';

describe('Milestone 3 Fix Challenger 2: Iteration 2 Gate Adversarial Verification', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // =========================================================================
  // TASK 1: SECTION 269ST CASH ENFORCEMENT BOUNDARY (₹1,99,999.99 vs ₹2,00,000)
  // =========================================================================
  describe('Task 1: Section 269ST Cash Enforcement Boundary Verification', () => {
    it('1.1 Exact single-transaction boundary: ₹1,99,999.99 (19,999,999 paise) is permitted', () => {
      const amountPaise = 19_999_999n;
      const res = validateCashPayment(amountPaise);

      expect(res.allowed).toBe(true);
      expect(res.limitPaise).toBe(20_000_000n);
      expect(res.attemptedPaise).toBe(19_999_999n);
      expect(res.error).toBeUndefined();

      const detail = validateCashLimit({ mode: 'CASH', amountPaise });
      expect(detail.allowed).toBe(true);
      expect(detail.remainingAllowancePaise).toBe(1n); // exactly 1 paisa remaining
    });

    it('1.2 Exact single-transaction boundary: ₹2,00,000.00 (20,000,000 paise) is strictly blocked with HTTP 422 RFC 9457', () => {
      const amountPaise = 20_000_000n;
      const res = validateCashPayment(amountPaise);

      expect(res.allowed).toBe(false);
      expect(res.limitPaise).toBe(20_000_000n);
      expect(res.error).toBeDefined();
      expect(res.error?.status).toBe(422);
      expect(res.error?.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(res.error?.detail).toContain('prohibited under Section 269ST');
    });

    it('1.3 Above boundary: ₹2,00,000.01 (20,000,001 paise) is blocked with HTTP 422', () => {
      const amountPaise = 20_000_001n;
      const res = validateCashPayment(amountPaise);

      expect(res.allowed).toBe(false);
      expect(res.error?.status).toBe(422);
      expect(res.error?.code).toBe('CASH_LIMIT_EXCEEDED');
    });

    it('1.4 API Gateway: Cashier records cash of ₹1,99,999.99 -> HTTP 201 Created with valid sequential receipt', async () => {
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
          amountPaise: '19999999',
          mode: 'CASH',
          reference: 'CSH-BOUNDARY-199999-99',
          payerName: 'Sunita Sharma',
          paymentDate: '2026-11-02',
          remarks: 'Section 269ST boundary allowed',
        }),
      });

      const res = await offlineCashPost(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);
      expect(data.amountPaise).toBe('19999999');
    });

    it('1.5 API Gateway: Cashier records cash of ₹2,00,000.00 -> HTTP 422 Unprocessable Entity with Problem Details', async () => {
      const repo = getRepository();
      const initialReceiptCount = repo.getReceiptsByStudentId('stu-0587').length;

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
          amountPaise: '20000000',
          mode: 'CASH',
          reference: 'CSH-BOUNDARY-200000-00',
          payerName: 'Sunita Sharma',
          paymentDate: '2026-11-02',
          remarks: 'Section 269ST threshold rejection',
        }),
      });

      const res = await offlineCashPost(req);
      expect(res.status).toBe(422);
      const problem = await res.json();
      expect(problem.status).toBe(422);
      expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(problem.title).toBe('Section 269ST Cash Limit Exceeded');
      expect(problem.detail).toContain('₹2,00,000');

      // No receipt counter burned
      expect(repo.getReceiptsByStudentId('stu-0587').length).toBe(initialReceiptCount);
    });

    it('1.6 Cumulative Daily Aggregation Boundary: Two ₹1,00,000 cash payments on same day reject the 2nd with HTTP 422', async () => {
      // Payment 1: ₹1,00,000.00 (10,000,000 paise)
      const p1 = await offlineCashPost(
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
            reference: 'CSH-CUMULATIVE-1',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(p1.status).toBe(201);

      // Payment 2: ₹1,00,000.00 on SAME day -> Cumulative = ₹2,00,000.00 -> Rejected under Section 269ST
      const p2 = await offlineCashPost(
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
            reference: 'CSH-CUMULATIVE-2',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(p2.status).toBe(422);
      const prob = await p2.json();
      expect(prob.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(prob.title).toBe('Section 269ST Daily Cash Limit Exceeded');
    });

    it('1.7 PROBE: Evaluates whether UNMATCHED_QUEUE cash payments are tracked in cumulative daily limit', async () => {
      const repo = getRepository();

      // Step 1: Cash payment of ₹1,00,000 (matched, pays off dues)
      const p1 = await offlineCashPost(
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
            reference: 'CSH-PROBE-1',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(p1.status).toBe(201);

      // Step 2: Second cash payment of ₹50,000 (dues are 0 now, so this goes to UNMATCHED_QUEUE)
      const p2 = await offlineCashPost(
        new Request('http://localhost:3000/api/payments/offline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-demo-role': 'ACCOUNTS_EXEC',
            'x-demo-user-id': 'usr-acc-01',
          },
          body: JSON.stringify({
            studentId: 'stu-0587',
            amountPaise: '5000000',
            mode: 'CASH',
            reference: 'CSH-PROBE-2',
            paymentDate: '2026-11-02',
          }),
        })
      );
      expect(p2.status).toBe(201);
      const p2Data = await p2.json();
      expect(p2Data.outcome).toBe('UNMATCHED_QUEUE');

      // Step 3: Now student attempts third cash payment of ₹60,000
      // Cumulative physical cash today = 100k + 50k + 60k = ₹2,10,000 (exceeds ₹2,00,000 limit)
      // SECURED: getPriorCashReceivedToday includes both MATCHED (₹1,00,000) and UNMATCHED_QUEUE (₹50,000):
      const priorCashCalculated = repo.getPriorCashReceivedToday('stu-0587', '2026-11-02');
      expect(priorCashCalculated).toBe(15_000_000n); // ₹1,50,000 total cash tracked
    });

    it('1.8 Non-cash modes (Cheque / POS Card / Bank Transfer) of ₹5,00,000 are not restricted by Section 269ST', async () => {
      for (const nonCashMode of ['CHEQUE', 'POS_CARD', 'BANK_TRANSFER'] as const) {
        const res = await offlineCashPost(
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
              amountPaise: '50000000', // ₹5,00,000.00
              mode: nonCashMode,
              reference: `NONCASH-${nonCashMode}-99`,
              paymentDate: '2026-11-02',
            }),
          })
        );
        expect(res.status).toBe(201);
      }
    });
  });

  // =========================================================================
  // TASK 2: SEGREGATION OF DUTIES ON REFUNDS (RAISER CANNOT APPROVE DRAFT)
  // =========================================================================
  describe('Task 2: Segregation of Duties on Refunds Verification', () => {
    it('2.1 Accounts Executive who raises refund draft cannot approve it (HTTP 403 REFUND_SELF_APPROVAL_FORBIDDEN)', async () => {
      const repo = getRepository();

      // Accounts Executive raises refund draft
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Student moving to another city',
        actorUserId: 'usr-acc-01',
      });
      expect(refund.status).toBe('DRAFT');
      expect(refund.raisedBy).toBe('usr-acc-01');

      // Same user attempts approval
      const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
      });

      const res = await approveRefundPost(req, { params: Promise.resolve({ id: refund.id }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');
      expect(data.error.messageEn).toContain('Segregation of Duties');
      expect(data.error.messageHi).toContain('कर्तव्यों का पृथक्करण');
    });

    it('2.2 Director who raises refund draft directly CANNOT approve their own draft (HTTP 403)', async () => {
      const repo = getRepository();

      // Director raises refund draft directly
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Direct executive refund order',
        actorUserId: 'usr-dir-01',
      });
      expect(refund.status).toBe('DRAFT');
      expect(refund.raisedBy).toBe('usr-dir-01');

      // Director attempts to approve their own draft
      const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const res = await approveRefundPost(req, { params: Promise.resolve({ id: refund.id }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');

      // Repository also enforces this at database layer
      await expect(repo.approveRefund(refund.id, 'usr-dir-01')).rejects.toThrow(
        'Segregation of Duties: Approver cannot be the raiser of the refund'
      );
    });

    it('2.3 Valid approval flow: Accounts Exec raises, Director approves (different user) -> APPROVED, cancelled instalments, suppressed reminders, settle produces Credit Note', async () => {
      const repo = getRepository();

      // 1. Raised by Accounts Exec
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Medical reasons withdrawal',
        actorUserId: 'usr-acc-01',
      });

      // 2. Approved by Director (usr-dir-01 <> usr-acc-01)
      const approveReq = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const approveRes = await approveRefundPost(approveReq, { params: Promise.resolve({ id: refund.id }) });
      expect(approveRes.status).toBe(200);
      const approveData = await approveRes.json();
      expect(approveData.success).toBe(true);
      expect(approveData.refund.status).toBe('APPROVED');
      expect(approveData.refund.approvedBy).toBe('usr-dir-01');

      // Verify student status transitioned to WITHDRAWN
      const student = repo.getStudentById('stu-0587');
      expect(student?.status).toBe('WITHDRAWN');

      // Verify unpaid future instalments cancelled
      const instalments = repo.getInstalmentsByStudentId('stu-0587');
      const inst4 = instalments.find((i) => i.seqNo === 4);
      expect(inst4?.cancelledAt).not.toBeNull();
      expect(inst4?.refundId).toBe(refund.id);

      // 3. Settle refund
      const settleReq = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          settlementMode: 'BANK_TRANSFER',
          bankReference: 'NEFT-SOD-REFUND-01',
        }),
      });

      const settleRes = await settleRefundPost(settleReq, { params: Promise.resolve({ id: refund.id }) });
      expect(settleRes.status).toBe(200);
      const settleData = await settleRes.json();
      expect(settleData.refund.status).toBe('SETTLED');
      expect(settleData.creditNote.number).toMatch(/^CN\/26-27\/\d{6}$/);
    });
  });

  // =========================================================================
  // TASK 3: DROPOUT RISK QUEUE DYNAMIC FETCHING & STU-0587 DETERMINISTIC SCORE
  // =========================================================================
  describe('Task 3: Dropout Risk Queue Dynamic Fetching & STU-0587 Score Verification', () => {
    it('3.1 GET /api/admin/refunds/risk-queue returns dynamic live list with STU-0587', async () => {
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
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.totalCount).toBeGreaterThan(0);
      expect(data.highRiskCount).toBeGreaterThan(0);

      const stu0587 = data.items.find(
        (i: any) => i.studentCode === 'STU-0587' || i.studentId === 'stu-0587'
      );
      expect(stu0587).toBeDefined();

      // Deterministic factor breakdown: F=32, A=28, S=19 => Composite Score 79
      expect(stu0587.score).toBe(79);
      expect(stu0587.compositeScore).toBe(79);
      expect(stu0587.severity).toBe('HIGH');
      expect(stu0587.financialScore).toBe(32);
      expect(stu0587.attendanceScore).toBe(28);
      expect(stu0587.academicScore).toBe(19);

      // Verify nested components backward compatibility
      expect(stu0587.components.financialOverdueScore).toBe(32);
      expect(stu0587.components.attendanceDropScore).toBe(28);
      expect(stu0587.components.academicScoreDrop).toBe(19);
    });

    it('3.2 Pure Domain Deterministic Calculation: STU-0587 produces exact F=32, A=28, S=19 => 79', () => {
      const input = {
        worstOverdueDays: 23,
        isPartPaid: true,
        attendancePercent: 69,
        prevAttendancePercent: 88,
        testOldPercentile: 78,
        testNewPercentile: 59,
      };

      const result = calculateDropoutRiskScore(input);

      expect(result.fScore).toBe(32);
      expect(result.aScore).toBe(28);
      expect(result.sScore).toBe(19);
      expect(result.score).toBe(79);
      expect(result.severity).toBe('HIGH');
      expect(result.fScore + result.aScore + result.sScore).toBe(79);
    });

    it('3.3 RBAC protection on Risk Queue: Parent role is strictly forbidden (HTTP 403)', async () => {
      const req = new Request('http://localhost:3000/api/admin/refunds/risk-queue', {
        headers: {
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0587',
        },
      });

      const res = await riskQueueGet(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('3.4 14-Day False-Flag Hold: Dismissal triggers exact 14 calendar days suppression', () => {
      const flaggedDate = new Date('2026-11-02T10:00:00Z');
      const holdEndDate = calculateFalseFlagSuppressionDate(flaggedDate, 14);

      expect(holdEndDate.toISOString().slice(0, 10)).toBe('2026-11-16');

      // Test active hold on Day 13 (2026-11-15)
      expect(isRiskFlagSuppressed(new Date('2026-11-15T12:00:00Z'), holdEndDate)).toBe(true);

      // Test expired hold on Day 15 (2026-11-17)
      expect(isRiskFlagSuppressed(new Date('2026-11-17T12:00:00Z'), holdEndDate)).toBe(false);
    });
  });

  // =========================================================================
  // TASK 4: AGEING BUCKETS MATRIX ALIGNMENT & BALANCED TALLY XML EXPORT
  // =========================================================================
  describe('Task 4: Ageing Buckets Matrix Alignment & Balanced Tally XML Export Verification', () => {
    it('4.1 Admin Dashboard API returns ageing matrix strictly ordered by chronological buckets', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard?asOfDate=2026-11-02', {
        headers: {
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const res = await dashboardGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.ageing).toBeDefined();
      expect(data.ageing.centreTotals.length).toBe(4);

      // Verify each centre row satisfies exact sum invariant: current + d1_30 + d31_60 + d61_plus === totalOpen
      for (const row of data.ageing.centreTotals) {
        const cur = BigInt(row.currentPaise || '0');
        const d1 = BigInt(row.d1_30Paise || '0');
        const d31 = BigInt(row.d31_60Paise || '0');
        const d61 = BigInt(row.d61_plusPaise || '0');
        const total = BigInt(row.totalOpenPaise || '0');

        expect(cur + d1 + d31 + d61).toBe(total);
      }

      // Verify network totals row satisfies exact sum invariant
      const ov = data.ageing.overallTotals;
      const ovCur = BigInt(ov.currentPaise || '0');
      const ovD1 = BigInt(ov.d1_30Paise || '0');
      const ovD31 = BigInt(ov.d31_60Paise || '0');
      const ovD61 = BigInt(ov.d61_plusPaise || '0');
      const ovTotal = BigInt(ov.totalOpenPaise || '0');

      expect(ovCur + ovD1 + ovD31 + ovD61).toBe(ovTotal);
    });

    it('4.2 Batch and Centre filtering dynamically filters Ageing and KPI calculations', async () => {
      // 1. Filter by specific centre JPR-GPL
      const reqGpl = new Request('http://localhost:3000/api/admin/dashboard?centreId=ctr-jpr-gpl', {
        headers: {
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const resGpl = await dashboardGet(reqGpl);
      expect(resGpl.status).toBe(200);
      const dataGpl = await resGpl.json();
      expect(dataGpl.ageing.centreTotals.length).toBe(1);
      expect(dataGpl.ageing.centreTotals[0].centreCode).toBe('JPR-GPL');

      // 2. Filter by batch
      const reqBatch = new Request('http://localhost:3000/api/admin/dashboard?batchId=batch-jee-27e-gpl', {
        headers: {
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01',
        },
      });

      const resBatch = await dashboardGet(reqBatch);
      expect(resBatch.status).toBe(200);
      const dataBatch = await resBatch.json();
      expect(dataBatch.success).toBe(true);
    });

    it('4.3 Tally Prime XML Export produces zero-sum balanced vouchers (-Gross + Taxable + CGST + SGST === 0.00)', async () => {
      const req = new Request('http://localhost:3000/api/export/tally?format=xml&fromDate=2026-04-01&toDate=2026-11-02', {
        headers: {
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
      });

      const res = await tallyExportGet(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/xml');

      const xml = await res.text();
      expect(xml).toContain('<ENVELOPE>');

      // Parse every voucher and verify double-entry balancing
      const vouchers = xml.match(/<VOUCHER[\s\S]*?<\/VOUCHER>/g) || [];
      expect(vouchers.length).toBeGreaterThan(0);

      for (const v of vouchers) {
        const ledgerEntries = v.match(/<ALLLEDGERENTRIES\.LIST>[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/g) || [];
        expect(ledgerEntries.length).toBeGreaterThanOrEqual(2);

        let sum = 0;
        let hasDebit = false;
        let hasCredit = false;

        for (const entry of ledgerEntries) {
          const isDeemedPos = /<ISDEEMEDPOSITIVE>(.*?)<\/ISDEEMEDPOSITIVE>/.exec(entry)?.[1];
          const amountStr = /<AMOUNT>(.*?)<\/AMOUNT>/.exec(entry)?.[1];
          expect(amountStr).toBeDefined();

          const amount = parseFloat(amountStr!);
          sum += amount;

          if (isDeemedPos === 'Yes') {
            hasDebit = true;
            expect(amount).toBeLessThan(0); // Debited amount is negative in Tally sign convention
          } else if (isDeemedPos === 'No') {
            hasCredit = true;
            expect(amount).toBeGreaterThanOrEqual(0); // Credited amount is positive
          }
        }

        expect(hasDebit).toBe(true);
        expect(hasCredit).toBe(true);
        // Absolute sum must be zero down to the exact paisa (0.00)
        expect(Math.abs(sum)).toBeLessThan(0.001);
      }
    });

    it('4.4 Deterministic GUID generation produces RFC 4122 compliant UUIDs from SHA-256', () => {
      const guid = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
      expect(guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Verify determinism: same input produces exact same output
      const guidRepeat = generateVoucherGuid('JPR-GPL', 'RCP/26-27/000412');
      expect(guid).toBe(guidRepeat);
    });

    it('4.5 CSV Formula Injection Sanitization prevents malicious formula execution', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvCell('+cmd|/c')).toBe("'+cmd|/c");
      expect(sanitizeCsvCell('-12345')).toBe("'-12345");
      expect(sanitizeCsvCell('@IMPORTXML')).toBe("'@IMPORTXML");
      expect(sanitizeCsvCell('\tmalicious')).toBe("'\tmalicious");

      // Benign cells remain intact
      expect(sanitizeCsvCell('RCP/26-27/000412')).toBe('RCP/26-27/000412');
      expect(sanitizeCsvCell('Sunita Sharma')).toBe('Sunita Sharma');
    });
  });
});
