// app/api/admin/refunds/[id]/settle/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role !== 'ACCOUNTS_EXEC' && session.role !== 'DIRECTOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can settle refunds', 403);
  }

  const { id } = await context.params;
  const repo = getRepository();

  const refund = repo.getRefundRequestById(id);
  if (!refund) {
    return jsonError('NOT_FOUND', `Refund request ${id} not found`, 404);
  }

  if (refund.status !== 'APPROVED') {
    return jsonError('INVALID_STATE', 'Only APPROVED refund requests can be settled', 422);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const settlementMode = body.settlementMode || 'BANK_TRANSFER';
    const bankReference = body.bankReference || body.payoutReference || `NEFT-REF-${Date.now()}`;

    const { refund: settledRefund, creditNote } = await repo.settleRefund(refund.id, {
      refundId: refund.id,
      settlementMode,
      bankReference,
      actorUserId: session.sub,
    });

    return jsonOk({
      success: true,
      message: 'Refund settled and Credit Note generated',
      status: settledRefund.status,
      creditNoteNumber: creditNote.number,
      refund: {
        id: settledRefund.id,
        status: settledRefund.status,
        settledOn: settledRefund.settledOn,
        settlementMode: settledRefund.settlementMode,
        bankReference: settledRefund.bankReference,
      },
      creditNote: {
        id: creditNote.id,
        number: creditNote.number,
        grossPaise: creditNote.grossPaise.toString(),
        taxablePaise: creditNote.taxablePaise.toString(),
        cgstPaise: creditNote.cgstPaise.toString(),
        sgstPaise: creditNote.sgstPaise.toString(),
      },
    });
  } catch (err: any) {
    return jsonError('SERVER_ERROR', err.message || 'Settlement failed', 500);
  }
}
