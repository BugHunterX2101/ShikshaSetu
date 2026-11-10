// tests/api/adversarial_challenger_2_api.test.ts
// M2 Challenger 2: Adversarial Stress Test Suite for Admin, Refunds, Reminders, DPDP Consent & Tally APIs

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { GET as refundsGet, POST as refundsPost } from '@/app/api/admin/refunds/route';
import { POST as calculatePost } from '@/app/api/admin/refunds/calculate/route';
import { POST as approvePost } from '@/app/api/admin/refunds/[id]/approve/route';
import { POST as settlePost } from '@/app/api/admin/refunds/[id]/settle/route';
import { GET as riskQueueGet } from '@/app/api/admin/refunds/risk-queue/route';
import { GET as remindersGet, POST as remindersPost } from '@/app/api/admin/reminders/route';
import { GET as consentGet, POST as consentPost } from '@/app/api/consent/route';
import { POST as consentWithdrawPost } from '@/app/api/consent/withdraw/route';
import { GET as tallyGet } from '@/app/api/export/tally/route';
import { GET as dashboardGet } from '@/app/api/admin/dashboard/route';
import { GET as studentGet } from '@/app/api/admin/students/[id]/route';
import { GET as parentDuesGet } from '@/app/api/parent/dues/route';

describe('M2 CHALLENGER 2: ADVERSARIAL API STRESS TESTS', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // =========================================================================
  // 1. SEGREGATION OF DUTIES & REFUNDS WORKFLOW STRESS TESTS
  // =========================================================================
  describe('1. Segregation of Duties & Refunds Workflow', () => {
    it('CHALLENGE 1.1: Accounts Exec self-approval attempt is strictly rejected with HTTP 403 and REFUND_SELF_APPROVAL_FORBIDDEN', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Self-approval stress test',
        actorUserId: 'usr-acc-01',
      });

      // usr-acc-01 tries to approve the refund they raised
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
      expect(data.error.messageHi).toBeDefined();
    });

    it('CHALLENGE 1.2: Director self-approval attempt is strictly rejected with HTTP 403 REFUND_SELF_APPROVAL_FORBIDDEN', async () => {
      const repo = getRepository();
      // Director raises the refund
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Director initiated refund',
        actorUserId: 'usr-dir-01',
      });

      // Director attempts to approve their own refund
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
      expect(data.error.code).toBe('REFUND_SELF_APPROVAL_FORBIDDEN');
      expect(data.error.messageEn).toContain('Approver cannot be the raiser');
    });

    it('CHALLENGE 1.3: Director approves refund raised by Accounts Exec (Segregation of Duties satisfied)', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Accounts Exec initiated refund',
        actorUserId: 'usr-acc-01',
      });

      // Director (usr-dir-01) approves it
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
    });

    it('CHALLENGE 1.4: Non-Director (Accounts Exec, Counsellor, Parent) cannot approve even if not raiser', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Accounts 1 initiated',
        actorUserId: 'usr-acc-01',
      });

      // Accounts Exec 2
      const reqAcc2 = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-02' },
      });
      const resAcc2 = await approvePost(reqAcc2, { params: Promise.resolve({ id: refund.id }) });
      expect(resAcc2.status).toBe(403);
      expect((await resAcc2.json()).error.code).toBe('FORBIDDEN_ROLE');

      // Counsellor
      const reqCns = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'COUNSELLOR', 'x-demo-user-id': 'usr-cns-01' },
      });
      const resCns = await approvePost(reqCns, { params: Promise.resolve({ id: refund.id }) });
      expect(resCns.status).toBe(403);
      expect((await resCns.json()).error.code).toBe('FORBIDDEN_ROLE');

      // Parent
      const reqPar = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
      });
      const resPar = await approvePost(reqPar, { params: Promise.resolve({ id: refund.id }) });
      expect(resPar.status).toBe(403);
      expect((await resPar.json()).error.code).toBe('FORBIDDEN_ROLE');
    });

    it('CHALLENGE 1.5: Settle endpoint rejects DRAFT refund with HTTP 422 INVALID_STATE', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Settle bypass test',
        actorUserId: 'usr-acc-01',
      });

      const req = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
        body: JSON.stringify({ settlementMode: 'BANK_TRANSFER' }),
      });

      const res = await settlePost(req, { params: Promise.resolve({ id: refund.id }) });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_STATE');
      expect(data.error.messageEn).toContain('Only APPROVED refund requests can be settled');
    });

    it('CHALLENGE 1.6: Double settlement is rejected with HTTP 422 INVALID_STATE', async () => {
      const repo = getRepository();
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Settlement test',
        actorUserId: 'usr-acc-01',
      });
      await repo.approveRefund(refund.id, 'usr-dir-01');

      // Settle 1st time
      const req1 = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
        body: JSON.stringify({ settlementMode: 'BANK_TRANSFER', bankReference: 'NEFT-111' }),
      });
      const res1 = await settlePost(req1, { params: Promise.resolve({ id: refund.id }) });
      expect(res1.status).toBe(200);

      // Settle 2nd time (replay attack)
      const req2 = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
        body: JSON.stringify({ settlementMode: 'BANK_TRANSFER', bankReference: 'NEFT-111' }),
      });
      const res2 = await settlePost(req2, { params: Promise.resolve({ id: refund.id }) });
      expect(res2.status).toBe(422);
      const data2 = await res2.json();
      expect(data2.error.code).toBe('INVALID_STATE');
    });

    it('CHALLENGE 1.7: Unauthenticated request to refunds endpoints returns HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/admin/refunds');
      const res = await refundsGet(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('UNAUTHENTICATED');
    });
  });

  // =========================================================================
  // 2. 10-DAY SLA COUNTDOWN & UNPAID INSTALMENT CANCELLATION
  // =========================================================================
  describe('2. 10-day Refund SLA Countdown & Instalment Cancellation', () => {
    it('CHALLENGE 2.1: 10-calendar-day SLA is calculated accurately across month boundaries', async () => {
      // Month boundary: 2026-10-25 + 10 days = 2026-11-04 (October has 31 days)
      const req1 = new Request('http://localhost:3000/api/admin/refunds/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
        body: JSON.stringify({ studentId: 'STU-0587', receivedOn: '2026-10-25' }),
      });
      const res1 = await calculatePost(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.slaDueDate).toBe('2026-11-04');

      // Month boundary: 2026-11-25 + 10 days = 2026-12-05 (November has 30 days)
      const req2 = new Request('http://localhost:3000/api/admin/refunds/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
        body: JSON.stringify({ studentId: 'STU-0587', receivedOn: '2026-11-25' }),
      });
      const res2 = await calculatePost(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.slaDueDate).toBe('2026-12-05');
    });

    it('CHALLENGE 2.2: Refund approval cancels ALL unpaid & partially-paid instalments but preserves fully paid instalments', async () => {
      const repo = getRepository();

      // Check STU-0587 initial instalments
      const initialInsts = repo.getInstalmentsByStudentId('stu-0587');
      const inst1 = initialInsts.find((i) => i.seqNo === 1)!;
      const inst2 = initialInsts.find((i) => i.seqNo === 2)!;
      const inst3 = initialInsts.find((i) => i.seqNo === 3)!;
      const inst4 = initialInsts.find((i) => i.seqNo === 4)!;

      expect(inst1.amountPaidPaise).toBe(inst1.amountDuePaise); // Fully paid (30k)
      expect(inst2.amountPaidPaise).toBe(inst2.amountDuePaise); // Fully paid (30k)
      expect(inst3.amountPaidPaise).toBeLessThan(inst3.amountDuePaise); // Part-paid (15k paid, 15k balance)
      expect(inst4.amountPaidPaise).toBe(0n); // Unpaid (0k paid, 30k balance)

      // Raise and approve refund
      const refund = await repo.raiseRefund({
        studentId: 'stu-0587',
        receivedOn: '2026-11-02',
        reason: 'Dropout withdrawal',
        actorUserId: 'usr-acc-01',
      });

      const approveReq = new Request(`http://localhost:3000/api/admin/refunds/${refund.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'DIRECTOR', 'x-demo-user-id': 'usr-dir-01' },
      });
      const approveRes = await approvePost(approveReq, { params: Promise.resolve({ id: refund.id }) });
      expect(approveRes.status).toBe(200);

      // Verify post-approval instalment states
      const updatedInsts = repo.getInstalmentsByStudentId('stu-0587');
      const upInst1 = updatedInsts.find((i) => i.seqNo === 1)!;
      const upInst2 = updatedInsts.find((i) => i.seqNo === 2)!;
      const upInst3 = updatedInsts.find((i) => i.seqNo === 3)!;
      const upInst4 = updatedInsts.find((i) => i.seqNo === 4)!;

      // Fully paid instalments 1 and 2 must NOT be cancelled
      expect(upInst1.cancelledAt).toBeNull();
      expect(upInst2.cancelledAt).toBeNull();

      // Part-paid instalment 3 must be cancelled
      expect(upInst3.cancelledAt).not.toBeNull();
      expect(upInst3.refundId).toBe(refund.id);

      // Unpaid instalment 4 must be cancelled
      expect(upInst4.cancelledAt).not.toBeNull();
      expect(upInst4.refundId).toBe(refund.id);

      // Student status must transition to WITHDRAWN
      const student = repo.getStudentById('stu-0587')!;
      expect(student.status).toBe('WITHDRAWN');
      expect(student.withdrawnAt).not.toBeNull();
    });

    it('CHALLENGE 2.3: Refund approval atomically suppresses all queued reminders for cancelled instalments', async () => {
      const repo = getRepository();

      // Check STU-0219 initial queued reminders (STU-0219 has 5 QUEUED reminders in seed data)
      const remindersBefore = repo.getReminders({ studentId: 'stu-0219' });
      const queuedBefore = remindersBefore.filter((r) => r.state === 'QUEUED');
      expect(queuedBefore.length).toBeGreaterThan(0);

      // Raise and approve refund for STU-0219
      const refund = await repo.raiseRefund({
        studentId: 'stu-0219',
        receivedOn: '2026-11-02',
        reason: 'Refund test STU-0219',
        actorUserId: 'usr-acc-01',
      });
      await repo.approveRefund(refund.id, 'usr-dir-01');

      // Verify all previously QUEUED reminders are now SUPPRESSED_BY_PAYMENT with REFUND reason
      const remindersAfter = repo.getReminders({ studentId: 'stu-0219' });
      const remainingQueued = remindersAfter.filter((r) => r.state === 'QUEUED');
      expect(remainingQueued.length).toBe(0);

      const suppressedByRefund = remindersAfter.filter((r) => r.suppressReason === 'REFUND');
      expect(suppressedByRefund.length).toBeGreaterThan(0);
      expect(suppressedByRefund[0].state).toBe('SUPPRESSED_BY_PAYMENT');
    });
  });

  // =========================================================================
  // 3. DPDP CONSENT WITHDRAWAL CASCADE & PARENT DUES ACCESS
  // =========================================================================
  describe('3. DPDP Consent & Reminder Suppression Idempotency', () => {
    it('CHALLENGE 3.1: Minor guardian (age < 18) attempting consent is rejected with HTTP 422', async () => {
      const req = new Request('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
        body: JSON.stringify({
          studentId: 'stu-0587',
          purposeCode: 'WHATSAPP_REMINDERS',
          guardianDobYear: 2010, // 16 years old in 2026
          guardianIdLast4: '5870',
        }),
      });

      const res = await consentPost(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe('CONSENT_FAILED');
      expect(data.error.messageEn).toContain('adult');
    });

    it('EMPIRICAL PROBE 3.2: Exposes adult guardian KYC digit self-comparison vulnerability in repository.ts:1222', async () => {
      // In seed data: Sunita Sharma (usr-par-0587) has idLast4: '5870'.
      // An adversary submits completely bogus digits '9999'.
      // Statutory expectation: verifyAdultGuardianKyc must compare admission '5870' vs provided '9999' and return 422.
      // Actual implementation at repository.ts:1222 passes guardianIdLast4 as both arguments:
      // verifyAdultGuardianKyc(guardianIdLast4 || '1234', guardianIdLast4 || '1234', guardianAge)
      // which evaluates '9999' === '9999' as TRUE and returns HTTP 200!
      const req = new Request('http://localhost:3000/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
        body: JSON.stringify({
          studentId: 'stu-0587',
          purposeCode: 'WHATSAPP_REMINDERS',
          guardianDobYear: 1982,
          guardianIdLast4: '9999', // Non-matching digits
        }),
      });

      const res = await consentPost(req);
      const data = await res.json();

      // HARDENED DPDP ADULT GUARDIAN KYC INVARIANT:
      // Submitting mismatched guardian digits ('9999' vs admission record '5870')
      // must be strictly rejected with HTTP 422 CONSENT_FAILED under DPDP Act Rule 10.
      console.log(`[VERIFIED PROBE 3.2 RESULT] Status: ${res.status}, Error Code: ${data.error?.code}`);
      expect(res.status).toBe(422);
      expect(data.error?.code).toBe('CONSENT_FAILED');
      expect(data.error?.messageEn).toContain('match the adult guardian identity record');
    });

    it('CHALLENGE 3.3: Consent withdrawal idempotency: multiple withdrawals do not corrupt state or re-activate reminders', async () => {
      const repo = getRepository();

      // First withdrawal
      const req1 = new Request('http://localhost:3000/api/consent/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0219' },
        body: JSON.stringify({ studentId: 'stu-0219', purposeCode: 'WHATSAPP_REMINDERS' }),
      });
      const res1 = await consentWithdrawPost(req1);
      expect(res1.status).toBe(200);

      const reminders1 = repo.getReminders({ studentId: 'stu-0219' });
      const countSuppressed1 = reminders1.filter((r) => r.suppressReason === 'CONSENT_WITHDRAWN').length;
      expect(countSuppressed1).toBeGreaterThan(0);

      // Second identical withdrawal (idempotent replay)
      const req2 = new Request('http://localhost:3000/api/consent/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0219' },
        body: JSON.stringify({ studentId: 'stu-0219', purposeCode: 'WHATSAPP_REMINDERS' }),
      });
      const res2 = await consentWithdrawPost(req2);
      expect(res2.status).toBe(200);

      const reminders2 = repo.getReminders({ studentId: 'stu-0219' });
      const countSuppressed2 = reminders2.filter((r) => r.suppressReason === 'CONSENT_WITHDRAWN').length;
      expect(countSuppressed2).toBe(countSuppressed1);

      // Trigger reminder dispatcher: suppressed reminders must NOT be dispatched
      const runReq = new Request('http://localhost:3000/api/admin/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
        body: JSON.stringify({ action: 'run', asOfDate: '2026-11-02' }),
      });
      const runRes = await remindersPost(runReq);
      expect(runRes.status).toBe(200);

      const remindersAfterRun = repo.getReminders({ studentId: 'stu-0219' });
      const sentSuppressed = remindersAfterRun.filter(
        (r) => r.suppressReason === 'CONSENT_WITHDRAWN' && r.state === 'SENT'
      );
      expect(sentSuppressed.length).toBe(0);
    });

    it('EMPIRICAL PROBE 3.4: Parent dues endpoint returns consentRequired flag when CORE_EDUCATION_FEES is withdrawn', async () => {
      const repo = getRepository();

      // Withdraw CORE_EDUCATION_FEES consent for STU-0587
      await repo.withdrawConsent('stu-0587', 'usr-par-0587', 'CORE_EDUCATION_FEES');

      // Parent queries their dues
      const req = new Request('http://localhost:3000/api/parent/dues?studentId=STU-0587', {
        headers: {
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0587',
        },
      });

      const res = await parentDuesGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Confirms the consentRequired flag is active
      expect(data.consentRequired).toBe(true);

      // HARDENED DATA PRIVACY INVARIANT:
      // When CORE_EDUCATION_FEES consent is withdrawn, the API Gateway MUST redact
      // student financial records on the server-side, returning dues: null, student: null, ledger: [].
      console.log(`[VERIFIED PROBE 3.4 RESULT] consentRequired=${data.consentRequired}, duesRedacted=${data.dues === null}`);
      expect(data.consentRequired).toBe(true);
      expect(data.dues).toBeNull();
      expect(data.student).toBeNull();
      expect(data.ledger).toEqual([]);
      expect(data.instalments).toEqual([]);
      expect(data.message).toContain('Parental consent under DPDP Act 2023 is required');
    });
  });

  // =========================================================================
  // 4. TALLY PRIME XML EXPORT ZERO-SUM BALANCING & GUID STABILITY
  // =========================================================================
  describe('4. Tally Prime XML Export Zero-Sum Balancing & GUID Stability', () => {
    it('CHALLENGE 4.1: Tally XML export produces valid XML where every voucher balances strictly to 0.00', async () => {
      const req = new Request('http://localhost:3000/api/export/tally?format=xml&fromDate=2026-04-01&toDate=2026-11-02', {
        headers: {
          'x-demo-role': 'ACCOUNTS_EXEC',
          'x-demo-user-id': 'usr-acc-01',
        },
      });

      const res = await tallyGet(req);
      expect(res.status).toBe(200);
      const xml = await res.text();

      // Parse individual vouchers
      const voucherRegex = /<VOUCHER[\s\S]*?<\/VOUCHER>/g;
      const vouchers = xml.match(voucherRegex) || [];
      expect(vouchers.length).toBeGreaterThan(0);

      for (const voucher of vouchers) {
        // Extract all amounts and deemed positive flags
        const entryRegex = /<ALLLEDGERENTRIES\.LIST>[\s\S]*?<ISDEEMEDPOSITIVE>(Yes|No)<\/ISDEEMEDPOSITIVE>[\s\S]*?<AMOUNT>(.*?)<\/AMOUNT>[\s\S]*?<\/ALLLEDGERENTRIES\.LIST>/g;
        let entryMatch;
        let sumPaise = 0n;

        while ((entryMatch = entryRegex.exec(voucher)) !== null) {
          const rawAmount = entryMatch[2];
          // Convert rupees to paise (e.g. -30000.00 -> -3000000n, 25423.73 -> 2542373n)
          const isNegative = rawAmount.startsWith('-');
          const cleaned = rawAmount.replace(/^-/, '');
          const parts = cleaned.split('.');
          const rupees = BigInt(parts[0]);
          const paise = parts[1] ? BigInt(parts[1].padEnd(2, '0').slice(0, 2)) : 0n;
          const totalEntryPaise = rupees * 100n + paise;
          const signedPaise = isNegative ? -totalEntryPaise : totalEntryPaise;

          sumPaise += signedPaise;
        }

        // Strict double-entry balance check: Debits + Credits === 0
        expect(sumPaise).toBe(0n);
      }
    });

    it('CHALLENGE 4.2: Voucher GUIDs are deterministic and stable across multiple exports', async () => {
      const req1 = new Request('http://localhost:3000/api/export/tally?format=xml&fromDate=2026-04-01&toDate=2026-11-02', {
        headers: { 'x-demo-role': 'ACCOUNTS_EXEC', 'x-demo-user-id': 'usr-acc-01' },
      });
      const res1 = await tallyGet(req1);
      const xml1 = await res1.text();

      const req2 = new Request('http://localhost:3000/api/export/tally?format=xml&fromDate=2026-04-01&toDate=2026-11-02', {
        headers: { 'x-demo-role': 'DIRECTOR', 'x-demo-user-id': 'usr-dir-01' },
      });
      const res2 = await tallyGet(req2);
      const xml2 = await res2.text();

      // Extract GUIDs
      const guidRegex = /GUID="([a-f0-9-]+)"/g;
      const guids1 = [...xml1.matchAll(guidRegex)].map((m) => m[1]);
      const guids2 = [...xml2.matchAll(guidRegex)].map((m) => m[1]);

      expect(guids1.length).toBeGreaterThan(0);
      expect(guids1).toEqual(guids2);

      // Verify GUID matches RFC 4122 format (8-4-4-4-12 hex)
      const rfc4122Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      for (const guid of guids1) {
        expect(rfc4122Regex.test(guid)).toBe(true);
      }
    });

    it('CHALLENGE 4.3: Counsellor & Parent are forbidden from exporting Tally data (HTTP 403)', async () => {
      const reqCns = new Request('http://localhost:3000/api/export/tally', {
        headers: { 'x-demo-role': 'COUNSELLOR', 'x-demo-user-id': 'usr-cns-01' },
      });
      const resCns = await tallyGet(reqCns);
      expect(resCns.status).toBe(403);
      expect((await resCns.json()).error.code).toBe('FORBIDDEN_ROLE');

      const reqPar = new Request('http://localhost:3000/api/export/tally', {
        headers: { 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
      });
      const resPar = await tallyGet(reqPar);
      expect(resPar.status).toBe(403);
      expect((await resPar.json()).error.code).toBe('FORBIDDEN_ROLE');
    });
  });

  // =========================================================================
  // 5. RBAC FINANCIAL REDACTION & CROSS-TENANT ISOLATION
  // =========================================================================
  describe('5. RBAC Financial Redaction & Cross-Tenant Boundary Tests', () => {
    it('CHALLENGE 5.1: Counsellor viewing student receives sanitized academic view with financial figures redacted', async () => {
      const req = new Request('http://localhost:3000/api/admin/students/STU-0587', {
        headers: {
          'x-demo-role': 'COUNSELLOR',
          'x-demo-user-id': 'usr-cns-01',
        },
      });

      const res = await studentGet(req, { params: Promise.resolve({ id: 'STU-0587' }) });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.ledgerRedacted).toBe(true);

      // Financial properties MUST be completely absent
      expect(data.dues).toBeUndefined();
      expect(data.receipts).toBeUndefined();
      expect(data.payments).toBeUndefined();
      expect(data.student.grossFeePaise).toBeUndefined();
      expect(data.student.discountPaise).toBeUndefined();
      expect(data.student.netFeePaise).toBeUndefined();

      // Academic view must still be accessible
      expect(data.student.studentCode).toBe('STU-0587');
      expect(data.academicView.status).toBe('PART_PAID_OVERDUE');
      expect(data.academicView.overdueDays).toBe(23);
    });

    it('CHALLENGE 5.2: Parent attempting to view another student ledger receives HTTP 403 ACCESS_DENIED', async () => {
      // Parent of STU-0219 (usr-par-0219) attempts to access STU-0412
      const req = new Request('http://localhost:3000/api/admin/students/STU-0412', {
        headers: {
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0219',
        },
      });

      const res = await studentGet(req, { params: Promise.resolve({ id: 'STU-0412' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('ACCESS_DENIED');
      expect(data.error.messageEn).toContain('Parent cannot view students other than their own');
    });

    it('CHALLENGE 5.3: Parent attempting to access Admin Dashboard receives HTTP 403 FORBIDDEN_ROLE', async () => {
      const req = new Request('http://localhost:3000/api/admin/dashboard', {
        headers: {
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0587',
        },
      });

      const res = await dashboardGet(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN_ROLE');
    });

    it('CHALLENGE 5.4: Parent attempting to view or trigger Reminders outbox receives HTTP 403 FORBIDDEN_ROLE', async () => {
      const reqGet = new Request('http://localhost:3000/api/admin/reminders', {
        headers: {
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0587',
        },
      });
      const resGet = await remindersGet(reqGet);
      expect(resGet.status).toBe(403);
      expect((await resGet.json()).error.code).toBe('FORBIDDEN_ROLE');

      const reqPost = new Request('http://localhost:3000/api/admin/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': 'PARENT',
          'x-demo-user-id': 'usr-par-0587',
        },
        body: JSON.stringify({ action: 'run' }),
      });
      const resPost = await remindersPost(reqPost);
      expect(resPost.status).toBe(403);
      expect((await resPost.json()).error.code).toBe('FORBIDDEN_ROLE');
    });

    it('CHALLENGE 5.5: Parent attempting to access Risk Queue receives HTTP 403 FORBIDDEN_ROLE', async () => {
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
  });
});
