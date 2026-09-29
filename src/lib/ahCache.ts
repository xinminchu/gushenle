// 夜盘最后一笔缓存：盘后 16:00–20:00 ET 在 App 里看到的最后一笔夜盘价，
// 存本机 localStorage；20:00 后 Nasdaq 不再更新报价时，用它顶替常规收盘价显示
// （跟券商 App 一样：冻结价 + 时间戳）。
// 只在本机生效——没在盘后打开过 App 的设备看不到缓存，会退回常规收盘价（也是对的）。

export interface AHPrint {
  price: number;
  pct: number | null;
  time: string;
  /** 存入时的美东交易日 YYYY-MM-DD */
  etDate: string;
}

const KEY = 'gushenle-ah-last-v1';
const MAX_SYMBOLS = 60;

/** 美东日历日期 YYYY-MM-DD（en-CA 格式天然就是 YYYY-MM-DD） */
export function etTodayISO(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}

function readAll(): Record<string, AHPrint> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, AHPrint>;
  } catch {
    return {};
  }
}

/** 盘后看到真夜盘价时存一笔（由 getRhythm 在 priceSession==='after-hours' 时调用） */
export function saveAHPrint(
  symbol: string,
  price: number,
  pct: number | null,
  time: string,
): void {
  try {
    const all = readAll();
    const k = symbol.toUpperCase();
    delete all[k]; // 提到最后，保持"最新在尾"
    all[k] = { price, pct, time, etDate: etTodayISO() };
    const keys = Object.keys(all);
    for (let i = 0; keys.length - i > MAX_SYMBOLS; i++) delete all[keys[i]];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* 无痕模式等：直接放弃，不影响主流程 */
  }
}

/** 取某标的缓存的夜盘最后一笔；调用方自己判断 etDate 是否还有效 */
export function getAHPrint(symbol: string): AHPrint | null {
  try {
    return readAll()[symbol.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}
