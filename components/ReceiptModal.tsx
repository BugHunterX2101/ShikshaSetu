'use client';

import React from 'react';
import { useLanguage } from '@/src/i18n';
import { Printer, X, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { calculateGstReverseSplit } from '@/src/domain/gst';

export interface ReceiptData {
  id?: string;
  receiptNumber: string;
  issuedDate: string;
  studentName?: string;
  studentCode?: string;
  courseName?: string;
  centreName?: string;
  centreReg?: string;
  gstin?: string;
  grossPaise: bigint | string | number;
  paymentMode?: string;
  referenceNo?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

export function ReceiptModal({ isOpen, onClose, receipt }: ReceiptModalProps) {
  const { t, lang } = useLanguage();

  if (!isOpen || !receipt) return null;

  const grossBig = BigInt(String(receipt.grossPaise || 1500000));
  const split = calculateGstReverseSplit(grossBig);

  const formatPaise = (p: bigint): string => {
    return (Number(p) / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {lang === 'hi' ? 'आधिकारिक 18% जीएसटी कर चालान' : 'Official 18% GST Tax Invoice'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">SAC 999293 • Coaching Services</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Invoice Container */}
        <div id="tax-invoice-printable" className="p-6 space-y-4 text-xs text-slate-800 bg-white">
          {/* Institute Header */}
          <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div>
              <h3 className="font-black text-slate-950 text-base leading-tight">
                Company A Coaching Institute Pvt. Ltd.
              </h3>
              <p className="text-slate-600 text-[11px] mt-0.5">
                {receipt.centreName || 'Gopalpura Bypass (Main Centre), Jaipur, Rajasthan - 302018'}
              </p>
              <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-slate-500">
                <span>Reg: <strong>{receipt.centreReg || 'RJ-COACH-2025-0412'}</strong></span>
                <span>•</span>
                <span>GSTIN: <strong>{receipt.gstin || '08AAAAA0000A1Z5'}</strong></span>
              </div>
            </div>

            <div className="text-left sm:text-right font-mono flex-shrink-0">
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs">
                {receipt.receiptNumber}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Date: {receipt.issuedDate}</p>
            </div>
          </div>

          {/* Student Context */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
            <div>
              <span className="text-slate-500 block">Student Name:</span>
              <span className="font-bold text-slate-900">{receipt.studentName || 'Rahul Sharma'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Student Roll ID:</span>
              <span className="font-mono font-bold text-slate-900">{receipt.studentCode || 'STU-0587'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Course / Programme:</span>
              <span className="text-slate-800">{receipt.courseName || 'JEE Advanced 2-Year Evening'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Payment Mode:</span>
              <span className="font-semibold text-slate-800">{receipt.paymentMode || 'UPI / NetBanking'}</span>
            </div>
          </div>

          {/* 18% GST Reverse Split Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-[11px] flex justify-between">
              <span>Description (SAC 999293)</span>
              <span>Amount</span>
            </div>
            <div className="p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Billed Service Fee:</span>
                <span className="font-bold tabular-nums">{formatPaise(grossBig)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Taxable Service Value:</span>
                <span className="font-mono tabular-nums text-slate-800">{formatPaise(split.taxablePaise)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 bg-indigo-50/50 px-1 rounded">
                <span>Central GST (CGST @ 9%):</span>
                <span className="font-mono tabular-nums font-semibold">{formatPaise(split.cgstPaise)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 bg-indigo-50/50 px-1 rounded">
                <span>State GST (SGST @ 9%):</span>
                <span className="font-mono tabular-nums font-semibold">{formatPaise(split.sgstPaise)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-slate-950">
                <span>Total Amount Paid (Gross):</span>
                <span className="text-emerald-700 tabular-nums">{formatPaise(grossBig)}</span>
              </div>
            </div>
          </div>

          {/* Exact Paisa Invariant Callout */}
          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[10px] text-emerald-950 font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Exact Paisa Invariant: {formatPaise(split.taxablePaise)} + {formatPaise(split.cgstPaise)} + {formatPaise(split.sgstPaise)} = {formatPaise(grossBig)}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 text-center pt-1">
            This is a system-generated computer invoice. Mandatory 72-month retention under Section 36 CGST Act 2017.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="touch-target px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
          >
            {t('common.close')}
          </button>
          <button
            onClick={handlePrint}
            className="touch-target px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('parentDashboard.printReceipt') || t('common.print')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
