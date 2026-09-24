import { NextRequest, NextResponse } from 'next/server';
import { buildJudgment, STATUS_LABELS, type StatusKey } from '@/lib/rhythm';
import { getFullSeries } from '@/lib/marketData';
import { symbolToName } from '@/lib/stockAliases';
import { findStock } from '@/lib/stockList';

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
): string {
  const s = Math.round(score);
  switch (statusKey) {
    case 'risingAccel':
      return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，离过热线（${hot} 分）还有距离，现在介入不算追高。`;
    case 'bottomUp':
      return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，下跌动能衰竭，位置不高，适合分批留意。`;
    case 'sideways':
      return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，方向不明但位置适中，不追高也不抄底的心态参与。`;
    case 'oversoldBottom':
      return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，只适合小仓位分批试，跌过头也可能继续跌，别重仓。`;
    case 'hotStrong':
      return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，趋势健康但位置偏高，真要买只适合小仓位分批。`;
    default:
      return `律动 ${s} 分，${STATUS_LABELS[statusKey]}。`;
  }
}

function excludedReason(statusKey: StatusKey, score: number): string {
  const s = Math.round(score);
  if (statusKey === 'overheated') return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，现在买就是追高，已排除。`;
  if (statusKey === 'weakLow') return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，下跌趋势中不接飞刀，已排除。`;
  return `律动 ${s} 分，${STATUS_LABELS[statusKey]}，已排除。`;
}

/**
 * 单只咨询的结论：只引用律动诊断，不预测涨跌。
 * side=buy 回答"这只现在能不能买"，side=sell 回答"这只现在能不能卖"。
 */
function singleVerdict(
  side: 'buy' | 'sell',
  statusKey: StatusKey,
  score: number,
): string {
  const s = Math.round(score);
  const label = STATUS_LABELS[statusKey];
  if (side === 'sell') {
    switch (statusKey) {
      case 'overheated':
        return `律动 ${s} 分，${label}。真想卖，现在卖是止盈不算卖飞；也可以分批卖，别一把清。`;
      case 'hotStrong':
        return `律动 ${s} 分，${label}，趋势还健康。不急用钱可以拿着，设条止盈线；想卖就分批。`;
      case 'risingAccel':
        return `律动 ${s} 分，${label}，涨势刚起来。现在卖可能卖在半山腰，不急的话再拿拿看。`;
      case 'sideways':
        return `律动 ${s} 分，${label}。卖不卖都不算错，主要看你有没有更好的去处。`;
      case 'bottomUp':
        return `律动 ${s} 分，${label}，正在企稳。现在卖容易卖在地板上，建议再等等。`;
      case 'oversoldBottom':
        return `律动 ${s} 分，${label}。现在割肉大概率割在最低点，拦你一下。`;
      case 'weakLow':
        return `律动 ${s} 分，${label}。现在卖是割在下跌途中，除非急用钱，不然等跌不动了再说。`;
    }
  } else {
    switch (statusKey) {
      case 'overheated':
        return `律动 ${s} 分，${label}，现在买就是追高，拦一下。`;
      case 'hotStrong':
        return `律动 ${s} 分，${label}，趋势健康但位置偏高，真想买只适合小仓位分批。`;
      case 'risingAccel':
        return `律动 ${s} 分，${label}，离过热线还有距离，现在买不算追高。`;
      case 'sideways':
        return `律动 ${s} 分，${label}，买了可能磨人，仓位别重。`;
      case 'bottomUp':
        return `律动 ${s} 分，${label}，下跌动能衰竭，想抄底可以小仓位试试。`;
      case 'oversoldBottom':
        return `律动 ${s} 分，${label}。超卖信号历史上不太准，谨慎，真想买也小仓位。`;
      case 'weakLow':
        return `律动 ${s} 分，${label}，别接飞刀，等跌不动了再说。`;
    }
  }
  return `律动 ${s} 分，${label}。`;
}

async function judgeOne(symbol: string) {
  const { series, source } = await getFullSeries(symbol);
  const closes = series.map((p) => p.close);
  if (closes.length === 0) return null;
  const j = buildJudgment(closes);
  return {
    price: closes[closes.length - 1],
    score: j.score,
    statusKey: j.statusKey,
    status: j.status,
    hot: j.thresholds.hot,
    simulated: source === 'simulated',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 单只咨询模式：问"今天可以卖IBM吗"这种
    if (body.mode === 'single' && typeof body.symbol === 'string' && body.symbol.trim()) {
      const symbol = body.symbol.trim().toUpperCase();
      const side = body.side === 'sell' ? 'sell' : 'buy';
      const name = typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : symbolToName(symbol);
      let judged: Awaited<ReturnType<typeof judgeOne>>;
      try {
        judged = await judgeOne(symbol);
      } catch {
        judged = null;
      }
      if (!judged || !judged.statusKey || judged.simulated) {
        return NextResponse.json(
          { error: `没找到 ${symbol} 的行情数据，检查下代码对不对` },
          { status: 404 },
        );
      }
      return NextResponse.json({
        success: true,
        single: {
          symbol,
          name,
          price: Number(judged.price.toFixed(2)),
          score: Math.round(judged.score),
          status: judged.status,
          side,
          verdict: singleVerdict(side, judged.statusKey, judged.score),
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
      return NextResponse.json({ error: '没有可评估的股票' }, { status: 400 });
    }

    const judged = await Promise.all(
      list.map(async ({ symbol, name }) => {
        try {
          const { series } = await getFullSeries(symbol);
          const closes = series.map((p) => p.close);
          if (closes.length === 0) return { symbol, name, ok: false as const };
          const j = buildJudgment(closes);
          return {
            symbol,
            name,
            ok: true as const,
            price: closes[closes.length - 1],
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
        score: Math.round(r.score),
        status: r.status,
        reason: r.statusKey ? excludedReason(r.statusKey, r.score) : '数据不足，无法判断。',
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
        score: Math.round(r.score),
        status: r.status,
        reason: candidateReason(r.statusKey as StatusKey, r.score, r.hot),
        blurb: findStock(r.symbol)?.blurb ?? null,
      }));

    return NextResponse.json({
      success: true,
      candidates,
      excluded,
      held: held.map((r) => ({ symbol: r.symbol, name: r.name })),
      asOf: new Date().toISOString().slice(0, 10),
    });
  } catch (error: any) {
    console.error('advise 失败:', error);
    return NextResponse.json({ error: '律动扫描失败，稍后再试' }, { status: 500 });
  }
}
