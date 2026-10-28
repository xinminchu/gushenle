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

/* 第二期（2026-10-22）：Mas 按来源逐条核实后写入。
   数字交叉核对：QQQ 收盘 725.2 / +1.05% 与 50 日均线 726.75 均为 Mas 用站内
   /api/rhythm 日线自行计算（200 日均线因站内日线不足 200 根，本期不写）；
   QQQ 盘前 -1.57% 为站内 Nasdaq 管线 8:26 ET 实时价；VIX 10-21 收 16.68
   （Swingfolio / portfolio-terminal / ad-hoc-news 三源一致）；期货数字
   regardsofwallstreet 与 Investopedia 口径一致（ES -1.0% / NQ -1.7% /
   YM -0.54%，约 7:50 ET，延迟约 10 分钟）；财报数字来自 teslabriefing
   拆解（TSLA）与 Zacks（META）/ Investopedia（LRCX）。 */
const BATCH_2026_10_22: MorningBriefing = {
  date: '2026-10-22',
  overnight: [
    {
      text: '特斯拉 10-21 盘后发 Q3 财报：经营利润同比降 56% 至 7.18 亿美元，CFO 将全年资本支出指引从 250 亿美元以上下调至约 200 亿美元；股价收盘 386.47 美元（+3.4%），盘后跌约 3%。',
      source: 'teslabriefing 财报拆解 / 路透',
      url: 'https://teslabriefing.com/en/earnings/2026-q3',
    },
    {
      text: 'Meta 盘后发 Q3 财报：营收 646 亿美元（同比 +26%，超预期）、调整后 EPS 7.40 美元（预期 6.52 美元），GAAP EPS 3.83 美元（含约 99 亿美元青少年心理健康诉讼和解拨备）；Q4 营收指引 730–760 亿美元（中点超预期），盘前跌约 1.9%。',
      source: 'Zacks / Yahoo Finance',
      url: 'https://www.zacks.com/stock/news/3012188/meta-platforms-meta-tops-q3-earnings-and-revenue-estimates',
    },
    {
      text: '芯片设备商 Lam Research 因展望不及预期、盘前跌约 7%，半导体板块承压（SOXX 跌超 3%）。',
      source: 'Investopedia 盘前',
      url: 'https://www.investopedia.com/5-things-to-know-before-the-stock-market-opens-on-thursday-october-22-2026-12187570',
    },
    {
      text: '原油走高：Brent 约 112 美元、WTI 约 99.5 美元（均涨约 2%），伊朗紧张推升油价。',
      source: 'Stocktwits / Investopedia',
      url: 'https://stocktwits.com/news-articles/markets/equity/nasdaq-futures-slide-premarket-as-ai-spending-worries-resurface-oil-tops-112-on-iran-tensions-supply-concerns/cZxw43bRBwp',
    },
  ],
  premarket: [
    {
      text: '股指期货盘前（约 7:50 ET，延迟约 10 分钟）：ES 约 -1.0%（~7,724 点）、NQ 约 -1.7%（~29,511 点）、YM 约 -0.54%（~52,770 点）。',
      source: 'regardsofwallstreet / Investopedia',
      url: 'https://www.regardsofwallstreet.com/premarket',
    },
    {
      text: 'QQQ 盘前跌约 1.6%（站内 8:26 ET 盘前价 713.79 美元；上一交易日收 725.2 美元，+1.05%）。',
      source: '站内 /api/rhythm（Nasdaq 管线）',
    },
    {
      text: '比特币约 81,600 美元（-2%，昨日高点 84,800 美元），COIN、MSTR 盘前跟随走弱。',
      source: 'Investopedia 盘前',
    },
  ],
  calendar: [
    {
      text: '今日（美东）：8:30 初请失业金（预期 20 万、前值 19.9 万），10:00 9 月领先指标，11:00 堪萨斯城联储 10 月制造业调查；FOMC 会前缄默期，今日无官员讲话安排。',
      source: 'TheStreet Pro / CAMS 晨报',
      url: 'https://pro.thestreet.com/stock-market-today',
    },
    {
      text: '今日财报：PG、UNP、WDC、BX、LMT、VLO、NEM、CMCSA、HON 等；NBIS（持仓）出现在 TheStreet 10-22 财报名单中，发布时间点待公司 IR 确认。',
      source: 'TheStreet Pro',
      url: 'https://pro.thestreet.com/earnings/2026-10-22',
    },
  ],
  sentiment: [
    {
      text: 'VIX 10-21 收盘 16.68（-3.64%）；今晨盘前指示约 18.2–18.4（+9–10%）。',
      source: 'Swingfolio / portfolio-terminal（市场口径）',
    },
    {
      text: 'QQQ 10-21 收 725.2 美元（+1.05%），低于 50 日均线 726.75 美元约 0.2%（站内日线计算，均线值近似）。',
      source: '站内 /api/rhythm',
    },
    {
      text: '10 年期美债收益率约 5.05–5.15%。',
      source: 'Investopedia 盘前',
    },
  ],
};

