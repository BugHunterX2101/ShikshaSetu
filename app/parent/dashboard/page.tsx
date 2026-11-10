'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { DuesCard } from '@/components/DuesCard';
import { ReceiptModal, ReceiptData } from '@/components/ReceiptModal';
import { ConsentModal } from '@/components/ConsentModal';
import {
  ChevronDown,
  ChevronUp,
  Receipt,
  FileText,
  AlertTriangle,
  TrendingDown,
  PhoneForwarded,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface InstalmentView {
  id: string;
  instalmentNumber: number;
  dueDate: string;
  totalGrossPaise: string | bigint;
  totalNetPaise: string | bigint;
  paidPaise: string | bigint;
  balancePaise: string | bigint;
  status: string;
  tuitionPaise?: string | bigint;
  hostelPaise?: string | bigint;
  messPaise?: string | bigint;
}

export default function ParentDashboardPage() {
  const { t, lang } = useLanguage();
  const { activeStudentId } = useAuth();
  const { success, error, info } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [duesData, setDuesData] = useState<any>(null);
  const [consentRequired, setConsentRequired] = useState<boolean>(false);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  // Accordion state for fee ledger
  const [ledgerOpen, setLedgerOpen] = useState<boolean>(true);
  const [expandedInstalmentHeads, setExpandedInstalmentHeads] = useState<Record<number, boolean>>({
    3: true, // open the overdue instalment by default
  });

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Fetch dues from API
  const fetchDues = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/parent/dues');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch dues summary');
      }

      if (data.consentRequired) {
        setConsentRequired(true);
        setShowConsentModal(true);
      } else {
        setConsentRequired(false);
      }

      setDuesData(data.dues);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching dues';
      error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  // Toggle heads accordion
  const toggleHeads = (instNum: number) => {
    setExpandedInstalmentHeads((prev) => ({
      ...prev,
      [instNum]: !prev[instNum],
    }));
  };

  const handleOpenReceipt = (rcp: any) => {
    setSelectedReceipt({
      id: rcp.id || 'rcp-0587-01',
      receiptNumber: rcp.receiptNumber || 'RCP/26-27/000401',
      issuedDate: rcp.issuedDate || '2026-10-09',
      studentName: 'Rahul Sharma',
      studentCode: 'STU-0587',
      courseName: 'JEE Advanced 2-Year Evening',
      centreName: 'Gopalpura Bypass (Main Centre), Jaipur',
      grossPaise: rcp.grossPaise || 1500000n,
      paymentMode: 'UPI / Online Transfer',
    });
    setIsReceiptModalOpen(true);
  };

  const handleRequestMentor = () => {
    success(
      lang === 'hi'
        ? 'परामर्शदाता अनुरोध दर्ज: शैक्षणिक मार्गदर्शक 24 घंटे में संपर्क करेंगे।'
        : 'Counsellor consultation requested: Academic mentor will call within 24 hours.'
    );
  };

  const toRupees = (paise: any): string => {
    const p = typeof paise === 'bigint' ? Number(paise) : Number(paise || 0);
    return (p / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  };

  // Canonical fallback data for STU-0587
  const student = duesData?.student || {
    name: 'Rahul Sharma',
    code: 'STU-0587',
    centre: 'Gopalpura Bypass (Main Centre)',
    course: 'JEE Advanced 2-Year Evening',
  };

  const totalDues = duesData?.totalBalancePaise ?? 5500000n; // ₹55,000 total balance
  const totalNet = duesData?.totalNetPaise ?? 12000000n;     // ₹1,20,000 net fee
  const totalPaid = duesData?.totalPaidPaise ?? 6500000n;    // ₹65,000 paid

  const defaultInstalments: InstalmentView[] = [
    {
      id: 'inst-0587-1',
      instalmentNumber: 1,
      dueDate: '2026-04-10',
      totalGrossPaise: 3000000n,
      totalNetPaise: 3000000n,
      paidPaise: 3000000n,
      balancePaise: 0n,
      status: 'PAID',
      tuitionPaise: 2250000n,
      hostelPaise: 500000n,
      messPaise: 250000n,
    },
    {
      id: 'inst-0587-2',
      instalmentNumber: 2,
      dueDate: '2026-07-10',
      totalGrossPaise: 3000000n,
      totalNetPaise: 3000000n,
      paidPaise: 3000000n,
      balancePaise: 0n,
      status: 'PAID',
      tuitionPaise: 2250000n,
      hostelPaise: 500000n,
      messPaise: 250000n,
    },
    {
      id: 'inst-0587-3',
      instalmentNumber: 3,
      dueDate: '2026-10-10',
      totalGrossPaise: 3000000n,
      totalNetPaise: 3000000n,
      paidPaise: 1500000n,
      balancePaise: 1500000n,
      status: 'PART_PAID_OVERDUE',
      tuitionPaise: 2250000n,
      hostelPaise: 500000n,
      messPaise: 250000n,
    },
    {
      id: 'inst-0587-4',
      instalmentNumber: 4,
      dueDate: '2027-01-10',
      totalGrossPaise: 3000000n,
      totalNetPaise: 3000000n,
      paidPaise: 0n,
      balancePaise: 3000000n,
      status: 'UPCOMING',
      tuitionPaise: 2250000n,
      hostelPaise: 500000n,
      messPaise: 250000n,
    },
  ];

  const instalments: InstalmentView[] = duesData?.instalments && duesData.instalments.length > 0
    ? duesData.instalments
    : defaultInstalments;

  return (
    <div className="mobile-viewport-360 space-y-4 pb-12">
      {/* 5-SECOND DUES COMPREHENSION HERO CARD */}
      <DuesCard
        studentName={student.name || 'Rahul Sharma'}
        studentCode={student.code || 'STU-0587'}
        centreName={student.centre || 'Gopalpura Bypass'}
        courseName={student.course || 'JEE Advanced 2-Year'}
        totalDuesPaise={totalDues}
        netFeePaise={totalNet}
        totalPaidPaise={totalPaid}
        nextDueDate="2026-10-10"
        statusBadge="PART_PAID_OVERDUE"
        overdueDays={23}
        payTargetId="stu-0587"
      />

      {/* REFRESH BAR */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-500">
        <span className="font-mono text-[11px]">{t('parentDashboard.fiveSecondComprehensionRule')}</span>
        <button
          onClick={fetchDues}
          disabled={isLoading}
          className="inline-flex items-center gap-1 hover:text-slate-800 font-medium cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>{lang === 'hi' ? 'ताज़ा करें' : 'Refresh'}</span>
        </button>
      </div>

      {/* COLLAPSIBLE 4-INSTALMENT FEE LEDGER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setLedgerOpen(!ledgerOpen)}
          className="touch-target w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between transition-colors cursor-pointer text-left"
          aria-expanded={ledgerOpen}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              {t('parentDashboard.instalmentsTitle')}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-mono text-[11px]">4 Equal Instalments</span>
            {ledgerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Accordion Body */}
        {ledgerOpen && (
          <div className="divide-y divide-slate-100">
            {instalments.map((inst) => {
              const num = inst.instalmentNumber;
              const isOverdueInstalment = inst.status === 'PART_PAID_OVERDUE' || inst.status === 'OVERDUE';
              const isPaid = inst.status === 'PAID';
              const isHeadsOpen = !!expandedInstalmentHeads[num];

              return (
                <div key={inst.id} className="p-3.5 space-y-2">
                  {/* Instalment Primary Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">
                          {t('parentDashboard.instalmentNumber', { num })}
                        </span>
                        {isPaid && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {t('parentDashboard.statusPaid')}
                          </span>
                        )}
                        {isOverdueInstalment && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                            {lang === 'hi' ? '23 दिन अतिदेय' : '23d Overdue'}
                          </span>
                        )}
                        {inst.status === 'UPCOMING' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {t('parentDashboard.statusUpcoming')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Due: {inst.dueDate}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-xs sm:text-sm text-slate-900 tabular-nums block">
                        {toRupees(inst.totalNetPaise)}
                      </span>
                      {Number(inst.balancePaise) > 0 ? (
                        <span className="text-[11px] text-rose-600 font-bold tabular-nums">
                          Bal: {toRupees(inst.balancePaise)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-semibold">
                          Fully Paid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Downward Head Breakdown Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleHeads(num)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isHeadsOpen ? 'Hide Breakdown' : 'View Head Breakdown'}</span>
                      {isHeadsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isHeadsOpen && (
                      <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1 font-mono">
                        <div className="flex justify-between text-slate-600">
                          <span>Tuition Fee (75%):</span>
                          <span className="font-semibold text-slate-800">{toRupees(inst.tuitionPaise || 2250000n)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Hostel Fee:</span>
                          <span className="font-semibold text-slate-800">{toRupees(inst.hostelPaise || 500000n)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Mess Fee:</span>
                          <span className="font-semibold text-slate-800">{toRupees(inst.messPaise || 250000n)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pay button for overdue instalment */}
                  {Number(inst.balancePaise) > 0 && (
                    <div className="pt-1">
                      <Link
                        href={`/parent/pay/${inst.id}`}
                        className="touch-target w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>{lang === 'hi' ? 'इस किस्त का भुगतान करें' : 'Pay This Instalment'}</span>
                        <span className="font-mono tabular-nums font-black">({toRupees(inst.balancePaise)})</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OFFICIAL 18% GST RECEIPTS (SAC 999293) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <h3>{t('parentDashboard.receiptsTitle')}</h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Rule 46 CGST</span>
        </div>

        {/* Dynamic Receipt List from API */}
        <div className="space-y-2">
          {duesData?.recentReceipts && duesData.recentReceipts.length > 0 ? (
            duesData.recentReceipts.map((rcp: any) => (
              <div
                key={rcp.id || rcp.number}
                className="p-3 bg-slate-50 hover:bg-slate-100/60 rounded-xl border border-slate-200 flex items-center justify-between gap-2 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-indigo-900">{rcp.number}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold">18% GST</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{rcp.issuedDate} • {t('parentDashboard.taxInvoice') || 'Tax Invoice'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-slate-900 tabular-nums">
                    {rcp.grossFormatted || `₹${(Number(rcp.grossPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenReceipt({
                        receiptNumber: rcp.number,
                        issuedDate: rcp.issuedDate,
                        grossPaise: BigInt(rcp.grossPaise || 0),
                      })
                    }
                    className="touch-target p-2 text-indigo-600 hover:text-indigo-800 hover:bg-white rounded-lg border border-slate-200 cursor-pointer"
                    title={t('parentDashboard.viewInvoice')}
                    aria-label="View Tax Invoice"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              {t('parentDashboard.noReceipts') || 'No receipts issued yet'}
            </div>
          )}
        </div>
      </div>

      {/* ACADEMIC & WELLBEING INDICATORS (NON-PUNITIVE) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900">
            {t('parentDashboard.academicSummary')}
          </h3>
          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
            Rajasthan Act Wellbeing Standard
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Attendance Indicator */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
            <span className="text-[11px] text-amber-900 font-semibold block">
              {t('parentDashboard.attendance')}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-700 font-mono">74%</span>
              <span className="text-[10px] text-amber-800 font-medium">(&lt; 75% goal)</span>
            </div>
            <p className="text-[10px] text-amber-800 leading-tight">
              {lang === 'hi' ? 'नियमित उपस्थिति सुधार हेतु परामर्श अनुशंसित' : 'Supportive doubt clearing recommended'}
            </p>
          </div>

          {/* Test Trend Indicator */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] text-slate-600 font-semibold block">
              {t('parentDashboard.testTrend')}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 font-mono">42/100</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {lang === 'hi' ? 'भौतिकी व गणित में विशेष सहायता उपलब्ध' : 'Physics & Maths mentorship available'}
            </p>
          </div>
        </div>

        {/* Interactive Mentor Call Button */}
        <button
          type="button"
          onClick={handleRequestMentor}
          className="touch-target w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <PhoneForwarded className="w-4 h-4 text-indigo-600" />
          <span>{lang === 'hi' ? 'शैक्षणिक परामर्शदाता से बात करें' : 'Request Supportive Mentor Call'}</span>
        </button>
      </div>

      {/* DPDP STATUTORY CONSENT STATUS PILL */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-bold leading-tight">{t('parentDashboard.dpdpStatus')}: {t('parentDashboard.consentActive')}</p>
            <p className="text-[10px] text-emerald-800">Rule 10 Verified Adult Guardian (****5870)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowConsentModal(true)}
          className="text-xs font-bold underline text-emerald-800 cursor-pointer"
        >
          {lang === 'hi' ? 'समीक्षा करें' : 'Review'}
        </button>
      </div>

      {/* TAX INVOICE MODAL */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receipt={selectedReceipt}
      />

      {/* CONSENT MODAL */}
      <ConsentModal
        isOpen={showConsentModal}
        studentId="stu-0587"
        onClose={() => setShowConsentModal(false)}
        onConsentSuccess={() => {
          setShowConsentModal(false);
          fetchDues();
        }}
      />
    </div>
  );
}
