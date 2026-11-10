import { describe, it, expect } from 'vitest';
import {
  calculateDropoutRiskScore,
  computeFeeFactor,
  computeAttendanceFactor,
  computeTestSlopeFactor,
  calculateFalseFlagSuppressionDate,
  isRiskFlagSuppressed,
} from '../../src/domain/riskScore';

describe('TC-05: Deterministic Dropout Risk Scorer', () => {
  it('strictly produces composite score 79 (HIGH) for canonical student STU-0587', () => {
    const input = {
      worstOverdueDays: 23,
      isPartPaid: true,
      attendancePercent: 69,
      prevAttendancePercent: 88,
      testOldPercentile: 78,
      testNewPercentile: 59,
    };

    const res = calculateDropoutRiskScore(input);

    expect(res.factors.fScore).toBe(32);
    expect(res.factors.aScore).toBe(28);
    expect(res.factors.sScore).toBe(19);
    expect(res.score).toBe(79);
    expect(res.severity).toBe('HIGH');
    expect(res.taskCreated).toBe(true);
    expect(res.fScore).toBe(32);
    expect(res.aScore).toBe(28);
    expect(res.sScore).toBe(19);

    // Guide and rationale verification
    expect(res.guide.pointsEn).toHaveLength(3);
    expect(res.guide.pointsHi).toHaveLength(3);
    expect(res.guide.templateUsed).toBe(true);
    expect(res.rationaleEn).toContain('79/100 (HIGH)');
    expect(res.rationaleHi).toContain('79/100 (उच्च)');
  });

  describe('Factor F: Fee Delinquency Boundaries [0..40]', () => {
    it('evaluates d = 0 without part-pay to 0', () => {
      expect(computeFeeFactor(0, false)).toBe(0);
    });

    it('evaluates d = 0 with part-pay to 5', () => {
      expect(computeFeeFactor(0, true)).toBe(5);
    });

    it('evaluates d = 23 with part-pay to exactly 32 (STU-0587 case)', () => {
      // 35 * 23 / 30 = 805 / 30 = 26.833... -> round half up = 27
      // 27 + 5 = 32
      expect(computeFeeFactor(23, true)).toBe(32);
    });

    it('evaluates d = 30 without part-pay to 35', () => {
      expect(computeFeeFactor(30, false)).toBe(35);
    });

    it('evaluates d = 45 (beyond 30 days) capped at 35 without part-pay', () => {
      expect(computeFeeFactor(45, false)).toBe(35);
    });

    it('evaluates d = 45 with part-pay capped at maximum 40', () => {
      expect(computeFeeFactor(45, true)).toBe(40);
    });
  });

  describe('Factor A: Attendance Boundaries [0..35]', () => {
    it('evaluates attendance >= 80% with no drop to 0', () => {
      expect(computeAttendanceFactor(80, 80)).toBe(0);
      expect(computeAttendanceFactor(92, 90)).toBe(0);
    });

    it('evaluates attendance <= 65% with no drop to 25', () => {
      expect(computeAttendanceFactor(65, 65)).toBe(25);
      expect(computeAttendanceFactor(50, 50)).toBe(25);
    });

    it('evaluates attendance = 69% with prev = 88% to exactly 28 (STU-0587 case)', () => {
      // baseA = round(25 * (80 - 69) / 15) = round(275 / 15) = 18
      // drop = 88 - 69 = 19 > 10 => +10 penalty
      // total = 18 + 10 = 28
      expect(computeAttendanceFactor(69, 88)).toBe(28);
    });

    it('applies drop penalty only when drop is strictly greater than 10 points', () => {
      // Drop of exactly 10 points: 80 -> 70 (no penalty)
      // baseA for 70: round(25 * 10 / 15) = 17
      expect(computeAttendanceFactor(70, 80)).toBe(17);

      // Drop of 11 points: 81 -> 70 (+10 penalty)
      // total = 17 + 10 = 27
      expect(computeAttendanceFactor(70, 81)).toBe(27);
    });

    it('caps Factor A at 35 even with extreme dip', () => {
      // 50% attendance with drop from 95% -> baseA = 25 + dropPenalty = 10 -> 35
      expect(computeAttendanceFactor(50, 95)).toBe(35);
    });
  });

  describe('Factor S: Test Score Trajectory Boundaries [0..25]', () => {
    it('evaluates improving or flat performance to 0', () => {
      expect(computeTestSlopeFactor(70, 85)).toBe(0);
      expect(computeTestSlopeFactor(75, 75)).toBe(0);
    });

    it('evaluates drop of 19 points to exactly 19 (STU-0587 case)', () => {
      expect(computeTestSlopeFactor(78, 59)).toBe(19);
    });

    it('caps Factor S at 25 for drops exceeding 25 points', () => {
      expect(computeTestSlopeFactor(90, 50)).toBe(25);
    });
  });

  describe('Threshold Transitions: Severity & Tasks', () => {
    it('marks score 49 as LOW and taskCreated = false', () => {
      // F = 20, A = 15, S = 14 => 49
      const res = calculateDropoutRiskScore({
        worstOverdueDays: 17, // baseF = 20
        isPartPaid: false,
        attendancePercent: 71, // baseA = 15, prev = 71
        prevAttendancePercent: 71,
        testOldPercentile: 70,
        testNewPercentile: 56, // drop = 14
      });
      expect(res.score).toBe(49);
      expect(res.severity).toBe('LOW');
      expect(res.taskCreated).toBe(false);
    });

    it('marks score 50 as MEDIUM and taskCreated = true', () => {
      const res = calculateDropoutRiskScore({
        worstOverdueDays: 17, // baseF = 20
        isPartPaid: false,
        attendancePercent: 71, // baseA = 15
        prevAttendancePercent: 71,
        testOldPercentile: 70,
        testNewPercentile: 55, // drop = 15
      });
      expect(res.score).toBe(50);
      expect(res.severity).toBe('MEDIUM');
      expect(res.taskCreated).toBe(true);
    });

    it('marks score 69 as MEDIUM and score 70 as HIGH', () => {
      const res69 = calculateDropoutRiskScore({
        worstOverdueDays: 20, // 23
        isPartPaid: true, // +5 => 28
        attendancePercent: 68, // baseA = 20
        prevAttendancePercent: 68,
        testOldPercentile: 70,
        testNewPercentile: 49, // drop = 21
      });
      expect(res69.score).toBe(69);
      expect(res69.severity).toBe('MEDIUM');

      const res70 = calculateDropoutRiskScore({
        worstOverdueDays: 20, // 23
        isPartPaid: true, // +5 => 28
        attendancePercent: 68, // baseA = 20
        prevAttendancePercent: 68,
        testOldPercentile: 70,
        testNewPercentile: 48, // drop = 22
      });
      expect(res70.score).toBe(70);
      expect(res70.severity).toBe('HIGH');
    });
  });

  describe('14-Day False-Flag Hold Logic', () => {
    it('sets suppression hold window exactly 14 calendar days from dismissal', () => {
      const dismissedAt = new Date('2026-11-02T10:00:00Z');
      const suppressedUntil = calculateFalseFlagSuppressionDate(dismissedAt, 14);

      expect(suppressedUntil.toISOString().slice(0, 10)).toBe('2026-11-16');

      // Before expiry: suppressed
      const duringHold = new Date('2026-11-10T10:00:00Z');
      expect(isRiskFlagSuppressed(duringHold, suppressedUntil)).toBe(true);

      // After expiry: not suppressed
      const afterHold = new Date('2026-11-17T10:00:00Z');
      expect(isRiskFlagSuppressed(afterHold, suppressedUntil)).toBe(false);
    });

    it('returns false for null suppression date', () => {
      expect(isRiskFlagSuppressed(new Date(), null)).toBe(false);
    });
  });
});
