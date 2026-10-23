/* ---------------- 主播观点（streamer views） ----------------
   Mas 分析整理：把博主/自媒体的节目观点结构化为
   博主 · 标的 · 倾向 · 期限 · 理由 · 保留/证伪条件 · 来源。
   设计纪律（2026-10-16 定版）：
   - 倾向只用四档受控词表：看好 / 偏空 / 谨慎 / 保留
   - 每条必须带期限（短期/长期），长短期判断分开看
   - "判断"与"已披露的持仓变化"分开记（kind 区分）
   - 每条注明来源（节目名 + 发布日期 + 原片时间戳）
   - 只呈现分歧与留痕，不做结论、不荐股：
     组件头固定挂"节目观点整理·非本人买卖建议"
   内容为中文（源节目即中文），UI  chrome 走双语。 */

export type ViewStance = 'bullish' | 'bearish' | 'cautious' | 'neutral';
export type ViewHorizon = 'short' | 'long';
export type ViewKind = 'view' | 'position'; // 判断 vs 已披露的持仓变化

export interface StreamerView {
  id: string;
  blogger: string; // 博主
  stance: ViewStance; // 倾向（持仓变化 kind 下取 neutral）
  horizon: ViewHorizon;
  kind: ViewKind;
  headline: string; // 一句话
  reason: string; // 理由一句话
  caveat: string; // 保留 / 证伪条件（无则空字符串）
  source: string; // 节目名
  published: string; // 发布日期，如 10/16
  clip?: string; // 原片时间戳，如 05:48—10:07
  note?: string; // 补充说明，如 "盘中观点，非收盘结论"
}

export interface SymbolViewGroup {
  symbol: string; // CRWV
  label: string; // 中文标签，如 新云算力
  views: StreamerView[];
}

export const STANCE_ZH: Record<ViewStance, string> = {
  bullish: '看好',
  bearish: '偏空',
  cautious: '谨慎',
  neutral: '保留',
};

export const HORIZON_ZH: Record<ViewHorizon, string> = {
  short: '短期',
  long: '长期',
};

