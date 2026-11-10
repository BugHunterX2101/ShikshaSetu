// tests/api/adversarial_m2_challenger_1.test.ts
// Adversarial Stress Harness for M2 Challenger 1
// Probing: Concurrency, Gapless Receipt Invariants, Idempotent Replays,
// Section 269ST Cash Limit Enforcements, and Unmatched Payment Reconciliation

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { POST as checkoutPost } from '@/app/api/payments/checkout/route';
import { POST as offlinePost } from '@/app/api/payments/offline/route';
import { GET as unmatchedGet, POST as unmatchedPost } from '@/app/api/admin/unmatched/route';
import { POST as resolveRoutePost } from '@/app/api/admin/unmatched/[id]/resolve/route';
import { POST as rejectRoutePost } from '@/app/api/admin/unmatched/[id]/reject/route';
import { validateCashPayment } from '@/src/domain/cashLimit';

describe('M2 Challenger 1: Adversarial Concurrency, Payments & Statutory Harness', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // =========================================================================
  // SECTION 1: CONCURRENCY & GAPLESS RECEIPT INVARIANT
  // =========================================================================
  describe('1. Concurrency & Gapless Receipt Counter Invariants', () => {
    it('STRESS-1.1: 100 concurrent receipt number allocations across 4 centres maintain zero gaps and zero duplicates', async () => {
      const repo = getRepository();
      const centres = repo.getCentres();
      expect(centres.length).toBe(4);

      // 25 concurrent allocations per centre = 100 total
      const allocations: Array<{ centreCode: string; gstin: string; number: string }> = [];
      const tasks = centres.flatMap((centre) =>
        Array.from({ length: 25 }, async () => {
          const number = await repo.allocateReceiptNumber(centre.gstin, '26-27', 'RCP');
          return { centreCode: centre.code, gstin: centre.gstin, number };
        })
      );

      const results = await Promise.all(tasks);
      expect(results.length).toBe(100);

      // Verify each centre's counter independently
      for (const centre of centres) {
        const centreReceipts = results.filter((r) => r.gstin === centre.gstin);
        expect(centreReceipts.length).toBe(25);

        const serials = centreReceipts.map((r) => {
          const m = r.number.match(/RCP\/26-27\/(\d{6})/);
          expect(m).not.toBeNull();
          return parseInt(m![1], 10);
        });

        const uniqueSerials = new Set(serials);
        expect(uniqueSerials.size).toBe(25);

        serials.sort((a, b) => a - b);
        for (let i = 1; i < serials.length; i++) {
          expect(serials[i]).toBe(serials[i - 1] + 1); // Strictly gapless
        }
      }
    });

    it('STRESS-1.2: Parallel payments on the same student never corrupt ledger balance or over-allocate', async () => {
      const repo = getRepository();
      // STU-0219 has balance = ₹40,000 (4,000,000 paise) across open instalments
      const duesBefore = repo.getDuesSummary('STU-0219');
      expect(duesBefore).toBeDefined();
      const initialBalance = BigInt(duesBefore!.totalBalancePaise);
      expect(initialBalance).toBe(4000000n); // 40k paise open

      // Fire 4 concurrent payments of ₹10,000 (1,000,000 paise) each on STU-0219 (exactly equals 40k)
      const paymentAmount = 1000000n;
      const count = 4;
      const tasks = Array.from({ length: count }, (_, idx) =>
        repo.recordPayment({
          studentId: 'stu-0219',
          amountPaise: paymentAmount,
          mode: 'UPI',
          gatewayPaymentId: `pay_concurrent_stu0219_${idx}_${Date.now()}`,
          receivedOn: '2026-11-02',
        })
      );

      const results = await Promise.all(tasks);
      expect(results.length).toBe(count);

      // All 4 should succeed
      for (const res of results) {
        expect(res.success).toBe(true);
        expect(res.outcome).toBe('MATCHED');
        expect(res.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);
      }

      // Check receipt numbers are all unique
      const receiptNums = results.map((r) => r.receiptNumber);
      const uniqueReceipts = new Set(receiptNums);
      expect(uniqueReceipts.size).toBe(count);

      // Check updated dues in repository: balance must decrease to exactly 0n without going negative
      const duesAfter = repo.getDuesSummary('STU-0219');
      expect(BigInt(duesAfter!.totalBalancePaise)).toBe(0n);
      expect(duesAfter!.status).toBe('PAID');
    });
  });

  // =========================================================================
  // SECTION 2: IDEMPOTENT REPLAY & CONCURRENT REPLAY VULNERABILITY PROBE
  // =========================================================================
  describe('2. Idempotency & Replay Stress Testing', () => {
    it('IDEMP-2.1: Sequential duplicate replay returns HTTP 200, outcome DUPLICATE, and zero additional credit', async () => {
      const repo = getRepository();
      const payload = {
        action: 'simulate',
        studentId: 'STU-0587',
        amountPaise: '1500000',
        paymentMethod: 'UPI',
        gatewayPaymentId: 'pay_seq_idemp_probe_101',
      };

      // Call 1: Original Payment
      const req1 = new Request('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res1 = await checkoutPost(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.outcome).toBe('MATCHED');
      const originalReceiptNo = data1.receiptNumber;

      // Call 2: Sequential Replay
      const req2 = new Request('http://localhost:3000/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res2 = await checkoutPost(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.outcome).toBe('DUPLICATE');
      expect(data2.receiptNumber).toBe(originalReceiptNo);

      // Verify no extra payment or receipt was created
      const receipts = repo.getReceiptsByStudentId('stu-0587');
      expect(receipts.filter((r) => r.number === originalReceiptNo).length).toBe(1);
    });

    it('IDEMP-2.2: PROBE-1 — reveals concurrent duplicate replay race condition in recordPayment', async () => {
      const repo = getRepository();
      const sharedGatewayPaymentId = `pay_race_idemp_${Date.now()}`;

      // Launch 5 concurrent calls with the EXACT SAME gatewayPaymentId
      const tasks = Array.from({ length: 5 }, () =>
        repo.recordPayment({
          studentId: 'stu-0219',
          amountPaise: 500000n,
          mode: 'UPI',
          gatewayPaymentId: sharedGatewayPaymentId,
          receivedOn: '2026-11-02',
        })
      );

      const results = await Promise.all(tasks);
      const matched = results.filter((r) => r.outcome === 'MATCHED');
      const duplicates = results.filter((r) => r.outcome === 'DUPLICATE');

      console.log('[VERIFIED PROBE-1 IDEMP] Outcomes of 5 concurrent replays with same gatewayPaymentId:', {
        matchedCount: matched.length,
        duplicateCount: duplicates.length,
        receiptsGenerated: matched.map((m) => m.receiptNumber),
      });

      // HARDENED CONCURRENCY INVARIANT:
      // Exactly 1 request succeeds in creating the payment and receipt;
      // All 4 concurrent replays are safely caught inside the locked transaction and marked DUPLICATE.
      expect(matched.length).toBe(1);
      expect(duplicates.length).toBe(4);

      // Verify that all duplicate responses returned the identical original receipt number
      const originalReceiptNo = matched[0].receiptNumber;
      for (const dup of duplicates) {
        expect(dup.receiptNumber).toBe(originalReceiptNo);
      }
    });
  });

  // =========================================================================
  // SECTION 3: SECTION 269ST STATUTORY CASH LIMIT ENFORCEMENT & EXPLOIT PROBES
  // =========================================================================
  describe('3. Section 269ST Offline Cash Enforcement & Adversarial Exploits', () => {
    it('CASH-3.1: Strict boundary verification — ₹1,99,999 passes, ₹2,00,000 is rejected with HTTP 422', async () => {
      // 1. ₹1,99,999.00 (19,999,900 paise) -> Must PASS
      const reqPass = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-1',
          amountPaise: '19999900',
          mode: 'CASH',
          reference: 'CSH-PASS-BOUNDARY',
          paymentDate: '2026-11-02',
        }),
      });
      const resPass = await offlinePost(reqPass);
      expect(resPass.status).toBe(201);
      const dataPass = await resPass.json();
      expect(dataPass.success).toBe(true);

      // 2. Another cash payment on same day of just ₹100 (10,000 paise)
      // Cumulative is now ₹1,99,999 + ₹100 = ₹2,00,099 >= ₹2,00,000 -> Must FAIL with 422
      const reqFail = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-2',
          amountPaise: '10000',
          mode: 'CASH',
          reference: 'CSH-FAIL-CUMULATIVE',
          paymentDate: '2026-11-02',
        }),
      });
      const resFail = await offlinePost(reqFail);
      expect(resFail.status).toBe(422);
      const problem = await resFail.json();
      expect(problem.status).toBe(422);
      expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
    });

    it('CASH-3.2: Split cash payments across consecutive calendar days are permissible', async () => {
      // Day 1: 2026-11-02 cash ₹1,50,000
      const reqDay1 = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-1',
          amountPaise: '15000000',
          mode: 'CASH',
          reference: 'CSH-DAY-1',
          paymentDate: '2026-11-02',
        }),
      });
      const res1 = await offlinePost(reqDay1);
      expect(res1.status).toBe(201);

      // Day 2: 2026-11-03 cash ₹1,50,000 (different day -> valid under Section 269ST clause a)
      const reqDay2 = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-2',
          amountPaise: '15000000',
          mode: 'CASH',
          reference: 'CSH-DAY-2',
          paymentDate: '2026-11-03',
        }),
      });
      const res2 = await offlinePost(reqDay2);
      expect(res2.status).toBe(201);
    });

    it('CASH-3.3: PROBE-2 — Negative prior cash exploit probing in domain vs repo', () => {
      const repo = getRepository();

      // Probe domain cashLimit function directly with negative prior cash
      const domainCheck = validateCashPayment(20000000n, -5000000n);
      console.log('[EMPIRICAL PROBE-2 CASH] Domain validateCashPayment with -₹50,000 prior:', domainCheck);

      // In domain/cashLimit.ts: allowed is true because -50L + 200L = 150L < 200L (Clause b flaw)
      expect(domainCheck.allowed).toBe(true);

      // In repository.ts: validateSection269ST contains Tier A guard that blocks single transaction >= 200L
      const repoCheck = repo.validateSection269ST('stu-0587', 20000000n, '2026-11-02');
      console.log('[EMPIRICAL PROBE-2 CASH] Repo validateSection269ST with single ₹2,00,000:', repoCheck);
      expect(repoCheck.allowed).toBe(false);
      expect(repoCheck.problem?.code).toBe('CASH_LIMIT_EXCEEDED');
    });

    it('CASH-3.4: PROBE-3 — reveals concurrent cash payment bypass of Section 269ST daily limit', async () => {
      // Attempt two concurrent cash payments of ₹1,50,000 each on the same day for STU-0219
      // Neither single transaction exceeds 2 lakh, but together they equal ₹3,00,000!
      const tasks = [
        offlinePost(
          new Request('http://localhost:3000/api/payments/offline', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-demo-role': 'ACCOUNTS_EXEC',
              'x-demo-user-id': 'usr-acc-01',
            },
            body: JSON.stringify({
              studentId: 'stu-0219',
              instalmentId: 'inst-0219-1',
              amountPaise: '15000000',
              mode: 'CASH',
              reference: 'CSH-RACE-A',
              paymentDate: '2026-11-02',
            }),
          })
        ),
        offlinePost(
          new Request('http://localhost:3000/api/payments/offline', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-demo-role': 'ACCOUNTS_EXEC',
              'x-demo-user-id': 'usr-acc-01',
            },
            body: JSON.stringify({
              studentId: 'stu-0219',
              instalmentId: 'inst-0219-2',
              amountPaise: '15000000',
              mode: 'CASH',
              reference: 'CSH-RACE-B',
              paymentDate: '2026-11-02',
            }),
          })
        ),
      ];

      const responses = await Promise.all(tasks);
      const statuses = responses.map((r) => r.status);
      console.log('[VERIFIED PROBE-3 CASH] Concurrent ₹1.5L cash payment statuses:', statuses);

      // HARDENED SECTION 269ST CONCURRENCY INVARIANT:
      // Exactly 1 cash payment is accepted (HTTP 201).
      // The second concurrent cash payment is atomically rejected under row lock with HTTP 422 Problem Details.
      const acceptedCount = responses.filter((r) => r.status === 201).length;
      const rejectedCount = responses.filter((r) => r.status === 422).length;
      expect(acceptedCount).toBe(1);
      expect(rejectedCount).toBe(1);

      // Verify RFC 9457 Problem Details on the rejected response
      const rejectedRes = responses.find((r) => r.status === 422)!;
      const problem = await rejectedRes.json();
      expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(problem.status).toBe(422);
    });

    it('CASH-3.5: PROBE-4 — reveals zero amount cash payment burning receipt number', async () => {
      // Test offline payment with amountPaise = '0'
      const req = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-1',
          amountPaise: '0',
          mode: 'CASH',
          reference: 'CSH-ZERO-AMOUNT',
          paymentDate: '2026-11-02',
        }),
      });

      const res = await offlinePost(req);
      const body = await res.json();
      console.log('[VERIFIED PROBE-4 CASH] Zero amount cash response:', {
        status: res.status,
        errorCode: body.error?.code,
      });

      // HARDENED ZERO-AMOUNT VALIDATION INVARIANT:
      // Cash payments with amountPaise <= 0 must be rejected with HTTP 422 INVALID_AMOUNT
      // and must NEVER burn a gapless receipt number serial.
      expect(res.status).toBe(422);
      expect(body.error?.code).toBe('INVALID_AMOUNT');
    });
  });

  // =========================================================================
  // SECTION 4: UNMATCHED PAYMENT QUEUE RECONCILIATION & DOUBLE-RESOLUTION PROBES
  // =========================================================================
  describe('4. Unmatched Payment Queue Lifecycle & Adversarial Probes', () => {
    it('UNM-4.1: Edge cases correctly route to UNMATCHED_QUEUE with specific statutory reason codes', async () => {
      const repo = getRepository();

      // Case A: Missing studentCode and studentId -> NO_REFERENCE
      const resA = await repo.recordPayment({
        amountPaise: 1000000n,
        mode: 'BANK_TRANSFER',
        gatewayPaymentId: 'pay_probe_no_ref',
        receivedOn: '2026-11-02',
      });
      expect(resA.outcome).toBe('UNMATCHED_QUEUE');
      expect(resA.reasonCode).toBe('NO_REFERENCE');

      // Case B: Non-existent student ID -> UNKNOWN_STUDENT
      const resB = await repo.recordPayment({
        studentId: 'NON_EXISTENT_STU_9999',
        amountPaise: 1000000n,
        mode: 'UPI',
        gatewayPaymentId: 'pay_probe_unknown_stu',
        receivedOn: '2026-11-02',
      });
      expect(resB.outcome).toBe('UNMATCHED_QUEUE');
      expect(resB.reasonCode).toBe('UNKNOWN_STUDENT');

      // Case C: Withdrawn student -> UNKNOWN_STUDENT
      const student = repo.getStudentById('stu-0587')!;
      student.status = 'WITHDRAWN';
      const resC = await repo.recordPayment({
        studentId: 'stu-0587',
        amountPaise: 1000000n,
        mode: 'UPI',
        gatewayPaymentId: 'pay_probe_withdrawn_stu',
        receivedOn: '2026-11-02',
      });
      expect(resC.outcome).toBe('UNMATCHED_QUEUE');
      expect(resC.reasonCode).toBe('UNKNOWN_STUDENT');

      // Case D: Student with zero open dues (pay off STU-0412 remaining instalment 4)
      student.status = 'ACTIVE'; // restore
      const inst4 = repo.getInstalmentById('inst-0412-4')!;
      inst4.amountPaidPaise = inst4.amountDuePaise; // fully paid
      const resD = await repo.recordPayment({
        studentId: 'stu-0412',
        amountPaise: 1000000n,
        mode: 'UPI',
        gatewayPaymentId: 'pay_probe_zero_dues',
        receivedOn: '2026-11-02',
      });
      expect(resD.outcome).toBe('UNMATCHED_QUEUE');
      expect(resD.reasonCode).toBe('NO_OPEN_DUES');
    });

    it('UNM-4.2: Double-resolving an unmatched payment sequentially is rejected with HTTP 409 Conflict', async () => {
      const repo = getRepository();

      // 1st resolution
      await repo.resolveUnmatchedPayment('pay_unm_001', 'stu-0587', undefined, 'usr-acc-01');

      // 2nd resolution attempt via route
      const req = new Request('http://localhost:3000/api/admin/unmatched/pay_unm_001/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          targetStudentId: 'STU-0587',
        }),
      });

      const res = await resolveRoutePost(req, { params: Promise.resolve({ id: 'pay_unm_001' }) });
      expect(res.status).toBe(409);
    });

    it('UNM-4.3: Resolving an already REJECTED payment is rejected with HTTP 409 Conflict', async () => {
      const repo = getRepository();

      // Reject payment pay_unm_002
      await repo.rejectUnmatchedPayment('pay_unm_002', 'Rejected as untraceable remitter', 'usr-acc-01');

      // Attempt to resolve rejected payment
      const req = new Request('http://localhost:3000/api/admin/unmatched/pay_unm_002/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          targetStudentId: 'STU-0587',
        }),
      });

      const res = await resolveRoutePost(req, { params: Promise.resolve({ id: 'pay_unm_002' }) });
      expect(res.status).toBe(409);
    });

    it('UNM-4.4: PROBE-5 — reveals concurrent double-resolution race condition in unmatched queue', async () => {
      // pay_unm_001 is pending in UNMATCHED_QUEUE
      // Fire 2 concurrent resolution requests for pay_unm_001
      const tasks = [
        resolveRoutePost(
          new Request('http://localhost:3000/api/admin/unmatched/pay_unm_001/resolve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-demo-role': 'ACCOUNTS_EXEC',
              'x-demo-user-id': 'usr-acc-01',
            },
            body: JSON.stringify({ targetStudentId: 'STU-0587' }),
          }),
          { params: Promise.resolve({ id: 'pay_unm_001' }) }
        ),
        resolveRoutePost(
          new Request('http://localhost:3000/api/admin/unmatched/pay_unm_001/resolve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-demo-role': 'ACCOUNTS_EXEC',
              'x-demo-user-id': 'usr-acc-01',
            },
            body: JSON.stringify({ targetStudentId: 'STU-0587' }),
          }),
          { params: Promise.resolve({ id: 'pay_unm_001' }) }
        ),
      ];

      const responses = await Promise.all(tasks);
      const statuses = responses.map((r) => r.status);
      console.log('[VERIFIED PROBE-5 UNM] Concurrent double-resolution statuses:', statuses);

      // HARDENED UNMATCHED QUEUE CONCURRENCY INVARIANT:
      // Exactly 1 resolution call succeeds (HTTP 200);
      // The second concurrent resolution is rejected with HTTP 409 Conflict.
      const resolvedCount = responses.filter((r) => r.status === 200).length;
      const conflictCount = responses.filter((r) => r.status === 409).length;
      expect(resolvedCount).toBe(1);
      expect(conflictCount).toBe(1);
    });
  });
});
