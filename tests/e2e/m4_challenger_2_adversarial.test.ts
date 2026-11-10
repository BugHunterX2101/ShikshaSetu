// tests/e2e/m4_challenger_2_adversarial.test.ts
// ============================================================================
// ShikshaSetu Milestone 4 Gate Verification: Adversarial Stress Test Suite
// Authored by: m4_challenger_2 (teamwork_challenger)
// Scope: Empirical verification and stress testing of:
//   1. TC-05: AI dropout risk score for STU-0587 (assert deterministic 79, F=32, A=28, S=19)
//   2. TC-14: DPDP adult KYC last 4 digits '5870' and separate parental consent independence
//   3. TC-19: CSV bulk student upload atomicity, line errors, and SHA-256 duplicate rejection
//   4. TC-20: IST Timezone midnight boundary (23:50 IST vs 00:10 IST)
//   5. TC-21: Zero dead buttons across all 7 screens and modular components
//   6. TC-23: Production build demo mode suppression
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Domain engines
import {
  calculateDropoutRiskScore,
  computeFeeFactor,
  computeAttendanceFactor,
  computeTestSlopeFactor,
  verifyAdultGuardianKyc,
  evaluateDataRetention,
  processConsentWithdrawal,
  parseAcademicCsv,
  computeCsvSha256,
  toISTDate,
  IST_OFFSET_MS,
} from '@/src/domain';

// Lib & Persistence
import { isDemoMode } from '@/src/lib/demoMode';
import { getRepository } from '@/src/store/repository';

// Route Handlers
import { GET as riskQueueGet } from '@/app/api/admin/refunds/risk-queue/route';
import { POST as grantConsentPost, GET as consentGet } from '@/app/api/consent/route';
import { POST as withdrawConsentPost } from '@/app/api/consent/withdraw/route';

const ANCHOR_DATE = '2026-11-02';

