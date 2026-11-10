// app/api/auth/otp/verify/route.ts
import { verifyOtp, createSessionToken } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const code = String(body.code || '').trim();

    if (!phone || !code) {
      return jsonError('MISSING_FIELDS', 'Phone and 6-digit OTP code are required', 400);
    }

    const verification = verifyOtp(phone, code);
    if (!verification.verified) {
      return jsonError('OTP_VERIFICATION_FAILED', verification.error || 'Invalid or expired OTP', verification.status || 400);
    }

    const repo = getRepository();
    let user = repo.getUserByPhone(phone);
    if (!user) {
      // Default to parent user if not pre-registered
      user = {
        id: `usr_${Date.now()}`,
        phone,
        email: `${phone}@shikshasetu.in`,
        name: `Parent ${phone.slice(-4)}`,
        role: 'PARENT',
        preferredLang: 'hi',
        isActive: true,
        phoneVerifiedAt: new Date().toISOString(),
      };
    }

    const token = await createSessionToken(user);
    const cookieHeader = `shikshasetu_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${user.role === 'PARENT' ? 14 * 86400 : 8 * 3600}`;

    return jsonOk(
      {
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          preferredLang: user.preferredLang,
        },
      },
      200,
      { 'Set-Cookie': cookieHeader }
    );
  } catch {
    return jsonError('BAD_REQUEST', 'Invalid request body', 400);
  }
}
