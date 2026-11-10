// tests/e2e/m4_iter3_challenger_empirical.test.ts
// ============================================================================
// Milestone 4 Iteration 3 Adversarial Empirical Verification Suite
// Agent: m4_iter3_challenger_1 (Adversarial Cryptographic & Statutory Challenger)
//
// Core Objectives:
// 1. TC-16-V2 Remediation Verification:
//    - Same-day resolution of ₹1,00,000 cash in UNMATCHED_QUEUE succeeds cleanly (outcome: 'MATCHED')
//    - Same-day resolution of ₹50,000 cash with prior ₹1,00,000 matched cash succeeds cleanly (outcome: 'MATCHED')
//    - Post-resolution statutory cash ceiling: subsequent cash payment respecting/exceeding ₹2,00,000 threshold
//    - Resolution failure rollback: attempting to resolve unmatched cash exceeding recipient's daily cash limit
//    - Dedicated HTTP API route POST /api/admin/unmatched/[id]/resolve same-day cash resolution
//    - Concurrent resolution race protection: exactly one resolution succeeds, second rejected with 409
// 2. Cryptographic & Gateway Robustness:
//    - verifyWebhookSignature timing-safe HMAC-SHA256 evaluation
//    - Exhaustive attack matrix (tampering, bit-flips, null-bytes, unicode, odd-lengths, non-hex)
//    - Replay idempotency on webhook API endpoint (HTTP 200 without duplicate receipt creation)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

import { getRepository } from '@/src/store/repository';
import {
  verifyWebhookSignature,
  computeWebhookSignature,
  RAZORPAY_WEBHOOK_SECRET,
} from '@/src/domain/webhookSignature';

import { POST as resolveRoutePost } from '@/app/api/admin/unmatched/[id]/resolve/route';
import { POST as webhookPost } from '@/app/api/webhooks/razorpay/route';
import { POST as offlinePaymentPost } from '@/app/api/payments/offline/route';

const ANCHOR_DATE = '2026-11-02';

