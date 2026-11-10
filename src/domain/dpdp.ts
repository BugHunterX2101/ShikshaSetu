/**
 * Digital Personal Data Protection Act, 2023 & DPDP Rules 2025 Compliance Engine
 * File: src/domain/dpdp.ts
 *
 * Statutory References:
 * - DPDP Act 2023 s.2(f): Minor under 18 years is defined as a child.
 * - DPDP Act 2023 s.9(1) & DPDP Rules 2025 Rule 10: Verifiable parental consent before processing
 *   any personal data of a child. Must authenticate adult guardian KYC on file.
 * - DPDP Act 2023 s.5 & s.6: Notice requirement in plain language, accessible in 8th Schedule languages (Hindi & English).
 * - DPDP Act 2023 s.6(4): Right of parent to withdraw consent at any time; withdrawal must immediately
 *   stop non-essential communications (e.g. WhatsApp/SMS reminders).
 * - Statutory Retention Harmonization:
 *   DPDP Act s.8(7) mandates data erasure upon purpose fulfilment or consent withdrawal, UNLESS
 *   retention is required under another applicable law.
 *   Section 36 of Indian GST Act 2017 MANDATES keeping books of account, payment records, tax invoices,
 *   receipts, and credit notes for at least 72 months (6 years) from the annual return due date.
 *   Financial records are thus preserved against premature erasure.
 */

export type DpdpPurpose = 'CORE_EDUCATION_FEES' | 'WHATSAPP_REMINDERS' | 'RISK_SCORING';

export type IdentityDocumentType = 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'PASSPORT';

export interface ParentalConsentRecord {
  studentId: string;
  guardianId: string;
  guardianPhone: string;
  guardianIdLast4: string;
  identityType: IdentityDocumentType;
  grantedAt: string;
  withdrawnAt?: string;
  purposes: DpdpPurpose[];
  noticeVersion: string;
  language: 'en' | 'hi';
}

export interface RetentionPolicyResult {
  canErase: boolean;
  statutoryBasis: string;
  mandatoryRetentionMonths: number;
  retentionExpiresOn?: string;
}

export interface ConsentWithdrawalEffect {
  suppressReminders: boolean;
  suppressReason?: 'CONSENT_WITHDRAWN';
  restrictPortalAccess: boolean;
  disableRiskScoring: boolean;
}

export type EntityType =
  | 'STUDENT_PROFILE'
  | 'GUARDIAN_CONTACT'
  | 'FEE_RECEIPT'
  | 'PAYMENT_TRANSACTION'
  | 'CREDIT_NOTE'
  | 'AUDIT_LOG';

/**
 * DPDP Act Section 9(1) & Rule 10: Verifies adult guardian KYC credentials against admission records.
 */
export function verifyAdultGuardianKyc(
  admissionLast4: string,
  providedLast4: string,
  guardianAgeYears: number
): { verified: boolean; error?: string } {
  if (guardianAgeYears < 18) {
    return {
      verified: false,
      error: 'Guardian must be an adult (age >= 18) under DPDP Act Section 2(f) and Rule 10.',
    };
  }
  if (!admissionLast4 || !providedLast4 || admissionLast4 !== providedLast4) {
    return {
      verified: false,
      error: 'Provided ID digits do not match the adult guardian identity record on admission file.',
    };
  }
  return { verified: true };
}

/**
 * DPDP Act Section 6(4): Computes operational system effects upon consent withdrawal.
 */
export function processConsentWithdrawal(withdrawnPurpose: DpdpPurpose): ConsentWithdrawalEffect {
  switch (withdrawnPurpose) {
    case 'WHATSAPP_REMINDERS':
      return {
        suppressReminders: true,
        suppressReason: 'CONSENT_WITHDRAWN',
        restrictPortalAccess: false,
        disableRiskScoring: false,
      };
    case 'CORE_EDUCATION_FEES':
      return {
        suppressReminders: true,
        suppressReason: 'CONSENT_WITHDRAWN',
        restrictPortalAccess: true, // Blocks access to dashboard and shows consent renewal modal
        disableRiskScoring: true,
      };
    case 'RISK_SCORING':
      return {
        suppressReminders: false,
        restrictPortalAccess: false,
        disableRiskScoring: true,
      };
  }
}

