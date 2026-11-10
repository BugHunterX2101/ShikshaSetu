// tests/ui/presentation_layer.test.ts
import { describe, it, expect } from 'vitest';
import { en } from '@/src/i18n/en';
import { hi } from '@/src/i18n/hi';
import { getRepository } from '@/src/store/repository';

describe('Milestone 3: Presentation Layer & UI Core Invariants', () => {
  describe('1. Bilingual i18n Suite & Zero Layout Shift', () => {
    it('en and hi dictionaries have 100% symmetric key parity across all top-level sections', () => {
      const enKeys = Object.keys(en).sort();
      const hiKeys = Object.keys(hi).sort();
      expect(enKeys).toEqual(hiKeys);

      // Verify each sub-section has identical keys
      for (const section of enKeys as Array<keyof typeof en>) {
        const enSubKeys = Object.keys(en[section]).sort();
        const hiSubKeys = Object.keys(hi[section]).sort();
        expect(hiSubKeys).toEqual(enSubKeys);
      }
    });

    it('contains all required translations for 7 core screens and statutory compliance badges', () => {
      expect(en.common.appName).toBe('ShikshaSetu');
      expect(hi.common.appName).toBe('शिक्षा सेतु');

      expect(en.common.rajasthanActBadge).toContain('Rajasthan Coaching Act 2025');
      expect(hi.common.rajasthanActBadge).toContain('राजस्थान कोचिंग अधिनियम 2025');

      expect(en.common.dpdpBadge).toContain('DPDP Act 2023');
      expect(hi.common.dpdpBadge).toContain('डीपीडीपी अधिनियम 2023');

      expect(en.parentDashboard.fiveSecondComprehensionRule).toBe('5-Second Dues Comprehension View');
      expect(hi.parentDashboard.fiveSecondComprehensionRule).toContain('5-सेकंड बकाया समझ दृश्य');
    });

    it('handles parameter interpolation correctly in both English and Hindi', () => {
      // English test
      const enTemplate = en.parentDashboard.dueInDays;
      const enInterpolated = enTemplate.replace('{days}', '5');
      expect(enInterpolated).toBe('Due in 5 days');

      // Hindi test
      const hiTemplate = hi.parentDashboard.dueInDays;
      const hiInterpolated = hiTemplate.replace('{days}', '5');
      expect(hiInterpolated).toBe('5 दिन शेष');
    });
  });

  describe('2. Reviewer Demo Bar & 1-Click Persona Switching Contract', () => {
    it('maps all 4 evaluator personas (Parent, Accounts, Director, Cashier) to valid seed database users', () => {
      const repo = getRepository();

      // 1. Parent Sunita Sharma (STU-0587)
      const parentUser = repo.getUserById('usr-par-0587');
      expect(parentUser).toBeDefined();
      expect(parentUser?.name).toBe('Sunita Sharma');
      expect(parentUser?.role).toBe('PARENT');
      expect(parentUser?.phone).toBe('9829058700');

      // 2. Accounts Exec (Gopalpura)
      const accountsUser = repo.getUserById('usr-acc-01');
      expect(accountsUser).toBeDefined();
      expect(accountsUser?.role).toBe('ACCOUNTS_EXEC');

      // 3. Director (Jaipur HQ)
      const directorUser = repo.getUserById('usr-dir-01');
      expect(directorUser).toBeDefined();
      expect(directorUser?.role).toBe('DIRECTOR');

      // 4. Cashier (Vaishali Nagar)
      const cashierUser = repo.getUserById('usr-acc-02');
      expect(cashierUser).toBeDefined();
      expect(cashierUser?.role).toBe('ACCOUNTS_EXEC');
    });

    it('verifies /api/auth/demo-switch endpoint handles CASHIER and routes to /admin/students/STU-0587', async () => {
      const { POST } = await import('@/app/api/auth/demo-switch/route');

      // Test CASHIER persona
      const req = new Request('http://localhost/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'CASHIER' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.persona).toBe('CASHIER');
      expect(data.redirectTo).toBe('/admin/students/STU-0587');
      expect(data.user.id).toBe('usr-acc-02');
      expect(data.user.role).toBe('ACCOUNTS_EXEC');
    });

    it('verifies /api/auth/demo-switch endpoint handles DIRECTOR and routes to /admin/dashboard', async () => {
      const { POST } = await import('@/app/api/auth/demo-switch/route');

      const req = new Request('http://localhost/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'DIRECTOR' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('DIRECTOR');
      expect(data.redirectTo).toBe('/admin/dashboard');
    });
  });

  describe('3. Statutory Screen Invariants & Compliance Rules', () => {
    it('verifies canonical reference student STU-0587 fee ledger meets Rajasthan Coaching Act 4-instalment rule', () => {
      const repo = getRepository();
      const student = repo.getStudentByCode('STU-0587');
      expect(student).toBeDefined();

      const instalments = repo.getInstalmentsByStudentId(student!.id);
      expect(instalments.length).toBe(4);

      // Verify each instalment is ₹30,000 (equal schedule)
      for (const inst of instalments) {
        expect(inst.amountDuePaise).toBe(3000000n);
      }
    });

    it('verifies adult guardian KYC for STU-0587 requires digits 5870 for DPDP Rule 10 compliance', () => {
      const repo = getRepository();
      const student = repo.getStudentByCode('STU-0587');
      const guardians = repo.getGuardiansByStudentId(student!.id);

      expect(guardians.length).toBeGreaterThan(0);
      const sunita = guardians.find((g) => g.idLast4 === '5870');
      expect(sunita).toBeDefined();
      expect(sunita?.name).toBe('Sunita Sharma');
    });

    it('verifies deterministic composite dropout risk score for STU-0587 is exactly 79 (F=32, A=28, S=19)', () => {
      const repo = getRepository();
      const student = repo.getStudentByCode('STU-0587');
      expect(student).toBeDefined();

      const flags = repo.getDropoutFlags();
      const riskRecord = flags.find((f) => f.studentId === student!.id);

      expect(riskRecord).toBeDefined();
      expect(riskRecord?.score).toBe(79);
      expect(riskRecord?.fScore).toBe(32);
      expect(riskRecord?.aScore).toBe(28);
      expect(riskRecord?.sScore).toBe(19);
      expect(riskRecord?.severity).toBe('HIGH');
    });
  });
});
