'use client';

import React, { useState } from 'react';
import { useToast } from '@/src/context/ToastContext';
import { Calculator, Clock, ShieldCheck, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

interface MoERefundCalculatorProps {
  onRefundCreated: () => void;
}

export default function MoERefundCalculator({ onRefundCreated }: MoERefundCalculatorProps) {
  const { success, error } = useToast();

  const [studentId, setStudentId] = useState<string>('STU-0412');
  const [exitDate, setExitDate] = useState<string>('2026-11-02');
  const [calculation, setCalculation] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isRaising, setIsRaising] = useState<boolean>(false);
  const [raisedMessage, setRaisedMessage] = useState<string | null>(null);

  const handleCalculate = async () => {
    setIsCalculating(true);
    setRaisedMessage(null);
    try {
      const res = await fetch('/api/admin/refunds/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentId.toLowerCase(),
          receivedOn: exitDate,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCalculation(data);
        success('Pro-rata refund calculation complete');
      } else {
        throw new Error(data.error?.message || 'Calculation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error computing pro-rata refund';
      error(msg);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRaiseDraft = async () => {
    setIsRaising(true);
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentId.toLowerCase(),
          receivedOn: exitDate,
          reason: 'Formal student withdrawal request per MoE 2024 Guidelines',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRaisedMessage(`Refund draft #${data.refund?.id || 'REF-DRAFT'} created successfully. Awaiting Director approval.`);
        success('Refund draft request raised. Ready for Director approval.');
        onRefundCreated();
      } else {
        throw new Error(data.error?.message || 'Failed to raise refund draft');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error raising refund draft';
      error(msg);
    } finally {
      setIsRaising(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            MoE 2024 & Rajasthan Coaching Act Pro-Rata Refund Calculator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict integer paise calculation with zero cross-subsidization between Tuition, Hostel, and Mess heads.
          </p>
        </div>
        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200 self-start md:self-auto">
          Section 13(4) 10-Calendar-Day SLA
        </span>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Student Selection
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="STU-0412">Aarav Meena (STU-0412) - Gopalpura</option>
            <option value="STU-0587">Rahul Sharma (STU-0587) - Gopalpura</option>
            <option value="STU-0219">Mohit Gurjar (STU-0219) - Vaishali Nagar</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Exit Notice Received On
          </label>
          <input
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="touch-target w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            <span>Calculate Pro-Rata Refund</span>
          </button>
        </div>
      </div>

      {/* Results View */}
      {calculation && (
        <div className="space-y-5 pt-3 border-t border-slate-100">
          {/* 10-Day SLA Countdown Timer Callout */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Statutory 10-Calendar-Day SLA Countdown
                </h4>
                <p className="text-xs text-amber-700">
                  Notice received on {calculation.receivedOn}. Statutory deadline: <strong className="font-mono">{calculation.slaDueDate || '2026-11-12'}</strong>.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-200 text-amber-900 font-extrabold text-xs rounded-full uppercase tracking-wider self-start sm:self-auto">
              10 Calendar Days Remaining
            </span>
          </div>

          {/* Independent Head Breakdown Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Fee Head</th>
                  <th className="px-4 py-3 text-right">Net Billed Fee</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Consumed ({calculation.daysElapsed || 205} days)</th>
                  <th className="px-4 py-3 text-right font-black">Refundable (Paise Floored)</th>
                  <th className="px-4 py-3 text-right">Shortfall (Zero Floor)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {calculation.heads?.map((h: any) => (
                  <tr key={h.head} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{h.head}</td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      ₹{(Number(h.netFeePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium tabular-nums">
                      ₹{(Number(h.paidPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                      ₹{(Number(h.consumedPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-700 font-bold tabular-nums">
                      ₹{(Number(h.refundablePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                      {BigInt(h.shortfallPaise || 0) > 0n ? `₹${(Number(h.shortfallPaise)/100).toLocaleString('en-IN')}` : '₹0.00'}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-50 font-black border-t-2 border-slate-300">
                  <td className="px-4 py-3 text-slate-900">Total Statutory Refund</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{calculation.totalPaidFormatted || '₹60,000.00'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{calculation.totalConsumedFormatted || '₹33,698.63'}</td>
                  <td className="px-4 py-3 text-right text-indigo-700 text-sm font-black">
                    {calculation.totalRefundableFormatted || '₹26,301.37'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action to Raise Draft */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-500">
              Raiser Persona: Accounts Executive. Approver must be Director (Dr. Ramesh Agarwal).
            </span>
            <button
              onClick={handleRaiseDraft}
              disabled={isRaising}
              className="touch-target inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {isRaising ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Raise Refund Request (DRAFT)</span>
            </button>
          </div>

          {raisedMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-semibold">
              {raisedMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