const BATCH_2026_10_16: SymbolViewGroup[] = [
  {
    symbol: 'CRWV',
    label: '新云算力',
    views: [
      {
        id: 'crwv-shiye-1',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '反弹之后仍是弱势',
        reason: '15 日指出融资、建设延期与技术破位压力；16 日反弹后仍强调上方压力。',
        caveat: '未改成趋势转多。',
        source: '视野环球财经',
        published: '10/15—16（两期合并）',
        clip: '15日 16:35—18:29；16日 17:29—28:52',
      },
      {
        id: 'crwv-nana-1',
        blogger: 'NaNa说美股',
        stance: 'bearish',
        horizon: 'long',
        kind: 'view',
        headline: '不看好 CRWV 长投',
        reason: '新云租赁商债务重、壁垒弱；相对更认可 NBIS 财务状况。',
        caveat: '短线可有反弹，但不适合长期持有。',
        source: 'NaNa说美股',
        published: '10/16（美东 15 日收盘观点）',
        clip: '07:22—16:53',
      },
      {
        id: 'crwv-selina-1',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'long',
        kind: 'view',
        headline: 'CRWV 风险更高',
        reason: '激进扩张、债务和融资成本让 CRWV 更脆弱；订单规模不能直接等同利润或回款能力。',
        caveat: '行业信贷收紧时也难独善其身。',
        source: 'Selina聊美股',
        published: '10/16',
        clip: '05:00—14:33、14:37—19:23',
      },
      {
        id: 'crwv-talk-1',
        blogger: '投资TALK君',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '新云出现短期底部信号',
        reason: '大幅换手后出现买盘。',
        caveat: '这只是他的判断，并非底部已获确认。',
        source: '投资TALK君',
        published: '10/16',
        clip: '05:48—10:07、14:38—15:30',
      },
      {
        id: 'crwv-mol-pos',
        blogger: 'Money or Life',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：退出 CRWV',
        reason: '',
        caveat: '增持 RKLB 并没有消除延期风险，也不代表已确定短期底部。',
        source: 'Money or Life',
        published: '10/16',
        clip: '10:30—19:12',
      },
    ],
  },
  {
    symbol: 'NBIS',
    label: '新云算力',
    views: [
      {
        id: 'nbis-nana-1',
        blogger: 'NaNa说美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: 'NBIS 相对更健康',
        reason: '相对更认可 NBIS 财务状况。',
        caveat: '纯算力租赁商仍要面对折旧、竞争和融资压力。',
        source: 'NaNa说美股',
        published: '10/16',
        clip: '07:22—16:53',
      },
      {
        id: 'nbis-selina-1',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'long',
        kind: 'view',
        headline: 'NBIS 仅相对稳健',
        reason: '更认可 NBIS 的现金储备和融资结构。',
        caveat: '只是相对稳健，行业信贷收紧时难独善其身。',
        source: 'Selina聊美股',
        published: '10/16',
        clip: '05:00—14:33、14:37—19:23',
      },
      {
        id: 'nbis-talk-1',
        blogger: '投资TALK君',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '短期见底信号',
        reason: '大幅换手后出现买盘。',
        caveat: '并非底部已获确认。',
        source: '投资TALK君',
        published: '10/16',
        clip: '05:48—10:07',
      },
    ],
  },
  {
    symbol: 'LITE',
    label: '光通信',
    views: [
      {
        id: 'lite-kova-1',
        blogger: 'Kova动量交易',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '看好 LITE 基本面',
        reason: '认可光互联需求与 LITE 的技术壁垒。',
        caveat: '市场环境仍弱，业务看好不等于眼下走势已经转强。',
        source: 'Kova动量交易',
        published: '10/15',
        clip: '43:00—54:20',
        note: '盘中观点，非收盘结论',
      },
      {
        id: 'lite-nana-1',
        blogger: 'NaNa说美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '光通信更认可 LITE 基本面',
        reason: 'AI 基建行情尚未见顶。',
        caveat: '个股反弹以守住近期低点为条件。',
        source: 'NaNa说美股',
        published: '10/16',
        clip: '03:31—05:16',
      },
    ],
  },
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'sox-wang-1',
        blogger: '老王不只三分钟',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '反弹不算翻多',
        reason: '均线与缺口压力更重，短期立即反转向上有难度。',
        caveat: '观察条件：先看低位动能指标能否改善，再看均线和缺口修复；不能只凭一天回升认定止跌。',
        source: '老王不只三分钟',
        published: '10/16（仅摘取美股部分）',
        clip: '00:44—05:19（美股章节）',
      },
      {
        id: 'sox-kova-1',
        blogger: 'Kova动量交易',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '半导体等收盘确认',
        reason: '盘中后段看到买盘，提出可能形成短期底部。',
        caveat: '仍要求收盘成交量确认，反复说不宜追空。',
        source: 'Kova动量交易',
        published: '10/15',
        clip: '63:46—74:34',
        note: '盘中观点，非收盘结论',
      },
    ],
  },
  {
    symbol: 'QQQ',
    label: '纳指',
    views: [
      {
        id: 'qqq-wang-1',
        blogger: '老王不只三分钟',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '跌深反弹，趋势没变',
        reason: '触及长期支撑后的回升，短期均线尚未收复。',
        caveat: '长期支撑能否守住仍重要。',
        source: '老王不只三分钟',
        published: '10/16',
        clip: '00:44—05:19（美股章节）',
      },
      {
        id: 'qqq-nana-1',
        blogger: 'NaNa说美股',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '超卖修复，未确认转强',
        reason: '把本轮回升看作超卖修复。',
        caveat: '通胀压力仍在，期权交割后可能再现波动。',
        source: 'NaNa说美股',
        published: '10/16',
        clip: '07:22—16:53',
      },
    ],
  },
  {
    symbol: 'MU',
    label: '美光',
    views: [
      {
        id: 'mu-yg-1',
        blogger: '阳光财经',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '短期有反弹希望',
        reason: '放量回升，有机会出现破底翻；已小额持仓。',
        caveat: '这不是已确认恢复上升趋势。',
        source: '阳光财经',
        published: '10/16',
        clip: '00:00—01:09',
      },
      {
        id: 'mu-yg-2',
        blogger: '阳光财经',
        stance: 'cautious',
        horizon: 'long',
        kind: 'view',
        headline: '长期不想拿',
        reason: '担心扩产、竞争及价格战压低存储利润率。',
        caveat: '不愿超长期持有 MU。',
        source: '阳光财经',
        published: '10/16',
        clip: '08:24—12:50',
      },
    ],
  },
  {
    symbol: 'NVDA',
    label: '英伟达',
    views: [
      {
        id: 'nvda-shiye-1',
        blogger: '视野环球财经',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: 'NVDA 更有余地',
        reason: '比较前瞻盈利与估值后，安全边际优于 AMD。',
        caveat: '不是判断两者短线一定上涨。',
        source: '视野环球财经',
        published: '10/15—16',
        clip: '15日 16:35—18:29；16日 17:29—28:52',
      },
    ],
  },
  {
    symbol: 'RKLB',
    label: '火箭实验室',
    views: [
      {
        id: 'rklb-mol-1',
        blogger: 'Money or Life',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '短期期待下降',
        reason: '中子火箭再次出问题、进度延后。',
        caveat: '长期仍认可卫星系统、电子火箭等现有业务；不能把中子延期等同公司基本面全面失效。',
        source: 'Money or Life',
        published: '10/16',
        clip: '00:00—04:18',
      },
      {
        id: 'rklb-mol-pos',
        blogger: 'Money or Life',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：继续加仓 RKLB',
        reason: '',
        caveat: '增持不消除延期风险。',
        source: 'Money or Life',
        published: '10/16',
        clip: '10:30—19:12',
      },
    ],
  },
  {
    symbol: 'SPX',
    label: '大盘',
    views: [
      {
        id: 'spx-shiye-1',
        blogger: '视野环球财经',
        stance: 'neutral',
        horizon: 'long',
        kind: 'view',
        headline: '未到全面转空',
        reason: '不把回调等同 AI 崩盘。',
        caveat: '要看到盈利预期明显恶化，才会改变长期判断。',
        source: '视野环球财经',
        published: '10/15—16',
      },
      {
        id: 'spx-yg-1',
        blogger: '阳光财经',
        stance: 'neutral',
        horizon: 'short',
        kind: 'view',
        headline: '标普高位震荡',
        reason: '未把亚洲急跌等同美股崩盘；认可 TSM 业绩。',
        caveat: '警惕 CRWV、ORCL 信用风险。',
        source: '阳光财经',
        published: '10/16',
        clip: '08:24—12:50',
      },
    ],
  },
];

