// PIIS 每周解读 · single source of truth.
// 每周 Sam 把 PIIS 周报浓缩成 5–8 条"一句话"，贴在这里即可上线，无需改代码。
// Weekly: distill the PIIS weekly into 5–8 one-liners and paste here.

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
  active: true,
  titleZh: '今日市场：为什么跌',
  titleEn: 'Today: why the market fell',
  bodyZh:
    '9 月 CPI、PPI 双双超预期，10 月加息押注升温，资金杀高估值：纳指 -1.9%、费半 -4.3%、标普 -1.1%（7 月底以来最大单日跌幅），道指基本持平。这是系统性杀估值，不是你选错了股。',
  bodyEn:
    'September CPI and PPI both ran hot, October hike bets jumped, and money sold expensive valuations: Nasdaq -1.9%, SOX -4.3%, S&P 500 -1.1% (biggest one-day drop since July), Dow flat. This is systematic de-rating — not your stock-picking.',
};
