// app/api/admin/students/[id]/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { validateFeePlan } from '@/src/domain/rajasthanAct';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  const { id } = await context.params;
  const repo = getRepository();
  const student = repo.getStudentById(id);

  if (!student) {
    return jsonError('STUDENT_NOT_FOUND', `Student ${id} not found`, 404);
  }

  // RBAC checks
  if (session.role === 'PARENT') {
    const guardians = repo.getGuardiansByUserId(session.sub);
    const isLinked = guardians.some((g) => g.studentId === student.id);
    if (!isLinked) {
      return jsonError('ACCESS_DENIED', 'Parent cannot view students other than their own', 403);
    }
  }

  const centre = repo.getCentreById(student.centreId);
  const guardians = repo.getGuardiansByStudentId(student.id);
  const dues = repo.getDuesSummary(student.id);
  const receipts = repo.getReceiptsByStudentId(student.id);
  const payments = repo.getPaymentsByStudentId(student.id);

  // Rajasthan Coaching Act 2025 Schedule Validation
  const insts = repo.getInstalmentsByStudentId(student.id);
  const scheduleValidation = validateFeePlan({
    totalFeePaise: student.grossFeePaise,
    instalments: insts.map((i) => ({ instalmentNumber: i.seqNo, dueDate: i.dueDate, amountPaise: i.amountDuePaise })),
  });

  // Role scoping: Counsellor receives zero financial dues amounts
  if (session.role === 'COUNSELLOR') {
    return jsonOk({
      success: true,
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        dob: student.dob,
        isMinor: student.isMinor,
        centreCode: centre?.code,
        status: student.status,
      },
      academicView: {
        status: dues?.status,
        statusLabelEn: dues?.statusLabelEn,
        statusLabelHi: dues?.statusLabelHi,
        overdueDays: dues?.overdueDays,
      },
      // Financial ledger redacted for counsellor
      ledgerRedacted: true,
      academic: {
        status: dues?.status,
        overdueDays: dues?.overdueDays,
      },
      status: student.status,
    });
  }

  return jsonOk({
    success: true,
    student: {
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      dob: student.dob,
      isMinor: student.isMinor,
      centre: centre,
      status: student.status,
      grossFeePaise: student.grossFeePaise.toString(),
      discountPaise: student.discountPaise.toString(),
      netFeePaise: student.netFeePaise.toString(),
    },
    guardians,
    dues,
    receipts: receipts.map((r) => ({
      id: r.id,
      number: r.number,
      issuedDate: r.issuedDate,
      grossPaise: r.grossPaise.toString(),
      taxablePaise: r.taxablePaise.toString(),
      cgstPaise: r.cgstPaise.toString(),
      sgstPaise: r.sgstPaise.toString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amountPaise: p.amountPaise.toString(),
      mode: p.mode,
      receivedOn: p.receivedOn,
      matchStatus: p.matchStatus,
    })),
    scheduleCompliance: {
      isCompliant: scheduleValidation.valid,
      code: scheduleValidation.code,
      message: scheduleValidation.message,
    },
  });
}
