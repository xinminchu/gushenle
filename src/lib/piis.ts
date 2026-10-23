// PIIS 每周解读 · single source of truth.
// 2026-10-23 起改自动（Sam 拍板）：每周一 Mas 按早报流水线生成——先核实每个数字的来源，
// 再浓缩成 5–8 条"一句话"写入本文件最前面（PIIS_WEEKS[0] 即线上显示），旧期保留在数组里。
// Auto since 2026-10-23: Mas drafts each Monday, verifies every figure, prepends the new week.

export interface PiisPoint {
  /** 小标签，如 宏观 / 利率 / 资金流 */
  tag: string;
  tagEn: string;
  zh: string;
  en: string;
}

export interface PiisWeek {
  id: string; // 2026-10-05
  rangeZh: string; // 9/28–10/5
  rangeEn: string;
  formulaZh: string; // 本周一句话公式
  formulaEn: string;
  points: PiisPoint[];
}

export const PIIS_WEEKS: PiisWeek[] = [
  {
    id: '2026-10-19',
    rangeZh: '10/12–10/19',
    rangeEn: '10/12–10/19',
    formulaZh: 'AI 需求仍在加速 ＞ 被通胀与油价顶住的资本成本 + 融资疑虑 + 估值要求',
    formulaEn: 'AI demand still accelerating > cost of capital (held up by inflation and oil) + financing doubts + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: '9 月 CPI 同比 +3.7%、核心环比 +0.3%，PPI 同比 +6.3%（10/14 公布）：这一轮通胀再加速主要是能源——汽油单月 +9.1%，不是需求过热，但足够把联储钉住。',
        en: 'September CPI rose 3.7% YoY with core +0.3% MoM, and PPI hit +6.3% YoY (released Oct 14): this inflation re-acceleration is mostly energy — gasoline +9.1% in a month — not demand overheating, but enough to pin the Fed.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: '10 年期美债收益率在 CPI 后一度冲到 5.33%，随后股市大跌、避险买盘进场，周五收在约 5.10%（一周前 5.24%）。主席 Warsh 不肯给方向，10 月加息押注从 28% 回落到 17%，但 12 月加息仍被市场计入约九成。',
        en: 'The 10Y yield spiked to 5.33% after CPI, then safe-haven buying during the equity selloff pulled it back to ~5.10% by Friday (5.24% a week earlier). Chair Warsh stayed noncommittal: October hike odds fell from 28% to 17%, while a December hike is still priced at roughly 90%.',
      },
      {
        tag: '大盘',
        tagEn: 'Market',
        zh: '全周记分牌：纳指 -4.5%（6 月以来最差一周、四周连涨终结），标普 -1.9%，费半 -11.4%，罗素 2000 -3.0%；道指却 +0.7%。杀的是最贵的名字，不是全面出逃。',
        en: 'The weekly scoreboard: Nasdaq -4.5% (worst week since June, four-week win streak snapped), S&P 500 -1.9%, SOX -11.4%, Russell 2000 -3.0% — while the Dow gained +0.7%. The most expensive names got de-rated; this was not a broad liquidation.',
      },
      {
        tag: '轮动',
        tagEn: 'Rotation',
        zh: '钱从高估值科技撤向防御与价值：必需消费、医疗、公用、能源全周跑赢大盘，VIX 周五升到 20.16。上一期是 selective risk-on，这一期是它的镜像。',
        en: 'Money rotated out of expensive tech into defensives and value: staples, healthcare, utilities and energy all beat the market, and the VIX closed at 20.16 on Friday. Last issue was selective risk-on; this one is its mirror image.',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: '台积电三季报（10/15）：营收 $467 亿、同比 +41%，四季度指引同比约 +58%，2026 资本开支维持 $600–640 亿，CEO 说需求"还没被完全满足"。需求被证伪不了——但费半同一周跌了 11.4%：市场现在计价的约束是钱，不是需求。',
        en: 'TSMC Q3 (Oct 15): revenue $46.7B, +41% YoY; Q4 guidance ~+58% YoY; 2026 capex reaffirmed at $60–64B, with the CEO saying demand is still not fully met. Demand cannot be falsified — yet the SOX fell 11.4% the same week: the constraint being priced now is money, not demand.',
      },
      {
        tag: 'AI 金融',
        tagEn: 'AI Fin',
        zh: '博通 CEO 陈福阳周五警告：资本短缺可能成为 AI 投入的上限，博通与 AMD 当天各跌约 4–5%。接上一期的 vendor financing——"谁出钱"已经从注脚变成市场的主要问题。',
        en: 'Broadcom CEO Hock Tan warned on Friday that a shortage of capital could become a limit on AI spending; Broadcom and AMD each fell ~4–5% that day. Following last issue’s vendor-financing note: "who pays" has moved from footnote to the market’s main question.',
      },
      {
        tag: '能源',
        tagEn: 'Energy',
        zh: 'WTI 全周 +7.7% 收在约 $99，布伦特一度触及 $110：中东与霍尔木兹风险溢价直接写进了 CPI 的汽油项。能源→通胀→收益率→估值，这条链本周完整跑了一遍。',
        en: 'WTI rose 7.7% on the week to ~$99, with Brent briefly touching $110: the Middle East / Hormuz risk premium fed straight into CPI via gasoline. Energy → inflation → yields → valuations — the full chain ran this week.',
      },
    ],
  },
  {
    id: '2026-10-05',
    rangeZh: '9/28–10/5',
    rangeEn: '9/28–10/5',
    formulaZh: 'AI 真实终端现金流 ＞ 资本成本 + 融资风险 + 估值要求',
    formulaEn: 'End-user AI cash flow > cost of capital + financing risk + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: '9 月非农只增 2.9 万、远低预期，但没出现大规模裁员：是 low-hire / low-fire，不是衰退。10 月不加息概率约八成，但别当成转向宽松。',
        en: 'September payrolls added only 29K, far below expectations — but no mass layoffs: this is low-hire / low-fire, not a recession. ~80% odds of no October hike, but that is not a dovish pivot.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: '10 年期美债收益率一度创 2002 年以来最高：Fed 停手不等于长端利率会降，长端看的是赤字、发债和 AI 融资。(对照上面分母条)',
        en: 'The 10Y Treasury yield briefly hit its highest since 2002: a Fed pause does not mean long-end yields fall — the long end answers to deficits, supply and AI financing. (See the denominator strip above.)',
      },
      {
        tag: '资金流',
        tagEn: 'Flows',
        zh: '美股基金连续第二周净流入（约 $206 亿），但钱只买大票：large-cap +$193 亿，板块基金反而流出 $41 亿。不是全面牛市，是 selective risk-on。',
        en: 'US equity funds saw net inflows for a second week (~$20.6B), but money only bought large caps: +$19.3B large-cap vs -$4.1B sector funds. Not a broad bull market — selective risk-on.',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: 'Micron 指引大超预期，HBM 出现供给约束、客户开始长期锁定：AI 硬件需求还没放缓。但订单里多少是客户预付款，要看清。',
        en: 'Micron guided well above consensus; HBM faces supply constraints with customers locking in long term: AI hardware demand is not slowing. But check how much of the backlog is customer prepayments.',
      },
      {
        tag: 'AI 金融',
        tagEn: 'AI Fin',
        zh: 'Broadcom 借最高 $420 亿给 Anthropic 租自家参与设计的芯片：订单是真的，但"谁出钱"变了——vendor financing 让需求质量打折，backlog 不能当独立需求看。',
        en: 'Broadcom is lending up to $42B to Anthropic to lease chips it helped design: the orders are real, but "who pays" changed — vendor financing discounts demand quality; backlog is not independent demand.',
      },
      {
        tag: 'AI 应用',
        tagEn: 'AI Apps',
        zh: 'Accenture 财报后大涨约 20%：企业花钱请人落地 AI，"AI 消灭咨询公司"的叙事至少目前不成立。',
        en: 'Accenture jumped ~20% post-earnings: enterprises are paying for AI deployment help — the "AI kills consulting" narrative does not hold, at least for now.',
      },
      {
        tag: '消费',
        tagEn: 'Consumer',
        zh: 'Nike 销售不及预期继续裁员，Carnival 却上调全年指引：宏观消费数据强，不等于每个品牌都强，看个股别看平均数。',
        en: 'Nike missed sales and keeps cutting jobs while Carnival raised full-year guidance: strong aggregate spending does not mean every brand is strong — look at companies, not averages.',
      },
    ],
  },
];

