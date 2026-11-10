// tests/api/checkout_payment.test.ts
// TC-04 & TC-08: Checkout, Live GST Split, Idempotency, Gapless Receipt, Reminder Suppression

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { GET as checkoutGet, POST as checkoutPost } from '@/app/api/payments/checkout/route';

describe('TC-04 & TC-08: Payment Checkout API Integration', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('GET /api/payments/checkout returns student details and live 18% GST reverse split breakdown', async () => {
    const req = new Request('http://localhost:3000/api/payments/checkout?studentId=STU-0587&amountPaise=1500000');
    const res = await checkoutGet(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.studentCode).toBe('STU-0587');
    expect(data.studentName).toBe('Ishita Sharma');
    expect(data.centreCode).toBe('JPR-GPL');

    // 18% GST reverse split on ₹15,000 (15,00,000 paise):
    // Taxable = 12,71,186 paise, CGST = 1,14,407, SGST = 1,14,407, Total Tax = 2,28,814
    expect(data.previewGstSplit.grossPaise).toBe('1500000');
    expect(data.previewGstSplit.taxablePaise).toBe('1271186');
    expect(data.previewGstSplit.cgstPaise).toBe('114407');
    expect(data.previewGstSplit.sgstPaise).toBe('114407');
    expect(data.previewGstSplit.totalTaxPaise).toBe('228814');
    expect(data.previewGstSplit.sacCode).toBe('999293');
  });

  it('POST /api/payments/checkout rejects amount below minimum ₹500 (50,000 paise) with HTTP 422', async () => {
    const req = new Request('http://localhost:3000/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 'STU-0587',
        amountPaise: '40000', // ₹400 (below ₹500 minimum)
      }),
    });
    const res = await checkoutPost(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('BELOW_MINIMUM');
  });

  it('POST /api/payments/checkout simulates payment for STU-0587, generates gapless receipt, and atomically suppresses reminders', async () => {
    const repo = getRepository();

    // Verify initial state for STU-0587: Inst 3 has 15k balance, 5 reminders SENT
    const duesBefore = repo.getDuesSummary('STU-0587');
    expect(duesBefore?.totalBalancePaise).toBe('1500000');

    const remindersBefore = repo.getReminders({ studentId: 'stu-0587' });
    expect(remindersBefore.filter((r) => r.state === 'SENT').length).toBe(5);

    // Pay remaining ₹15,000
    const req = new Request('http://localhost:3000/api/payments/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0587',
      },
      body: JSON.stringify({
        action: 'simulate',
        studentId: 'STU-0587',
        amountPaise: '1500000',
        paymentMethod: 'UPI',
        gatewayPaymentId: 'pay_live_test_0587_final',
      }),
    });

    const res = await checkoutPost(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.outcome).toBe('MATCHED');
    expect(data.receiptNumber).toBe('RCP/26-27/000413'); // next after 412
    expect(data.studentBalanceAfterPaise).toBe('0');

    // Verify reminders transitioned to SUPPRESSED_BY_PAYMENT
    expect(data.remindersSuppressed.length).toBe(5);
    for (const rem of data.remindersSuppressed) {
      expect(rem.state).toBe('SUPPRESSED_BY_PAYMENT');
      expect(rem.suppressReason).toBe('PAID_IN_FULL');
    }

    // Verify updated dues in repo
    const duesAfter = repo.getDuesSummary('STU-0587');
    expect(duesAfter?.totalBalancePaise).toBe('0');
    expect(duesAfter?.status).toBe('PAID');
  });

  it('TC-08: Idempotency replay with identical gatewayPaymentId returns HTTP 200 without duplicate credit', async () => {
    const repo = getRepository();

    // 1st request
    const payload = {
      action: 'simulate',
      studentId: 'STU-0587',
      amountPaise: '1500000',
      paymentMethod: 'UPI',
      gatewayPaymentId: 'pay_idemp_key_unique_999',
    };

    const req1 = new Request('http://localhost:3000/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res1 = await checkoutPost(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    const receipt1 = data1.receiptNumber;

    // 2nd request (replay with identical gatewayPaymentId)
    const req2 = new Request('http://localhost:3000/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res2 = await checkoutPost(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data2.outcome).toBe('DUPLICATE');
    expect(data2.receiptNumber).toBe(receipt1);

    // Verify student was NOT double credited (receipt count for this payment is exactly 1)
    const receipts = repo.getReceiptsByStudentId('stu-0587');
    const matchedReceipts = receipts.filter((r) => r.number === receipt1);
    expect(matchedReceipts.length).toBe(1);
  });

  it('Payment without student reference lands in UNMATCHED_QUEUE with reason NO_REFERENCE and zero ledger changes', async () => {
    const repo = getRepository();
    const unmatchedBefore = repo.getUnmatchedPayments('UNMATCHED_QUEUE').length;

    const req = new Request('http://localhost:3000/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'simulate',
        amountPaise: '3000000', // ₹30,000
        paymentMethod: 'NETBANKING',
        gatewayPaymentId: 'pay_unref_random_991',
        bankReference: 'UTR99887766',
        // No studentId or studentCode
      }),
    });

    const res = await checkoutPost(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.outcome).toBe('UNMATCHED_QUEUE');
    expect(data.reasonCode).toBe('NO_REFERENCE');

    const unmatchedAfter = repo.getUnmatchedPayments('UNMATCHED_QUEUE').length;
    expect(unmatchedAfter).toBe(unmatchedBefore + 1);
  });
});
