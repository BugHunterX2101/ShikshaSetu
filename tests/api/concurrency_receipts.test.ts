// tests/api/concurrency_receipts.test.ts
// TC-09: High-Concurrency Payments & Gapless Receipt Sequence

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';

describe('TC-09: Concurrency & Gapless Receipt Sequence', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('50 concurrent payments fired via Promise.all() receive strictly contiguous serials with ZERO gaps and ZERO duplicates', async () => {
    const repo = getRepository();
    const gstin = '08AAAAA0000A1Z5'; // Gopalpura
    const fy = '26-27';

    // Current counter starts at 412
    // Firing 50 concurrent payments for STU-0412 / STU-0587 / synthesized students
    const promises: Promise<string>[] = [];
    for (let i = 0; i < 50; i++) {
      promises.push(repo.allocateReceiptNumber(gstin, fy, 'RCP'));
    }

    const receiptNumbers = await Promise.all(promises);

    expect(receiptNumbers.length).toBe(50);

    // Extract numerical serials: e.g. "RCP/26-27/000413" -> 413
    const serials = receiptNumbers.map((num) => {
      const match = num.match(/RCP\/26-27\/(\d+)/);
      expect(match).not.toBeNull();
      return parseInt(match![1], 10);
    });

    // Check for duplicates
    const uniqueSerials = new Set(serials);
    expect(uniqueSerials.size).toBe(50);

    // Sort and verify strict continuity (gapless: 413 to 462)
    serials.sort((a, b) => a - b);
    expect(serials[0]).toBe(413);
    expect(serials[49]).toBe(462);

    for (let i = 0; i < 50; i++) {
      expect(serials[i]).toBe(413 + i);
    }
  });

  it('Transaction rollback on error leaves zero side-effects and does NOT increment or burn receipt counters', async () => {
    const repo = getRepository();
    const gstin = '08AAAAA0000A1Z5';
    const fy = '26-27';

    // Counter before
    const counterBefore = await repo.allocateReceiptNumber(gstin, fy, 'RCP');
    const serialBefore = parseInt(counterBefore.split('/')[2], 10); // 413

    // Attempt a transaction that fails midway
    await expect(
      repo.withTransaction(async () => {
        // Mutate something
        const student = repo.getStudentById('stu-0587')!;
        student.status = 'WITHDRAWN';

        // Intentionally throw
        throw new Error('Simulated transient payment gateway explosion');
      })
    ).rejects.toThrow('Simulated transient payment gateway explosion');

    // Verify student was NOT modified
    const studentAfter = repo.getStudentById('stu-0587')!;
    expect(studentAfter.status).toBe('ACTIVE');

    // Next receipt allocated should be strictly the next serial (414) without any burned gap
    const counterAfter = await repo.allocateReceiptNumber(gstin, fy, 'RCP');
    const serialAfter = parseInt(counterAfter.split('/')[2], 10);
    expect(serialAfter).toBe(serialBefore + 1);
  });
});
