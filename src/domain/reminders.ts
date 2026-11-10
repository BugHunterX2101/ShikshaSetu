/**
 * Fee Reminder Cadence & Auto-Suppression State Engine
 * File: src/domain/reminders.ts
 *
 * Operational Rules:
 * - 5-Stage Cadence per instalment:
 *     T-7   (-7 days): Gentle advance notice
 *     T_0   (0 days):  Due date notification
 *     T+3   (+3 days): First overdue reminder
 *     T+7   (+7 days): Second overdue alert
 *     T+15  (+15 days): Final reminder before telephone escalation
 * - States: QUEUED, SENT, SUPPRESSED_BY_PAYMENT, FAILED
 * - Suppression Reasons: PAID_IN_FULL, REFUND, CONSENT_WITHDRAWN
 * - Full Payment: Immediately transitions all remaining QUEUED reminders to
 *   SUPPRESSED_BY_PAYMENT with reason 'PAID_IN_FULL' and references suppressPaymentId.
 * - Part Payment: Does NOT suppress reminders. Initiates a 24-hour quiet period.
 *   Subsequent reminders dynamically format and display the reduced outstanding balance.
 */

export type ReminderTriggerType = 'T_MINUS_7' | 'T_ZERO' | 'T_PLUS_3' | 'T_PLUS_7' | 'T_PLUS_15';
export type ReminderState = 'QUEUED' | 'SENT' | 'SUPPRESSED_BY_PAYMENT' | 'FAILED';
export type SuppressReason = 'PAID_IN_FULL' | 'REFUND' | 'CONSENT_WITHDRAWN';
export type ReminderChannel = 'WHATSAPP' | 'SMS';
export type ReminderLanguage = 'hi' | 'en';

export interface ReminderItem {
  id: string;
  instalmentId: string;
  triggerType: ReminderTriggerType;
  scheduledDate: string; // YYYY-MM-DD
  state: ReminderState;
  channel: ReminderChannel;
  lang: ReminderLanguage;
  suppressReason?: SuppressReason;
  suppressedAt?: string;
  suppressPaymentId?: string;
  sentAt?: string;
}

export interface ReminderCadencePlan {
  triggerType: ReminderTriggerType;
  offsetDays: number;
  scheduledDate: string;
}

/**
 * Adds calendar days to an ISO YYYY-MM-DD date string using UTC dates.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Generates the standard 5-point reminder cadence schedule for an instalment due date.
 */
export function generateReminderCadence(dueDate: string): ReminderCadencePlan[] {
  return [
    { triggerType: 'T_MINUS_7', offsetDays: -7, scheduledDate: addDaysToDate(dueDate, -7) },
    { triggerType: 'T_ZERO', offsetDays: 0, scheduledDate: dueDate },
    { triggerType: 'T_PLUS_3', offsetDays: 3, scheduledDate: addDaysToDate(dueDate, 3) },
    { triggerType: 'T_PLUS_7', offsetDays: 7, scheduledDate: addDaysToDate(dueDate, 7) },
    { triggerType: 'T_PLUS_15', offsetDays: 15, scheduledDate: addDaysToDate(dueDate, 15) },
  ];
}

export interface PaymentSuppressionResult {
  shouldSuppress: boolean;
  reason?: SuppressReason;
  suppressedAt?: string;
  suppressPaymentId?: string;
}

/**
 * Evaluates whether a payment event suppresses queued reminders for an instalment.
 *
 * Rule:
 * If new cumulative amount paid >= amount due, suppress with 'PAID_IN_FULL'.
 * If part payment (amount paid < amount due), DO NOT suppress.
 */
export function evaluatePaymentReminderSuppression(
  instalmentAmountDuePaise: bigint,
  newAmountPaidPaise: bigint,
  paymentId: string,
  nowIso: string = new Date().toISOString()
): PaymentSuppressionResult {
  if (newAmountPaidPaise >= instalmentAmountDuePaise) {
    return {
      shouldSuppress: true,
      reason: 'PAID_IN_FULL',
      suppressedAt: nowIso,
      suppressPaymentId: paymentId,
    };
  }
  // Part-payment: continue chasing, no suppression
  return { shouldSuppress: false };
}

/**
 * Checks if a scheduled reminder is currently within the 24-hour quiet period
 * following a recent payment.
 */
export function isInsideQuietPeriod(
  lastPaymentAt: Date | string | null,
  currentRunTime: Date | string,
  quietPeriodHours = 24
): boolean {
  if (!lastPaymentAt) return false;
  const lastPaymentMs = new Date(lastPaymentAt).getTime();
  const runMs = new Date(currentRunTime).getTime();
  const diffHours = (runMs - lastPaymentMs) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < quietPeriodHours;
}

/**
 * Formats bilingual reminder message at dispatch time with live outstanding balance.
 */
export function formatReminderMessage(
  balancePaise: bigint,
  daysOverdue: number,
  isPartPaid: boolean,
  lang: ReminderLanguage
): { subject: string; body: string } {
  const rupees = Number(balancePaise / 100n).toLocaleString('en-IN');

  if (lang === 'hi') {
    let statusText = '';
    if (daysOverdue > 0) {
      statusText = isPartPaid
        ? `आंशिक भुगतान, ${daysOverdue} दिन अतिदेय`
        : `${daysOverdue} दिन अतिदेय`;
    } else if (daysOverdue === 0) {
      statusText = 'आज देय';
    } else {
      statusText = `${Math.abs(daysOverdue)} दिन में देय`;
    }
    return {
      subject: 'शिक्षासेतु: शुल्क अनुस्मारक',
      body: `शुल्क शेष ₹${rupees} — ${statusText}`,
    };
  }

  let statusText = '';
  if (daysOverdue > 0) {
    statusText = isPartPaid
      ? `Part paid, ${daysOverdue} days overdue`
      : `${daysOverdue} days overdue`;
  } else if (daysOverdue === 0) {
    statusText = 'Due today';
  } else {
    statusText = `Due in ${Math.abs(daysOverdue)} days`;
  }
  return {
    subject: 'ShikshaSetu: Fee Reminder',
    body: `Fee balance ₹${rupees} — ${statusText}`,
  };
}
