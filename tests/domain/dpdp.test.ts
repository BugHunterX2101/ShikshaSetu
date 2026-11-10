import { describe, it, expect } from 'vitest';
import {
  verifyAdultGuardianKyc,
  processConsentWithdrawal,
  evaluateDataRetention,
  getBilingualConsentNotice,
} from '../../src/domain/dpdp';

describe('TC-14: DPDP Act 2023 & Retention Compliance Engine', () => {
  describe('Section 9(1) & Rule 10: Verifiable Parental Consent', () => {
    it('verifies valid adult guardian matching admission KYC records', () => {
      const res = verifyAdultGuardianKyc('7890', '7890', 42);
      expect(res.verified).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects guardian whose age is under 18 years (Section 2(f))', () => {
      const res = verifyAdultGuardianKyc('7890', '7890', 17);
      expect(res.verified).toBe(false);
      expect(res.error).toContain('must be an adult (age >= 18)');
    });

    it('rejects mismatch between provided digits and admission record', () => {
      const res = verifyAdultGuardianKyc('7890', '1234', 42);
      expect(res.verified).toBe(false);
      expect(res.error).toContain('do not match the adult guardian identity record');
    });
  });

  describe('Section 6(4): Consent Withdrawal Processor', () => {
    it('stops reminders immediately when WHATSAPP_REMINDERS consent is withdrawn', () => {
      const effect = processConsentWithdrawal('WHATSAPP_REMINDERS');
      expect(effect.suppressReminders).toBe(true);
      expect(effect.suppressReason).toBe('CONSENT_WITHDRAWN');
      expect(effect.restrictPortalAccess).toBe(false);
      expect(effect.disableRiskScoring).toBe(false);
    });

    it('restricts portal access and stops reminders when CORE_EDUCATION_FEES is withdrawn', () => {
      const effect = processConsentWithdrawal('CORE_EDUCATION_FEES');
      expect(effect.suppressReminders).toBe(true);
      expect(effect.suppressReason).toBe('CONSENT_WITHDRAWN');
      expect(effect.restrictPortalAccess).toBe(true);
      expect(effect.disableRiskScoring).toBe(true);
    });

    it('disables risk scoring without stopping reminders when RISK_SCORING is withdrawn', () => {
      const effect = processConsentWithdrawal('RISK_SCORING');
      expect(effect.suppressReminders).toBe(false);
      expect(effect.disableRiskScoring).toBe(true);
    });
  });

  describe('Section 8(7) vs Section 36 Indian GST Act 72-Month Retention Override', () => {
    it('strictly preserves fee receipts for 72 months from end of FY 26-27 (until 2033-03-31)', () => {
      const recordDate = '2026-11-02'; // Within FY 26-27 (ends 2027-03-31)

      // Active operational year 2026
      const check2026 = evaluateDataRetention('FEE_RECEIPT', recordDate, '2026-11-02');
      expect(check2026.canErase).toBe(false);
      expect(check2026.mandatoryRetentionMonths).toBe(72);
      expect(check2026.retentionExpiresOn).toBe('2033-03-31');
      expect(check2026.statutoryBasis).toContain('Section 36 Indian GST Act');

      // 4 years later in 2030 (still within 72 months)
      const check2030 = evaluateDataRetention('FEE_RECEIPT', recordDate, '2030-05-15');
      expect(check2030.canErase).toBe(false);

      // Day before expiry: 2033-03-30
      const checkPreExpiry = evaluateDataRetention('FEE_RECEIPT', recordDate, '2033-03-30');
      expect(checkPreExpiry.canErase).toBe(false);

      // Day after expiry: 2033-04-01
      const checkPostExpiry = evaluateDataRetention('FEE_RECEIPT', recordDate, '2033-04-01');
      expect(checkPostExpiry.canErase).toBe(true);
    });

    it('strictly preserves payment transactions, credit notes, and audit logs for 72 months', () => {
      const taxEntities = ['PAYMENT_TRANSACTION', 'CREDIT_NOTE', 'AUDIT_LOG'] as const;

      for (const entity of taxEntities) {
        const res = evaluateDataRetention(entity, '2026-05-10', '2026-11-02');
        expect(res.canErase).toBe(false);
        expect(res.mandatoryRetentionMonths).toBe(72);
      }
    });

    it('allows non-tax personal profile data to be erased upon valid consent withdrawal', () => {
      const res = evaluateDataRetention('STUDENT_PROFILE', '2026-05-10', '2026-11-02');
      expect(res.canErase).toBe(true);
      expect(res.mandatoryRetentionMonths).toBe(0);
      expect(res.statutoryBasis).toContain('DPDP Act 2023 Section 8(7)');
    });
  });

  describe('Section 5 Bilingual Notice Text', () => {
    it('provides both English and Hindi statutory notices with core and retention details', () => {
      const notice = getBilingualConsentNotice();
      expect(notice.en.title).toContain('DPDP Act 2023');
      expect(notice.hi.title).toContain('DPDP अधिनियम 2023');
      expect(notice.en.retentionNotice).toContain('72-month');
      expect(notice.hi.retentionNotice).toContain('72 महीने');
    });
  });
});
