'use client';

import React, { useState } from 'react';
import { useToast } from '@/src/context/ToastContext';
import { X, CheckCircle2, ShieldCheck, ArrowRight, Loader2, Link2 } from 'lucide-react';

interface ManualMatchModalProps {
  isOpen: boolean;
  payment: any;
  onClose: () => void;
  onSuccess: () => void;
  targetStudentCode?: string;
}

export default function ManualMatchModal({
  isOpen,
  payment,
  onClose,
  onSuccess,
  targetStudentCode = 'STU-0587',
}: ManualMatchModalProps) {
  const { success, error } = useToast();

  const [studentCode, setStudentCode] = useState<string>(targetStudentCode);
  const [instalmentSeq, setInstalmentSeq] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !payment) return null;

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const studentId = studentCode.toLowerCase();
      const instalmentId = `inst-${studentId.replace('stu-', '')}-${instalmentSeq}`;

      const res = await fetch(`/api/admin/unmatched/${payment.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStudentId: studentId,
          targetInstalmentId: instalmentId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || 'Failed to match payment');
      }

      success(`Matched UTR ${payment.bankReference} to ${studentCode}! Receipt ${data.receipt?.receiptNumber || 'issued'}.`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error resolving unmatched payment';
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Manual Reconciliation & Allocation</h2>
              <p className="text-[11px] text-slate-400 font-mono">Assign Unmatched Transfer to Student</p>
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

        {/* Form Body */}
        <form onSubmit={handleResolve} className="p-5 space-y-4 text-xs text-slate-800">
          {/* Unmatched Transaction Context */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Bank UTR Ref:</span>
              <span className="font-bold text-slate-900">{payment.bankReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payer Name:</span>
              <span className="font-semibold text-slate-900">{payment.payerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Amount:</span>
              <span className="font-black text-emerald-700">{payment.amountFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Received Date:</span>
              <span className="text-slate-700">{payment.receivedOn}</span>
            </div>
          </div>

          {/* Student Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Target Student
            </label>
            <select
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
            >
              <option value="STU-0587">Rahul Sharma (STU-0587) - Gopalpura</option>
              <option value="STU-0412">Aarav Meena (STU-0412) - Gopalpura</option>
              <option value="STU-0219">Mohit Gurjar (STU-0219) - Vaishali Nagar</option>
            </select>
          </div>

          {/* Instalment Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Allocate to Instalment
            </label>
            <select
              value={instalmentSeq}
              onChange={(e) => setInstalmentSeq(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
            >
              <option value={3}>Instalment 3 (Overdue Balance: ₹15,000)</option>
              <option value={4}>Instalment 4 (Upcoming Due: ₹30,000)</option>
              <option value={1}>Instalment 1</option>
              <option value={2}>Instalment 2</option>
            </select>
          </div>

          {/* Statutory Assurance Callout */}
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Matching issues an official 18% GST receipt and auto-suppresses queued reminders.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="touch-target px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="touch-target px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Confirm Match & Issue Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
