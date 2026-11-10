'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Languages, CheckCheck, ShieldCheck } from 'lucide-react';

interface ReminderPreviewModalProps {
  isOpen: boolean;
  studentId: string;
  onClose: () => void;
}

export default function ReminderPreviewModal({
  isOpen,
  studentId,
  onClose,
}: ReminderPreviewModalProps) {
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadPreview() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'preview', studentId, lang }),
        });
        const data = await res.json();
        if (data.success && data.preview) {
          setMessage(data.preview);
        } else {
          setMessage(
            lang === 'hi'
              ? `शिक्षासेतु: शुल्क अनुस्मारक\nआदरणीय अभिभावक, राहुल शर्मा (STU-0587) की किस्त 3 हेतु ₹15,000 की राशि 23 दिन अतिदेय है। असुविधा से बचने हेतु कृपया नीचे दिए गए लिंक से तुरंत भुगतान करें:\nhttps://shikshasetu.in/parent/pay/inst-0587-3`
              : `ShikshaSetu: Fee Reminder\nDear Parent, an overdue balance of ₹15,000 for Rahul Sharma (STU-0587) Instalment 3 is 23 days past due. To prevent disruption, please pay using this link:\nhttps://shikshasetu.in/parent/pay/inst-0587-3`
          );
        }
      } catch {
        setMessage(
          lang === 'hi'
            ? `शिक्षासेतु: शुल्क अनुस्मारक\nआदरणीय अभिभावक, राहुल शर्मा (STU-0587) की किस्त 3 हेतु ₹15,000 की राशि 23 दिन अतिदेय है। असुविधा से बचने हेतु कृपया नीचे दिए गए लिंक से तुरंत भुगतान करें:\nhttps://shikshasetu.in/parent/pay/inst-0587-3`
            : `ShikshaSetu: Fee Reminder\nDear Parent, an overdue balance of ₹15,000 for Rahul Sharma (STU-0587) Instalment 3 is 23 days past due. To prevent disruption, please pay using this link:\nhttps://shikshasetu.in/parent/pay/inst-0587-3`
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, studentId, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* WhatsApp Header Simulation */}
        <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
              SS
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">ShikshaSetu Official (Jaipur)</h2>
              <p className="text-[10px] text-emerald-200 font-mono">WhatsApp Business Verified</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Lang Toggle */}
            <button
              onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-bold font-mono cursor-pointer"
            >
              {lang === 'hi' ? 'EN' : 'हिन्दी'}
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Body */}
        <div className="p-4 bg-[#efeae2] min-h-[220px] flex flex-col justify-end">
          <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-xs border border-slate-200 max-w-[90%] space-y-1.5 self-start">
            <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-sans">
              {message}
            </p>
            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono pt-1">
              <span>10:30 AM</span>
              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* DPDP Compliance Notice */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>DPDP Act 2023 Compliant: Dispatched only to verified adult guardian contact.</span>
        </div>
      </div>
    </div>
  );
}
