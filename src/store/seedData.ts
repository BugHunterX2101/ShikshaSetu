// src/store/seedData.ts
// Deterministic Seed Dataset for ShikshaSetu (Company A, Jaipur: 4 centres, 2,600 students)

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
  DpdpConsent,
  AcademicRecord,
  DropoutFlag,
  ReminderTriggerType,
} from './types';
import { calculateGstReverseSplit } from '../domain/gst';

export const ANCHOR_DATE = '2026-11-02';

// 1. The 4 Jaipur Centres
export const JAIPUR_CENTRES: Centre[] = [
  {
    id: 'ctr-jpr-gpl',
    code: 'JPR-GPL',
    name: 'Gopalpura Bypass (Main Centre)',
    gstin: '08AAAAA0000A1Z5',
    registrationNo: 'RJ-COACH-2025-0412',
    address: 'Plot 12, Commercial Belt, Gopalpura Bypass, Tonk Road, Jaipur, Rajasthan 302018',
  },
  {
    id: 'ctr-jpr-vsh',
    code: 'JPR-VSH',
    name: 'Vaishali Nagar Centre',
    gstin: '08AAAAA0000A2Z4',
    registrationNo: 'RJ-COACH-2025-0219',
    address: 'Plot 45, Amrapali Circle, Vaishali Nagar, Jaipur, Rajasthan 302021',
  },
  {
    id: 'ctr-jpr-mns',
    code: 'JPR-MNS',
    name: 'Mansarovar Centre',
    gstin: '08AAAAA0000A3Z3',
    registrationNo: 'RJ-COACH-2025-0587',
    address: 'Sector 3, Madhyam Marg, Mansarovar, Jaipur, Rajasthan 302020',
  },
  {
    id: 'ctr-jpr-skr',
    code: 'JPR-SKR',
    name: 'Sikar Road Centre',
    gstin: '08AAAAA0000A4Z2',
    registrationNo: 'RJ-COACH-2025-0999',
    address: 'Opposite Road No. 1, Sikar Road, Vidyadhar Nagar, Jaipur, Rajasthan 302039',
  },
];

// 2. Batches across Jaipur Centres
export const INITIAL_BATCHES: Batch[] = [
  {
    id: 'batch-jee-27m-gpl',
    centreId: 'ctr-jpr-gpl',
    code: 'JEE-2027-M-GPL',
    name: 'JEE 2027 Morning Batch (Gopalpura)',
    stream: 'JEE',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    courseDays: 365,
    baseFeePaise: 12000000n, // ₹1,20,000
    instalmentCount: 4,
  },
  {
    id: 'batch-jee-27e-gpl',
    centreId: 'ctr-jpr-gpl',
    code: 'JEE-2027-E-GPL',
    name: 'JEE 2027 Evening Batch (Gopalpura)',
    stream: 'JEE',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    courseDays: 365,
    baseFeePaise: 12000000n,
    instalmentCount: 4,
  },
  {
    id: 'batch-neet-27m-vsh',
    centreId: 'ctr-jpr-vsh',
    code: 'NEET-2027-M-VSH',
    name: 'NEET 2027 Morning Batch (Vaishali)',
    stream: 'NEET',
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    courseDays: 365,
    baseFeePaise: 12000000n,
    instalmentCount: 3,
  },
  {
    id: 'batch-jee-27m-mns',
    centreId: 'ctr-jpr-mns',
    code: 'JEE-2027-M-MNS',
    name: 'JEE 2027 Morning Batch (Mansarovar)',
    stream: 'JEE',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    courseDays: 365,
    baseFeePaise: 12000000n,
    instalmentCount: 4,
  },
  {
    id: 'batch-neet-27m-skr',
    centreId: 'ctr-jpr-skr',
    code: 'NEET-2027-M-SKR',
    name: 'NEET 2027 Morning Batch (Sikar Road)',
    stream: 'NEET',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    courseDays: 365,
    baseFeePaise: 12000000n,
    instalmentCount: 4,
  },
];

