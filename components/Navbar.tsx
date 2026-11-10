'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/i18n';
import { LanguageToggle } from './LanguageToggle';
import {
  GraduationCap,
  Building2,
  LayoutDashboard,
  Users,
  BellRing,
  RotateCcw,
  Menu,
  X,
  LogOut,
  CreditCard,
  BookOpenCheck,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, role, selectedCentreId, setSelectedCentreId, logout } = useAuth();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const centres = [
    { id: 'ALL', label: t('centres.all') },
    { id: 'ctr-jpr-gpl', label: t('centres.gpl') },
    { id: 'ctr-jpr-vsh', label: t('centres.vsh') },
    { id: 'ctr-jpr-mns', label: t('centres.mns') },
    { id: 'ctr-jpr-skr', label: t('centres.skr') },
  ];

  const isParent = role === 'PARENT';

  const navLinks = isParent
    ? [
        { href: '/parent/dashboard', label: t('navbar.duesAndLedger'), icon: LayoutDashboard },
        { href: '/parent/pay/stu-0587', label: t('navbar.payFees'), icon: CreditCard },
      ]
    : [
        { href: '/admin/dashboard', label: t('navbar.adminDashboard'), icon: LayoutDashboard },
        { href: '/admin/students/STU-0587', label: t('navbar.studentLedger'), icon: Users },
        { href: '/admin/reminders', label: t('navbar.remindersOutbox'), icon: BellRing },
        { href: '/admin/refunds', label: t('navbar.refundsAndRisk'), icon: RotateCcw },
      ];

  return (
    <header className="sticky top-[41px] z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          
          {/* Brand Logo & Title */}
          <Link href={isParent ? '/parent/dashboard' : '/admin/dashboard'} className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-700 to-blue-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  {t('common.appName')}
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Jaipur
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-none hidden md:block">
                {t('common.appTagline')}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links & Centre Selector */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 flex-1 justify-center">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/parent/dashboard' && link.href !== '/admin/dashboard' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Centre Selector for Staff */}
            {!isParent && (
              <div className="relative ml-2">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={selectedCentreId}
                    onChange={(e) => setSelectedCentreId(e.target.value)}
                    className="bg-transparent font-medium focus:outline-none cursor-pointer text-xs"
                    aria-label="Filter Centre"
                  >
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Student Context for Parent */}
            {isParent && (
              <div className="hidden lg:flex items-center gap-1 bg-indigo-50/60 border border-indigo-200 rounded-md px-2.5 py-1 text-xs text-indigo-900">
                <BookOpenCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold">Rahul Sharma (STU-0587)</span>
                <span className="text-indigo-500">• JEE 2027</span>
              </div>
            )}
          </nav>

          {/* Right Header Actions: Language Toggle & User Menu */}
          <div className="flex items-center gap-2">
            <LanguageToggle />

            {/* User Profile Badge */}
            {user ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-xs text-slate-700 select-none">
                  {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="hidden xl:block text-left leading-tight">
                  <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{user.name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{user.role.toLowerCase()}</p>
                </div>
                <button
                  onClick={logout}
                  className="touch-target p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                  title={t('navbar.logout')}
                  aria-label="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden touch-target p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
              aria-label="Toggle Mobile Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Optimized for 360px Viewport) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
          {/* Active Student/Centre Info on Mobile */}
          {isParent ? (
            <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-200 text-xs">
              <p className="font-semibold text-indigo-950">Rahul Sharma (STU-0587)</p>
              <p className="text-indigo-700 text-[11px]">Gopalpura Bypass • JEE 2027 Evening</p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Active Centre Filter</label>
              <select
                value={selectedCentreId}
                onChange={(e) => {
                  setSelectedCentreId(e.target.value);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-xs text-slate-800"
              >
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mobile Nav Links */}
          <div className="space-y-1 pt-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Signout in Mobile Menu */}
          {user && (
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">{user.name}</p>
                <p className="text-[11px] text-slate-500 capitalize">{user.role}</p>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-md cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('navbar.logout')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
