// app/api/payments/checkout/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { calculateGstReverseSplit } from '@/src/domain/gst';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const instalmentId = searchParams.get('instalmentId');
  const rawAmount = searchParams.get('amountPaise');

  if (!studentId) {
    return jsonError('MISSING_STUDENT_ID', 'studentId is required', 400);
  }

  const repo = getRepository();
  const student = repo.getStudentById(studentId);
  if (!student) {
    return jsonError('STUDENT_NOT_FOUND', 'Student record not found', 404);
  }

  const dues = repo.getDuesSummary(student.id);
  const centre = repo.getCentreById(student.centreId);

  let targetInstalment = instalmentId ? dues?.instalments.find((i) => i.id === instalmentId) : dues?.instalments.find((i) => BigInt(i.balancePaise) > 0n);

  const amountPaise = rawAmount ? BigInt(rawAmount) : targetInstalment ? BigInt(targetInstalment.balancePaise) : 0n;
  const gstSplit = calculateGstReverseSplit(amountPaise);

  return jsonOk({
    success: true,
    studentId: student.id,
    studentCode: student.studentCode,
    studentName: student.fullName,
    centreCode: centre?.code || 'JPR-GPL',
    instalment: targetInstalment || null,
    previewGstSplit: {
      grossPaise: gstSplit.grossPaise.toString(),
      grossFormatted: `₹${(Number(gstSplit.grossPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      taxablePaise: gstSplit.taxablePaise.toString(),
      taxableFormatted: `₹${(Number(gstSplit.taxablePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      cgstPaise: gstSplit.cgstPaise.toString(),
      cgstFormatted: `₹${(Number(gstSplit.cgstPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sgstPaise: gstSplit.sgstPaise.toString(),
      sgstFormatted: `₹${(Number(gstSplit.sgstPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      igstPaise: '0',
      totalTaxPaise: gstSplit.totalTaxPaise.toString(),
      totalTaxFormatted: `₹${(Number(gstSplit.totalTaxPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sacCode: gstSplit.sacCode,
      rateBasisPoints: gstSplit.rateBasisPoints,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req);
    const body = await req.json();

    const action = body.action || 'simulate';
    const studentId = body.studentId;
    const instalmentId = body.instalmentId;
    const amountStr = String(body.amountPaise || '');

    if (!amountStr || !/^\d+$/.test(amountStr)) {
      return jsonError('INVALID_AMOUNT', 'amountPaise must be a valid integer string in paise', 400);
    }

    const amountPaise = BigInt(amountStr);
    if (amountPaise < 50000n) {
      return jsonError('BELOW_MINIMUM', 'Minimum payment amount is ₹500 (50,000 paise)', 422);
    }

    const repo = getRepository();

    // Check RBAC if caller is parent
    if (session && session.role === 'PARENT' && studentId) {
      const guardians = repo.getGuardiansByUserId(session.sub);
      const student = repo.getStudentById(studentId);
      const isLinked = guardians.some((g) => g.studentId === student?.id);
      if (!isLinked) {
        return jsonError('ACCESS_DENIED', 'Parent not linked to target student', 403);
      }
    }

    if (action === 'create_order') {
      const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      return jsonOk({
        success: true,
        orderId,
        amountPaise: amountStr,
        currency: 'INR',
        keyId: 'rzp_test_mock_shikshasetu',
      });
    }

    // Default action: 'simulate'
    const gatewayPaymentId = body.gatewayPaymentId || body.idempotencyKey || `pay_sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const result = await repo.recordPayment({
      studentId,
      studentCode: body.studentCode,
      instalmentId,
      amountPaise,
      mode: body.paymentMethod || 'UPI',
      gatewayPaymentId,
      gatewayOrderId: body.gatewayOrderId,
      payerName: body.payerName || session?.name,
      payerPhone: body.payerPhone || session?.phone,
      bankReference: body.bankReference,
      receivedOn: body.receivedOn,
      remarks: body.remarks || 'Parent portal online checkout',
      actorUserId: session?.sub,
    });

    return jsonOk(result, result.outcome === 'DUPLICATE' ? 200 : 201);
  } catch (err: any) {
    if (err.statusCode) {
      return jsonError(err.code || 'PAYMENT_FAILED', err.message, err.statusCode);
    }
    return jsonError('SERVER_ERROR', err.message || 'Payment simulation failed', 500);
  }
}
