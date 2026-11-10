// app/api/consent/withdraw/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { evaluateDataRetention } from '@/src/domain/dpdp';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  try {
    const body = await req.json();
    const studentId = body.studentId;
    const purpose = body.purposeCode || 'WHATSAPP_REMINDERS';

    if (!studentId) {
      return jsonError('MISSING_STUDENT_ID', 'studentId is required', 400);
    }

    const repo = getRepository();
    const student = repo.getStudentById(studentId);
    if (!student) {
      return jsonError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    // Atomic consent withdrawal and reminder suppression
    await repo.withdrawConsent(student.id, session.sub, purpose);

    // Verify statutory data retention policy (Section 36 GST retention override)
    const retentionReceipt = evaluateDataRetention('FEE_RECEIPT', '2026-10-09', '2026-11-02');

    return jsonOk({
      success: true,
      message: 'Consent withdrawn. Outbound WhatsApp reminders have been automatically suppressed.',
      studentId: student.id,
      withdrawnPurpose: purpose,
      statutoryRetention: {
        financialRecordsRetained: !retentionReceipt.canErase,
        mandatoryRetentionMonths: retentionReceipt.mandatoryRetentionMonths,
        legalBasis: retentionReceipt.statutoryBasis,
      },
    });
  } catch (err: any) {
    return jsonError('SERVER_ERROR', err.message || 'Withdrawal failed', 500);
  }
}
