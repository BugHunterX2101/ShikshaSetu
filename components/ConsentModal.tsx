'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/src/i18n';
import { useToast } from '@/src/context/ToastContext';
import { ShieldCheck, AlertCircle, Lock, Calendar, Check, X, FileText } from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  onConsentSuccess?: () => void;
}

export function ConsentModal({
  isOpen,
  onClose,
  studentId = 'stu-0587',
  onConsentSuccess,
}: ConsentModalProps) {
  const { t, lang } = useLanguage();
  const { success, error, warning } = useToast();

  const [dobYear, setDobYear] = useState<string>('1982');
  const [kycDigits, setKycDigits] = useState<string>('5870');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGrantConsent = async () => {
    setErrorMessage(null);
    const year = parseInt(dobYear, 10);
    const currentYear = 2026;

    if (isNaN(year) || currentYear - year < 18) {
      setErrorMessage(
        lang === 'hi'
          ? 'अभिभावक की आयु कम से कम 18 वर्ष (जन्म वर्ष 2008 या उससे पूर्व) होनी अनिवार्य है।'
          : 'Adult guardian must be at least 18 years of age (birth year 2008 or earlier).'
      );
      return;
    }

    if (!kycDigits || kycDigits.length !== 4) {
      setErrorMessage(
        lang === 'hi'
          ? 'कृपया आधार/पहचान पत्र के अंतिम 4 अंक (उदा. 5870) दर्ज करें।'
          : 'Please enter the exact last 4 digits of guardian ID (e.g. 5870).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          purposeCode: 'CORE_EDUCATION_FEES',
          language: lang,
          guardianDobYear: year,
          guardianIdLast4: kycDigits,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error?.detail || 'Failed to record consent');
      }

      success(
        lang === 'hi' ? 'सत्यापनीय सहमति सफलतापूर्वक दर्ज की गई।' : 'Verifiable parental consent recorded successfully.'
      );
      if (onConsentSuccess) {
        onConsentSuccess();
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error recording consent';
      setErrorMessage(msg);
      error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineConsent = () => {
    warning(
      lang === 'hi'
        ? 'सहमति अस्वीकार: ऑनलाइन शुल्क पोर्टल प्रतिबंधित रहेगा। कृपया काउंटर पर संपर्क करें।'
        : 'Consent declined: Online fee features remain restricted. Please visit the offline fee counter.'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-blue-800 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">{t('login.dpdpModalTitle')}</h2>
              <p className="text-[11px] text-indigo-200 font-mono">DPDP Act 2023 s.9(1) & Rules 2025 Rule 10</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-md cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          {/* Statutory Purpose */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>{t('login.dpdpPurposeTitle')}</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {t('login.dpdpPurposeCode')}
            </p>
          </div>

          {/* Data Fiduciary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <p className="font-bold text-slate-900">{t('login.dpdpFiduciaryTitle')}</p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              {t('login.dpdpFiduciary')}
            </p>
          </div>

          {/* Statutory 72-Month Retention Note */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>{t('login.dpdpTaxRetentionTitle')}</span>
            </div>
            <p className="text-amber-900 text-[11px] leading-relaxed">
              {t('login.dpdpTaxRetention')}
            </p>
          </div>

          {/* Adult Guardian KYC Verification Inputs */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
            <p className="font-bold text-slate-900">{t('login.dpdpGuardianKycTitle')}</p>
            <p className="text-slate-500 text-[11px]">{t('login.dpdpGuardianKyc')}</p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {lang === 'hi' ? 'अभिभावक जन्म वर्ष' : 'Guardian Birth Year'}
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="number"
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    placeholder="1982"
                    min="1940"
                    max="2008"
                    className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400">Age &ge; 18 in 2026</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {lang === 'hi' ? 'पहचान अंतिम 4 अंक' : 'ID Last 4 Digits'}
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={kycDigits}
                  onChange={(e) => setKycDigits(e.target.value.replace(/\D/g, ''))}
                  placeholder="5870"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 font-mono">Demo: 5870</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDeclineConsent}
            className="w-full sm:w-auto touch-target px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
          >
            {t('login.dpdpDeclineBtn')}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGrantConsent}
            className="w-full sm:w-auto touch-target px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{t('login.dpdpAcceptBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
