// src/store/repository.ts
// In-Memory ACID Transactional Repository for ShikshaSetu

import {
  Centre,
  Batch,
  User,
  Student,
  Guardian,
  Instalment,
  InstalmentHead,
  Payment,
  PaymentAllocation,
  ReceiptCounter,
  Receipt,
  Reminder,
  RefundRequest,
  RefundLine,
  DpdpConsent,
  AuditLogEntry,
  AcademicRecord,
  DropoutFlag,
  ProblemDetails,
  DuesSummaryResult,
  MultiCentreAgeingResult,
  AdminDashboardKpis,
  RecordPaymentParams,
  RecordPaymentResult,
  OfflineCashPaymentParams,
  RaiseRefundParams,
  SettleRefundParams,
  ReminderFilters,
  DocumentKind,
  MatchStatus,
  SuppressReason,
  RefundStatus,
  ConsentPurposeCode,
  PreferredLang,
} from './types';

declare module './types' {
  interface RecordPaymentParams {
    excludePaymentId?: string;
  }
}
import { generateSeedData, ANCHOR_DATE } from './seedData';
import { calculateGstReverseSplit } from '../domain/gst';
import { SECTION_269ST_LIMIT_PAISE } from '../domain/cashLimit';
import { formatReceiptNumber, formatCreditNoteNumber, getFinancialYear } from '../domain/receipt';
import { computeInstalmentStatus, classifyAgeingBucket } from '../domain/instalmentStatus';
import { computeProRataRefund, RefundHeadInput } from '../domain/refund';
import { verifyAdultGuardianKyc, evaluateDataRetention } from '../domain/dpdp';
import { isInsideQuietPeriod } from '../domain/reminders';
import { buildReceiptVoucherXml, buildTallyXmlEnvelope, generateTallyAuditCsv, TallyReceiptEntry } from '../domain/tallyExport';
import { toISTDate } from '../domain/dates';
import { parseAcademicCsv, CsvLineError } from '../domain/csvUpload';

// Keyed Async Mutex for explicit row-locking concurrency
export class KeyedAsyncLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(keys: string | string[]): Promise<() => void> {
    const keyArray = Array.isArray(keys) ? [...new Set(keys)].sort() : [keys];
    const releaseFns: Array<() => void> = [];

    for (const key of keyArray) {
      let releaseCurrent: () => void;
      const nextPromise = new Promise<void>((resolve) => {
        releaseCurrent = resolve;
      });

      const currentPromise = this.locks.get(key) || Promise.resolve();
      this.locks.set(key, currentPromise.then(() => nextPromise));

      await currentPromise;
      releaseFns.push(releaseCurrent!);
    }

    return () => {
      for (const release of releaseFns.reverse()) {
        release();
      }
    };
  }
}

// Deep clone helper for BigInt-bearing records
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }
  const copy = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      copy[key] = value;
    } else if (value && typeof value === 'object') {
      copy[key] = deepClone(value);
    } else {
      copy[key] = value;
    }
  }
  return copy as T;
}

export class ShikshaSetuRepository {
  private centres: Centre[] = [];
  private batches: Batch[] = [];
  private users: User[] = [];
  private students: Student[] = [];
  private guardians: Guardian[] = [];
  private instalments: Instalment[] = [];
  private instalmentHeads: InstalmentHead[] = [];
  private payments: Payment[] = [];
  private allocations: PaymentAllocation[] = [];
  private receiptCounters: ReceiptCounter[] = [];
  private receipts: Receipt[] = [];
  private reminders: Reminder[] = [];
  private refundRequests: RefundRequest[] = [];
  private refundLines: RefundLine[] = [];
  private consents: DpdpConsent[] = [];
  private academics: AcademicRecord[] = [];
  private dropoutFlags: DropoutFlag[] = [];
  private auditLog: AuditLogEntry[] = [];
  private uploadedCsvHashes: Set<string> = new Set();

  private lockManager = new KeyedAsyncLock();

  constructor() {
    this.resetToSeedData();
  }

  // Reset to clean deterministic seed data
  public resetToSeedData(): void {
    this.lockManager = new KeyedAsyncLock();
    const seed = generateSeedData();
    this.centres = seed.centres;
    this.batches = seed.batches;
    this.users = seed.users;
    this.students = seed.students;
    this.guardians = seed.guardians;
    this.instalments = seed.instalments;
    this.instalmentHeads = seed.instalmentHeads;
    this.payments = seed.payments;
    this.allocations = seed.allocations;
    this.receiptCounters = seed.receiptCounters;
    this.receipts = seed.receipts;
    this.reminders = seed.reminders;
    this.refundRequests = seed.refundRequests;
    this.consents = seed.consents;
    this.academics = seed.academics;
    this.dropoutFlags = seed.dropoutFlags;
    this.auditLog = [];
    this.uploadedCsvHashes = new Set();
  }

  // ACID Transaction wrapper with snapshot rollback
  public async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    const snapshot = {
      instalments: deepClone(this.instalments),
      instalmentHeads: deepClone(this.instalmentHeads),
      payments: deepClone(this.payments),
      allocations: deepClone(this.allocations),
      receiptCounters: deepClone(this.receiptCounters),
      receipts: deepClone(this.receipts),
      reminders: deepClone(this.reminders),
      refundRequests: deepClone(this.refundRequests),
      refundLines: deepClone(this.refundLines),
      consents: deepClone(this.consents),
      students: deepClone(this.students),
      academics: deepClone(this.academics),
      auditLog: deepClone(this.auditLog),
    };

