// app/api/admin/unmatched/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT' || session.role === 'COUNSELLOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can view unmatched queue', 403);
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = (searchParams.get('status') as any) || 'UNMATCHED_QUEUE';
  const reasonCodeFilter = searchParams.get('reasonCode');

  const repo = getRepository();
  let items = repo.getUnmatchedPayments(statusFilter);

  if (reasonCodeFilter) {
    items = items.filter((p) => p.reasonCode === reasonCodeFilter);
  }

  const totalPaise = items.reduce((acc, p) => acc + p.amountPaise, 0n);

  const byReason = {
    NO_REFERENCE: items.filter((p) => p.reasonCode === 'NO_REFERENCE').length,
    UNKNOWN_STUDENT: items.filter((p) => p.reasonCode === 'UNKNOWN_STUDENT').length,
    CANCELLED_INSTALMENT: items.filter((p) => p.reasonCode === 'CANCELLED_INSTALMENT').length,
    NO_OPEN_DUES: items.filter((p) => p.reasonCode === 'NO_OPEN_DUES').length,
  };

  return jsonOk({
    success: true,
    totalCount: items.length,
    summary: {
      totalQueuePaise: totalPaise.toString(),
      totalQueueFormatted: `₹${(Number(totalPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      byReason,
    },
    items: items.map((p) => ({
      id: p.id,
      amountPaise: p.amountPaise.toString(),
      amountFormatted: `₹${(Number(p.amountPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      mode: p.mode,
      bankReference: p.bankReference,
      payerName: p.payerName,
      payerPhone: p.payerPhone,
      receivedOn: p.receivedOn,
      receivedAt: p.receivedAt,
      matchStatus: p.matchStatus,
      reasonCode: p.reasonCode,
      unallocatedPaise: p.unallocatedPaise.toString(),
      remarks: p.remarks,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT' || session.role === 'COUNSELLOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can resolve or reject unmatched payments', 403);
  }

  try {
    const body = await req.json();
    const action = body.action;
    const paymentId = body.paymentId;

    if (!paymentId) {
      if (body.amountPaise) {
        const repo = getRepository();
        const amountPaise = BigInt(String(body.amountPaise));
        const mode = body.mode || 'BANK_TRANSFER';
        const bankReference = body.bankReference || `NEFT-${Date.now()}`;
        const payerName = body.payerName || 'Direct Remitter';
        const result = await repo.recordPayment({
          amountPaise,
          mode,
          gatewayPaymentId: bankReference,
          bankReference,
          payerName,
          payerPhone: body.payerPhone,
          remarks: body.remarks || body.notes || 'Unreferenced payment incoming',
        });
        return jsonOk({
          success: true,
          message: 'Payment routed to unmatched holding queue',
          item: { id: result.paymentId },
          result,
        }, 201);
      }
      return jsonError('MISSING_PAYMENT_ID', 'paymentId is required', 400);
    }

    const repo = getRepository();

    if (action === 'resolve') {
      const targetStudentId = body.targetStudentId;
      const targetInstalmentId = body.targetInstalmentId;

      if (!targetStudentId) {
        return jsonError('MISSING_TARGET_STUDENT', 'targetStudentId is required to resolve payment', 400);
      }

      const result = await repo.resolveUnmatchedPayment(
        paymentId,
        targetStudentId,
        targetInstalmentId,
        session.sub
      );

      return jsonOk({
        success: true,
        message: 'Payment resolved and credited to student ledger',
        result,
      });
    }

    if (action === 'reject') {
      const reason = body.reason || 'Rejected by accounts executive';
      const rejectedPayment = await repo.rejectUnmatchedPayment(paymentId, reason, session.sub);

      return jsonOk({
        success: true,
        message: 'Payment rejected and flagged for return to remitter',
        payment: {
          id: rejectedPayment.id,
          matchStatus: rejectedPayment.matchStatus,
          remarks: rejectedPayment.remarks,
        },
      });
    }

    return jsonError('INVALID_ACTION', 'action must be "resolve" or "reject"', 400);
  } catch (err: any) {
    if (err.statusCode) {
      return jsonError(err.code || 'ACTION_FAILED', err.message, err.statusCode);
    }
    return jsonError('SERVER_ERROR', err.message || 'Operation failed', 500);
  }
}
