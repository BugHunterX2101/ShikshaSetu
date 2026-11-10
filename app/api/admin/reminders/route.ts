// app/api/admin/reminders/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { formatReminderMessage } from '@/src/domain/reminders';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT') {
    return jsonError('FORBIDDEN_ROLE', 'Parents cannot view reminder outbox', 403);
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId') || undefined;
  const state = (searchParams.get('state') as any) || undefined;
  const triggerType = (searchParams.get('triggerType') as any) || undefined;
  const scheduledFor = searchParams.get('scheduledFor') || undefined;
  const centreId = searchParams.get('centreId') || undefined;

  const repo = getRepository();
  const reminders = repo.getReminders({ studentId, state, triggerType, scheduledFor, centreId });

  const enriched = reminders.map((r) => {
    let suppressReceiptNo: string | undefined;
    if (r.suppressPaymentId) {
      const receipts = repo.getReceiptsByStudentId(r.studentId);
      const matched = receipts.find((rec) => rec.paymentId === r.suppressPaymentId);
      suppressReceiptNo = matched?.number;
    }

    return {
      id: r.id,
      instalmentId: r.instalmentId,
      studentId: r.studentId,
      triggerType: r.triggerType,
      scheduledFor: r.scheduledFor,
      channel: r.channel,
      lang: r.lang,
      state: r.state,
      sentAt: r.sentAt,
      suppressedAt: r.suppressedAt,
      suppressReason: r.suppressReason,
      suppressPaymentId: r.suppressPaymentId,
      suppressReceiptNo,
    };
  });

  return jsonOk({
    success: true,
    totalCount: enriched.length,
    reminders: enriched,
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT') {
    return jsonError('FORBIDDEN_ROLE', 'Parents cannot run reminder operations', 403);
  }

  try {
    const body = await req.json();
    const action = body.action || 'run';
    const repo = getRepository();

    if (action === 'preview') {
      const studentId = body.studentId;
      const lang = body.lang === 'hi' ? 'hi' : 'en';

      if (!studentId) {
        return jsonError('MISSING_STUDENT_ID', 'studentId is required for preview', 400);
      }

      const dues = repo.getDuesSummary(studentId);
      if (!dues) {
        return jsonError('STUDENT_NOT_FOUND', 'Student record not found', 404);
      }

      const balancePaise = BigInt(dues.totalBalancePaise);
      const overdueDays = dues.overdueDays;
      const isPartPaid = dues.status === 'PART_PAID_OVERDUE';

      const previewEn = formatReminderMessage(balancePaise, overdueDays, isPartPaid, 'en');
      const previewHi = formatReminderMessage(balancePaise, overdueDays, isPartPaid, 'hi');

      return jsonOk({
        success: true,
        preview: lang === 'hi' ? previewHi : previewEn,
        bilingual: {
          en: previewEn,
          hi: previewHi,
        },
      });
    }

    if (action === 'run') {
      const asOfDate = body.asOfDate;
      const stats = await repo.triggerReminderRun(asOfDate);

      return jsonOk({
        success: true,
        message: 'Reminder dispatch run executed',
        stats,
      });
    }

    return jsonError('INVALID_ACTION', 'action must be "preview" or "run"', 400);
  } catch (err: any) {
    return jsonError('SERVER_ERROR', err.message || 'Operation failed', 500);
  }
}
