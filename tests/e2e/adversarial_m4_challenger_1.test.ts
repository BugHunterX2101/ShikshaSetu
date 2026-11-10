// tests/e2e/adversarial_m4_challenger_1.test.ts
// ============================================================================
// ShikshaSetu Milestone 4 Adversarial Stress & Empirical Challenge Suite
// Challenger: m4_challenger_1 (Cryptographic & Statutory Challenger)
//
// Rigorous empirical verification of:
// 1. TC-02: 18% GST Reverse Split Precision (fuzzing, zero-drift invariant, boundary points, large values)
// 2. TC-04b: Webhook HMAC-SHA256 Cryptographic Attack Harness (tampering, bit-flips, replay, corrupt payloads)
// 3. TC-12: Refund Segregation of Duties Matrix (role permutations, self-approval, invalid transitions)
// 4. TC-16: Section 269ST Cash Limit Boundary & Multi-Instalment Daily Cash Aggregation
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

// Domain Imports
import {
  calculateGstReverseSplit,
  formatPaiseToRupees,
  formatPaiseToCurrency,
  formatGstSplit,
  verifyWebhookSignature,
  computeWebhookSignature,
  RAZORPAY_WEBHOOK_SECRET,
  SECTION_269ST_LIMIT_PAISE,
  SECTION_269ST_MAX_ALLOWED_PAISE,
  validateCashLimit,
  validateCashPayment,
} from '@/src/domain';

// Store & Lib Imports
import { getRepository } from '@/src/store/repository';

// Route Handlers
import { POST as webhookPost } from '@/app/api/webhooks/razorpay/route';
import { POST as offlinePaymentPost } from '@/app/api/payments/offline/route';
import { POST as raiseRefundPost } from '@/app/api/admin/refunds/route';
import { POST as approveRefundPost } from '@/app/api/admin/refunds/[id]/approve/route';

const ANCHOR_DATE = '2026-11-02';

