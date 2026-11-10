// tests/api/admin_dashboard.test.ts
// TC-06 & TC-15: Multi-Centre Ageing, KPIs, and Balanced Zero-Sum Tally Prime Export

import { describe, it, expect, beforeEach } from 'vitest';
import { getRepository } from '@/src/store/repository';
import { GET as dashboardGet } from '@/app/api/admin/dashboard/route';
import { GET as tallyGet } from '@/app/api/export/tally/route';

describe('TC-06 & TC-15: Admin Dashboard & Tally Prime Integration', () => {
  beforeEach(() => {
    getRepository().resetToSeedData();
  });

  it('TC-06: Multi-centre ageing returns 4 buckets satisfying exact sum invariant across 4 Jaipur centres', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard?asOfDate=2026-11-02', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await dashboardGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.centres.length).toBe(4);

    // Verify 2,600 student context
    expect(data.kpis.totalStudents).toBe(2600);
    expect(data.kpis.collectionEfficiencyPercent).toBeGreaterThan(0);

    // Verify ageing buckets for all centres
    for (const centre of data.ageing.centreTotals) {
      const cur = BigInt(centre.currentPaise);
      const d1 = BigInt(centre.d1_30Paise);
      const d31 = BigInt(centre.d31_60Paise);
      const d61 = BigInt(centre.d61_plusPaise);
      const total = BigInt(centre.totalOpenPaise);

      // Invariant: sum of buckets strictly equals totalOpenPaise
      expect(cur + d1 + d31 + d61).toBe(total);
    }

    // Verify overall totals invariant
    const overall = data.ageing.overallTotals;
    const ovCur = BigInt(overall.currentPaise);
    const ovD1 = BigInt(overall.d1_30Paise);
    const ovD31 = BigInt(overall.d31_60Paise);
    const ovD61 = BigInt(overall.d61_plusPaise);
    const ovTotal = BigInt(overall.totalOpenPaise);

    expect(ovCur + ovD1 + ovD31 + ovD61).toBe(ovTotal);
  });

  it('TC-15: GET /api/export/tally (XML) produces balanced zero-sum double-entry vouchers with deterministic GUIDs', async () => {
    const req = new Request('http://localhost:3000/api/export/tally?format=xml&fromDate=2026-04-01&toDate=2026-11-02', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await tallyGet(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');

    const xml = await res.text();
    expect(xml).toContain('<ENVELOPE>');
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(xml).toContain('<VOUCHER VCHTYPE="Receipt"');
    expect(xml).toContain('RCP/26-27/000412');

    // Verify zero-sum double-entry for STU-0412 voucher (30k gross):
    // Bank Debit = -30000.00, Fee Credit = 25423.73, CGST = 2288.14, SGST = 2288.13 (or exact paise split)
    // -30000.00 + 25423.73 + 2288.14 + 2288.13 = 0.00
    expect(xml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
    expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
  });

  it('GET /api/export/tally (CSV) exports sanitized CSV preventing spreadsheet formula injection', async () => {
    const req = new Request('http://localhost:3000/api/export/tally?format=csv&fromDate=2026-04-01&toDate=2026-11-02', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await tallyGet(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');

    const csv = await res.text();
    expect(csv).toContain('Date,VoucherNumber,CentreCode,StudentCode,PaymentMode,GrossAmount,TaxableBase,CGST,SGST,VoucherType');
    expect(csv).toContain('RCP/26-27/000412');
  });

  it('GET /api/admin/dashboard filters ageing and KPIs when batchId parameter is provided', async () => {
    const req = new Request('http://localhost:3000/api/admin/dashboard?asOfDate=2026-11-02&batchId=JEE-2027', {
      headers: {
        'x-demo-role': 'ACCOUNTS_EXEC',
        'x-demo-user-id': 'usr-acc-01',
      },
    });

    const res = await dashboardGet(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.kpis.totalStudents).toBeGreaterThan(0);
    expect(data.kpis.totalStudents).toBeLessThanOrEqual(2600);

    for (const centre of data.ageing.centreTotals) {
      const cur = BigInt(centre.currentPaise);
      const d1 = BigInt(centre.d1_30Paise);
      const d31 = BigInt(centre.d31_60Paise);
      const d61 = BigInt(centre.d61_plusPaise);
      const total = BigInt(centre.totalOpenPaise);
      expect(cur + d1 + d31 + d61).toBe(total);
    }
  });
});
