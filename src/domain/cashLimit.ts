/**
 * Section 269ST Income Tax Act Cash Limit Guard
 * File: src/domain/cashLimit.ts
 *
 * Statutory Reference:
 * - Section 269ST of Income-tax Act 1961 (continued in Income-tax Act 2025):
 *   No person shall receive an amount of ₹2,00,000 or more:
 *     (a) in aggregate from a person in a day; or
 *     (b) in respect of a single transaction; or
 *     (c) in respect of transactions relating to one event or occasion from a person,
 *   otherwise than by an account payee cheque, bank draft or electronic clearing system.
 * - Section 271DA prescribes penalty equal to 100% of the cash received.
 * - Transactions >= ₹2,00,000 (20,000,000 paise) are blocked, returning RFC 9457 HTTP 422 Problem Details.
 * - Transactions <= ₹1,99,999.99 (up to 19,999,999 paise) are permitted.
 */

export const SECTION_269ST_LIMIT_PAISE = 20_000_000n; // ₹2,00,000.00 (200,000 * 100 paise)
export const SECTION_269ST_MAX_ALLOWED_PAISE = 19_999_900n; // ₹1,99,999.00

export type PaymentMode =
  | 'CASH'
  | 'UPI'
  | 'NET_BANKING'
  | 'NETBANKING'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'CARD'
  | 'CHEQUE'
  | 'NEFT'
  | 'RTGS'
  | 'BANK_TRANSFER'
  | 'DEMAND_DRAFT'
  | 'POS_CARD';

export interface CashLimitInput {
  mode: PaymentMode;
  amountPaise: bigint;
  priorCashTodayPaise?: bigint;
  studentId?: string;
  payerId?: string;
  paymentDate?: string; // YYYY-MM-DD
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: 422;
  detail: string;
  code: 'CASH_LIMIT_EXCEEDED' | 'INVALID_AMOUNT';
  invalidParams?: Array<{ name: string; reason: string }>;
}

export interface CashLimitValidationResult {
  allowed: boolean;
  mode: PaymentMode;
  limitPaise: bigint;
  attemptedPaise: bigint;
  priorCashTodayPaise: bigint;
  cumulativeCashPaise: bigint;
  remainingAllowancePaise: bigint;
  error?: ProblemDetails;
  reason?: string;
}

export interface CashLimitResult {
  allowed: boolean;
  limitPaise: bigint;
  attemptedPaise: bigint;
  reason?: string;
  error?: ProblemDetails;
}

export function isCashPayment(mode: PaymentMode): boolean {
  return mode === 'CASH';
}

/**
 * Validates whether a payment complies with Section 269ST cash limit.
 */
export function validateCashLimit(input: CashLimitInput): CashLimitValidationResult {
  const { mode, amountPaise, priorCashTodayPaise = 0n } = input;

  if (amountPaise <= 0n) {
    const error: ProblemDetails = {
      type: 'https://shikshasetu.example.in/errors/invalid-amount',
      title: 'Invalid Payment Amount',
      status: 422,
      detail: 'Payment amount must be strictly greater than zero.',
      code: 'INVALID_AMOUNT',
    };
    return {
      allowed: false,
      mode,
      limitPaise: SECTION_269ST_LIMIT_PAISE,
      attemptedPaise: amountPaise,
      priorCashTodayPaise,
      cumulativeCashPaise: priorCashTodayPaise + amountPaise,
      remainingAllowancePaise: 0n,
      error,
      reason: error.detail,
    };
  }

  // Non-cash payment modes are not restricted by Section 269ST
  if (!isCashPayment(mode)) {
    const remaining =
      SECTION_269ST_LIMIT_PAISE > priorCashTodayPaise
        ? SECTION_269ST_LIMIT_PAISE - priorCashTodayPaise
        : 0n;
    return {
      allowed: true,
      mode,
      limitPaise: SECTION_269ST_LIMIT_PAISE,
      attemptedPaise: amountPaise,
      priorCashTodayPaise,
      cumulativeCashPaise: priorCashTodayPaise,
      remainingAllowancePaise: remaining,
    };
  }

  const cumulativeCashPaise = priorCashTodayPaise + amountPaise;

  if (cumulativeCashPaise >= SECTION_269ST_LIMIT_PAISE) {
    const attemptedRupees = (Number(amountPaise) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
    });
    const priorRupees = (Number(priorCashTodayPaise) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
    });

    const excessPaise = cumulativeCashPaise - SECTION_269ST_LIMIT_PAISE;
    const detail = `Cash receipt of ₹2,00,000 or more from a person in a day or single transaction is prohibited under Section 269ST of the Income-tax Act. Attempted: ₹${attemptedRupees}, Prior cash today: ₹${priorRupees}.`;

    const error: ProblemDetails = {
      type: 'https://shikshasetu.example.in/errors/cash-limit-exceeded',
      title: 'Section 269ST Cash Limit Exceeded',
      status: 422,
      detail,
      code: 'CASH_LIMIT_EXCEEDED',
      invalidParams: [
        {
          name: 'amountPaise',
          reason: `Cash exceeds statutory ₹2,00,000 limit by ${excessPaise} paise`,
        },
      ],
    };

    return {
      allowed: false,
      mode,
      limitPaise: SECTION_269ST_LIMIT_PAISE,
      attemptedPaise: amountPaise,
      priorCashTodayPaise,
      cumulativeCashPaise,
      remainingAllowancePaise: 0n,
      error,
      reason: detail,
    };
  }

  return {
    allowed: true,
    mode,
    limitPaise: SECTION_269ST_LIMIT_PAISE,
    attemptedPaise: amountPaise,
    priorCashTodayPaise,
    cumulativeCashPaise,
    remainingAllowancePaise: SECTION_269ST_LIMIT_PAISE - cumulativeCashPaise,
  };
}

/**
 * Interface contract conforming to PROJECT.md § 2
 */
export function validateCashPayment(
  amountPaise: bigint,
  priorCashTodayPaise: bigint = 0n
): CashLimitResult {
  const result = validateCashLimit({
    mode: 'CASH',
    amountPaise,
    priorCashTodayPaise,
  });

  return {
    allowed: result.allowed,
    limitPaise: result.limitPaise,
    attemptedPaise: result.attemptedPaise,
    reason: result.reason,
    error: result.error,
  };
}