export interface DailyBatch {
  date: string; // 2026-10-17
  groups: SymbolViewGroup[];
}

/* ---------------- 10/23 批：半导体杀跌日，油价逻辑 + 台股估值 ----------------
   水位线 2026-10-22；今日 5 个新条目（Kova Substack 全文 + 3 个 YT 新视频），
   7 个观点入库（1 个持仓），2 条丢弃：Kova YT 直播（Kova Lab 平台介绍，
   无具体标的倾向）、Money or Life（"终于看到 CyberCab"为体验内容，
   无法确定倾向/期限）。 */
const BATCH_2026_10_23: SymbolViewGroup[] = [
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'sox-kova-3',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '半导体不是回调而是下跌阶段，继续做空、不抄底',
        reason:
          '他把本周半导体的跳空大跌解读为下跌阶段的确立，而非正常回调；并强调不知道底部在哪里，没有做空能力的读者不要买跌抄底。',
        caveat:
          '三倍杠杆做空有衰减与逼空风险；他给出的转手条件仍是成交量极致放大并出现买方力量之前不动手。',
        source: 'Kova动量交易 Substack《Trading Report 10月23日，现在美股/中国股市中的强势股》',
        published: '10/23（美东 10/22 晚文章）',
        note: '文章链接：https://kovainvest.substack.com/p/trading-report-1023',
      },
      {
        id: 'sox-kova-3-pos',
        blogger: 'Kova动量交易',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：上周起持有 3x 做空半导体',
        reason: '',
        caveat: '杠杆方向产品本身的衰减与反向挤压风险由产品承担，不是"稳赚"承诺。',
        source: 'Kova动量交易 Substack《Trading Report 10月23日》',
        published: '10/23',
      },
      {
        id: 'soxx-shiye-5',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: 'SOXX 成分股全阵亡，后市讲注意事项',
        reason: '他在 10 月 22 日盘后视频中用"全阵亡"形容 SOXX 成分股的普跌，并给出"后面怎么玩"的注意事项。',
        caveat:
          '仅凭标题提炼：具体后市操作思路与反转条件看正片；"全阵亡"是对普跌的描述，不等于个股推荐。',
        source: '视野环球财经',
        published: '10/22（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=4_uytm7I_XQ',
      },
    ],
  },
  {
    symbol: 'SSL',
    label: 'Sasol',
    views: [
      {
        id: 'ssl-kova-1',
        blogger: 'Kova动量交易',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '油价飙升下的能源高弹性强势股',
        reason:
          '布伦特油破 110 美元放大了他的煤制油成本优势：FY2026 EBITDA 同比增约 17%、Secunda 工厂产量创新高、债务下降，股价一年涨超 200%，市场把它当作油价高弹性标的在交易。',
        caveat:
          '逻辑几乎完全绑定油价：地缘缓和、油价回落时弹性同样会反向；长期有环保碳排压力与南非本地政策运营风险。',
        source: 'Kova动量交易 Substack《Trading Report 10月23日，现在美股/中国股市中的强势股》',
        published: '10/23',
        note: '文章链接：https://kovainvest.substack.com/p/trading-report-1023',
      },
    ],
  },
  {
    symbol: 'MRNA',
    label: 'Moderna',
    views: [
      {
        id: 'mrna-kova-1',
        blogger: 'Kova动量交易',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '数据积极但盘中大跌：可能是洗盘，纪律是 10EMA 止损',
        reason:
          'INTerpath-001 三期数据本身积极（复发/死亡风险降约 42%），但被肿瘤网站提前泄密导致盘中剧烈波动；他把这轮走势与 8 月 19 日阳性结果后先砸约 23.5% 再收回走高的剧本对比，认为是同一次洗盘的进阶版。',
        caveat:
          '他强调止损纪律：止损放在 10EMA，被打掉就拿走利润走人；本周末 ESMO 正式演讲有无更多负面细节未知。',
        source: 'Kova动量交易 Substack《Trading Report 10月23日，现在美股/中国股市中的强势股》',
        published: '10/23',
        note: '文章链接：https://kovainvest.substack.com/p/trading-report-1023',
      },
    ],
  },
  {
    symbol: '002242.SZ',
    label: '九阳股份',
    views: [
      {
        id: 'jiuyang-kova-1',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '概念妖股警告：股价与基本面背离',
        reason:
          '近 20 个交易日涨超 100%、多次涨停，但三季报单季净利仅约 21.6 万元、同比大降 75%；公司已多次澄清与华为无战略合作、无资产注入，涨幅几乎完全由"AI/机器人/华为"题材资金接力驱动。',
        caveat:
          '他提醒这是一轮典型题材驱动行情，情绪退潮后调整往往很快；短线交易者盯资金情绪节奏，不看基本面。',
        source: 'Kova动量交易 Substack《Trading Report 10月23日，现在美股/中国股市中的强势股》',
        published: '10/23',
        note: '文章链接：https://kovainvest.substack.com/p/trading-report-1023',
      },
    ],
  },
  {
    symbol: 'AI',
    label: 'AI科技股',
    views: [
      {
        id: 'ai-talkjun-2',
        blogger: '投资TALK君',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '半导体科技股血流成河，AI 泡沫质疑再起',
        reason: '他用"血流成河"形容半导体科技股的杀跌，并把"AI结束了？"抛为节目议题。',
        caveat:
          '仅凭标题提炼："AI结束了"是节目钩子，实际倾向强度与证伪条件看正片；这是杀跌事件驱动的短期判断。',
        source: '投资TALK君',
        published: '10/23（美东 10/22 晚节目）',
        note: '原片：https://www.youtube.com/watch?v=Cr7N8t0x03E',
      },
    ],
  },
  {
    symbol: 'TWSE',
    label: '台北股市',
    views: [
      {
        id: 'twse-laowang-1',
        blogger: '老王不只三分钟',
        stance: 'cautious',
        horizon: 'long',
        kind: 'view',
        headline: '空头修正中，从基本面找估值',
        reason: '他在最新一期【王老先聲】里讨论空头修正阶段如何用估值和基本面选股，节目话题锚定台北股市。',
        caveat:
          '仅凭标题提炼：这是空头修正中的估值方法论讨论，不是方向喊单；具体选股框架看正片。',
        source: '老王不只三分鐘（王老先聲）',
        published: '10/23',
        note: '原片：https://www.youtube.com/watch?v=lEGXaEbUksU',
      },
    ],
  },
];

