'use client';

import React from 'react';
import { X, ShieldCheck, CheckCircle2, Clock, Printer } from 'lucide-react';

interface ReceiptProofModalProps {
  isOpen: boolean;
  receiptNumber: string;
  onClose: () => void;
}

export default function ReceiptProofModal({
  isOpen,
  receiptNumber,
  onClose,
}: ReceiptProofModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Auto-Suppression Audit Trail</h2>
              <p className="text-[11px] text-slate-400 font-mono">Rule 8.1 Compliance Attestation</p>
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

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-800">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
            <div className="flex items-center gap-2 font-bold text-purple-950">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              <span>Reminder Atomically Cancelled by Receipt</span>
            </div>
            <p className="text-[11px] text-purple-900 leading-relaxed">
              Upon successful payment allocation, the persistence repository atomically transitioned all pending reminder jobs for this instalment to state <strong className="font-mono">SUPPRESSED_BY_PAYMENT</strong>.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 font-mono text-[11px]">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Suppressing Receipt:</span>
              <span className="font-bold text-purple-950">{receiptNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Timestamp:</span>
              <span className="text-slate-800">2026-10-15T11:42:19Z</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Student Code:</span>
              <span className="font-bold text-slate-900">STU-0412</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Gross Amount:</span>
              <span className="font-bold text-emerald-700">₹30,000.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subsequent Reminders Sent:</span>
              <span className="font-bold text-emerald-600">0 (Zero Leaks)</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500 leading-relaxed">
            Statutory Rule 8.1 Verification: Reminders scheduled for T+3, T+7, and T+15 were permanently cancelled with suppressReason: PAID_IN_FULL.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="touch-target px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Close Proof
          </button>
        </div>
      </div>
    </div>
  );
}
