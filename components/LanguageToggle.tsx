'use client';

import React from 'react';
import { useLanguage } from '@/src/i18n';
import { Languages } from 'lucide-react';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLang}
      className={`touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold tracking-wide transition-all select-none shadow-xs cursor-pointer ${
        lang === 'hi'
          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
          : 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
      } ${className}`}
      aria-label="Toggle Language (English / हिन्दी)"
      title="Switch Language / भाषा बदलें"
    >
      <Languages className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
      <span className="flex items-center gap-1">
        <span className={lang === 'en' ? 'font-bold underline underline-offset-2' : 'opacity-60'}>EN</span>
        <span className="text-slate-400">|</span>
        <span className={lang === 'hi' ? 'font-bold underline underline-offset-2' : 'opacity-60'}>हिन्दी</span>
      </span>
    </button>
  );
}
