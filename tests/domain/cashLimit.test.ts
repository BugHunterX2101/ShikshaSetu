import { describe, it, expect } from 'vitest';
import {
  validateCashLimit,
  validateCashPayment,
  SECTION_269ST_LIMIT_PAISE,
  SECTION_269ST_MAX_ALLOWED_PAISE,
} from '../../src/domain/cashLimit';

describe('Section 269ST Income Tax Act Cash Limit Guard', () => {
  it('strictly blocks cash payment of exactly ₹2,00,000.00 (20,000,000 paise)', () => {
    const res = validateCashLimit({
      mode: 'CASH',
      amountPaise: 20000000n,
    });

    expect(res.allowed).toBe(false);
    expect(res.limitPaise).toBe(SECTION_269ST_LIMIT_PAISE);
    expect(res.attemptedPaise).toBe(20000000n);
    expect(res.error).toBeDefined();
    expect(res.error?.status).toBe(422);
    expect(res.error?.code).toBe('CASH_LIMIT_EXCEEDED');
    expect(res.error?.title).toBe('Section 269ST Cash Limit Exceeded');
    expect(res.error?.detail).toContain('prohibited under Section 269ST');
  });

  it('strictly blocks cash payment exceeding ₹2,00,000.00 (e.g. ₹2,50,000.00)', () => {
    const res = validateCashLimit({
      mode: 'CASH',
      amountPaise: 25000000n,
    });

    expect(res.allowed).toBe(false);
    expect(res.error?.status).toBe(422);
    expect(res.error?.code).toBe('CASH_LIMIT_EXCEEDED');
  });

  it('permits cash payment of statutory maximum allowed ₹1,99,999.00 (19,999,900 paise)', () => {
    const res = validateCashLimit({
      mode: 'CASH',
      amountPaise: SECTION_269ST_MAX_ALLOWED_PAISE,
    });

    expect(res.allowed).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.remainingAllowancePaise).toBe(100n); // 1 rupee remaining
  });

  it('permits normal cash payment of ₹30,000.00', () => {
    const res = validateCashLimit({
      mode: 'CASH',
      amountPaise: 3000000n,
    });

    expect(res.allowed).toBe(true);
    expect(res.remainingAllowancePaise).toBe(17000000n); // ₹1,70,000 remaining
  });

  it('enforces aggregate daily limit across multiple transactions from same person', () => {
    // Payer already paid ₹1,50,000 earlier today
    const priorCash = 15000000n;

    // Attempting ₹50,000 now hits ₹2,00,000 aggregate -> BLOCKED
    const blockedRes = validateCashLimit({
      mode: 'CASH',
      amountPaise: 5000000n,
      priorCashTodayPaise: priorCash,
    });
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.error?.code).toBe('CASH_LIMIT_EXCEEDED');

    // Attempting ₹49,999 leaves aggregate at ₹1,99,999 -> ALLOWED
    const allowedRes = validateCashLimit({
      mode: 'CASH',
      amountPaise: 4999900n,
      priorCashTodayPaise: priorCash,
    });
    expect(allowedRes.allowed).toBe(true);
    expect(allowedRes.cumulativeCashPaise).toBe(19999900n);
  });

  it('exempts non-cash payment modes from Section 269ST restrictions', () => {
    const nonCashModes = [
      'UPI',
      'NET_BANKING',
      'DEBIT_CARD',
      'CREDIT_CARD',
      'CHEQUE',
      'NEFT',
      'RTGS',
      'DEMAND_DRAFT',
    ] as const;

    for (const mode of nonCashModes) {
      const res = validateCashLimit({
        mode,
        amountPaise: 50000000n, // ₹5,00,000.00
      });
      expect(res.allowed).toBe(true);
      expect(res.error).toBeUndefined();
    }
  });

  it('rejects invalid payment amounts (<= 0 paise) with 422 Problem Details', () => {
    const zeroRes = validateCashLimit({
      mode: 'CASH',
      amountPaise: 0n,
    });
    expect(zeroRes.allowed).toBe(false);
    expect(zeroRes.error?.code).toBe('INVALID_AMOUNT');

    const negativeRes = validateCashLimit({
      mode: 'CASH',
      amountPaise: -500n,
    });
    expect(negativeRes.allowed).toBe(false);
    expect(negativeRes.error?.code).toBe('INVALID_AMOUNT');
  });

  it('supports validateCashPayment simplified contract from PROJECT.md', () => {
    const blocked = validateCashPayment(20000000n);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('prohibited under Section 269ST');

    const allowed = validateCashPayment(1500000n);
    expect(allowed.allowed).toBe(true);
  });
});
