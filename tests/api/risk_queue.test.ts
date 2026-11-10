// tests/api/risk_queue.test.ts
// TC-11: AI Guardrails & Offline Fallback for Dropout Risk Queue

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { calculateDropoutRiskScore, generateTemplateGuide } from '@/src/domain/riskScore';
import { GET as riskQueueGet } from '@/app/api/admin/refunds/risk-queue/route';

describe('TC-11: Dropout Risk Scoring & AI Guardrails', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('STU-0587 receives exact deterministic dropout risk score of 79 HIGH (F=32, A=28, S=19)', () => {
    // STU-0587:
    // 23 days overdue on Inst 3 (part-paid 15k)
    // Attendance dropped from 88% to 69% (19% drop)
    // Test scores dropped from 78 to 59 (19 point drop)
    const result = calculateDropoutRiskScore({
      worstOverdueDays: 23,
      isPartPaid: true,
      attendancePercent: 69,
      prevAttendancePercent: 88,
      testOldPercentile: 78,
      testNewPercentile: 59,
    });

    expect(result.score).toBe(79);
    expect(result.severity).toBe('HIGH');
    expect(result.factors.fScore).toBe(32);
    expect(result.factors.aScore).toBe(28);
    expect(result.factors.sScore).toBe(19);
  });

  it('Offline fallback template guide provides structured guidance when external AI is offline', () => {
    const factors = { fScore: 32, aScore: 28, sScore: 19 };
    const guide = generateTemplateGuide(factors, 23, 'HIGH');
    expect(guide.pointsEn).toHaveLength(3);
    expect(guide.pointsHi).toHaveLength(3);
    expect(guide.templateUsed).toBe(true);
  });

  it('GET /api/admin/refunds/risk-queue returns high-risk students including STU-0587', async () => {
    const req = new Request('http://localhost:3000/api/admin/refunds/risk-queue', {
      headers: {
        'x-demo-role': 'COUNSELLOR',
        'x-demo-user-id': 'usr-cns-01',
      },
    });

    const res = await riskQueueGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    const stu0587Item = data.items.find((i: any) => i.studentCode === 'STU-0587');
    expect(stu0587Item).toBeDefined();
    expect(stu0587Item.score).toBe(79);
    expect(stu0587Item.compositeScore).toBe(79);
    expect(stu0587Item.financialScore).toBe(32);
    expect(stu0587Item.attendanceScore).toBe(28);
    expect(stu0587Item.academicScore).toBe(19);
    expect(stu0587Item.severity).toBe('HIGH');
    expect(stu0587Item.status).toBe('NEEDS_INTERVENTION');
    expect(stu0587Item.components.financialOverdueScore).toBe(32);
    expect(stu0587Item.components.attendanceDropScore).toBe(28);
    expect(stu0587Item.components.academicScoreDrop).toBe(19);
  });

  it('Repository contract provides getReceipts() returning all receipts', () => {
    const repo = getRepository();
    const receipts = repo.getReceipts();
    expect(Array.isArray(receipts)).toBe(true);
    expect(receipts.length).toBeGreaterThan(0);
  });
});
