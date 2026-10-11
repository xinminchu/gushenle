/**
 * SEC EDGAR 共享工具（探市全家桶用）
 * - ticker→CIK 映射：company_tickers.json，内存缓存 24h
 * - 所有 SEC 请求必须带 User-Agent，否则 403
 * - 全部免费 API，无需 key
 */

export const SEC_UA = 'Gushenle/1.0 (contact@gushenle.com)';

let tickerMap: Map<string, number> | null = null;
let tickerMapAt = 0;
const TICKER_TTL = 24 * 60 * 60 * 1000;

export async function secFetchJson(url: string): Promise<any> {
  const r = await fetch(url, {
    headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`SEC ${r.status}: ${url}`);
  return r.json();
}

export async function secFetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': SEC_UA } });
  if (!r.ok) throw new Error(`SEC ${r.status}: ${url}`);
  return r.text();
}

/**
 * ticker → 10 位补零 CIK。非美股（带 .KS 等后缀）或查不到 → null。
 */
export async function getCik10(symbol: string): Promise<string | null> {
  const sym = symbol.toUpperCase().trim().replace(/[.-]/g, '');
  if (!/^[A-Z]{1,6}$/.test(sym)) return null;
  const now = Date.now();
  if (!tickerMap || now - tickerMapAt > TICKER_TTL) {
    const j = await secFetchJson('https://www.sec.gov/files/company_tickers.json');
    const m = new Map<string, number>();
    for (const k of Object.keys(j)) {
      const e = j[k];
      if (e?.ticker && e?.cik_str) {
        m.set(String(e.ticker).toUpperCase().replace(/[.-]/g, ''), Number(e.cik_str));
      }
    }
    tickerMap = m;
    tickerMapAt = now;
  }
  const cik = tickerMap.get(sym);
  return cik ? String(cik).padStart(10, '0') : null;
}

/** CIK 去前导零（用于 Archives URL） */
export function cikNoZero(cik10: string): string {
  return String(Number(cik10));
}