// 3. System Users & Personas
export const INITIAL_USERS: User[] = [
  {
    id: 'usr-dir-01',
    phone: '9829000001',
    email: 'director@shikshasetu.in',
    name: 'Dr. Vikram Singhania',
    role: 'DIRECTOR',
    preferredLang: 'en',
    isActive: true,
    phoneVerifiedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-acc-01',
    phone: '9829000002',
    email: 'accounts.gpl@shikshasetu.in',
    name: 'Ramesh Verma',
    role: 'ACCOUNTS_EXEC',
    preferredLang: 'hi',
    isActive: true,
    phoneVerifiedAt: '2026-01-01T00:00:00Z',
    assignedCentreIds: ['ctr-jpr-gpl'],
  },
  {
    id: 'usr-acc-02',
    phone: '9829000003',
    email: 'accounts.vsh@shikshasetu.in',
    name: 'Priya Sen',
    role: 'ACCOUNTS_EXEC',
    preferredLang: 'en',
    isActive: true,
    phoneVerifiedAt: '2026-01-01T00:00:00Z',
    assignedCentreIds: ['ctr-jpr-vsh'],
  },
  {
    id: 'usr-cns-01',
    phone: '9829000004',
    email: 'counsellor@shikshasetu.in',
    name: 'Neha Agarwal',
    role: 'COUNSELLOR',
    preferredLang: 'hi',
    isActive: true,
    phoneVerifiedAt: '2026-01-01T00:00:00Z',
  },
  // Canonical Parents
  {
    id: 'usr-par-0412',
    phone: '9829041200',
    email: 'rajesh.meena@example.com',
    name: 'Rajesh Meena',
    role: 'PARENT',
    preferredLang: 'hi',
    isActive: true,
    phoneVerifiedAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'usr-par-0587',
    phone: '9829058700',
    email: 'sunita.sharma@example.com',
    name: 'Sunita Sharma',
    role: 'PARENT',
    preferredLang: 'hi',
    isActive: true,
    phoneVerifiedAt: '2026-04-01T10:30:00Z',
  },
  {
    id: 'usr-par-0219',
    phone: '9829021900',
    email: 'ramavtar.gurjar@example.com',
    name: 'Ramavtar Gurjar',
    role: 'PARENT',
    preferredLang: 'en',
    isActive: true,
    phoneVerifiedAt: '2026-07-01T11:00:00Z',
  },
];