const BATCH_2026_10_23: MorningBriefing = {
  date: '2026-10-23',
  overnight: [
    {
      text: '特斯拉 Q3 财报：营收 280.5 亿美元（超预期的 279 亿）、调整后 EPS 0.48 美元（预期 0.43 美元），但将 2026 年资本支出指引从 250 亿美元以上下调至约 200 亿美元；股价收盘 374.58 美元（-3.08%）。',
      source: 'Reuters / TipRanks / Motley Fool',
      url: 'https://www.reuters.com/business/nasdaq-futures-drop-over-1-ai-worries-resurface-oil-climbs-2026-10-22/',
    },
    {
      text: 'Meta Q3 财报：营收 646 亿美元（超预期的 633.7 亿）、GAAP EPS 3.83 美元（预期 6.54 美元，未达预期主因约 99 亿美元青少年心理健康诉讼和解；调整后 7.40 美元）；同时宣布 2 拆 1 并发行无投票权 C 类股以资助 AI 投入；盘后跌约 1.9%。',
      source: 'TipRanks / Reuters / SummaMoney',
      url: 'https://www.tipranks.com/news/why-is-the-stock-market-down-today-10-22-26',
    },
    {
      text: '原油走高：Brent 涨约 3% 至约 112 美元（近五个月高点），胡塞武装袭击沙特油田；特朗普称中期选举（11/3）前暂不对伊朗动武。',
      source: 'Reuters / TipRanks',
      url: 'https://www.reuters.com/business/nasdaq-futures-drop-over-1-ai-worries-resurface-oil-climbs-2026-10-22/',
    },
    {
      text: '美国上周初请失业金降至 19.4 万（预期 20 万），处于历史低位，就业市场未现警讯。',
      source: 'CoinDesk 市场直播 10-22',
      url: 'https://www.coindesk.com/business/2026/10/22/live-updates-bitcoin-s-round-trip-to-usd85-000-burns-traders-on-both-sides?post-id=9074d3220a68',
    },
  ],
  premarket: [
    {
      text: '股指期货盘前（8:28 ET，延迟 10 分钟）：ES -0.34%（约 7,678 点）、NQ -0.18%（约 29,090 点）、YM -0.75%（约 52,669 点）。',
      source: 'regardsofwallstreet',
      url: 'https://www.regardsofwallstreet.com/premarket',
    },
    {
      text: 'QQQ 盘前约 703.6 美元（-0.12%）；自选与持仓盘前均窄幅波动（-0.5% 至 +0.5%），无突出异动。',
      source: '站内 /api/rhythm（Nasdaq 管线，8:23–8:28 ET）',
    },
  ],
  calendar: [
    {
      text: '今日（美东）：8:30 初请失业金（上周 19.4 万，预期 20 万）；今日无其他重要宏观数据安排。',
      source: 'CoinDesk 市场直播 / RapidTradeView 日历',
    },
    {
      text: '今日财报（盘前）：美国运通 AXP、SLB；NBIS（持仓）仍出现在第三方日历的"日期未确认"名单，发布时间点待公司 IR 确认。',
      source: 'RapidTradeView 10-19–23 财报日历',
      url: 'https://www.rapidtradeview.trade/earnings/this-week',
    },
  ],
  sentiment: [
    {
      text: 'VIX 10-22 收盘约 19.03；今晨盘前指示约 19.83（+4.2%，10 分钟延迟）。',
      source: 'regardsofwallstreet',
      url: 'https://www.regardsofwallstreet.com/premarket',
    },
    {
      text: 'QQQ 10-22 收 704.47 美元（-2.86%），站内日线 50 日均线 726.37 美元：收盘价低于 50 日线约 3.0%，已连续 5 个交易日收在 50 日线之下（上次收在之上是 10-15）。',
      source: '站内 /api/rhythm',
    },
    {
      text: '10 年期美债收益率约 4.95%（盘前指示，10 分钟延迟）。',
      source: 'regardsofwallstreet',
      url: 'https://www.regardsofwallstreet.com/premarket',
    },
  ],
};

