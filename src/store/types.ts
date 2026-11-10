// src/store/types.ts
// Core domain interfaces and entity types for ShikshaSetu persistence layer

export type StreamType = 'JEE' | 'NEET';
export type UserRole = 'PARENT' | 'ACCOUNTS_EXEC' | 'COUNSELLOR' | 'DIRECTOR';
export type PreferredLang = 'en' | 'hi';
export type FeeHeadType = 'TUITION' | 'HOSTEL' | 'MESS';
export type PaymentMode = 'UPI' | 'NETBANKING' | 'CARD' | 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'DEMAND_DRAFT' | 'POS_CARD';
export type MatchStatus = 'MATCHED' | 'UNMATCHED_QUEUE' | 'RESOLVED' | 'REJECTED';
export type UnmatchedReasonCode = 'NO_REFERENCE' | 'UNKNOWN_STUDENT' | 'CANCELLED_INSTALMENT' | 'NO_OPEN_DUES';
export type DocumentKind = 'RCP' | 'CN';
export type ReminderTriggerType = 'T_MINUS_7' | 'T_ZERO' | 'T_PLUS_3' | 'T_PLUS_7' | 'T_PLUS_15';
export type ReminderState = 'QUEUED' | 'SENT' | 'SUPPRESSED_BY_PAYMENT' | 'FAILED';
export type SuppressReason = 'PAID_IN_FULL' | 'REFUND' | 'CONSENT_WITHDRAWN';
export type RefundStatus = 'DRAFT' | 'APPROVED' | 'SETTLED' | 'REJECTED';
export type ConsentPurposeCode = 'CORE_EDUCATION_FEES' | 'WHATSAPP_REMINDERS' | 'RISK_SCORING';

export interface Centre {
  id: string;
  code: 'JPR-GPL' | 'JPR-VSH' | 'JPR-MNS' | 'JPR-SKR';
  name: string;
  gstin: string;
  registrationNo: string;
  address: string;
}

export interface Batch {
  id: string;
  centreId: string;
  code: string;
  name: string;
  stream: StreamType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  courseDays: number;
  baseFeePaise: bigint;
  instalmentCount: number;
}

export interface User {
  id: string;
  phone: string;
  email: string;
  name: string;
  role: UserRole;
  preferredLang: PreferredLang;
  isActive: boolean;
  phoneVerifiedAt: string | null;
  assignedCentreIds?: string[];
}

export interface Student {
  id: string;
  studentCode: string; // e.g. STU-0412, STU-0587, STU-0219
  fullName: string;
  dob: string; // YYYY-MM-DD
  isMinor: boolean;
  centreId: string;
  batchId: string;
  enrolmentDate: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'WITHDRAWN';
  withdrawnAt: string | null;
  grossFeePaise: bigint;
  discountPaise: bigint;
  discountReason: string | null;
  netFeePaise: bigint;
}

export interface Guardian {
  id: string;
  studentId: string;
  userId: string;
  name: string;
  relationship: 'FATHER' | 'MOTHER' | 'LEGAL_GUARDIAN';
  idRefType: 'AADHAAR' | 'PAN' | 'VOTER_ID';
  idLast4: string;
  verifiedAt: string;
  isPrimary: boolean;
}

export interface Instalment {
  id: string;
  studentId: string;
  seqNo: number;
  dueDate: string; // YYYY-MM-DD
  amountDuePaise: bigint;
  amountPaidPaise: bigint;
  version: number;
  cancelledAt: string | null;
  refundId: string | null;
}

export interface InstalmentHead {
  id: string;
  instalmentId: string;
  head: FeeHeadType;
  amountDuePaise: bigint;
  amountPaidPaise: bigint;
}

export interface Payment {
  id: string;
  gatewayPaymentId: string;
  gatewayOrderId: string | null;
  studentId: string | null;
  instalmentId: string | null;
  amountPaise: bigint;
  mode: PaymentMode;
  receivedOn: string; // YYYY-MM-DD
  receivedAt: string; // ISO-8601 UTC
  matchStatus: MatchStatus;
  reasonCode: UnmatchedReasonCode | null;
  unallocatedPaise: bigint;
  payerName: string | null;
  payerPhone: string | null;
  bankReference: string | null;
  remarks: string | null;
  reversesPaymentId: string | null;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  instalmentId: string;
  head: FeeHeadType;
  amountPaise: bigint;
}

export interface ReceiptCounter {
  gstin: string;
  fy: string;
  kind: DocumentKind;
  lastNo: number;
}

export interface Receipt {
  id: string;
  paymentId: string | null;
  centreId: string;
  gstin: string;
  fy: string;
  kind: DocumentKind;
  number: string; // e.g. RCP/26-27/000412 or CN/26-27/000001
  issuedAt: string; // ISO-8601 UTC
  issuedDate: string; // YYYY-MM-DD
  grossPaise: bigint;
  taxablePaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  studentId: string;
  refundId: string | null;
  originalReceiptId: string | null;
  snapshotJson: Record<string, unknown>;
}

export interface Reminder {
  id: string;
  instalmentId: string;
  studentId: string;
  triggerType: ReminderTriggerType;
  scheduledFor: string; // YYYY-MM-DD
  channel: 'WHATSAPP' | 'SMS';
  lang: PreferredLang;
  state: ReminderState;
  sentAt: string | null;
  suppressedAt: string | null;
  suppressReason: SuppressReason | null;
  suppressPaymentId: string | null;
  providerMessageId: string | null;
  error: string | null;
}

