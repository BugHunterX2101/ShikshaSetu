// app/api/export/tally/route.ts
import { getSessionFromRequest } from '@/src/lib/auth';
import { getRepository } from '@/src/store/repository';
import { jsonError } from '@/src/lib/apiResponse';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return jsonError('UNAUTHENTICATED', 'Authentication required', 401);
  }

  if (session.role === 'PARENT' || session.role === 'COUNSELLOR') {
    return jsonError('FORBIDDEN_ROLE', 'Only accounts executive or director can export Tally data', 403);
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'xml';
  const fromDate = searchParams.get('fromDate') || '2026-04-01';
  const toDate = searchParams.get('toDate') || '2026-11-02';

  const repo = getRepository();

  if (format === 'csv') {
    const csvContent = repo.generateTallyCsvExport(fromDate, toDate);
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tally_audit_${fromDate}_${toDate}.csv"`,
      },
    });
  }

  const xmlContent = repo.generateTallyXmlExport(fromDate, toDate);
  return new Response(xmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="tally_vouchers_${fromDate}_${toDate}.xml"`,
    },
  });
}
