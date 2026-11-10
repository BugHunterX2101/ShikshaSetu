// app/api/admin/unmatched/[id]/resolve/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT' || session.role === 'COUNSELLOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can resolve unmatched payments', 403);
  }

  const { id } = await context.params;
  const paymentId = id;

  try {
    const body = await req.json().catch(() => ({}));
    const targetStudentId = body.targetStudentId || body.studentId;
    const targetInstalmentId = body.targetInstalmentId || body.instalmentId;

    if (!targetStudentId) {
      return jsonError('MISSING_TARGET_STUDENT', 'targetStudentId is required to resolve payment', 400);
    }

    const repo = getRepository();
    const result = await repo.resolveUnmatchedPayment(
      paymentId,
      targetStudentId,
      targetInstalmentId,
      session.sub
    );

    return jsonOk({
      success: true,
      message: 'Payment resolved and credited to student ledger',
      receiptNumber: result.receiptNumber,
      result,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return jsonError(err.code || 'RESOLUTION_FAILED', err.message, status);
  }
}
