// app/api/admin/refunds/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT') {
    return jsonError('FORBIDDEN_ROLE', 'Parents cannot view refunds queue', 403);
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = (searchParams.get('status') as any) || undefined;

  const repo = getRepository();
  const refunds = repo.getRefundRequests(statusFilter);

  return jsonOk({
    success: true,
    totalCount: refunds.length,
    refunds: refunds.map((r) => {
      const student = repo.getStudentById(r.studentId);
      return {
        id: r.id,
        studentId: r.studentId,
        studentCode: student?.studentCode,
        studentName: student?.fullName,
        receivedOn: r.receivedOn,
        daysElapsed: r.daysElapsed,
        totalCourseDays: r.totalCourseDays,
        netFeePaise: r.netFeePaise.toString(),
        totalPaidPaise: r.totalPaidPaise.toString(),
        consumedPaise: r.consumedPaise.toString(),
        refundablePaise: r.refundablePaise.toString(),
        refundableFormatted: `₹${(Number(r.refundablePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        shortfallPaise: r.shortfallPaise.toString(),
        slaDueDate: r.slaDueDate,
        status: r.status,
        raisedBy: r.raisedBy,
        approvedBy: r.approvedBy,
        settledOn: r.settledOn,
        creditNoteId: r.creditNoteId,
      };
    }),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role !== 'ACCOUNTS_EXEC' && session.role !== 'DIRECTOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can raise refund requests', 403);
  }

  try {
    const body = await req.json();
    const studentId = body.studentId;
    const receivedOn = body.receivedOn || '2026-11-02';
    const reason = body.reason;

    if (!studentId) {
      return jsonError('MISSING_STUDENT_ID', 'studentId is required', 400);
    }

    const repo = getRepository();
    const student = repo.getStudentById(studentId);
    if (!student) {
      return jsonError('STUDENT_NOT_FOUND', 'Student record not found', 404);
    }

    const refund = await repo.raiseRefund({
      studentId: student.id,
      receivedOn,
      reason,
      actorUserId: session.sub,
    });

    return jsonOk(
      {
        success: true,
        message: 'Refund request created in DRAFT state',
        refund: {
          id: refund.id,
          studentId: refund.studentId,
          receivedOn: refund.receivedOn,
          daysElapsed: refund.daysElapsed,
          totalCourseDays: refund.totalCourseDays,
          netFeePaise: refund.netFeePaise.toString(),
          totalPaidPaise: refund.totalPaidPaise.toString(),
          consumedPaise: refund.consumedPaise.toString(),
          refundablePaise: refund.refundablePaise.toString(),
          refundableFormatted: `₹${(Number(refund.refundablePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          slaDueDate: refund.slaDueDate,
          status: refund.status,
          raisedBy: refund.raisedBy,
        },
      },
      201
    );
  } catch (err: any) {
    return jsonError('SERVER_ERROR', err.message || 'Failed to raise refund', 500);
  }
}
