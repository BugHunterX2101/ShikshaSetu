// tests/api/offline_cash.test.ts
// TC-16: Section 269ST Income-tax Act Cash Limit Enforcement & Counter Payments

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { POST as offlinePost } from '@/app/api/payments/offline/route';

describe('TC-16: Section 269ST Statutory Cash Limit Enforcement', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('Parent or Counsellor calling offline endpoint is rejected with HTTP 403 Forbidden', async () => {
    const req = new Request('http://localhost:3000/api/payments/offline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0587',
      },
      body: JSON.stringify({
        studentId: 'stu-0587',
        instalmentId: 'inst-0587-3',
        amountPaise: '1500000',
        mode: 'CASH',
        reference: 'CSH-001',
        payerName: 'Sunita Sharma',
      }),
    });

    const res = await offlinePost(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('Single cash payment of exactly ₹2,00,000 (20,000,000 paise) is rejected with RFC 9457 HTTP 422 Problem Details', async () => {
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
        reference: 'CSH-MEMO-991',
        payerName: 'Sunita Sharma',
        paymentDate: '2026-11-02',
      }),
    });

    const res = await offlinePost(req);
    expect(res.status).toBe(422);

    const problem = await res.json();
    expect(problem.status).toBe(422);
    expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
    expect(problem.type).toBe('https://shikshasetu.example.in/errors/cash-limit-exceeded');
    expect(problem.detail).toContain('₹2,00,000');
  });

  it('Cash payment of ₹1,99,999 (19,999,900 paise) is allowed and issues receipt', async () => {
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
        amountPaise: '19999900', // ₹1,99,999.00
        mode: 'CASH',
        reference: 'CSH-MEMO-992',
        payerName: 'Sunita Sharma',
        paymentDate: '2026-11-02',
      }),
    });

    const res = await offlinePost(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);
  });

  it('Multiple cash payments in same day: two ₹1,00,000 payments on same day reject the second transaction with HTTP 422', async () => {
    // 1st cash payment of ₹1,00,000
    const req1 = new Request('http://localhost:3000/api/payments/offline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        studentId: 'stu-0587',
        instalmentId: 'inst-0587-3',
        amountPaise: '10000000', // ₹1,00,000
        mode: 'CASH',
        reference: 'CSH-100K-A',
        payerName: 'Sunita Sharma',
        paymentDate: '2026-11-02',
      }),
    });

    const res1 = await offlinePost(req1);
    expect(res1.status).toBe(201);

    // 2nd cash payment of ₹1,00,000 on SAME day (cumulative = ₹2,00,000 >= ₹2,00,000 limit)
    const req2 = new Request('http://localhost:3000/api/payments/offline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        studentId: 'stu-0587',
        instalmentId: 'inst-0587-4',
        amountPaise: '10000000', // ₹1,00,000
        mode: 'CASH',
        reference: 'CSH-100K-B',
        payerName: 'Sunita Sharma',
        paymentDate: '2026-11-02',
      }),
    });

    const res2 = await offlinePost(req2);
    expect(res2.status).toBe(422);
    const problem = await res2.json();
    expect(problem.status).toBe(422);
    expect(problem.code).toBe('CASH_LIMIT_EXCEEDED');
  });

  it('Hardening against Negative Prior Cash exploit: single transaction of ₹2,00,000 is blocked regardless of prior cash calculation', async () => {
    const repo = getRepository();

    // Directly test repository validator
    const check = repo.validateSection269ST('stu-0587', 20000000n, '2026-11-02');
    expect(check.allowed).toBe(false);
    expect(check.problem?.status).toBe(422);
    expect(check.problem?.code).toBe('CASH_LIMIT_EXCEEDED');
  });

  it('Non-cash payments (CHEQUE, BANK_TRANSFER, DD) are exempt from the Section 269ST ₹2,00,000 cash cap', async () => {
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
        amountPaise: '30000000', // ₹3,00,000 (exceeds 2 lakh cash cap, but is a CHEQUE)
        mode: 'CHEQUE',
        reference: 'CHQ-SBI-98231',
        payerName: 'Sunita Sharma',
        paymentDate: '2026-11-02',
      }),
    });

    const res = await offlinePost(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('Zero amount cash payment (amountPaise: "0") is rejected with HTTP 422 INVALID_AMOUNT', async () => {
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
        amountPaise: '0',
        mode: 'CASH',
        reference: 'CSH-ZERO-REJECT',
        paymentDate: '2026-11-02',
      }),
    });
    const res = await offlinePost(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_AMOUNT');
  });
});
