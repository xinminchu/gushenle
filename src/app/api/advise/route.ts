import { NextRequest, NextResponse } from 'next/server';
import { buildJudgment, statusLabel, type StatusKey } from '@/lib/rhythm';
import { getFullSeries, getLiveQuote, pickDisplayPrice } from '@/lib/marketData';
import { symbolToName } from '@/lib/stockAliases';
import { findStock } from '@/lib/stockList';
import type { Lang } from '@/lib/i18n';
import { toHantDeep, tx } from '@/lib/hant';

/**
 * 按谷峰律动给"买什么"建议。
 *
 * 产品立场（行为纠偏，不是水晶球）：
 * ① 先拦追高：涨太猛了（overheated）直接排除；
 * ② 跌势中的（weakLow）不接飞刀，直接排除；
 * ③ 剩下按"离过热最远且趋势不差"排序，最多给 3 个候选；
 * ④ 每只候选的原因只引用律动诊断（分数/状态/阈值），不预测涨跌。
 */

interface AdviseInput {
  symbol: string;
  name: string;
}

/** 候选排序：涨势加速 > 跌不动了 > 横盘 > 跌过头了 > 高位稳着涨 */
const RANK: Record<string, number> = {
  risingAccel: 0,
  bottomUp: 1,
  sideways: 2,
  oversoldBottom: 3,
  hotStrong: 4,
};

/** 明确排除的状态：追高拦掉，接飞刀拦掉 */
const EXCLUDED = new Set(['overheated', 'weakLow']);

function candidateReason(
  statusKey: StatusKey,
  score: number,
  hot: number,
  lang: Lang,
): string {
  const s = Math.round(score);
  const label = statusLabel(statusKey, lang);
  if (lang === 'en') {
    switch (statusKey) {
      case 'risingAccel':
        return `Rhythm ${s} — ${label}, still below the overheat line (${hot}), so buying now isn't chasing.`;
      case 'bottomUp':
        return `Rhythm ${s} — ${label}. Downward momentum is fading and the level is modest — worth watching, in batches.`;
      case 'sideways':
        return `Rhythm ${s} — ${label}. Direction is unclear but the level is mid-range: chasing and bottom-fishing are both risky.`;
      case 'oversoldBottom':
        return `Rhythm ${s} — ${label}. Only small batches — an oversold bounce can keep falling. Keep it light.`;
      case 'hotStrong':
        return `Rhythm ${s} — ${label}. Trend looks healthy but the level is high; small batches only if you really want in.`;
      default:
        return `Rhythm ${s} — ${label}.`;
    }
  }
  switch (statusKey) {
    case 'risingAccel':
      return `律动 ${s} 分，${label}，离过热线（${hot} 分）还有距离，现在介入不算追高。`;
    case 'bottomUp':
      return `律动 ${s} 分，${label}，下跌动能衰竭，位置不高，适合分批留意。`;
    case 'sideways':
      return `律动 ${s} 分，${label}，方向不明但位置适中，慎追高、慎抄底的心态参与。`;
    case 'oversoldBottom':
      return `律动 ${s} 分，${label}，只适合小仓位分批试，跌过头也可能继续跌，重仓要慎。`;
    case 'hotStrong':
      return `律动 ${s} 分，${label}，趋势健康但位置偏高，真要买只适合小仓位分批。`;
    default:
      return `律动 ${s} 分，${label}。`;
  }
}

function excludedReason(statusKey: StatusKey, score: number, lang: Lang): string {
  const s = Math.round(score);
  const label = statusLabel(statusKey, lang);
  if (lang === 'en') {
    if (statusKey === 'overheated') return `Rhythm ${s} — ${label}. Buying now would be chasing the top; excluded.`;
    if (statusKey === 'weakLow') return `Rhythm ${s} — ${label}. No catching falling knives in a downtrend; excluded.`;
    return `Rhythm ${s} — ${label}; excluded.`;
  }
  if (statusKey === 'overheated') return `律动 ${s} 分，${label}，现在买就是追高，已排除。`;
  if (statusKey === 'weakLow') return `律动 ${s} 分，${label}，下跌趋势中不接飞刀，已排除。`;
  return `律动 ${s} 分，${label}，已排除。`;
}

/**
 * 单只咨询的结论：只引用律动诊断，不预测涨跌。
 * side=buy 回答"这只现在能不能买"，side=sell 回答"这只现在能不能卖"。
 */