/* ---------------- 每日更新：观点留痕 ----------------
   STREAMER_VIEW_HISTORY 按日期倒序，最新在前。
   每日 cron 的唯一写操作：在数组最前面插入一个新 DailyBatch。
   只增不改：历史 batch 一旦发布不再修改（留痕回看靠它）。
   新 batch 的 groups 复用上面的 SymbolViewGroup 结构；
   倾向四档词表 + 强制期限标签 + 判断/持仓分开 + 注明来源，
   与首期 batch 同一套纪律。 */
const BATCH_2026_10_17: SymbolViewGroup[] = [
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'sox-kova-2',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '半导体 selloff 已启动，暂不抄底',
        reason:
          '他把 10 月 16 日 QQQ、SOXL 的大跌解读为震荡期结束后的向下突破与抛售启动，而非正常回调。',
        caveat:
          '他给出转手条件：成交量极致放大并看到买方力量进场之前不动手；他本人持有做空仓位，观点与仓位同向。',
        source: 'Kova动量交易 Substack《Trading Report, Oct 16th - 和我一起做空吧》',
        published: '10/16',
        note: '文章链接：https://kovainvest.substack.com/p/trading-report-oct-16th',
      },
      {
        id: 'sox-kova-2-pos',
        blogger: 'Kova动量交易',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：10/13 开 3 倍做空半导体，浮盈约 30%',
        reason: '',
        caveat: '仓位赚钱不等于底部已确认，他的离场看成交量与买盘信号。',
        source: 'Kova动量交易 Substack《Trading Report, Oct 16th》',
        published: '10/16',
      },
    ],
  },
  {
    symbol: 'QQQ',
    label: '纳指',
    views: [
      {
        id: 'qqq-shiye-2',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: 'AI 高增长交易逻辑动摇',
        reason:
          '10 月 16 日纳指重挫后，他把 Anthropic 增长不及预期、IPO 估值下调摆在一起，认为高增长 AI 交易的根基松了。',
        caveat:
          '仅凭标题提炼的盘后复盘信号，具体点位和反转条件要看正片；标题里还提到 TSM 持仓计划更新，但未给出方向，不记入。',
        source: '视野环球财经',
        published: '10/16（盘后复盘）',
      },
    ],
  },
];