describe('Milestone 4 Gate Verification: Challenger 2 Empirical Stress Suite', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  // ==========================================================================
  // 1. TC-05: AI DROPOUT RISK SCORE DETERMINISM & BOUNDARIES
  // ==========================================================================
  describe('1. TC-05: AI Dropout Risk Score Determinism & Boundary Fuzzing', () => {
    it('empirically verifies STU-0587 exact scores: F=32, A=28, S=19 => Total=79 HIGH', () => {
      const res = calculateDropoutRiskScore({
        worstOverdueDays: 23,
        isPartPaid: true,
        attendancePercent: 69,
        prevAttendancePercent: 88,
        testOldPercentile: 78,
        testNewPercentile: 59,
      });

      expect(res.fScore).toBe(32);
      expect(res.aScore).toBe(28);
      expect(res.sScore).toBe(19);
      expect(res.score).toBe(79);
      expect(res.severity).toBe('HIGH');
      expect(res.taskCreated).toBe(true);
      expect(res.factors.fScore).toBe(32);
      expect(res.factors.aScore).toBe(28);
      expect(res.factors.sScore).toBe(19);
      expect(res.rationaleEn).toContain('79/100 (HIGH)');
      expect(res.rationaleHi).toContain('79/100 (उच्च)');
    });

    it('verifies fee factor (F) monotonicity and capping across overdue days 0 to 45', () => {
      // Days 0..30 with isPartPaid=false
      let prevF = -1;
      for (let d = 0; d <= 30; d++) {
        const f = computeFeeFactor(d, false);
        expect(f).toBeGreaterThanOrEqual(prevF);
        expect(f).toBeLessThanOrEqual(35);
        prevF = f;
      }
      expect(computeFeeFactor(0, false)).toBe(0);
      expect(computeFeeFactor(30, false)).toBe(35);

      // Part-paid bonus: adds 5 points, capped at 40
      expect(computeFeeFactor(0, true)).toBe(5);
      expect(computeFeeFactor(23, true)).toBe(32);
      expect(computeFeeFactor(30, true)).toBe(40);
      expect(computeFeeFactor(45, true)).toBe(40); // capped at 40
    });

    it('verifies attendance factor (A) benchmark, floor, and drop penalty boundaries', () => {
      // Benchmark = 80%: att >= 80 gives baseA = 0
      expect(computeAttendanceFactor(100)).toBe(0);
      expect(computeAttendanceFactor(80)).toBe(0);

      // Floor = 65%: att <= 65 gives baseA = 25
      expect(computeAttendanceFactor(65)).toBe(25);
      expect(computeAttendanceFactor(50)).toBe(25);
      expect(computeAttendanceFactor(0)).toBe(25);

      // Interpolation: att = 69 => roundHalfUp(25 * 11 / 15) = 18
      expect(computeAttendanceFactor(69)).toBe(18);

      // Drop penalty: strictly > 10% drop gives +10 points
      expect(computeAttendanceFactor(69, 79)).toBe(18); // drop = 10 (not > 10) => penalty 0
      expect(computeAttendanceFactor(69, 80)).toBe(28); // drop = 11 (> 10) => penalty +10
      expect(computeAttendanceFactor(69, 88)).toBe(28); // drop = 19 (> 10) => penalty +10

      // Overall A capped at 35
      expect(computeAttendanceFactor(50, 90)).toBe(35); // 25 + 10 = 35
    });

    it('verifies academic slope factor (S) drop capping and non-negativity', () => {
      // S = min(25, max(0, old - new))
      expect(computeTestSlopeFactor(78, 59)).toBe(19);
      expect(computeTestSlopeFactor(80, 80)).toBe(0);
      expect(computeTestSlopeFactor(60, 80)).toBe(0); // score improved: never negative
      expect(computeTestSlopeFactor(100, 50)).toBe(25); // drop 50 capped at 25
      expect(computeTestSlopeFactor(undefined, undefined, -10)).toBe(0);
      expect(computeTestSlopeFactor(undefined, undefined, 20)).toBe(20);
    });

    it('verifies severity thresholds: 0..49 LOW (no task), 50..69 MEDIUM (task), 70..100 HIGH (task)', () => {
      const low = calculateDropoutRiskScore({
        worstOverdueDays: 0,
        isPartPaid: false,
        attendancePercent: 85,
        testOldPercentile: 70,
        testNewPercentile: 70,
      });
      expect(low.score).toBe(0);
      expect(low.severity).toBe('LOW');
      expect(low.taskCreated).toBe(false);

      const med49 = calculateDropoutRiskScore({
        worstOverdueDays: 17,
        isPartPaid: false,
        attendancePercent: 71,
        prevAttendancePercent: 71,
        testOldPercentile: 70,
        testNewPercentile: 56,
      });
      expect(med49.score).toBe(49);
      expect(med49.severity).toBe('LOW');
      expect(med49.taskCreated).toBe(false);

      const med50 = calculateDropoutRiskScore({
        worstOverdueDays: 17,
        isPartPaid: false,
        attendancePercent: 71,
        prevAttendancePercent: 71,
        testOldPercentile: 70,
        testNewPercentile: 55,
      });
      expect(med50.score).toBe(50);
      expect(med50.severity).toBe('MEDIUM');
      expect(med50.taskCreated).toBe(true);

      const high70 = calculateDropoutRiskScore({
        worstOverdueDays: 20,
        isPartPaid: true,
        attendancePercent: 69,
        prevAttendancePercent: 88,
        testOldPercentile: 78,
        testNewPercentile: 64,
      });
      expect(high70.score).toBe(70);
      expect(high70.severity).toBe('HIGH');
      expect(high70.taskCreated).toBe(true);
    });

    it('queries Risk Queue API and verifies STU-0587 data contract & RBAC isolation', async () => {
      // 1. Staff query
      const reqStaff = new Request('http://localhost:3000/api/admin/refunds/risk-queue', {
        headers: { 'x-demo-role': 'DIRECTOR', 'x-demo-user-id': 'usr-dir-01' },
      });
      const resStaff = await riskQueueGet(reqStaff);
      expect(resStaff.status).toBe(200);
      const data = await resStaff.json();
      expect(data.success).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);

      const stu0587Item = data.items.find((i: any) => i.studentCode === 'STU-0587');
      expect(stu0587Item).toBeDefined();
      expect(stu0587Item.score).toBe(79);
      expect(stu0587Item.financialScore).toBe(32);
      expect(stu0587Item.attendanceScore).toBe(28);
      expect(stu0587Item.academicScore).toBe(19);
      expect(stu0587Item.severity).toBe('HIGH');
      expect(stu0587Item.status).toBe('NEEDS_INTERVENTION');

      // 2. Parent query must be rejected with HTTP 403
      const reqParent = new Request('http://localhost:3000/api/admin/refunds/risk-queue', {
        headers: { 'x-demo-role': 'PARENT', 'x-demo-user-id': 'usr-par-0587' },
      });
      const resParent = await riskQueueGet(reqParent);
      expect(resParent.status).toBe(403);
    });
  });

  // ==========================================================================
  // 2. TC-14: DPDP ADULT KYC & SEPARATE PARENTAL CONSENT INDEPENDENCE
  // ==========================================================================
  describe('2. TC-14: DPDP Adult KYC (5870) & Separate Parental Consent Independence', () => {
    it('rejects minor guardian under 18 years even if last 4 digits match 5870', () => {
      const kyc = verifyAdultGuardianKyc('5870', '5870', 17);
      expect(kyc.verified).toBe(false);
      expect(kyc.error).toContain('must be an adult');
    });

    it('rejects adult guardian with mismatched last 4 digits (e.g. 9999 vs 5870)', () => {
      const kyc = verifyAdultGuardianKyc('5870', '9999', 42);
      expect(kyc.verified).toBe(false);
      expect(kyc.error).toContain('do not match');
    });

    it('approves adult guardian with matching last 4 digits (5870, age >= 18)', () => {
      const kyc = verifyAdultGuardianKyc('5870', '5870', 42);
      expect(kyc.verified).toBe(true);
      expect(kyc.error).toBeUndefined();
    });

    it('enforces separate consent independence for two distinct parents of the same student', async () => {
      const repo = getRepository();

      // Parent 1 (Sunita Sharma, primary guardian) grants consent
      const c1 = await repo.grantConsent(
        'stu-0587',
        'usr-par-0587',
        'WHATSAPP_REMINDERS',
        'hi',
        1984,
        '5870'
      );
      expect(c1.id).toBeDefined();

      // Parent 2 (Secondary guardian, e.g. usr-par-0587-p2) grants consent
      const c2 = await repo.grantConsent(
        'stu-0587',
        'usr-par-0587-p2',
        'WHATSAPP_REMINDERS',
        'en',
        1982,
        '5870'
      );
      expect(c2.id).toBeDefined();
      expect(c1.id).not.toBe(c2.id);

      // Verify both parents have active consent
      expect(repo.hasActiveConsent('stu-0587', 'usr-par-0587', 'WHATSAPP_REMINDERS')).toBe(true);
      expect(repo.hasActiveConsent('stu-0587', 'usr-par-0587-p2', 'WHATSAPP_REMINDERS')).toBe(true);

      // Parent 1 withdraws consent
      await repo.withdrawConsent('stu-0587', 'usr-par-0587', 'WHATSAPP_REMINDERS');

      // Parent 1 consent is now withdrawn
      expect(repo.hasActiveConsent('stu-0587', 'usr-par-0587', 'WHATSAPP_REMINDERS')).toBe(false);

      // Parent 2 consent remains active and independent!
      expect(repo.hasActiveConsent('stu-0587', 'usr-par-0587-p2', 'WHATSAPP_REMINDERS')).toBe(true);
    });

    it('enforces Section 36 Indian GST Act 72-month retention override against DPDP erasure', () => {
      const taxReceipt = evaluateDataRetention('FEE_RECEIPT', '2026-11-02', '2026-11-02');
      expect(taxReceipt.canErase).toBe(false);
      expect(taxReceipt.mandatoryRetentionMonths).toBe(72);
      expect(taxReceipt.statutoryBasis).toContain('Section 36 Indian GST Act 2017');
      expect(taxReceipt.retentionExpiresOn).toBe('2033-03-31');

      const nonTax = evaluateDataRetention('STUDENT_PROFILE', '2026-11-02', '2026-11-02');
      expect(nonTax.canErase).toBe(true);
      expect(nonTax.statutoryBasis).toContain('DPDP Act 2023 Section 8(7)');
    });
  });

  // ==========================================================================
  // 3. TC-19: CSV BULK STUDENT UPLOAD ATOMICITY & SHA-256 REJECTION
  // ==========================================================================
  describe('3. TC-19: CSV Bulk Student Upload Atomicity & Duplicate Rejection', () => {
    it('accurately identifies line-by-line errors and completely aborts upload (all-or-nothing rollback)', async () => {
      const repo = getRepository();
      const initialAcademics = repo.getAcademicsByStudentId('stu-0587');

      const corruptedCsv = [
        'studentCode,attendancePercent,testPercentile',
        'STU-0587,85,92',       // Line 2: Valid
        'STU-0219,105,88',      // Line 3: Attendance > 100
        'STU-0412,80,-15',      // Line 4: Percentile < 0
        'STU-0587,INVALID,75',  // Line 5: Non-numeric attendance
        'UNKNOWN-999,90,85',    // Line 6: Unknown student code
      ].join('\n');

      const result = await repo.processAcademicCsvUpload(corruptedCsv, 'test_corrupt.csv');
      expect(result.success).toBe(false);
      expect(result.importedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);

      // Verify line 3 error
      expect(result.errors.some((e) => e.lineNumber === 3 && e.field === 'attendancePercent')).toBe(true);
      // Verify line 4 error
      expect(result.errors.some((e) => e.lineNumber === 4 && e.field === 'testPercentile')).toBe(true);
      // Verify line 5 error
      expect(result.errors.some((e) => e.lineNumber === 5 && e.field === 'attendancePercent')).toBe(true);

      // Verify all-or-nothing rollback: STU-0587 was NOT updated to 85% attendance
      const postAcademics = repo.getAcademicsByStudentId('stu-0587');
      expect(postAcademics?.attendancePercent).toBe(initialAcademics?.attendancePercent);
    });

    it('rejects identical upload via SHA-256 fingerprinting', async () => {
      const repo = getRepository();

      const validCsv = [
        'studentCode,attendancePercent,testPercentile',
        'STU-0587,75,65',
        'STU-0219,85,90',
      ].join('\n');

      const hash = computeCsvSha256(validCsv);

      // 1. First upload succeeds
      const res1 = await repo.processAcademicCsvUpload(validCsv, 'valid_batch_01.csv');
      expect(res1.success).toBe(true);
      expect(res1.importedCount).toBe(2);
      expect(res1.fileHash).toBe(hash);

      // 2. Second upload of exact same content rejected
      const res2 = await repo.processAcademicCsvUpload(validCsv, 'valid_batch_01_retry.csv');
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('DUPLICATE_FILE');
      expect(res2.importedCount).toBe(0);
      expect(res2.message).toContain('duplicate SHA-256');
    });
  });

  // ==========================================================================
  // 4. TC-20: IST TIMEZONE MIDNIGHT BOUNDARY (23:50 IST vs 00:10 IST)
  // ==========================================================================
  describe('4. TC-20: IST Timezone Midnight Boundary Consistency', () => {
    it('empirically maps 23:50 IST to Day D and 00:10 IST to Day D+1', () => {
      // 2026-11-02 23:50:00 IST is UTC 2026-11-02 18:20:00Z
      const date2350 = toISTDate('2026-11-02T18:20:00.000Z');
      expect(date2350).toBe('2026-11-02');

      // 2026-11-02 23:59:59 IST is UTC 2026-11-02 18:29:59Z
      const date2359 = toISTDate('2026-11-02T18:29:59.000Z');
      expect(date2359).toBe('2026-11-02');

      // 2026-11-03 00:00:01 IST is UTC 2026-11-02 18:30:01Z
      const date0000 = toISTDate('2026-11-02T18:30:01.000Z');
      expect(date0000).toBe('2026-11-03');

      // 2026-11-03 00:10:00 IST is UTC 2026-11-02 18:40:00Z
      const date0010 = toISTDate('2026-11-02T18:40:00.000Z');
      expect(date0010).toBe('2026-11-03');
    });

    it('enforces Section 269ST daily cumulative cash accumulator reset across IST midnight boundary', async () => {
      const repo = getRepository();

      // Payment 1: Cash ₹1,50,000 received at 23:50 IST on 2026-11-02
      await repo.recordOfflinePayment({
        studentId: 'stu-0219',
        instalmentId: 'inst-0219-2',
        amountPaise: 15000000n, // ₹1,50,000
        mode: 'CASH',
        paymentDate: '2026-11-02T18:20:00.000Z', // 23:50 IST Nov 2
        reference: 'CASH-IST-PRE-MIDNIGHT',
        payerName: 'Parent',
        actorUserId: 'usr-acc-01',
      });

      // Attempt second payment of ₹1,00,000 at 23:55 IST on same day:
      // Cumulative cash would be ₹2,50,000 >= ₹2,00,000 -> MUST BE BLOCKED
      const sameDayCheck = repo.validateSection269ST(
        'stu-0219',
        10000000n,
        '2026-11-02T18:25:00.000Z' // 23:55 IST Nov 2
      );
      expect(sameDayCheck.allowed).toBe(false);
      expect(sameDayCheck.problem?.title).toContain('Section 269ST');

      // Attempt second payment of ₹1,00,000 at 00:10 IST on 2026-11-03:
      // New calendar day in IST (+05:30) -> MUST BE ALLOWED
      const nextDayCheck = repo.validateSection269ST(
        'stu-0219',
        10000000n,
        '2026-11-02T18:40:00.000Z' // 00:10 IST Nov 3
      );
      expect(nextDayCheck.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // 5. TC-21: ZERO DEAD BUTTONS ACROSS ALL 7 SCREENS & COMPONENTS
  // ==========================================================================
  describe('5. TC-21: Zero Dead Buttons & Interactive Elements Crawl', () => {
    const screenFiles = [
      'app/login/page.tsx',
      'app/parent/dashboard/page.tsx',
      'app/parent/pay/[id]/page.tsx',
      'app/admin/dashboard/page.tsx',
      'app/admin/students/[id]/page.tsx',
      'app/admin/reminders/page.tsx',
      'app/admin/refunds/page.tsx',
    ];

    const componentFiles = [
      'components/Header.tsx',
      'components/DuesCard.tsx',
      'components/PaymentModal.tsx',
      'components/ConsentModal.tsx',
      'components/AgeingTable.tsx',
      'components/UnmatchedQueue.tsx',
      'components/ReminderOutbox.tsx',
      'components/RefundCalculator.tsx',
      'components/ReviewerDemoBar.tsx',
      'components/ReceiptModal.tsx',
    ];

    it('verifies all 7 core screen files exist and contain interactive elements with active handlers', () => {
      let totalButtons = 0;
      let totalLinks = 0;

      for (const file of screenFiles) {
        const fullPath = path.join(process.cwd(), file);
        expect(fs.existsSync(fullPath)).toBe(true);
        const code = fs.readFileSync(fullPath, 'utf-8');

        // Check buttons
        const buttonMatches = code.match(/<button[\s\S]*?>/g) || [];
        totalButtons += buttonMatches.length;
        expect(buttonMatches.length).toBeGreaterThan(0);

        for (const btn of buttonMatches) {
          const hasOnClick = /onClick\s*=/.test(btn);
          const hasTypeSubmit = /type\s*=\s*["']submit["']/.test(btn);
          const isDisabled = /disabled(\s*=|[\s>])/.test(btn);
          expect(hasOnClick || hasTypeSubmit || isDisabled).toBe(true);
        }

        // Check links
        const linkMatches = code.match(/<(a\b|Link\b)[\s\S]*?>/g) || [];
        totalLinks += linkMatches.length;
        for (const link of linkMatches) {
          expect(link).toMatch(/href\s*=\s*\{?["'`][^"'`#]+["'`]\}?/);
        }
      }

      expect(totalButtons).toBeGreaterThanOrEqual(25);
    });

    it('verifies all modular components have zero dead buttons and zero placeholder links', () => {
      function getTsxFiles(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            results = results.concat(getTsxFiles(filePath));
          } else if (file.endsWith('.tsx')) {
            results.push(filePath);
          }
        }
        return results;
      }

      const allComponentFiles = getTsxFiles(path.join(process.cwd(), 'components'));
      expect(allComponentFiles.length).toBeGreaterThan(5);

      for (const fullPath of allComponentFiles) {
        const code = fs.readFileSync(fullPath, 'utf-8');

        // No placeholder href="#"
        expect(code).not.toMatch(/href\s*=\s*["']#["']/);

        // No empty onClick handlers
        expect(code).not.toMatch(/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/);

        const buttonMatches = code.match(/<button[\s\S]*?>/g) || [];
        for (const btn of buttonMatches) {
          const hasOnClick = /onClick\s*=/.test(btn);
          const hasTypeSubmit = /type\s*=\s*["']submit["']/.test(btn);
          const isDisabled = /disabled(\s*=|[\s>])/.test(btn);
          expect(hasOnClick || hasTypeSubmit || isDisabled).toBe(true);
        }

        const linkMatches = code.match(/<(a\b|Link\b)[\s\S]*?>/g) || [];
        for (const link of linkMatches) {
          expect(link).toMatch(/href\s*=\s*\{?[^>#]+?\}?/);
          expect(link).not.toMatch(/href\s*=\s*["']#["']/);
          expect(link).not.toMatch(/href\s*=\s*["']["']/);
        }
      }
    });
  });

  // ==========================================================================
  // 6. TC-23: PRODUCTION BUILD DEMO MODE SUPPRESSION
  // ==========================================================================
  describe('6. TC-23: Production Build Demo Mode Suppression Guard', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    const originalDemoMode2 = process.env.DEMO_MODE;

    afterEach(() => {
      (process.env as any).NODE_ENV = originalNodeEnv;
      (process.env as any).NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
      (process.env as any).DEMO_MODE = originalDemoMode2;
    });

    it('strictly returns false when NODE_ENV is production and NEXT_PUBLIC_DEMO_MODE is not set', () => {
      (process.env as any).NODE_ENV = 'production';
      delete (process.env as any).NEXT_PUBLIC_DEMO_MODE;
      delete (process.env as any).DEMO_MODE;

      expect(isDemoMode()).toBe(false);
    });

    it('strictly returns false when NEXT_PUBLIC_DEMO_MODE is explicitly false', () => {
      (process.env as any).NODE_ENV = 'development';
      (process.env as any).NEXT_PUBLIC_DEMO_MODE = 'false';

      expect(isDemoMode()).toBe(false);
    });

    it('strictly returns false when DEMO_MODE is explicitly false', () => {
      (process.env as any).NODE_ENV = 'development';
      (process.env as any).DEMO_MODE = 'false';

      expect(isDemoMode()).toBe(false);
    });

    it('only returns true in development/test when demo mode is not suppressed', () => {
      delete (process.env as any).NODE_ENV;
      delete (process.env as any).NEXT_PUBLIC_DEMO_MODE;
      delete (process.env as any).DEMO_MODE;

      expect(isDemoMode()).toBe(true);
    });
  });
});
