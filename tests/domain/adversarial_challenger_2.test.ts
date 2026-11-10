import { describe, it, expect } from 'vitest';
import {
  calculateConsumedPaise,
  computeProRataRefund,
  computeProRataRefundFromDates,
  addCalendarDays,
  differenceInCalendarDays,
  RefundHeadInput,
} from '../../src/domain/refund';
import {
  calculateDropoutRiskScore,
  computeFeeFactor,
  computeAttendanceFactor,
  computeTestSlopeFactor,
  calculateFalseFlagSuppressionDate,
  isRiskFlagSuppressed,
  roundHalfUp,
  RiskInput,
} from '../../src/domain/riskScore';
import {
  generateReminderCadence,
  evaluatePaymentReminderSuppression,
  isInsideQuietPeriod,
  formatReminderMessage,
  ReminderItem,
} from '../../src/domain/reminders';
import {
  verifyAdultGuardianKyc,
  processConsentWithdrawal,
  evaluateDataRetention,
  getBilingualConsentNotice,
} from '../../src/domain/dpdp';
import {
  validateFeePlan,
  generateCompliantInstalments,
  validateFeeAdjustment,
  formatReceiptStatutoryHeader,
} from '../../src/domain/rajasthanAct';

describe('M1 CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE', () => {

  // =========================================================================
  // SECTION 1: MoE PRO-RATA REFUND ENGINE (refund.ts)
  // =========================================================================
  describe('1. MoE Pro-Rata Refund Adversarial Challenges', () => {
    const TUITION_120K = 12000000n;
    const HOSTEL_60K = 6000000n;
    const MESS_30K = 3000000n;
    const COURSE_DAYS_360 = 360;

    describe('1.1 Canonical Cases A through F Verification', () => {
      it('Case A: Full payer exits mid-course (e = 180, Paid = 120k, Net = 120k)', () => {
        const res = computeProRataRefund(
          '2026-10-01',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: TUITION_120K, courseDays: 360 }],
          180
        );
        expect(res.heads[0].consumedPaise).toBe(6000000n);
        expect(res.heads[0].refundablePaise).toBe(6000000n);
        expect(res.totalRefundablePaise).toBe(6000000n);
        expect(res.totalShortfallPaise).toBe(0n);
        expect(res.creditNoteRequired).toBe(true);
      });

      it('Case B: Instalment payer exits (e = 216, Paid = 90k, Net = 120k)', () => {
        const res = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 9000000n, courseDays: 360 }],
          216
        );
        expect(res.heads[0].consumedPaise).toBe(7200000n);
        expect(res.heads[0].refundablePaise).toBe(1800000n);
        expect(res.totalRefundablePaise).toBe(1800000n);
        expect(res.totalShortfallPaise).toBe(0n);
      });

      it('Case C: Part-paid student STU-0587 exits on 3 Nov (e = 216, Paid = 75k, Net = 120k)', () => {
        const res = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 7500000n, courseDays: 360 }],
          216
        );
        expect(res.heads[0].consumedPaise).toBe(7200000n);
        expect(res.heads[0].refundablePaise).toBe(300000n); // ₹3,000.00
        expect(res.totalRefundablePaise).toBe(300000n);
        expect(res.totalShortfallPaise).toBe(0n);
      });

      it('Case C on Demo Date 2 Nov 2026 (e = 215, Paid = 75k, Net = 120k)', () => {
        // e = 215: consumed = floor((2 * 12000000 * 215 + 360) / 720) = floor((5160000000 + 360) / 720) = 7166667
        // refund = 7500000 - 7166667 = 333333 paise (₹3,333.33)
        const res = computeProRataRefund(
          '2026-11-02',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 7500000n, courseDays: 360 }],
          215
        );
        expect(res.heads[0].consumedPaise).toBe(7166667n);
        expect(res.heads[0].refundablePaise).toBe(333333n);
        expect(res.totalRefundablePaise).toBe(333333n);
      });

      it('Case D: Pre-batch exit on Day 0 (e = 0, Paid = 30k, Net = 120k)', () => {
        const res = computeProRataRefund(
          '2026-04-01',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 3000000n, courseDays: 360 }],
          0
        );
        expect(res.heads[0].consumedPaise).toBe(0n);
        expect(res.heads[0].refundablePaise).toBe(3000000n); // 100% refund
        expect(res.totalRefundablePaise).toBe(3000000n);
        expect(res.totalShortfallPaise).toBe(0n);
      });

      it('Case E: Consumed exceeds paid (e = 216, Paid = 60k, Net = 120k)', () => {
        const res = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 6000000n, courseDays: 360 }],
          216
        );
        expect(res.heads[0].consumedPaise).toBe(7200000n);
        expect(res.heads[0].refundablePaise).toBe(0n); // Floored at 0
        expect(res.heads[0].shortfallPaise).toBe(1200000n); // ₹12,000 shortfall
        expect(res.totalRefundablePaise).toBe(0n);
        expect(res.totalShortfallPaise).toBe(1200000n);
        expect(res.creditNoteRequired).toBe(false);
      });

      it('Case F: Multi-head exit strictly proves zero cross-subsidization', () => {
        // Tuition: Paid 90k, Net 120k, e=216 -> Consumed 72k, Refund 18k, Shortfall 0
        // Hostel: Paid 30k, Net 60k, e=216 -> Consumed 36k, Refund 0, Shortfall 6k
        const res = computeProRataRefund(
          '2026-11-03',
          [
            { head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 9000000n, courseDays: 360 },
            { head: 'HOSTEL', netFeePaise: HOSTEL_60K, totalPaidPaise: 3000000n, courseDays: 360 },
          ],
          216
        );
        expect(res.heads[0].refundablePaise).toBe(1800000n);
        expect(res.heads[1].refundablePaise).toBe(0n);
        expect(res.heads[1].shortfallPaise).toBe(600000n);
        // CRUCIAL: total refund MUST be 18k, NEVER 12k (18k - 6k shortfall)
        expect(res.totalRefundablePaise).toBe(1800000n);
        expect(res.totalShortfallPaise).toBe(600000n);
      });
    });

    describe('1.2 Boundary Stress Testing & Invariants', () => {
      it('rejects courseDays <= 0 with RangeError', () => {
        expect(() => calculateConsumedPaise(100000n, 10, 0)).toThrow(RangeError);
        expect(() => calculateConsumedPaise(100000n, 10, -5)).toThrow(RangeError);
        expect(() =>
          computeProRataRefund('2026-10-01', [{ head: 'TUITION', netFeePaise: 100000n, totalPaidPaise: 50000n, courseDays: 0 }], 10)
        ).toThrow(RangeError);
      });

      it('rejects negative net fee with RangeError', () => {
        expect(() => calculateConsumedPaise(-5000n, 10, 360)).toThrow(RangeError);
      });

      it('clamps elapsed days beyond course length (e > T)', () => {
        // e = 500 on T = 360: should consume exactly 100% of net fee, not more
        const consumed = calculateConsumedPaise(TUITION_120K, 500, 360);
        expect(consumed).toBe(TUITION_120K);

        const res = computeProRataRefund(
          '2026-10-01',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: TUITION_120K, courseDays: 360 }],
          500
        );
        expect(res.heads[0].consumedPaise).toBe(TUITION_120K);
        expect(res.heads[0].refundablePaise).toBe(0n);
        expect(res.daysElapsed).toBe(360); // Clamped
      });

      it('clamps negative elapsed days (e < 0) to 0', () => {
        const consumed = calculateConsumedPaise(TUITION_120K, -25, 360);
        expect(consumed).toBe(0n);

        const res = computeProRataRefund(
          '2026-10-01',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 5000000n, courseDays: 360 }],
          -25
        );
        expect(res.heads[0].consumedPaise).toBe(0n);
        expect(res.heads[0].refundablePaise).toBe(5000000n);
        expect(res.daysElapsed).toBe(0);
      });

      it('handles zero paid amount gracefully (Paid = 0)', () => {
        const res = computeProRataRefund(
          '2026-10-01',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 0n, courseDays: 360 }],
          180
        );
        expect(res.heads[0].consumedPaise).toBe(6000000n);
        expect(res.heads[0].refundablePaise).toBe(0n);
        expect(res.heads[0].shortfallPaise).toBe(6000000n);
        expect(res.totalRefundablePaise).toBe(0n);
        expect(res.totalShortfallPaise).toBe(6000000n);
      });

      it('handles three heads with different course lengths and payments', () => {
        const res = computeProRataRefund(
          '2026-10-01',
          [
            { head: 'TUITION', netFeePaise: 12000000n, totalPaidPaise: 10000000n, courseDays: 360 }, // e=90: consumed = 30k, refund = 70k
            { head: 'HOSTEL', netFeePaise: 6000000n, totalPaidPaise: 2000000n, courseDays: 180 },   // e=90: consumed = 30k, refund = 0k, shortfall = 10k
            { head: 'MESS', netFeePaise: 3000000n, totalPaidPaise: 3000000n, courseDays: 90 },       // e=90: consumed = 30k (100%), refund = 0k, shortfall = 0k
          ],
          90
        );
        expect(res.heads[0].consumedPaise).toBe(3000000n);
        expect(res.heads[0].refundablePaise).toBe(7000000n);

        expect(res.heads[1].consumedPaise).toBe(3000000n);
        expect(res.heads[1].refundablePaise).toBe(0n);
        expect(res.heads[1].shortfallPaise).toBe(1000000n);

        expect(res.heads[2].consumedPaise).toBe(3000000n);
        expect(res.heads[2].refundablePaise).toBe(0n);
        expect(res.heads[2].shortfallPaise).toBe(0n);

        expect(res.totalRefundablePaise).toBe(7000000n); // 70k + 0 + 0 = 70k
        expect(res.totalShortfallPaise).toBe(1000000n);  // 0 + 10k + 0 = 10k
      });

      it('proves round-half-up integer division exactly matches real-number half-up rounding', () => {
        // Test 1000 arbitrary combinations of (N, e, T)
        for (let N = 1000n; N <= 100000n; N += 7391n) {
          for (let e = 1; e <= 360; e += 37) {
            for (let T = 30; T <= 360; T += 45) {
              const intResult = calculateConsumedPaise(N, e, T);
              const clampedE = Math.max(0, Math.min(e, T));
              const realRatio = (Number(N) * clampedE) / T;
              const expectedRound = BigInt(Math.floor(realRatio + 0.5));
              expect(intResult).toBe(expectedRound);
            }
          }
        }
      });
    });

    describe('1.3 Statutory 10-Calendar-Day SLA Clock Verification', () => {
      it('calculates statutory SLA deadline as receivedOn + 10 calendar days', () => {
        expect(addCalendarDays('2026-11-03', 10)).toBe('2026-11-13');
        expect(addCalendarDays('2026-02-20', 10)).toBe('2026-03-02'); // February leap check (2026 non-leap)
        expect(addCalendarDays('2026-12-25', 10)).toBe('2027-01-04'); // Year turnover
      });

      it('determines daysRemaining and overdue status accurately from asOfDate', () => {
        const res = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 9000000n, courseDays: 360 }],
          216,
          '2026-11-03' // asOfDate is receipt date
        );
        expect(res.slaDueDate).toBe('2026-11-13');
        expect(res.daysRemaining).toBe(10);
        expect(res.isOverdue).toBe(false);

        // Check 7 days later
        const res7Days = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 9000000n, courseDays: 360 }],
          216,
          '2026-11-10'
        );
        expect(res7Days.daysRemaining).toBe(3);
        expect(res7Days.isOverdue).toBe(false);

        // Check exactly on due date (13 Nov)
        const resDue = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 9000000n, courseDays: 360 }],
          216,
          '2026-11-13'
        );
        expect(resDue.daysRemaining).toBe(0);
        expect(resDue.isOverdue).toBe(false);

        // Check 1 day past deadline (14 Nov)
        const resOverdue = computeProRataRefund(
          '2026-11-03',
          [{ head: 'TUITION', netFeePaise: TUITION_120K, totalPaidPaise: 9000000n, courseDays: 360 }],
          216,
          '2026-11-14'
        );
        expect(resOverdue.daysRemaining).toBe(-1);
        expect(resOverdue.isOverdue).toBe(true);
      });
    });
  });

  // =========================================================================
  // SECTION 2: DETERMINISTIC DROPOUT RISK SCORER (riskScore.ts)
  // =========================================================================
  describe('2. Deterministic Dropout Risk Scorer Adversarial Challenges', () => {
    describe('2.1 Canonical STU-0587 Strictness (Score = 79, HIGH)', () => {
      it('strictly yields F=32, A=28, S=19, Total=79 for STU-0587', () => {
        const input: RiskInput = {
          worstOverdueDays: 23,
          isPartPaid: true,
          attendancePercent: 69,
          prevAttendancePercent: 88,
          testOldPercentile: 78,
          testNewPercentile: 59,
        };

        const res = calculateDropoutRiskScore(input);
        expect(res.fScore).toBe(32);
        expect(res.aScore).toBe(28);
        expect(res.sScore).toBe(19);
        expect(res.score).toBe(79);
        expect(res.severity).toBe('HIGH');
        expect(res.taskCreated).toBe(true);
      });
    });

    describe('2.2 Boundary Stress Testing of Sub-Factors', () => {
      describe('Factor F: Fee Delinquency', () => {
        it('tests exact rounding points across days overdue 0 to 45', () => {
          // d = 0: 0 without part-paid, 5 with part-paid
          expect(computeFeeFactor(0, false)).toBe(0);
          expect(computeFeeFactor(0, true)).toBe(5);

          // d = 1: round(35 * 1 / 30) = round(35/30) = 1
          expect(computeFeeFactor(1, false)).toBe(1);

          // d = 23: round(35 * 23 / 30) = round(805/30) = 27
          expect(computeFeeFactor(23, false)).toBe(27);
          expect(computeFeeFactor(23, true)).toBe(32);

          // d = 30: 35
          expect(computeFeeFactor(30, false)).toBe(35);
          expect(computeFeeFactor(30, true)).toBe(40);

          // d > 30 capped at 30
          expect(computeFeeFactor(31, false)).toBe(35);
          expect(computeFeeFactor(60, true)).toBe(40);
          expect(computeFeeFactor(999, true)).toBe(40);

          // d < 0 capped at 0
          expect(computeFeeFactor(-10, false)).toBe(0);
          expect(computeFeeFactor(-10, true)).toBe(5);
        });
      });

      describe('Factor A: Attendance Delinquency & Dips', () => {
        it('tests attendance benchmark 80% and floor 65%', () => {
          // >= 80% should give baseA = 0
          expect(computeAttendanceFactor(100)).toBe(0);
          expect(computeAttendanceFactor(80)).toBe(0);

          // <= 65% should give baseA = 25
          expect(computeAttendanceFactor(65)).toBe(25);
          expect(computeAttendanceFactor(50)).toBe(25);
          expect(computeAttendanceFactor(0)).toBe(25);

          // In-between points: 65 < att < 80
          // att = 79: round(25 * 1 / 15) = round(25/15) = 2
          expect(computeAttendanceFactor(79)).toBe(2);
          // att = 74: round(25 * 6 / 15) = round(150/15) = 10
          expect(computeAttendanceFactor(74)).toBe(10);
          // att = 69: round(25 * 11 / 15) = round(275/15) = 18
          expect(computeAttendanceFactor(69)).toBe(18);
        });

        it('strictly checks month-over-month drop penalty (> 10 threshold)', () => {
          // Drop of exactly 10 points (prev 80, curr 70): NO penalty
          // baseA for 70: round(25 * 10 / 15) = round(250/15) = 17
          expect(computeAttendanceFactor(70, 80)).toBe(17);

          // Drop of 10.01 or 11 points: +10 penalty
          expect(computeAttendanceFactor(70, 81)).toBe(27);

          // Improvement in attendance: NO penalty
          expect(computeAttendanceFactor(85, 70)).toBe(0);
        });

        it('never exceeds 35 even with extreme dip and attendance = 0', () => {
          expect(computeAttendanceFactor(0, 100)).toBe(35);
        });
      });

      describe('Factor S: Academic Test Trajectory', () => {
        it('caps at 25 points and ignores score improvements', () => {
          expect(computeTestSlopeFactor(90, 95)).toBe(0);
          expect(computeTestSlopeFactor(78, 78)).toBe(0);
          expect(computeTestSlopeFactor(78, 59)).toBe(19);
          expect(computeTestSlopeFactor(100, 75)).toBe(25);
          expect(computeTestSlopeFactor(100, 50)).toBe(25);
          expect(computeTestSlopeFactor(100, 0)).toBe(25);
        });
      });

      describe('Overdue instalments fallback edge case', () => {
        it('examines whether overdueInstalmentsCount sets isPartPaid unexpectedly', () => {
          // If a student is completely unpaid (P = 0) and overdue, but caller provides overdueInstalmentsCount: 1 without isPartPaid
          const resWithOverdueCount = calculateDropoutRiskScore({
            worstOverdueDays: 23,
            overdueInstalmentsCount: 1, // does not specify isPartPaid
            attendancePercent: 80,
          });
          // Check if fallback set isPartPaid to true
          expect(resWithOverdueCount.factors.fScore).toBe(32); // 27 + 5 = 32

          // If caller explicitly provides isPartPaid: false
          const resExplicitFalse = calculateDropoutRiskScore({
            worstOverdueDays: 23,
            isPartPaid: false,
            overdueInstalmentsCount: 1,
            attendancePercent: 80,
          });
          expect(resExplicitFalse.factors.fScore).toBe(27); // 27 + 0 = 27
        });
      });

      describe('14-Day False Flag Hold Suppression Logic', () => {
        it('suppresses risk flag during the 14-day hold and clears after 14 days', () => {
          const dismissedDate = new Date('2026-11-01T10:00:00Z');
          const suppressionDate = calculateFalseFlagSuppressionDate(dismissedDate, 14);
          expect(suppressionDate.toISOString().slice(0, 10)).toBe('2026-11-15');

          // Day 7: suppressed
          expect(isRiskFlagSuppressed(new Date('2026-11-08T10:00:00Z'), suppressionDate)).toBe(true);

          // Day 14 at exact ms: expired (current >= suppressedUntil)
          expect(isRiskFlagSuppressed(new Date('2026-11-15T10:00:00Z'), suppressionDate)).toBe(false);

          // Day 15: expired
          expect(isRiskFlagSuppressed(new Date('2026-11-16T10:00:00Z'), suppressionDate)).toBe(false);
        });
      });
    });
  });

  // =========================================================================
  // SECTION 3: REMINDER CADENCE & AUTO-SUPPRESSION (reminders.ts)
  // =========================================================================
  describe('3. Reminder Cadence & Auto-Suppression Adversarial Challenges', () => {
    describe('3.1 Cadence Schedule Generation', () => {
      it('generates exact T-7, T_0, T+3, T+7, T+15 offsets across month boundaries', () => {
        // Due date: 2026-03-02
        const cadence = generateReminderCadence('2026-03-02');
        expect(cadence[0].scheduledDate).toBe('2026-02-23'); // -7 days in Feb
        expect(cadence[1].scheduledDate).toBe('2026-03-02'); // T_0
        expect(cadence[2].scheduledDate).toBe('2026-03-05'); // +3 days
        expect(cadence[3].scheduledDate).toBe('2026-03-09'); // +7 days
        expect(cadence[4].scheduledDate).toBe('2026-03-17'); // +15 days
      });
    });

    describe('3.2 Payment Suppression & Idempotency', () => {
      it('suppresses on full payment and overpayment, but NOT on part-payment', () => {
        const full = evaluatePaymentReminderSuppression(3000000n, 3000000n, 'pay_1');
        expect(full.shouldSuppress).toBe(true);
        expect(full.reason).toBe('PAID_IN_FULL');
        expect(full.suppressPaymentId).toBe('pay_1');

        const over = evaluatePaymentReminderSuppression(3000000n, 3500000n, 'pay_2');
        expect(over.shouldSuppress).toBe(true);

        const part = evaluatePaymentReminderSuppression(3000000n, 2999999n, 'pay_3');
        expect(part.shouldSuppress).toBe(false);

        const zero = evaluatePaymentReminderSuppression(3000000n, 0n, 'pay_4');
        expect(zero.shouldSuppress).toBe(false);
      });

      it('proves suppression state evaluation is idempotent', () => {
        // Calling suppression evaluation multiple times with identical parameters yields identical results
        const res1 = evaluatePaymentReminderSuppression(3000000n, 3000000n, 'pay_idem', '2026-11-02T10:00:00Z');
        const res2 = evaluatePaymentReminderSuppression(3000000n, 3000000n, 'pay_idem', '2026-11-02T10:00:00Z');
        expect(res1).toEqual(res2);
      });
    });

    describe('3.3 24-Hour Quiet Period Boundary Tests', () => {
      it('tests exact hour boundaries for quiet period', () => {
        const lastPayment = '2026-11-02T10:00:00.000Z';

        // 23 hours 59 minutes: still inside quiet period
        expect(isInsideQuietPeriod(lastPayment, '2026-11-03T09:59:00.000Z', 24)).toBe(true);

        // Exactly 24 hours: quiet period expired
        expect(isInsideQuietPeriod(lastPayment, '2026-11-03T10:00:00.000Z', 24)).toBe(false);

        // 24 hours 1 second: quiet period expired
        expect(isInsideQuietPeriod(lastPayment, '2026-11-03T10:00:01.000Z', 24)).toBe(false);
      });
    });

    describe('3.4 Dynamic Balance Formatting', () => {
      it('formats reminder messages in Hindi and English accurately', () => {
        const msgHi = formatReminderMessage(1500000n, 23, true, 'hi');
        expect(msgHi.body).toBe('शुल्क शेष ₹15,000 — आंशिक भुगतान, 23 दिन अतिदेय');

        const msgEn = formatReminderMessage(1500000n, 23, true, 'en');
        expect(msgEn.body).toBe('Fee balance ₹15,000 — Part paid, 23 days overdue');
      });

      it('observes integer truncation behavior with non-zero paise balances', () => {
        // If balance is ₹15,000.50 (1500050n paise), division by 100n truncates paise:
        const msgWithPaise = formatReminderMessage(1500050n, 5, true, 'en');
        // Confirms current behavior drops 50 paise
        expect(msgWithPaise.body).toBe('Fee balance ₹15,000 — Part paid, 5 days overdue');
      });
    });
  });

  // =========================================================================
  // SECTION 4: DPDP ACT 2023 & 72-MONTH STATUTORY RETENTION (dpdp.ts)
  // =========================================================================
  describe('4. DPDP Act 2023 & Retention Adversarial Challenges', () => {
    describe('4.1 KYC Guardian Verification', () => {
      it('strictly requires guardian age >= 18 under s.2(f)', () => {
        expect(verifyAdultGuardianKyc('1234', '1234', 18).verified).toBe(true);
        expect(verifyAdultGuardianKyc('1234', '1234', 17.99).verified).toBe(false);
        expect(verifyAdultGuardianKyc('1234', '1234', 0).verified).toBe(false);
        expect(verifyAdultGuardianKyc('1234', '1234', -5).verified).toBe(false);
      });

      it('strictly matches identity last 4 digits', () => {
        expect(verifyAdultGuardianKyc('1234', '1234', 35).verified).toBe(true);
        expect(verifyAdultGuardianKyc('1234', '5678', 35).verified).toBe(false);
        expect(verifyAdultGuardianKyc('', '1234', 35).verified).toBe(false);
        expect(verifyAdultGuardianKyc('1234', '', 35).verified).toBe(false);
      });
    });

    describe('4.2 Immediate Effect of Consent Withdrawal (s.6(4))', () => {
      it('WHATSAPP_REMINDERS withdrawal immediately suppresses reminders', () => {
        const effect = processConsentWithdrawal('WHATSAPP_REMINDERS');
        expect(effect.suppressReminders).toBe(true);
        expect(effect.suppressReason).toBe('CONSENT_WITHDRAWN');
        expect(effect.restrictPortalAccess).toBe(false);
        expect(effect.disableRiskScoring).toBe(false);
      });

      it('CORE_EDUCATION_FEES withdrawal restricts portal and disables scoring', () => {
        const effect = processConsentWithdrawal('CORE_EDUCATION_FEES');
        expect(effect.suppressReminders).toBe(true);
        expect(effect.restrictPortalAccess).toBe(true);
        expect(effect.disableRiskScoring).toBe(true);
      });

      it('RISK_SCORING withdrawal disables risk scoring without stopping reminders', () => {
        const effect = processConsentWithdrawal('RISK_SCORING');
        expect(effect.suppressReminders).toBe(false);
        expect(effect.disableRiskScoring).toBe(true);
      });
    });

    describe('4.3 Section 36 GST Act 72-Month Financial Record Retention', () => {
      it('calculates retention expiry strictly 72 months from end of financial year', () => {
        // Record in FY 2026-27 (e.g. 2026-05-15 or 2027-02-10): FY ends 2027-03-31
        // 72 months (6 years) from FY end -> 2033-03-31
        const resMay2026 = evaluateDataRetention('FEE_RECEIPT', '2026-05-15', '2030-01-01');
        expect(resMay2026.retentionExpiresOn).toBe('2033-03-31');
        expect(resMay2026.canErase).toBe(false);

        const resFeb2027 = evaluateDataRetention('FEE_RECEIPT', '2027-02-10', '2030-01-01');
        expect(resFeb2027.retentionExpiresOn).toBe('2033-03-31');
        expect(resFeb2027.canErase).toBe(false);

        // Record in FY 2025-26 (e.g. 2026-03-15): FY ends 2026-03-31
        // 72 months -> 2032-03-31
        const resMar2026 = evaluateDataRetention('FEE_RECEIPT', '2026-03-15', '2030-01-01');
        expect(resMar2026.retentionExpiresOn).toBe('2032-03-31');
        expect(resMar2026.canErase).toBe(false);
      });

      it('tests exact calendar boundary of 72-month retention expiry', () => {
        const recordDate = '2026-11-02'; // FY ends 2027-03-31, expires 2033-03-31

        // Day of expiry: 2033-03-31 (cannot erase yet)
        const dayOf = evaluateDataRetention('FEE_RECEIPT', recordDate, '2033-03-31');
        expect(dayOf.canErase).toBe(false);

        // Day after expiry: 2033-04-01 (can erase)
        const dayAfter = evaluateDataRetention('FEE_RECEIPT', recordDate, '2033-04-01');
        expect(dayAfter.canErase).toBe(true);
      });

      it('applies retention override to all 4 tax record entity types', () => {
        const taxEntities = ['FEE_RECEIPT', 'PAYMENT_TRANSACTION', 'CREDIT_NOTE', 'AUDIT_LOG'] as const;
        for (const ent of taxEntities) {
          const res = evaluateDataRetention(ent, '2026-11-02', '2028-11-02');
          expect(res.canErase).toBe(false);
          expect(res.mandatoryRetentionMonths).toBe(72);
        }
      });

      it('allows immediate erasure of non-tax entities', () => {
        const nonTax = ['STUDENT_PROFILE', 'GUARDIAN_CONTACT'] as const;
        for (const ent of nonTax) {
          const res = evaluateDataRetention(ent, '2026-11-02', '2026-11-03');
          expect(res.canErase).toBe(true);
          expect(res.mandatoryRetentionMonths).toBe(0);
        }
      });
    });
  });

  // =========================================================================
  // SECTION 5: RAJASTHAN COACHING ACT 2025 (rajasthanAct.ts)
  // =========================================================================
  describe('5. Rajasthan Coaching Act 2025 Adversarial Challenges', () => {
    describe('5.1 Section 6(2)(d) >= 4 Equal Instalments Validation', () => {
      it('rejects plans with fewer than 4 instalments', () => {
        const plan3 = [
          { instalmentNumber: 1, dueDate: '2026-04-01', amountPaise: 4000000n },
          { instalmentNumber: 2, dueDate: '2026-07-01', amountPaise: 4000000n },
          { instalmentNumber: 3, dueDate: '2026-10-01', amountPaise: 4000000n },
        ];
        const res = validateFeePlan({ totalFeePaise: 12000000n, instalments: plan3 });
        expect(res.valid).toBe(false);
        expect(res.code).toBe('LESS_THAN_FOUR_INSTALMENTS');
      });

      it('verifies exact remainder absorption in final instalment', () => {
        // ₹100,000.01 (10,000,001 paise) across 4 instalments
        // 10000001 / 4 = 2500000 with remainder 1
        // Expected: 2500000, 2500000, 2500000, 2500001
        const insts = generateCompliantInstalments(10000001n, 4, '2026-04-01');
        expect(insts[0].amountPaise).toBe(2500000n);
        expect(insts[1].amountPaise).toBe(2500000n);
        expect(insts[2].amountPaise).toBe(2500000n);
        expect(insts[3].amountPaise).toBe(2500001n);

        const val = validateFeePlan({ totalFeePaise: 10000001n, instalments: insts });
        expect(val.valid).toBe(true);
      });

      it('rejects fee plan where remainder is not absorbed in final instalment', () => {
        // Remainder 1 put on first instalment instead of last
        const badPlan = [
          { instalmentNumber: 1, dueDate: '2026-04-01', amountPaise: 2500001n },
          { instalmentNumber: 2, dueDate: '2026-07-01', amountPaise: 2500000n },
          { instalmentNumber: 3, dueDate: '2026-10-01', amountPaise: 2500000n },
          { instalmentNumber: 4, dueDate: '2027-01-01', amountPaise: 2500000n },
        ];
        const val = validateFeePlan({ totalFeePaise: 10000001n, instalments: badPlan });
        expect(val.valid).toBe(false);
        expect(val.code).toBe('INSTALMENTS_NOT_EQUAL');
      });
    });

    describe('5.2 Section 13(5) Guard Against Mid-Course Fee Hikes', () => {
      it('strictly forbids any fee hike above enrolled fee', () => {
        const res = validateFeeAdjustment(12000000n, 12500000n, true); // even with director approval
        expect(res.allowed).toBe(false);
        expect(res.reason).toContain('prohibits increasing course fees after enrolment');
      });

      it('permits fee reduction only with Director approval', () => {
        const unapproved = validateFeeAdjustment(12000000n, 11000000n, false);
        expect(unapproved.allowed).toBe(false);
        expect(unapproved.reason).toContain('require audited Director approval');

        const approved = validateFeeAdjustment(12000000n, 11000000n, true);
        expect(approved.allowed).toBe(true);
      });
    });

    describe('5.3 Multitude of Instalments (5, 6, 12 instalments)', () => {
      it('validates compliant 5-instalment and 12-instalment fee plans', () => {
        const insts5 = generateCompliantInstalments(12000000n, 5, '2026-04-01');
        expect(validateFeePlan({ totalFeePaise: 12000000n, instalments: insts5 }).valid).toBe(true);

        const insts12 = generateCompliantInstalments(12000000n, 12, '2026-04-01');
        expect(validateFeePlan({ totalFeePaise: 12000000n, instalments: insts12 }).valid).toBe(true);
      });
    });
  });

  // =========================================================================
  // SECTION 6: ADVANCED EDGE CASE PROBES & COMPLIANCE GUARDRAILS
  // =========================================================================
  describe('6. Advanced Edge Case Probes & Compliance Guardrails', () => {
    it('observes maxCourseDays hardcoded default of 360 when course is shorter (e.g. 90-day course)', () => {
      const res = computeProRataRefund(
        '2026-10-01',
        [{ head: 'TUITION', netFeePaise: 3000000n, totalPaidPaise: 3000000n, courseDays: 90 }],
        45
      );
      // On head level:
      expect(res.heads[0].courseDays).toBe(90);
      expect(res.heads[0].consumedPaise).toBe(1500000n); // 45 / 90 * 30k = 15k
      expect(res.heads[0].refundablePaise).toBe(1500000n);
      // Top-level totalCourseDays defaults to 360
      expect(res.totalCourseDays).toBe(360);
    });

    it('handles empty heads array safely without crashing', () => {
      const res = computeProRataRefund('2026-10-01', [], 10);
      expect(res.totalRefundablePaise).toBe(0n);
      expect(res.totalPaidPaise).toBe(0n);
      expect(res.creditNoteRequired).toBe(false);
    });

    it('respects feeFactorEnabled: false switch (s.9(3) compliance switch)', () => {
      const input: RiskInput = {
        worstOverdueDays: 23,
        isPartPaid: true,
        attendancePercent: 69,
        prevAttendancePercent: 88,
        testOldPercentile: 78,
        testNewPercentile: 59,
        settings: {
          feeFactorEnabled: false,
        },
      };
      const res = calculateDropoutRiskScore(input);
      expect(res.factors.fScore).toBe(0);
      expect(res.fScore).toBe(0);
      expect(res.score).toBe(0 + 28 + 19); // 47
      expect(res.severity).toBe('LOW'); // < 50
      expect(res.taskCreated).toBe(false);
    });

    it('respects custom attendance benchmark and floor thresholds', () => {
      const res = calculateDropoutRiskScore({
        attendancePercent: 85,
        settings: {
          attendanceBenchmark: 90,
          attendanceFloor: 75,
        },
      });
      // 75 < 85 < 90: round(25 * (90 - 85) / 15) = round(125 / 15) = 8
      expect(res.factors.aScore).toBe(8);
    });

    it('formats zero balance correctly in reminder messages', () => {
      const zeroHi = formatReminderMessage(0n, 0, false, 'hi');
      expect(zeroHi.body).toBe('शुल्क शेष ₹0 — आज देय');
      const zeroEn = formatReminderMessage(0n, 0, false, 'en');
      expect(zeroEn.body).toBe('Fee balance ₹0 — Due today');
    });

    it('handles non-numeric or malformed last 4 strings in KYC verification', () => {
      expect(verifyAdultGuardianKyc('ABCD', 'ABCD', 30).verified).toBe(true);
      expect(verifyAdultGuardianKyc('123', '0123', 30).verified).toBe(false);
    });
  });
});
