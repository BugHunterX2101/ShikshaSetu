import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/src/i18n';
import { ToastProvider } from '@/src/context/ToastContext';
import { AuthProvider } from '@/src/context/AuthContext';
import { ReviewerDemoBar } from '@/components/ReviewerDemoBar';
import { Navbar } from '@/components/Navbar';
import { ToastContainer } from '@/components/Toast';
import { ShieldCheck, Scale, PhoneCall } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ShikshaSetu — Fee Tracking System & Parent Portal',
  description:
    'Transparent coaching fee tracking, 5-second dues view, statutory 18% GST reverse split, Section 269ST cash enforcement, and pro-rata MoE refund governance for Jaipur coaching institutes.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              {/* Sticky Top Reviewer Demo Bar for 1-Click Persona Switching */}
              <ReviewerDemoBar />

              {/* Main Responsive Header Navigation */}
              <Navbar />

              {/* Main Content Viewport */}
              <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                {children}
              </main>

              {/* Statutory Compliance & Regulatory Footer */}
              <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-6 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                      <p className="font-bold text-slate-200 text-sm">
                        ShikshaSetu (शिक्षा सेतु) — Company A Coaching Institute
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Rajasthan Coaching Act Registration: <span className="font-mono text-slate-300">RJ-COACH-2025-0412</span> • GSTIN: <span className="font-mono text-slate-300">08AAAAA0000A1Z5</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded text-emerald-400">
                        <Scale className="w-3 h-3" />
                        <span>MoE 2024 Pro-Rata Compliant</span>
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded text-blue-400">
                        <ShieldCheck className="w-3 h-3" />
                        <span>DPDP Act 2023 Rule 10 Verified</span>
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
                    <p>© 2026 ShikshaSetu. 4 Centres in Jaipur: Gopalpura Bypass, Vaishali Nagar, Mansarovar, Sikar Road.</p>
                    <p className="flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-slate-400" />
                      <span>Helpline: +91 141 2780000 (09:00 - 18:00 IST)</span>
                    </p>
                  </div>
                </div>
              </footer>

              {/* Floating Toast Container */}
              <ToastContainer />
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
