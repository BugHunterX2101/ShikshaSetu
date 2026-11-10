// app/api/parent/dues/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const { searchParams } = new URL(req.url);
  const requestedStudent = searchParams.get('studentId') || searchParams.get('studentCode');
  const asOfDate = searchParams.get('asOfDate') || undefined;

  const repo = getRepository();

  let targetStudentId = requestedStudent;

  if (session.role === 'PARENT') {
    const linkedGuardians = repo.getGuardiansByUserId(session.sub);
    if (linkedGuardians.length === 0) {
      return jsonError('NO_LINKED_STUDENT', 'No students linked to this parent account', 404);
    }

    if (targetStudentId) {
      const student = repo.getStudentById(targetStudentId);
      const isLinked = linkedGuardians.some((g) => g.studentId === student?.id);
      if (!isLinked) {
        return jsonError('ACCESS_DENIED', 'You do not have permission to view dues for this student', 403);
      }
      targetStudentId = student!.id;
    } else {
      targetStudentId = linkedGuardians[0].studentId;
    }
  } else if (!targetStudentId) {
    targetStudentId = 'stu-0587'; // Default for staff preview
  }

  const student = repo.getStudentById(targetStudentId);
  if (!student) {
    return jsonError('STUDENT_NOT_FOUND', 'Student record not found', 404);
  }

  // DPDP Consent Check
  const consents = repo.getConsentsByStudentId(student.id);
  const coreConsent = consents.find((c) => c.purposeCode === 'CORE_EDUCATION_FEES' && !c.withdrawnAt);
  const consentRequired = !coreConsent;

  if (consentRequired) {
    return jsonOk({
      success: true,
      consentRequired: true,
      message: 'Parental consent under DPDP Act 2023 is required before accessing student records.',
      student: null,
      dues: null,
      ledger: [],
      instalments: [],
      receipts: [],
    });
  }

  const dues = repo.getDuesSummary(student.id, asOfDate);
  if (!dues) {
    return jsonError('STUDENT_NOT_FOUND', 'Student record not found', 404);
  }

  return jsonOk({
    success: true,
    consentRequired: false,
    dues,
  });
}
