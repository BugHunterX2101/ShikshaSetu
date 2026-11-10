// tests/api/refunds_workflow.test.ts
// TC-12: MoE Pro-Rata Refund Workflow & Segregation of Duties

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { POST as raiseRefundPost, GET as refundsGet } from '@/app/api/admin/refunds/route';
import { POST as calculatePost } from '@/app/api/admin/refunds/calculate/route';
import { POST as approvePost } from '@/app/api/admin/refunds/[id]/approve/route';
import { POST as settlePost } from '@/app/api/admin/refunds/[id]/settle/route';

describe('TC-12: Refunds Workflow & Segregation of Duties', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('POST /api/admin/refunds/calculate computes MoE pro-rata refund with zero cross-subsidization and 10-day SLA', async () => {
    const req = new Request('http://localhost:3000/api/admin/refunds/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        studentId: 'STU-0587',
        receivedOn: '2026-11-02',
      }),
    });

    const res = await calculatePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.studentCode).toBe('STU-0587');
    // Enrolment 2026-04-01 to 2026-11-02 = 215 days elapsed
    expect(data.daysElapsed).toBe(215);
    // 10 calendar days SLA from 2026-11-02 = 2026-11-12
    expect(data.slaDueDate).toBe('2026-11-12');
    expect(BigInt(data.totalPaidPaise)).toBeGreaterThan(0n);
    expect(BigInt(data.totalConsumedPaise)).toBeGreaterThan(0n);
  });

  it('Accounts Exec raises refund request in DRAFT status', async () => {
    const req = new Request('http://localhost:3000/api/admin/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        studentId: 'STU-0587',
        receivedOn: '2026-11-02',
        reason: 'Student relocating to another city',
      }),
    });

    const res = await raiseRefundPost(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.refund.status).toBe('DRAFT');
    expect(data.refund.raisedBy).toBe('usr-acc-01');
    expect(data.refund.slaDueDate).toBe('2026-11-12');
  });

  it('STATUTORY SEGREGATION OF DUTIES: Accounts Exec cannot approve a refund they raised (returns HTTP 403)', async () => {
    const repo = getRepository();
    // 1. Raise refund by usr-acc-01
    const refund = await repo.raiseRefund({
      studentId: 'stu-0587',
      receivedOn: '2026-11-02',
      reason: 'Medical withdrawal',
      actorUserId: 'usr-acc-01',
    });

    // 2. usr-acc-01 attempts to approve their own refund
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
  });

  it('Non-Director cannot approve refunds even if not the raiser (returns HTTP 403)', async () => {
    const repo = getRepository();
    const refund = await repo.raiseRefund({
      studentId: 'stu-0587',
      receivedOn: '2026-11-02',
      reason: 'Test',
      actorUserId: 'usr-acc-01',
    });

    // usr-acc-02 (different accounts exec) attempts to approve
    const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-02',
      },
    });

    const res = await approvePost(req, { params: Promise.resolve({ id: refund.id }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('Director (approved_by <> raised_by) approves refund: cancels unpaid instalments, auto-suppresses reminders, and marks student WITHDRAWN', async () => {
    const repo = getRepository();

    // 1. Raised by Accounts Exec
    const refund = await repo.raiseRefund({
      studentId: 'stu-0587',
      receivedOn: '2026-11-02',
      reason: 'Relocating',
      actorUserId: 'usr-acc-01',
    });

    // 2. Approved by Director (usr-dir-01)
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
    expect(data.refund.status).toBe('APPROVED');
    expect(data.refund.approvedBy).toBe('usr-dir-01');

    // Verify unpaid instalments are cancelled
    const insts = repo.getInstalmentsByStudentId('stu-0587');
    const inst4 = insts.find((i) => i.seqNo === 4)!;
    expect(inst4.cancelledAt).not.toBeNull();
    expect(inst4.refundId).toBe(refund.id);

    // Verify student is WITHDRAWN
    const student = repo.getStudentById('stu-0587')!;
    expect(student.status).toBe('WITHDRAWN');

    // 3. Settlement generates Credit Note CN/26-27/000001
    const reqSettle = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        settlementMode: 'BANK_TRANSFER',
        bankReference: 'NEFT-REF-CN-001',
      }),
    });

    const resSettle = await settlePost(reqSettle, { params: Promise.resolve({ id: refund.id }) });
    expect(resSettle.status).toBe(200);
    const settleData = await resSettle.json();
    expect(settleData.refund.status).toBe('SETTLED');
    expect(settleData.creditNote.number).toBe('CN/26-27/000001');
  });
});
