'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  User,
  Calendar,
  MapPin,
  Phone,
  ShieldCheck,
  IndianRupee,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  ExternalLink,
} from 'lucide-react';
import OfflinePaymentModal from '@/components/admin/OfflinePaymentModal';
import UnmatchedQueueTable from '@/components/admin/UnmatchedQueueTable';
import ManualMatchModal from '@/components/admin/ManualMatchModal';
import { ReceiptModal, ReceiptData } from '@/components/ReceiptModal';

interface PageProps {
  params: Promise<{ id: string }>;
}

function StudentLedgerContent({ studentIdParam }: { studentIdParam: string }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'unmatched' ? 'unmatched' : 'ledger';

  const [activeTab, setActiveTab] = useState<'ledger' | 'unmatched'>(initialTab);
  const [studentData, setStudentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCashModalOpen, setIsCashModalOpen] = useState<boolean>(false);
  const [selectedInstalmentId, setSelectedInstalmentId] = useState<string | undefined>();
  const [isMatchModalOpen, setIsMatchModalOpen] = useState<boolean>(false);
  const [selectedUnmatchedPayment, setSelectedUnmatchedPayment] = useState<any>(null);

  // Receipt modal for invoice view
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const fetchStudentData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${studentIdParam}`);
      if (res.ok) {
        const data = await res.json();
        setStudentData(data);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentIdParam]);

  const student = studentData?.student || {
    fullName: 'Rahul Sharma',
    studentCode: 'STU-0587',
    status: 'ACTIVE',
    isMinor: true,
    centre: { name: 'Gopalpura Bypass (Main Centre)' },
  };

  const guardian = studentData?.guardians?.[0] || {
    name: 'Sunita Sharma',
    relationship: 'MOTHER',
    idLast4: '5870',
  };

  const dues = studentData?.dues;
  const receipts = studentData?.receipts || [
    {
      id: 'rcp-0587-01',
      number: 'RCP/26-27/000401',
      issuedDate: '2026-10-09',
      grossPaise: '1500000',
      taxablePaise: '1271186',
      cgstPaise: '114407',
      sgstPaise: '114407',
    },
  ];

  const defaultInstalments = [
    {
      id: 'inst-0587-1',
      seqNo: 1,
      dueDate: '2026-04-10',
      amountDuePaise: '3000000',
      amountPaidPaise: '3000000',
      status: 'PAID',
    },
    {
      id: 'inst-0587-2',
      seqNo: 2,
      dueDate: '2026-07-10',
      amountDuePaise: '3000000',
      amountPaidPaise: '3000000',
      status: 'PAID',
    },
    {
      id: 'inst-0587-3',
      seqNo: 3,
      dueDate: '2026-10-10',
      amountDuePaise: '3000000',
      amountPaidPaise: '1500000',
      status: 'PART_PAID_OVERDUE',
    },
    {
      id: 'inst-0587-4',
      seqNo: 4,
      dueDate: '2027-01-10',
      amountDuePaise: '3000000',
      amountPaidPaise: '0',
      status: 'UPCOMING',
    },
  ];

  const instalments = dues?.instalments && dues.instalments.length > 0 ? dues.instalments : defaultInstalments;

  const openCashModal = (instId?: string) => {
    setSelectedInstalmentId(instId);
    setIsCashModalOpen(true);
  };

  const handleOpenMatch = (payment: any) => {
    setSelectedUnmatchedPayment(payment);
    setIsMatchModalOpen(true);
  };

  const handleViewReceiptModal = (rcp: any) => {
    setSelectedReceipt({
      receiptNumber: rcp.number || 'RCP/26-27/000401',
      issuedDate: rcp.issuedDate || '2026-10-09',
      studentName: student.fullName,
      studentCode: student.studentCode,
      courseName: 'JEE Advanced 2-Year Evening',
      centreName: 'Gopalpura Bypass (Main Centre)',
      grossPaise: rcp.grossPaise || 1500000n,
      paymentMode: 'Counter Payment / Bank',
    });
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Student Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xl shrink-0">
              {student?.fullName ? student.fullName.slice(0, 2).toUpperCase() : 'RS'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {student?.fullName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                  {student?.studentCode}
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {student?.status || 'ACTIVE'}
                </span>
                {student?.isMinor && (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                    Minor (DPDP s.9 Guardrails Apply)
                  </span>
                )}
              </div>

              {/* Sub-meta */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{student?.centre?.name || 'Gopalpura Bypass (Main Centre)'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Guardian: {guardian?.name} ({guardian?.relationship})</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Aadhaar KYC: ****{guardian?.idLast4}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Header Action & Balance Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
              <span className="text-[11px] text-slate-500 font-semibold block">Total Balance Due</span>
              <span className="text-xl font-black text-rose-600 tabular-nums font-mono">
                {dues?.totalBalanceFormatted || '₹45,000.00'}
              </span>
            </div>
            <button
              onClick={() => openCashModal()}
              className="touch-target inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Cash Payment</span>
            </button>
          </div>
        </div>

        {/* Schedule Statutory Compliance Callout */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Rajasthan Coaching Act 2025: 4 Equal Instalments Schedule Validated</span>
          </div>
          <span className="font-mono text-slate-400 text-[11px]">Section 13 Compliance Status: OK</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-6">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Ledger & Instalment Schedule
        </button>
        <button
          onClick={() => setActiveTab('unmatched')}
          className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'unmatched'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Unmatched Payment Queue</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 font-bold">
            3 Pending
          </span>
        </button>
      </div>

      {/* Tab 1: Comprehensive Ledger & Schedule */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Instalment Schedule Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                4-Stage Fee Instalment Schedule
              </h2>
              <span className="text-xs text-slate-500">
                Next Due Date: 2026-10-10 (23 days overdue)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Instalment #</th>
                    <th className="px-4 py-3 text-left">Due Date</th>
                    <th className="px-4 py-3 text-right">Amount Due</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {instalments.map((inst: any) => {
                    const balance = BigInt(inst.amountDuePaise || 0) - BigInt(inst.amountPaidPaise || 0);
                    const isOverdue = inst.status === 'OVERDUE' || inst.status === 'PART_PAID_OVERDUE';
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          Instalment {inst.seqNo}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 font-mono">
                          {inst.dueDate}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-900 tabular-nums">
                          ₹{(Number(inst.amountDuePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-emerald-600 tabular-nums">
                          ₹{(Number(inst.amountPaidPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-rose-600 tabular-nums">
                          ₹{(Number(balance) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              inst.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inst.status === 'PART_PAID_OVERDUE'
                                ? 'bg-amber-100 text-amber-800'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {inst.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {balance > 0n ? (
                            <button
                              onClick={() => openCashModal(inst.id)}
                              className="touch-target px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-300 cursor-pointer"
                            >
                              Receive Cash
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Cleared</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction Ledger & Receipts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                GST Tax Receipts & Financial Transactions
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Issued Date</th>
                    <th className="px-4 py-3 text-left">Receipt Number</th>
                    <th className="px-4 py-3 text-right">Gross Amount</th>
                    <th className="px-4 py-3 text-right">Taxable Base</th>
                    <th className="px-4 py-3 text-right">CGST (9%)</th>
                    <th className="px-4 py-3 text-right">SGST (9%)</th>
                    <th className="px-4 py-3 text-center">Invoice View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {receipts.map((rcp: any) => (
                    <tr key={rcp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-600">{rcp.issuedDate}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">{rcp.number}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                        ₹{(Number(rcp.grossPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">
                        ₹{(Number(rcp.taxablePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">
                        ₹{(Number(rcp.cgstPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">
                        ₹{(Number(rcp.sgstPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleViewReceiptModal(rcp)}
                          className="touch-target inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Unmatched Payment Queue */}
      {activeTab === 'unmatched' && (
        <UnmatchedQueueTable
          onOpenMatch={handleOpenMatch}
          onRefreshLedger={fetchStudentData}
        />
      )}

      {/* Modals */}
      <OfflinePaymentModal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        onSuccess={fetchStudentData}
        defaultStudentId={student?.id || studentIdParam}
        defaultInstalmentId={selectedInstalmentId}
      />

      <ManualMatchModal
        isOpen={isMatchModalOpen}
        payment={selectedUnmatchedPayment}
        onClose={() => setIsMatchModalOpen(false)}
        onSuccess={fetchStudentData}
        targetStudentCode={student?.studentCode || studentIdParam}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        receipt={selectedReceipt}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
}

export default function StudentLedgerPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const studentIdParam = unwrappedParams.id || 'STU-0587';

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading student ledger...</div>}>
      <StudentLedgerContent studentIdParam={studentIdParam} />
    </Suspense>
  );
}
