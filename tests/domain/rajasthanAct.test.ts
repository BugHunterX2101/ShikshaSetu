import { describe, it, expect } from 'vitest';
import {
  validateFeePlan,
  generateCompliantInstalments,
  validateFeeAdjustment,
  formatReceiptStatutoryHeader,
} from '../../src/domain/rajasthanAct';

describe('TC-13: Rajasthan Coaching Act 2025 Compliance Engine', () => {
  const TOTAL_FEE = 12000000n; // ₹1,20,000.00

  it('rejects batch fee plans with fewer than 4 instalments (Section 6(2)(d))', () => {
    // 2-instalment plan
    const plan2 = {
      totalFeePaise: TOTAL_FEE,
      instalments: [
        { instalmentNumber: 1, dueDate: '2026-04-10', amountPaise: 6000000n },
        { instalmentNumber: 2, dueDate: '2026-10-10', amountPaise: 6000000n },
      ],
    };
    const res2 = validateFeePlan(plan2);
    expect(res2.valid).toBe(false);
    expect(res2.code).toBe('LESS_THAN_FOUR_INSTALMENTS');

    // 3-instalment plan
    const plan3 = {
      totalFeePaise: TOTAL_FEE,
      instalments: [
        { instalmentNumber: 1, dueDate: '2026-04-10', amountPaise: 4000000n },
        { instalmentNumber: 2, dueDate: '2026-08-10', amountPaise: 4000000n },
        { instalmentNumber: 3, dueDate: '2026-12-10', amountPaise: 4000000n },
      ],
    };
    const res3 = validateFeePlan(plan3);
    expect(res3.valid).toBe(false);
    expect(res3.code).toBe('LESS_THAN_FOUR_INSTALMENTS');
  });

  it('validates 4 equal instalments of ₹30,000.00', () => {
    const plan = {
      totalFeePaise: TOTAL_FEE,
      instalments: [
        { instalmentNumber: 1, dueDate: '2026-04-10', amountPaise: 3000000n },
        { instalmentNumber: 2, dueDate: '2026-07-10', amountPaise: 3000000n },
        { instalmentNumber: 3, dueDate: '2026-10-10', amountPaise: 3000000n },
        { instalmentNumber: 4, dueDate: '2027-01-10', amountPaise: 3000000n },
      ],
    };
    const res = validateFeePlan(plan);
    expect(res.valid).toBe(true);
  });

  it('validates odd paise remainder absorption in final instalment (10,001 paise)', () => {
    const plan = {
      totalFeePaise: 10001n,
      instalments: [
        { instalmentNumber: 1, dueDate: '2026-04-10', amountPaise: 2500n },
        { instalmentNumber: 2, dueDate: '2026-07-10', amountPaise: 2500n },
        { instalmentNumber: 3, dueDate: '2026-10-10', amountPaise: 2500n },
        { instalmentNumber: 4, dueDate: '2027-01-10', amountPaise: 2501n }, // Absorbs 1 remainder paisa
      ],
    };
    const res = validateFeePlan(plan);
    expect(res.valid).toBe(true);
  });

  it('rejects unequal instalments that violate equal instalments rule', () => {
    // 40k + 30k + 30k + 20k
    const plan = {
      totalFeePaise: TOTAL_FEE,
      instalments: [
        { instalmentNumber: 1, dueDate: '2026-04-10', amountPaise: 4000000n },
        { instalmentNumber: 2, dueDate: '2026-07-10', amountPaise: 3000000n },
        { instalmentNumber: 3, dueDate: '2026-10-10', amountPaise: 3000000n },
        { instalmentNumber: 4, dueDate: '2027-01-10', amountPaise: 2000000n },
      ],
    };
    const res = validateFeePlan(plan);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('INSTALMENTS_NOT_EQUAL');
  });

  it('rejects fee plan when instalments sum does not match total fee', () => {
    const plan = {
      totalFeePaise: TOTAL_FEE,
      instalments: [
        { instalmentNumber: 1, dueDate: '2026-04-10', amountPaise: 3000000n },
        { instalmentNumber: 2, dueDate: '2026-07-10', amountPaise: 3000000n },
        { instalmentNumber: 3, dueDate: '2026-10-10', amountPaise: 3000000n },
        { instalmentNumber: 4, dueDate: '2027-01-10', amountPaise: 2999900n }, // 1 rupee short
      ],
    };
    const res = validateFeePlan(plan);
    expect(res.valid).toBe(false);
  });

  it('generates compliant 4-instalment schedule with remainder absorbed in final instalment', () => {
    const schedule = generateCompliantInstalments(10001n, 4, '2026-04-10', 3);
    expect(schedule).toHaveLength(4);
    expect(schedule[0].amountPaise).toBe(2500n);
    expect(schedule[1].amountPaise).toBe(2500n);
    expect(schedule[2].amountPaise).toBe(2500n);
    expect(schedule[3].amountPaise).toBe(2501n);
    expect(schedule[0].dueDate).toBe('2026-04-10');
    expect(schedule[1].dueDate).toBe('2026-07-10');
  });

  describe('Section 13(5) Guard: Prohibition of Mid-Course Fee Hikes', () => {
    it('strictly blocks fee hikes on enrolled student', () => {
      const res = validateFeeAdjustment(12000000n, 13000000n, true);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('s.13(5) strictly prohibits increasing course fees');
    });

    it('blocks fee reduction without Director approval', () => {
      const res = validateFeeAdjustment(12000000n, 10000000n, false);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('require audited Director approval');
    });

    it('permits fee reduction with audited Director approval', () => {
      const res = validateFeeAdjustment(12000000n, 10000000n, true);
      expect(res.allowed).toBe(true);
    });
  });

  describe('Section 7(4) Branch Registration & Receipt Header', () => {
    it('formats compliant statutory header for Gopalpura branch', () => {
      const header = formatReceiptStatutoryHeader({
        name: 'ShikshaSetu Jaipur Gopalpura',
        branchCode: 'JPR-GPL',
        registrationNo: 'RJ-COACH-2025-0412',
        gstin: '08AAAAA0000A1Z5',
        address: 'B-12 Gopalpura Bypass, Jaipur, Rajasthan 302018',
      });

      expect(header.branchCode).toBe('JPR-GPL');
      expect(header.registrationNo).toBe('RJ-COACH-2025-0412');
      expect(header.sacCode).toBe('999293');
      expect(header.gstin).toBe('08AAAAA0000A1Z5');
    });
  });
});