/**
 * Evaluates whether an entity can be erased under DPDP s.8(7) or must be preserved under
 * Section 36 of the Indian GST Act (72 months retention mandate).
 *
 * Rule:
 * Tax records (FEE_RECEIPT, PAYMENT_TRANSACTION, CREDIT_NOTE, AUDIT_LOG) must be preserved
 * for 72 months from the end of the financial year in which the transaction occurred.
 */
export function evaluateDataRetention(
  entityType: EntityType,
  recordDate: string, // YYYY-MM-DD
  asOfDate: string // YYYY-MM-DD
): RetentionPolicyResult {
  const isTaxRecord =
    entityType === 'FEE_RECEIPT' ||
    entityType === 'PAYMENT_TRANSACTION' ||
    entityType === 'CREDIT_NOTE' ||
    entityType === 'AUDIT_LOG';

  if (isTaxRecord) {
    const [y, m] = recordDate.split('-').map(Number);
    // Financial year end is March 31 of next year if month >= 4, else March 31 of current year
    const fyEndYear = m >= 4 ? y + 1 : y;
    // 72 months (6 full years) from the end of the relevant financial year
    const retentionEndDate = `${fyEndYear + 6}-03-31`;

    const isExpired = asOfDate > retentionEndDate;

    return {
      canErase: isExpired,
      statutoryBasis:
        'Section 36 Indian GST Act 2017 (Mandatory 72-month financial accounts retention overrides DPDP Act s.8(7))',
      mandatoryRetentionMonths: 72,
      retentionExpiresOn: retentionEndDate,
    };
  }

  // Non-tax records (student personal profile, notification logs, etc.) can be erased
  return {
    canErase: true,
    statutoryBasis: 'DPDP Act 2023 Section 8(7) (Consent withdrawn / processing purpose fulfilled)',
    mandatoryRetentionMonths: 0,
  };
}

/**
 * Returns plain language bilingual consent notice text (DPDP Section 5)
 */
export function getBilingualConsentNotice() {
  return {
    en: {
      title: 'Data Protection & Parental Consent Notice (DPDP Act 2023)',
      version: '2026.1',
      purposes: {
        CORE_EDUCATION_FEES:
          'Core Educational & Fee Records: Processing academic enrolment, ledger balances, statutory receipts, and examination hall-ticket eligibility.',
        WHATSAPP_REMINDERS:
          'Fee Reminders via WhatsApp/SMS: Dispatching payment due alerts and balance notifications to parent mobile numbers.',
        RISK_SCORING:
          'Academic Wellbeing & Early Support: Analyzing attendance trajectories and test score trends solely to provide 1-on-1 academic doubt-clearing and counselling support.',
      },
      withdrawalRights:
        'You have the legal right to withdraw optional consent at any time via the Parent Portal settings. Withdrawal takes effect immediately.',
      retentionNotice:
        'Financial invoices and tax receipts are preserved for a mandatory 72-month period pursuant to Section 36 of the Indian GST Act.',
    },
    hi: {
      title: 'डेटा संरक्षण एवं अभिभावक सहमति सूचना (DPDP अधिनियम 2023)',
      version: '2026.1',
      purposes: {
        CORE_EDUCATION_FEES:
          'मुख्य शैक्षणिक एवं शुल्क रिकॉर्ड: शैक्षणिक नामांकन, शुल्क लेजर, वैधानिक रसीदें और परीक्षा प्रवेश पत्र पात्रता के लिए डेटा प्रसंस्करण।',
        WHATSAPP_REMINDERS:
          'व्हाट्सएप/एसएमएस शुल्क रिमाइंडर: अभिभावक के मोबाइल नंबर पर नियत तिथियों से पूर्व देय शुल्क सूचनाएं प्रेषित करना।',
        RISK_SCORING:
          'शैक्षणिक मार्गदर्शन एवं प्रारंभिक सहायता: केवल व्यक्तिगत संशय समाधान और काउंसलिंग सहायता प्रदान करने हेतु उपस्थिति एवं टेस्ट रुझानों का विश्लेषण।',
      },
      withdrawalRights:
        'आपको पोर्टल सेटिंग्स के माध्यम से किसी भी समय सहमति वापस लेने का कानूनी अधिकार है। सहमति वापसी तत्काल प्रभावी होगी।',
      retentionNotice:
        'भारतीय जीएसटी अधिनियम की धारा 36 के तहत वित्तीय रसीदों और कर दस्तावेजों को न्यूनतम 72 महीने तक संरक्षित रखा जाता है।',
    },
  };
}