const BATCH_2026_10_26: MorningBriefing = {
  date: '2026-10-26',
  overnight: [
    {
      text: '原油回落：WTI 跌约 2% 至约 101 美元/桶，上周五因中东局势大涨后回吐；胡塞武装周末继续袭击沙特利雅得机场与石油设施。',
      source: 'Reuters / TipRanks / Investopedia',
      url: 'https://wncy.com/2026/10/26/us-stock-futures-edge-up-as-oil-falls-heading-into-earnings-barrage/',
    },
    {
      text: '马斯克周日发文称，缺乏 AI 数据中心以外可观收入的公司已基本借不到钱，并预言算力租赁行业将整合；CoreWeave 与 Nebius 盘前跌约 3%，持仓 IREN 跌 2.6%。',
      source: 'Reuters',
      url: 'https://wncy.com/2026/10/26/us-stock-futures-edge-up-as-oil-falls-heading-into-earnings-barrage/',
    },
    {
      text: '上周五三大指数收跌（标普 -0.52%、纳指 -0.21%、道指 -1.24%）；全周标普跌 0.47%、纳指跌 0.71%、道指涨 0.41%。',
      source: 'eOption / TipRanks',
      url: 'https://www.eoption.com/morning-preview-october-26-2026/',
    },
  ],
  premarket: [
    {
      text: '股指期货盘前（约 05:19 ET）：道指期货 +0.49%（+257 点）、标普 +0.30%（+23.25 点）、纳指 +0.25%（+73 点）。',
      source: 'Reuters',
      url: 'https://wncy.com/2026/10/26/us-stock-futures-edge-up-as-oil-falls-heading-into-earnings-barrage/',
    },
    {
      text: 'QQQ 盘前约 710 美元（+0.8%）；特斯拉盘前 381.26 美元（+2.43%）、英伟达 213.65 美元（+1.22%），持仓 IREN 盘前 24.45 美元（-1.83%）。',
      source: '站内 /api/rhythm（Nasdaq 管线，8:26–8:28 ET）',
    },
  ],
  calendar: [
    {
      text: '今日（美东）：8:30 芝加哥联储全国活动指数（9 月）、10:30 达拉斯联储制造业调查（10 月）、13:00 财政部拍卖 690 亿美元 2 年期国债；今日无重磅宏观数据。',
      source: 'WSJ / eOption',
      url: 'https://www.eoption.com/morning-preview-october-26-2026/',
    },
    {
      text: '今日财报：盘前 Verizon（已上调全年业绩指引）；盘后 Cadence Design Systems、Nucor、Whirlpool、Welltower；自选股微软的财报在周三盘后。',
      source: 'WSJ / Investopedia',
      url: 'https://www.investopedia.com/5-things-to-know-before-the-stock-market-opens-on-monday-october-25-2026-12193684',
    },
  ],
  sentiment: [
    {
      text: 'VIX 上一交易日收盘 19（口径：FRED VIXCLS，数据日期 2026-10-22）。',
      source: '站内 /api/macro',
    },
    {
      text: 'QQQ 上一交易日（2026-10-23）收 704.4 美元（-0.01%）；收盘价低于 50 日线（725.81 美元）约 3.0%，已连续 6 个交易日收在 50 日线之下（上次收在之上是 10-15）；仍站上 200 日线（677.3 美元）。',
      source: '站内 /api/rhythm',
    },
    {
      text: '10 年期美债收益率约 5.01%（盘前基本持平）。',
      source: 'Investopedia',
      url: 'https://www.investopedia.com/5-things-to-know-before-the-stock-market-opens-on-monday-october-25-2026-12193684',
    },
  ],
};

