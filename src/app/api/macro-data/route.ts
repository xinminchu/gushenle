// src/app/api/macro-data/route.ts
// 宏观事件实际数据：BLS 公开 API（免 key），供价格走势图上的宏观事件弹窗用。
// 非农就业 (CES0000000001)、失业率 (LNS14000000)、CPI (CUUR0000SA0)
import { NextRequest, NextResponse } from 'next/server';

const BLS_SERIES: Record<string, { id: string; label: string; unit: string }> = {
  nonfarm: { id: 'CES0000000001', label: '新增非农就业', unit: '千人' },
  unemployment: { id: 'LNS14000000', label: '失业率', unit: '%' },
  cpi: { id: 'CUUR0000SA0', label: 'CPI', unit: '' },
};

interface BLSPoint {
  year: string;
  period: string; // M01-M12
  periodName: string;
  value: string;
}

async function fetchBLS(seriesId: string): Promise<BLSPoint[]> {
  const year = new Date().getFullYear();
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seriesid: [seriesId],
      startyear: String(year - 1),
      endyear: String(year),
    }),
  });
  if (!res.ok) throw new Error(`BLS HTTP ${res.status}`);
  const d = await res.json();
  if (d.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS request failed');
  const series = d.Results?.series?.[0]?.data || [];
  return series.map((p: Record<string, string>) => ({
    year: p.year,
    period: p.period,
    periodName: p.periodName,
    value: p.value,
  }));
}

export async function GET(req: NextRequest) {
  const kind = new URL(req.url).searchParams.get('kind') || 'nonfarm';
  try {
    if (kind === 'nonfarm') {
      // 非农 + 失业率一起取
      const [payrolls, unemployment] = await Promise.all([
        fetchBLS(BLS_SERIES.nonfarm.id),
        fetchBLS(BLS_SERIES.unemployment.id),
      ]);
      return NextResponse.json({
        ok: true,
        kind,
        payrolls: payrolls.slice(0, 6), // 最近6个月
        unemployment: unemployment.slice(0, 6),
      });
    } else if (kind === 'cpi') {
      const cpi = await fetchBLS(BLS_SERIES.cpi.id);
      return NextResponse.json({ ok: true, kind, cpi: cpi.slice(0, 6) });
    }
    return NextResponse.json({ ok: false, error: 'unknown kind' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 500 },
    );
  }
}
