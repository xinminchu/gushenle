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
    id: '2026-11-23',
    rangeZh: '11/16–11/23',
    rangeEn: '11/16–11/23',
    formulaZh: 'AI 投入的回报证明 ＞ 资本成本 + 融资风险 + 估值要求',
    formulaEn: 'Proof that AI spending pays > cost of capital + financing risk + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: '标普 500 全周 −8.61% 收 6,910.39 点（4 月以来最差一周、较 10 月 6 日纪录高点低 11.6%，进入修正区间），纳指 −10.02% 收 22,617.73 点（2020 年 3 月以来最差一周、年内转负），道指 −8.02%、罗素 2000 −7.48%；标普连跌七个交易日，为 2020 年 2 月以来最长连跌。',
        en: 'The S&P 500 fell 8.61% to 6,910.39 — its worst week since April 2025 and 11.6% below its October 6 record, in correction territory — while the Nasdaq dropped 10.02% to 22,617.73, its worst week since March 2020 and negative for 2026; the Dow lost 8.02% and the Russell 2000 7.48%, and the S&P fell for a seventh straight session, its longest losing run since February 2020.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: '10 年期美债收益率 5.15%→4.92%（−23bp，五个交易日天天跌，4 月以来最大单周跌幅），周内高点为周一的 5.12%——周初承接 10 月 CPI 偏热的定价，随后股市抛售引发避险买盘；10 月 FOMC 纪要显示"几乎所有"官员认为进一步加息可能合适，12 月加息 25bp 的概率由 11 月 13 日的 88.5% 升至约 97%，+50bp 的尾部则由 11.5% 归零，1 月再加 25bp 的概率约 60%。',
        en: 'The 10-year Treasury yield fell from 5.15% to 4.92% (−23bp, down all five sessions, its biggest weekly drop since April), with the week\'s high at 5.12% on Monday — opening on hot October CPI pricing, then pulled down by safe-haven buying as equities sold off; the October FOMC minutes showed "almost all" officials saw further hikes as likely appropriate, December 25bp odds rose from 88.5% (Nov 13) to about 97%, the 50bp tail fell from 11.5% to about zero, and January odds for another 25bp sit near 60%.',
      },
      {
        tag: '大盘',
        tagEn: 'Market',
        zh: 'VIX 由 19.30 升至 35.89（+86%，盘中一度触及 40.03），为 4 月以来最高收盘；标普 500 成分股 471 只下跌、仅 31 只上涨。',
        en: 'The VIX jumped from 19.30 to 35.89 (+86%, touching 40.03 intraday), its highest close since April 2025; 471 of the S&P 500\'s stocks fell and only 31 rose.',
      },
      {
        tag: '轮动',
        tagEn: 'Rotation',
        zh: 'BofA/EPFR 口径：全球股票基金逆势净流入 $666 亿（美股成长型 +$91 亿、2024 年 12 月以来最大单周流入；科技基金 +$54 亿、连续第八周流入），债券基金却净流出 $74 亿（2025 年 4 月以来首次）、新兴市场债 −$75 亿；周五只有必需消费等防御板块收涨（AT&T +2.11%、联合健康 +2.84%、沃尔玛 +1.52%）。',
        en: 'BofA/EPFR counted $66.6B into global equity funds despite the selloff (US growth +$9.1B, the biggest weekly inflow since December 2024; tech +$5.4B, an eighth straight week of inflows), while bond funds lost $7.4B — their first outflow since April 2025 — and emerging-market debt shed $7.5B; on Friday only defensive names rose (AT&T +2.11%, UnitedHealth +2.84%, Walmart +1.52%).',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: '费半 −17.13% 收 8,408.59 点（Nasdaq 官方序列，2001 年 9 月以来最差一周、较 6 月 22 日纪录高点低 42.5%）；英伟达全周 −22.92% 收 $125.53——三季度营收 $115.8B（+103%）、数据中心 $107.6B（+110%）、非 GAAP 每股收益 $2.68（+111%）、四季度指引 $130B 全部超预期仍被抛售，周五单日 −14.01%（路透称 SEC 正审查其会计问题），财报同时披露约 $1,180 亿财务担保。',
        en: 'The SOX fell 17.13% to 8,408.59 (Nasdaq official series) — its worst week since September 2001 and 42.5% below its June 22 record; Nvidia lost 22.92% to $125.53 even though Q3 revenue hit $115.8B (+103%), data-center revenue $107.6B (+110%), non-GAAP EPS $2.68 (+111%) and Q4 guidance came in at $130B — Friday alone it fell 14.01% after Reuters reported the SEC is examining its accounting, and the earnings release disclosed about $118B in financial guarantees.',
      },
      {
        tag: 'AI 金融',
        tagEn: 'AI Finance',
        zh: 'Anthropic 周四上市：发行价 $83、开盘 $111.50、收盘 $97.17（+17%），$810 亿募资规模为有记录以来最大 IPO；周五随大盘回落约 9% 至 $89 附近。',
        en: 'Anthropic listed Thursday at $83, opened at $111.50 and closed at $97.17 (+17%) in an $81B offering, the largest listing on record; it fell about 9% on Friday to around $89.',
      },
      {
        tag: '消费',
        tagEn: 'Consumer',
        zh: '10 月零售销售环比 +0.2% 至 $7,482 亿（人口普查局，符合预期、9 月为 +0.8%，不含汽车 +0.6%），但 10 月 CPI 环比 +0.4%，实际销售大概率下滑；沃尔玛三季度营收 $1,888 亿（+5.2%）、调整后每股收益 $0.65 并上调全年指引，Target 同店销售 +5.6%（五年多来最佳）、销售额 $271 亿（+7.1%）、每股收益 $2.65（预期 $2.07，含 $3.01 亿一次性关税退款、约 +$0.50）。',
        en: 'October retail sales rose 0.2% to $748.2B (Census, in line with consensus after September\'s +0.8%; +0.6% ex-autos), but with October CPI up 0.4% on the month, real sales likely fell; Walmart\'s Q3 revenue grew 5.2% to $188.8B with adjusted EPS of $0.65 and a raised full-year guide, while Target\'s comparable sales rose 5.6% — its best in over five years — on $27.1B of sales (+7.1%) and EPS of $2.65 vs $2.07 expected, including a $301M one-time tariff refund worth about $0.50.',
      },
      {
        tag: '能源',
        tagEn: 'Energy',
        zh: 'WTI 12 月合约收 $83.98（−5.17%）、布伦特 1 月合约 $92.57（−3.41%），连续第三周下跌，驱动是 IEA 的供应过剩展望与霍尔木兹原油运输恢复；周五因霍尔木兹附近油轮起火与感恩节前空头回补反弹；EIA 原油库存一周 +340 万桶至 4.178 亿桶。',
        en: 'WTI\'s December contract settled at $83.98 (−5.17%) and January Brent at $92.57 (−3.41%), a third straight weekly decline on the IEA\'s surplus outlook and recovering Hormuz shipments; Friday bounced on a tanker fire near Hormuz and pre-Thanksgiving short-covering, and EIA crude stocks rose 3.4M barrels to 417.8M.',
      },
    ],
  },
  {
    id: '2026-11-16',
    rangeZh: '11/09–11/16',
    rangeEn: '11/09–11/16',
    formulaZh: '被财报证实的 AI 需求兑现速度 ＞ 通胀重新定价后的资本成本 + 融资风险 + 估值要求',
    formulaEn: 'AI demand payoff, verified by earnings, outrunning its repriced cost of capital + financing risk + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: '10 月 CPI 环比 +0.4%（预期 +0.3%）、核心 +0.3%（连续第三个月），且因 2025 年停摆缺基数、无官方同比；10 月 PPI 环比 +0.3%、同比 +6.5% 为 2022 年 11 月以来最高；申领失业金 200K，连续第九周不高于 20 万——通胀黏、就业紧，两份报告都指向加息而非降息。',
        en: 'October CPI rose 0.4% on the month (0.3% expected) with core up 0.3% for a third straight month, and no official YoY figure exists because the 2025 shutdown left no base; October PPI rose 0.3% MoM and 6.5% YoY, the highest since November 2022; jobless claims held at 200K, a ninth straight week at or below that mark — sticky inflation and a tight labor market, with both reports pointing to hikes, not cuts.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: '10 年期收 5.15%（一周前 4.86%，+29bp，19 个月来最大单周涨幅），盘中高点约 5.17%；2 年期 +37bp 至 4.88%、30 年期 +21bp 至 5.47%；12 月加息 25bp 的概率由 76.3% 升至约 88.5%（11/14 CME 口径），「维持不变」的概率被清零，+50bp 的尾部以 11.5% 进入定价。',
        en: 'The 10-year closed at 5.15% (4.86% a week earlier, +29bp, its biggest weekly jump in 19 months) with an intraday high near 5.17%; the 2-year rose 37bp to 4.88% and the 30-year 21bp to 5.47%; odds of a 25bp December hike climbed from 76.3% to about 88.5% (CME, Nov 14), the "no change" outcome was priced to zero, and a 50bp tail entered at 11.5%.',
      },
      {
        tag: '大盘',
        tagEn: 'Market',
        zh: '标普 +2.51%、纳指 +2.27%、道指 +2.07%、罗素 +1.32%，均为 8 月以来最佳单周、五周来首次上涨；但周五标普 −0.40%、纳指 −0.91%，只有道指独涨——周一的大反弹、周四的换帅、周五的芯片回吐，涨的是反弹，不是趋势确认。',
        en: 'The S&P gained 2.51%, the Nasdaq 2.27%, the Dow 2.07% and the Russell 2000 1.32% — the best week since August and the first gain in five weeks; yet on Friday the S&P fell 0.40% and the Nasdaq 0.91% with only the Dow up — Monday\'s surge, Thursday\'s CEO shock and Friday\'s chip give-back add up to a rebound, not a confirmed trend.',
      },
      {
        tag: '轮动',
        tagEn: 'Rotation',
        zh: '11 只板块基金全周全涨，能源 XLE +5.4% 领涨；LSEG Lipper 口径：全球股票基金净流入 $509.9 亿（9 月 23 日以来最大），欧洲股票基金 +$351.3 亿（2021 年 6 月以来最大），科技基金 +$26.2 亿；债券基金转为净流出、货币市场基金 −$374.8 亿——钱正从债与现金回流股票；VIX 周五收 19.30（FRED/Cboe 序列），较上周五 25.64 大幅回落。',
        en: 'All eleven sector funds rose, with energy (XLE) leading at +5.4%; LSEG Lipper counted $50.99B into global equity funds, the most since September 23, with European equity funds taking $35.13B (most since June 2021) and tech funds $2.62B; bond funds flipped to outflows and money-market funds shed $37.48B — money is rotating out of bonds and cash back into equities, and the VIX closed Friday at 19.30 (FRED/Cboe series), well down from 25.64 a week earlier.',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: '费半全周 +8.05%（周三摸高 10,564 点、周五回落到 10,146 点，Nasdaq 官方序列）；应用材料营收 +53%、非 GAAP 每股收益 +92%，并首判 2027 年晶圆厂设备增长超 30%，思科把超大规模 AI 基础设施收入目标上调到 $90 亿；但 NVDA 全周 −12.75%——硬件需求被证实，龙头的领导力风险被单独定价。',
        en: 'The SOX rose 8.05% (touching 10,564 on Wednesday before easing to 10,146 on Friday, Nasdaq official series); Applied Materials grew revenue 53% with non-GAAP EPS up 92% and called for wafer-fab equipment growth above 30% in 2027, while Cisco raised its hyperscaler AI infrastructure revenue target to $9B; Nvidia still lost 12.75% on the week — hardware demand was verified, and the leader\'s leadership risk was priced separately.',
      },
      {
        tag: 'AI 金融',
        tagEn: 'AI Finance',
        zh: 'CoreWeave 营收 +168% 至 $36.6 亿、在手订单 $1,325 亿，但净亏 $7.09 亿、净利息支出 $8.46 亿、资本开支指引 $370–390 亿；Nebius 营收 +571% 至 $9.81 亿，却把 2026 年营收指引落到区间低端、资本开支上调到约 $270 亿，股价当日 −16.8%——10 年期 5.15% 之下，市场开始向 AI 云要合同兑现与融资可持续性。',
        en: 'CoreWeave grew revenue 168% to $3.66B with a $132.5B backlog, but lost $709M with $846M of net interest expense and a $37–39B capex guide; Nebius grew revenue 571% to $980.8M yet guided 2026 revenue to the low end and capex up to about $27B, and the stock fell 16.8% that day — with the 10-year at 5.15%, the market has started asking AI clouds for contract delivery and financing durability, not just growth.',
      },
      {
        tag: '消费',
        tagEn: 'Consumer',
        zh: '本周无零售销售数据（10 月零售销售 11/17 才公布），消费侧只有间接信号：油价连续第二周下跌给钱包让出空间，但 CPI 环比 +0.4% 与 PPI 同比 6.5% 说明压力在物价端，不在就业端。',
        en: 'There was no retail-sales print this week (October\'s arrives Nov 17), so the consumer read is indirect: a second straight weekly drop in oil freed up some wallet room, but CPI at +0.4% on the month and PPI at +6.5% YoY say the pressure sits in prices, not in jobs.',
      },
      {
        tag: '能源',
        tagEn: 'Energy',
        zh: 'WTI 收 $88.56（全周 −2.50%）、布伦特 1 月合约 $95.84（−2.52%），连续第二周下跌，驱动是美–伊和平提案进展与 IEA 警告四季度重回供应过剩（供应高出需求约 170 万桶/日）；能源股却全周领涨——油价跌、能源股涨，分化本身就是本周轮动的注脚。',
        en: 'WTI settled at $88.56 (−2.50%) and January Brent at $95.84 (−2.52%), a second straight weekly decline, driven by progress on a Qatar-mediated US–Iran proposal and an IEA warning that Q4 flips back to oversupply (supply about 1.7M barrels/day above demand); energy stocks led the week anyway — oil down, energy shares up, and that split is the week\'s rotation in miniature.',
      },
    ],
  },
  {
    id: '2026-11-09',
    rangeZh: '11/02–11/09',
    rangeEn: '11/02–11/09',
    formulaZh: 'AI 需求兑现的速度与广度 ＞ 被大选与油价重塑的资本成本 + 融资风险 + 估值要求',
    formulaEn: 'Verified speed and breadth of AI demand payoff > cost of capital (reshaped by the election and the oil crash) + financing risk + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: '10 月非农 +165K（约为预期的三倍），失业率 4.1%，平均时薪环比 +0.4%、同比 +3.1%；申领失业金 189K 追平 57 年低位，Q3 劳动生产率 +3.6%——增长强、就业紧，而 ISM 服务业价格指数 73.0 显示通胀仍黏。',
        en: 'October payrolls added 165K (about triple the consensus) with unemployment at 4.1% and average hourly pay +0.4% on the month, +3.1% on the year; jobless claims matched a 57-year low at 189K and Q3 productivity rose 3.6% — strong growth and a tight labor market, while the ISM services prices index at 73.0 said inflation is still sticky.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: '10 年期收 4.86%（一周前 4.94%），周内高点在大选日 4.95%、低点周四 4.84%（9 月 9 日以来最低）；12 月加息 25bp 的押注在非农后升到 76.8%；英央行同周加息 25bp 至 4.00%，为 2023 年 8 月以来首次。',
        en: 'The 10-year closed at 4.86% (4.94% a week earlier), peaking at 4.95% on Election Day and dipping to 4.84% on Thursday, its lowest since September 9; odds of a 25bp December hike rose to 76.8% after payrolls, and the Bank of England hiked 25bp to 4.00% the same week, its first increase since August 2023.',
      },
      {
        tag: '大盘',
        tagEn: 'Market',
        zh: '标普 −2.68%、纳指 −3.37%（连续第四周下跌、6 月以来最差单周）、道指 −0.94%、罗素 2000 −2.05%；周四标普 −4.36%、纳指 −5.52% 均为 4 月以来最差单日，一日抹去约 $3 万亿市值；纳指较 10 月纪录高点低 10.9%，进入修正区间。',
        en: 'The S&P 500 fell 2.68% and the Nasdaq 3.37% (a fourth straight weekly loss and the worst week since June), the Dow 0.94% and the Russell 2000 2.05%; Thursday\'s −4.36% and −5.52% drops were the worst single days since April and erased roughly $3 trillion of market value, leaving the Nasdaq 10.9% below its October record — in correction territory.',
      },
      {
        tag: '轮动',
        tagEn: 'Rotation',
        zh: '能源 XLE 约 −11% 为最差板块、科技约 −7%，金融 +1.15% 领涨；LSEG Lipper 口径：全球股票基金净流入 $386.3 亿（连续第七周），但科技基金仅 +$6.24 亿、为三周低点，货币市场基金 +$1,727 亿为 2020 年 4 月以来最大——钱在进场，但不在追 AI。',
        en: 'Energy (XLE) was the worst sector at about −11% and tech fell about 7% while financials led at +1.15%; LSEG Lipper counted $38.63B into global equity funds (a seventh straight week of inflows) but only $623.6M into tech funds, a three-week low, while money-market funds took in $172.7B, the most since April 2020 — money is coming in, just not chasing AI.',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: '费半全周 −12.15%，周四 −12.25% 为 2020 年 3 月以来最差单日；驱动是政治不是需求——民主党横扫中期选举后，市场开始给数据中心建设定监管天花板（高盛估计约 45% 的规划美国算力可能受新当选州长限制）；AMD 财报大超预期（数据中心 +97%、Q4 指引约 $170 亿）本周仍跌约 17%。',
        en: 'The SOX lost 12.15% on the week, with Thursday\'s −12.25% its worst day since March 2020; the driver was politics, not demand — after the Democratic midterm sweep, markets began pricing a regulatory ceiling on data-center builds (Goldman Sachs estimates about 45% of planned US compute capacity could face limits from newly elected governors), and AMD fell about 17% on the week despite a big earnings beat (data-center revenue +97%, Q4 guide about $17B).',
      },
      {
        tag: 'AI 金融',
        tagEn: 'AI Finance',
        zh: '内存涨价开始吃利润：苹果把 12 月季度毛利率指引给到 45%–46% 并归因于内存成本，高通手机芯片收入 −26%、股价周四 −9%；Palantir 收入 +96%，但新签合同总额仅 +6%、剩余履约义务持平，股价照跌——市场开始向 AI 要合同，不只看收入增速。',
        en: 'Memory inflation started eating margins: Apple guided December-quarter gross margin to 45%–46% and blamed memory costs, Qualcomm\'s handset chip revenue fell 26% and the stock dropped 9% on Thursday; Palantir grew revenue 96% but total contract value rose only 6% with remaining performance obligations flat, and the stock still fell — the market has started asking AI for signed contracts, not just growth rates.',
      },
      {
        tag: '消费',
        tagEn: 'Consumer',
        zh: 'iPhone 收入创纪录 $575.8 亿（+17.5%），与高通手机芯片 −26% 形成对照——消费电子的需求还在，但利润正被成本与供应链重新分配；油价全周跌约 13% 给钱包让出空间，时薪同比 +3.1% 与服务价格指数 73.0 仍在拉锯。',
        en: 'iPhone revenue hit a record $57.58B (+17.5%) against Qualcomm\'s 26% drop in handset chips — consumer electronics demand is intact, but costs and the supply chain are re-slicing the profit; oil\'s roughly 13% weekly drop freed up wallet room, even as 3.1% YoY pay growth and a services prices index of 73.0 kept pulling the other way.',
      },
      {
        tag: '能源',
        tagEn: 'Energy',
        zh: 'WTI 收 $90.83（全周 −12.76%）、布伦特 1 月合约 $98.32（−13.32%），为 2020 年 4 月以来最大单周跌幅；驱动是选举结果打开美–伊谈判窗口、战争溢价出清——油价本应松动通胀预期，本周却被 AI 监管担忧与加息押注回升盖过；VIX 周五收 25.64（FRED/Cboe 序列）。',
        en: 'WTI settled at $90.83 (−12.76% on the week) and January Brent at $98.32 (−13.32%), the biggest weekly drop since April 2020, as the election result opened a US–Iran negotiating window and the war premium drained out; cheaper oil should have eased inflation expectations, but this week AI-regulation fears and reviving hike odds drowned it out, and the VIX closed Friday at 25.64 (FRED/Cboe series).',
      },
    ],
  },
  {
    id: '2026-11-02',
    rangeZh: '10/26–11/02',
    rangeEn: '10/26–11/02',
    formulaZh: 'AI 资本开支的回报兑现度 ＞ 被油价与通胀顶住的资本成本 + 融资风险 + 估值要求',
    formulaEn: 'Verified payoff of AI capex > cost of capital (held up by oil and inflation) + financing risk + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: 'Q3 GDP 初值 +3.4% 年化（超预期；消费 +3.8%、设备投资 +20.9% 为 2020Q3 以来最快），9 月 PCE +3.6% 同比、核心 +3.1%——增长强、通胀黏；申领失业金 19.4 万（近 60 年低位），消费者信心 91.7 大超预期的 80.5。',
        en: 'Q3 GDP printed +3.4% annualized (above consensus; consumption +3.8%, equipment investment +20.9%, fastest since 2020Q3) while September PCE ran +3.6% YoY with core at +3.1% — strong growth, sticky inflation; jobless claims fell to 194K (near a 60-year low) and consumer confidence jumped to 91.7 vs 80.5 expected.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: 'FOMC 10–2 鹰派按兵不动（3.75%–4.00%，Cook、Hammack 要求立即加息），经济上调为"strong"，Warsh 拒绝对 12 月给指引并宣布 2027 年起一年一次会议改为战略专场；12 月加息押注 75%–87%，10 年期周三触 5.05% 后回落至 4.94%（一周前 4.99%）。',
        en: 'The FOMC held 3.75%–4.00% in a hawkish 10–2 vote (Cook and Hammack wanted a hike now), upgraded growth to "strong", Warsh gave no December guidance and announced one 2027 meeting becomes strategy-only; December hike odds ran 75%–87% while the 10Y touched 5.05% Wednesday then eased to 4.94% (4.99% a week earlier).',
      },
      {
        tag: '大盘',
        tagEn: 'Market',
        zh: '全周记分牌：标普 −0.57%、纳指 −2.00%（10 月整月 −5.3%，2025 年 3 月以来最差）、道指 −0.85%、罗素 2000 +1.29%、费半 −0.84%；连续三周下跌（3 月以来最长），上周五纳指 −2.86% 为 6 月以来最差单日。',
        en: 'The weekly scoreboard: S&P 500 −0.57%, Nasdaq −2.00% (−5.3% for October, worst month since March 2025), Dow −0.85%, Russell 2000 +1.29%, SOX −0.84%; a third straight weekly decline (longest since March), with Friday’s −2.86% the Nasdaq’s worst day since June.',
      },
      {
        tag: '轮动',
        tagEn: 'Rotation',
        zh: '钱从大票科技流向防御与小票：医疗保健 +3.12% 为本周最佳板块、能源周五 +1.91%、罗素连涨两周，vs 通信服务 −5.53%、科技 −2%；BofA 客户连续第二周净卖出美股（$3.5B，通信服务领衔流出）。',
        en: 'Money rotated from big tech into defensives and small caps: health care +3.12% led the week, energy +1.91% on Friday, Russell up a second straight week — vs communication services −5.53% and tech −2%; BofA clients net-sold US equities a second straight week ($3.5B, led by communication services).',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: '费半全周 −0.84%、周五单日 −7.20%：英特尔 Q4 指引崩塌（营收中点 $15.5B vs 预期 $17.1B），股价 −28.6%（1974 年以来最差单日），AMD −10.9%、台积电 −5.95%；但英特尔数据中心收入 +78%——跌的是 PC 敞口，不是 AI 需求。',
        en: 'The SOX fell −0.84% on the week and −7.20% on Friday: Intel’s Q4 guide collapsed (revenue midpoint $15.5B vs $17.1B expected), the stock −28.6% (worst day since 1974), AMD −10.9%, TSMC −5.95%; yet Intel’s data-center revenue rose 78% — what sold off is PC exposure, not AI demand.',
      },
      {
        tag: 'AI 资本开支',
        tagEn: 'AI Capex',
        zh: '三朵云收入全面加速（Google Cloud +103%、Azure +48%、AWS +39% 为近五年最快）但自由现金流全部转负（Alphabet −$9.1B、Amazon −$33.5B）；五巨头单季 capex 约 $2270 亿（环比 +20%），Alphabet 指引 2027 年 capex 超 $3000 亿——账单先于回报到来。',
        en: 'All three clouds accelerated (Google Cloud +103%, Azure +48%, AWS +39%, fastest in five years) yet all turned free-cash-flow negative (Alphabet −$9.1B, Amazon −$33.5B); the five hyperscalers spent ~$227B in quarterly capex (+20% QoQ) with Alphabet guiding 2027 capex above $300B — the bill arrives before the payoff.',
      },
      {
        tag: '消费',
        tagEn: 'Consumer',
        zh: '消费者信心 91.7 大超预期（80.5），但钱包没跟上：9 月个人收入仅 +0.2%、支出 +0.5%（实际几乎零增长），ECI +0.8% 而实际工资 −0.6%——信心与钱包背离。',
        en: 'Consumer confidence surprised at 91.7 vs 80.5 expected, but wallets did not follow: September personal income rose only 0.2% and spending 0.5% (near-zero in real terms), while the ECI rose 0.8% yet real wages fell 0.6% — confidence and cash diverge.',
      },
      {
        tag: '能源',
        tagEn: 'Energy',
        zh: '布伦特（1 月主力合约）周五收 $113.43、WTI $104.12，10 月分别 +13.6%/+15.2%：美–伊冲突 + 霍尔木兹油轮遇袭的地缘溢价；能源→通胀预期→收益率→估值，这条链本周又跑了一遍。',
        en: 'Brent (January contract) closed Friday at $113.43 and WTI at $104.12, up 13.6%/15.2% in October on US–Iran tensions and the Hormuz tanker attacks; energy → inflation expectations → yields → valuations — the chain ran again this week.',
      },
    ],
  },
  {
    id: '2026-10-26',
    rangeZh: '10/19–10/26',
    rangeEn: '10/19–10/26',
    formulaZh: 'AI 需求仍在加速 ＞ 被油价与通胀顶住的资本成本 + 融资风险 + 估值要求',
    formulaEn: 'AI demand still accelerating > cost of capital (held up by oil and inflation) + financing risk + valuation demands',
    points: [
      {
        tag: '宏观',
        tagEn: 'Macro',
        zh: '住房全线熄火：建商信心指数 29（2012 年 6 月以来最低）、新屋开工 122.1 万（环比 −5.2%）、成屋签约销售环比 −7.3%（有记录以来最低），30 年期按揭 7.40%；但增长数据火热——S&P flash PMI 综合 57.6（服务业 57.9、制造业 56.0），密歇根 1 年通胀预期升至 4.7%。',
        en: 'Housing went cold across the board: builder confidence 29 (lowest since June 2012), housing starts 1.221M (−5.2% MoM), pending home sales −7.3% MoM (lowest on record), 30-year mortgage 7.40%; yet growth data ran hot — S&P flash PMI composite 57.6 (services 57.9, manufacturing 56.0), and Michigan 1-year inflation expectations rose to 4.7%.',
      },
      {
        tag: '利率',
        tagEn: 'Rates',
        zh: '10 年期美债收益率周一冲至 5.14%（法国 OAT 抛售传导，OAT-Bund 利差走阔至约 140–146bp），周四 Meta 财报引发避险买盘、单日跌 16.6bp 至 4.95%，周五收约 4.99%（一周前 5.10%）；三周累计下行 0.289 个百分点。',
        en: 'The 10Y yield spiked to 5.14% on Monday (France OAT selloff spilling over, OAT-Bund spread widening to ~140–146bp), then safe-haven buying after Meta’s results cut it 16.6bp in a day to 4.95% on Thursday; it closed Friday at ~4.99% (5.10% a week earlier), down 0.289 points over three weeks.',
      },
      {
        tag: '大盘',
        tagEn: 'Market',
        zh: '全周记分牌：标普 −0.47%、纳指 −0.71%、道指 +0.41%、罗素 2000 +2.00%、费半 −3.21%；等权重标普 +1.13%，跑赢大盘 1.60 个百分点；周四标普单日 −1.21%，为 7 月以来最差单日。',
        en: 'The weekly scoreboard: S&P 500 −0.47%, Nasdaq −0.71%, Dow +0.41%, Russell 2000 +2.00%, SOX −3.21%; the equal-weight S&P 500 gained +1.13%, beating the index by 1.60 points; Thursday’s −1.21% was the S&P’s worst day since July.',
      },
      {
        tag: '轮动',
        tagEn: 'Rotation',
        zh: '钱没出股市，从大票科技流向小票与价值：罗素 +2.00%、等权重 +1.13%；BofA/EPFR 数据显示当周股票基金净流入 $55.6B，其中科技基金 +$18.8B（7 月以来最大单周流入）——下跌时投资者逢低买入科技；VIX 周五收 19.45。',
        en: 'Money did not leave stocks; it left big tech for small caps and value: Russell +2.00%, equal-weight +1.13%. BofA/EPFR data show $55.6B flowed into equity funds that week, including $18.8B into tech funds (largest weekly tech inflow since July) — investors bought the dip; the VIX closed Friday at 19.45.',
      },
      {
        tag: 'AI 硬件',
        tagEn: 'AI HW',
        zh: '费半全周 −3.21%，周四单日 −6.7%：Lam Research 发布指引警告后领跌，英伟达周四 −4.40%；但 SpaceX 报出上市后首次盈利、SMCI 上调指引后 +9.55%——硬件需求未被证伪，被计价的是钱。',
        en: 'The SOX fell −3.21% on the week and −6.7% on Thursday alone: Lam Research led the drop after a guidance warning and Nvidia fell 4.40% that day; yet SpaceX reported its first profit since listing and SMCI rose 9.55% after raising guidance — hardware demand was not falsified; what got repriced is the money.',
      },
      {
        tag: 'AI 金融',
        tagEn: 'AI Fin',
        zh: 'Meta 三季报：营收 $64.6B（+26%）、单季资本开支 $34.91B、全年指引上调至 $135–145B，自由现金流 −$2.12B（IPO 以来首次为负），并新设 C 类股融资；Oracle 5 年期 CDS 从 9 月底的 237bp 升至 314bp——“谁出钱”已从注脚变成主要问题。',
        en: 'Meta Q3: revenue $64.6B (+26%), quarterly capex $34.91B, full-year guidance raised to $135–145B, free cash flow −$2.12B (first negative quarter since its IPO), plus a new Class C share issue to fund the buildout; Oracle’s 5-year CDS widened from 237bp at end-September to 314bp — “who pays” has moved from footnote to the main question.',
      },
      {
        tag: '消费',
        tagEn: 'Consumer',
        zh: '消费靠就业撑着、靠房子拖着：首次申领失业金 19.4 万（三个月最低，low-hire / low-fire 未变），续领 172.8 万走高；但住房负担能力危机加深——签约销售创纪录低、43% 建商降价（2020 年以来最高）。',
        en: 'Consumption is held up by jobs and dragged by housing: initial jobless claims 194K (a three-month low; low-hire / low-fire unchanged) while continuing claims rose to 1.728M; but the housing affordability crisis deepened — pending sales at a record low and 43% of builders cutting prices (highest since 2020).',
      },
      {
        tag: '能源',
        tagEn: 'Energy',
        zh: '布伦特全周 +6.24% 收 $116.72（4 月以来最高收盘）、WTI +4.29% 收 $103.27：胡塞武装袭击沙特阿美设施与中东局势升级；能源→通胀预期（密歇根 4.7%）→收益率→估值，这条链本周又跑了一遍。',
        en: 'Brent rose 6.24% on the week to $116.72 (highest close since April) and WTI +4.29% to $103.27: Houthi strikes on Aramco facilities and escalating Middle East tensions; energy → inflation expectations (Michigan 4.7%) → yields → valuations — the chain ran again this week.',
      },
    ],
  },
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