function singleVerdict(
  side: 'buy' | 'sell',
  statusKey: StatusKey,
  score: number,
  lang: Lang,
): string {
  const s = Math.round(score);
  const label = statusLabel(statusKey, lang);
  if (lang === 'en') {
    if (side === 'sell') {
      switch (statusKey) {
        case 'overheated':
          return `Rhythm ${s} — ${label}. Selling now is taking profit, not selling too early; you could also scale out in batches instead of clearing all at once.`;
        case 'hotStrong':
          return `Rhythm ${s} — ${label}; the trend still looks healthy. If you don't need the cash, hold with a take-profit line in mind; if you do sell, go in batches.`;
        case 'risingAccel':
          return `Rhythm ${s} — ${label}, the uptrend just got going. Selling now may leave money on the table — hold a little longer if you're not in a hurry.`;
        case 'sideways':
          return `Rhythm ${s} — ${label}. Selling or not, neither is wrong — it mainly depends on whether you have a better place for the money.`;
        case 'bottomUp':
          return `Rhythm ${s} — ${label}, stabilizing. Selling now risks selling at the floor — consider waiting.`;
        case 'oversoldBottom':
          return `Rhythm ${s} — ${label}. Cutting now would likely mean cutting at the very bottom — worth a second thought?`;
        case 'weakLow':
          return `Rhythm ${s} — ${label}. Selling now means cutting mid-fall; unless you need the cash, wait until it stops dropping.`;
      }
    } else {
      switch (statusKey) {
        case 'overheated':
          return `Rhythm ${s} — ${label}. Buying now would be chasing — worth a second thought?`;
        case 'hotStrong':
          return `Rhythm ${s} — ${label}. Trend is healthy but the level is high; small batches only if you really want in.`;
        case 'risingAccel':
          return `Rhythm ${s} — ${label}, still below the overheat line — buying now isn't chasing.`;
        case 'sideways':
          return `Rhythm ${s} — ${label}. May grind sideways for a while — keep the position small.`;
        case 'bottomUp':
          return `Rhythm ${s} — ${label}. Downward momentum is fading; small batches if you want to dip in.`;
        case 'oversoldBottom':
          return `Rhythm ${s} — ${label}. The oversold signal hasn't been reliable historically — be careful; small batches at most.`;
        case 'weakLow':
          return `Rhythm ${s} — ${label}. The knife is still falling — wait until it stops dropping.`;
      }
    }
    return `Rhythm ${s} — ${label}.`;
  }
  if (side === 'sell') {
    switch (statusKey) {
      case 'overheated':
        return `律动 ${s} 分，${label}，真想卖，现在卖是止盈不算卖飞；也可以分批卖，一把清要慎。`;
      case 'hotStrong':
        return `律动 ${s} 分，${label}，趋势还健康。不急用钱可以拿着，设条止盈线；想卖就分批。`;
      case 'risingAccel':
        return `律动 ${s} 分，${label}，涨势刚起来。现在卖可能卖在半山腰，不急的话再拿拿看。`;
      case 'sideways':
        return `律动 ${s} 分，${label}。卖不卖都不算错，主要看你有没有更好的去处。`;
      case 'bottomUp':
        return `律动 ${s} 分，${label}，正在企稳。现在卖容易卖在地板上，建议再等等。`;
      case 'oversoldBottom':
        return `律动 ${s} 分，${label}。现在割肉大概率割在最低点，再想想？`;
      case 'weakLow':
        return `律动 ${s} 分，${label}。现在卖是割在下跌途中，除非急用钱，不然等跌不动了再说。`;
    }
  } else {
    switch (statusKey) {
      case 'overheated':
        return `律动 ${s} 分，${label}，现在买就是追高，再想想？`;
      case 'hotStrong':
        return `律动 ${s} 分，${label}，趋势健康但位置偏高，真想买只适合小仓位分批。`;
      case 'risingAccel':
        return `律动 ${s} 分，${label}，离过热线还有距离，现在买不算追高。`;
      case 'sideways':
        return `律动 ${s} 分，${label}，买了可能磨人，仓位宜轻。`;
      case 'bottomUp':
        return `律动 ${s} 分，${label}，下跌动能衰竭，想抄底可以小仓位试试。`;
      case 'oversoldBottom':
        return `律动 ${s} 分，${label}。超卖信号历史上不太准，谨慎，真想买也小仓位。`;
      case 'weakLow':
        return `律动 ${s} 分，${label}，飞刀还在落，等跌不动了再说。`;
    }
  }
  return `律动 ${s} 分，${label}。`;
}

/**
 * 展示价：盘中/盘后/盘前用实时报价，否则用日线收盘价。
 * 口径与 /api/rhythm 共用 marketData.pickDisplayPrice（诊断永远走日线收盘序列）。
 * live 接口失败时静默降级为收盘价。
 */
async function priceForDisplay(
  symbol: string,
  series: { date: string; close: number }[],
): Promise<{ price: number; priceLive: boolean }> {
  const last = series[series.length - 1];
  const live = await getLiveQuote(symbol).catch(() => null);
  const { price, session } = pickDisplayPrice(last.close, last.date, live);
  return { price, priceLive: session !== 'close' };
}

async function judgeOne(symbol: string, lang: Lang) {
  const { series, source } = await getFullSeries(symbol);
  const closes = series.map((p) => p.close);
  if (closes.length === 0) return null;
  const j = buildJudgment(closes, lang);
  const { price, priceLive } = await priceForDisplay(symbol, series);
  return {
    price,
    priceLive,
    score: j.score,
    statusKey: j.statusKey,
    status: j.status,
    hot: j.thresholds.hot,
    simulated: source === 'simulated',
  };
}

