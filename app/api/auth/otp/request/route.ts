// app/api/auth/otp/request/route.ts
import { requestOtp } from '@/src/lib/auth';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone || '').trim();

    if (!/^\d{10}$/.test(phone)) {
      return jsonError('INVALID_PHONE', 'Please provide a valid 10-digit Indian mobile number', 400);
    }

    const result = requestOtp(phone);
    if (!result.success) {
      return jsonError('RATE_LIMITED', result.error || 'Too many OTP requests', result.status || 429);
    }

    return jsonOk({
      success: true,
      message: 'OTP sent successfully',
      phone,
      demoOtp: result.demoOtp,
    });
  } catch {
    return jsonError('BAD_REQUEST', 'Invalid request body', 400);
  }
}
