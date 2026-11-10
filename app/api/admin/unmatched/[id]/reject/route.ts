// app/api/admin/unmatched/[id]/reject/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT' || session.role === 'COUNSELLOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can reject unmatched payments', 403);
  }

  const { id } = await context.params;
  const paymentId = id;

  try {
    const body = await req.json().catch(() => ({}));
    const rejectionReason = body.rejectionReason || body.reason || 'Unidentified remitter';

    const repo = getRepository();
    const rejectedPayment = await repo.rejectUnmatchedPayment(
      paymentId,
      rejectionReason,
      session.sub
    );

    return jsonOk({
      success: true,
      message: 'Payment rejected and flagged for return to remitter. Zero ledger changes.',
      payment: {
        id: rejectedPayment.id,
        matchStatus: rejectedPayment.matchStatus,
        remarks: rejectedPayment.remarks,
      },
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return jsonError(err.code || 'REJECTION_FAILED', err.message, status);
  }
}
