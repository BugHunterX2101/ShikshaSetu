/**
 * Rajasthan Coaching Centres (Control and Regulation) Act, 2025 Compliance Engine
 * File: src/domain/rajasthanAct.ts
 *
 * Statutory References:
 * - Section 6(2)(d): Coaching centres must offer students/parents a fee payment plan of at least
 *   four equal instalments across the academic duration.
 * - Section 13(1): Official receipt with statutory details must be issued for every fee collection.
 * - Section 13(4): Pro-rata refund of fee for the remaining period within 10 calendar days.
 * - Section 13(5): Prohibition of mid-course fee hikes. A fee plan cannot be increased after enrolment.
 * - Section 7(4): Separate registration for each branch/centre; registration number must be displayed
 *   on all statutory receipts and invoices.
 */

export interface InstalmentPlanItem {
  instalmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  amountPaise: bigint;
}

export interface FeePlanValidationInput {
  totalFeePaise: bigint;
  instalments: InstalmentPlanItem[];
}

export interface FeePlanValidationResult {
  valid: boolean;
  code?: 'LESS_THAN_FOUR_INSTALMENTS' | 'INSTALMENTS_NOT_EQUAL' | 'SUM_MISMATCH' | 'INVALID_TOTAL_FEE';
  message?: string;
  expectedInstalments?: InstalmentPlanItem[];
}

export interface CentreRegistrationDetails {
  name: string;
  branchCode: string;
  registrationNo: string;
  gstin: string;
  address: string;
}

export interface ReceiptStatutoryHeader {
  centreName: string;
  branchCode: string;
  registrationNo: string; // Rajasthan Coaching Act s.7(4)
  gstin: string;
  address: string;
  sacCode: string; // '999293'
}

/**
 * Validates a batch fee plan against Rajasthan Coaching Act 2025 Section 6(2)(d).
 * Rules:
 * 1. Plan must offer at least 4 instalments (count >= 4).
 * 2. Remainder paise from integer division must be absorbed into the final instalment.
 * 3. The first N-1 instalments must strictly equal floor(totalFee / N).
 * 4. The N-th instalment must strictly equal floor(totalFee / N) + (totalFee % N).
 * 5. Sum of instalments must exactly match totalFeePaise.
 */
export function validateFeePlan(input: FeePlanValidationInput): FeePlanValidationResult {
  const { totalFeePaise, instalments } = input;

  if (totalFeePaise <= 0n) {
    return {
      valid: false,
      code: 'INVALID_TOTAL_FEE',
      message: 'Total fee must be strictly greater than zero.',
    };
  }

  if (instalments.length < 4) {
    return {
      valid: false,
      code: 'LESS_THAN_FOUR_INSTALMENTS',
      message:
        'Rajasthan Coaching Act 2025 s.6(2)(d) requires batches to offer at least 4 equal instalments.',
    };
  }

  const n = BigInt(instalments.length);
  const baseAmount = totalFeePaise / n;
  const remainder = totalFeePaise % n;

  let sum = 0n;
  for (let i = 0; i < instalments.length; i++) {
    const inst = instalments[i];
    sum += inst.amountPaise;
    const isLast = i === instalments.length - 1;
    const expected = isLast ? baseAmount + remainder : baseAmount;

    if (inst.amountPaise !== expected) {
      const expectedRupees = (Number(expected) / 100).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      });
      const actualRupees = (Number(inst.amountPaise) / 100).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      });

      return {
        valid: false,
        code: 'INSTALMENTS_NOT_EQUAL',
        message: `Instalment ${inst.instalmentNumber} amount ₹${actualRupees} does not match statutory equal instalment value ₹${expectedRupees} (Rajasthan Act s.6(2)(d)).`,
      };
    }
  }

  if (sum !== totalFeePaise) {
    return {
      valid: false,
      code: 'SUM_MISMATCH',
      message: `Sum of instalments (${sum} paise) does not match total fee (${totalFeePaise} paise).`,
    };
  }

  return { valid: true };
}

/**
 * Generates a statutorily compliant equal instalment schedule for a batch.
 * Formula:
 * - N instalments
 * - First N-1 instalments = floor(T / N)
 * - N-th instalment = floor(T / N) + (T % N)
 */
export function generateCompliantInstalments(
  totalFeePaise: bigint,
  count: number,
  startDueDate: string,
  intervalMonths = 3
): InstalmentPlanItem[] {
  if (count < 4) {
    throw new RangeError(
      'Statutory non-compliance: count must be 4 or greater (Rajasthan Coaching Act s.6(2)(d)).'
    );
  }

  const n = BigInt(count);
  const base = totalFeePaise / n;
  const rem = totalFeePaise % n;

  const result: InstalmentPlanItem[] = [];
  const [startY, startM, startD] = startDueDate.split('-').map(Number);

  for (let i = 0; i < count; i++) {
    const targetMonth = startM - 1 + i * intervalMonths;
    const date = new Date(Date.UTC(startY, targetMonth, startD));
    const dueDate = date.toISOString().slice(0, 10);
    const amountPaise = i === count - 1 ? base + rem : base;

    result.push({
      instalmentNumber: i + 1,
      dueDate,
      amountPaise,
    });
  }

  return result;
}

/**
 * Section 13(5) Guard: Prohibits mid-course fee hikes
 */
export function validateFeeAdjustment(
  enrolledFeePaise: bigint,
  proposedFeePaise: bigint,
  isDirectorApproved: boolean
): { allowed: boolean; reason?: string } {
  if (proposedFeePaise > enrolledFeePaise) {
    return {
      allowed: false,
      reason:
        'Rajasthan Coaching Act s.13(5) strictly prohibits increasing course fees after enrolment.',
    };
  }
  if (proposedFeePaise < enrolledFeePaise && !isDirectorApproved) {
    return {
      allowed: false,
      reason: 'Fee reductions or concessions after enrolment require audited Director approval.',
    };
  }
  return { allowed: true };
}

/**
 * Section 7(4) and Section 13(1) Receipt Statutory Header Formatter
 */
export function formatReceiptStatutoryHeader(
  centre: CentreRegistrationDetails
): ReceiptStatutoryHeader {
  return {
    centreName: centre.name,
    branchCode: centre.branchCode,
    registrationNo: centre.registrationNo,
    gstin: centre.gstin,
    address: centre.address,
    sacCode: '999293',
  };
}