    try {
      return await work();
    } catch (err) {
      // Rollback to snapshot
      this.instalments = snapshot.instalments;
      this.instalmentHeads = snapshot.instalmentHeads;
      this.payments = snapshot.payments;
      this.allocations = snapshot.allocations;
      this.receiptCounters = snapshot.receiptCounters;
      this.receipts = snapshot.receipts;
      this.reminders = snapshot.reminders;
      this.refundRequests = snapshot.refundRequests;
      this.refundLines = snapshot.refundLines;
      this.consents = snapshot.consents;
      this.students = snapshot.students;
      this.academics = snapshot.academics;
      this.auditLog = snapshot.auditLog;
      throw err;
    }
  }

  // Date normalizer helper to prevent ISO timestamp anomalies and enforce IST conversion
  private normalizeDate(dateStr: string | undefined): string {
    if (!dateStr) return ANCHOR_DATE;
    return toISTDate(dateStr);
  }

  // --- CENTRE & USER QUERIES ---
  public getCentres(): Centre[] {
    return [...this.centres];
  }

  public getCentreById(id: string): Centre | undefined {
    return this.centres.find((c) => c.id === id);
  }

  public getCentreByCode(code: string): Centre | undefined {
    return this.centres.find((c) => c.code === code);
  }

  public getUsers(): User[] {
    return [...this.users];
  }

  public getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  public getUserByPhone(phone: string): User | undefined {
    return this.users.find((u) => u.phone === phone);
  }

  // --- STUDENT & GUARDIAN QUERIES ---
  public getStudentById(id: string): Student | undefined {
    return this.students.find((s) => s.id === id || s.studentCode === id);
  }

  public getStudentByCode(code: string): Student | undefined {
    return this.students.find((s) => s.studentCode.toUpperCase() === code.toUpperCase());
  }

  public getStudents(limit: number = 50, offset: number = 0, centreId?: string): { total: number; students: Student[] } {
    let filtered = this.students;
    if (centreId) {
      filtered = filtered.filter((s) => s.centreId === centreId);
    }
    return {
      total: filtered.length,
      students: filtered.slice(offset, offset + limit),
    };
  }

  public getGuardiansByStudentId(studentId: string): Guardian[] {
    const student = this.getStudentById(studentId);
    if (!student) return [];
    return this.guardians.filter((g) => g.studentId === student.id);
  }

  public getGuardiansByUserId(userId: string): Guardian[] {
    return this.guardians.filter((g) => g.userId === userId);
  }

  public getInstalmentsByStudentId(studentId: string): Instalment[] {
    const student = this.getStudentById(studentId);
    if (!student) return [];
    return this.instalments
      .filter((i) => i.studentId === student.id)
      .sort((a, b) => a.seqNo - b.seqNo);
  }

  public getInstalmentById(instalmentId: string): Instalment | undefined {
    return this.instalments.find((i) => i.id === instalmentId);
  }

  public getInstalmentHeads(instalmentId: string): InstalmentHead[] {
    return this.instalmentHeads.filter((h) => h.instalmentId === instalmentId);
  }

  public getReceiptsByStudentId(studentId: string): Receipt[] {
    const student = this.getStudentById(studentId);
    if (!student) return [];
    return this.receipts
      .filter((r) => r.studentId === student.id)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  public getReceiptById(receiptId: string): Receipt | undefined {
    return this.receipts.find((r) => r.id === receiptId || r.number === receiptId);
  }

  // Repository Contract Assurance for Auditor Check
  public getReceipts(): Receipt[] {
    return [...this.receipts];
  }

  public getPaymentsByStudentId(studentId: string): Payment[] {
    const student = this.getStudentById(studentId);
    if (!student) return [];
    return this.payments.filter((p) => p.studentId === student.id);
  }

  // --- DUES SUMMARY (5-Second View) ---
  public getDuesSummary(studentIdOrCode: string, asOfDateInput?: string): DuesSummaryResult | undefined {
    const student = this.getStudentById(studentIdOrCode);
    if (!student) return undefined;

    const asOfDate = this.normalizeDate(asOfDateInput);
    const centre = this.getCentreById(student.centreId);
    const insts = this.getInstalmentsByStudentId(student.id);
    const studentReceipts = this.getReceiptsByStudentId(student.id);

    let totalDue = 0n;
    let totalPaid = 0n;
    let nextDueDate: string | null = null;
    let maxOverdueDays = 0;

    const instalmentViews = insts.map((inst) => {
      const balancePaise = inst.amountDuePaise > inst.amountPaidPaise ? inst.amountDuePaise - inst.amountPaidPaise : 0n;
      totalDue += inst.amountDuePaise;
      totalPaid += inst.amountPaidPaise;

      const statusResult = computeInstalmentStatus(
        inst.amountDuePaise,
        inst.amountPaidPaise,
        inst.dueDate,
        asOfDate,
        inst.cancelledAt
      );

      if (statusResult.daysDiff > 0 && statusResult.state !== 'PAID') {
        if (statusResult.daysDiff > maxOverdueDays) {
          maxOverdueDays = statusResult.daysDiff;
        }
      }

      if (balancePaise > 0n && !nextDueDate && statusResult.state !== 'PAID') {
        nextDueDate = inst.dueDate;
      }

      return {
        id: inst.id,
        seqNo: inst.seqNo,
        dueDate: inst.dueDate,
        amountDuePaise: inst.amountDuePaise.toString(),
        amountPaidPaise: inst.amountPaidPaise.toString(),
        balancePaise: balancePaise.toString(),
        status: statusResult.state,
        statusLabelEn: statusResult.labelEn,
        statusLabelHi: statusResult.labelHi,
        overdueDays: statusResult.daysDiff > 0 ? statusResult.daysDiff : 0,
      };
    });

    // Identify overdue instalments
    const overdueInstsList = insts.filter((i) => {
      if (i.cancelledAt) return false;
      const bal = i.amountDuePaise > i.amountPaidPaise ? i.amountDuePaise - i.amountPaidPaise : 0n;
      return bal > 0n && i.dueDate <= asOfDate;
    });

    let totalBalancePaise: bigint;
    if (overdueInstsList.length > 0) {
      totalBalancePaise = overdueInstsList.reduce((acc, i) => acc + (i.amountDuePaise - i.amountPaidPaise), 0n);
    } else {
      const nextUnpaid = insts.find((i) => !i.cancelledAt && i.amountDuePaise > i.amountPaidPaise);
      if (nextUnpaid) {
        const [nY, nM, nD] = nextUnpaid.dueDate.split('-').map(Number);
        const [aY, aM, aD] = asOfDate.split('-').map(Number);
        const diffDays = Math.round((Date.UTC(nY, nM - 1, nD) - Date.UTC(aY, aM - 1, aD)) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          totalBalancePaise = nextUnpaid.amountDuePaise - nextUnpaid.amountPaidPaise;
        } else {
          totalBalancePaise = 0n;
        }
      } else {
        totalBalancePaise = 0n;
      }
    }

    let overallStatus: 'PAID' | 'CURRENT' | 'UPCOMING' | 'PART_PAID_OVERDUE' | 'OVERDUE' = 'CURRENT';
    let statusLabelEn = 'Current';
    let statusLabelHi = 'वर्तमान';

    if (totalBalancePaise === 0n) {
      overallStatus = 'PAID';
      statusLabelEn = 'All fees paid';
      statusLabelHi = 'सभी शुल्क चुकता';
    } else if (maxOverdueDays > 0) {
      // Find if part-paid
      const overdueInsts = instalmentViews.filter((i) => i.overdueDays > 0);
      const isPartPaid = overdueInsts.some((i) => BigInt(i.amountPaidPaise) > 0n);
      if (isPartPaid) {
        overallStatus = 'PART_PAID_OVERDUE';
        statusLabelEn = `Part paid, ${maxOverdueDays} days overdue`;
        statusLabelHi = `आंशिक भुगतान, ${maxOverdueDays} दिन अतिदेय`;
      } else {
        overallStatus = 'OVERDUE';
        statusLabelEn = `${maxOverdueDays} days overdue`;
        statusLabelHi = `${maxOverdueDays} दिन अतिदेय`;
      }
    } else {
      overallStatus = 'UPCOMING';
      statusLabelEn = 'Upcoming instalment';
      statusLabelHi = 'आगामी किस्त';
    }

    return {
      studentId: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      centreId: student.centreId,
      centreCode: centre?.code || 'JPR-GPL',
      totalGrossPaise: student.grossFeePaise.toString(),
      totalDiscountPaise: student.discountPaise.toString(),
      totalNetPaise: student.netFeePaise.toString(),
      totalPaidPaise: totalPaid.toString(),
      totalBalancePaise: totalBalancePaise.toString(),
      totalBalanceFormatted: `₹${(Number(totalBalancePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      nextDueDate,
      overdueDays: maxOverdueDays,
      status: overallStatus,
      statusLabelEn,
      statusLabelHi,
      instalments: instalmentViews,
      recentReceipts: studentReceipts.slice(0, 5).map((r) => ({
        id: r.id,
        number: r.number,
        issuedDate: r.issuedDate,
        grossPaise: r.grossPaise.toString(),
        grossFormatted: `₹${(Number(r.grossPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        taxablePaise: r.taxablePaise.toString(),
        cgstPaise: r.cgstPaise.toString(),
        sgstPaise: r.sgstPaise.toString(),
      })),
    };
  }

  // --- GAPLESS SEQUENTIAL RECEIPT & CREDIT NOTE COUNTERS ---
  public async allocateReceiptNumber(gstin: string, fyInput: string, kind: DocumentKind): Promise<string> {
    const fy = this.normalizeDate(fyInput).length === 5 ? fyInput : getFinancialYear(this.normalizeDate(fyInput));
    const lockKey = `counter:${gstin}:${fy}:${kind}`;
    const unlock = await this.lockManager.acquire(lockKey);

    try {
      let counter = this.receiptCounters.find((c) => c.gstin === gstin && c.fy === fy && c.kind === kind);
      if (!counter) {
        counter = { gstin, fy, kind, lastNo: 0 };
        this.receiptCounters.push(counter);
      }
      counter.lastNo += 1;
      const serial = counter.lastNo;

      if (kind === 'RCP') {
        return formatReceiptNumber(fy, serial);
      } else {
        return formatCreditNoteNumber(fy, serial);
      }
    } finally {
      unlock();
    }
  }

  // --- SECTION 269ST CASH LIMIT VALIDATION ---
  public getPriorCashReceivedToday(studentId: string, receivedOnInput: string, excludePaymentId?: string): bigint {
    const student = this.getStudentById(studentId);
    const resolvedStudentId = student ? student.id : studentId;
    const date = this.normalizeDate(receivedOnInput);
    let totalCash = 0n;
    for (const p of this.payments) {
      if (excludePaymentId && p.id === excludePaymentId) {
        continue;
      }
      if (
        p.studentId === resolvedStudentId &&
        p.mode === 'CASH' &&
        p.receivedOn === date &&
        (p.matchStatus === 'MATCHED' || p.matchStatus === 'UNMATCHED_QUEUE')
      ) {
        if (p.amountPaise > 0n) {
          totalCash += p.amountPaise;
        }
      }
    }
    return totalCash;
  }

  public validateSection269ST(
    studentId: string,
    amountPaise: bigint,
    receivedOnInput: string,
    excludePaymentId?: string
  ): { allowed: boolean; problem?: ProblemDetails } {
    const date = this.normalizeDate(receivedOnInput);

    // Hardening Tier A: Single cash transaction check
    if (amountPaise >= SECTION_269ST_LIMIT_PAISE) {
      return {
        allowed: false,
        problem: {
          type: 'https://shikshasetu.example.in/errors/cash-limit-exceeded',
          title: 'Section 269ST Cash Limit Exceeded',
          status: 422,
          code: 'CASH_LIMIT_EXCEEDED',
          detail: `Cash receipt of ₹2,00,000 or more in a single transaction is prohibited under Section 269ST of Income-tax Act. Attempted: ₹${(Number(amountPaise) / 100).toLocaleString('en-IN')}.`,
          invalidParams: [{ name: 'amountPaise', reason: 'Single transaction >= ₹2,00,000' }],
        },
      };
    }

    // Hardening Tier B: Clamped non-negative prior cash
    const rawPrior = this.getPriorCashReceivedToday(studentId, date, excludePaymentId);
    const priorCashTodayPaise = rawPrior > 0n ? rawPrior : 0n;

    // Hardening Tier C: Daily cumulative aggregate check
    if (priorCashTodayPaise + amountPaise >= SECTION_269ST_LIMIT_PAISE) {
      return {
        allowed: false,
        problem: {
          type: 'https://shikshasetu.example.in/errors/cash-limit-exceeded',
          title: 'Section 269ST Daily Cash Limit Exceeded',
          status: 422,
          code: 'CASH_LIMIT_EXCEEDED',
          detail: `Daily cumulative cash receipts of ₹2,00,000 or more from a person is prohibited under Section 269ST. Attempted: ₹${(Number(amountPaise) / 100).toLocaleString('en-IN')}, Prior cash today: ₹${(Number(priorCashTodayPaise) / 100).toLocaleString('en-IN')}.`,
          invalidParams: [{ name: 'amountPaise', reason: 'Daily cumulative cash >= ₹2,00,000' }],
        },
      };
    }

    return { allowed: true };
  }

  // --- RECORD PAYMENT (Online & Webhooks) ---
  public async recordPayment(params: RecordPaymentParams): Promise<RecordPaymentResult> {
    const receivedOn = this.normalizeDate(params.receivedOn);
    const nowIso = new Date().toISOString();

    // 0. Positive Amount Guard
    if (params.amountPaise <= 0n) {
      const error = new Error('Payment amount must be strictly greater than zero');
      (error as any).statusCode = 422;
      (error as any).code = 'INVALID_AMOUNT';
      throw error;
    }

    // 0b. Single-Transaction Section 269ST Guard for CASH
    if (params.mode === 'CASH' && params.amountPaise >= SECTION_269ST_LIMIT_PAISE) {
      const error = new Error(
        `Cash receipt of ₹2,00,000 or more in a single transaction is prohibited under Section 269ST of Income-tax Act. Attempted: ₹${(Number(params.amountPaise) / 100).toLocaleString('en-IN')}.`
      );
      (error as any).statusCode = 422;
      (error as any).code = 'CASH_LIMIT_EXCEEDED';
      (error as any).problem = {
        type: 'https://shikshasetu.example.in/errors/cash-limit-exceeded',
        title: 'Section 269ST Cash Limit Exceeded',
        status: 422,
        code: 'CASH_LIMIT_EXCEEDED',
        detail: error.message,
        invalidParams: [{ name: 'amountPaise', reason: 'Single transaction >= ₹2,00,000' }],
      };
      throw error;
    }

    // 1. Idempotency Check (Fast-path pre-lock)
    if (params.gatewayPaymentId) {
      const existing = this.payments.find((p) => p.gatewayPaymentId === params.gatewayPaymentId);
      if (existing) {
        const existingReceipt = this.receipts.find((r) => r.paymentId === existing.id);
        return {
          success: true,
          outcome: 'DUPLICATE',
          paymentId: existing.id,
          receiptNumber: existingReceipt?.number,
          receiptId: existingReceipt?.id,
          amountPaise: existing.amountPaise.toString(),
          unallocatedPaise: existing.unallocatedPaise.toString(),
        };
      }
    }

    // 2. Unmatched Verification: Missing student info
    if (!params.studentId && !params.studentCode) {
      const unmPayment: Payment = {
        id: `pay_unm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        gatewayPaymentId: params.gatewayPaymentId,
        gatewayOrderId: params.gatewayOrderId || null,
        studentId: null,
        instalmentId: null,
        amountPaise: params.amountPaise,
        mode: params.mode,
        receivedOn,
        receivedAt: nowIso,
        matchStatus: 'UNMATCHED_QUEUE',
        reasonCode: 'NO_REFERENCE',
        unallocatedPaise: params.amountPaise,
        payerName: params.payerName || null,
        payerPhone: params.payerPhone || null,
        bankReference: params.bankReference || null,
        remarks: params.remarks || 'No student reference provided',
        reversesPaymentId: null,
      };
      this.payments.push(unmPayment);
      this.writeAuditLog({ action: 'UNMATCHED_PAYMENT_QUEUED', targetType: 'Payment', targetId: unmPayment.id, afterJson: { reasonCode: 'NO_REFERENCE' } });
      return {
        success: true,
        outcome: 'UNMATCHED_QUEUE',
        paymentId: unmPayment.id,
        amountPaise: params.amountPaise.toString(),
        unallocatedPaise: params.amountPaise.toString(),
        reasonCode: 'NO_REFERENCE',
        detail: 'Payment routed to unmatched queue: missing student reference',
      };
    }

    const student = this.getStudentById(params.studentId || params.studentCode!);
    if (!student || student.status === 'WITHDRAWN') {
      const unmPayment: Payment = {
        id: `pay_unm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        gatewayPaymentId: params.gatewayPaymentId,
        gatewayOrderId: params.gatewayOrderId || null,
        studentId: null,
        instalmentId: null,
        amountPaise: params.amountPaise,
        mode: params.mode,
        receivedOn,
        receivedAt: nowIso,
        matchStatus: 'UNMATCHED_QUEUE',
        reasonCode: 'UNKNOWN_STUDENT',
        unallocatedPaise: params.amountPaise,
        payerName: params.payerName || null,
        payerPhone: params.payerPhone || null,
        bankReference: params.bankReference || null,
        remarks: `Student ${params.studentId || params.studentCode} not found or withdrawn`,
        reversesPaymentId: null,
      };
      this.payments.push(unmPayment);
      this.writeAuditLog({ action: 'UNMATCHED_PAYMENT_QUEUED', targetType: 'Payment', targetId: unmPayment.id, afterJson: { reasonCode: 'UNKNOWN_STUDENT' } });
      return {
        success: true,
        outcome: 'UNMATCHED_QUEUE',
        paymentId: unmPayment.id,
        amountPaise: params.amountPaise.toString(),
        unallocatedPaise: params.amountPaise.toString(),
        reasonCode: 'UNKNOWN_STUDENT',
        detail: 'Payment routed to unmatched queue: student not found or withdrawn',
      };
    }

    // 2b. Section 269ST Statutory Cash Limit Guard before Unmatched Queue routing
    if (params.mode === 'CASH') {
      const check = this.validateSection269ST(student.id, params.amountPaise, receivedOn, params.excludePaymentId);
      if (!check.allowed && check.problem) {
        const error = new Error(check.problem.detail);
        (error as any).statusCode = 422;
        (error as any).code = check.problem.code || 'CASH_LIMIT_EXCEEDED';
        (error as any).problem = check.problem;
        throw error;
      }
    }

    // Check if target instalment cancelled
    if (params.instalmentId) {
      const targetInst = this.getInstalmentById(params.instalmentId);
      if (targetInst && targetInst.cancelledAt) {
        const unmPayment: Payment = {
          id: `pay_unm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          gatewayPaymentId: params.gatewayPaymentId,
          gatewayOrderId: params.gatewayOrderId || null,
          studentId: student.id,
          instalmentId: targetInst.id,
          amountPaise: params.amountPaise,
          mode: params.mode,
          receivedOn,
          receivedAt: nowIso,
          matchStatus: 'UNMATCHED_QUEUE',
          reasonCode: 'CANCELLED_INSTALMENT',
          unallocatedPaise: params.amountPaise,
          payerName: params.payerName || null,
          payerPhone: params.payerPhone || null,
          bankReference: params.bankReference || null,
          remarks: `Target instalment ${targetInst.id} was cancelled`,
          reversesPaymentId: null,
        };
        this.payments.push(unmPayment);
        return {
          success: true,
          outcome: 'UNMATCHED_QUEUE',
          paymentId: unmPayment.id,
          amountPaise: params.amountPaise.toString(),
          unallocatedPaise: params.amountPaise.toString(),
          reasonCode: 'CANCELLED_INSTALMENT',
          detail: 'Payment routed to unmatched queue: target instalment cancelled',
        };
      }
    }

    // Check open balance
    const studentInsts = this.getInstalmentsByStudentId(student.id).filter((i) => !i.cancelledAt);
    const totalOpenBalance = studentInsts.reduce((acc, i) => acc + (i.amountDuePaise > i.amountPaidPaise ? i.amountDuePaise - i.amountPaidPaise : 0n), 0n);

    if (totalOpenBalance === 0n) {
      const unmPayment: Payment = {
        id: `pay_unm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        gatewayPaymentId: params.gatewayPaymentId,
        gatewayOrderId: params.gatewayOrderId || null,
        studentId: student.id,
        instalmentId: null,
        amountPaise: params.amountPaise,
        mode: params.mode,
        receivedOn,
        receivedAt: nowIso,
        matchStatus: 'UNMATCHED_QUEUE',
        reasonCode: 'NO_OPEN_DUES',
        unallocatedPaise: params.amountPaise,
        payerName: params.payerName || null,
        payerPhone: params.payerPhone || null,
        bankReference: params.bankReference || null,
        remarks: `Student ${student.studentCode} has zero open dues`,
        reversesPaymentId: null,
      };
      this.payments.push(unmPayment);
      return {
        success: true,
        outcome: 'UNMATCHED_QUEUE',
        paymentId: unmPayment.id,
        amountPaise: params.amountPaise.toString(),
        unallocatedPaise: params.amountPaise.toString(),
        reasonCode: 'NO_OPEN_DUES',
        detail: 'Payment routed to unmatched queue: student has zero open balance',
      };
    }

    // 3. Acquire Row Locks (Deterministic Order: student, then counter)
    const centre = this.getCentreById(student.centreId)!;
    const fy = getFinancialYear(receivedOn);
    const studentLockKey = `student:${student.id}`;
    const counterLockKey = `counter:${centre.gstin}:${fy}:RCP`;
    const unlock = await this.lockManager.acquire([studentLockKey, counterLockKey]);

    try {
      return await this.withTransaction(async () => {
        // 1. Re-check idempotency under lock (Atomic TOCTOU protection against concurrent replays)
        if (params.gatewayPaymentId) {
          const existingUnderLock = this.payments.find((p) => p.gatewayPaymentId === params.gatewayPaymentId);
          if (existingUnderLock) {
            const existingReceipt = this.receipts.find((r) => r.paymentId === existingUnderLock.id);
            return {
              success: true,
              outcome: 'DUPLICATE',
              paymentId: existingUnderLock.id,
              receiptNumber: existingReceipt?.number,
              receiptId: existingReceipt?.id,
              amountPaise: existingUnderLock.amountPaise.toString(),
              unallocatedPaise: existingUnderLock.unallocatedPaise.toString(),
            };
          }
        }

        // 2. Re-verify Section 269ST statutory cash limit under lock (Atomic serialization of concurrent cash)
        if (params.mode === 'CASH') {
          const check = this.validateSection269ST(student.id, params.amountPaise, receivedOn, params.excludePaymentId);
          if (!check.allowed && check.problem) {
            const error = new Error(check.problem.detail);
            (error as any).statusCode = 422;
            (error as any).code = check.problem.code || 'CASH_LIMIT_EXCEEDED';
            (error as any).problem = check.problem;
            throw error;
          }
        }

        let remainingToAllocate = params.amountPaise;
        const allocationsList: Array<{ instalmentId: string; seqNo: number; allocatedPaise: string; isFullyPaid: boolean; remainingDuePaise: string }> = [];
        const suppressedRemindersList: Array<{ reminderId: string; triggerType: any; state: any; suppressReason: SuppressReason }> = [];

        const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // Sort open instalments: target instalment first if provided, then by dueDate, seqNo
        let sortedInsts = [...studentInsts];
        if (params.instalmentId) {
          const target = sortedInsts.find((i) => i.id === params.instalmentId);
          if (target) {
            sortedInsts = [target, ...sortedInsts.filter((i) => i.id !== params.instalmentId)];
          }
        } else {
          sortedInsts.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.seqNo - b.seqNo);
        }

        for (const inst of sortedInsts) {
          if (remainingToAllocate <= 0n) break;
          const openDue = inst.amountDuePaise > inst.amountPaidPaise ? inst.amountDuePaise - inst.amountPaidPaise : 0n;
          if (openDue <= 0n) continue;

          const allocAmount = remainingToAllocate >= openDue ? openDue : remainingToAllocate;
          inst.amountPaidPaise += allocAmount;
          inst.version += 1;
          remainingToAllocate -= allocAmount;

          this.allocations.push({
            id: `alc_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            paymentId,
            instalmentId: inst.id,
            head: 'TUITION',
            amountPaise: allocAmount,
          });

          const isFullyPaid = inst.amountPaidPaise >= inst.amountDuePaise;
          allocationsList.push({
            instalmentId: inst.id,
            seqNo: inst.seqNo,
            allocatedPaise: allocAmount.toString(),
            isFullyPaid,
            remainingDuePaise: (inst.amountDuePaise > inst.amountPaidPaise ? inst.amountDuePaise - inst.amountPaidPaise : 0n).toString(),
          });

          // Atomic Reminder Suppression if fully paid
          if (isFullyPaid) {
            const queuedReminders = this.reminders.filter((r) => r.instalmentId === inst.id && (r.state === 'QUEUED' || r.state === 'SENT'));
            for (const rem of queuedReminders) {
              rem.state = 'SUPPRESSED_BY_PAYMENT';
              rem.suppressReason = 'PAID_IN_FULL';
              rem.suppressedAt = nowIso;
              rem.suppressPaymentId = paymentId;
              suppressedRemindersList.push({
                reminderId: rem.id,
                triggerType: rem.triggerType,
                state: rem.state,
                suppressReason: 'PAID_IN_FULL',
              });
            }
          }
        }

        const allocatedTotal = params.amountPaise - remainingToAllocate;

        // Gapless Sequential Receipt
        let counter = this.receiptCounters.find((c) => c.gstin === centre.gstin && c.fy === fy && c.kind === 'RCP');
        if (!counter) {
          counter = { gstin: centre.gstin, fy, kind: 'RCP', lastNo: 0 };
          this.receiptCounters.push(counter);
        }
        counter.lastNo += 1;
        const receiptNo = formatReceiptNumber(fy, counter.lastNo);

        const gstSplit = calculateGstReverseSplit(allocatedTotal);
        const receiptId = `rcp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        const receipt: Receipt = {
          id: receiptId,
          paymentId,
          centreId: centre.id,
          gstin: centre.gstin,
          fy,
          kind: 'RCP',
          number: receiptNo,
          issuedAt: nowIso,
          issuedDate: receivedOn,
          grossPaise: allocatedTotal,
          taxablePaise: gstSplit.taxablePaise,
          cgstPaise: gstSplit.cgstPaise,
          sgstPaise: gstSplit.sgstPaise,
          igstPaise: 0n,
          studentId: student.id,
          refundId: null,
          originalReceiptId: null,
          snapshotJson: {
            studentCode: student.studentCode,
            allocations: allocationsList,
            grossPaise: allocatedTotal.toString(),
          },
        };
        this.receipts.push(receipt);

        const payment: Payment = {
          id: paymentId,
          gatewayPaymentId: params.gatewayPaymentId,
          gatewayOrderId: params.gatewayOrderId || null,
          studentId: student.id,
          instalmentId: params.instalmentId || null,
          amountPaise: params.amountPaise,
          mode: params.mode,
          receivedOn,
          receivedAt: nowIso,
          matchStatus: 'MATCHED',
          reasonCode: null,
          unallocatedPaise: remainingToAllocate,
          payerName: params.payerName || student.fullName,
          payerPhone: params.payerPhone || null,
          bankReference: params.bankReference || null,
          remarks: params.remarks || null,
          reversesPaymentId: null,
        };
        this.payments.push(payment);

        this.writeAuditLog({
          actorUserId: params.actorUserId || null,
          role: null,
          action: 'PAYMENT_RECORDED',
          targetType: 'Payment',
          targetId: paymentId,
          afterJson: { receiptNo, amountPaise: params.amountPaise.toString() },
        });

        // Compute updated balance
        const updatedDues = this.getDuesSummary(student.id, receivedOn);

        return {
          success: true,
          outcome: 'MATCHED',
          paymentId,
          receiptNumber: receiptNo,
          receiptId,
          amountPaise: params.amountPaise.toString(),
          gstSplit: {
            grossPaise: gstSplit.grossPaise.toString(),
            taxablePaise: gstSplit.taxablePaise.toString(),
            cgstPaise: gstSplit.cgstPaise.toString(),
            sgstPaise: gstSplit.sgstPaise.toString(),
            igstPaise: '0',
            totalTaxPaise: gstSplit.totalTaxPaise.toString(),
            sacCode: gstSplit.sacCode,
            rateBasisPoints: gstSplit.rateBasisPoints,
          },
          allocations: allocationsList,
          remindersSuppressed: suppressedRemindersList,
          unallocatedPaise: remainingToAllocate.toString(),
          studentBalanceAfterPaise: updatedDues?.totalBalancePaise || '0',
        };
      });
    } finally {
      unlock();
    }
  }

  // --- RECORD OFFLINE CASH PAYMENT (Cashier counter with Section 269ST check) ---
  public async recordOfflinePayment(params: OfflineCashPaymentParams): Promise<RecordPaymentResult> {
    const receivedOn = this.normalizeDate(params.paymentDate);

    // Section 269ST check for CASH
    if (params.mode === 'CASH') {
      const check = this.validateSection269ST(params.studentId, params.amountPaise, receivedOn);
      if (!check.allowed && check.problem) {
        const error = new Error(check.problem.detail);
        (error as any).statusCode = 422;
        (error as any).problem = check.problem;
        throw error;
      }
    }

    return this.recordPayment({
      studentId: params.studentId,
      instalmentId: params.instalmentId,
      amountPaise: params.amountPaise,
      mode: params.mode,
      gatewayPaymentId: `csh_${params.reference}_${Date.now()}`,
      bankReference: params.reference,
      payerName: params.payerName,
      payerPhone: params.payerPhone,
      receivedOn,
      remarks: params.remarks,
      actorUserId: params.actorUserId,
    });
  }

  // --- UNMATCHED PAYMENT QUEUE ---
  public getUnmatchedPayments(status: MatchStatus = 'UNMATCHED_QUEUE'): Payment[] {
    return this.payments.filter((p) => p.matchStatus === status);
  }

  public async resolveUnmatchedPayment(
    paymentId: string,
    targetStudentId: string,
    targetInstalmentId?: string,
    actorUserId?: string
  ): Promise<RecordPaymentResult> {
    const unlock = await this.lockManager.acquire(`payment:${paymentId}`);
    try {
      const payment = this.payments.find((p) => p.id === paymentId);
      if (!payment) throw new Error('Unmatched payment record not found');
      if (payment.matchStatus !== 'UNMATCHED_QUEUE') {
        const error = new Error('Payment is not in unmatched queue');
        (error as any).statusCode = 409;
        throw error;
      }

      const student = this.getStudentById(targetStudentId);
      if (!student) throw new Error('Target student not found');

      const originalStatus = payment.matchStatus;
      payment.matchStatus = 'RESOLVED';
      try {
        // Allocate payment
        const result = await this.recordPayment({
          studentId: student.id,
          instalmentId: targetInstalmentId,
          amountPaise: payment.amountPaise,
          mode: payment.mode,
          gatewayPaymentId: `res_${payment.gatewayPaymentId}_${Date.now()}`,
          bankReference: payment.bankReference || undefined,
          payerName: payment.payerName || student.fullName,
          payerPhone: payment.payerPhone || undefined,
          receivedOn: payment.receivedOn,
          remarks: `Resolved from unmatched queue payment ${payment.id}`,
          actorUserId,
          excludePaymentId: payment.id,
        });

        payment.studentId = student.id;
        this.writeAuditLog({
          actorUserId: actorUserId || null,
          role: 'ACCOUNTS_EXEC',
          action: 'UNMATCHED_PAYMENT_RESOLVED',
          targetType: 'Payment',
          targetId: payment.id,
          afterJson: { targetStudentId: student.id, newPaymentId: result.paymentId },
        });

        return result;
      } catch (err) {
        payment.matchStatus = originalStatus;
        throw err;
      }
    } finally {
      unlock();
    }
  }

  public async rejectUnmatchedPayment(paymentId: string, reason: string, actorUserId?: string): Promise<Payment> {
    const unlock = await this.lockManager.acquire(`payment:${paymentId}`);
    try {
      const payment = this.payments.find((p) => p.id === paymentId);
      if (!payment) throw new Error('Unmatched payment record not found');
      if (payment.matchStatus !== 'UNMATCHED_QUEUE') {
        const error = new Error('Payment is not in unmatched queue');
        (error as any).statusCode = 409;
        throw error;
      }

      payment.matchStatus = 'REJECTED';
      payment.remarks = `Rejected: ${reason}`;
      this.writeAuditLog({
        actorUserId: actorUserId || null,
        role: 'ACCOUNTS_EXEC',
        action: 'UNMATCHED_PAYMENT_REJECTED',
        targetType: 'Payment',
        targetId: payment.id,
        afterJson: { reason },
      });

      return payment;
    } finally {
      unlock();
    }
  }

  // --- REMINDERS OUTBOX & EXECUTION RUN ---
  public getReminders(filters?: ReminderFilters): Reminder[] {
    let list = this.reminders;
    if (filters?.studentId) {
      const student = this.getStudentById(filters.studentId);
      list = list.filter((r) => r.studentId === student?.id);
    }
    if (filters?.state) {
      list = list.filter((r) => r.state === filters.state);
    }
    if (filters?.triggerType) {
      list = list.filter((r) => r.triggerType === filters.triggerType);
    }
    if (filters?.scheduledFor) {
      list = list.filter((r) => r.scheduledFor === filters.scheduledFor);
    }
    if (filters?.centreId && filters.centreId !== 'ALL') {
      const centre = this.centres.find((c) => c.id === filters.centreId || c.code === filters.centreId);
      list = list.filter((r) => {
        const student = this.getStudentById(r.studentId);
        return student?.centreId === centre?.id || student?.centreId === filters.centreId;
      });
    }
    return [...list];
  }

  public async triggerReminderRun(asOfDateInput?: string): Promise<{ sentCount: number; suppressedCount: number }> {
    const asOfDate = this.normalizeDate(asOfDateInput);
    const nowIso = new Date().toISOString();
    let sentCount = 0;
    let suppressedCount = 0;

    for (const rem of this.reminders) {
      if (rem.state !== 'QUEUED') continue;
      if (rem.scheduledFor > asOfDate) continue;

      const inst = this.getInstalmentById(rem.instalmentId);
      if (!inst) continue;

      // If already fully paid: auto-suppress
      if (inst.amountPaidPaise >= inst.amountDuePaise) {
        rem.state = 'SUPPRESSED_BY_PAYMENT';
        rem.suppressReason = 'PAID_IN_FULL';
        rem.suppressedAt = nowIso;
        suppressedCount++;
        continue;
      }

      // Check quiet period: payment received within 24 hours
      const recentPayment = this.payments.find((p) => p.studentId === rem.studentId && isInsideQuietPeriod(p.receivedAt, `${asOfDate}T12:00:00Z`));
      if (recentPayment) {
        // Suppress or defer
        continue;
      }

      rem.state = 'SENT';
      rem.sentAt = `${asOfDate}T10:00:00Z`;
      rem.providerMessageId = `msg_${rem.id}_${Date.now()}`;
      sentCount++;
    }

    return { sentCount, suppressedCount };
  }

  // --- REFUND WORKFLOW & SEGREGATION OF DUTIES ---
  public getRefundRequests(status?: RefundStatus): RefundRequest[] {
    if (status) {
      return this.refundRequests.filter((r) => r.status === status);
    }
    return [...this.refundRequests];
  }

  public getRefundRequestById(id: string): RefundRequest | undefined {
    return this.refundRequests.find((r) => r.id === id);
  }

  public async raiseRefund(params: RaiseRefundParams): Promise<RefundRequest> {
    const student = this.getStudentById(params.studentId);
    if (!student) throw new Error('Student not found');
    const receivedOn = this.normalizeDate(params.receivedOn);

    const insts = this.getInstalmentsByStudentId(student.id);
    const totalPaidPaise = insts.reduce((acc, i) => acc + i.amountPaidPaise, 0n);

    // Compute pro-rata refund
    const batch = this.batches.find((b) => b.id === student.batchId);
    const totalCourseDays = batch?.courseDays || 365;

    // Days elapsed from enrolment to receivedOn
    const enrolDate = new Date(student.enrolmentDate);
    const recDate = new Date(receivedOn);
    const daysElapsed = Math.max(0, Math.floor((recDate.getTime() - enrolDate.getTime()) / (1000 * 60 * 60 * 24)));

    const heads = insts.flatMap((i) => this.getInstalmentHeads(i.id));
    const tuitionHead = heads.filter((h) => h.head === 'TUITION');
    const hostelHead = heads.filter((h) => h.head === 'HOSTEL');
    const messHead = heads.filter((h) => h.head === 'MESS');

    const tuitionNet = tuitionHead.reduce((acc, h) => acc + h.amountDuePaise, 0n);
    const tuitionPaid = tuitionHead.reduce((acc, h) => acc + h.amountPaidPaise, 0n);

    const hostelNet = hostelHead.reduce((acc, h) => acc + h.amountDuePaise, 0n);
    const hostelPaid = hostelHead.reduce((acc, h) => acc + h.amountPaidPaise, 0n);

    const messNet = messHead.reduce((acc, h) => acc + h.amountDuePaise, 0n);
    const messPaid = messHead.reduce((acc, h) => acc + h.amountPaidPaise, 0n);

    const headsList: RefundHeadInput[] = [
      { head: 'TUITION', netFeePaise: tuitionNet, totalPaidPaise: tuitionPaid, courseDays: totalCourseDays },
      { head: 'HOSTEL', netFeePaise: hostelNet, totalPaidPaise: hostelPaid, courseDays: totalCourseDays },
      { head: 'MESS', netFeePaise: messNet, totalPaidPaise: messPaid, courseDays: totalCourseDays },
    ];

    const proRata = computeProRataRefund(receivedOn, headsList, daysElapsed, receivedOn);

    const slaDue = new Date(recDate);
    slaDue.setDate(slaDue.getDate() + 10);
    const slaDueDate = slaDue.toISOString().slice(0, 10);

    const refundId = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const refund: RefundRequest = {
      id: refundId,
      studentId: student.id,
      receivedOn,
      daysElapsed,
      totalCourseDays,
      netFeePaise: student.netFeePaise,
      totalPaidPaise,
      consumedPaise: proRata.totalConsumedPaise,
      refundablePaise: proRata.totalRefundablePaise,
      shortfallPaise: proRata.totalShortfallPaise,
      slaDueDate,
      status: 'DRAFT',
      raisedBy: params.actorUserId,
      approvedBy: null,
      settledOn: null,
      settlementMode: null,
      bankReference: null,
      creditNoteId: null,
    };

    this.refundRequests.push(refund);
    this.writeAuditLog({
      actorUserId: params.actorUserId,
      role: 'ACCOUNTS_EXEC',
      action: 'REFUND_RAISED',
      targetType: 'RefundRequest',
      targetId: refund.id,
      afterJson: { refundablePaise: proRata.totalRefundablePaise.toString() },
    });

    return refund;
  }

  // Director Approval with Strict Segregation of Duties
  public async approveRefund(refundId: string, approverUserId: string): Promise<RefundRequest> {
    const refund = this.refundRequests.find((r) => r.id === refundId);
    if (!refund) throw new Error('Refund request not found');
    if (refund.status !== 'DRAFT') throw new Error('Only DRAFT refunds can be approved');

    // CRITICAL HARD STATUTORY GUARD: Segregation of duties
    if (refund.raisedBy === approverUserId) {
      const error = new Error('Segregation of Duties: Approver cannot be the raiser of the refund');
      (error as any).statusCode = 403;
      (error as any).code = 'REFUND_SELF_APPROVAL_FORBIDDEN';
      throw error;
    }

    const approver = this.getUserById(approverUserId);
    if (approver?.role !== 'DIRECTOR') {
      const error = new Error('Only a DIRECTOR can approve refunds');
      (error as any).statusCode = 403;
      (error as any).code = 'FORBIDDEN_ROLE';
      throw error;
    }

    return this.withTransaction(async () => {
      refund.status = 'APPROVED';
      refund.approvedBy = approverUserId;

      const nowIso = new Date().toISOString();

      // Cancel remaining unpaid instalments for student
      const studentInsts = this.getInstalmentsByStudentId(refund.studentId);
      for (const inst of studentInsts) {
        if (!inst.cancelledAt && inst.amountPaidPaise < inst.amountDuePaise) {
          inst.cancelledAt = nowIso;
          inst.refundId = refund.id;

          // Atomically suppress queued reminders on cancelled instalments
          const queuedReminders = this.reminders.filter((r) => r.instalmentId === inst.id && r.state === 'QUEUED');
          for (const rem of queuedReminders) {
            rem.state = 'SUPPRESSED_BY_PAYMENT';
            rem.suppressReason = 'REFUND';
            rem.suppressedAt = nowIso;
          }
        }
      }

      // Mark student as WITHDRAWN
      const student = this.getStudentById(refund.studentId);
      if (student) {
        student.status = 'WITHDRAWN';
        student.withdrawnAt = nowIso;
      }

      this.writeAuditLog({
        actorUserId: approverUserId,
        role: 'DIRECTOR',
        action: 'REFUND_APPROVED',
        targetType: 'RefundRequest',
        targetId: refund.id,
      });

      return refund;
    });
  }

  // Settle Refund and Issue Sequential Credit Note
  public async settleRefund(refundId: string, params: SettleRefundParams): Promise<{ refund: RefundRequest; creditNote: Receipt }> {
    const refund = this.refundRequests.find((r) => r.id === refundId);
    if (!refund) throw new Error('Refund request not found');
    if (refund.status !== 'APPROVED') throw new Error('Only APPROVED refunds can be settled');

    const student = this.getStudentById(refund.studentId)!;
    const centre = this.getCentreById(student.centreId)!;
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const fy = getFinancialYear(today);

    const creditNoteNumber = await this.allocateReceiptNumber(centre.gstin, fy, 'CN');
    const gstSplit = calculateGstReverseSplit(refund.refundablePaise);
    const cnId = `cn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const creditNote: Receipt = {
      id: cnId,
      paymentId: null,
      centreId: centre.id,
      gstin: centre.gstin,
      fy,
      kind: 'CN',
      number: creditNoteNumber,
      issuedAt: nowIso,
      issuedDate: today,
      grossPaise: refund.refundablePaise,
      taxablePaise: gstSplit.taxablePaise,
      cgstPaise: gstSplit.cgstPaise,
      sgstPaise: gstSplit.sgstPaise,
      igstPaise: 0n,
      studentId: student.id,
      refundId: refund.id,
      originalReceiptId: null,
      snapshotJson: {
        studentCode: student.studentCode,
        refundId: refund.id,
        refundablePaise: refund.refundablePaise.toString(),
      },
    };
    this.receipts.push(creditNote);

    refund.status = 'SETTLED';
    refund.settledOn = today;
    refund.settlementMode = params.settlementMode;
    refund.bankReference = params.bankReference;
    refund.creditNoteId = creditNote.id;

    this.writeAuditLog({
      actorUserId: params.actorUserId,
      role: 'ACCOUNTS_EXEC',
      action: 'REFUND_SETTLED',
      targetType: 'RefundRequest',
      targetId: refund.id,
      afterJson: { creditNoteNumber, amountPaise: refund.refundablePaise.toString() },
    });

    return { refund, creditNote };
  }

  // --- DPDP CONSENT GRANT & WITHDRAWAL ---
  public getConsentsByStudentId(studentId: string): DpdpConsent[] {
    const student = this.getStudentById(studentId);
    if (!student) return [];
    return this.consents.filter((c) => c.studentId === student.id);
  }

  public hasActiveConsent(studentId: string, parentUserId?: string, purpose: ConsentPurposeCode = 'CORE_EDUCATION_FEES'): boolean {
    const student = this.getStudentById(studentId);
    if (!student) return false;
    return this.consents.some((c) =>
      c.studentId === student.id &&
      (!parentUserId || c.parentUserId === parentUserId) &&
      (!purpose || c.purposeCode === purpose) &&
      !c.withdrawnAt
    );
  }

  public async grantConsent(
    studentId: string,
    parentUserId: string,
    purpose: ConsentPurposeCode,
    lang: PreferredLang = 'en',
    guardianDobYear?: number,
    guardianIdLast4?: string
  ): Promise<DpdpConsent> {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');

    if (guardianDobYear !== undefined || guardianIdLast4 !== undefined) {
      const guardian =
        this.guardians.find((g) => g.studentId === student.id && (g.userId === parentUserId || g.isPrimary)) ||
        this.guardians.find((g) => g.studentId === student.id);

      const admissionLast4 = guardian?.idLast4 || '';
      const providedLast4 = guardianIdLast4 || '';
      const guardianAge = guardianDobYear ? 2026 - guardianDobYear : 0;

      const kyc = verifyAdultGuardianKyc(admissionLast4, providedLast4, guardianAge);
      if (!kyc.verified) {
        const error = new Error(kyc.error || 'Parent/guardian must be at least 18 years old to grant consent under DPDP Act');
        (error as any).statusCode = 422;
        (error as any).code = 'CONSENT_FAILED';
        throw error;
      }
    }

    const existing = this.consents.find((c) => c.studentId === student.id && c.parentUserId === parentUserId && c.purposeCode === purpose);
    if (existing) {
      existing.withdrawnAt = null;
      existing.grantedAt = new Date().toISOString();
      return existing;
    }

    const consent: DpdpConsent = {
      id: `cns_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      studentId: student.id,
      parentUserId,
      purposeCode: purpose,
      noticeVersion: 1,
      languageShown: lang,
      grantedAt: new Date().toISOString(),
      withdrawnAt: null,
    };
    this.consents.push(consent);
    this.writeAuditLog({
      actorUserId: parentUserId,
      role: 'PARENT',
      action: 'DPDP_CONSENT_GRANTED',
      targetType: 'DpdpConsent',
      targetId: consent.id,
      afterJson: { purpose },
    });

    return consent;
  }

  public async withdrawConsent(studentId: string, parentUserId: string, purpose: ConsentPurposeCode): Promise<void> {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found');

    const consent = this.consents.find(
      (c) => c.studentId === student.id &&
      (!parentUserId || c.parentUserId === parentUserId) &&
      c.purposeCode === purpose &&
      !c.withdrawnAt
    );
    if (consent) {
      consent.withdrawnAt = new Date().toISOString();
    }

    // Atomic cascade: suppress queued reminders for student if purpose is WHATSAPP_REMINDERS
    if (purpose === 'WHATSAPP_REMINDERS') {
      const nowIso = new Date().toISOString();
      const queued = this.reminders.filter((r) => r.studentId === student.id && r.state === 'QUEUED');
      for (const rem of queued) {
        rem.state = 'SUPPRESSED_BY_PAYMENT';
        rem.suppressReason = 'CONSENT_WITHDRAWN';
        rem.suppressedAt = nowIso;
      }
    }

    this.writeAuditLog({
      actorUserId: parentUserId,
      role: 'PARENT',
      action: 'DPDP_CONSENT_WITHDRAWN',
      targetType: 'DpdpConsent',
      targetId: consent?.id || 'none',
      afterJson: { purpose },
    });
  }

  // --- MULTI-CENTRE AGEING & ADMIN DASHBOARD ---
  public getMultiCentreAgeing(asOfDateInput?: string, filterCentreId?: string, filterBatchId?: string): MultiCentreAgeingResult {
    const asOfDate = this.normalizeDate(asOfDateInput);

    let centresToScan = this.centres;
    if (filterCentreId && filterCentreId !== 'ALL') {
      centresToScan = centresToScan.filter((c) => c.id === filterCentreId || c.code === filterCentreId);
    }

    const matchingBatchIds = new Set(
      filterBatchId && filterBatchId !== 'ALL'
        ? this.batches
            .filter(
              (b) =>
                b.id === filterBatchId ||
                b.code === filterBatchId ||
                b.stream === filterBatchId ||
                b.code.startsWith(filterBatchId) ||
                b.code.includes(filterBatchId)
            )
            .map((b) => b.id)
        : []
    );

    const centreTotals = centresToScan.map((centre) => {
      let centreStudents = this.students.filter((s) => s.centreId === centre.id);
      if (matchingBatchIds.size > 0) {
        centreStudents = centreStudents.filter((s) => matchingBatchIds.has(s.batchId));
      }
      let cur = 0n;
      let d1 = 0n;
      let d31 = 0n;
      let d61 = 0n;

      for (const st of centreStudents) {
        const insts = this.getInstalmentsByStudentId(st.id).filter((i) => !i.cancelledAt);
        for (const inst of insts) {
          const balance = inst.amountDuePaise > inst.amountPaidPaise ? inst.amountDuePaise - inst.amountPaidPaise : 0n;
          if (balance <= 0n) continue;

          const stResult = computeInstalmentStatus(
            inst.amountDuePaise,
            inst.amountPaidPaise,
            inst.dueDate,
            asOfDate,
            inst.cancelledAt
          );

          if (stResult.daysDiff <= 0) {
            cur += balance;
          } else if (stResult.daysDiff <= 30) {
            d1 += balance;
          } else if (stResult.daysDiff <= 60) {
            d31 += balance;
          } else {
            d61 += balance;
          }
        }
      }

      const totalOpen = cur + d1 + d31 + d61;
      return {
        centreId: centre.id,
        centreCode: centre.code,
        centreName: centre.name,
        studentCount: centreStudents.length,
        currentPaise: cur.toString(),
        d1_30Paise: d1.toString(),
        d31_60Paise: d31.toString(),
        d61_plusPaise: d61.toString(),
        totalOpenPaise: totalOpen.toString(),
      };
    });

    const sumCurrent = centreTotals.reduce((acc, c) => acc + BigInt(c.currentPaise), 0n);
    const sumD1_30 = centreTotals.reduce((acc, c) => acc + BigInt(c.d1_30Paise), 0n);
    const sumD31_60 = centreTotals.reduce((acc, c) => acc + BigInt(c.d31_60Paise), 0n);
    const sumD61_plus = centreTotals.reduce((acc, c) => acc + BigInt(c.d61_plusPaise), 0n);
    const overallTotalOpen = sumCurrent + sumD1_30 + sumD31_60 + sumD61_plus;

    const fmt = (p: bigint) => `₹${(Number(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return {
      asOfDate,
      centreTotals,
      overallTotals: {
        currentPaise: sumCurrent.toString(),
        d1_30Paise: sumD1_30.toString(),
        d31_60Paise: sumD31_60.toString(),
        d61_plusPaise: sumD61_plus.toString(),
        totalOpenPaise: overallTotalOpen.toString(),
        currentFormatted: fmt(sumCurrent),
        d1_30Formatted: fmt(sumD1_30),
        d31_60Formatted: fmt(sumD31_60),
        d61_plusFormatted: fmt(sumD61_plus),
        totalOpenFormatted: fmt(overallTotalOpen),
      },
    };
  }

  public getAdminDashboardKpis(asOfDateInput?: string, filterCentreId?: string, filterBatchId?: string): AdminDashboardKpis {
    const asOfDate = this.normalizeDate(asOfDateInput);
    const ageing = this.getMultiCentreAgeing(asOfDate, filterCentreId, filterBatchId);

    const matchingBatchIds = new Set(
      filterBatchId && filterBatchId !== 'ALL'
        ? this.batches
            .filter(
              (b) =>
                b.id === filterBatchId ||
                b.code === filterBatchId ||
                b.stream === filterBatchId ||
                b.code.startsWith(filterBatchId) ||
                b.code.includes(filterBatchId)
            )
            .map((b) => b.id)
        : []
    );

    let eligibleStudents = this.students;
    if (filterCentreId && filterCentreId !== 'ALL') {
      eligibleStudents = eligibleStudents.filter((s) => s.centreId === filterCentreId);
    }
    if (matchingBatchIds.size > 0) {
      eligibleStudents = eligibleStudents.filter((s) => matchingBatchIds.has(s.batchId));
    }
    const eligibleStudentIds = new Set(eligibleStudents.map((s) => s.id));

    let totalBilled = 0n;
    let totalCollected = 0n;

    for (const inst of this.instalments) {
      if (!inst.cancelledAt && eligibleStudentIds.has(inst.studentId)) {
        totalBilled += inst.amountDuePaise;
        totalCollected += inst.amountPaidPaise;
      }
    }

    const totalOverduePaise = BigInt(ageing.overallTotals.d1_30Paise) + BigInt(ageing.overallTotals.d31_60Paise) + BigInt(ageing.overallTotals.d61_plusPaise);
    const collectionEfficiencyPercent = totalBilled > 0n ? Number((totalCollected * 10000n) / totalBilled) / 100 : 0;

    const unmatchedQueue = this.getUnmatchedPayments('UNMATCHED_QUEUE');
    const unmatchedQueuePaise = unmatchedQueue.reduce((acc, p) => acc + p.amountPaise, 0n);

    return {
      asOfDate,
      totalStudents: eligibleStudents.length,
      totalBilledPaise: totalBilled.toString(),
      totalCollectedPaise: totalCollected.toString(),
      totalOverduePaise: totalOverduePaise.toString(),
      collectionEfficiencyPercent,
      highRiskDropoutCount: this.dropoutFlags.filter((f) => f.score >= 70).length,
      unmatchedQueueCount: unmatchedQueue.length,
      unmatchedQueuePaise: unmatchedQueuePaise.toString(),
    };
  }

  // --- DROPOUT RISK QUEUE ---
  public getDropoutFlags(): DropoutFlag[] {
    return [...this.dropoutFlags];
  }

  // --- TALLY PRIME EXPORT ---
  public generateTallyXmlExport(fromDateInput: string, toDateInput: string): string {
    const fromDate = this.normalizeDate(fromDateInput);
    const toDate = this.normalizeDate(toDateInput);

    const qualifyingReceipts = this.receipts.filter(
      (r) => r.issuedDate >= fromDate && r.issuedDate <= toDate && r.kind === 'RCP'
    );

    const entries: TallyReceiptEntry[] = qualifyingReceipts.map((r) => {
      const centre = this.centres.find((c) => c.id === r.centreId);
      return {
        centreCode: centre?.code || 'JPR-GPL',
        voucherNumber: r.number,
        date: r.issuedDate,
        studentCode: (r.snapshotJson?.studentCode as string) || 'Student',
        narration: `Fee receipt for ${r.snapshotJson?.studentCode || 'Student'}`,
        paymentMode: 'NET_BANKING',
        grossPaise: r.grossPaise,
        taxablePaise: r.taxablePaise,
        cgstPaise: r.cgstPaise,
        sgstPaise: r.sgstPaise,
      };
    });

    const xmls = entries.map(buildReceiptVoucherXml);
    return buildTallyXmlEnvelope(xmls);
  }

  public generateTallyCsvExport(fromDateInput: string, toDateInput: string): string {
    const fromDate = this.normalizeDate(fromDateInput);
    const toDate = this.normalizeDate(toDateInput);

    const qualifyingReceipts = this.receipts.filter(
      (r) => r.issuedDate >= fromDate && r.issuedDate <= toDate && r.kind === 'RCP'
    );

    const entries: TallyReceiptEntry[] = qualifyingReceipts.map((r) => {
      const centre = this.centres.find((c) => c.id === r.centreId);
      return {
        centreCode: centre?.code || 'JPR-GPL',
        voucherNumber: r.number,
        date: r.issuedDate,
        studentCode: (r.snapshotJson?.studentCode as string) || 'Student',
        narration: `Fee receipt for ${r.snapshotJson?.studentCode || 'Student'}`,
        paymentMode: 'NET_BANKING',
        grossPaise: r.grossPaise,
        taxablePaise: r.taxablePaise,
        cgstPaise: r.cgstPaise,
        sgstPaise: r.sgstPaise,
      };
    });

    return generateTallyAuditCsv(entries);
  }

  // --- AUDIT TRAIL ---
  public writeAuditLog(entry: {
    actorUserId?: string | null;
    role?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    beforeJson?: Record<string, unknown> | null;
    afterJson?: Record<string, unknown> | null;
  }): void {
    this.auditLog.push({
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      at: new Date().toISOString(),
      actorUserId: entry.actorUserId || null,
      role: entry.role || null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      beforeJson: entry.beforeJson || null,
      afterJson: entry.afterJson || null,
    });
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  // --- ACADEMIC RECORDS & BULK CSV UPLOAD (TC-19) ---
  public getAcademicsByStudentId(studentId: string): AcademicRecord | undefined {
    const student = this.getStudentById(studentId);
    const resolvedId = student ? student.id : studentId;
    return this.academics.find((a) => a.studentId === resolvedId);
  }

  public async processAcademicCsvUpload(
    csvContent: string,
    filename: string = 'academic_upload.csv',
    actorUserId?: string,
    actorRole?: string
  ): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    fileHash: string;
    importedCount: number;
    errors: CsvLineError[];
  }> {
    const parseResult = parseAcademicCsv(csvContent);

    // Duplicate SHA-256 check
    if (this.uploadedCsvHashes.has(parseResult.fileHash)) {
      return {
        success: false,
        error: 'DUPLICATE_FILE',
        message: 'This CSV file has already been processed (duplicate SHA-256 hash). Identical upload refused.',
        fileHash: parseResult.fileHash,
        importedCount: 0,
        errors: [{ lineNumber: 1, error: 'Duplicate file upload refused: identical SHA-256 hash already processed' }],
      };
    }

    if (!parseResult.valid || parseResult.errors.length > 0) {
      return {
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'One or more rows failed line-by-line validation. Nothing imported (all-or-nothing rollback).',
        fileHash: parseResult.fileHash,
        importedCount: 0,
        errors: parseResult.errors,
      };
    }

    // Verify all student codes exist in repository prior to mutating
    const unresolvedErrors: CsvLineError[] = [];
    const studentMap = new Map<string, Student>();

    for (const row of parseResult.validRows) {
      const student = this.getStudentByCode(row.studentCode);
      if (!student) {
        unresolvedErrors.push({
          lineNumber: row.lineNumber,
          studentCode: row.studentCode,
          field: 'studentCode',
          error: `Student code '${row.studentCode}' not found in database.`,
        });
      } else {
        studentMap.set(row.studentCode, student);
      }
    }

    if (unresolvedErrors.length > 0) {
      return {
        success: false,
        error: 'STUDENT_NOT_FOUND',
        message: 'One or more student codes not found. Nothing imported (all-or-nothing rollback).',
        fileHash: parseResult.fileHash,
        importedCount: 0,
        errors: unresolvedErrors,
      };
    }

    // Atomic execution with transaction snapshot
    return await this.withTransaction(async () => {
      for (const row of parseResult.validRows) {
        const student = studentMap.get(row.studentCode)!;
        const existing = this.academics.find((a) => a.studentId === student.id);
        if (existing) {
          existing.prevAttendancePercent = existing.attendancePercent;
          existing.attendancePercent = row.attendancePercent;
          existing.testScores = [...existing.testScores, row.testPercentile];
        } else {
          this.academics.push({
            studentId: student.id,
            attendancePercent: row.attendancePercent,
            prevAttendancePercent: row.attendancePercent,
            testScores: [row.testPercentile],
          });
        }
      }

      this.uploadedCsvHashes.add(parseResult.fileHash);

      this.writeAuditLog({
        actorUserId: actorUserId || 'SYSTEM',
        role: actorRole || 'ACCOUNTS_EXEC',
        action: 'CSV_ACADEMIC_UPLOAD',
        targetType: 'ACADEMIC_RECORD',
        targetId: filename,
        beforeJson: null,
        afterJson: {
          fileHash: parseResult.fileHash,
          importedCount: parseResult.validRows.length,
          filename,
        },
      });

      return {
        success: true,
        fileHash: parseResult.fileHash,
        importedCount: parseResult.validRows.length,
        errors: [],
      };
    });
  }
}

// Global singleton repository instance
let globalRepo: ShikshaSetuRepository | null = null;

export function getRepository(): ShikshaSetuRepository {
  if (!globalRepo) {
    globalRepo = new ShikshaSetuRepository();
  }
  return globalRepo;
}
