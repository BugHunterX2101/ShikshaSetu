// app/api/admin/refunds/[id]/approve/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const { id } = await context.params;
  const repo = getRepository();

  const refund = repo.getRefundRequestById(id);
  if (!refund) {
    return jsonError('NOT_FOUND', `Refund request ${id} not found`, 404);
  }

  // MANDATORY STATUTORY & AUDIT CHECK: Segregation of Duties
  if (refund.raisedBy === session.sub) {
    return jsonError(
      'REFUND_SELF_APPROVAL_FORBIDDEN',
      'Segregation of Duties: Approver cannot be the raiser of the refund',
      403,
      { messageHi: 'कर्तव्यों का पृथक्करण: अनुमोदक धनवापसी का प्रस्तावक नहीं हो सकता' }
    );
  }

  if (session.role !== 'DIRECTOR') {
    return jsonError(
      'FORBIDDEN_ROLE',
      'Only a user with DIRECTOR role can approve refunds',
      403,
      { messageHi: 'केवल निदेशक ही धनवापसी स्वीकृत कर सकते हैं' }
    );
  }

  try {
    const approvedRefund = await repo.approveRefund(refund.id, session.sub);
    return jsonOk({
      success: true,
      message: 'Refund approved by Director. Unpaid instalments cancelled and reminders suppressed.',
      refund: {
        id: approvedRefund.id,
        status: approvedRefund.status,
        approvedBy: approvedRefund.approvedBy,
        refundablePaise: approvedRefund.refundablePaise.toString(),
      },
    });
  } catch (err: any) {
    if (err.statusCode) {
      return jsonError(err.code || 'APPROVAL_FAILED', err.message, err.statusCode);
    }
    return jsonError('SERVER_ERROR', err.message || 'Approval failed', 500);
  }
}