// Linear Congruential Generator for reproducible, fast generation of 2,600 student context
class LCG {
  private state: number;
  constructor(seed: number = 42) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
  range(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
}

// Initial Unmatched Queue Items
export const INITIAL_UNMATCHED_PAYMENTS: Payment[] = [
  {
    id: 'pay_unm_001',
    gatewayPaymentId: 'pay_unm_ref_001',
    gatewayOrderId: null,
    studentId: null,
    instalmentId: null,
    amountPaise: 3000000n, // ₹30,000
    mode: 'BANK_TRANSFER',
    receivedOn: '2026-11-01',
    receivedAt: '2026-11-01T14:30:00Z',
    matchStatus: 'UNMATCHED_QUEUE',
    reasonCode: 'NO_REFERENCE',
    unallocatedPaise: 3000000n,
    payerName: 'Suresh Sharma',
    payerPhone: '9829111222',
    bankReference: 'UTRIBKL26304198273',
    remarks: 'NEFT from SBI Gopalpura branch without student reference',
    reversesPaymentId: null,
  },
  {
    id: 'pay_unm_002',
    gatewayPaymentId: 'pay_unm_ref_002',
    gatewayOrderId: null,
    studentId: null,
    instalmentId: null,
    amountPaise: 2500000n, // ₹25,000
    mode: 'UPI',
    receivedOn: '2026-11-02',
    receivedAt: '2026-11-02T09:15:00Z',
    matchStatus: 'UNMATCHED_QUEUE',
    reasonCode: 'UNKNOWN_STUDENT',
    unallocatedPaise: 2500000n,
    payerName: 'Rajesh Kumar',
    payerPhone: '9829333444',
    bankReference: 'UPI/98372619472/PAY',
    remarks: 'Reference mentions student code STU-9999 not in records',
    reversesPaymentId: null,
  },
  {
    id: 'pay_unm_003',
    gatewayPaymentId: 'pay_unm_ref_003',
    gatewayOrderId: null,
    studentId: null,
    instalmentId: null,
    amountPaise: 3000000n, // ₹30,000
    mode: 'BANK_TRANSFER',
    receivedOn: '2026-11-02',
    receivedAt: '2026-11-02T10:45:00Z',
    matchStatus: 'UNMATCHED_QUEUE',
    reasonCode: 'CANCELLED_INSTALMENT',
    unallocatedPaise: 3000000n,
    payerName: 'Sunil Gupta',
    payerPhone: '9829555666',
    bankReference: 'AXISB26301129482',
    remarks: 'Payment targeted instalment that was cancelled upon refund',
    reversesPaymentId: null,
  },
];

// Seed Data Generator Function
export function generateSeedData(): {
  centres: Centre[];
  batches: Batch[];
  users: User[];
  students: Student[];
  guardians: Guardian[];
  instalments: Instalment[];
  instalmentHeads: InstalmentHead[];
  payments: Payment[];
  allocations: PaymentAllocation[];
  receiptCounters: ReceiptCounter[];
  receipts: Receipt[];
  reminders: Reminder[];
  refundRequests: RefundRequest[];
  consents: DpdpConsent[];
  academics: AcademicRecord[];
  dropoutFlags: DropoutFlag[];
} {
  const centres = JAIPUR_CENTRES.map((c) => ({ ...c }));
  const batches = INITIAL_BATCHES.map((b) => ({ ...b }));
  const users = INITIAL_USERS.map((u) => ({ ...u }));
  const students: Student[] = [];
  const guardians: Guardian[] = [];
  const instalments: Instalment[] = [];
  const instalmentHeads: InstalmentHead[] = [];
  const payments: Payment[] = INITIAL_UNMATCHED_PAYMENTS.map((p) => ({ ...p }));
  const allocations: PaymentAllocation[] = [];
  const receipts: Receipt[] = [];
  const reminders: Reminder[] = [];
  const refundRequests: RefundRequest[] = [];
  const consents: DpdpConsent[] = [];
  const academics: AcademicRecord[] = [];
  const dropoutFlags: DropoutFlag[] = [];

  const receiptCounters: ReceiptCounter[] = [
    { gstin: '08AAAAA0000A1Z5', fy: '26-27', kind: 'RCP', lastNo: 412 },
    { gstin: '08AAAAA0000A2Z4', fy: '26-27', kind: 'RCP', lastNo: 260 },
    { gstin: '08AAAAA0000A3Z3', fy: '26-27', kind: 'RCP', lastNo: 150 },
    { gstin: '08AAAAA0000A4Z2', fy: '26-27', kind: 'RCP', lastNo: 120 },
    { gstin: '08AAAAA0000A1Z5', fy: '26-27', kind: 'CN', lastNo: 0 },
    { gstin: '08AAAAA0000A2Z4', fy: '26-27', kind: 'CN', lastNo: 0 },
    { gstin: '08AAAAA0000A3Z3', fy: '26-27', kind: 'CN', lastNo: 0 },
    { gstin: '08AAAAA0000A4Z2', fy: '26-27', kind: 'CN', lastNo: 0 },
  ];

  // Helper to split instalment amount into heads (75% Tuition, 15% Hostel, 10% Mess)
  function createHeads(instId: string, duePaise: bigint, paidPaise: bigint) {
    const tuitionDue = (duePaise * 75n) / 100n;
    const hostelDue = (duePaise * 15n) / 100n;
    const messDue = duePaise - tuitionDue - hostelDue;

    const tuitionPaid = duePaise > 0n ? (paidPaise * tuitionDue) / duePaise : 0n;
    const hostelPaid = duePaise > 0n ? (paidPaise * hostelDue) / duePaise : 0n;
    const messPaid = paidPaise - tuitionPaid - hostelPaid;

    instalmentHeads.push({ id: `hd-${instId}-t`, instalmentId: instId, head: 'TUITION', amountDuePaise: tuitionDue, amountPaidPaise: tuitionPaid });
    instalmentHeads.push({ id: `hd-${instId}-h`, instalmentId: instId, head: 'HOSTEL', amountDuePaise: hostelDue, amountPaidPaise: hostelPaid });
    instalmentHeads.push({ id: `hd-${instId}-m`, instalmentId: instId, head: 'MESS', amountDuePaise: messDue, amountPaidPaise: messPaid });
  }

  // --- CANONICAL STUDENT 1: STU-0412 (Aarav Meena) ---
  const stu0412: Student = {
    id: 'stu-0412',
    studentCode: 'STU-0412',
    fullName: 'Aarav Meena',
    dob: '2009-05-14',
    isMinor: true,
    centreId: 'ctr-jpr-gpl',
    batchId: 'batch-jee-27m-gpl',
    enrolmentDate: '2026-04-01',
    status: 'ACTIVE',
    withdrawnAt: null,
    grossFeePaise: 12000000n,
    discountPaise: 0n,
    discountReason: null,
    netFeePaise: 12000000n,
  };
  students.push(stu0412);
  guardians.push({
    id: 'gdn-0412',
    studentId: 'stu-0412',
    userId: 'usr-par-0412',
    name: 'Rajesh Meena',
    relationship: 'FATHER',
    idRefType: 'AADHAAR',
    idLast4: '4120',
    verifiedAt: '2026-04-01T10:00:00Z',
    isPrimary: true,
  });
  // 4 Instalments of ₹30,000
  const inst0412_1: Instalment = { id: 'inst-0412-1', studentId: 'stu-0412', seqNo: 1, dueDate: '2026-04-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
  const inst0412_2: Instalment = { id: 'inst-0412-2', studentId: 'stu-0412', seqNo: 2, dueDate: '2026-07-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
  const inst0412_3: Instalment = { id: 'inst-0412-3', studentId: 'stu-0412', seqNo: 3, dueDate: '2026-10-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
  const inst0412_4: Instalment = { id: 'inst-0412-4', studentId: 'stu-0412', seqNo: 4, dueDate: '2027-01-10', amountDuePaise: 3000000n, amountPaidPaise: 0n, version: 0, cancelledAt: null, refundId: null };
  instalments.push(inst0412_1, inst0412_2, inst0412_3, inst0412_4);
  createHeads('inst-0412-1', 3000000n, 3000000n);
  createHeads('inst-0412-2', 3000000n, 3000000n);
  createHeads('inst-0412-3', 3000000n, 3000000n);
  createHeads('inst-0412-4', 3000000n, 0n);

  // Inst 3 Reminders for STU-0412: all 5 SUPPRESSED_BY_PAYMENT
  const remTriggers: Array<{ type: ReminderTriggerType; date: string }> = [
    { type: 'T_MINUS_7', date: '2026-10-03' },
    { type: 'T_ZERO', date: '2026-10-10' },
    { type: 'T_PLUS_3', date: '2026-10-13' },
    { type: 'T_PLUS_7', date: '2026-10-17' },
    { type: 'T_PLUS_15', date: '2026-10-25' },
  ];
  for (const tr of remTriggers) {
    reminders.push({
      id: `rem-0412-3-${tr.type}`,
      instalmentId: 'inst-0412-3',
      studentId: 'stu-0412',
      triggerType: tr.type,
      scheduledFor: tr.date,
      channel: 'WHATSAPP',
      lang: 'hi',
      state: 'SUPPRESSED_BY_PAYMENT',
      sentAt: null,
      suppressedAt: '2026-10-09T11:00:00Z',
      suppressReason: 'PAID_IN_FULL',
      suppressPaymentId: 'pay-0412-3',
      providerMessageId: null,
      error: null,
    });
  }

  // Payment 3 for STU-0412
  payments.push({
    id: 'pay-0412-3',
    gatewayPaymentId: 'pay_gw_0412_3',
    gatewayOrderId: 'order_0412_3',
    studentId: 'stu-0412',
    instalmentId: 'inst-0412-3',
    amountPaise: 3000000n,
    mode: 'UPI',
    receivedOn: '2026-10-09',
    receivedAt: '2026-10-09T11:00:00Z',
    matchStatus: 'MATCHED',
    reasonCode: null,
    unallocatedPaise: 0n,
    payerName: 'Rajesh Meena',
    payerPhone: '9829041200',
    bankReference: 'UPI/04123891029/PAY',
    remarks: 'Instalment 3 full payment',
    reversesPaymentId: null,
  });
  allocations.push({
    id: 'alc-0412-3',
    paymentId: 'pay-0412-3',
    instalmentId: 'inst-0412-3',
    head: 'TUITION',
    amountPaise: 3000000n,
  });

  const split0412 = calculateGstReverseSplit(3000000n);
  receipts.push({
    id: 'rcp-0412-3',
    paymentId: 'pay-0412-3',
    centreId: 'ctr-jpr-gpl',
    gstin: '08AAAAA0000A1Z5',
    fy: '26-27',
    kind: 'RCP',
    number: 'RCP/26-27/000412',
    issuedAt: '2026-10-09T11:00:00Z',
    issuedDate: '2026-10-09',
    grossPaise: 3000000n,
    taxablePaise: split0412.taxablePaise,
    cgstPaise: split0412.cgstPaise,
    sgstPaise: split0412.sgstPaise,
    igstPaise: 0n,
    studentId: 'stu-0412',
    refundId: null,
    originalReceiptId: null,
    snapshotJson: { studentCode: 'STU-0412', instalmentSeq: 3 },
  });

  consents.push(
    { id: 'cns-0412-1', studentId: 'stu-0412', parentUserId: 'usr-par-0412', purposeCode: 'CORE_EDUCATION_FEES', noticeVersion: 1, languageShown: 'hi', grantedAt: '2026-04-01T10:00:00Z', withdrawnAt: null },
    { id: 'cns-0412-2', studentId: 'stu-0412', parentUserId: 'usr-par-0412', purposeCode: 'WHATSAPP_REMINDERS', noticeVersion: 1, languageShown: 'hi', grantedAt: '2026-04-01T10:00:00Z', withdrawnAt: null }
  );

  // --- CANONICAL STUDENT 2: STU-0587 (Ishita Sharma) ---
  const stu0587: Student = {
    id: 'stu-0587',
    studentCode: 'STU-0587',
    fullName: 'Ishita Sharma',
    dob: '2009-08-22',
    isMinor: true,
    centreId: 'ctr-jpr-gpl',
    batchId: 'batch-jee-27e-gpl',
    enrolmentDate: '2026-04-01',
    status: 'ACTIVE',
    withdrawnAt: null,
    grossFeePaise: 12000000n,
    discountPaise: 0n,
    discountReason: null,
    netFeePaise: 12000000n,
  };
  students.push(stu0587);
  guardians.push({
    id: 'gdn-0587',
    studentId: 'stu-0587',
    userId: 'usr-par-0587',
    name: 'Sunita Sharma',
    relationship: 'MOTHER',
    idRefType: 'AADHAAR',
    idLast4: '5870',
    verifiedAt: '2026-04-01T10:30:00Z',
    isPrimary: true,
  });
  // 4 Instalments: Inst 3 has 15k paid, 15k balance (PART_PAID_OVERDUE on 2026-11-02, 23 days late)
  const inst0587_1: Instalment = { id: 'inst-0587-1', studentId: 'stu-0587', seqNo: 1, dueDate: '2026-04-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
  const inst0587_2: Instalment = { id: 'inst-0587-2', studentId: 'stu-0587', seqNo: 2, dueDate: '2026-07-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
  const inst0587_3: Instalment = { id: 'inst-0587-3', studentId: 'stu-0587', seqNo: 3, dueDate: '2026-10-10', amountDuePaise: 3000000n, amountPaidPaise: 1500000n, version: 1, cancelledAt: null, refundId: null };
  const inst0587_4: Instalment = { id: 'inst-0587-4', studentId: 'stu-0587', seqNo: 4, dueDate: '2027-01-10', amountDuePaise: 3000000n, amountPaidPaise: 0n, version: 0, cancelledAt: null, refundId: null };
  instalments.push(inst0587_1, inst0587_2, inst0587_3, inst0587_4);
  createHeads('inst-0587-1', 3000000n, 3000000n);
  createHeads('inst-0587-2', 3000000n, 3000000n);
  createHeads('inst-0587-3', 3000000n, 1500000n);
  createHeads('inst-0587-4', 3000000n, 0n);

  // Inst 3 Reminders for STU-0587: all 5 SENT (since only part paid)
  for (const tr of remTriggers) {
    reminders.push({
      id: `rem-0587-3-${tr.type}`,
      instalmentId: 'inst-0587-3',
      studentId: 'stu-0587',
      triggerType: tr.type,
      scheduledFor: tr.date,
      channel: 'WHATSAPP',
      lang: 'hi',
      state: 'SENT',
      sentAt: `${tr.date}T10:00:00Z`,
      suppressedAt: null,
      suppressReason: null,
      suppressPaymentId: null,
      providerMessageId: `msg-0587-${tr.type}`,
      error: null,
    });
  }

  // Part payment of ₹15,000 for STU-0587 on 2026-10-09
  payments.push({
    id: 'pay-0587-3',
    gatewayPaymentId: 'pay_gw_0587_3',
    gatewayOrderId: 'order_0587_3',
    studentId: 'stu-0587',
    instalmentId: 'inst-0587-3',
    amountPaise: 1500000n,
    mode: 'UPI',
    receivedOn: '2026-10-09',
    receivedAt: '2026-10-09T14:20:00Z',
    matchStatus: 'MATCHED',
    reasonCode: null,
    unallocatedPaise: 0n,
    payerName: 'Sunita Sharma',
    payerPhone: '9829058700',
    bankReference: 'UPI/0587123987/PAY',
    remarks: 'Instalment 3 part payment',
    reversesPaymentId: null,
  });
  allocations.push({
    id: 'alc-0587-3',
    paymentId: 'pay-0587-3',
    instalmentId: 'inst-0587-3',
    head: 'TUITION',
    amountPaise: 1500000n,
  });

  const split0587 = calculateGstReverseSplit(1500000n);
  receipts.push({
    id: 'rcp-0587-3',
    paymentId: 'pay-0587-3',
    centreId: 'ctr-jpr-gpl',
    gstin: '08AAAAA0000A1Z5',
    fy: '26-27',
    kind: 'RCP',
    number: 'RCP/26-27/000401',
    issuedAt: '2026-10-09T14:20:00Z',
    issuedDate: '2026-10-09',
    grossPaise: 1500000n,
    taxablePaise: split0587.taxablePaise,
    cgstPaise: split0587.cgstPaise,
    sgstPaise: split0587.sgstPaise,
    igstPaise: 0n,
    studentId: 'stu-0587',
    refundId: null,
    originalReceiptId: null,
    snapshotJson: { studentCode: 'STU-0587', instalmentSeq: 3 },
  });

  // Academic & Dropout Risk Score for STU-0587: 79 HIGH (F=32, A=28, S=19)
  academics.push({
    studentId: 'stu-0587',
    attendancePercent: 69,
    prevAttendancePercent: 88,
    testScores: [78, 59],
  });
  dropoutFlags.push({
    studentId: 'stu-0587',
    score: 79,
    severity: 'HIGH',
    fScore: 32,
    aScore: 28,
    sScore: 19,
    flaggedOn: '2026-11-02',
    templateGuide: 'Schedule in-person parent consultation with Academic Counsellor regarding 19% attendance decline and 19-point drop in mock test scores.',
  });

  consents.push(
    { id: 'cns-0587-1', studentId: 'stu-0587', parentUserId: 'usr-par-0587', purposeCode: 'CORE_EDUCATION_FEES', noticeVersion: 1, languageShown: 'hi', grantedAt: '2026-04-01T10:30:00Z', withdrawnAt: null },
    { id: 'cns-0587-2', studentId: 'stu-0587', parentUserId: 'usr-par-0587', purposeCode: 'WHATSAPP_REMINDERS', noticeVersion: 1, languageShown: 'hi', grantedAt: '2026-04-01T10:30:00Z', withdrawnAt: null }
  );

  // --- CANONICAL STUDENT 3: STU-0219 (Mohit Gurjar) ---
  const stu0219: Student = {
    id: 'stu-0219',
    studentCode: 'STU-0219',
    fullName: 'Mohit Gurjar',
    dob: '2008-11-10',
    isMinor: true,
    centreId: 'ctr-jpr-vsh',
    batchId: 'batch-neet-27m-vsh',
    enrolmentDate: '2026-07-01',
    status: 'ACTIVE',
    withdrawnAt: null,
    grossFeePaise: 12000000n,
    discountPaise: 0n,
    discountReason: null,
    netFeePaise: 12000000n,
  };
  students.push(stu0219);
  guardians.push({
    id: 'gdn-0219',
    studentId: 'stu-0219',
    userId: 'usr-par-0219',
    name: 'Ramavtar Gurjar',
    relationship: 'FATHER',
    idRefType: 'AADHAAR',
    idLast4: '2190',
    verifiedAt: '2026-07-01T11:00:00Z',
    isPrimary: true,
  });
  // 3 Instalments of ₹40,000: Inst 1 paid, Inst 2 due in 13 days on 2026-11-15 (UPCOMING)
  const inst0219_1: Instalment = { id: 'inst-0219-1', studentId: 'stu-0219', seqNo: 1, dueDate: '2026-07-15', amountDuePaise: 4000000n, amountPaidPaise: 4000000n, version: 1, cancelledAt: null, refundId: null };
  const inst0219_2: Instalment = { id: 'inst-0219-2', studentId: 'stu-0219', seqNo: 2, dueDate: '2026-11-15', amountDuePaise: 4000000n, amountPaidPaise: 0n, version: 0, cancelledAt: null, refundId: null };
  const inst0219_3: Instalment = { id: 'inst-0219-3', studentId: 'stu-0219', seqNo: 3, dueDate: '2027-03-15', amountDuePaise: 4000000n, amountPaidPaise: 0n, version: 0, cancelledAt: null, refundId: null };
  instalments.push(inst0219_1, inst0219_2, inst0219_3);
  createHeads('inst-0219-1', 4000000n, 4000000n);
  createHeads('inst-0219-2', 4000000n, 0n);
  createHeads('inst-0219-3', 4000000n, 0n);

  // Inst 2 Reminders for STU-0219: all QUEUED
  const triggers0219: Array<{ type: ReminderTriggerType; date: string }> = [
    { type: 'T_MINUS_7', date: '2026-11-08' },
    { type: 'T_ZERO', date: '2026-11-15' },
    { type: 'T_PLUS_3', date: '2026-11-18' },
    { type: 'T_PLUS_7', date: '2026-11-22' },
    { type: 'T_PLUS_15', date: '2026-11-30' },
  ];
  for (const tr of triggers0219) {
    reminders.push({
      id: `rem-0219-2-${tr.type}`,
      instalmentId: 'inst-0219-2',
      studentId: 'stu-0219',
      triggerType: tr.type,
      scheduledFor: tr.date,
      channel: 'WHATSAPP',
      lang: 'en',
      state: 'QUEUED',
      sentAt: null,
      suppressedAt: null,
      suppressReason: null,
      suppressPaymentId: null,
      providerMessageId: null,
      error: null,
    });
  }

  // Payment 1 for STU-0219
  payments.push({
    id: 'pay-0219-1',
    gatewayPaymentId: 'pay_gw_0219_1',
    gatewayOrderId: 'order_0219_1',
    studentId: 'stu-0219',
    instalmentId: 'inst-0219-1',
    amountPaise: 4000000n,
    mode: 'BANK_TRANSFER',
    receivedOn: '2026-07-14',
    receivedAt: '2026-07-14T11:00:00Z',
    matchStatus: 'MATCHED',
    reasonCode: null,
    unallocatedPaise: 0n,
    payerName: 'Ramavtar Gurjar',
    payerPhone: '9829021900',
    bankReference: 'NEFT/021983749/PAY',
    remarks: 'Instalment 1 full payment',
    reversesPaymentId: null,
  });
  allocations.push({
    id: 'alc-0219-1',
    paymentId: 'pay-0219-1',
    instalmentId: 'inst-0219-1',
    head: 'TUITION',
    amountPaise: 4000000n,
  });

  const split0219 = calculateGstReverseSplit(4000000n);
  receipts.push({
    id: 'rcp-0219-1',
    paymentId: 'pay-0219-1',
    centreId: 'ctr-jpr-vsh',
    gstin: '08AAAAA0000A2Z4',
    fy: '26-27',
    kind: 'RCP',
    number: 'RCP/26-27/000260',
    issuedAt: '2026-07-14T11:00:00Z',
    issuedDate: '2026-07-14',
    grossPaise: 4000000n,
    taxablePaise: split0219.taxablePaise,
    cgstPaise: split0219.cgstPaise,
    sgstPaise: split0219.sgstPaise,
    igstPaise: 0n,
    studentId: 'stu-0219',
    refundId: null,
    originalReceiptId: null,
    snapshotJson: { studentCode: 'STU-0219', instalmentSeq: 1 },
  });

  consents.push(
    { id: 'cns-0219-1', studentId: 'stu-0219', parentUserId: 'usr-par-0219', purposeCode: 'CORE_EDUCATION_FEES', noticeVersion: 1, languageShown: 'en', grantedAt: '2026-07-01T11:00:00Z', withdrawnAt: null },
    { id: 'cns-0219-2', studentId: 'stu-0219', parentUserId: 'usr-par-0219', purposeCode: 'WHATSAPP_REMINDERS', noticeVersion: 1, languageShown: 'en', grantedAt: '2026-07-01T11:00:00Z', withdrawnAt: null }
  );

  // --- SYNTHESIZE REMAINING 2,597 STUDENTS (Total = 2,600) ---
  const prng = new LCG(42);
  const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Kabir', 'Dhruv', 'Ananya', 'Diya', 'Gauri', 'Ishita', 'Kavya', 'Khushi', 'Myra', 'Navya', 'Pari', 'Prisha', 'Riya', 'Saanvi', 'Tanvi'];
  const lastNames = ['Meena', 'Sharma', 'Verma', 'Gurjar', 'Choudhary', 'Jat', 'Singh', 'Gupta', 'Agarwal', 'Yadav', 'Rathore', 'Shekhawat', 'Prajapat', 'Saini', 'Bishnoi'];

  // Centre allocation targets:
  // JPR-GPL: 1,000 (already 2: 0412, 0587 -> 998 to add)
  // JPR-VSH: 600 (already 1: 0219 -> 599 to add)
  // JPR-MNS: 500 (500 to add)
  // JPR-SKR: 500 (500 to add)
  // Total to add = 998 + 599 + 500 + 500 = 2,597. Total = 2,600.

  const centreDistribution: Array<{ centreId: string; batchId: string; startCode: number; count: number }> = [
    { centreId: 'ctr-jpr-gpl', batchId: 'batch-jee-27m-gpl', startCode: 1, count: 1000 },
    { centreId: 'ctr-jpr-vsh', batchId: 'batch-neet-27m-vsh', startCode: 1001, count: 600 },
    { centreId: 'ctr-jpr-mns', batchId: 'batch-jee-27m-mns', startCode: 1601, count: 500 },
    { centreId: 'ctr-jpr-skr', batchId: 'batch-neet-27m-skr', startCode: 2101, count: 500 },
  ];

  for (const dist of centreDistribution) {
    for (let i = 0; i < dist.count; i++) {
      const codeNum = dist.startCode + i;
      const studentCode = `STU-${codeNum.toString().padStart(4, '0')}`;

      // Skip canonical reference students
      if (studentCode === 'STU-0412' || studentCode === 'STU-0587' || studentCode === 'STU-0219') {
        continue;
      }

      const fName = firstNames[prng.range(0, firstNames.length - 1)];
      const lName = lastNames[prng.range(0, lastNames.length - 1)];
      const fullName = `${fName} ${lName}`;
      const studentId = `stu-${codeNum.toString().padStart(4, '0')}`;

      const sRecord: Student = {
        id: studentId,
        studentCode,
        fullName,
        dob: `2008-${prng.range(1, 12).toString().padStart(2, '0')}-${prng.range(1, 28).toString().padStart(2, '0')}`,
        isMinor: true,
        centreId: dist.centreId,
        batchId: dist.batchId,
        enrolmentDate: '2026-04-01',
        status: 'ACTIVE',
        withdrawnAt: null,
        grossFeePaise: 12000000n,
        discountPaise: 0n,
        discountReason: null,
        netFeePaise: 12000000n,
      };
      students.push(sRecord);

      // Create guardian
      const guardianUserId = `usr-par-${codeNum.toString().padStart(4, '0')}`;
      users.push({
        id: guardianUserId,
        phone: `9829${codeNum.toString().padStart(6, '0')}`,
        email: `${fName.toLowerCase()}.${lName.toLowerCase()}${codeNum}@example.com`,
        name: `${fullName} Parent`,
        role: 'PARENT',
        preferredLang: prng.next() > 0.5 ? 'hi' : 'en',
        isActive: true,
        phoneVerifiedAt: '2026-04-01T00:00:00Z',
      });
      guardians.push({
        id: `gdn-${codeNum}`,
        studentId,
        userId: guardianUserId,
        name: `${fullName} Parent`,
        relationship: 'FATHER',
        idRefType: 'AADHAAR',
        idLast4: codeNum.toString().padStart(4, '0').slice(-4),
        verifiedAt: '2026-04-01T00:00:00Z',
        isPrimary: true,
      });

      // Delinquency distribution:
      // 70% Paid/Current (₹0 overdue)
      // 12% 1-30 days overdue (due 2026-10-10, 23 days late)
      // 6% 31-60 days overdue (due 2026-09-15, 48 days late)
      // 12% >60 days overdue (due 2026-07-10, 115 days late)
      const roll = prng.next();
      let inst3Paid: bigint;
      let inst3DueDate: string;
      if (roll < 0.70) {
        // Paid / Current
        inst3Paid = 3000000n;
        inst3DueDate = '2026-10-10';
      } else if (roll < 0.82) {
        // 1-30 days overdue
        inst3Paid = 0n;
        inst3DueDate = '2026-10-10'; // 23 days overdue on 2026-11-02
      } else if (roll < 0.88) {
        // 31-60 days overdue
        inst3Paid = 0n;
        inst3DueDate = '2026-09-15'; // 48 days overdue on 2026-11-02
      } else {
        // >60 days overdue
        inst3Paid = 0n;
        inst3DueDate = '2026-07-10'; // 115 days overdue on 2026-11-02
      }

      const inst1: Instalment = { id: `inst-${codeNum}-1`, studentId, seqNo: 1, dueDate: '2026-04-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
      const inst2: Instalment = { id: `inst-${codeNum}-2`, studentId, seqNo: 2, dueDate: '2026-07-10', amountDuePaise: 3000000n, amountPaidPaise: 3000000n, version: 1, cancelledAt: null, refundId: null };
      const inst3: Instalment = { id: `inst-${codeNum}-3`, studentId, seqNo: 3, dueDate: inst3DueDate, amountDuePaise: 3000000n, amountPaidPaise: inst3Paid, version: 1, cancelledAt: null, refundId: null };
      const inst4: Instalment = { id: `inst-${codeNum}-4`, studentId, seqNo: 4, dueDate: '2027-01-10', amountDuePaise: 3000000n, amountPaidPaise: 0n, version: 0, cancelledAt: null, refundId: null };

      instalments.push(inst1, inst2, inst3, inst4);
      createHeads(`inst-${codeNum}-1`, 3000000n, 3000000n);
      createHeads(`inst-${codeNum}-2`, 3000000n, 3000000n);
      createHeads(`inst-${codeNum}-3`, 3000000n, inst3Paid);
      createHeads(`inst-${codeNum}-4`, 3000000n, 0n);

      // Reminders for Inst 3
      const isPaid = inst3Paid >= 3000000n;
      for (const tr of remTriggers) {
        reminders.push({
          id: `rem-${codeNum}-3-${tr.type}`,
          instalmentId: `inst-${codeNum}-3`,
          studentId,
          triggerType: tr.type,
          scheduledFor: tr.date,
          channel: 'WHATSAPP',
          lang: 'hi',
          state: isPaid ? 'SUPPRESSED_BY_PAYMENT' : 'SENT',
          sentAt: isPaid ? null : `${tr.date}T10:00:00Z`,
          suppressedAt: isPaid ? '2026-10-09T10:00:00Z' : null,
          suppressReason: isPaid ? 'PAID_IN_FULL' : null,
          suppressPaymentId: isPaid ? `pay-${codeNum}-3` : null,
          providerMessageId: isPaid ? null : `msg-${codeNum}-${tr.type}`,
          error: null,
        });
      }

      // Default DPDP consent
      consents.push(
        { id: `cns-${codeNum}-1`, studentId, parentUserId: guardianUserId, purposeCode: 'CORE_EDUCATION_FEES', noticeVersion: 1, languageShown: 'hi', grantedAt: '2026-04-01T00:00:00Z', withdrawnAt: null },
        { id: `cns-${codeNum}-2`, studentId, parentUserId: guardianUserId, purposeCode: 'WHATSAPP_REMINDERS', noticeVersion: 1, languageShown: 'hi', grantedAt: '2026-04-01T00:00:00Z', withdrawnAt: null }
      );
    }
  }

  return {
    centres,
    batches,
    users,
    students,
    guardians,
    instalments,
    instalmentHeads,
    payments,
    allocations,
    receiptCounters,
    receipts,
    reminders,
    refundRequests,
    consents,
    academics,
    dropoutFlags,
  };
}
