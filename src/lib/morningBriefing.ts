/* ---------------- 盘前早报（pre-market morning briefing） ----------------
   固定四栏目（隔夜要闻 / 盘前异动 / 今日日历 / 情绪市况），内容每天只换一批。
   设计纪律（2026-10-19 Sam 拍板，与主播观点同一套人工审核门）：
   - 一句话一条，只摆事实；禁止预测性措辞，禁止任何买卖建议（建仓红线）。
   - 每条注明来源；原因无一手证据时写"原因未确认"，不臆断。
   - 固定免责声明：「公开资讯整理 · 不构成投资建议」。
   - BATCHES 只增不改：历史期数保留，不重写已发布内容。
   内容由每日 ~07:17 CT 的草稿脚本生成初稿（scripts/morning-briefing-draft.mjs），
   Mas 当日上午核实来源后才写入发布；无合格内容时整期跳过，不凑数。 */

export type BriefingSectionId = 'overnight' | 'premarket' | 'calendar' | 'sentiment';

export interface BriefingItem {
  /** 一句话事实（中文） */
  text: string;
  /** 来源名，如 "Reuters" / "美联储官网" */
  source: string;
  /** 原文链接（可选） */
  url?: string;
}

export interface MorningBriefing {
  /** 美东交易日 YYYY-MM-DD */
  date: string;
  overnight: BriefingItem[];
  premarket: BriefingItem[];
  calendar: BriefingItem[];
  sentiment: BriefingItem[];
}

export const BRIEFING_SECTION_META: Record<
  BriefingSectionId,
  { zh: string; en: string; num: string }
> = {
  overnight: { zh: '隔夜要闻', en: 'Overnight Headlines', num: '一' },
  premarket: { zh: '盘前异动', en: 'Pre-Market Movers', num: '二' },
  calendar: { zh: '今日日历', en: "Today's Calendar", num: '三' },
  sentiment: { zh: '情绪市况', en: 'Market State', num: '四' },
};

export const BRIEFING_DISCLAIMER = {
  zh: '公开资讯整理 · 不构成投资建议',
  en: 'Public information compiled — not investment advice',
};

/* 创刊号（2026-10-21）：首期内容由 Mas 按来源逐条核实后写入；
   数字交叉核对：指数收盘（eOption/WXYwaves/Investrade 三源一致）、
   VIX（四源一致 17.31/-6.13%）、QQQ（stockanalysis.com/heygotrade/hey 3 源一致 717.63/-0.10%）、
   期货盘前（TipRanks/StockTi/Investopedia 三源一致）。
   均线值为单源（heygotrade）近似值，已在正文标注。 */
