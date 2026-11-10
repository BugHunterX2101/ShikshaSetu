/**
 * Deterministic Dropout Risk Scorer & Counsellor Script Engine
 * File: src/domain/riskScore.ts
 *
 * Statutory References & Privacy Safeguards:
 * - DPDP Act 2023 s.9(3) child protection guardrails:
 *   The risk engine produces only internal academic counselling tasks ('OPEN_CALL_TASK').
 *   It NEVER mutates ledgers, assesses penalties, or sends automatic coercive notices.
 * - Counsellor False-Flag Dismissal:
 *   If a flag is dismissed by a counsellor with a valid reason, a 14-day hold is enforced.
 *
 * Scoring Formula:
 *   R = F + A + S in [0, 100]
 *   - F (Fee delinquency, max 40):
 *       d = min(worstOverdueDays, 30)
 *       baseF = round_half_up(35 * d / 30)
 *       partPaidBonus = isPartPaid ? 5 : 0
 *       F = min(40, baseF + partPaidBonus)
 *   - A (Attendance factor, max 35):
 *       Benchmark = 80%, Floor = 65%
 *       if att >= 80: baseA = 0
 *       if att <= 65: baseA = 25
 *       if 65 < att < 80: baseA = round_half_up(25 * (80 - att) / 15)
 *       dropPenalty = (prevAtt - att > 10) ? 10 : 0
 *       A = min(35, baseA + dropPenalty)
 *   - S (Test trajectory slope factor, max 25):
 *       drop = max(0, testOldPercentile - testNewPercentile)
 *       S = min(25, drop)
 *
 * Canonical Verification:
 *   Student STU-0587:
 *     d = 23, part-paid = true => F = 27 + 5 = 32
 *     att = 69%, prev = 88% => baseA = 18, drop = 19 > 10 => A = 18 + 10 = 28
 *     old = 78, new = 59 => drop = 19 => S = 19
 *     R = 32 + 28 + 19 = 79 (HIGH)
 */

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type FalseFlagReason =
  | 'APPROVED_MEDICAL_LEAVE'
  | 'FAMILY_EVENT'
  | 'SCORE_ENTRY_CORRECTION';
export type TaskStatus = 'OPEN_CALL_TASK' | 'CONTACTED' | 'DISMISSED';

export interface RiskInput {
  worstOverdueDays?: number;
  overdueDays?: number; // Alias for worstOverdueDays
  isPartPaid?: boolean;
  overdueInstalmentsCount?: number;
  attendancePercent: number; // e.g. 69 for 69%
  prevAttendancePercent?: number; // e.g. 88 for 88%
  testOldPercentile?: number; // e.g. 78
  testNewPercentile?: number; // e.g. 59
  testPercentile?: number; // alias for testNewPercentile
  testRankDrop?: number; // alias for drop in test percentile
  consecutiveAbsencesDays?: number;
  settings?: {
    attendanceBenchmark?: number; // default 80
    attendanceFloor?: number; // default 65
    taskThreshold?: number; // default 50
    highThreshold?: number; // default 70
    feeFactorEnabled?: boolean; // default true
  };
}

export interface RiskFactors {
  fScore: number; // Fee factor (0..40)
  aScore: number; // Attendance factor (0..35)
  sScore: number; // Test score factor (0..25)
}

export interface CounsellorGuide {
  pointsEn: [string, string, string];
  pointsHi: [string, string, string];
  templateUsed: boolean;
  modelName: string | null;
}

export interface RiskScoreResult {
  score: number; // 0..100
  severity: RiskSeverity;
  factors: RiskFactors;
  fScore: number;
  aScore: number;
  sScore: number;
  taskCreated: boolean;
  guide: CounsellorGuide;
  rationaleEn: string;
  rationaleHi: string;
}

/**
 * Integer round-half-up division: round(num / den) = floor((2 * num + den) / (2 * den))
 */
export function roundHalfUp(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.floor((2 * num + den) / (2 * den));
}

/**
 * Computes deterministic fee delinquency factor F in [0, 40]
 */
export function computeFeeFactor(daysOverdue: number, isPartPaid: boolean): number {
  const d = Math.max(0, Math.floor(daysOverdue));
  const cappedD = Math.min(d, 30);
  const baseF = roundHalfUp(35 * cappedD, 30);
  const partPaidBonus = isPartPaid ? 5 : 0;
  return Math.min(40, baseF + partPaidBonus);
}

/**
 * Computes deterministic attendance factor A in [0, 35]
 */
export function computeAttendanceFactor(
  att: number,
  prevAtt?: number,
  benchmark = 80,
  floor = 65
): number {
  let baseA = 0;
  if (att >= benchmark) {
    baseA = 0;
  } else if (att <= floor) {
    baseA = 25;
  } else {
    baseA = roundHalfUp(25 * (benchmark - att), benchmark - floor);
  }

  // Month-over-month drop penalty: strictly > 10 percentage points
  let dropPenalty = 0;
  if (prevAtt !== undefined) {
    const drop = prevAtt - att;
    if (drop > 10) {
      dropPenalty = 10;
    }
  }

  return Math.min(35, baseA + dropPenalty);
}

/**
 * Computes deterministic test trend slope factor S in [0, 25]
 */
export function computeTestSlopeFactor(oldScore?: number, newScore?: number, directDrop?: number): number {
  let drop = 0;
  if (directDrop !== undefined) {
    drop = Math.max(0, directDrop);
  } else if (oldScore !== undefined && newScore !== undefined) {
    drop = Math.max(0, oldScore - newScore);
  }
  const cappedDrop = Math.min(drop, 25);
  return roundHalfUp(25 * cappedDrop, 25); // equals cappedDrop
}

