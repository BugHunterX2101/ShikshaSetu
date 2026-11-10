/**
 * Demo Mode & Production Build Integrity Guard
 * File: src/lib/demoMode.ts
 *
 * Implements PRD § 11.1 (TC-23) and FR-AUTH-06:
 * - In production builds or when NEXT_PUBLIC_DEMO_MODE === 'false',
 *   demo elements (ReviewerDemoBar, on-screen OTP hints, and demo clock switch)
 *   are strictly disabled.
 */

export function isDemoMode(): boolean {
  // Explicit override via environment variables
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'false' || process.env.DEMO_MODE === 'false') {
    return false;
  }

  // In production builds, default to false unless explicitly enabled via NEXT_PUBLIC_DEMO_MODE === 'true'
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  }

  // Otherwise in development/test/preview mode, default to true
  return true;
}
