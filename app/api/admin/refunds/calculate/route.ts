// app/api/admin/refunds/calculate/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { computeProRataRefund, RefundHeadInput } from '@/src/domain/refund';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  try {
    const body = await req.json();
    const studentId = body.studentId;
    const receivedOn = body.receivedOn || '2026-11-02';
    const repo = getRepository();

    if (!studentId) {
      return jsonError('MISSING_STUDENT_ID', 'studentId is required', 400);
    }

    const student = repo.getStudentById(studentId);
    if (!student) {
      return jsonError('STUDENT_NOT_FOUND', 'Student record not found', 404);
    }

    const insts = repo.getInstalmentsByStudentId(student.id);
    const totalPaidPaise = insts.reduce((acc, i) => acc + i.amountPaidPaise, 0n);

    const batch = repo.getCentres() && repo.getStudentById(student.id) ? { courseDays: 365 } : { courseDays: 360 };
    const totalCourseDays = batch.courseDays;

    const enrolDate = new Date(student.enrolmentDate);
    const recDate = new Date(receivedOn);
    const daysElapsed = Math.max(0, Math.floor((recDate.getTime() - enrolDate.getTime()) / (1000 * 60 * 60 * 24)));

    const heads = insts.flatMap((i) => repo.getInstalmentHeads(i.id));
    const tuitionHead = heads.filter((h) => h.head === 'TUITION');
    const hostelHead = heads.filter((h) => h.head === 'HOSTEL');
    const messHead = heads.filter((h) => h.head === 'MESS');

    const tuitionNet = tuitionHead.reduce((acc, h) => acc + h.amountDuePaise, 0n);
    const tuitionPaid = tuitionHead.reduce((acc, h) => acc + h.amountPaidPaise, 0n);

    const hostelNet = hostelHead.reduce((acc, h) => acc + h.amountDuePaise, 0n);
    const hostelPaid = hostelHead.reduce((acc, h) => acc + h.amountPaidPaise, 0n);

    const messNet = messHead.reduce((acc, h) => acc + h.amountDuePaise, 0n);
    const messPaid = messHead.reduce((acc, h) => acc + h.amountPaidPaise, 0n);

    const headsList: RefundHeadInput[] = [
      { head: 'TUITION', netFeePaise: tuitionNet, totalPaidPaise: tuitionPaid, courseDays: totalCourseDays },
      { head: 'HOSTEL', netFeePaise: hostelNet, totalPaidPaise: hostelPaid, courseDays: totalCourseDays },
      { head: 'MESS', netFeePaise: messNet, totalPaidPaise: messPaid, courseDays: totalCourseDays },
    ];

    const calculation = computeProRataRefund(receivedOn, headsList, daysElapsed, receivedOn);

    return jsonOk({
      success: true,
      studentId: student.id,
      studentCode: student.studentCode,
      daysElapsed: calculation.daysElapsed,
      totalCourseDays: calculation.totalCourseDays,
      receivedOn: calculation.receivedOn,
      slaDueDate: calculation.slaDueDate,
      totalPaidPaise: calculation.totalPaidPaise.toString(),
      totalPaidFormatted: `₹${(Number(calculation.totalPaidPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalConsumedPaise: calculation.totalConsumedPaise.toString(),
      totalConsumedFormatted: `₹${(Number(calculation.totalConsumedPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalRefundablePaise: calculation.totalRefundablePaise.toString(),
      totalRefundableFormatted: `₹${(Number(calculation.totalRefundablePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalShortfallPaise: calculation.totalShortfallPaise.toString(),
      heads: calculation.heads.map((h) => ({
        head: h.head,
        netFeePaise: h.netFeePaise.toString(),
        paidPaise: h.paidPaise.toString(),
        consumedPaise: h.consumedPaise.toString(),
        refundablePaise: h.refundablePaise.toString(),
        shortfallPaise: h.shortfallPaise.toString(),
      })),
    });
  } catch (err: any) {
    return jsonError('SERVER_ERROR', err.message || 'Calculation failed', 500);
  }
}
