/**
 * Unmatched Payment Queue Logic & Reconciliation Engine
 * File: src/domain/unmatched.ts
 *
 * Operational Rules:
 * - Holding queue for ambiguous, unreferenced, or orphaned electronic bank transfers.
 * - Unmatched payments NEVER touch student fee balances, alter ledgers, or increment receipt numbers.
 * - 4 Statutory Reason Codes:
 *     1. NO_REFERENCE: Missing, empty, or unresolvable gateway payment/order ID or bank UTR reference.
 *     2. UNKNOWN_STUDENT: Student identifier cannot be found in active student records, or student is withdrawn.
 *     3. CANCELLED_INSTALMENT: Payment targets an instalment marked CANCELLED_ON_REFUND or inactive.
 *     4. NO_OPEN_DUES: Student has zero outstanding balance, or target instalment is already fully paid.
 * - Resolution Workflow:
 *     An Accounts Executive can resolve the payment by manually binding it to a verified student and instalment.
 *     Resolution executes atomic allocation, updates the ledger, advances the receipt counter, and suppresses reminders.
 * - Multi-Instalment Spill-Over:
 *     Payments satisfy the primary target instalment first, and any surplus spills over to open instalments in sequence.
 */

export type UnmatchedReasonCode =
  | 'NO_REFERENCE'
  | 'UNKNOWN_STUDENT'
  | 'CANCELLED_INSTALMENT'
  | 'NO_OPEN_DUES';

export type PaymentMatchStatus = 'MATCHED' | 'UNMATCHED_QUEUE' | 'RESOLVED' | 'REJECTED';

export interface PaymentMatchEvaluationInput {
  hasReference: boolean;
  studentExists: boolean;
  isStudentWithdrawn?: boolean;
  targetInstalmentExists: boolean;
  isTargetInstalmentCancelled: boolean;
  hasOpenDues: boolean;
  openDuesBalancePaise: bigint;
  paymentAmountPaise: bigint;
}

export interface MatchEvaluationResult {
  canMatch: boolean;
  status: PaymentMatchStatus;
  reasonCode?: UnmatchedReasonCode;
  detail?: string;
}

/**
 * Pure evaluation function for classifying incoming electronic payments.
 */
export function evaluateIncomingPaymentMatch(
  input: PaymentMatchEvaluationInput
): MatchEvaluationResult {
  if (!input.hasReference) {
    return {
      canMatch: false,
      status: 'UNMATCHED_QUEUE',
      reasonCode: 'NO_REFERENCE',
      detail: 'Missing or empty gateway transaction ID / bank UTR reference.',
    };
  }

  if (!input.studentExists || input.isStudentWithdrawn) {
    return {
      canMatch: false,
      status: 'UNMATCHED_QUEUE',
      reasonCode: 'UNKNOWN_STUDENT',
      detail: input.isStudentWithdrawn
        ? 'Student record is withdrawn from the coaching program.'
        : 'Student identifier does not match any enrolled student record.',
    };
  }

  if (!input.targetInstalmentExists || input.isTargetInstalmentCancelled) {
    return {
      canMatch: false,
      status: 'UNMATCHED_QUEUE',
      reasonCode: 'CANCELLED_INSTALMENT',
      detail: 'Target instalment does not exist or has been cancelled on refund.',
    };
  }

  if (!input.hasOpenDues || input.openDuesBalancePaise <= 0n) {
    return {
      canMatch: false,
      status: 'UNMATCHED_QUEUE',
      reasonCode: 'NO_OPEN_DUES',
      detail: 'Student has zero open fee balance to satisfy.',
    };
  }

  return {
    canMatch: true,
    status: 'MATCHED',
  };
}

export interface OpenInstalmentAllocationInput {
  id: string;
  instalmentNumber?: number;
  amountDuePaise: bigint;
  amountPaidPaise: bigint;
}

export interface InstalmentAllocationItem {
  instalmentId: string;
  allocatedPaise: bigint;
  isFullyPaid: boolean;
  remainingDuePaise: bigint;
}

export interface PaymentAllocationResult {
  allocations: InstalmentAllocationItem[];
  totalAllocatedPaise: bigint;
  unallocatedPaise: bigint;
}

/**
 * Pure payment allocation function.
 * Allocates payment to target instalment first; any remaining amount spills over
 * to subsequent open instalments in order.
 */
export function allocatePaymentAcrossInstalments(
  amountPaise: bigint,
  targetInstalmentId: string,
  openInstalments: OpenInstalmentAllocationInput[]
): PaymentAllocationResult {
  if (amountPaise <= 0n) {
    return {
      allocations: [],
      totalAllocatedPaise: 0n,
      unallocatedPaise: 0n,
    };
  }

  let remaining = amountPaise;
  let totalAllocated = 0n;
  const allocations: InstalmentAllocationItem[] = [];

  // Sort: target instalment first, followed by others in order
  const sorted = [...openInstalments].sort((a, b) => {
    if (a.id === targetInstalmentId) return -1;
    if (b.id === targetInstalmentId) return 1;
    if (a.instalmentNumber !== undefined && b.instalmentNumber !== undefined) {
      return a.instalmentNumber - b.instalmentNumber;
    }
    return 0;
  });

  for (const inst of sorted) {
    if (remaining <= 0n) break;
    const openDue = inst.amountDuePaise - inst.amountPaidPaise;
    if (openDue <= 0n) continue;

    const toAllocate = remaining >= openDue ? openDue : remaining;
    remaining -= toAllocate;
    totalAllocated += toAllocate;

    const newPaid = inst.amountPaidPaise + toAllocate;
    const isFullyPaid = newPaid >= inst.amountDuePaise;
    const remainingDue = inst.amountDuePaise > newPaid ? inst.amountDuePaise - newPaid : 0n;

    allocations.push({
      instalmentId: inst.id,
      allocatedPaise: toAllocate,
      isFullyPaid,
      remainingDuePaise: remainingDue,
    });
  }

  return {
    allocations,
    totalAllocatedPaise: totalAllocated,
    unallocatedPaise: remaining,
  };
}