const BATCH_2026_10_18: SymbolViewGroup[] = [
  {
    symbol: 'AMD',
    label: '超威半导体',
    views: [
      {
        id: 'amd-selina-1',
        blogger: 'Selina聊美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '财报季回调视为买入机会',
        reason:
          '她把 AMD 列为财报季四只核心跟踪标的之一，围绕 AI GPU 与 CPU 业务的增长潜力、营收弹性与市场预期差做基本面功课，认为回调是分批关注的窗口。',
        caveat:
          '她也提醒：财报超预期不等于股价必涨，关键看实际业绩与预期的差距、管理层指引；主张不追高、不重仓、不杠杆赌财报。',
        source: 'Selina聊美股',
        published: '10/17',
        clip: '03:50—06:50（AMD 章节）',
        note: '原片：https://www.youtube.com/watch?v=D8R6mu58TpE',
      },
    ],
  },
  {
    symbol: 'META',
    label: 'Meta',
    views: [
      {
        id: 'meta-selina-1',
        blogger: 'Selina聊美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '财报季回调视为买入机会',
        reason:
          '她把 Meta 列为财报季四只核心跟踪标的之一，重点看 AI 产品商业化能否打开新的增长空间，以及 AI 与广告业务的协同，认为回调是分批关注的窗口。',
        caveat:
          '她也提醒：财报超预期不等于股价必涨，关键看实际业绩与预期的差距、管理层指引；主张不追高、不重仓、不杠杆赌财报。',
        source: 'Selina聊美股',
        published: '10/17',
        clip: '06:50—09:20（Meta 章节）',
        note: '原片：https://www.youtube.com/watch?v=D8R6mu58TpE',
      },
    ],
  },
  {
    symbol: 'SOFI',
    label: 'SoFi',
    views: [
      {
        id: 'sofi-selina-1',
        blogger: 'Selina聊美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '财报季回调视为买入机会',
        reason:
          '她把 SoFi 列为财报季四只核心跟踪标的之一，看重数字银行的用户增长、交叉销售与长期成长逻辑，认为回调是分批关注的窗口。',
        caveat:
          '她也点出短期利率压力与信贷风险是主要不确定项；且财报超预期不等于股价必涨，主张不追高、不重仓、不杠杆赌财报。',
        source: 'Selina聊美股',
        published: '10/17',
        clip: '09:20—11:15（SoFi 章节）',
        note: '原片：https://www.youtube.com/watch?v=D8R6mu58TpE',
      },
    ],
  },
  {
    symbol: 'AMZN',
    label: '亚马逊',
    views: [
      {
        id: 'amzn-selina-1',
        blogger: 'Selina聊美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '财报季回调视为买入机会',
        reason:
          '她把亚马逊列为财报季四只核心跟踪标的之一，认为 AWS 云业务增速与 AI 基建投入是影响估值的关键变量，回调是分批关注的窗口。',
        caveat:
          '她也提醒：财报超预期不等于股价必涨，关键看实际业绩与预期的差距、管理层指引；主张不追高、不重仓、不杠杆赌财报。',
        source: 'Selina聊美股',
        published: '10/17',
        clip: '11:15—13:02（亚马逊章节）',
        note: '原片：https://www.youtube.com/watch?v=D8R6mu58TpE',
      },
    ],
  },
];