export interface RefundRequest {
  id: string;
  studentId: string;
  receivedOn: string; // YYYY-MM-DD
  daysElapsed: number;
  totalCourseDays: number;
  netFeePaise: bigint;
  totalPaidPaise: bigint;
  consumedPaise: bigint;
  refundablePaise: bigint;
  shortfallPaise: bigint;
  slaDueDate: string; // YYYY-MM-DD
  status: RefundStatus;
  raisedBy: string; // User ID
  approvedBy: string | null; // User ID (MUST NOT EQUAL raisedBy)
  settledOn: string | null;
  settlementMode: string | null;
  bankReference: string | null;
  creditNoteId: string | null;
}

export interface RefundLine {
  id: string;
  refundId: string;
  head: FeeHeadType;
  netPaise: bigint;
  paidPaise: bigint;
  consumedPaise: bigint;
  refundPaise: bigint;
}

export interface DpdpConsent {
  id: string;
  studentId: string;
  parentUserId: string;
  purposeCode: ConsentPurposeCode;
  noticeVersion: number;
  languageShown: PreferredLang;
  grantedAt: string;
  withdrawnAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actorUserId: string | null;
  role: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
}

export interface AcademicRecord {
  studentId: string;
  attendancePercent: number;
  prevAttendancePercent: number;
  testScores: number[];
}

export interface DropoutFlag {
  studentId: string;
  score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  fScore: number;
  aScore: number;
  sScore: number;
  flaggedOn: string;
  templateGuide: string;
}

// RFC 9457 Problem Details
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  instance?: string;
}

// Result types
export interface DuesSummaryResult {
  studentId: string;
  studentCode: string;
  fullName: string;
  centreId: string;
  centreCode: string;
  totalGrossPaise: string;
  totalDiscountPaise: string;
  totalNetPaise: string;
  totalPaidPaise: string;
  totalBalancePaise: string;
  totalBalanceFormatted: string;
  nextDueDate: string | null;
  overdueDays: number;
  status: 'PAID' | 'CURRENT' | 'UPCOMING' | 'PART_PAID_OVERDUE' | 'OVERDUE';
  statusLabelEn: string;
  statusLabelHi: string;
  instalments: Array<{
    id: string;
    seqNo: number;
    dueDate: string;
    amountDuePaise: string;
    amountPaidPaise: string;
    balancePaise: string;
    status: string;
    statusLabelEn: string;
    statusLabelHi: string;
    overdueDays: number;
  }>;
  recentReceipts: Array<{
    id: string;
    number: string;
    issuedDate: string;
    grossPaise: string;
    grossFormatted: string;
    taxablePaise: string;
    cgstPaise: string;
    sgstPaise: string;
  }>;
}

export interface MultiCentreAgeingResult {
  asOfDate: string;
  centreTotals: Array<{
    centreId: string;
    centreCode: string;
    centreName: string;
    studentCount: number;
    currentPaise: string;
    d1_30Paise: string;
    d31_60Paise: string;
    d61_plusPaise: string;
    totalOpenPaise: string;
  }>;
  overallTotals: {
    currentPaise: string;
    d1_30Paise: string;
    d31_60Paise: string;
    d61_plusPaise: string;
    totalOpenPaise: string;
    currentFormatted: string;
    d1_30Formatted: string;
    d31_60Formatted: string;
    d61_plusFormatted: string;
    totalOpenFormatted: string;
  };
}

export interface AdminDashboardKpis {
  asOfDate: string;
  totalStudents: number;
  totalBilledPaise: string;
  totalCollectedPaise: string;
  totalOverduePaise: string;
  collectionEfficiencyPercent: number;
  highRiskDropoutCount: number;
  unmatchedQueueCount: number;
  unmatchedQueuePaise: string;
}

export interface RecordPaymentParams {
  studentId?: string;
  studentCode?: string;
  instalmentId?: string;
  amountPaise: bigint;
  mode: PaymentMode;
  gatewayPaymentId: string;
  gatewayOrderId?: string;
  payerName?: string;
  payerPhone?: string;
  bankReference?: string;
  receivedOn?: string;
  remarks?: string;
  actorUserId?: string;
}

export interface RecordPaymentResult {
  success: boolean;
  outcome: 'MATCHED' | 'DUPLICATE' | 'UNMATCHED_QUEUE';
  paymentId: string;
  receiptNumber?: string;
  receiptId?: string;
  amountPaise: string;
  gstSplit?: {
    grossPaise: string;
    taxablePaise: string;
    cgstPaise: string;
    sgstPaise: string;
    igstPaise: string;
    totalTaxPaise: string;
    sacCode: string;
    rateBasisPoints: number;
  };
  allocations?: Array<{
    instalmentId: string;
    seqNo: number;
    allocatedPaise: string;
    isFullyPaid: boolean;
    remainingDuePaise: string;
  }>;
  remindersSuppressed?: Array<{
    reminderId: string;
    triggerType: ReminderTriggerType;
    state: ReminderState;
    suppressReason: SuppressReason;
  }>;
  unallocatedPaise: string;
  studentBalanceAfterPaise?: string;
  reasonCode?: UnmatchedReasonCode;
  detail?: string;
}

export interface OfflineCashPaymentParams {
  studentId: string;
  instalmentId: string;
  amountPaise: bigint;
  mode: PaymentMode;
  reference: string;
  payerName: string;
  payerPhone?: string;
  paymentDate?: string;
  remarks?: string;
  actorUserId: string;
}

export interface RaiseRefundParams {
  studentId: string;
  receivedOn: string;
  reason?: string;
  actorUserId: string;
}

export interface SettleRefundParams {
  refundId: string;
  settlementMode: string;
  bankReference: string;
  actorUserId: string;
}

export interface ReminderFilters {
  studentId?: string;
  state?: ReminderState;
  triggerType?: ReminderTriggerType;
  scheduledFor?: string;
  centreId?: string;
}
