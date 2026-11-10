// app/api/consent/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return jsonError('MISSING_STUDENT_ID', 'studentId is required', 400);
  }

  const repo = getRepository();
  const student = repo.getStudentById(studentId);
  if (!student) {
    return jsonError('STUDENT_NOT_FOUND', 'Student not found', 404);
  }

  // If parent, ensure linked
  if (session.role === 'PARENT') {
    const guardians = repo.getGuardiansByUserId(session.sub);
    const isLinked = guardians.some((g) => g.studentId === student.id);
    if (!isLinked) {
      return jsonError('ACCESS_DENIED', 'Parent cannot view consent for unlinked student', 403);
    }
  }

  const consents = repo.getConsentsByStudentId(student.id);

  return jsonOk({
    success: true,
    studentId: student.id,
    consents: consents.map((c) => ({
      id: c.id,
      purposeCode: c.purposeCode,
      noticeVersion: c.noticeVersion,
      languageShown: c.languageShown,
      grantedAt: c.grantedAt,
      withdrawnAt: c.withdrawnAt,
      isActive: !c.withdrawnAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  try {
    const body = await req.json();
    const studentId = body.studentId;
    const purpose = body.purposeCode || 'WHATSAPP_REMINDERS';
    const lang = body.language || 'en';
    const guardianDobYear = body.guardianDobYear ? Number(body.guardianDobYear) : undefined;
    const guardianIdLast4 = body.guardianIdLast4;

    if (!studentId) {
      return jsonError('MISSING_STUDENT_ID', 'studentId is required', 400);
    }

    const repo = getRepository();
    const student = repo.getStudentById(studentId);
    if (!student) {
      return jsonError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const consent = await repo.grantConsent(
      student.id,
      session.sub,
      purpose,
      lang,
      guardianDobYear,
      guardianIdLast4
    );

    return jsonOk({
      success: true,
      message: 'DPDP consent recorded successfully',
      consent: {
        id: consent.id,
        purposeCode: consent.purposeCode,
        grantedAt: consent.grantedAt,
        isActive: !consent.withdrawnAt,
      },
    });
  } catch (err: any) {
    if (err.statusCode) {
      return jsonError(err.code || 'CONSENT_FAILED', err.message, err.statusCode);
    }
    return jsonError('SERVER_ERROR', err.message || 'Failed to record consent', 500);
  }
}