const BATCH_2026_10_20: SymbolViewGroup[] = [
  {
    symbol: 'LITE',
    label: '光通信',
    views: [
      {
        id: 'lite-selina-2',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'long',
        kind: 'view',
        headline: '回调≠见顶，分化才是主线',
        reason:
          '她把光通信板块约 30% 的回调与行业需求拐点分开判断，从产品升级、光连接应用扩张、云厂商资本开支三条线拆解 AI 光通信的需求逻辑；以 LITE、COHR、AAOI、AVGO 为例分析产业链里谁能把收入增长变成利润，点出两类值得盯的方向：新产品放量走在前面的企业，以及手握稀缺光源与核心芯片的供应商。',
        caveat:
          '她提醒价格还受融资压力、远期供给和估值预期的影响，不只由需求决定；成熟模块厂商面临上游成本与下游降价压力，销量涨了利润能不能跟上是关键问题；财报验证看两点：1.6T 收入占比与增速，以及同口径下的毛利率变化。',
        source: 'Selina聊美股',
        published: '10/20（盘前发布）',
        clip: '01:20 暴跌真相拆解；07:05 关键两大方向；15:40 财报季盯紧两个数据',
        note: '原片：https://www.youtube.com/watch?v=7fP-50N4MbA',
      },
    ],
  },
];

const BATCH_2026_10_22: SymbolViewGroup[] = [
  {
    symbol: 'TSLA',
    label: '特斯拉',
    views: [
      {
        id: 'tsla-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '特斯拉财报定调拉胯',
        reason:
          '他在第 1511 期里把特斯拉最新财报的表现称为"拉跨"，并用夜盘走势作为佐证。',
        caveat:
          '仅凭标题提炼：标题是带问号的节目钩子，他本人在节目里的倾向强度与证伪条件未知；这是财报事件驱动的短期判断。',
        source: '投资TALK君（第 1511 期）',
        published: '10/22（美东 10/21 晚节目）',
        note: '原片：https://www.youtube.com/watch?v=Ia7zvaU0MoA',
      },
    ],
  },
];

