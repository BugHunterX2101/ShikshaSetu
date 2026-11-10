'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calculator, AlertTriangle } from 'lucide-react';
import MoERefundCalculator from '@/components/admin/MoERefundCalculator';
import RefundApprovalQueue from '@/components/admin/RefundApprovalQueue';
import DropoutRiskHeroCard from '@/components/admin/DropoutRiskHeroCard';
import DropoutRiskTable from '@/components/admin/DropoutRiskTable';

function AdminRefundsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'risk-queue' ? 'risk-queue' : 'calculator';
  const [activeTab, setActiveTab] = useState<'calculator' | 'risk-queue'>(initialTab);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              MoE 2024 Guidelines & Rajasthan Coaching Act s.13(4)
            </span>
            <span className="text-xs text-slate-500 font-mono">10-Day SLA Enforcement</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Compliance, Refunds & AI Dropout Prevention
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Independent head pro-rata calculator, Segregation of Duties approval workflow & explainable dropout risk engine
          </p>
        </div>

        {/* Dual-Workspace Tab Switcher */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`touch-target flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>MoE Refund Calculator & Queue</span>
          </button>
          <button
            onClick={() => setActiveTab('risk-queue')}
            className={`touch-target flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'risk-queue'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>AI Dropout Risk Queue (STU-0587)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: MoE Refund Calculator & Segregation of Duties Queue */}
      {activeTab === 'calculator' && (
        <div className="space-y-6">
          <MoERefundCalculator onRefundCreated={triggerRefresh} />
          <div className="border-t border-slate-200 pt-6">
            <RefundApprovalQueue key={refreshTrigger} />
          </div>
        </div>
      )}

      {/* Tab 2: Explainable AI Dropout Risk Queue */}
      {activeTab === 'risk-queue' && (
        <div className="space-y-6">
          {/* Canonical STU-0587 Showcase Card */}
          <DropoutRiskHeroCard studentId="STU-0587" />

          {/* Full Ranked Risk Queue */}
          <div className="border-t border-slate-200 pt-6">
            <DropoutRiskTable />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRefundsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading...</div>}>
      <AdminRefundsContent />
    </Suspense>
  );
}
