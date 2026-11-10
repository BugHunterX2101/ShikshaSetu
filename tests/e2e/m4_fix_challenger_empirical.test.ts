import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '../../src/store/repository';
import { verifyWebhookSignature, computeWebhookSignature } from '../../src/domain/webhookSignature';

const ANCHOR_DATE = '2026-11-02';

describe('m4_fix_challenger_1: Adversarial Cryptographic & Statutory Stress Harness', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // ==========================================================================
  // AREA 1: WEBHOOK SIGNATURE ADVERSARIAL CRYPTOGRAPHIC HARNESS
  // ==========================================================================
  describe('Area 1: verifyWebhookSignature Stress Testing', () => {
    const validSecret = 'rzp_sec_adv_test_2026';
    const basePayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_jaipur_01',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test_001', amount: 1500000, status: 'captured' } } },
    });

    it('genuine signature verification (lowercase and uppercase hex parity)', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);
      expect(genuineSig.length).toBe(64);
      expect(verifyWebhookSignature(basePayload, genuineSig, validSecret)).toBe(true);

      // Node.js Buffer converts uppercase hex properly
      const upperSig = genuineSig.toUpperCase();
      expect(verifyWebhookSignature(basePayload, upperSig, validSecret)).toBe(true);

      // Mixed case hex
      const mixedSig = genuineSig.slice(0, 32).toUpperCase() + genuineSig.slice(32).toLowerCase();
      expect(verifyWebhookSignature(basePayload, mixedSig, validSecret)).toBe(true);
    });

    it('odd-length hex strings are strictly rejected', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      // Length 63 (one character short)
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 63), validSecret)).toBe(false);

      // Length 65 (one character extra)
      expect(verifyWebhookSignature(basePayload, genuineSig + '0', validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig + 'f', validSecret)).toBe(false);

      // Length 67 (three characters extra)
      expect(verifyWebhookSignature(basePayload, genuineSig + 'abc', validSecret)).toBe(false);

      // Length 1
      expect(verifyWebhookSignature(basePayload, 'a', validSecret)).toBe(false);
    });

    it('even-length non-64 strings are strictly rejected', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      // Length 62
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 62), validSecret)).toBe(false);

      // Length 66
      expect(verifyWebhookSignature(basePayload, genuineSig + '00', validSecret)).toBe(false);

      // Length 0 (empty string)
      expect(verifyWebhookSignature(basePayload, '', validSecret)).toBe(false);
    });

    it('non-hex characters are strictly rejected without uncaught exceptions', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      // Suffix with 'zz'
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 62) + 'zz', validSecret)).toBe(false);

      // Null byte injection
      expect(verifyWebhookSignature(basePayload, genuineSig + '\0', validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 63) + '\0', validSecret)).toBe(false);

      // Non-hex chars 'g', 'x', 'z', symbols, emojis
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 63) + 'g', validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 63) + 'x', validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 63) + '?', validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 62) + '🚀', validSecret)).toBe(false);
    });

    it('internal whitespace is rejected; outer whitespace is safely trimmed', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      // Outer whitespace (spaces, tabs, newlines) should be trimmed and accepted
      expect(verifyWebhookSignature(basePayload, `   ${genuineSig}   `, validSecret)).toBe(true);
      expect(verifyWebhookSignature(basePayload, `\t\n${genuineSig}\n`, validSecret)).toBe(true);

      // Internal whitespace alters length or breaks hex format -> rejected
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 32) + ' ' + genuineSig.slice(32), validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 32) + ' ' + genuineSig.slice(33), validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig.slice(0, 31) + '  ' + genuineSig.slice(33), validSecret)).toBe(false);
    });

    it('null, undefined, and non-string inputs fail gracefully to false', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      expect(verifyWebhookSignature(null as any, genuineSig, validSecret)).toBe(false);
      expect(verifyWebhookSignature(undefined as any, genuineSig, validSecret)).toBe(false);
      expect(verifyWebhookSignature(12345 as any, genuineSig, validSecret)).toBe(false);

      expect(verifyWebhookSignature(basePayload, null as any, validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, undefined as any, validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, 123456789 as any, validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, {} as any, validSecret)).toBe(false);
      expect(verifyWebhookSignature(basePayload, [] as any, validSecret)).toBe(false);

      expect(verifyWebhookSignature(basePayload, genuineSig, null as any)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig, undefined as any)).toBe(false);
      expect(verifyWebhookSignature(basePayload, genuineSig, '' as any)).toBe(false);
    });

    it('exhaustive 64-character mutation probe: every single bit mutation is rejected', () => {
      const genuineSig = computeWebhookSignature(basePayload, validSecret);

      for (let i = 0; i < 64; i++) {
        const originalChar = genuineSig[i];
        const mutatedChar = originalChar === '0' ? '1' : '0';
        const tamperedSig = genuineSig.slice(0, i) + mutatedChar + genuineSig.slice(i + 1);

        expect(verifyWebhookSignature(basePayload, tamperedSig, validSecret)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // AREA 2: SECTION 269ST STATUTORY CASH LIMIT TRACKER
  // ==========================================================================
  describe('Area 2: Section 269ST Statutory Cash Limit Tracker', () => {
    it('Single-transaction cash firewall: >= ₹2,00,000 cash rejected at entry with 422', async () => {
      const repo = getRepository();

      // Exactly ₹2,00,000 in a single transaction
      await expect(
        repo.recordOfflinePayment({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-2',
          amountPaise: 20000000n, // ₹2,00,000
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
          reference: 'CASH-SINGLE-200K',
          payerName: 'Parent Gurjar',
          actorUserId: 'usr-acc-01',
        })
      ).rejects.toThrow(/Section 269ST/i);

      // ₹2,50,000 in a single transaction
      await expect(
        repo.recordOfflinePayment({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-2',
          amountPaise: 25000000n, // ₹2,50,000
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
          reference: 'CASH-SINGLE-250K',
          payerName: 'Parent Gurjar',
          actorUserId: 'usr-acc-01',
        })
      ).rejects.toThrow(/Section 269ST/i);

      // ₹1,99,999 in a single transaction is permitted
      const res = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 19999900n, // ₹1,99,999
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-SINGLE-199K',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(res.success).toBe(true);
    });

    it('Multi-payment cash combinations: MATCHED + UNMATCHED_QUEUE strictly aggregated', async () => {
      const repo = getRepository();

      // Payment 1: ₹1,00,000 CASH for STU-0219 -> MATCHED
      const p1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-SEQ-1',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(p1.outcome).toBe('MATCHED');

      // Payment 2: ₹99,999 CASH for STU-0219 (0 open dues left) -> UNMATCHED_QUEUE
      const p2 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-3',
        amountPaise: 9999900n, // ₹99,999
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-SEQ-2',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(p2.outcome).toBe('UNMATCHED_QUEUE');

      // Daily cash tracked: ₹1,99,999
      const dailyCash = repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE);
      expect(dailyCash).toBe(19999900n);

      // Payment 3: ₹1 CASH pushes total to ₹2,00,000 -> REJECTED 422
      await expect(
        repo.recordOfflinePayment({
          studentId: 'stu-0219',
          instalmentId: 'inst-0219-3',
          amountPaise: 100n, // ₹1
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
          reference: 'CASH-SEQ-3',
          payerName: 'Parent Gurjar',
          actorUserId: 'usr-acc-01',
        })
      ).rejects.toThrow(/Section 269ST/i);

      // Payment 4: Non-cash (UPI) ₹50,000 is EXEMPT from Section 269ST
      const p4 = await repo.recordPayment({
        studentId: 'stu-0219',
        amountPaise: 5000000n, // ₹50,000
        mode: 'UPI',
        receivedOn: ANCHOR_DATE,
        gatewayPaymentId: 'pay_upi_exempt_001',
      });
      expect(p4.success).toBe(true);
    });

    it('Multi-payment cash combinations: UNMATCHED_QUEUE first, then MATCHED', async () => {
      const repo = getRepository();

      // Student STU-0587 has open dues of ₹15,000
      // Payment 1: Cancel instalment so payment goes to UNMATCHED_QUEUE with ₹1,00,000
      const insts = repo.getInstalmentsByStudentId('stu-0587');
      const targetInst = insts[0];
      targetInst.cancelledAt = '2026-11-01T00:00:00Z';

      const p1 = await repo.recordOfflinePayment({
        studentId: 'stu-0587',
        instalmentId: targetInst.id,
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-UNM-1',
        payerName: 'Sunita Sharma',
        actorUserId: 'usr-acc-01',
      });
      expect(p1.outcome).toBe('UNMATCHED_QUEUE');

      // Uncancel instalment
      targetInst.cancelledAt = null;

      // Payment 2: ₹99,999 CASH against active instalment
      const p2 = await repo.recordOfflinePayment({
        studentId: 'stu-0587',
        instalmentId: targetInst.id,
        amountPaise: 9999900n, // ₹99,999
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-MATCHED-2',
        payerName: 'Sunita Sharma',
        actorUserId: 'usr-acc-01',
      });
      expect(p2.outcome).toBe('MATCHED');

      // Total daily cash must equal ₹1,99,999
      const dailyCash = repo.getPriorCashReceivedToday('stu-0587', ANCHOR_DATE);
      expect(dailyCash).toBe(19999900n);

      // Payment 3: ₹100 cash must be rejected
      await expect(
        repo.recordOfflinePayment({
          studentId: 'stu-0587',
          instalmentId: targetInst.id,
          amountPaise: 10000n, // ₹100
          mode: 'CASH',
          paymentDate: ANCHOR_DATE,
          reference: 'CASH-FAIL-3',
          payerName: 'Sunita Sharma',
          actorUserId: 'usr-acc-01',
        })
      ).rejects.toThrow(/Section 269ST/i);
    });

    it('REGRESSION GUARD TC-16-V2: Same-day resolution of UNMATCHED_QUEUE cash payment does not self-double-count', async () => {
      const repo = getRepository();

      // STU-0219 receives ₹1,00,000 CASH which gets parked in UNMATCHED_QUEUE (e.g. cancelled instalment)
      const inst = repo.getInstalmentsByStudentId('stu-0219')[0];
      inst.cancelledAt = '2026-11-01T00:00:00Z';

      const p1 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: inst.id,
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_unm_20261102_001',
        receivedOn: ANCHOR_DATE,
      });
      expect(p1.outcome).toBe('UNMATCHED_QUEUE');
      expect(p1.paymentId).toBeDefined();

      // Total actual physical cash received from STU-0219 today is ₹1,00,000 (well within ₹2,00,000 limit)
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(10000000n);

      // Now restore/open the instalment so it can be matched
      inst.cancelledAt = null;

      // When the accounts executive resolves this unmatched cash payment on the same date:
      // EXPECTATION: The payment of ₹1,00,000 should be successfully matched and resolved without self-double-counting!
      const res = await repo.resolveUnmatchedPayment(p1.paymentId!, 'stu-0219', inst.id, 'usr-acc-01');
      expect(res.outcome).toBe('MATCHED');
      expect(res.receiptNumber).toBeDefined();
      expect(res.receiptNumber).toMatch(/^RCP\/\d{2}-\d{2}\/\d{6}$/);

      // Verify payment status updated to RESOLVED
      const originalPayment = repo.getUnmatchedPayments('RESOLVED').find((p) => p.id === p1.paymentId);
      expect(originalPayment).toBeDefined();
      expect(originalPayment?.matchStatus).toBe('RESOLVED');

      // Verify total cash tracked today for STU-0219 is still exactly ₹1,00,000 (not double counted to ₹2,00,000)
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(10000000n);
    });

    it('REGRESSION GUARD TC-16-V2 PART 2: Same-day resolution of ₹50,000 UNMATCHED cash when ₹1,00,000 MATCHED cash exists', async () => {
      const repo = getRepository();

      // Ensure STU-0219 has open dues of at least ₹1,50,000 across instalments (₹1,00,000 for inst2, ₹50,000 for inst3)
      const allInsts = repo.getInstalmentsByStudentId('stu-0219');
      allInsts[1].amountDuePaise = 10000000n; // ₹1,00,000
      allInsts[2].amountDuePaise = 5000000n;  // ₹50,000
      const inst3 = allInsts[2]; // inst-0219-3

      // Step 1: Record ₹1,00,000 MATCHED CASH for STU-0219
      const p1 = await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        paymentDate: ANCHOR_DATE,
        reference: 'CASH-MATCHED-100K',
        payerName: 'Parent Gurjar',
        actorUserId: 'usr-acc-01',
      });
      expect(p1.outcome).toBe('MATCHED');

      // Step 2: Record ₹50,000 CASH for STU-0219 into UNMATCHED_QUEUE (e.g. cancelled instalment)
      // Total actual physical cash received today = ₹1,50,000 (legal and <= ₹1,99,999)
      inst3.cancelledAt = '2026-11-01T00:00:00Z';

      const p2 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: inst3.id,
        amountPaise: 5000000n, // ₹50,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_unm_20261102_002',
        receivedOn: ANCHOR_DATE,
      });
      expect(p2.outcome).toBe('UNMATCHED_QUEUE');

      // Current actual cash = ₹1,50,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15000000n);

      // Now restore the instalment
      inst3.cancelledAt = null;

      // Step 3: Resolve the ₹50,000 unmatched cash payment.
      // Expected: Successful resolution since total physical cash was ₹1,50,000.
      const res = await repo.resolveUnmatchedPayment(p2.paymentId!, 'stu-0219', inst3.id, 'usr-acc-01');
      expect(res.outcome).toBe('MATCHED');
      expect(res.receiptNumber).toBeDefined();

      // Total daily cash for STU-0219 remains exactly ₹1,50,000
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(15000000n);
    });

    it('REGRESSION GUARD TC-16-V2 PART 3: Resolution on subsequent day still succeeds without double-counting', async () => {
      const repo = getRepository();

      // Cash payment received on Day 1 (2026-11-02)
      const inst = repo.getInstalmentsByStudentId('stu-0219')[0];
      inst.cancelledAt = '2026-11-01T00:00:00Z';

      const p1 = await repo.recordPayment({
        studentId: 'stu-0219',
        instalmentId: inst.id,
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_unm_day1_001',
        receivedOn: '2026-11-02',
      });
      expect(p1.outcome).toBe('UNMATCHED_QUEUE');

      // Uncancel instalment
      inst.cancelledAt = null;

      // Resolution happens (actor calls resolveUnmatchedPayment)
      // Because line 979 passes receivedOn: payment.receivedOn ('2026-11-02'),
      // excludePaymentId and matchStatus: 'RESOLVED' ensure resolution succeeds cleanly!
      const res = await repo.resolveUnmatchedPayment(p1.paymentId!, 'stu-0219', inst.id, 'usr-acc-01');
      expect(res.outcome).toBe('MATCHED');
      expect(res.receiptNumber).toBeDefined();

      // Total daily cash for 2026-11-02 is exactly ₹1,00,000
      expect(repo.getPriorCashReceivedToday('stu-0219', '2026-11-02')).toBe(10000000n);
    });

    it('Investigation: What happens if unmatched cash payment had studentId: null (NO_REFERENCE)?', async () => {
      const repo = getRepository();

      // Unmatched cash payment of ₹1,00,000 with NO student info
      const p1 = await repo.recordPayment({
        amountPaise: 10000000n, // ₹1,00,000
        mode: 'CASH',
        gatewayPaymentId: 'csh_mystery_001',
        receivedOn: ANCHOR_DATE,
      });
      expect(p1.outcome).toBe('UNMATCHED_QUEUE');
      expect(p1.reasonCode).toBe('NO_REFERENCE');

      // Resolve against STU-0219 who has open instalment
      const inst = repo.getInstalmentsByStudentId('stu-0219')[0];
      const res = await repo.resolveUnmatchedPayment(p1.paymentId!, 'stu-0219', inst.id, 'usr-acc-01');
      expect(res.outcome).toBe('MATCHED');

      // After resolution: STU-0219 has ₹1,00,000 cash tracked
      expect(repo.getPriorCashReceivedToday('stu-0219', ANCHOR_DATE)).toBe(10000000n);
    });
  });
});
