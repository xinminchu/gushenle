// GET /api/insider?symbol=TSLA
// 探市全家桶 P0：SEC Form 4 内部人交易。90 天窗口，最近 8 份 filing。
// 只摆公开披露的事实（谁、何时、买卖多少股），不做任何解读。
// 失败/无数据 → {unavailable: true}，前端静默隐藏。
import { NextRequest, NextResponse } from 'next/server';
import { getCik10, cikNoZero, secFetchJson, secFetchText } from '@/lib/sec';

const cache = new Map<string, { at: number; data: any }>();
const TTL = 6 * 60 * 60 * 1000; // 6 小时：Form 4 是低频披露
const WINDOW_DAYS = 90;
const MAX_FILINGS = 8;

interface Tx {
  date: string;
  filer: string;
  role: string;
  code: string; // P=买入 S=卖出 M=行权 A=授予
  shares: number;
  price: number | null;
}

const CODE_LABEL: Record<string, string> = {
  P: '买入',
  S: '卖出',
  M: '行权',
  A: '授予',
};

function tagVal(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : null;
}

/** 解析单份 Form 4 原始 XML（只取 non-derivative 部分） */
function parseF4(xml: string): { filer: string; role: string; txs: Omit<Tx, 'filer' | 'role'>[] } | null {
  const filer = tagVal(xml, 'rptOwnerName');
  if (!filer) return null;
  let role = '内部人';
  const relM = xml.match(/<reportingOwnerRelationship>([\s\S]*?)<\/reportingOwnerRelationship>/);
  if (relM) {
    const r = relM[1];
    const truthy = (tag: string) => {
      const v = (tagVal(r, tag) || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    const roles: string[] = [];
    if (truthy('isDirector')) roles.push('董事');
    if (truthy('isOfficer')) {
      const t = tagVal(r, 'officerTitle');
      roles.push(t ? `高管（${t}）` : '高管');
    }
    if (truthy('isTenPercentOwner')) roles.push('10%股东');
    if (roles.length) role = roles.join('/');
  }
  const txs: Omit<Tx, 'filer' | 'role'>[] = [];
  const blocks = xml.match(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g) || [];
  for (const b of blocks) {
    const code = tagVal(b, 'transactionCode');
    if (!code) continue;
    const shM = b.match(/<transactionShares>\s*<value>([^<]+)<\/value>/);
    const prM = b.match(/<transactionPricePerShare>\s*<value>([^<]+)<\/value>/);
    const dtM = b.match(/<transactionDate>\s*<value>([^<]+)<\/value>/);
    const shares = shM ? Number(shM[1].replace(/,/g, '')) : NaN;
    if (!Number.isFinite(shares) || shares <= 0) continue;
    txs.push({
      date: dtM ? dtM[1].slice(0, 10) : '',
      code,
      shares,
      price: prM ? Number(prM[1]) : null,
    });
  }
  return { filer, role, txs };
}

/** filing 的原始 Form 4 XML 地址：index.json 里找非 xsl 的 .xml */
async function rawXmlUrl(cik10: string, accession: string): Promise<string | null> {
  const acc = accession.replace(/-/g, '');
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNoZero(cik10)}/${acc}`;
  try {
    const idx = await secFetchJson(`${base}/index.json`);
    const items: any[] = idx?.directory?.item || [];
    const hit = items.find((it) => {
      const n = String(it.name || '');
      return n.endsWith('.xml') && !n.includes('xslF345X06');
    });
    if (hit) return `${base}/${hit.name}`;
  } catch {
    /* fall through */
  }
  return null;
}

async function insiderFor(symbol: string): Promise<any> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const done = (data: any) => {
    cache.set(symbol, { at: Date.now(), data });
    return data;
  };
  const unavailable = { unavailable: true };
  try {
    const cik10 = await getCik10(symbol);
    if (!cik10) return done(unavailable);
    const sub = await secFetchJson(`https://data.sec.gov/submissions/CIK${cik10}.json`);
    const recent = sub?.filings?.recent;
    if (!recent) return done(unavailable);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const filings: { date: string; accession: string }[] = [];
    for (let i = 0; i < recent.form.length && filings.length < MAX_FILINGS; i++) {
      if (recent.form[i] === '4' && recent.filingDate[i] >= cutoffStr) {
        filings.push({ date: recent.filingDate[i], accession: recent.accessionNumber[i] });
      }
    }
    if (!filings.length) return done(unavailable);

    const transactions: Tx[] = [];
    const filingRows: { date: string; filer: string; url: string }[] = [];
    await Promise.all(
      filings.map(async (f) => {
        try {
          const xmlUrl = await rawXmlUrl(cik10, f.accession);
          if (!xmlUrl) return;
          const xml = await secFetchText(xmlUrl);
          const parsed = parseF4(xml);
          if (!parsed || !parsed.txs.length) return;
          filingRows.push({
            date: f.date,
            filer: parsed.filer,
            url: `https://www.sec.gov/Archives/edgar/data/${cikNoZero(cik10)}/${f.accession.replace(/-/g, '')}/`,
          });
          for (const t of parsed.txs) {
            transactions.push({
              date: t.date || f.date,
              filer: parsed.filer,
              role: parsed.role,
              code: t.code,
              shares: t.shares,
              price: t.price,
            });
          }
        } catch {
          /* 单份解析失败不影响整体 */
        }
      }),
    );
    if (!transactions.length) return done(unavailable);
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    const buyShares = transactions
      .filter((t) => t.code === 'P')
      .reduce((s, t) => s + t.shares, 0);
    const sellShares = transactions
      .filter((t) => t.code === 'S')
      .reduce((s, t) => s + t.shares, 0);
    const insiderCount = new Set(transactions.map((t) => t.filer)).size;
    return done({
      symbol: symbol.toUpperCase(),
      cik: cikNoZero(cik10),
      windowDays: WINDOW_DAYS,
      summary: {
        buyShares: Math.round(buyShares),
        sellShares: Math.round(sellShares),
        insiderCount,
        filingCount: filingRows.length,
      },
      transactions: transactions.slice(0, 20).map((t) => ({
        ...t,
        codeLabel: CODE_LABEL[t.code] || t.code,
      })),
      filings: filingRows,
    });
  } catch (e) {
    console.error('[api/insider]', symbol, e);
    return done(unavailable);
  }
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || '').trim().toUpperCase();
  if (!symbol) return NextResponse.json({ unavailable: true });
  const data = await insiderFor(symbol);
  // 顺手带上 UA 说明，方便排查 403
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