const BATCH_2026_10_21: MorningBriefing = {
  date: '2026-10-21',
  overnight: [
    {
      text: '美股周二（10-20）收盘：道指涨 1.02% 报 52,495.88 点，标普 500 涨 0.28% 报 7,712.57 点并收回 50 日均线，纳指微跌 0.02% 报 26,424.82 点，罗素 2000 涨 1.65% 报 2,773.41 点。',
      source: 'eOption / WXYwaves / Investrade 收盘复盘',
      url: 'https://www.eoption.com/market-review-october-20-2026/',
    },
    {
      text: 'SpaceX 公布 Q3 财报：营收 145.8 亿美元、同比增 161%，净利润 44 亿美元（6 月 IPO 后首次季度盈利）；马斯克确认 SpaceX 与特斯拉已各自成立独立董事特别委员会研究潜在合并，暂无条款、无保证。',
      source: 'TipRanks（转述 Reuters）',
      url: 'https://www.tipranks.com/news/futures-rise-on-latest-corporate-earnings-spacex-pops-on-solid-q3-and-merger-buzz',
    },
    {
      text: '奈飞 Q3 喜忧参半，Q4 营收指引与 2026 年广告收入指引不及预期，盘前跌超 6%；超微电脑（SMCI）将下季度初步营收指引上调至 185–195 亿美元，盘前涨约 12%。',
      source: 'TipRanks / eOption 盘前',
      url: 'https://www.tipranks.com/news/futures-rise-on-latest-corporate-earnings-spacex-pops-on-solid-q3-and-merger-buzz',
    },
    {
      text: '英国 9 月 CPI 年率升至 3.5%（前值 3.1%、预期 3.4%），为近 11 个月最高，11 月英国央行加息预期升温。',
      source: 'Reuters',
      url: 'https://www.tradingview.com/news/dpa_afx:1f516a4483ba1:0-uk-inflation-rises-to-3-5/',
    },
    {
      text: '油价隔夜回升：周二 Brent 收 108.79 美元（-0.7%）、WTI 收 97.82 美元（-0.7%），周三盘前 Brent 反弹至约 109 美元、WTI 逼近 100 美元。',
      source: 'TipRanks / WXYwaves',
    },
  ],
  premarket: [
    {
      text: '股指期货盘前走高（约 8:30 ET）：纳指 100 期货约 +0.62%，标普 500 期货约 +0.24%，道指期货约 +0.19%。',
      source: 'TipRanks 期货早评',
      url: 'https://www.tipranks.com/news/futures-rise-on-latest-corporate-earnings-spacex-pops-on-solid-q3-and-merger-buzz',
    },
    {
      text: '个股盘前：SpaceX（SPCX）涨约 9–10%（Q3 大胜 + 特斯拉合并议题），SMCI 涨约 12%（上调指引），MU 涨约 2–3%，NFLX 跌超 6%（指引失望）。',
      source: 'TipRanks / eOption / AlphaMaxing 盘前扫描',
    },
    {
      text: '特斯拉、Meta、IBM 将于今日盘后发布财报（特斯拉电话会 17:30 ET）。',
      source: 'TipRanks / Pepperstone / EarningsWhispers',
    },
  ],
  calendar: [
    {
      text: '7:00 ET（6:00 CT）：MBA 抵押贷款申请周报（截至 10 月 16 日一周，30 年期利率 7.41%）。',
      source: 'eOption / Deepscope 经济日历',
      url: 'https://www.eoption.com/morning-preview-october-21-2026/',
    },
    {
      text: '10:00 ET（9:00 CT）：BLS 季度平均周薪（Usual Weekly Earnings）。',
      source: 'FRED 发布日历',
    },
    {
      text: '10:30 ET（9:30 CT）：EIA 周度石油库存报告。',
      source: 'eOption / Deepscope 经济日历',
    },
    {
      text: '13:00 ET（12:00 CT）：美国财政部拍卖 130 亿美元 20 年期国债。',
      source: 'eOption 晨间前瞻',
    },
    {
      text: '财报日（盘后）：特斯拉、Meta、IBM；COIN 与 MSTR 定于 10 月 29 日盘后（均为公司官方确认）。',
      source: '公司公告 / worldmarketstats 财报日历',
    },
  ],
  sentiment: [
    {
      text: '上一交易日（10-20）VIX 收盘 17.31（-6.13%）。',
      source: 'FRED VIXCLS 口径（四源一致）',
    },
    {
      text: 'QQQ 10-20 收 717.63 美元（-0.10%），较 50 日均线（约 726.62 美元）低约 1.2%，较 200 日均线（约 675.95 美元）高约 6.2%（均线值为单源近似值）。',
      source: 'stockanalysis.com / heygotrade',
    },
    {
      text: '10 年期美债收益率约 5.12%（10-20 收盘 -3bp）。',
      source: 'WXYwaves / marketbriefer',
    },
  ],
};

/** 最新一期在前；往期只读回看。 */
export const MORNING_BRIEFING_HISTORY: MorningBriefing[] = [BATCH_2026_10_21];

export const latestBriefing = (): MorningBriefing => MORNING_BRIEFING_HISTORY[0];

export const briefingSections = (
  b: MorningBriefing,
): { id: BriefingSectionId; items: BriefingItem[] }[] => [
  { id: 'overnight', items: b.overnight },
  { id: 'premarket', items: b.premarket },
  { id: 'calendar', items: b.calendar },
  { id: 'sentiment', items: b.sentiment },
];
