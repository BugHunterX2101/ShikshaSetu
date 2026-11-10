// tests/api/unmatched_reconciliation.test.ts
// Unmatched Payment Queue & Accounts Reconciliation API Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { GET as unmatchedGet, POST as unmatchedPost } from '@/app/api/admin/unmatched/route';
import { POST as resolveRoutePost } from '@/app/api/admin/unmatched/[id]/resolve/route';
import { POST as rejectRoutePost } from '@/app/api/admin/unmatched/[id]/reject/route';

describe('Unmatched Payment Queue & Reconciliation API', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('GET /api/admin/unmatched returns holding queue categorized by statutory reason codes', async () => {
    const req = new Request('http://localhost:3000/api/admin/unmatched', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await unmatchedGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.totalCount).toBeGreaterThanOrEqual(3);
    expect(data.summary.byReason.NO_REFERENCE).toBeGreaterThanOrEqual(1);
    expect(data.summary.byReason.UNKNOWN_STUDENT).toBeGreaterThanOrEqual(1);
    expect(data.summary.byReason.CANCELLED_INSTALMENT).toBeGreaterThanOrEqual(1);
  });

  it('Accounts Exec resolves unreferenced payment: matches to STU-0587, issues gapless receipt, and suppresses reminders', async () => {
    const repo = getRepository();

    const duesBefore = repo.getDuesSummary('STU-0587');
    expect(duesBefore?.totalBalancePaise).toBe('1500000');

    // Resolve pay_unm_001 to STU-0587
    const req = new Request('http://localhost:3000/api/admin/unmatched', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        action: 'resolve',
        paymentId: 'pay_unm_001',
        targetStudentId: 'STU-0587',
      }),
    });

    const res = await unmatchedPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.result.outcome).toBe('MATCHED');
    expect(data.result.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);

    // Verify STU-0587 dues were cleared
    const duesAfter = repo.getDuesSummary('STU-0587');
    expect(duesAfter?.totalBalancePaise).toBe('0');
  });

  it('Resolving an already resolved payment is rejected with HTTP 409 Conflict', async () => {
    const repo = getRepository();
    await repo.resolveUnmatchedPayment('pay_unm_001', 'stu-0587', undefined, 'usr-acc-01');

    // Try resolving again
    const req = new Request('http://localhost:3000/api/admin/unmatched', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        action: 'resolve',
        paymentId: 'pay_unm_001',
        targetStudentId: 'STU-0587',
      }),
    });

    const res = await unmatchedPost(req);
    expect(res.status).toBe(409);
  });

  it('Accounts Exec rejects unmatched payment: marks REJECTED without altering student ledgers or receipts', async () => {
    const req = new Request('http://localhost:3000/api/admin/unmatched', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        action: 'reject',
        paymentId: 'pay_unm_002',
        reason: 'Unidentified remitter after 7-day bank tracer',
      }),
    });

    const res = await unmatchedPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.payment.matchStatus).toBe('REJECTED');
  });

  it('Dedicated route POST /api/admin/unmatched/[id]/resolve resolves payment directly', async () => {
    const repo = getRepository();
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
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.outcome).toBe('MATCHED');
    expect(data.result.receiptNumber).toMatch(/^RCP\/26-27\/\d{6}$/);

    const dues = repo.getDuesSummary('STU-0587');
    expect(dues?.totalBalancePaise).toBe('0');
  });

  it('Dedicated route POST /api/admin/unmatched/[id]/reject rejects payment directly', async () => {
    const req = new Request('http://localhost:3000/api/admin/unmatched/pay_unm_002/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        rejectionReason: 'Unknown depositor tracer failed',
      }),
    });

    const res = await rejectRoutePost(req, { params: Promise.resolve({ id: 'pay_unm_002' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.payment.matchStatus).toBe('REJECTED');
  });
});