/**
 * Generates deterministic bilingual counselling script guidance
 */
export function generateTemplateGuide(
  factors: RiskFactors,
  daysOverdue: number,
  severity: RiskSeverity
): CounsellorGuide {
  const pointsEn: [string, string, string] = [
    factors.aScore >= 18
      ? 'Empathetically discuss recent attendance drop and offer scheduled 1-on-1 doubt clearing for missed modules.'
      : 'Review classroom engagement and confirm student comfort with the current curriculum pace.',
    factors.sScore >= 15
      ? 'Review recent test score trajectory and coordinate a faculty mentorship session for topic reinforcement.'
      : 'Encourage consistent revision and provide practice mock tests for upcoming assessments.',
    factors.fScore >= 25
      ? `Inquire respectfully about family wellbeing and discuss flexible instalment support (${daysOverdue} days overdue).`
      : 'Confirm that all study materials and administrative records are up to date.',
  ];

  const pointsHi: [string, string, string] = [
    factors.aScore >= 18
      ? 'उपस्थिति में गिरावट के संबंध में विद्यार्थी से सहानुभूतिपूर्वक चर्चा करें और संशय समाधान सत्र का प्रस्ताव दें।'
      : 'कक्षा में सहभागिता की समीक्षा करें और पुष्टि करें कि विद्यार्थी विषय को ठीक से समझ पा रहा है।',
    factors.sScore >= 15
      ? 'हालिया टेस्ट प्रदर्शन में आई गिरावट की समीक्षा करें और संबंधित विषय के शिक्षक से विशेष मार्गदर्शन सत्र कराएं।'
      : 'नियमित पुनरावृत्ति (Revision) को प्रोत्साहित करें और आगामी परीक्षाओं हेतु अभ्यास टेस्ट प्रदान करें।',
    factors.fScore >= 25
      ? `परिवार की स्थिति के बारे में सम्मानजनक रूप से पूछें और सुविधाजनक किस्त विकल्पों की जानकारी दें (${daysOverdue} दिन अतिदेय)।`
      : 'पुष्टि करें कि अध्ययन सामग्री और प्रशासनिक रिकॉर्ड पूरी तरह अद्यतित हैं।',
  ];

  return {
    pointsEn,
    pointsHi,
    templateUsed: true,
    modelName: null,
  };
}

/**
 * Main Deterministic Dropout Risk Scorer
 */
export function calculateDropoutRiskScore(input: RiskInput): RiskScoreResult {
  const daysOverdue = input.worstOverdueDays ?? input.overdueDays ?? 0;
  const isPartPaid = input.isPartPaid ?? (input.overdueInstalmentsCount !== undefined && input.overdueInstalmentsCount > 0);

  const benchmark = input.settings?.attendanceBenchmark ?? 80;
  const floor = input.settings?.attendanceFloor ?? 65;
  const taskThreshold = input.settings?.taskThreshold ?? 50;
  const highThreshold = input.settings?.highThreshold ?? 70;
  const feeEnabled = input.settings?.feeFactorEnabled ?? true;

  const fScore = feeEnabled ? computeFeeFactor(daysOverdue, isPartPaid) : 0;
  const aScore = computeAttendanceFactor(
    input.attendancePercent,
    input.prevAttendancePercent,
    benchmark,
    floor
  );

  const oldTest = input.testOldPercentile;
  const newTest = input.testNewPercentile ?? input.testPercentile;
  const sScore = computeTestSlopeFactor(oldTest, newTest, input.testRankDrop);

  const rawScore = fScore + aScore + sScore;
  const score = Math.max(0, Math.min(100, rawScore));

  let severity: RiskSeverity = 'LOW';
  if (score >= highThreshold) {
    severity = 'HIGH';
  } else if (score >= taskThreshold) {
    severity = 'MEDIUM';
  }

  const taskCreated = score >= taskThreshold;
  const factors: RiskFactors = { fScore, aScore, sScore };
  const guide = generateTemplateGuide(factors, daysOverdue, severity);

  const rationaleEn = `Dropout Risk Score: ${score}/100 (${severity}). Factors: Fee Delinquency ${fScore}/40, Attendance Dip ${aScore}/35, Academic Trajectory Drop ${sScore}/25.`;
  const rationaleHi = `ड्रॉपआउट जोखिम स्कोर: ${score}/100 (${severity === 'HIGH' ? 'उच्च' : severity === 'MEDIUM' ? 'मध्यम' : 'निम्न'})। कारक: शुल्क अतिदेयता ${fScore}/40, उपस्थिति गिरावट ${aScore}/35, टेस्ट रुझान ${sScore}/25।`;

  return {
    score,
    severity,
    factors,
    fScore,
    aScore,
    sScore,
    taskCreated,
    guide,
    rationaleEn,
    rationaleHi,
  };
}

/**
 * Calculates 14-day false-flag hold suppression date
 */
export function calculateFalseFlagSuppressionDate(dismissedAt: Date, holdDays = 14): Date {
  const suppressedUntil = new Date(dismissedAt.getTime());
  suppressedUntil.setDate(suppressedUntil.getDate() + holdDays);
  return suppressedUntil;
}

/**
 * Checks if a student is currently within the 14-day false-flag hold window
 */
export function isRiskFlagSuppressed(currentDate: Date, suppressedUntil: Date | null): boolean {
  if (!suppressedUntil) return false;
  return currentDate.getTime() < suppressedUntil.getTime();
}