const BATCH_2026_10_27: MorningBriefing = {
  date: '2026-10-27',
  overnight: [
    {
      text: 'Anthropic 公开递交 IPO 申请（S-1），披露上半年收入 162.9 亿美元；受此带动，周一标普涨 0.7% 至 7676.77 点、纳指涨 0.8% 至 26169.38 点、道指涨 0.3% 至 52361.58 点。',
      source: 'Zacks / FinancialAdvsr',
      url: 'https://www.zacks.com/stock/news/3015467/stock-market-news-for-oct-27-2026',
    },
    {
      text: '英伟达拟向 Meta 增资 30 亿美元；Meta 将史上最大规模股权融资增至 975 亿美元，用于 AI 扩张。',
      source: 'Investopedia / Reuters',
      url: 'https://www.investopedia.com/5-things-to-know-before-the-stock-market-opens-on-tuesday-october-27-2026-12195919',
    },
    {
      text: '比特币跌破 8 万美元，现约 79500 美元。',
      source: 'TradingKey / Stockopedia',
      url: 'https://www.stockopedia.com/content/daily-stock-market-report-tue-27th-oct-2026-agenda-1059687/',
    },
  ],
  premarket: [
    {
      text: '股指期货盘前（约 08:00 ET）：道指期货 +0.2%、标普 +0.2%、纳指 +0.4%。',
      source: 'Investopedia / TradingKey',
      url: 'https://www.investopedia.com/5-things-to-know-before-the-stock-market-opens-on-tuesday-october-27-2026-12195919',
    },
    {
      text: 'QQQ 盘前 716.19 美元（+0.56%）；持仓股 NBIS 盘前 159.40 美元（+4.00%）、IREN 25.98 美元（+2.17%），特斯拉 395.85 美元（+1.08%）、英伟达 217.86 美元（+0.83%）；微软 529.51 美元（-0.58%）、苹果 342.74 美元（-0.34%）。',
      source: '站内 /api/rhythm（Nasdaq 管线，8:21–8:28 ET）',
    },
  ],
  calendar: [
    {
      text: '今日（美东）：8:30 9 月耐用品订单、10:00 10 月消费者信心指数与 9 月新屋销售；美联储为期两天议息会议今日开始，利率决定明日周三 14:00 ET 公布，普遍预期维持 3.75%–4.00% 不变。',
      source: 'TradingKey / FinancialAdvsr',
      url: 'https://www.tradingkey.com/analysis/stocks/us-stocks/262242150-us-ko-meta-spacex-nvda-intc-tradingkey',
    },
    {
      text: '今日财报：盘前可口可乐、波音、PayPal、UPS；盘后 Visa、Robinhood、Seagate、NXP；自选股微软与 Alphabet 的财报在周三盘后，亚马逊在周四。',
      source: 'TradingKey / Investopedia',
      url: 'https://www.tradingkey.com/analysis/stocks/us-stocks/262242150-us-ko-meta-spacex-nvda-intc-tradingkey',
    },
  ],
  sentiment: [
    {
      text: 'VIX 周一收盘 18.39，下跌 5.5%。',
      source: 'Zacks',
      url: 'https://www.zacks.com/stock/news/3015467/stock-market-news-for-oct-27-2026',
    },
    {
      text: 'QQQ 上一交易日（2026-10-26）收 712.2 美元（+1.11%）；收盘价低于 50 日线（725.43 美元）约 1.8%，已连续 7 个交易日收在 50 日线之下（上次收在之上是 10-15）；仍站上 200 日线（677.75 美元）。',
      source: '站内 /api/rhythm',
    },
    {
      text: '10 年期美债收益率周一收 5.00%，持平。',
      source: 'FinancialAdvsr（美国财政部数据）',
      url: 'https://www.financialadvsr.com/markets/2026-10-27',
    },
  ],
};

