'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { ShieldCheck, CheckCircle2, Lock, ArrowRight, Loader2, FileText, Check } from 'lucide-react';

export default function RefundApprovalQueue() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [refunds, setRefunds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRefunds = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/refunds');
      if (res.ok) {
        const data = await res.json();
        setRefunds(data.refunds || []);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleApprove = async (refundId: string) => {
    setActionLoadingId(refundId);
    try {
      const res = await fetch(`/api/admin/refunds/${refundId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        success('Refund Approved by Director! Unpaid instalments cancelled and reminders suppressed.');
        fetchRefunds();
      } else {
        throw new Error(data.error?.message || data.error?.detail || data.message || 'Approval failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error approving refund';
      error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSettle = async (refundId: string) => {
    setActionLoadingId(refundId);
    try {
      const res = await fetch(`/api/admin/refunds/${refundId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementMode: 'BANK_TRANSFER',
          bankReference: `NEFT-REF-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        success(`Refund Settled! Credit Note Issued: ${data.creditNote?.number || 'CN/26-27/000001'}`);
        fetchRefunds();
      } else {
        throw new Error(data.error?.message || 'Settlement failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error settling refund';
      error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const currentUserId = user?.id || 'usr-acc-01';
  const currentUserRole = user?.role || 'ACCOUNTS_EXEC';

  // Seed item if list empty
  const displayRefunds = refunds.length > 0 ? refunds : [
    {
      id: 'ref-0412-draft-01',
      studentCode: 'STU-0412',
      studentName: 'Aarav Meena',
      receivedOn: '2026-11-02',
      slaDueDate: '2026-11-12',
      refundablePaise: '2630137',
      refundableFormatted: '₹26,301.37',
      status: 'DRAFT',
      raisedBy: 'usr-acc-01',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Refund Approval & Settlement Queue
          </h3>
          <p className="text-xs text-slate-500">
            Mandatory Segregation of Duties: Approver cannot be the raiser of the refund request.
          </p>
        </div>
        <span className="text-xs text-slate-600 font-mono">
          Session Role: <strong className="text-indigo-700">{currentUserRole}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Request ID</th>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Received On</th>
              <th className="px-4 py-3 text-left">SLA Due Date</th>
              <th className="px-4 py-3 text-right">Refundable</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Raiser / Approver</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {displayRefunds.map((r: any) => {
              const isRaiser = r.raisedBy === currentUserId;
              const canApprove = currentUserRole === 'DIRECTOR' && !isRaiser;

              return (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 text-xs">
                    {r.id.slice(0, 14)}...
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {r.studentName || r.studentCode}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {r.receivedOn}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {r.slaDueDate}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-indigo-700 tabular-nums">
                    {r.refundableFormatted || `₹${(Number(r.refundablePaise || 0) / 100).toLocaleString('en-IN')}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800'
                          : r.status === 'SETTLED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Raiser: {r.raisedBy}</div>
                    {r.approvedBy && <div className="text-emerald-700 font-semibold">Approver: {r.approvedBy}</div>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === 'DRAFT' && (
                      <div className="relative inline-block group">
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={!canApprove || actionLoadingId === r.id}
                          className={`touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            canApprove
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
                          }`}
                        >
                          {!canApprove && <Lock className="w-3.5 h-3.5" />}
                          {actionLoadingId === r.id ? 'Approving...' : 'Approve Refund'}
                        </button>

                        {/* Segregation of Duties Explanatory Tooltip */}
                        {!canApprove && (
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-30 w-64 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl leading-snug">
                            Segregation of Duties: Approver must differ from Raiser. Requires Director role (Dr. Ramesh Agarwal). Switch persona via ReviewerDemoBar.
                          </div>
                        )}
                      </div>
                    )}

                    {r.status === 'APPROVED' && (
                      <button
                        onClick={() => handleSettle(r.id)}
                        disabled={actionLoadingId === r.id}
                        className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settle & Credit Note</span>
                      </button>
                    )}

                    {r.status === 'SETTLED' && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700">
                        <FileText className="w-3.5 h-3.5" />
                        <span>CN/26-27/000001</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
