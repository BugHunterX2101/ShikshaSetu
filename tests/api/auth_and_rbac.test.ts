// tests/api/auth_and_rbac.test.ts
// TC-10 & TC-13: Authentication, RBAC Scoping, Rate Limiting & Fee Plan Compliance

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { POST as otpRequestPost } from '@/app/api/auth/otp/request/route';
import { POST as otpVerifyPost } from '@/app/api/auth/otp/verify/route';
import { POST as demoSwitchPost } from '@/app/api/auth/demo-switch/route';
import { GET as duesGet } from '@/app/api/parent/dues/route';
import { GET as studentGet } from '@/app/api/admin/students/[id]/route';

describe('TC-10 & TC-13: Authentication, RBAC Scoping & Fee Plan Compliance', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('OTP Request & Verify flow succeeds for valid 10-digit phone', async () => {
    const req1 = new Request('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9829058700' }),
    });

    const res1 = await otpRequestPost(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.demoOtp).toBeDefined();

    const req2 = new Request('http://localhost:3000/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9829058700', code: data1.demoOtp }),
    });

    const res2 = await otpVerifyPost(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.token).toBeDefined();
    expect(data2.user.role).toBe('PARENT');
  });

  it('Rate limit: 6th OTP request within 1 hour is rejected with HTTP 429', async () => {
    const testPhone = '9829990001';
    for (let i = 0; i < 5; i++) {
      const req = new Request('http://localhost:3000/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });
      const res = await otpRequestPost(req);
      expect(res.status).toBe(200);
    }

    // 6th attempt
    const req6 = new Request('http://localhost:3000/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });
    const res6 = await otpRequestPost(req6);
    expect(res6.status).toBe(429);
    const data6 = await res6.json();
    expect(data6.error.code).toBe('RATE_LIMITED');
  });

  it('Demo persona switch allows switching to DIRECTOR, ACCOUNTS_EXEC, COUNSELLOR, PARENT', async () => {
    const personas = ['DIRECTOR', 'ACCOUNTS_EXEC', 'COUNSELLOR', 'PARENT_0587'];
    for (const persona of personas) {
      const req = new Request('http://localhost:3000/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });

      const res = await demoSwitchPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
    }
  });

  it('TC-10: Parent of STU-0219 attempting to view STU-0587 dues is rejected with HTTP 403 Forbidden', async () => {
    const req = new Request('http://localhost:3000/api/parent/dues?studentId=STU-0587', {
      headers: {
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0219', // Mohit's parent
      },
    });

    const res = await duesGet(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('ACCESS_DENIED');
  });

  it('Counsellor querying student ledger receives sanitized view with financial figures redacted', async () => {
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
    expect(data.dues).toBeUndefined();
    expect(data.student.grossFeePaise).toBeUndefined();
    expect(data.academicView.overdueDays).toBe(23);
  });

  it('TC-13: Student STU-0587 with 4 equal instalments is compliant with Rajasthan Coaching Act 2025', async () => {
    const req = new Request('http://localhost:3000/api/admin/students/STU-0587', {
      headers: {
        'x-demo-role': 'DIRECTOR',
        'x-demo-user-id': 'usr-dir-01',
      },
    });

    const res = await studentGet(req, { params: Promise.resolve({ id: 'STU-0587' }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.scheduleCompliance.isCompliant).toBe(true);
  });
});