const BATCH_2026_10_28: MorningBriefing = {
  date: '2026-10-28',
  overnight: [
    {
      text: 'SK 海力士三季报超预期：营业利润增 632%、收入增 328%，美光盘前 +4%、SK 海力士美股盘前 +7.8%。',
      source: 'Reuters',
      url: 'https://hot96.com/2026/10/28/nasdaq-futures-rise-as-sk-hynix-boosts-chips-before-fed-decision-earnings/',
    },
    {
      text: '沙特一家炼油厂遇袭后油价走高：布伦特 +1.5% 至 115.57 美元、WTI +1.5% 至 101.37 美元。',
      source: 'TipRanks',
      url: 'https://www.tipranks.com/news/futures-trade-mixed-ahead-of-big-tech-earnings-and-the-feds-rate-decision',
    },
    {
      text: '周二标普 +0.6%、纳指 +1.2%、道指 +0.03%；芯片股连涨三天，Broadcom 宣布银行团提供 630 亿美元融资购芯片租给 Anthropic。',
      source: 'TipRanks',
      url: 'https://www.tipranks.com/news/futures-trade-mixed-ahead-of-big-tech-earnings-and-the-feds-rate-decision',
    },
  ],
  premarket: [
    {
      text: '股指期货盘前（约 05:00 ET）：道指 -0.2%、标普 +0.1%、纳指 +0.4%。',
      source: 'Reuters',
      url: 'https://hot96.com/2026/10/28/nasdaq-futures-rise-as-sk-hynix-boosts-chips-before-fed-decision-earnings/',
    },
    {
      text: 'QQQ 盘前 724 美元（+0.38%）；持仓股 IREN 28.30 美元（+3.13%）、NBIS 175.25 美元（+2.80%），英伟达 219.82 美元（+0.82%）、特斯拉 410.30 美元（+0.70%）；Coinbase 157.93 美元（-2.01%）、微软 530.38 美元（-0.12%）、苹果 346.11 美元（-0.29%）。',
      source: '站内 /api/rhythm（Nasdaq 管线，8:26–8:30 ET）',
    },
  ],
  calendar: [
    {
      text: '今日（美东）：美联储为期两天议息会议今日结束，利率决定 14:00 ET 公布，普遍预期维持 3.75%–4.00% 不变。',
      source: 'TipRanks',
      url: 'https://www.tipranks.com/news/futures-trade-mixed-ahead-of-big-tech-earnings-and-the-feds-rate-decision',
    },
    {
      text: '今日财报：盘后微软与 Alphabet，焦点是云增长与资本开支回报；亚马逊在周四。',
      source: 'Reuters',
      url: 'https://hot96.com/2026/10/28/nasdaq-futures-rise-as-sk-hynix-boosts-chips-before-fed-decision-earnings/',
    },
  ],
  sentiment: [
    {
      text: 'VIX 上一交易日（10-26）收盘 18.39。',
      source: '站内 /api/macro（FRED VIXCLS，数据日期 2026-10-26）',
    },
    {
      text: 'QQQ 上一交易日（2026-10-27）收 721.25 美元（+1.27%）；收盘价低于 50 日线（725.26 美元）约 0.6%，已连续 8 个交易日收在 50 日线之下；仍站上 200 日线（678.23 美元）。',
      source: '站内 /api/rhythm',
    },
  ],
};

/** 最新一期在前；往期只读回看。 */
export const MORNING_BRIEFING_HISTORY: MorningBriefing[] = [
  BATCH_2026_10_28,
  BATCH_2026_10_27,
  BATCH_2026_10_26,
  BATCH_2026_10_22,
  BATCH_2026_10_21,
];

export const latestBriefing = (): MorningBriefing => MORNING_BRIEFING_HISTORY[0];

export const briefingSections = (
  b: MorningBriefing,
): { id: BriefingSectionId; items: BriefingItem[] }[] => [
  { id: 'overnight', items: b.overnight },
  { id: 'premarket', items: b.premarket },
  { id: 'calendar', items: b.calendar },
  { id: 'sentiment', items: b.sentiment },
];
