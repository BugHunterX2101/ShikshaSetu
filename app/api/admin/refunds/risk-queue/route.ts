// app/api/admin/refunds/risk-queue/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT') {
    return jsonError('FORBIDDEN_ROLE', 'Parents cannot view AI dropout risk queue', 403);
  }

  const repo = getRepository();
  const flags = repo.getDropoutFlags();

  const items = flags.map((f) => {
    const student = repo.getStudentById(f.studentId);
    const centre = student ? repo.getCentreById(student.centreId) : undefined;
    const dues = student ? repo.getDuesSummary(student.id) : undefined;

    return {
      studentId: f.studentId,
      id: f.studentId,
      studentCode: student?.studentCode,
      studentName: student?.fullName,
      centreCode: centre?.code,
      centre: centre?.name || centre?.code || 'Gopalpura Bypass (Main Centre)',
      score: f.score,
      compositeScore: f.score,
      severity: f.severity,
      financialScore: f.fScore,
      attendanceScore: f.aScore,
      academicScore: f.sScore,
      components: {
        financialOverdueScore: f.fScore,
        attendanceDropScore: f.aScore,
        academicScoreDrop: f.sScore,
      },
      flaggedOn: f.flaggedOn,
      templateGuide: f.templateGuide,
      currentBalancePaise: dues?.totalBalancePaise || '0',
      overdueDays: dues?.overdueDays || 0,
      status: f.severity === 'HIGH' ? 'NEEDS_INTERVENTION' : f.severity === 'MEDIUM' ? 'PENDING_REFUND' : 'MONITORING',
    };
  });

  return jsonOk({
    success: true,
    totalCount: items.length,
    highRiskCount: items.filter((i) => i.score >= 70).length,
    items,
  });
}
