'use client';

import React, { useState } from 'react';
import { useToast } from '@/src/context/ToastContext';
import { Download, X, FileCode, FileSpreadsheet, ShieldCheck, Calendar } from 'lucide-react';

interface TallyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TallyExportModal({ isOpen, onClose }: TallyExportModalProps) {
  const { success, error } = useToast();
  const [format, setFormat] = useState<'xml' | 'csv'>('xml');
  const [fromDate, setFromDate] = useState<string>('2026-04-01');
  const [toDate, setToDate] = useState<string>('2026-11-02');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = `/api/export/tally?format=${format}&fromDate=${fromDate}&toDate=${toDate}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to generate export file');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `tally_vouchers_${fromDate}_${toDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      success(`Tally ${format.toUpperCase()} export downloaded successfully`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error exporting Tally vouchers';
      error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Export to Tally Prime</h2>
              <p className="text-[11px] text-slate-400 font-mono">Zero-Sum Double Entry Vouchers</p>
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

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          {/* Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('xml')}
                className={`touch-target p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  format === 'xml'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileCode className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">Tally XML</span>
                  <span className="text-[10px] text-slate-500">Deterministic GUIDs & balanced vouchers</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`touch-target p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  format === 'csv'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 block">CSV File</span>
                  <span className="text-[10px] text-slate-500">Formula injection sanitized</span>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Voucher Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-500 mb-1 block">From Date</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 mb-1 block">To Date</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Statutory Double-Entry Invariant Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Accounting Balance Invariant</span>
            </div>
            <p className="text-slate-600 font-mono text-[10px]">
              -Bank Debit (Gross) + Taxable Fees + Output CGST + Output SGST = 0.00
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="touch-target px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={isExporting}
            onClick={handleExport}
            className="touch-target px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Export {format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
