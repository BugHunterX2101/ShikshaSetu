'use client';

import React, { useState } from 'react';
import { useAuth, PersonaKey } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/i18n';
import { UserCheck, ChevronUp, ChevronDown, Calendar, Sparkles } from 'lucide-react';
import { isDemoMode } from '@/src/lib/demoMode';

export function ReviewerDemoBar() {
  if (!isDemoMode()) {
    return null;
  }

  const { activePersona, switchPersona, isLoading } = useAuth();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  const personas: Array<{
    key: PersonaKey;
    label: string;
    subtext: string;
    targetPath: string;
    badgeColor: string;
  }> = [
    {
      key: 'PARENT',
      label: '1. Parent (Sunita / STU-0587)',
      subtext: '₹55k Due • 5-sec Dues View',
      targetPath: '/parent/dashboard',
      badgeColor: 'border-emerald-500 text-emerald-800 bg-emerald-50',
    },
    {
      key: 'ACCOUNTS_EXEC',
      label: '2. Accounts (Rajesh Kumar)',
      subtext: 'Ageing Buckets & Tally Export',
      targetPath: '/admin/dashboard',
      badgeColor: 'border-blue-500 text-blue-800 bg-blue-50',
    },
    {
      key: 'DIRECTOR',
      label: '3. Director (Dr. Ramesh Agarwal)',
      subtext: 'Refund Approval & AI Risk',
      targetPath: '/admin/refunds',
      badgeColor: 'border-purple-500 text-purple-800 bg-purple-50',
    },
    {
      key: 'CASHIER',
      label: '4. Cashier (Mukesh Verma)',
      subtext: 'Sec 269ST Counter Payment',
      targetPath: '/admin/students/STU-0587',
      badgeColor: 'border-amber-500 text-amber-800 bg-amber-50',
    },
  ];

  return (
    <aside
      aria-label="Evaluator Demo Controls"
      className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-700 shadow-md text-xs"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 flex items-center justify-between gap-2">
        {/* Left: Evaluator Badge & Anchor Date */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold tracking-tight text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>EVALUATOR QUICK-PERSONA</span>
          </div>
          <div className="hidden lg:flex items-center gap-1 text-slate-400 font-mono text-[11px]">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>Anchor: 2026-11-02</span>
          </div>
        </div>

        {/* Middle: 4 One-Click Persona Buttons (Hidden if collapsed on mobile) */}
        {!collapsed && (
          <nav
            aria-label="Persona Quick Switch"
            className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none flex-1 justify-center"
          >
            {personas.map((p) => {
              const isActive = activePersona === p.key;
              return (
                <button
                  key={p.key}
                  disabled={isLoading}
                  onClick={() => switchPersona(p.key)}
                  className={`touch-target px-2.5 py-1 rounded-md border text-left transition-all whitespace-nowrap flex flex-col justify-center cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-xs ring-1 ring-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                  }`}
                  title={`Switch to ${p.label} - ${p.subtext}`}
                >
                  <span className="leading-tight font-medium text-[11px]">{p.label}</span>
                  <span className={`text-[10px] leading-none ${isActive ? 'text-slate-900 font-normal' : 'text-slate-400'}`}>
                    {p.subtext}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: Active Role Tag & Mobile Collapse Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-1 rounded text-[11px]">
            <UserCheck className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold text-emerald-400">{activePersona}</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
            aria-label={collapsed ? 'Expand Demo Bar' : 'Collapse Demo Bar'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