describe('m4_iter3_challenger_1: Adversarial Cryptographic & Statutory Verification Suite', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // ==========================================================================
  // SECTION 1: TC-16-V2 REMEDIATION DEEP EMPIRICAL CHALLENGE
  // ==========================================================================
  describe('Section 1: TC-16-V2 Statutory Cash Limit Same-Day Resolution Verification', () => {
    it('CHALLENGE 1.1: Same-day resolution of ₹1,00,000 UNMATCHED cash succeeds with MATCHED and issues receipt', async () => {
      const repo = getRepository();

      // Step 1: Force ₹1,00,000 cash into UNMATCHED_QUEUE on ANCHOR_DATE (e.g. cancelled instalment)
      const inst = repo.getInstalmentsByStudentId('stu-0219')[0];
      inst.cancelledAt = '2026-11-01T00:00:00Z';

      const p1 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: inst.id,
        amountPaise: 10_000_000n, // ₹1,00,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_unm_iter3_100k',
        receivedOn: ANCHOR_DATE,
      });

      expect(p1.outcome).toBe('UNMATCHED_QUEUE');
      expect(p1.paymentId).toBeDefined();

      // Total physical cash currently recorded for STU-0219 today = ₹1,00,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(10_000_000n);

      // Step 2: Uncancel instalment to accept resolution
      inst.cancelledAt = null;

      // Step 3: Same-day resolution MUST succeed without throwing Section 269ST CASH_LIMIT_EXCEEDED
      const resolveResult = await repo.resolveUnmatchedPayment(
        p1.paymentId!,
        'stu-0219',
        inst.id,
        'usr-acc-01'
      );

      expect(resolveResult.outcome).toBe('MATCHED');
      expect(resolveResult.receiptNumber).toMatch(/^RCP\/\d{2}-\d{2}\/\d{6}$/);

      // Verify the original unmatched payment record transitioned to RESOLVED
      const resolvedPayment = repo.getUnmatchedPayments('RESOLVED').find((p) => p.id === p1.paymentId);
      expect(resolvedPayment).toBeDefined();
      expect(resolvedPayment?.matchStatus).toBe('RESOLVED');

      // Crucial: Total cash tracked today for STU-0219 must remain exactly ₹1,00,000 (NOT double-counted to ₹2,00,000)
      const trackedCashAfter = repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE);
      expect(trackedCashAfter).toBe(10_000_000n);
    });

    it('CHALLENGE 1.2: Same-day resolution of ₹50,000 UNMATCHED cash when ₹1,00,000 MATCHED cash exists', async () => {
      const repo = getRepository();

      // Configure open dues for STU-0219
      const instalments = repo.getInstalmentsByStudentId('stu-0219');
      instalments[1].amountDuePaise = 10_000_000n; // ₹1,00,000
      instalments[2].amountDuePaise = 5_000_000n;  // ₹50,000

      // Step 1: Pay ₹1,00,000 CASH -> MATCHED
      const pay1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: instalments[1].id,
        amountPaise: 10_000_000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-MATCHED-1',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(pay1.outcome).toBe('MATCHED');

      // Step 2: Pay ₹50,000 CASH into UNMATCHED_QUEUE (e.g. cancelled instalment)
      instalments[2].cancelledAt = '2026-11-01T00:00:00Z';
      const pay2 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: instalments[2].id,
        amountPaise: 5_000_000n, // ₹50,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_unm_iter3_50k',
        receivedOn: ANCHOR_DATE,
      });
      expect(pay2.outcome).toBe('UNMATCHED_QUEUE');

      // Total physical cash before resolution = ₹1,50,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15_000_000n);

      // Uncancel instalment
      instalments[2].cancelledAt = null;

      // Step 3: Resolve the ₹50,000 payment on same day
      const resolveResult = await repo.resolveUnmatchedPayment(
        pay2.paymentId!,
        'stu-0219',
        instalments[2].id,
        'usr-acc-01'
      );

      expect(resolveResult.outcome).toBe('MATCHED');
      expect(resolveResult.receiptNumber).toBeDefined();

      // Total daily cash must remain exactly ₹1,50,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15_000_000n);
    });

    it('CHALLENGE 1.3: Post-resolution cash ceiling: subsequent cash payment respects Section 269ST', async () => {
      const repo = getRepository();

      // Setup: STU-0219 has 3 instalments (inst1 already paid, inst2 ₹40k, inst3 ₹40k)
      // Expand inst2 and inst3 dues so open dues exist for the test:
      // inst2 = ₹1,00,000 due, inst3 = ₹1,00,000 due
      const instalments = repo.getInstalmentsByStudentId('stu-0219');
      instalments[1].amountDuePaise = 10_000_000n; // inst-0219-2: ₹1,00,000
      instalments[2].amountDuePaise = 10_000_000n; // inst-0219-3: ₹1,00,000

      // 1. Pay ₹1,00,000 cash against inst2 -> MATCHED
      await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: instalments[1].id,
        amountPaise: 10_000_000n,
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-PRIOR-100K',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });

      // 2. Pay ₹50,000 cash against inst3 while temporarily cancelled -> UNMATCHED_QUEUE
      instalments[2].cancelledAt = '2026-11-01T00:00:00Z';
      const unmPay = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: instalments[2].id,
        amountPaise: 5_000_000n,
        mode: 'CASH',
        gatewayPaymentId: 'csh_unm_150k_test',
        receivedOn: ANCHOR_DATE,
      });
      instalments[2].cancelledAt = null;

      // Resolve the ₹50,000 unmatched cash against inst3
      await repo.resolveUnmatchedPayment(unmPay.paymentId!, 'stu-0219', instalments[2].id, 'usr-acc-01');

      // Now total cash received today is ₹1,50,000. Limit is ₹2,00,000.
      // inst3 has remaining open dues of ₹50,000 (100k - 50k = 50k).
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15_000_000n);

      // Attempting an additional ₹50,000 cash payment pushes daily total to ₹2,00,000 -> MUST BE REJECTED (Section 269ST)!
      await expect(
        repo.recordOfflinePayment({
          studentId: 'stu-0219',
          instalmentId: instalments[2].id,
          amountPaise: 5_000_000n, // ₹50,000
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
          reference: 'CASH-EXCEED-LIMIT',
          payerName: 'Parent Gurjar',
          actorUserId: 'usr-acc-01',
        })
      ).rejects.toThrow(/Section 269ST/i);

      // Attempting an additional ₹49,999 cash payment brings daily total to ₹1,99,999 -> MUST SUCCEED (MATCHED)!
      const subRes = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: instalments[2].id,
        amountPaise: 4_999_900n, // ₹49,999
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-WITHIN-LIMIT',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(subRes.outcome).toBe('MATCHED');
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(19_999_900n); // exactly ₹1,99,999
    });

    it('CHALLENGE 1.4: Resolution failure rollback: resolving cash that exceeds recipient daily cash limit fails cleanly and preserves UNMATCHED_QUEUE status', async () => {
      const repo = getRepository();

      // Student STU-0219 already has ₹1,50,000 MATCHED cash today
      const instalments = repo.getInstalmentsByStudentId('stu-0219');
      instalments[0].amountDuePaise = 15_000_000n; // ₹1,50,000
      await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: instalments[0].id,
        amountPaise: 15_000_000n,
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-150K-MATCHED',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15_000_000n);

      // Unreferenced CASH deposit of ₹80,000 arrives in holding queue (NO_REFERENCE, studentId undefined)
      const mysteryCash = await repo.recordPayment({
        amountPaise: 8_000_000n, // ₹80,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_unreferenced_80k',
        receivedOn: ANCHOR_DATE,
      });
      expect(mysteryCash.outcome).toBe('UNMATCHED_QUEUE');
      expect(mysteryCash.reasonCode).toBe('NO_REFERENCE');

      // Accounts executive attempts to resolve this ₹80,000 cash payment to STU-0219.
      // ₹1,50,000 + ₹80,000 = ₹2,30,000 >= ₹2,00,000 limit -> MUST FAIL with 422 CASH_LIMIT_EXCEEDED!
      await expect(
        repo.resolveUnmatchedPayment(mysteryCash.paymentId!, 'stu-0219', instalments[1].id, 'usr-acc-01')
      ).rejects.toThrow(/Section 269ST/i);

      // Statutory Rollback Guard: The payment must still be in UNMATCHED_QUEUE (not stuck in RESOLVED or lost)
      const holdingPayments = repo.getUnmatchedPayments('UNMATCHED_QUEUE');
      const recoveredPayment = holdingPayments.find((p) => p.id === mysteryCash.paymentId);
      expect(recoveredPayment).toBeDefined();
      expect(recoveredPayment?.matchStatus).toBe('UNMATCHED_QUEUE');

      // STU-0219 cash today remains exactly ₹1,50,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15_000_000n);
    });

    it('CHALLENGE 1.5: Dedicated HTTP route POST /api/admin/unmatched/[id]/resolve resolves same-day ₹1,00,000 cash payment', async () => {
      const repo = getRepository();

      // Park ₹1,00,000 cash payment in UNMATCHED_QUEUE
      const inst = repo.getInstalmentsByStudentId('stu-0219')[0];
      inst.cancelledAt = '2026-11-01T00:00:00Z';

      const p1 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: inst.id,
        amountPaise: 10_000_000n, // ₹1,00,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_route_test_100k',
        receivedOn: ANCHOR_DATE,
      });
      expect(p1.outcome).toBe('UNMATCHED_QUEUE');
      inst.cancelledAt = null;

      // Invoke the HTTP route handler directly with ACCOUNTS_EXEC session
      const req = new Request(`http://localhost:3000/api/admin/unmatched/${p1.paymentId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          targetStudentId: 'stu-0219',
          targetInstalmentId: inst.id,
        }),
      });

      const res = await resolveRoutePost(req, { params: Promise.resolve({ id: p1.paymentId! }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.result.outcome).toBe('MATCHED');
      expect(json.receiptNumber).toMatch(/^RCP\/\d{2}-\d{2}\/\d{6}$/);

      // Verify daily cash after HTTP route resolution is exactly ₹1,00,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(10_000_000n);
    });

    it('CHALLENGE 1.6: Concurrent race resolution protection: second resolution attempt is rejected with 409 Conflict', async () => {
      const repo = getRepository();

      const inst = repo.getInstalmentsByStudentId('stu-0219')[0];
      inst.cancelledAt = '2026-11-01T00:00:00Z';

      const p1 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: inst.id,
        amountPaise: 10_000_000n,
        mode: 'CASH',
        gatewayPaymentId: 'csh_race_test_100k',
        receivedOn: ANCHOR_DATE,
      });
      inst.cancelledAt = null;

      // Attempt two parallel resolutions for the same payment
      const results = await Promise.allSettled([
        repo.resolveUnmatchedPayment(p1.paymentId!, 'stu-0219', inst.id, 'usr-acc-01'),
        repo.resolveUnmatchedPayment(p1.paymentId!, 'stu-0219', inst.id, 'usr-acc-02'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed, and exactly one must fail with 409 Conflict
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      const err = (rejected[0] as PromiseRejectedResult).reason;
      expect(err.statusCode || err.status).toBe(409);
      expect(err.message).toMatch(/not in unmatched queue/i);
    });
  });

  // ==========================================================================
  // SECTION 2: WEBHOOK CRYPTOGRAPHIC HARNESS & IDEMPOTENCY
  // ==========================================================================
  describe('Section 2: Razorpay Webhook Cryptographic Security & Replay Resilience', () => {
    const validSecret = 'rzp_test_secret_m4_iter3';
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_crypto_001',
            amount: 1500000,
            status: 'captured',
            notes: { studentId: 'stu-0587', instalmentId: 'inst-0587-3' },
          },
        },
      },
    });

    it('CHALLENGE 2.1: Timing-safe HMAC-SHA256 signature verification accepts valid digest', () => {
      const signature = computeWebhookSignature(payload, validSecret);
      expect(verifyWebhookSignature(payload, signature, validSecret)).toBe(true);
    });

    it('CHALLENGE 2.2: Cryptographic tampering rejection across 64-character space', () => {
      const genuineSig = computeWebhookSignature(payload, validSecret);

      // Single character flip at first, middle, and last position
      const tamperedFirst = (genuineSig[0] === 'a' ? 'b' : 'a') + genuineSig.slice(1);
      const tamperedMid = genuineSig.slice(0, 32) + (genuineSig[32] === 'a' ? 'b' : 'a') + genuineSig.slice(33);
      const tamperedLast = genuineSig.slice(0, 63) + (genuineSig[63] === 'a' ? 'b' : 'a');

      expect(verifyWebhookSignature(payload, tamperedFirst, validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, tamperedMid, validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, tamperedLast, validSecret)).toBe(false);
    });

    it('CHALLENGE 2.3: Non-hex, null bytes, unicode emojis, and length mutations are rejected without throwing', () => {
      const genuineSig = computeWebhookSignature(payload, validSecret);

      // Odd lengths
      expect(verifyWebhookSignature(payload, genuineSig.slice(0, 63), validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, genuineSig + '0', validSecret)).toBe(false);

      // Null byte injection
      expect(verifyWebhookSignature(payload, genuineSig.slice(0, 63) + '\0', validSecret)).toBe(false);

      // Unicode emojis and symbols
      expect(verifyWebhookSignature(payload, genuineSig.slice(0, 62) + '🔒', validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, genuineSig.slice(0, 63) + 'g', validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, genuineSig.slice(0, 63) + 'Z', validSecret)).toBe(false);

      // Empty signature or body
      expect(verifyWebhookSignature('', genuineSig, validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, '', validSecret)).toBe(false);
      expect(verifyWebhookSignature(payload, genuineSig, '')).toBe(false);
    });

    it('CHALLENGE 2.4: Webhook HTTP Endpoint Replay Resilience: initial succeeds, duplicate replay returns HTTP 200 idempotently', async () => {
      const repo = getRepository();

      const student = repo.getStudentById('stu-0587');
      expect(student).toBeDefined();

      const webhookBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_iter3_replay_test_01',
              amount: 1500000, // ₹15,000
              currency: 'INR',
              status: 'captured',
              notes: {
                studentId: 'stu-0587',
                instalmentId: 'inst-0587-3',
                studentName: 'Aarav Sharma',
              },
            },
          },
        },
      });

      const signature = computeWebhookSignature(webhookBody, RAZORPAY_WEBHOOK_SECRET);

      // Delivery 1: Genuine webhook
      const req1 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: webhookBody,
      });

      const res1 = await webhookPost(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.receiptNumber).toMatch(/^RCP\/\d{2}-\d{2}\/\d{6}$/);

      const receiptsBefore = repo.getReceipts().length;

      // Delivery 2: Replay of identical webhook
      const req2 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: webhookBody,
      });

      const res2 = await webhookPost(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.success).toBe(true);
      expect(data2.message).toMatch(/duplicate|already processed/i);

      // Zero new receipts created on replay
      const receiptsAfter = repo.getReceipts().length;
      expect(receiptsAfter).toBe(receiptsBefore);
    });
  });
});
