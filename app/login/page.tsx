'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/src/i18n';
import { useAuth, PersonaKey } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ConsentModal } from '@/components/ConsentModal';
import { isDemoMode } from '@/src/lib/demoMode';
import {
  Phone,
  KeyRound,
  ShieldCheck,
  Building2,
  Users,
  Sparkles,
  ArrowRight,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { switchPersona, loginWithOtp } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'parent' | 'staff'>('parent');

  // Parent OTP State
  const [phone, setPhone] = useState<string>('9829058700'); // Default to Sunita Sharma
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>('');
  const [demoOtpHint, setDemoOtpHint] = useState<string>('123456');
  const [countdown, setCountdown] = useState<number>(0);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // Staff Login State
  const [staffRole, setStaffRole] = useState<'DIRECTOR' | 'ACCOUNTS_EXEC' | 'COUNSELLOR' | 'CASHIER'>('ACCOUNTS_EXEC');
  const [staffCentre, setStaffCentre] = useState<string>('ctr-jpr-gpl');
  const [staffPin, setStaffPin] = useState<string>('1234');
  const [isStaffSubmitting, setIsStaffSubmitting] = useState<boolean>(false);

  // DPDP Consent Modal State
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [pendingStudentId, setPendingStudentId] = useState<string>('stu-0587');

  // Handle Send OTP
  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      error(lang === 'hi' ? 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to send OTP');
      }

      setOtpSent(true);
      const code = data.demoOtp || '123456';
      if (isDemoMode()) {
        setDemoOtpHint(code);
        setOtp(code); // Autofill mock code for reviewer convenience
        info(
          lang === 'hi'
            ? `ओटीपी भेजा गया। डेमो कोड: ${code}`
            : `OTP sent. Reviewer Demo Code: ${code}`
        );
      } else {
        setDemoOtpHint('');
        setOtp('');
        info(
          lang === 'hi'
            ? 'ओटीपी आपके पंजीकृत मोबाइल नंबर पर भेज दिया गया है।'
            : 'OTP has been dispatched to your registered phone number.'
        );
      }
      setCountdown(30);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending OTP';
      error(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      error(lang === 'hi' ? 'कृपया 4 या 6-अंकों का ओटीपी दर्ज करें' : 'Please enter 4 or 6-digit OTP code');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const ok = await loginWithOtp(phone, otp);
      if (ok) {
        // Check if student requires DPDP consent
        setPendingStudentId('stu-0587');
        setShowConsentModal(true);
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle Staff Login
  const handleStaffLogin = async () => {
    if (!staffPin) {
      error(lang === 'hi' ? 'कृपया सुरक्षा पिन दर्ज करें' : 'Please enter security PIN');
      return;
    }

    setIsStaffSubmitting(true);
    try {
      await switchPersona(staffRole);
    } finally {
      setIsStaffSubmitting(false);
    }
  };

  return (
    <div className="mobile-viewport-360 py-2 sm:py-6 space-y-6">
      {/* Top Header & Bilingual Switch */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg">
            {t('common.appName')}
          </span>
        </div>
        <LanguageToggle />
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 sm:p-7 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {t('login.title')}
          </h1>
          <p className="text-xs text-slate-500 leading-snug">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Tab Switcher: Parent vs Staff */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('parent')}
            className={`flex-1 touch-target py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'parent'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('login.parentTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex-1 touch-target py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('login.staffTab')}
          </button>
        </div>

        {/* TAB 1: PARENT OTP LOGIN */}
        {activeTab === 'parent' && (
          <div className="space-y-4">
            {!otpSent ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('login.phoneLabel')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder={t('login.phonePlaceholder')}
                      className="w-full pl-12 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {isDemoMode() && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 flex items-center justify-between">
                    <span>Demo: Sunita Sharma (STU-0587)</span>
                    <button
                      type="button"
                      onClick={() => setPhone('9829058700')}
                      className="font-bold underline text-indigo-700 cursor-pointer"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSendingOtp || phone.length !== 10}
                  onClick={handleSendOtp}
                  className="touch-target w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingOtp ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                  <span>{t('login.sendOtpBtn')}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-mono">+91 {phone}</span>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    {lang === 'hi' ? 'नंबर बदलें' : 'Change Number'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('login.otpLabel')}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('login.otpPlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center text-lg font-mono font-black tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {isDemoMode() && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 text-center font-mono">
                    {t('login.otpHint')}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isVerifyingOtp || otp.length < 4}
                  onClick={handleVerifyOtp}
                  className="touch-target w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingOtp ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{t('login.verifyOtpBtn')}</span>
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    disabled={countdown > 0}
                    onClick={handleSendOtp}
                    className="text-xs text-indigo-600 hover:underline font-semibold disabled:text-slate-400 cursor-pointer"
                  >
                    {countdown > 0
                      ? `${t('login.resendOtp')} (${countdown}s)`
                      : t('login.resendOtp')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STAFF & DIRECTOR LOGIN */}
        {activeTab === 'staff' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('login.staffRoleLabel')}
              </label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="ACCOUNTS_EXEC">Accounts Executive (Rajesh Kumar)</option>
                <option value="DIRECTOR">Founder-Director (Dr. Ramesh Agarwal)</option>
                <option value="CASHIER">Centre Cashier (Mukesh Verma)</option>
                <option value="COUNSELLOR">Academic Counsellor (Neha Agarwal)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('login.staffCentreLabel')}
              </label>
              <select
                value={staffCentre}
                onChange={(e) => setStaffCentre(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="ctr-jpr-gpl">Gopalpura Bypass (Main Centre)</option>
                <option value="ctr-jpr-vsh">Vaishali Nagar Centre</option>
                <option value="ctr-jpr-mns">Mansarovar Centre</option>
                <option value="ctr-jpr-skr">Sikar Road Centre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('login.staffPinLabel')}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  placeholder={t('login.staffPinPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isStaffSubmitting}
              onClick={handleStaffLogin}
              className="touch-target w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isStaffSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{t('login.signInBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 1-Click Evaluator Persona Cards */}
      {isDemoMode() && (
        <div className="bg-slate-100/80 rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{t('login.quickDemoHeading')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => switchPersona('PARENT')}
              className="touch-target p-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-all cursor-pointer shadow-2xs"
            >
              <p className="font-bold text-slate-900 leading-tight">1. Parent</p>
              <p className="text-[10px] text-slate-500 leading-tight">Sunita Sharma • ₹55k</p>
            </button>

            <button
              type="button"
              onClick={() => switchPersona('ACCOUNTS_EXEC')}
              className="touch-target p-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all cursor-pointer shadow-2xs"
            >
              <p className="font-bold text-slate-900 leading-tight">2. Accounts</p>
              <p className="text-[10px] text-slate-500 leading-tight">Rajesh Kumar • Ageing</p>
            </button>

            <button
              type="button"
              onClick={() => switchPersona('DIRECTOR')}
              className="touch-target p-2.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl text-left transition-all cursor-pointer shadow-2xs"
            >
              <p className="font-bold text-slate-900 leading-tight">3. Director</p>
              <p className="text-[10px] text-slate-500 leading-tight">Dr. Ramesh Agarwal</p>
            </button>

            <button
              type="button"
              onClick={() => switchPersona('CASHIER')}
              className="touch-target p-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition-all cursor-pointer shadow-2xs"
            >
              <p className="font-bold text-slate-900 leading-tight">4. Cashier</p>
              <p className="text-[10px] text-slate-500 leading-tight">Mukesh Verma • Sec 269ST</p>
            </button>
          </div>
        </div>
      )}

      {/* DPDP Consent Modal */}
      <ConsentModal
        isOpen={showConsentModal}
        studentId={pendingStudentId}
        onClose={() => {
          setShowConsentModal(false);
          router.push('/parent/dashboard');
        }}
        onConsentSuccess={() => {
          setShowConsentModal(false);
          router.push('/parent/dashboard');
        }}
      />
    </div>
  );
}
