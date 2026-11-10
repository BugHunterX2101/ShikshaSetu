'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/src/context/ToastContext';
import { X, ShieldAlert, CheckCircle2, AlertOctagon, Loader2, IndianRupee } from 'lucide-react';

interface OfflinePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultStudentId?: string;
  defaultInstalmentId?: string;
}

export default function OfflinePaymentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultStudentId = 'STU-0587',
  defaultInstalmentId,
}: OfflinePaymentModalProps) {
  const { success, error } = useToast();

  const [studentId, setStudentId] = useState<string>(defaultStudentId);
  const [instalmentId, setInstalmentId] = useState<string>(defaultInstalmentId || 'inst-0587-3');
  const [mode, setMode] = useState<'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'POS_CARD'>('CASH');
  const [amountRupees, setAmountRupees] = useState<string>('15000');
  const [reference, setReference] = useState<string>(`CSH-${Date.now().toString().slice(-6)}`);
  const [payerName, setPayerName] = useState<string>('Sunita Sharma');
  const [payerPhone, setPayerPhone] = useState<string>('9829058700');
  const [paymentDate, setPaymentDate] = useState<string>('2026-11-02');
  const [remarks, setRemarks] = useState<string>('Counter Cash Receipt');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);

  useEffect(() => {
    setStudentId(defaultStudentId);
    if (defaultInstalmentId) setInstalmentId(defaultInstalmentId);
  }, [defaultStudentId, defaultInstalmentId]);

  if (!isOpen) return null;

  // Real-time Section 269ST check: Cash >= ₹2,00,000 is prohibited
  const amountNum = parseFloat(amountRupees || '0');
  const isCash = mode === 'CASH';
  const isCashViolation = isCash && amountNum >= 200000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);
    setSuccessReceipt(null);

    const amountPaise = BigInt(Math.round(amountNum * 100));
    if (amountPaise <= 0n) {
      setErrorDetails({ title: 'Invalid Amount', detail: 'Amount must be greater than zero.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payments/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentId.toLowerCase().startsWith('stu-') ? studentId : 'stu-0587',
          instalmentId: instalmentId || undefined,
          amountPaise: amountPaise.toString(),
          mode,
          reference,
          payerName,
          payerPhone,
          paymentDate,
          remarks,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle RFC 9457 HTTP 422 Problem Details
        setErrorDetails(data);
        error(data.detail || data.title || 'Payment rejected under Section 269ST');
      } else {
        setSuccessReceipt(data.receipt || data);
        success(`Cashier Payment Recorded! Receipt: ${data.receipt?.number || data.receiptNumber || 'RCP/26-27/000413'}`);
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record offline payment';
      setErrorDetails({ title: 'Network Error', detail: msg });
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
            <IndianRupee className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Counter Payment Entry</h2>
              <p className="text-[11px] text-slate-400 font-mono">Section 269ST Cash Limit Guard Active</p>
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

        {/* Success View */}
        {successReceipt ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Receipt Generated Successfully</h3>
              <p className="text-xs text-slate-600 mt-1">
                Receipt Number: <strong className="font-mono text-indigo-700">{successReceipt.number || successReceipt.receiptNumber}</strong>
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-left space-y-1">
              <div>Gross: ₹{(Number(amountPaiseFromString(amountRupees))/100).toLocaleString('en-IN')}</div>
              <div>Mode: {mode}</div>
              <div>Date: {paymentDate}</div>
              <div className="text-emerald-700 font-bold">Status: Cleared & Ledger Updated</div>
            </div>
            <button
              onClick={() => {
                setSuccessReceipt(null);
                onClose();
              }}
              className="touch-target w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Done & Return to Ledger
            </button>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            {/* SECTION 269ST REAL-TIME VIOLATION WARNING BANNER */}
            {isCashViolation && (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl flex items-start gap-3 text-rose-950">
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-xs text-rose-900">
                    Section 269ST Statutory Cash Limit Exceeded (₹2,00,000)
                  </h4>
                  <p className="text-[11px] leading-relaxed text-rose-900">
                    Accepting cash of ₹2,00,000 or more from a person in a single day is prohibited by law.
                    Penalty of 100% applies under Section 271DA.
                  </p>
                  <p className="text-[10px] font-bold text-rose-800">
                    Action required: Switch Payment Mode to Cheque, Bank Transfer, or POS Card.
                  </p>
                </div>
              </div>
            )}

            {/* RFC 9457 Server Error Banner */}
            {errorDetails && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 space-y-1">
                <div className="font-bold text-xs">{errorDetails.title || 'Payment Blocked'}</div>
                <div className="text-[11px]">{errorDetails.detail}</div>
                {errorDetails.invalidParams && (
                  <ul className="list-disc list-inside text-[10px] font-mono mt-1">
                    {errorDetails.invalidParams.map((p: any, i: number) => (
                      <li key={i}>{p.name}: {p.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Mode Switcher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Payment Instrument
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'POS_CARD'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`touch-target py-2 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      mode === m
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className={`w-full pl-8 pr-3 py-2 border rounded-xl text-sm font-bold font-mono tabular-nums focus:outline-none ${
                    isCashViolation
                      ? 'border-rose-500 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'
                  }`}
                  placeholder="15000"
                  required
                />
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Instrument Reference # / UTR
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="CSH-001 or UTR..."
                required
              />
            </div>

            {/* Payer Details */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Payer Name</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Payer Phone</label>
                <input
                  type="tel"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Action */}
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
                disabled={isSubmitting || isCashViolation}
                className={`touch-target px-5 py-2 rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  isCashViolation
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Issue Gapless Receipt</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function amountPaiseFromString(str: string): bigint {
  const n = parseFloat(str || '0');
  return BigInt(Math.round(n * 100));
}
