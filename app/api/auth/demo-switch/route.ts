// app/api/auth/demo-switch/route.ts
import { getRepository } from '@/src/store/repository';
import { createSessionToken } from '@/src/lib/auth';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request) {
  try {
    // In production, require DEMO_MODE=true
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      return jsonError('DEMO_MODE_DISABLED', 'Demo persona switching is disabled in production', 403);
    }

    const body = await req.json();
    const persona = String(body.persona || 'PARENT_0587').toUpperCase();
    const repo = getRepository();

    let targetUserId = 'usr-par-0587';
    let redirectTo = '/parent/dashboard';

    switch (persona) {
      case 'DIRECTOR':
        targetUserId = 'usr-dir-01';
        redirectTo = '/admin/dashboard';
        break;
      case 'ACCOUNTS_EXEC':
        targetUserId = 'usr-acc-01';
        redirectTo = '/admin/dashboard';
        break;
      case 'COUNSELLOR':
        targetUserId = 'usr-cns-01';
        redirectTo = '/admin/students/STU-0587';
        break;
      case 'CASHIER':
        targetUserId = 'usr-acc-02';
        redirectTo = '/admin/students/STU-0587';
        break;
      case 'PARENT_0412':
        targetUserId = 'usr-par-0412';
        redirectTo = '/parent/dashboard';
        break;
      case 'PARENT_0219':
        targetUserId = 'usr-par-0219';
        redirectTo = '/parent/dashboard';
        break;
      case 'PARENT_0587':
      case 'PARENT':
      default:
        targetUserId = 'usr-par-0587';
        redirectTo = '/parent/dashboard';
        break;
    }

    const user = repo.getUserById(targetUserId);
    if (!user) {
      return jsonError('USER_NOT_FOUND', `Demo user for persona ${persona} not found`, 404);
    }

    const token = await createSessionToken(user);
    const cookieHeader = `shikshasetu_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;

    return jsonOk(
      {
        success: true,
        persona,
        redirectTo,
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          phone: user.phone,
        },
      },
      200,
      { 'Set-Cookie': cookieHeader }
    );
  } catch {
    return jsonError('BAD_REQUEST', 'Invalid request body', 400);
  }
}
