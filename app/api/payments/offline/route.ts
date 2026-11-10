// app/api/payments/offline/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError, jsonProblem } from '@/src/lib/apiResponse';

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  // Only ACCOUNTS_EXEC or DIRECTOR can record counter payments
  if (session.role !== 'ACCOUNTS_EXEC' && session.role !== 'DIRECTOR') {
    return jsonError(
      'FORBIDDEN_ROLE',
      'Only accounts executive or director can record offline counter payments',
      403,
      { messageHi: 'केवल लेखा कार्यकारी या निदेशक ही ऑफ़लाइन काउंटर भुगतान दर्ज कर सकते हैं' }
    );
  }

  try {
    const body = await req.json();
    const { studentId, instalmentId, mode, reference, payerName, payerPhone, paymentDate, remarks } = body;
    const effectiveReference = reference || (mode === 'CASH' ? `CASH-CTR-${Date.now()}` : '');
    const amountStr = body.amountPaise !== undefined && body.amountPaise !== null ? String(body.amountPaise) : '';

    if (!studentId || !amountStr || !mode || !effectiveReference) {
      return jsonError('MISSING_FIELDS', 'studentId, amountPaise, mode, and reference are required', 400);
    }

    if (!/^\d+$/.test(amountStr)) {
      return jsonError('INVALID_AMOUNT', 'amountPaise must be a valid positive integer string in paise', 400);
    }

    const amountPaise = BigInt(amountStr);
    if (amountPaise <= 0n) {
      return jsonError('INVALID_AMOUNT', 'amountPaise must be strictly greater than zero', 422);
    }

    const repo = getRepository();

    const result = await repo.recordOfflinePayment({
      studentId,
      instalmentId,
      amountPaise,
      mode,
      reference: effectiveReference,
      payerName: payerName || 'Payer',
      payerPhone,
      paymentDate,
      remarks,
      actorUserId: session.sub,
    });

    return jsonOk(result, 201);
  } catch (err: any) {
    if (err.problem) {
      return jsonProblem(err.problem);
    }
    if (err.statusCode) {
      return jsonError(err.code || 'PAYMENT_FAILED', err.message, err.statusCode);
    }
    return jsonError('SERVER_ERROR', err.message || 'Offline payment failed', 500);
  }
}