export async function POST(req: NextRequest) {
  // 繁体：中文链路照常生成，输出前整包转繁体（键名不动）
  // 英文：直接生成英文（不走繁体转换）
  let lang: Lang = 'zh';
  const out = (d: unknown, status?: number) =>
    NextResponse.json(lang === 'hant' ? toHantDeep(d) : d, status ? { status } : undefined);
  try {
    const body = await req.json();
    lang = body.lang === 'en' ? 'en' : body.lang === 'hant' ? 'hant' : 'zh';

    // 单只咨询模式：问"今天可以卖IBM吗"这种
    if (body.mode === 'single' && typeof body.symbol === 'string' && body.symbol.trim()) {
      const symbol = body.symbol.trim().toUpperCase();
      const side = body.side === 'sell' ? 'sell' : 'buy';
      const name = typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : symbolToName(symbol);
      let judged: Awaited<ReturnType<typeof judgeOne>>;
      try {
        judged = await judgeOne(symbol, lang);
      } catch {
        judged = null;
      }
      if (!judged || !judged.statusKey || judged.simulated) {
        return out(
          { error: tx(lang, `Couldn't find market data for ${symbol} — check the code`, `没找到 ${symbol} 的行情数据，检查下代码对不对`) },
          404,
        );
      }
      return out({
        success: true,
        single: {
          symbol,
          name,
          price: Number(judged.price.toFixed(2)),
          priceLive: judged.priceLive,
          score: Math.round(judged.score),
          status: judged.status,
          side,
          verdict: singleVerdict(side, judged.statusKey, judged.score, lang),
          blurb: findStock(symbol)?.blurb ?? null,
        },
        asOf: new Date().toISOString().slice(0, 10),
      });
    }

    const inputs: AdviseInput[] = Array.isArray(body.symbols) ? body.symbols : [];
    const exclude = new Set(
      (Array.isArray(body.exclude) ? body.exclude : []).map((s: string) =>
        String(s).toUpperCase(),
      ),
    );

    const list = inputs
      .filter((i) => i && typeof i.symbol === 'string' && i.symbol.trim())
      .slice(0, 12)
      .map((i) => ({
        symbol: i.symbol.trim().toUpperCase(),
        name: typeof i.name === 'string' && i.name.trim() ? i.name.trim() : i.symbol.trim().toUpperCase(),
      }));

    if (list.length === 0) {
      return out({ error: tx(lang, 'No stocks to evaluate', '没有可评估的股票') }, 400);
    }

    const judged = await Promise.all(
      list.map(async ({ symbol, name }) => {
        try {
          const { series } = await getFullSeries(symbol);
          const closes = series.map((p) => p.close);
          if (closes.length === 0) return { symbol, name, ok: false as const };
          const j = buildJudgment(closes, lang);
          const { price, priceLive } = await priceForDisplay(symbol, series);
          return {
            symbol,
            name,
            ok: true as const,
            price,
            priceLive,
            score: j.score,
            statusKey: j.statusKey,
            status: j.status,
            hot: j.thresholds.hot,
            held: exclude.has(symbol),
          };
        } catch {
          return { symbol, name, ok: false as const };
        }
      }),
    );

    const okList = judged.filter((r) => r.ok) as Array<
      Extract<(typeof judged)[number], { ok: true }>
    >;

    // 已持有的不推荐"买新的"，单独列出
    const held = okList.filter((r) => r.held);
    const fresh = okList.filter((r) => !r.held);

    const excluded = fresh
      .filter((r) => !r.statusKey || EXCLUDED.has(r.statusKey))
      .map((r) => ({
        symbol: r.symbol,
        name: r.name,
        price: Number(r.price.toFixed(2)),
        priceLive: r.priceLive,
        score: Math.round(r.score),
        status: r.status,
        reason: r.statusKey ? excludedReason(r.statusKey, r.score, lang) : tx(lang, 'Not enough data to judge.', '数据不足，无法判断。'),
        blurb: findStock(r.symbol)?.blurb ?? null,
      }));

    const candidates = fresh
      .filter((r) => r.statusKey && !EXCLUDED.has(r.statusKey))
      .sort((a, b) => {
        const ra = RANK[a.statusKey as string] ?? 9;
        const rb = RANK[b.statusKey as string] ?? 9;
        if (ra !== rb) return ra - rb;
        return a.score - b.score; // 同状态下分数越低离过热越远
      })
      .slice(0, 3)
      .map((r) => ({
        symbol: r.symbol,
        name: r.name,
        price: Number(r.price.toFixed(2)),
        priceLive: r.priceLive,
        score: Math.round(r.score),
        status: r.status,
        reason: candidateReason(r.statusKey as StatusKey, r.score, r.hot, lang),
        blurb: findStock(r.symbol)?.blurb ?? null,
      }));

    return out({
      success: true,
      candidates,
      excluded,
      held: held.map((r) => ({ symbol: r.symbol, name: r.name })),
      asOf: new Date().toISOString().slice(0, 10),
    });
  } catch (error: any) {
    console.error('advise 失败:', error);
    return out({ error: tx(lang, 'Rhythm scan failed — try again later', '律动扫描失败，稍后再试') }, 500);
  }
}
