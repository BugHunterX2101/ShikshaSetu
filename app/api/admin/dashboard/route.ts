// app/api/admin/dashboard/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonOk, jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT') {
    return jsonError('FORBIDDEN_ROLE', 'Parents cannot access admin dashboard', 403);
  }

  const { searchParams } = new URL(req.url);
  const asOfDate = searchParams.get('asOfDate') || undefined;
  const centreId = searchParams.get('centreId') || undefined;
  const batchId = searchParams.get('batchId') || undefined;

  const repo = getRepository();
  const kpis = repo.getAdminDashboardKpis(asOfDate, centreId, batchId);
  const ageing = repo.getMultiCentreAgeing(asOfDate, centreId, batchId);
  const centres = repo.getCentres();

  return jsonOk({
    success: true,
    kpis,
    ageing,
    centres,
  });
}
