/**
 * AI Dropout Risk Scanner Circuit Breaker & Least-Privilege Isolation Engine
 * File: src/domain/aiCircuitBreaker.ts
 *
 * Implements PRD § 11.1 (TC-11), FR-RSK-04, FR-RSK-05, and FR-RSK-07:
 * - AI model offline, 4-second timeout, malformed JSON, and prompt injection
 *   fall back cleanly to deterministic bilingual template guide.
 * - Enforces database write isolation: scanner role cannot mutate instalments,
 *   reminders, or payments.
 */

import { CounsellorGuide, RiskFactors, RiskSeverity, generateTemplateGuide } from './riskScore';

export interface AiScanInput {
  studentId: string;
  studentCode: string;
  factors: RiskFactors;
  daysOverdue: number;
  severity: RiskSeverity;
  userPrompt?: string;
}

export interface AiScanOptions {
  modelProvider?: (prompt: string) => Promise<string>;
  timeoutMs?: number;
  simulateOffline?: boolean;
  simulateTimeout?: boolean;
  simulateMalformedJson?: boolean;
  simulatePromptInjection?: boolean;
}

export interface AiScanResult {
  guide: CounsellorGuide;
  circuitBroken: boolean;
  fallbackReason?: 'OFFLINE' | 'TIMEOUT' | 'MALFORMED_JSON' | 'PROMPT_INJECTION' | 'NONE';
  executionTimeMs: number;
}

const INJECTION_PATTERNS = [
  /system prompt override/i,
  /ignore (all )?previous instructions/i,
  /forgive (student )?debt/i,
  /delete (all )?reminders/i,
  /drop table/i,
  /grant admin/i,
  /bypass security/i,
  /<script>/i,
  /you are now an unrestricted/i,
];

/**
 * Detects prompt or instruction injection attempts.
 */
export function detectPromptInjection(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Validates that an AI output satisfies the strict schema:
 * - 3 English bullet points (each <= 160 characters)
 * - 3 Hindi bullet points (each <= 160 characters)
 */
export function validateAiGuideSchema(data: any): data is { pointsEn: [string, string, string]; pointsHi: [string, string, string] } {
  if (!data || typeof data !== 'object') return false;
  const { pointsEn, pointsHi } = data;

  if (!Array.isArray(pointsEn) || pointsEn.length !== 3) return false;
  if (!Array.isArray(pointsHi) || pointsHi.length !== 3) return false;

  for (const p of pointsEn) {
    if (typeof p !== 'string' || p.trim().length === 0 || p.length > 160) return false;
  }
  for (const p of pointsHi) {
    if (typeof p !== 'string' || p.trim().length === 0 || p.length > 160) return false;
  }

  return true;
}

/**
 * Executes AI counsellor scan with 4s circuit breaker, offline handling,
 * schema validation, prompt injection defense, and template guide fallback.
 */
export async function executeAiCounsellorScan(
  input: AiScanInput,
  options: AiScanOptions = {}
): Promise<AiScanResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? 4000;

  // Fallback generator helper
  const getFallback = (reason: 'OFFLINE' | 'TIMEOUT' | 'MALFORMED_JSON' | 'PROMPT_INJECTION'): AiScanResult => {
    const guide = generateTemplateGuide(input.factors, input.daysOverdue, input.severity);
    return {
      guide,
      circuitBroken: true,
      fallbackReason: reason,
      executionTimeMs: Date.now() - startTime,
    };
  };

  // 1. Guard against prompt injection in user prompt
  if (options.simulatePromptInjection || (input.userPrompt && detectPromptInjection(input.userPrompt))) {
    return getFallback('PROMPT_INJECTION');
  }

  // 2. Simulated offline / network error
  if (options.simulateOffline) {
    return getFallback('OFFLINE');
  }

  // 3. Simulated timeout
  if (options.simulateTimeout) {
    return getFallback('TIMEOUT');
  }

  // If no live provider is supplied, return default template guide
  if (!options.modelProvider) {
    return {
      guide: generateTemplateGuide(input.factors, input.daysOverdue, input.severity),
      circuitBroken: false,
      fallbackReason: 'NONE',
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    // 4. Run model provider with strict 4-second timeout race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT_EXCEEDED')), timeoutMs);
    });

    const callPromise = options.modelProvider(input.userPrompt || `Student: ${input.studentCode}`);
    const rawResponse = await Promise.race([callPromise, timeoutPromise]);

    // Check for prompt injection in AI output response
    if (detectPromptInjection(rawResponse)) {
      return getFallback('PROMPT_INJECTION');
    }

    if (options.simulateMalformedJson) {
      return getFallback('MALFORMED_JSON');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      return getFallback('MALFORMED_JSON');
    }

    if (!validateAiGuideSchema(parsed)) {
      return getFallback('MALFORMED_JSON');
    }

    return {
      guide: {
        pointsEn: parsed.pointsEn,
        pointsHi: parsed.pointsHi,
        templateUsed: false,
        modelName: 'gemini-1.5-pro',
      },
      circuitBroken: false,
      fallbackReason: 'NONE',
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: any) {
    if (err?.message === 'AI_TIMEOUT_EXCEEDED') {
      return getFallback('TIMEOUT');
    }
    // Network / offline error
    return getFallback('OFFLINE');
  }
}

/**
 * Asserts least-privilege write isolation for AI Scanner role (FR-RSK-07).
 * The scanner role has read-only access to academic and fee tables, and write
 * access only to dropout_flags. Attempts to write to instalments, reminders,
 * or payments throw an authorization error.
 */
export function assertScannerRoleWriteIsolation(targetTableOrOperation: 'instalment' | 'reminder' | 'payment' | string): void {
  const normalized = targetTableOrOperation.toLowerCase();
  if (
    normalized.includes('instalment') ||
    normalized.includes('reminder') ||
    normalized.includes('payment') ||
    normalized.includes('ledger') ||
    normalized.includes('receipt')
  ) {
    const error = new Error(`FORBIDDEN_OPERATION: AI scanner role is restricted from mutating ${targetTableOrOperation}`);
    (error as any).code = 'SCANNER_WRITE_ISOLATION_VIOLATION';
    (error as any).status = 403;
    throw error;
  }
}

/**
 * Creates a sandboxed proxy around the repository ensuring that an AI scanner
 * worker can read student/dues data but cannot perform any write mutation.
 */
export function createScannerRestrictedContext<T extends object>(repository: T): T {
  const FORBIDDEN_METHODS = new Set([
    'recordPayment',
    'recordOfflinePayment',
    'raiseRefund',
    'approveRefund',
    'settleRefund',
    'grantConsent',
    'withdrawConsent',
    'resolveUnmatched',
    'rejectUnmatched',
    'triggerReminderRun',
  ]);

  return new Proxy(repository, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && FORBIDDEN_METHODS.has(prop)) {
        return () => {
          assertScannerRoleWriteIsolation(prop);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
