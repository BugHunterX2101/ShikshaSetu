'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/src/i18n';
import { ArrowRight, Calendar, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface DuesCardProps {
  studentName?: string;
  studentCode?: string;
  centreName?: string;
  courseName?: string;
  totalDuesPaise: bigint | string | number;
  netFeePaise: bigint | string | number;
  totalPaidPaise: bigint | string | number;
  nextDueDate?: string;
  statusBadge?: string;
  overdueDays?: number;
  payTargetId?: string;
}

export function DuesCard({
  studentName = 'Rahul Sharma',
  studentCode = 'STU-0587',
  centreName = 'Gopalpura Bypass (Main Centre)',
  courseName = 'JEE Advanced 2-Year Evening',
  totalDuesPaise = 5500000n, // ₹55,000 default or actual
  netFeePaise = 12000000n,   // ₹1,20,000
  totalPaidPaise = 6500000n, // ₹65,000
  nextDueDate = '2026-11-10',
  statusBadge = 'PART_PAID_OVERDUE',
  overdueDays = 23,
  payTargetId = 'stu-0587',
}: DuesCardProps) {
  const { t, lang } = useLanguage();

  const toRupees = (paise: bigint | string | number): string => {
    const p = typeof paise === 'bigint' ? Number(paise) : Number(paise);
    return (p / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  };

  const isOverdue = Number(totalDuesPaise) > 0;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-5 relative overflow-hidden">
      {/* Top Banner Accent */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isOverdue ? 'bg-amber-500' : 'bg-emerald-500'}`} />

      {/* Student Context Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
              {studentName}
            </h1>
            <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              {studentCode}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium truncate max-w-[260px] sm:max-w-none mt-0.5">
            {courseName} • {centreName}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          {statusBadge === 'PART_PAID_OVERDUE' ? (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>{lang === 'hi' ? `${overdueDays} दिन अतिदेय` : `${overdueDays}d Overdue`}</span>
            </span>
          ) : isOverdue ? (
            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-300 px-2 py-1 rounded-lg text-[11px] font-bold">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>{t('parentDashboard.statusOverdue')}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg text-[11px] font-bold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{t('parentDashboard.statusPaid')}</span>
            </span>
          )}
        </div>
      </div>

      {/* 5-Second Dues Comprehension Primary Number */}
      <div className="my-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t('parentDashboard.totalDues')}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${isOverdue ? 'text-amber-600' : 'text-emerald-600'}`}>
            {toRupees(totalDuesPaise)}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            SAC 999293
          </span>
        </div>
      </div>

      {/* Fee Breakdown Row */}
      <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
        <div>
          <span className="text-[11px] text-slate-500 block">{t('parentDashboard.netFee')}</span>
          <span className="font-bold text-slate-800 tabular-nums text-sm">
            {toRupees(netFeePaise)}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-slate-500 block">{t('parentDashboard.totalPaid')}</span>
          <span className="font-bold text-emerald-700 tabular-nums text-sm">
            {toRupees(totalPaidPaise)}
          </span>
        </div>
      </div>

      {/* Next Due Date & Statutory Callout */}
      <div className="flex items-center justify-between text-xs text-slate-600 mb-4 px-1">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{t('parentDashboard.nextDueDate')}: <strong className="font-mono text-slate-800">{nextDueDate}</strong></span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Raj. Act 2025</span>
        </div>
      </div>

      {/* Full-width 48px Pay Now CTA Button */}
      <Link
        href={`/parent/pay/${payTargetId}`}
        className="touch-target w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
        aria-label="Pay outstanding dues now"
      >
        <span>{t('parentDashboard.payNowCta')}</span>
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
