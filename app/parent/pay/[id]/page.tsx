'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/src/i18n';
import { useToast } from '@/src/context/ToastContext';
import { calculateGstReverseSplit } from '@/src/domain/gst';
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  Printer,
  ArrowLeft,
  Copy,
  AlertCircle,
  FileText,
  Lock,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PaymentCheckoutPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const targetId = unwrappedParams.id;

  const router = useRouter();
  const { t, lang } = useLanguage();
  const { success, error, info } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [studentInfo, setStudentInfo] = useState<any>({
    name: 'Rahul Sharma',
    code: 'STU-0587',
    course: 'JEE Advanced 2-Year Evening',
    centre: 'Gopalpura Bypass (Main Centre)',
  });

  const fullBalanceRupees = 15000;
  const [payOption, setPayOption] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customAmountStr, setCustomAmountStr] = useState<string>('15000');
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<number>(15000);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Payment Method Selection
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'NETBANKING' | 'CARD'>('UPI');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC');
  const [vpaId] = useState<string>('shikshasetu.stu0587@icici');

  // Submission & Success States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [generatedReceipt, setGeneratedReceipt] = useState<any>(null);
  const [suppressedRemindersCount, setSuppressedRemindersCount] = useState<number>(5);

  // Initialize data
  useEffect(() => {
    async function loadCheckoutData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/payments/checkout?studentId=stu-0587&instalmentId=${targetId}&amountPaise=1500000`);
        const data = await res.json();
        if (data.success && data.student) {
          setStudentInfo({
            name: data.student.fullName || 'Rahul Sharma',
            code: data.student.studentCode || 'STU-0587',
            course: 'JEE Advanced 2-Year',
            centre: 'Gopalpura Bypass',
          });
        }
      } catch {
        // Fallback to canonical values
      } finally {
        setIsLoading(false);
      }
    }
    loadCheckoutData();
  }, [targetId]);

  // Update amount and validate minimum ₹500
  const handleAmountChange = (valStr: string) => {
    setCustomAmountStr(valStr);
    const num = parseFloat(valStr);

    if (isNaN(num) || num < 500) {
      setAmountError(t('parentPay.minAmountValidation'));
      setPaymentAmountRupees(0);
    } else if (num > fullBalanceRupees) {
      setAmountError(
        lang === 'hi'
          ? `भुगतान राशि कुल देय राशि (₹${fullBalanceRupees.toLocaleString('en-IN')}) से अधिक नहीं हो सकती`
          : `Amount cannot exceed full balance (₹${fullBalanceRupees.toLocaleString('en-IN')})`
      );
      setPaymentAmountRupees(0);
    } else {
      setAmountError(null);
      setPaymentAmountRupees(Math.floor(num));
    }
  };

  const handleSelectPayOption = (opt: 'FULL' | 'CUSTOM') => {
    setPayOption(opt);
    if (opt === 'FULL') {
      setPaymentAmountRupees(fullBalanceRupees);
      setCustomAmountStr(String(fullBalanceRupees));
      setAmountError(null);
    } else {
      handleAmountChange(customAmountStr);
    }
  };

  // Live 18% GST reverse split calculation
  const currentGrossPaise = BigInt(Math.max(0, paymentAmountRupees) * 100);
  const gstSplit = calculateGstReverseSplit(currentGrossPaise);

  const formatPaise = (p: bigint): string => {
    return (Number(p) / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  const handleCopyVpa = () => {
    try {
      navigator.clipboard.writeText(vpaId);
      info(lang === 'hi' ? 'यूपीआई आईडी कॉपी की गई' : 'UPI ID copied to clipboard');
    } catch {
      // Fallback
    }
  };

  // Submit Simulation Payment
  const handleSimulatePayment = async () => {
    if (paymentAmountRupees < 500) {
      error(t('parentPay.minAmountValidation'));
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        action: 'simulate',
        studentId: 'stu-0587',
        instalmentId: targetId.startsWith('inst-') ? targetId : 'inst-0587-3',
        amountPaise: (paymentAmountRupees * 100).toString(),
        paymentMethod: selectedMethod,
        receivedOn: '2026-11-02',
        gatewayPaymentId: `pay_sim_${Date.now()}`,
      };

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error?.detail || 'Payment simulation failed');
      }

      // Read genuine receipt and suppression metadata from checkout response
      const receiptNo = data.receiptNumber || data.receipt?.receiptNumber || 'RCP/26-27/000413';
      const remCount = data.remindersSuppressed?.length ?? data.suppressedRemindersCount ?? 0;
      const issuedDate = data.issuedDate || data.receipt?.issuedDate || '2026-11-02';

      setGeneratedReceipt({
        receiptNumber: receiptNo,
        issuedDate,
        grossPaise: currentGrossPaise,
        mode: selectedMethod,
      });

      setSuppressedRemindersCount(remCount);
      setIsSuccess(true);
      success(
        lang === 'hi'
          ? `भुगतान सफल! रसीद ${receiptNo} जारी की गई।`
          : `Payment successful! Gapless Receipt ${receiptNo} generated.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing simulation';
      error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mobile-viewport-360 space-y-4 pb-12">
      {/* Back Button & Title */}
      <div className="flex items-center gap-2">
        <Link
          href="/parent/dashboard"
          className="touch-target p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
            {t('parentPay.checkoutTitle')}
          </h1>
          <p className="text-[11px] text-slate-500">
            {studentInfo.name} ({studentInfo.code}) • {studentInfo.course}
          </p>
        </div>
      </div>

      {!isSuccess ? (
        <div className="space-y-4">
          {/* AMOUNT SELECTION CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {t('parentPay.instalmentSelection')}
            </h2>

            {/* Radio 1: Full Balance */}
            <label
              onClick={() => handleSelectPayOption('FULL')}
              className={`touch-target flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                payOption === 'FULL'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="payOption"
                  checked={payOption === 'FULL'}
                  onChange={() => handleSelectPayOption('FULL')}
                  className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    {t('parentPay.fullAmountOption', { amount: `₹${fullBalanceRupees.toLocaleString('en-IN')}` })}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Instalment 3 Overdue Balance (23 days overdue)
                  </span>
                </div>
              </div>
              <span className="font-black text-sm text-slate-900 tabular-nums">
                ₹{fullBalanceRupees.toLocaleString('en-IN')}
              </span>
            </label>

            {/* Radio 2: Custom Partial Payment */}
            <label
              onClick={() => handleSelectPayOption('CUSTOM')}
              className={`touch-target flex flex-col p-3 rounded-xl border cursor-pointer transition-all gap-2 ${
                payOption === 'CUSTOM'
                  ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="payOption"
                  checked={payOption === 'CUSTOM'}
                  onChange={() => handleSelectPayOption('CUSTOM')}
                  className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-900">
                  {t('parentPay.partialAmountOption')}
                </span>
              </div>

              {payOption === 'CUSTOM' && (
                <div className="pt-1">
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      min={500}
                      max={fullBalanceRupees}
                      step={500}
                      value={customAmountStr}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="5000"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  {amountError && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{amountError}</span>
                    </p>
                  )}
                </div>
              )}
            </label>
          </div>

          {/* LIVE 18% GST REVERSE SPLIT BREAKDOWN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">
                {t('parentPay.gstBreakdownTitle')}
              </h2>
              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                SAC 999293
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">{t('parentPay.grossAmount')}:</span>
                <span className="font-bold tabular-nums text-slate-900">{formatPaise(currentGrossPaise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('parentPay.taxableValue')}:</span>
                <span className="font-mono tabular-nums text-slate-800">{formatPaise(gstSplit.taxablePaise)}</span>
              </div>
              <div className="flex justify-between text-indigo-900">
                <span>{t('parentPay.cgst')}:</span>
                <span className="font-mono tabular-nums font-semibold">{formatPaise(gstSplit.cgstPaise)}</span>
              </div>
              <div className="flex justify-between text-indigo-900">
                <span>{t('parentPay.sgst')}:</span>
                <span className="font-mono tabular-nums font-semibold">{formatPaise(gstSplit.sgstPaise)}</span>
              </div>
            </div>

            {/* Exact Paisa Invariant Callout */}
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[10px] text-emerald-950 font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                {formatPaise(gstSplit.taxablePaise)} + {formatPaise(gstSplit.cgstPaise)} + {formatPaise(gstSplit.sgstPaise)} = {formatPaise(currentGrossPaise)}
              </span>
            </div>
          </div>

          {/* PAYMENT METHOD SELECTOR */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {t('parentPay.paymentMethodTitle')}
            </h2>

            {/* Method Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedMethod('UPI')}
                className={`touch-target py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  selectedMethod === 'UPI' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI / QR</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('NETBANKING')}
                className={`touch-target py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  selectedMethod === 'NETBANKING' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Net Banking</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('CARD')}
                className={`touch-target py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  selectedMethod === 'CARD' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
            </div>

            {/* UPI View */}
            {selectedMethod === 'UPI' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                {/* Simulated SVG QR Code */}
                <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-300 shadow-xs flex flex-col items-center justify-center">
                  <QrCode className="w-28 h-28 text-slate-900" />
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {t('parentPay.scanQrNotice')}
                </p>
                <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono">
                  <span>{vpaId}</span>
                  <button
                    type="button"
                    onClick={handleCopyVpa}
                    className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                    title="Copy UPI ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* NetBanking View */}
            {selectedMethod === 'NETBANKING' && (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-600">Select Bank</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['HDFC', 'SBI', 'ICICI', 'Axis', 'PNB', 'Bank of Baroda'].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`touch-target p-2 rounded-lg border text-left font-semibold transition-all cursor-pointer ${
                        selectedBank === bank
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {bank} Bank
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card View */}
            {selectedMethod === 'CARD' && (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Card Number</label>
                  <input
                    type="text"
                    placeholder="4111 •••• •••• 1111"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiry</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">CVV</label>
                    <input
                      type="password"
                      maxLength={3}
                      placeholder="•••"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SIMULATION PAY NOW CTA */}
          <button
            type="button"
            disabled={isProcessing || paymentAmountRupees < 500 || !!amountError}
            onClick={handleSimulatePayment}
            className="touch-target w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('parentPay.processing')}</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>{t('parentPay.confirmAndPayBtn', { amount: `₹${paymentAmountRupees.toLocaleString('en-IN')}` })}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* SUCCESS VIEW WITH PRINTABLE RECEIPT CARD & REMINDER SUPPRESSION PROOF */
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-emerald-950">
              {t('parentPay.successTitle')}
            </h2>
            <p className="text-xs text-emerald-800 font-medium">
              {t('parentPay.receiptGenerated')}: <strong className="font-mono text-emerald-950">{generatedReceipt?.receiptNumber}</strong>
            </p>
          </div>

          {/* ATOMIC REMINDER SUPPRESSION NOTICE */}
          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Statutory Rule 8.1 Auto-Suppression Active</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              {t('parentPay.reminderSuppressedNotice')}
            </p>
            <p className="text-[10px] text-indigo-800 font-mono pt-1">
              Suppressed {suppressedRemindersCount} scheduled WhatsApp reminders linked to Instalment 3.
            </p>
          </div>

          {/* RECEIPT SUMMARY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Receipt No:</span>
              <span className="font-mono font-bold text-slate-900">{generatedReceipt?.receiptNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Payment Date:</span>
              <span className="font-mono text-slate-900">{generatedReceipt?.issuedDate}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Gross Paid Amount:</span>
              <span className="font-bold tabular-nums text-emerald-700">₹{paymentAmountRupees.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">SAC Code:</span>
              <span className="font-mono text-slate-900">999293 (Coaching Services)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Instrument:</span>
              <span className="font-semibold text-slate-900">{selectedMethod}</span>
            </div>
          </div>

          {/* ACTIONS: DOWNLOAD / PRINT & RETURN */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="touch-target w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('parentPay.downloadInvoiceBtn')}</span>
            </button>

            <Link
              href="/parent/dashboard"
              className="touch-target w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('parentPay.backToDashboardBtn')}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