describe('m4_challenger_1: Adversarial Empirical Verification Suite', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // ==========================================================================
  // CHALLENGE 1: TC-02 - 18% GST REVERSE SPLIT PRECISION & ORACLE
  // ==========================================================================
  describe('Challenge 1 (TC-02): 18% GST Reverse Split Precision & Invariant Fuzzing', () => {
    it('exact mathematical oracle: round_half_up(9 * G / 118) matches T across boundary transition points', () => {
      // In Rajasthan GST SAC 999293 (18% inclusive):
      // CGST = SGST = T = round_half_up(9 * G / 118) = floor((18 * G + 118) / 236)
      // Check first 500 integer paise amounts against rational exact rounding
      for (let g = 0n; g <= 500n; g++) {
        const split = calculateGstReverseSplit(g);
        const expectedT = (18n * g + 118n) / 236n;

        expect(split.cgstPaise).toBe(expectedT);
        expect(split.sgstPaise).toBe(expectedT);
        expect(split.taxablePaise).toBe(g - 2n * expectedT);
        expect(split.taxablePaise + split.cgstPaise + split.sgstPaise).toBe(g);
      }
    });

    it('zero-loss invariant: Taxable + CGST + SGST === Gross across 50,000 pseudorandom paise values up to ₹10 Crore', () => {
      // Deterministic LCG pseudorandom generator for reproducibility
      let seed = 123456789n;
      const nextRand = () => {
        seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
        return seed;
      };

      for (let i = 0; i < 50000; i++) {
        const gross = nextRand() % 1000000000n;
        const split = calculateGstReverseSplit(gross);

        // Core Invariants:
        expect(split.cgstPaise).toBe(split.sgstPaise);
        expect(split.taxablePaise + split.cgstPaise + split.sgstPaise).toBe(gross);
        expect(split.taxablePaise).toBeGreaterThanOrEqual(0n);
        expect(split.cgstPaise).toBeGreaterThanOrEqual(0n);
      }
    });

    it('inter-state IGST split: satisfies Taxable + IGST === Gross across 20,000 pseudorandom points', () => {
      let seed = 987654321n;
      const nextRand = () => {
        seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
        return seed;
      };

      for (let i = 0; i < 20000; i++) {
        const gross = nextRand() % 500000000n;
        const split = calculateGstReverseSplit(gross, true);

        expect(split.cgstPaise).toBe(0n);
        expect(split.sgstPaise).toBe(0n);
        expect(split.igstPaise + split.taxablePaise).toBe(gross);
        expect(split.totalTaxPaise).toBe(split.igstPaise);
      }
    });

    it('extreme magnitude boundary tests (10^12 paise / ₹10,000 Crore institutional fees)', () => {
      const megaGross = 100000000000000n; // 10^14 paise
      const split = calculateGstReverseSplit(megaGross);
      expect(split.cgstPaise).toBe(split.sgstPaise);
      expect(split.taxablePaise + split.cgstPaise + split.sgstPaise).toBe(megaGross);

      const formatted = formatPaiseToCurrency(megaGross);
      expect(formatted).toContain('₹');
      expect(formatted).toContain('.00');
    });

    it('negative gross amounts throw RangeError', () => {
      expect(() => calculateGstReverseSplit(-1n)).toThrow(RangeError);
      expect(() => calculateGstReverseSplit(-100000n)).toThrow('Gross amount cannot be negative');
    });

    it('rupee and currency formatting utilities preserve exact decimals without floating point corruption', () => {
      expect(formatPaiseToRupees(0n)).toBe('0.00');
      expect(formatPaiseToRupees(1n)).toBe('0.01');
      expect(formatPaiseToRupees(99n)).toBe('0.99');
      expect(formatPaiseToRupees(100n)).toBe('1.00');
      expect(formatPaiseToRupees(101n)).toBe('1.01');
      expect(formatPaiseToRupees(1500000n)).toBe('15000.00');
      expect(formatPaiseToCurrency(1500000n)).toBe('₹15,000.00');
      expect(formatPaiseToCurrency(19999900n)).toBe('₹1,99,999.00');
    });
  });

  // ==========================================================================
  // CHALLENGE 2: TC-04b - WEBHOOK HMAC-SHA256 ATTACK HARNESS & REPLAY
  // ==========================================================================
  describe('Challenge 2 (TC-04b): Webhook Cryptographic Attack Harness & Replay Protection', () => {
    const validSecret = RAZORPAY_WEBHOOK_SECRET;
    const basePayload = JSON.stringify({
      gatewayPaymentId: 'pay_adv_challenge_001',
      studentId: 'STU-0587',
      instalmentId: 'inst-0587-3',
      amountPaise: 1500000,
      mode: 'UPI',
      receivedOn: ANCHOR_DATE,
    });

    it('timingSafeEqual guards against even-length byte mismatch and empty inputs', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);
      expect(genuineSig.length).toBe(64);

      // Truncated signature by 2 chars (62 chars -> 31 bytes)
      const truncated62 = genuineSig.slice(0, 62);
      expect(verifyWebhookSignature(basePayload, truncated62, validSecret)).toBe(false);

      // Extended signature by 2 chars (66 chars -> 33 bytes)
      const extended66 = genuineSig + '00';
      expect(verifyWebhookSignature(basePayload, extended66, validSecret)).toBe(false);

      // Empty string signature
      expect(verifyWebhookSignature(basePayload, '', validSecret)).toBe(false);

      // Empty body
      expect(verifyWebhookSignature('', genuineSig, validSecret)).toBe(false);

      // Empty secret
      expect(verifyWebhookSignature(basePayload, genuineSig, '')).toBe(false);
    });

    it('TC-04b-V1 REGRESSION GUARD: verifyWebhookSignature strictly rejects 65-character malformed signatures', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);
      expect(genuineSig.length).toBe(64);

      // Appending a single odd hex char creates a 65-character malformed signature
      const malformedSig65 = genuineSig + '0';
      expect(malformedSig65.length).toBe(65);

      // SECURED: Exact 64-character regex guard rejects malformed odd-length hex strings
      const isAccepted = verifyWebhookSignature(basePayload, malformedSig65, validSecret);
      expect(isAccepted).toBe(false);
    });

    it('signature tampering: every single character position mutation is rejected (64 bit-flip attacks)', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      for (let i = 0; i < genuineSig.length; i++) {
        const originalChar = genuineSig[i];
        const mutatedChar = originalChar === 'a' ? 'b' : 'a';
        const tamperedSig = genuineSig.slice(0, i) + mutatedChar + genuineSig.slice(i + 1);

        const verified = verifyWebhookSignature(basePayload, tamperedSig, validSecret);
        expect(verified).toBe(false);
      }
    });

    it('payload tampering: any alteration to raw payload string rejects even with genuine prior signature', async () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      // Attack 1: Alter amount from ₹15,000 to ₹150 (amountPaise 1500000 -> 15000)
      const tamperedAmountPayload = basePayload.replace('1500000', '15000');
      const req1 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': genuineSig },
        body: tamperedAmountPayload,
      });
      const res1 = await webhookPost(req1);
      expect(res1.status).toBe(400);
      const data1 = await res1.json();
      expect(data1.error).toBe('BAD_SIGNATURE');

      // Attack 2: Alter studentId to steal credit for another student
      const tamperedStudentPayload = basePayload.replace('STU-0587', 'STU-0412');
      const req2 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': genuineSig },
        body: tamperedStudentPayload,
      });
      const res2 = await webhookPost(req2);
      expect(res2.status).toBe(400);

      // Attack 3: Subtle whitespace injection
      const tamperedWhitespacePayload = basePayload + ' ';
      const req3 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': genuineSig },
        body: tamperedWhitespacePayload,
      });
      const res3 = await webhookPost(req3);
      expect(res3.status).toBe(400);
    });

    it('replay attack stress: 10 identical webhook transmissions result in exactly 1 allocation and 9 idempotent DUPLICATE responses', async () => {
      const repo = getRepository();
      const initialDues = repo.getDuesSummary('STU-0587', ANCHOR_DATE)!;
      const initialReceiptsCount = repo.getReceiptsByStudentId('stu-0587').length;

      const replayPayload = JSON.stringify({
        gatewayPaymentId: 'pay_rzp_replay_stress_999',
        studentId: 'STU-0587',
        instalmentId: 'inst-0587-3',
        amountPaise: 1500000,
        mode: 'UPI',
        receivedOn: ANCHOR_DATE,
      });
      const validSig = computeWebhookSignature(replayPayload, validSecret);

      // Transmission 1: Genuine initial capture
      const req1 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': validSig },
        body: replayPayload,
      });
      const res1 = await webhookPost(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.outcome).toBe('MATCHED');
      const initialReceiptNumber = data1.receiptNumber;
      expect(initialReceiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);

      // Transmissions 2 to 10: Duplicate replays
      for (let attempt = 2; attempt <= 10; attempt++) {
        const replayReq = new Request('http://localhost:3000/api/webhooks/razorpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': validSig },
          body: replayPayload,
        });
        const replayRes = await webhookPost(replayReq);
        expect(replayRes.status).toBe(200);
        const replayData = await replayRes.json();
        expect(replayData.outcome).toBe('DUPLICATE');
        expect(replayData.receiptNumber).toBe(initialReceiptNumber);
      }

      // Assert Ledger Integrity: Exactly 1 new receipt created, not 10
      const finalReceiptsCount = repo.getReceiptsByStudentId('stu-0587').length;
      expect(finalReceiptsCount).toBe(initialReceiptsCount + 1);

      // Balance reduced by exactly ₹15,000 once
      const finalDues = repo.getDuesSummary('STU-0587', ANCHOR_DATE)!;
      expect(BigInt(finalDues.totalBalancePaise)).toBe(BigInt(initialDues.totalBalancePaise) - 1500000n);
    });

    it('corrupted payload: malformed JSON with genuine HMAC returns HTTP 400 MALFORMED_JSON', async () => {
      const brokenJson = '{ "gatewayPaymentId": "pay_corrupt_01", "studentId": '; // Unclosed JSON
      const sigForBrokenJson = computeWebhookSignature(brokenJson, validSecret);

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sigForBrokenJson },
        body: brokenJson,
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('MALFORMED_JSON');
    });

    it('corrupted payload: valid JSON missing gateway payment ID returns HTTP 400 MISSING_PAYMENT_ID', async () => {
      const missingIdJson = JSON.stringify({
        studentId: 'STU-0587',
        amountPaise: 1500000,
      });
      const sig = computeWebhookSignature(missingIdJson, validSecret);

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: missingIdJson,
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('MISSING_PAYMENT_ID');
    });

    it('unknown student webhook routes safely to UNMATCHED_QUEUE holding queue without crashing', async () => {
      const unknownStudentPayload = JSON.stringify({
        gatewayPaymentId: 'pay_unknown_student_999',
        studentId: 'STU-NONEXISTENT-9999',
        amountPaise: 1500000,
        mode: 'UPI',
        receivedOn: ANCHOR_DATE,
      });
      const sig = computeWebhookSignature(unknownStudentPayload, validSecret);

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body: unknownStudentPayload,
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.outcome).toBe('UNMATCHED_QUEUE');
      expect(data.reasonCode).toBe('UNKNOWN_STUDENT');
    });
  });

  // ==========================================================================
  // CHALLENGE 3: TC-12 - REFUND SEGREGATION OF DUTIES & ROLE PERMUTATIONS
  // ==========================================================================
  describe('Challenge 3 (TC-12): Refund Segregation of Duties Matrix & State Machine', () => {
    it('Maker-Checker enforcement: raiser attempting self-approval is rejected with HTTP 403 REFUND_SELF_APPROVAL_FORBIDDEN', async () => {
      const repo = getRepository();

      // Case A: Accounts Executive raises refund, attempts self-approval
      const refundAcc = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: ANCHOR_DATE,
        reason: 'Medical withdrawal',
        actorUserId: 'usr-acc-01',
      });

      const reqSelfAcc = new Request(`http://localhost:3000/api/admin/refunds/${refundAcc.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-acc-01', // Same user attempting self-approval
        },
      });

      const resSelfAcc = await approveRefundPost(reqSelfAcc, { params: Promise.resolve({ id: refundAcc.id }) });
      expect(resSelfAcc.status).toBe(403);
      const dataSelfAcc = await resSelfAcc.json();
      expect(dataSelfAcc.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');

      // Case B: Director raises refund, attempts self-approval
      const refundDir = await repo.raiseRefund({
        studentId: 'stu-0412',
        receivedOn: ANCHOR_DATE,
        reason: 'Director special withdrawal',
        actorUserId: 'usr-dir-01',
      });

      const reqSelfDir = new Request(`http://localhost:3000/api/admin/refunds/${refundDir.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'DIRECTOR',
          'x-demo-user-id': 'usr-dir-01', // Same director attempting self-approval
        },
      });

      const resSelfDir = await approveRefundPost(reqSelfDir, { params: Promise.resolve({ id: refundDir.id }) });
      expect(resSelfDir.status).toBe(403);
      const dataSelfDir = await resSelfDir.json();
      expect(dataSelfDir.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');
    });

    it('role matrix on approval: non-director roles cannot approve refunds even if different from raiser', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: ANCHOR_DATE,
        reason: 'Course change',
        actorUserId: 'usr-acc-01',
      });

      // Permutation 1: Another Accounts Executive (usr-acc-02)
      const reqAcc2 = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-02' },
      });
      const resAcc2 = await approveRefundPost(reqAcc2, { params: Promise.resolve({ id: refund.id }) });
      expect(resAcc2.status).toBe(403);
      const dataAcc2 = await resAcc2.json();
      expect(dataAcc2.error.code).toBe('FORBIDDEN_ROLE');

      // Permutation 2: Counsellor (usr-cns-01)
      const reqCns = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'x-demo-role': 'COUNSELLOR', 'x-demo-user-id': 'usr-cns-01' },
      });
      const resCns = await approveRefundPost(reqCns, { params: Promise.resolve({ id: refund.id }) });
      expect(resCns.status).toBe(403);
      const dataCns = await resCns.json();
      expect(dataCns.error.code).toBe('FORBIDDEN_ROLE');

      // Permutation 3: Parent (usr-par-0587)
      const reqPar = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
      });
      const resPar = await approveRefundPost(reqPar, { params: Promise.resolve({ id: refund.id }) });
      expect(resPar.status).toBe(403);
      const dataPar = await resPar.json();
      expect(dataPar.error.code).toBe('FORBIDDEN_ROLE');

      // Permutation 4: Unauthenticated (no session)
      const reqUnauth = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
      });
      const resUnauth = await approveRefundPost(reqUnauth, { params: Promise.resolve({ id: refund.id }) });
      expect(resUnauth.status).toBe(401);
    });

    it('role matrix on raising: parents and counsellors are blocked from raising refund requests', async () => {
      // Counsellor attempt
      const reqCns = new Request('http://localhost:3000/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'COUNSELLOR', 'x-demo-user-id': 'usr-cns-01' },
        body: JSON.stringify({ studentId: 'STU-0587', reason: 'Counsellor initiated' }),
      });
      const resCns = await raiseRefundPost(reqCns);
      expect(resCns.status).toBe(403);
      const dataCns = await resCns.json();
      expect(dataCns.error.code).toBe('FORBIDDEN_ROLE');

      // Parent attempt
      const reqPar = new Request('http://localhost:3000/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
        body: JSON.stringify({ studentId: 'STU-0587', reason: 'Parent initiated' }),
      });
      const resPar = await raiseRefundPost(reqPar);
      expect(resPar.status).toBe(403);
      const dataPar = await resPar.json();
      expect(dataPar.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('valid Segregation of Duties: raised by ACCOUNTS_EXEC and approved by DIRECTOR succeeds cleanly', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0412',
        receivedOn: ANCHOR_DATE,
        reason: 'Relocation to Mumbai',
        actorUserId: 'usr-acc-01',
      });

      const reqApprove = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'DIRECTOR', 'x-demo-user-id': 'usr-dir-01' },
      });

      const resApprove = await approveRefundPost(reqApprove, { params: Promise.resolve({ id: refund.id }) });
      expect(resApprove.status).toBe(200);
      const data = await resApprove.json();
      expect(data.success).toBe(true);
      expect(data.refund.status).toBe('APPROVED');
      expect(data.refund.approvedBy).toBe('usr-dir-01');

      // Invariant: Unpaid instalment 4 cancelled and reminders suppressed
      const inst4 = repo.getInstalmentsByStudentId('stu-0412').find((i) => i.seqNo === 4)!;
      expect(inst4.cancelledAt).toBeDefined();

      const cancelledReminders = repo.getReminders({ studentId: 'stu-0412' }).filter((r) => r.instalmentId === inst4.id);
      for (const r of cancelledReminders) {
        expect(r.state).toBe('SUPPRESSED_BY_PAYMENT');
        expect(r.suppressReason).toBe('REFUND');
      }
    });

    it('state machine transition guard: repeated approval of already APPROVED refund is rejected', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0412',
        receivedOn: ANCHOR_DATE,
        reason: 'Relocation to Delhi',
        actorUserId: 'usr-acc-01',
      });

      // First approval
      const req1 = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'DIRECTOR', 'x-demo-user-id': 'usr-dir-01' },
      });
      const res1 = await approveRefundPost(req1, { params: Promise.resolve({ id: refund.id }) });
      expect(res1.status).toBe(200);

      // Second approval attempt on already approved refund
      const req2 = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'DIRECTOR', 'x-demo-user-id': 'usr-dir-01' },
      });
      const res2 = await approveRefundPost(req2, { params: Promise.resolve({ id: refund.id }) });
      expect(res2.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ==========================================================================
  // CHALLENGE 4: TC-16 - SECTION 269ST CASH BOUNDARY & AGGREGATION
  // ==========================================================================
  describe('Challenge 4 (TC-16): Section 269ST Cash Limit Boundary & Multi-Instalment Aggregation', () => {
    it('exact boundary: single cash payment of ₹1,99,999 (19,999,900 paise) passes and generates sequential receipt', async () => {
      const req = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'STU-0587',
          instalmentId: 'inst-0587-3',
          amountPaise: '19999900', // ₹1,99,999.00
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
        }),
      });

      const res = await offlinePaymentPost(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);
    });

    it('exact boundary: single cash payment of exactly ₹2,00,000 (20,000,000 paise) is refused with HTTP 422 Problem Details', async () => {
      const req = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'STU-0587',
          instalmentId: 'inst-0587-3',
          amountPaise: '20000000', // ₹2,00,000.00
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
        }),
      });

      const res = await offlinePaymentPost(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe('CASH_LIMIT_EXCEEDED');
      expect(data.status).toBe(422);
      expect(data.title).toContain('Section 269ST');
      expect(data.detail).toContain('₹2,00,000');
    });

    it('multi-instalment daily cash aggregation: two matched cash payments summing to ₹2,00,000 reject the 2nd with HTTP 422', async () => {
      const repo = getRepository();

      // 1st cash payment of ₹1,00,000 passes (MATCHED)
      const res1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-REC-0219',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(res1.outcome).toBe('MATCHED');

      // 2nd cash payment of ₹1,00,000 on same day brings total to ₹2,00,000 -> rejected with 422
      const req2 = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'STU-0219',
          instalmentId: 'inst-0219-2',
          amountPaise: '10000000', // ₹1,00,000
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
        }),
      });

      const res2 = await offlinePaymentPost(req2);
      expect(res2.status).toBe(422);
      const data2 = await res2.json();
      expect(data2.code).toBe('CASH_LIMIT_EXCEEDED');
    });

    it('TC-16-V1 REGRESSION GUARD: cash routed to UNMATCHED_QUEUE is strictly aggregated in Section 269ST daily tracker', async () => {
      const repo = getRepository();

      // Payer pays ₹1,00,000 cash for STU-0219. Outcome: MATCHED.
      const res1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-REC-1',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(res1.outcome).toBe('MATCHED');

      // Student now has ₹0 open dues!
      // Payer makes a 2nd cash payment of ₹99,999.
      // Routed to UNMATCHED_QUEUE with reasonCode: NO_OPEN_DUES.
      const res2 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-3',
        amountPaise: 9999900n, // ₹99,999
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-REC-2',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(res2.outcome).toBe('UNMATCHED_QUEUE');

      // SECURED: Prior cash correctly aggregates both MATCHED and UNMATCHED_QUEUE cash:
      // ₹1,00,000 + ₹99,999 = ₹1,99,999 (19,999,900 paise)
      const priorCashTracked = repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE);
      expect(priorCashTracked).toBe(19999900n);

      // SECURED: 3rd cash payment of ₹10,000 pushes daily cash to ₹2,09,999 >= ₹2,00,000.
      // Section 269ST strictly blocks this transaction with HTTP 422 Problem Details!
      await expect(
        repo.recordOfflinePayment({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-3',
          amountPaise: 1000000n, // ₹10,000
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
          reference: 'CASH-REC-3',
          payerName: 'Parent Gurjar',
          actorUserId: 'usr-acc-01',
        })
      ).rejects.toThrow(/Section 269ST/i);
    });

    it('statutory daily reset: cash payments on consecutive calendar days reset limit allowance', async () => {
      const repo = getRepository();

      // Day 1 (2026-11-02): ₹1,50,000 cash succeeds
      const resDay1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 15000000n,
        mode: 'CASH',
        paymentDate: '2026-11-02',
        reference: 'CASH-DAY-1',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(resDay1.outcome).toBe('MATCHED');

      // Day 2 (2026-11-03): ₹1,50,000 cash succeeds because it is a new calendar day
      const reqDay2 = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({
          studentId: 'STU-0219',
          instalmentId: 'inst-0219-2',
          amountPaise: '15000000',
          mode: 'CASH',
          paymentDate: '2026-11-03',
        }),
      });

      const resDay2 = await offlinePaymentPost(reqDay2);
      expect(resDay2.status).toBe(201);
      const dataDay2 = await resDay2.json();
      expect(dataDay2.success).toBe(true);
    });

    it('non-cash statutory exemption: large electronic / banking payments do not consume cash limit', async () => {
      // Direct domain validation: bank transfers and cheques of ₹5,00,000 are exempt from Section 269ST
      const bankCheck = validateCashLimit({ mode: 'BANK_TRANSFER', amountPaise: 50000000n, priorCashTodayPaise: 0n });
      expect(bankCheck.allowed).toBe(true);

      const chequeCheck = validateCashLimit({ mode: 'CHEQUE', amountPaise: 50000000n, priorCashTodayPaise: 0n });
      expect(chequeCheck.allowed).toBe(true);

      const upiCheck = validateCashLimit({ mode: 'UPI', amountPaise: 50000000n, priorCashTodayPaise: 0n });
      expect(upiCheck.allowed).toBe(true);
    });

    it('role authorization: parent and counsellor cannot record offline cash payments', async () => {
      // Parent role blocked
      const reqPar = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0587',
        },
        body: JSON.stringify({
          studentId: 'STU-0587',
          amountPaise: '500000',
          mode: 'CASH',
        }),
      });
      const resPar = await offlinePaymentPost(reqPar);
      expect(resPar.status).toBe(403);

      // Counsellor role blocked
      const reqCns = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'COUNSELLOR',
          'x-demo-user-id': 'usr-cns-01',
        },
        body: JSON.stringify({
          studentId: 'STU-0587',
          amountPaise: '500000',
          mode: 'CASH',
        }),
      });
      const resCns = await offlinePaymentPost(reqCns);
      expect(resCns.status).toBe(403);
    });

    it('invalid input rejection: negative or zero amount is rejected with 422', async () => {
      // Zero amount
      const reqZero = new Request('http://localhost:3000/api/payments/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
        body: JSON.stringify({ studentId: 'STU-0587', amountPaise: '0', mode: 'CASH' }),
      });
      const resZero = await offlinePaymentPost(reqZero);
      expect(resZero.status).toBe(422);

      // Domain level validation
      const domZero = validateCashPayment(0n);
      expect(domZero.allowed).toBe(false);

      const domNegative = validateCashPayment(-1000n);
      expect(domNegative.allowed).toBe(false);
    });
  });
});
