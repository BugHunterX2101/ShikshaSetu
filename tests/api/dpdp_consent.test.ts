// tests/api/dpdp_consent.test.ts
// TC-14: DPDP Act 2023 Consent Grant, Withdrawal Cascade & Retention Policy

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { GET as consentGet, POST as consentPost } from '@/app/api/consent/route';
import { POST as consentWithdrawPost } from '@/app/api/consent/withdraw/route';

describe('TC-14: DPDP Act 2023 Consent & Retention Compliance', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('Minor guardian (age < 18) attempting to grant consent is rejected with HTTP 422', async () => {
    const req = new Request('http://localhost:3000/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0587',
      },
      body: JSON.stringify({
        studentId: 'stu-0587',
        purposeCode: 'WHATSAPP_REMINDERS',
        guardianDobYear: 2012, // 14 years old in 2026 (< 18)
        guardianIdLast4: '5870',
      }),
    });

    const res = await consentPost(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('CONSENT_FAILED');
    expect(data.error.messageEn).toContain('adult');
  });

  it('Adult guardian (age >= 18) grants consent successfully', async () => {
    const req = new Request('http://localhost:3000/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0587',
      },
      body: JSON.stringify({
        studentId: 'stu-0587',
        purposeCode: 'RISK_SCORING',
        guardianDobYear: 1980, // 46 years old
        guardianIdLast4: '5870',
      }),
    });

    const res = await consentPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.consent.purposeCode).toBe('RISK_SCORING');
    expect(data.consent.isActive).toBe(true);
  });

  it('Consent withdrawal immediately cascades to atomic auto-suppression of queued reminders with CONSENT_WITHDRAWN', async () => {
    const repo = getRepository();

    // Check STU-0219 has QUEUED reminders for Inst 2
    const remindersBefore = repo.getReminders({ studentId: 'stu-0219', state: 'QUEUED' });
    expect(remindersBefore.length).toBeGreaterThan(0);

    // Parent withdraws WHATSAPP_REMINDERS consent
    const req = new Request('http://localhost:3000/api/consent/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0219',
      },
      body: JSON.stringify({
        studentId: 'stu-0219',
        purposeCode: 'WHATSAPP_REMINDERS',
      }),
    });

    const res = await consentWithdrawPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.statutoryRetention.financialRecordsRetained).toBe(true);
    expect(data.statutoryRetention.mandatoryRetentionMonths).toBe(72);

    // Verify all previously queued reminders transitioned to SUPPRESSED_BY_PAYMENT with CONSENT_WITHDRAWN
    const remindersAfter = repo.getReminders({ studentId: 'stu-0219' });
    const suppressedByConsent = remindersAfter.filter((r) => r.suppressReason === 'CONSENT_WITHDRAWN');
    expect(suppressedByConsent.length).toBeGreaterThan(0);
    expect(suppressedByConsent[0].state).toBe('SUPPRESSED_BY_PAYMENT');
  });

  it('Adult guardian submitting incorrect KYC digits (mismatched with admission record) is rejected with HTTP 422', async () => {
    const req = new Request('http://localhost:3000/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': 'PARENT',
        'x-demo-user-id': 'usr-par-0587',
      },
      body: JSON.stringify({
        studentId: 'stu-0587',
        purposeCode: 'WHATSAPP_REMINDERS',
        guardianDobYear: 1980,
        guardianIdLast4: '9999', // Admission record has '5870'
      }),
    });
    const res = await consentPost(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('CONSENT_FAILED');
    expect(data.error.messageEn).toContain('match the adult guardian identity record');
  });
});