export const latestPiisWeek = (): PiisWeek => PIIS_WEEKS[0];

/* ---------------- 事件归因（大跌/大涨日一句话） ----------------
   Sam 手写：当市场出现值得解释的事件（大跌/大涨/异动）时，在这里填一条，
   资讯页会自动置顶显示；无事件时把 active 设为 false，组件自动隐藏。
   写法要求：只讲 driver（为什么发生），不预测、不给操作建议。 */

export interface MarketEventNote {
  id: string; // 2026-10-15
  dateZh: string; // 10/15
  dateEn: string; // Oct 15
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  active: boolean;
}

export const MARKET_EVENT: MarketEventNote = {
  id: '2026-10-15',
  dateZh: '10/15',
  dateEn: 'Oct 15',
  active: false, // 2026-10-23 已过期关停：挂了 8 天仍自称「今日」；且组件已加 2 天自动过期，active 忘关也不会再陈列
  titleZh: '今日市场：为什么跌',
  titleEn: 'Today: why the market fell',
  bodyZh:
    '9 月 CPI、PPI 双双超预期，10 月加息押注升温，资金杀高估值：纳指 -1.9%、费半 -4.3%、标普 -1.1%（7 月底以来最大单日跌幅），道指基本持平。这是系统性杀估值，不是你选错了股。',
  bodyEn:
    'September CPI and PPI both ran hot, October hike bets jumped, and money sold expensive valuations: Nasdaq -1.9%, SOX -4.3%, S&P 500 -1.1% (biggest one-day drop since July), Dow flat. This is systematic de-rating — not your stock-picking.',
};
