// app/api/webhooks/razorpay/route.ts
import { NextResponse } from 'next/server';
import { verifyWebhookSignature, RAZORPAY_WEBHOOK_SECRET } from '@/src/domain/webhookSignature';
import { getRepository } from '@/src/store/repository';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('X-Razorpay-Signature') || '';
    const rawBody = await req.text();

    if (!signature || !verifyWebhookSignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET)) {
      return NextResponse.json(
        {
          error: 'BAD_SIGNATURE',
          message: 'Razorpay webhook signature verification failed. Request rejected.',
        },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error: 'MALFORMED_JSON',
          message: 'Webhook payload is not valid JSON.',
        },
        { status: 400 }
      );
    }

    // Extract payment details supporting both Razorpay nested entity and direct payload
    const paymentEntity = body.payload?.payment?.entity || {};
    const notes = paymentEntity.notes || body.notes || {};

    const gatewayPaymentId = paymentEntity.id || body.gatewayPaymentId || body.paymentId || body.id;
    const studentId = notes.studentId || body.studentId;
    const studentCode = notes.studentCode || body.studentCode;
    const instalmentId = notes.instalmentId || body.instalmentId;
    const rawAmount = paymentEntity.amount !== undefined ? paymentEntity.amount : body.amountPaise !== undefined ? body.amountPaise : body.amount;

    if (!gatewayPaymentId) {
      return NextResponse.json(
        {
          error: 'MISSING_PAYMENT_ID',
          message: 'Gateway payment ID missing from webhook payload.',
        },
        { status: 400 }
      );
    }

    const amountPaise = BigInt(rawAmount || 0);
    const repo = getRepository();

    const result = await repo.recordPayment({
      studentId,
      studentCode,
      instalmentId,
      amountPaise,
      mode: (paymentEntity.method?.toUpperCase() || body.mode || body.paymentMethod || 'UPI') as any,
      gatewayPaymentId,
      gatewayOrderId: paymentEntity.order_id || body.gatewayOrderId,
      bankReference: paymentEntity.acquirer_data?.bank_transaction_id || body.bankReference,
      remarks: body.remarks || 'Razorpay Webhook payment capture',
      receivedOn: body.receivedOn,
    });

    if (result.outcome === 'DUPLICATE') {
      return NextResponse.json(
        {
          success: true,
          outcome: 'DUPLICATE',
          receiptNumber: result.receiptNumber,
          paymentId: result.paymentId,
          message: 'Duplicate webhook event received; idempotency replay processed without re-crediting',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ...result,
        message: 'Payment processed and matched successfully',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.code || 'WEBHOOK_PROCESSING_FAILED',
        message: err.message || 'Internal error processing payment webhook',
      },
      { status: err.statusCode || 500 }
    );
  }
}
