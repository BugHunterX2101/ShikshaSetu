import { describe, it, expect } from 'vitest';
import {
  evaluateIncomingPaymentMatch,
  allocatePaymentAcrossInstalments,
} from '../../src/domain/unmatched';

describe('TC-08: Unmatched Payment Queue Logic & Reconciliation', () => {
  const baseValidInput = {
    hasReference: true,
    studentExists: true,
    isStudentWithdrawn: false,
    targetInstalmentExists: true,
    isTargetInstalmentCancelled: false,
    hasOpenDues: true,
    openDuesBalancePaise: 3000000n,
    paymentAmountPaise: 3000000n,
  };

  it('classifies valid payment as MATCHED', () => {
    const res = evaluateIncomingPaymentMatch(baseValidInput);
    expect(res.canMatch).toBe(true);
    expect(res.status).toBe('MATCHED');
    expect(res.reasonCode).toBeUndefined();
  });

  describe('4 Statutory Reason Codes', () => {
    it('Reason Code 1: NO_REFERENCE when gateway or bank reference is missing', () => {
      const res = evaluateIncomingPaymentMatch({
        ...baseValidInput,
        hasReference: false,
      });
      expect(res.canMatch).toBe(false);
      expect(res.status).toBe('UNMATCHED_QUEUE');
      expect(res.reasonCode).toBe('NO_REFERENCE');
      expect(res.detail).toContain('Missing or empty gateway transaction ID');
    });

    it('Reason Code 2: UNKNOWN_STUDENT when student is not found or is withdrawn', () => {
      // Non-existent student
      const resNotFound = evaluateIncomingPaymentMatch({
        ...baseValidInput,
        studentExists: false,
      });
      expect(resNotFound.canMatch).toBe(false);
      expect(resNotFound.status).toBe('UNMATCHED_QUEUE');
      expect(resNotFound.reasonCode).toBe('UNKNOWN_STUDENT');

      // Withdrawn student
      const resWithdrawn = evaluateIncomingPaymentMatch({
        ...baseValidInput,
        studentExists: true,
        isStudentWithdrawn: true,
      });
      expect(resWithdrawn.canMatch).toBe(false);
      expect(resWithdrawn.reasonCode).toBe('UNKNOWN_STUDENT');
      expect(resWithdrawn.detail).toContain('withdrawn');
    });

    it('Reason Code 3: CANCELLED_INSTALMENT when instalment is cancelled on refund', () => {
      const res = evaluateIncomingPaymentMatch({
        ...baseValidInput,
        isTargetInstalmentCancelled: true,
      });
      expect(res.canMatch).toBe(false);
      expect(res.status).toBe('UNMATCHED_QUEUE');
      expect(res.reasonCode).toBe('CANCELLED_INSTALMENT');
    });

    it('Reason Code 4: NO_OPEN_DUES when student has zero remaining balance', () => {
      const res = evaluateIncomingPaymentMatch({
        ...baseValidInput,
        hasOpenDues: false,
        openDuesBalancePaise: 0n,
      });
      expect(res.canMatch).toBe(false);
      expect(res.status).toBe('UNMATCHED_QUEUE');
      expect(res.reasonCode).toBe('NO_OPEN_DUES');
    });
  });

  describe('Payment Allocation & Multi-Instalment Spill-Over', () => {
    const openInstalments = [
      { id: 'inst_3', instalmentNumber: 3, amountDuePaise: 3000000n, amountPaidPaise: 0n },
      { id: 'inst_4', instalmentNumber: 4, amountDuePaise: 3000000n, amountPaidPaise: 0n },
    ];

    it('allocates payment to target instalment first', () => {
      const res = allocatePaymentAcrossInstalments(3000000n, 'inst_3', openInstalments);
      expect(res.allocations).toHaveLength(1);
      expect(res.allocations[0].instalmentId).toBe('inst_3');
      expect(res.allocations[0].allocatedPaise).toBe(3000000n);
      expect(res.allocations[0].isFullyPaid).toBe(true);
      expect(res.allocations[0].remainingDuePaise).toBe(0n);
      expect(res.unallocatedPaise).toBe(0n);
    });

    it('spills surplus payment over to subsequent instalment in sequence', () => {
      // Payment of ₹45,000 against inst_3 (₹30,000 due): satisfies inst_3 and puts ₹15,000 on inst_4
      const res = allocatePaymentAcrossInstalments(4500000n, 'inst_3', openInstalments);
      expect(res.allocations).toHaveLength(2);

      // Inst 3 fully paid
      expect(res.allocations[0].instalmentId).toBe('inst_3');
      expect(res.allocations[0].allocatedPaise).toBe(3000000n);
      expect(res.allocations[0].isFullyPaid).toBe(true);

      // Inst 4 partially paid with remainder
      expect(res.allocations[1].instalmentId).toBe('inst_4');
      expect(res.allocations[1].allocatedPaise).toBe(1500000n);
      expect(res.allocations[1].isFullyPaid).toBe(false);
      expect(res.allocations[1].remainingDuePaise).toBe(1500000n);

      expect(res.totalAllocatedPaise).toBe(4500000n);
      expect(res.unallocatedPaise).toBe(0n);
    });

    it('records unallocated excess when payment exceeds all remaining dues', () => {
      // Payment of ₹70,000 when only ₹60,000 total open across inst_3 and inst_4
      const res = allocatePaymentAcrossInstalments(7000000n, 'inst_3', openInstalments);
      expect(res.totalAllocatedPaise).toBe(6000000n);
      expect(res.unallocatedPaise).toBe(1000000n); // ₹10,000 unallocated
    });
  });
});