const BATCH_2026_10_21: SymbolViewGroup[] = [
  {
    symbol: 'SPCX',
    label: '半导体前瞻',
    views: [
      {
        id: 'spcx-shiye-3',
        blogger: '视野环球财经',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: 'SPCX 前瞻大幅提振半导体',
        reason:
          '他在 10 月 20 日盘后复盘里把半导体板块的走强归因于 SPCX 的前瞻事件，认为这是当前板块情绪的主导催化。',
        caveat:
          '仅凭标题提炼，具体催化细节与反转条件要看正片；"提振"是他对事件的解读，不等于个股推荐。',
        source: '视野环球财经',
        published: '10/20（盘后复盘）',
        note: '原片：https://www.youtube.com/watch?v=g7V8AbUkjcs',
      },
      {
        id: 'isrg-shiye-pos',
        blogger: '视野环球财经',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：ISRG 加仓计划更新',
        reason: '',
        caveat:
          '标题只说计划"更新"，没披露具体数量、价位与执行时间，是计划更新不是已成交。',
        source: '视野环球财经',
        published: '10/20（盘后复盘）',
        note: '原片：https://www.youtube.com/watch?v=g7V8AbUkjcs',
      },
      {
        id: 'nflx-shiye-3',
        blogger: '视野环球财经',
        stance: 'neutral',
        horizon: 'short',
        kind: 'view',
        headline: '财报波动季 NFLX 蛰伏等待',
        reason:
          '在 10 月 20 日盘后复盘里，他对 NFLX 的姿态是蛰伏等待、不提前押注。',
        caveat:
          '标题只给出"蛰伏等待"四字，没给方向和触发条件，不构成交易判断。',
        source: '视野环球财经',
        published: '10/20（盘后复盘）',
        note: '原片：https://www.youtube.com/watch?v=g7V8AbUkjcs',
      },
    ],
  },
  {
    symbol: 'NVDA',
    label: '英伟达',
    views: [
      {
        id: 'nvda-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '最强指引，ALL-IN 算力',
        reason:
          '他在第 1510 期里把本轮营收指引定调为"最强指引"，以 1 万亿营收前景为依据，主张全力押注算力链。',
        caveat:
          '"ALL-IN"是节目风格化的情绪表达，不是仓位建议；指引兑现取决于 AI 资本开支能否持续。',
        source: '投资TALK君（第 1510 期）',
        published: '10/20',
        note: '原片：https://www.youtube.com/watch?v=8uh5V2AamAg',
      },
    ],
  },
  {
    symbol: 'QQQ',
    label: '纳指',
    views: [
      {
        id: 'qqq-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '纳指非常悲观（AI 除外）',
        reason:
          '他在第 1509 期里认为除 AI 之外纳指成分股估值偏贵，对纳指短期展望非常悲观。',
        caveat:
          '标题本身把 AI 排除在悲观结论之外；"本周财报焦点"说明这是短期判断，财报落地即重新评估。',
        source: '投资TALK君（第 1509 期）',
        published: '10/18',
        note: '原片：https://www.youtube.com/watch?v=gUkTI-dBJP0',
      },
    ],
  },
  {
    symbol: 'AMZN',
    label: '亚马逊',
    views: [
      {
        id: 'amzn-shiye-4',
        blogger: '视野环球财经',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: 'AMZN 撑起半边天',
        reason:
          '他在 10 月 19 日盘后复盘里认为 AMZN 在盘面走弱时依然强势，是撑住指数的关键力量。',
        caveat:
          '仅凭标题提炼；"撑起半边天"是对当时盘面的描述，未给出持有或买卖的方向建议。',
        source: '视野环球财经',
        published: '10/19（盘后复盘）',
        note: '原片：https://www.youtube.com/watch?v=XMs6mASFtbE',
      },
    ],
  },
];

export const STREAMER_VIEW_HISTORY: DailyBatch[] = [
  { date: '2026-10-23', groups: BATCH_2026_10_23 },
  { date: '2026-10-22', groups: BATCH_2026_10_22 },
  { date: '2026-10-21', groups: BATCH_2026_10_21 },
  { date: '2026-10-20', groups: BATCH_2026_10_20 },
  { date: '2026-10-18', groups: BATCH_2026_10_18 },
  { date: '2026-10-17', groups: BATCH_2026_10_17 },
  { date: '2026-10-16', groups: BATCH_2026_10_16 },
];

export const latestViewBatch = (): DailyBatch => STREAMER_VIEW_HISTORY[0];
