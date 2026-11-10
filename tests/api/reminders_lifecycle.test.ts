// tests/api/reminders_lifecycle.test.ts
// TC-07: Reminder Cadence, Auto-Suppression, Quiet Period & Bilingual Formatting

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { GET as remindersGet, POST as remindersPost } from '@/app/api/admin/reminders/route';

describe('TC-07: Reminders Lifecycle, Cadence & Auto-Suppression', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('GET /api/admin/reminders returns reminders outbox with trigger points and auto-suppression proof', async () => {
    const req = new Request('http://localhost:3000/api/admin/reminders?studentId=STU-0412', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await remindersGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.reminders.length).toBe(5);

    // STU-0412 paid in full: all 5 reminders suppressed by payment with receipt proof link
    for (const rem of data.reminders) {
      expect(rem.state).toBe('SUPPRESSED_BY_PAYMENT');
      expect(rem.suppressReason).toBe('PAID_IN_FULL');
      expect(rem.suppressReceiptNo).toBe('RCP/26-27/000412');
    }
  });

  it('POST /api/admin/reminders preview returns bilingual WhatsApp formatted messages with live balance', async () => {
    const req = new Request('http://localhost:3000/api/admin/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        action: 'preview',
        studentId: 'STU-0587',
      }),
    });

    const res = await remindersPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.bilingual.en.body).toContain('Fee balance ₹15,000');
    expect(data.bilingual.en.body).toContain('Part paid, 23 days overdue');
    expect(data.bilingual.hi.body).toContain('शुल्क शेष ₹15,000');
    expect(data.bilingual.hi.body).toContain('आंशिक भुगतान, 23 दिन अतिदेय');
  });

  it('Batch runner executes idempotently: rerun on same date sends 0 additional messages', async () => {
    const req1 = new Request('http://localhost:3000/api/admin/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        action: 'run',
        asOfDate: '2026-11-02',
      }),
    });

    const res1 = await remindersPost(req1);
    expect(res1.status).toBe(200);

    // Rerun on same date
    const req2 = new Request('http://localhost:3000/api/admin/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
      body: JSON.stringify({
        action: 'run',
        asOfDate: '2026-11-02',
      }),
    });

    const res2 = await remindersPost(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    // 0 new messages sent on rerun
    expect(data2.stats.sentCount).toBe(0);
  });

  it('GET /api/admin/reminders filters reminders by centreId', async () => {
    const req = new Request('http://localhost:3000/api/admin/reminders?centreId=ctr-jpr-gpl', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await remindersGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.reminders)).toBe(true);

    const repo = getRepository();
    for (const rem of data.reminders) {
      const student = repo.getStudentById(rem.studentId);
      expect(student?.centreId).toBe('ctr-jpr-gpl');
    }
  });
});
