import { describe, it, expect } from 'vitest';
import {
  generateReminderCadence,
  evaluatePaymentReminderSuppression,
  isInsideQuietPeriod,
  formatReminderMessage,
} from '../../src/domain/reminders';

describe('TC-04 & TC-07: Reminder Cadence & Auto-Suppression State Engine', () => {
  it('generates exact 5-point reminder cadence for an instalment', () => {
    const dueDate = '2026-11-15';
    const cadence = generateReminderCadence(dueDate);

    expect(cadence).toHaveLength(5);
    expect(cadence[0]).toEqual({
      triggerType: 'T_MINUS_7',
      offsetDays: -7,
      scheduledDate: '2026-11-08',
    });
    expect(cadence[1]).toEqual({
      triggerType: 'T_ZERO',
      offsetDays: 0,
      scheduledDate: '2026-11-15',
    });
    expect(cadence[2]).toEqual({
      triggerType: 'T_PLUS_3',
      offsetDays: 3,
      scheduledDate: '2026-11-18',
    });
    expect(cadence[3]).toEqual({
      triggerType: 'T_PLUS_7',
      offsetDays: 7,
      scheduledDate: '2026-11-22',
    });
    expect(cadence[4]).toEqual({
      triggerType: 'T_PLUS_15',
      offsetDays: 15,
      scheduledDate: '2026-11-30',
    });
  });

  describe('Payment Suppression Logic', () => {
    it('suppresses reminders on full payment with reason PAID_IN_FULL', () => {
      const res = evaluatePaymentReminderSuppression(3000000n, 3000000n, 'pay_full_123');
      expect(res.shouldSuppress).toBe(true);
      expect(res.reason).toBe('PAID_IN_FULL');
      expect(res.suppressPaymentId).toBe('pay_full_123');
      expect(res.suppressedAt).toBeDefined();
    });

    it('does NOT suppress reminders on part-payment', () => {
      const res = evaluatePaymentReminderSuppression(3000000n, 1500000n, 'pay_part_123');
      expect(res.shouldSuppress).toBe(false);
      expect(res.reason).toBeUndefined();
    });
  });

  describe('24-Hour Quiet Period Logic', () => {
    it('enforces quiet period within 24 hours of recent payment', () => {
      const lastPayment = '2026-11-02T14:00:00Z';

      // 20 hours later: within quiet period
      const check20h = isInsideQuietPeriod(lastPayment, '2026-11-03T10:00:00Z', 24);
      expect(check20h).toBe(true);

      // 26 hours later: quiet period expired, dispatch allowed
      const check26h = isInsideQuietPeriod(lastPayment, '2026-11-03T16:00:00Z', 24);
      expect(check26h).toBe(false);
    });

    it('returns false when student has no prior payment history', () => {
      expect(isInsideQuietPeriod(null, '2026-11-03T10:00:00Z')).toBe(false);
    });
  });

  describe('Dynamic Send-Time Balance Formatting', () => {
    it('formats Hindi and English messages for part-paid overdue balance (STU-0587 case)', () => {
      const hi = formatReminderMessage(1500000n, 23, true, 'hi');
      expect(hi.body).toBe('शुल्क शेष ₹15,000 — आंशिक भुगतान, 23 दिन अतिदेय');
      expect(hi.subject).toContain('शिक्षासेतु');

      const en = formatReminderMessage(1500000n, 23, true, 'en');
      expect(en.body).toBe('Fee balance ₹15,000 — Part paid, 23 days overdue');
      expect(en.subject).toContain('ShikshaSetu');
    });

    it('formats message for due today', () => {
      const hi = formatReminderMessage(3000000n, 0, false, 'hi');
      expect(hi.body).toBe('शुल्क शेष ₹30,000 — आज देय');

      const en = formatReminderMessage(3000000n, 0, false, 'en');
      expect(en.body).toBe('Fee balance ₹30,000 — Due today');
    });

    it('formats message for upcoming balance (STU-0219 case: 13 days until due)', () => {
      const hi = formatReminderMessage(4000000n, -13, false, 'hi');
      expect(hi.body).toBe('शुल्क शेष ₹40,000 — 13 दिन में देय');

      const en = formatReminderMessage(4000000n, -13, false, 'en');
      expect(en.body).toBe('Fee balance ₹40,000 — Due in 13 days');
    });
  });
});
