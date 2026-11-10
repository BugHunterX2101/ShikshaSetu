/**
 * Razorpay Webhook HMAC-SHA256 Signature Verification Engine
 * File: src/domain/webhookSignature.ts
 *
 * Implements statutory and gateway-level cryptographic authentication
 * to prevent forged payment callbacks and replay attacks.
 */

import crypto from 'crypto';

export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_test_webhook_secret_key_2026';

/** Strict regex enforcing exactly 64 hexadecimal characters (256-bit SHA-256 digest) */
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Verifies Razorpay webhook HMAC-SHA256 signature against the raw payload string.
 *
 * @param body Raw request body string
 * @param signature Hex signature string from x-razorpay-signature header
 * @param secret Webhook secret configured in Razorpay dashboard / env
 * @returns boolean indicating if signature is genuine and verified
 */
export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!body || !signature || !secret || typeof signature !== 'string') {
    return false;
  }

  const trimmed = signature.trim();
  if (!HEX_64_REGEX.test(trimmed)) {
    return false;
  }

  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const signatureBuffer = Buffer.from(trimmed, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Utility helper to generate genuine Razorpay webhook signatures (used in tests and gateway simulation).
 */
export function computeWebhookSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}
