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

/* ---------------- 10/24 批：水位线 2026-10-23；今日 7 个新条目，1 个观点入库 ----------------
   6 条丢弃：Kova Substack 新文为付费墙（仅见一句话预告，正文不可见）；
   阳光财经（标题"下周更劲爆"含糊、无标的/方向，简介仅会员推广）；
   NaNa（"不想再被毒打"为情绪口号，无标的/方向/期限）；
   Selina（Meta 财报标题以问号收尾，阵痛还是泡沫未定，倾向/期限皆无）；
   Money or Life（猎鹰九号拼车发射成本话题，无上市公司标的与倾向）；
   老王（聯一光"跌什麼"提问式短视频，未给方向与期限）。 */
const BATCH_2026_10_24: SymbolViewGroup[] = [
  {
    symbol: 'QQQ',
    label: '纳指',
    views: [
      {
        id: 'qqq-shiye-1',
        blogger: '视野环球财经',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '对冲基金连减，下周盯紧 QQQ',
        reason:
          '他在 10 月 23 日盘后视频里指出对冲基金 8 天里 7 天减仓、整体偏紧，并把下周的观察点放在 QQQ 上；同期还提到 OpenAI 估值下调与 AMZN 停建一座数据中心的消息。',
        caveat:
          '仅凭标题提炼："注意"未明示方向与触发条件，实际倾向强度与操作思路看正片；这是下周视角的短期提醒。',
        source: '视野环球财经',
        published: '10/23（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=b_ZVO8_QfJ0',
      },
    ],
  },
];

/* ---------------- 10/27 批：水位线 2026-10-24；今日 12 个新条目 + 1 条 10/24 午后漏网（Money or Life 特斯拉+SpaceX 合并推演，10/24 07:17 CDT 当期 cron 运行后才发布），2 个观点入库 ----------------
   11 条丢弃：阳光财经（"马斯克警告"无标的/方向/期限）；NaNa（"俩兄弟"所指不明，无标的）；Selina（MU"黄金坑还是十年大顶"问句，未定方向）；Money or Life（"拥抱AI视频"含糊、"算力变现哪家强"提问无倾向、10/24 午后合并推演只做价格推演未给倾向）；老王 5 条（力積電/友達/富喬、季線保衛戰、矽光子買賣、技術分析能否预测、大跌后买什么——全是提问句或方法论，未给方向与期限）。 */
const BATCH_2026_10_27: SymbolViewGroup[] = [
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'soxx-shiye-6',
        blogger: '视野环球财经',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '三个需求利好推动 SOXX 反弹',
        reason:
          '他在 10 月 26 日盘后视频里把 SOXX 的反弹归因于三个需求面的利好，同期还讨论大科技资本支出的四选一与 Anthropic 更新 S-1 文件。',
        caveat:
          '仅凭标题提炼：三条利好的具体内容与反转条件看正片；反弹不等于趋势转多。',
        source: '视野环球财经',
        published: '10/26（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=QHrNWTgD7DA',
      },
    ],
  },
  {
    symbol: 'SPX',
    label: '大盘',
    views: [
      {
        id: 'spx-talkjun-1',
        blogger: '投资TALK君',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '信用风险高企，本周看财报与联储会议',
        reason:
          '他在第 1512 期里把信用风险的水平比作接近战争时期，并把本周的观察点放在财报、联储会议与 CPI 等重磅数据上。',
        caveat:
          '仅凭标题提炼：信用风险是节目议题，实际倾向强度与触发条件看正片；数据落地即重新评估。',
        source: '投资TALK君（第 1512 期）',
        published: '10/25',
        note: '原片：https://www.youtube.com/watch?v=dLmxpu6knQw',
      },
    ],
  },
];

/* ---------------- 10/28 批：水位线 2026-10-27；今日 12 个新条目，2 个观点入库 ----------------
   10 条丢弃：阳光财经（"这只股跌得差不多了"未点名标的）；视野环球财经（GOOG/MSFT/AMZN"多空决战分胜负"未定方向，SOXX"大波动"无方向）；NaNa（"韩力士救我"所指不明）；投资TALK君 1513 期（MSFT 财报重心无方向、HOOD"是不是凉了"为问句）；Money or Life（AI 卧推短视频，无标的）；老王 4 条（"該買了嘛？"、旺宏 300 元、力積電/友達/富喬、季線保衛戰——全是提问句，未给方向与期限）。Kova Substack 无新文（最新仍为 10/23 付费墙预告）。 */
const BATCH_2026_10_28: SymbolViewGroup[] = [
  {
    symbol: 'BE',
    label: '燃料电池',
    views: [
      {
        id: 'be-selina-1',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'long',
        kind: 'view',
        headline: 'AI 缺电风口的历史级业绩，但现金流与客户集中是暗雷',
        reason:
          '她拆解 Bloom Energy 三季报：单季收入 12.4 亿美元、同比增 138%，经营利润超过去年全年，定金翻 8 倍、毛利率逆势提升；公司签下 58 亿美元长期采购合同（含 take-or-pay 条款）并大幅预付供应商锁产能，逻辑是 AI 缺电让燃料电池从"小众清洁能源玩具"变成"能救命的现货"，客户买的是时间。',
        caveat:
          '账面利润亮眼但经营现金流为负、合同资产暴增；69% 收入依赖两家大客户，大客户还通过认股权证分走成长红利；窗口期只有 2–3 年，长期要看燃料电池能否成为分布式能源主流方案。',
        source: 'Selina聊美股',
        published: '10/27',
        clip: '03:20—12:45 AI 缺电逻辑；12:45—22:10 58 亿锁产能；22:10—31:30 两大暗雷；31:30— 投资策略',
        note: '原片：https://www.youtube.com/watch?v=jwQqsQfJeGs',
      },
    ],
  },
  {
    symbol: 'SSE',
    label: 'A股',
    views: [
      {
        id: 'sse-kova-1',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: 'A股还有的跌',
        reason: '他在 10 月 27 日香港直播的标题里直言 A 股还有的跌。',
        caveat:
          '仅凭标题提炼：具体点位与反转条件看正片；这是直播标题给出的短期判断。',
        source: 'Kova动量交易',
        published: '10/27（香港直播）',
        note: '原片：https://www.youtube.com/watch?v=c05BoxZRe6Y',
      },
    ],
  },
];

/* ---------------- 10/30 批：水位线 2026-10-29；今日 9 个新条目，6 个观点入库 ----------------
   3 条丢弃：NaNa 10/29（"全军覆没了"为情绪化标题，无标的/倾向/期限）；老王 3 条（10/30 早盘：台積電/友達/聯電"要賣嗎/怎麼辦"、台光電"怎麼了"、聯電跌停"還有救"——全是提问句，未给方向与期限）。Kova Substack、Money or Life 均无新文（最新仍为 9/30 与 10/28）。 */
const BATCH_2026_10_30: SymbolViewGroup[] = [
  {
    symbol: 'GOOG',
    label: '谷歌',
    views: [
      {
        id: 'goog-sunny-1',
        blogger: '阳光财经',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '盘后仍在爆雷，抄底谷歌还太早',
        reason:
          '他在 10 月 29 日盘后视频的标题里问"谷歌什么时候能抄底"，同时说盘后又有两家公司财报爆雷，意思是跌势还没走完，现在动手抄底还太早。',
        caveat:
          '仅凭标题推断：触发抄底的具体条件与企稳信号看正片；这是盘后事件驱动的短期谨慎。',
        source: '阳光财经',
        published: '10/29（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=wCUn2t-uSNc',
      },
    ],
  },
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'soxx-shiye-7',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '科技股上演跳水锦标赛，半导体多空激战',
        reason:
          '他在 10 月 29 日晚间视频的标题里形容科技股上演"跳水锦标赛"，AMZN、INTC 跟随下跌，QQQ 与 SOXX 的多空博弈正酣，并质疑 MSFT 发债回吐之后是否还行得通。',
        caveat:
          '仅凭标题提炼："跳水锦标赛"为情绪化措辞，多空博弈的结论与反转条件看正片；这是盘后事件驱动的短期偏空。',
        source: '视野环球财经',
        published: '10/29（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=53SJvdzJneM',
      },
    ],
  },
  {
    symbol: '000660.KS',
    label: 'SK海力士',
    views: [
      {
        id: 'skhynix-selina-1',
        blogger: 'Selina聊美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '三季报炸裂：HBM 卖方市场，五年长约锁定产能',
        reason:
          '她拆解 SK 海力士三季报：单季营收 104.6 万亿韩元、同比增 328%，营业利润率近 80%；HBM4 本季批量出货且盈利超预期，客户总需求是实际供应量的两倍多；已签五年长约锁定 2027—2028 年一半以上 HBM 产能——结论是 AI 彻底改变了存储的需求结构与定价曲线，不是普通周期顶。',
        caveat:
          '仅凭简介提炼：股价已先涨一段、"见顶了吗"的反方讨论与估值风险看正片；这是基本面驱动的结构性长期看多。',
        source: 'Selina聊美股',
        published: '10/29',
        note: '原片：https://www.youtube.com/watch?v=R2iZcXJmksU',
      },
    ],
  },
  {
    symbol: 'INTC',
    label: '英特尔',
    views: [
      {
        id: 'intc-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '财报暴雷',
        reason: '他在第 1514 期节目标题里用"崩了"形容英特尔财报暴雷。',
        caveat:
          '仅凭标题提炼：暴雷的实质内容与企稳条件看正片；这是财报事件驱动的短期偏空。',
        source: '投资TALK君（第 1514 期）',
        published: '10/30',
        note: '原片：https://www.youtube.com/watch?v=lLNUraSFK90',
      },
    ],
  },
  {
    symbol: 'AMZN',
    label: '亚马逊',
    views: [
      {
        id: 'amzn-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '给出超强指引',
        reason:
          '他在第 1514 期节目标题里说亚马逊给出超强指引，与英特尔的财报暴雷形成对照。',
        caveat:
          '仅凭标题提炼：指引的具体内容与走弱条件看正片；这是财报事件驱动的短期看好。',
        source: '投资TALK君（第 1514 期）',
        published: '10/30',
        note: '原片：https://www.youtube.com/watch?v=lLNUraSFK90',
      },
    ],
  },
  {
    symbol: 'SPX',
    label: '大盘',
    views: [
      {
        id: 'spx-kova-1',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '三倍做空大盘姿态不变',
        reason:
          '他在 10 月 29 日中国直播的标题里继续摆出三倍做空大盘的姿态，同场还提到 IOVA 单日跌 30%。',
        caveat:
          '仅凭标题提炼：杠杆做空的期限与反转条件看正片；这是直播标题给出的短期判断。',
        source: 'Kova动量交易',
        published: '10/29（中国直播）',
        note: '原片：https://www.youtube.com/watch?v=pt7uZ_FmeTw',
      },
    ],
  },
];

/* ---------------- 10/29 批：水位线 2026-10-28；今日 7 个新条目，4 个观点入库 ----------------
   5 条丢弃：阳光财经 10/28 盘后（"沃什：少开点会吧"无标的、无期限）；NaNa 10/28（"糟老头子坏的很"无标的）；Money or Life 10/28 晨（Rocket Lab"投资者必看"只做科普未给倾向；是 10/28 07:17 当期 cron 运行后 7 分钟发布的漏网，今次补核后仍丢弃）；老王 2 条（"法說前能買嗎？"、"台光電還能買？"均为提问句，未给方向与期限）。Kova Substack、Selina、Kova YouTube 均无新文。 */
const BATCH_2026_10_29: SymbolViewGroup[] = [
  {
    symbol: 'MSFT',
    label: '微软',
    views: [
      {
        id: 'msft-shiye-1',
        blogger: '视野环球财经',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: 'AI 货币化成功上岸',
        reason:
          '他在 10 月 28 日盘后视频的标题里说微软 AI 货币化已经成功上岸，与谷歌的狼狈形成对比，短期看强。',
        caveat:
          '仅凭标题提炼："上岸"的实质细节与走弱条件看正片；这是财报事件驱动的短期判断。',
        source: '视野环球财经',
        published: '10/28（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=g3qLtJPUAxU',
      },
      {
        id: 'msft-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: '微软爆发，冰火两重天的强端',
        reason:
          '他在 10 月 29 日节目标题里把微软形容为"爆发"的一端，与谷歌的大跌形成冰火对照。',
        caveat:
          '仅凭标题提炼："爆发"的后续空间与反转条件看正片；同期还提到美联储大变动，宏观变量另看。',
        source: '投资TALK君',
        published: '10/29',
        note: '原片：https://www.youtube.com/watch?v=8-nquviNQ2E',
      },
    ],
  },
  {
    symbol: 'GOOG',
    label: '谷歌',
    views: [
      {
        id: 'goog-shiye-1',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '财报后鼻青脸肿，至少等一个季度',
        reason:
          '他在 10 月 28 日盘后视频的标题里说谷歌财报后"鼻青脸肿"，要"等一个季度"，判断短期翻身难。',
        caveat:
          '仅凭标题提炼：受挫的实质细节与翻盘条件看正片；这是财报事件驱动的短期偏空。',
        source: '视野环球财经',
        published: '10/28（美东盘后视频）',
        note: '原片：https://www.youtube.com/watch?v=g3qLtJPUAxU',
      },
      {
        id: 'goog-talkjun-1',
        blogger: '投资TALK君',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '谷歌大跌，冰火两重天的弱端',
        reason:
          '他在 10 月 29 日节目标题里把谷歌形容为"大跌"的一端，与微软的爆发形成冰火对照。',
        caveat:
          '仅凭标题提炼：跌势的持续条件与企稳信号看正片；同期还提到美联储大变动，宏观变量另看。',
        source: '投资TALK君',
        published: '10/29',
        note: '原片：https://www.youtube.com/watch?v=8-nquviNQ2E',
      },
    ],
  },
];

const BATCH_2026_11_01: SymbolViewGroup[] = [
  {
    symbol: 'MSFT',
    label: '微软',
    views: [
      {
        id: 'msft-selina-1',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '盘后逼近历史前高，适合持有、不宜追高',
        reason:
          '她拆了 10 月 29 日盘后的财报：Azure 同比增速达 48%，是几家重金砸 AI 的巨头里唯一还保持正向自由现金流的，基本面她看得扎实；但她同时认为当前估值偏高、性价比不足，所以结论是拿住不加仓。',
        caveat:
          '她的前提是 12 月议息会议仍悬而未决：加息预期没彻底结束之前，科技股难有全面普涨、只会有结构性分化；盘后观点，待下个交易日价格验证。',
        source: 'Selina聊美股《谷歌盘后暴跌 11%！万亿市值蒸发……》',
        published: '10/31',
        note: '原片：https://www.youtube.com/watch?v=Kr1dHy8eHvs（微软段落为 part 4）',
      },
    ],
  },
];

/* ---------------- 11/03 批：11/02 盘后节目（视野环球） ----------------
   水位线 2026-11-01；今日 11 个新条目（9 源全抓成功；Kova Substack 与 Kova YT 无新内容），
   3 个观点入库，8 条丢弃：阳光财经（标题梗＋简介只有会员推广，无标的级内容）、
   NaNa（「翻车接人了！」标题梗、无标的）、Selina 11/02 直播（标题为事实描述＋提问，
   无明确倾向）、投资TALK君 1515 期（无标的、无可辨倾向、无期限）、Money or Life
   （Anthropic 为非上市公司、无标的）、老王 6 条（均为疑问句/话题时间轴，
   未给出明确倾向与期限）。 */
/* ---------------- 11/11 批：新云三大利空（Selina）+ Kova 继续 3 倍做空半导体 ----------------
   水位线 2026-11-08；9 源全抓成功，共 20 条新条目，3 条入库（2 个观点 + 1 个持仓），18 条丢弃：
   阳光财经 2 条（"微软突然又软了"无期限与理由、"英伟达抄底还是割肉"为开放提问，简介只有会员推广）；
   视野 2 条（多话题标题清单，简介只有会员推广，无具体观点与时间戳）；
   NaNa 2 条（"每天默念价值投资一百遍"无标的、"买巨头怎么全是雷"未点名，简介只有会员推广）；
   Selina 直播 2 条（11.10 抄底提问、11.9 见底提问，简介无观点细节）；
   投资TALK君 2 条（1517 期通胀与加息提问、1516 期"英伟达要卖吗"提问，简介只有链接）；
   Kova YouTube 2 条（两条同名"黄仁勋捅破了AI泡沫？"提问式标题，疑似重复上传，简介只有网站链接）；
   老王 6 条（均为台股内容，无美股标的观点）。
   Kova Substack（最新仍为 11/05）、Money or Life（最新 11/07）无新内容。 */
const BATCH_2026_11_11: SymbolViewGroup[] = [
  {
    symbol: 'CRWV',
    label: '新云算力',
    views: [
      {
        id: 'crwv-selina-2',
        blogger: 'Selina聊美股',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '三大利空压顶，财报前别抄底，反弹只当减仓窗口',
        reason:
          '她认为微软退租旧款 GPU 算力、收紧星云合作导致机房延期、谷歌砸 170 亿美元自建数据中心，三件事合起来动摇了新云的底层逻辑：巨头正从外包转向自建。CRWV 订单约 67% 靠微软，租金涨价红利见顶，债券收益率冲到约 15%、全年利息近 9 亿美元而经营利润仅 2 亿多，抗风险能力弱。',
        caveat:
          'CRWV 财报是板块风向标：若订单、指引、融资与微软合作的回应超预期，判断即需修正；若财报爆雷，整个新云板块会被带崩。据视频简介提炼，未看正片。',
        source: 'Selina聊美股',
        published: '11/10',
        note: '原片：https://www.youtube.com/watch?v=oF8RN2sbX3M',
      },
    ],
  },
  {
    symbol: 'NBIS',
    label: '新云算力',
    views: [
      {
        id: 'nbis-selina-2',
        blogger: 'Selina聊美股',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '别因相对稳健就冲进去抄底，板块联动不分好坏',
        reason:
          '她承认 NBIS 财务质地相对更好，但板块联动极强、情绪杀跌不分好坏：十月 CRWV 债暴跌时 NBIS 也跟跌一成，本周回调中跌幅甚至更大；NBIS 自身仍面临百亿美元级资本开支与融资压力，微软合作节奏变化同样会冲击收入确认。',
        caveat:
          '若 CRWV 财报超预期带动板块情绪修复，或 NBIS 在财报中给出订单与融资的明确利好，判断即需修正。据视频简介提炼，未看正片。',
        source: 'Selina聊美股',
        published: '11/10',
        note: '原片：https://www.youtube.com/watch?v=oF8RN2sbX3M',
      },
    ],
  },
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'sox-kova-4-pos',
        blogger: 'Kova动量交易',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：继续持有 3 倍做空半导体',
        reason: '',
        caveat:
          '三倍杠杆做空有衰减与逼空风险；标题未披露具体工具、仓位大小与离场条件，大盘一侧未点名具体标的故未记入。',
        source: 'Kova动量交易',
        published: '11/10',
        note: '原片：https://www.youtube.com/watch?v=P33eNFYM80U',
      },
    ],
  },
];

/* ---------------- 11/08 批：中期选举后分化（Selina）+ 老王台股短视频 ----------------
   水位线 2026-11-07；9 源全抓成功，共 2 条真正新条目，1 个观点入库，1 条丢弃：
   Selina 11/07 晚「中期选举后，AI行情要变天？」（NVDA 长期分批越跌越买，1 条入库）；
   老王 11/08 短视频「短線空頭，什麼時候可以買？」（台股大盘提问、无标的，简介只有播客链接与免责声明）。
   其余 7 源无新内容（Kova Substack 最新仍为 11/05；阳光财经、视野、NaNa、投资TALK君、Money or Life、Kova YouTube 均无 11-07 之后的新条目）。 */
const BATCH_2026_11_08: SymbolViewGroup[] = [
  {
    symbol: 'NVDA',
    label: '英伟达',
    views: [
      {
        id: 'nvda-selina-1',
        blogger: 'Selina聊美股',
        stance: 'bullish',
        horizon: 'long',
        kind: 'view',
        headline: '芯片长期逻辑未动摇，分批越跌越买',
        reason:
          '她认为选举落地后资金在做风格切换：传统板块领涨、芯片与 AI 硬件回调，叠加数据中心用电与碳排放管控预期，压制了芯片采购需求预期；但这波调整更多是高增长预期向中速增长的修正，加前期领涨后的轮动与获利兑现，AI 算力与存储的核心需求并未证伪。',
        caveat:
          '分批布局、不一次性梭哈；若云厂商资本开支放缓超预期演变为需求断档，或 AI 算力与存储核心需求走弱，越跌越买的逻辑即失效。据视频简介提炼，未看正片。',
        source: 'Selina聊美股',
        published: '11/07',
        note: '原片：https://www.youtube.com/watch?v=H0LK-egYFm0',
      },
    ],
  },
];

/* ---------------- 11/07 批：11/06 盘后节目 ----------------
   水位线 2026-11-06；9 源全抓成功，共 7 条新条目，1 个观点入库，6 条丢弃：
   阳光财经（"净挑暴雷的买"为策略口号、未点名个股，简介只有会员推广）；
   NaNa（"深蹲后脚软起不来了"为市场比喻、无标的，简介只有会员推广）；
   Selina 直播 11.4 回放（"美股被错杀了？四季度大涨？"为设问，简介只列一串
   标的标签，未对任一标的给出明确倾向与期限）；Money or Life（SpaceX 星舰
   纪录片转载，无观点）；Kova YouTube 直播（"风浪越大鱼越贵"为波动市口号、
   无标的，简介只有网站链接）；老王短视频（"台股大跌时首先思考什么"为提问句，
   简介只有播客链接与免责声明）。Kova Substack、视野、投资TALK君无新内容。 */
const BATCH_2026_11_07: SymbolViewGroup[] = [
  {
    symbol: 'AAPL',
    label: '苹果',
    views: [
      {
        id: 'aapl-selina-1',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '财报破纪录、股价却大跌：短期先看内存涨价压毛利',
        reason:
          '她拆解苹果财报：单季营收 1145 亿美元、同比涨 12%，全年营收创新高，但盘后股价一度跌超 4%；内存涨价正在啃食利润，毛利率已较上季下滑，下季度指引毛利率 45% 到 46%、营收增速 7% 到 10%，均低于市场预期。',
        caveat:
          '方向取决于两件事：内存成本压力何时见顶、AI 付费变现何时跑通；成本见顶或 AI 收入兑现，短期压制即缓解。据视频简介提炼，未看正片。',
        source: 'Selina聊美股',
        published: '11/06',
        note: '原片：https://www.youtube.com/watch?v=AaFeSxYiHUM',
      },
    ],
  },
];

/* ---------------- 11/06 批：11/05 盘后节目 + Kova Substack 长文 ----------------
   水位线 2026-11-04；9 源全抓成功，共 18 条新条目，2 个观点入库，16 条丢弃：
   Kova Substack 长文内观点二、观点三在付费墙后（仅见标题，正文不可见）；
   阳光财经 2 条（"美股暴跌，为什么和怎么办""24小时精彩反转"简介只有会员推广，
   无标的级内容）；视野 2 条（11/06"计划内建仓一只股票"未点名是哪只；
   11/05"半导体打爆，还能玩吗"为设问，简介只有会员推广）；NaNa 2 条
   （"Margin call 电话都打爆了"无标的；"牛市狂奔？？？"为设问）；Selina
   2 条直播（11/06"美股崩盘"与 11/05"选举对美股的三大影响"均为设问，
   简介只有标签与会员推广）；投资TALK君 2 条（"美股血流成河"无标的；
   美光短视频"毛利见顶就该跑？"为设问）；Money or Life（"投资美股两年"
   为个人回顾，无标的/倾向）；老王 5 条（均为提问句或话题时间轴，
   未给出明确倾向与期限）。Kova YouTube 无新内容。 */
const BATCH_2026_11_06: SymbolViewGroup[] = [
  {
    symbol: 'LLY',
    label: '礼来',
    views: [
      {
        id: 'lly-kova-1',
        blogger: 'Kova动量交易',
        stance: 'neutral',
        horizon: 'long',
        kind: 'view',
        headline: 'AI叙事不构成持有理由，价值看GLP-1兑现',
        reason:
          '他在长文里拆解三季报：利润由GLP-1药物驱动，电话会上管理层与分析师全程未谈AI；AI投入相对研发预算很小，更像一份期权而非经营变量。',
        caveat:
          '若礼来开始披露可归因于AI的效率指标、或把AI写进业绩指引，观点即被推翻；12月7日投资者交流会是第一个检验点。',
        source: 'Kova动量交易 Substack《AI制药最大的赢家，可能不是AI公司》',
        published: '11/05',
        note: '原文：https://kovainvest.substack.com/p/aiai',
      },
    ],
  },
  {
    symbol: 'MRVL',
    label: '迈威尔',
    views: [
      {
        id: 'mrvl-selina-1',
        blogger: 'Selina聊美股',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: '方向正确，但价格需要证明，兑现前不追高',
        reason:
          '她认为收购光连接龙头的方向正确、逻辑通顺，但23.9%溢价把未来数年增长提前打满、股权大幅摊薄，交割又要等到2028年上半年。',
        caveat:
          '在看到订单兑现、协同落地、新增利润覆盖摊薄之前，不建议只凭"AI需要光"追高；三点观察：纸面订单能否变现、联合方案能否拿到真单、利润能否覆盖成本。',
        source: 'Selina聊美股',
        published: '11/05',
        note: '原片：https://www.youtube.com/watch?v=Jfai_egj4Bk',
      },
    ],
  },
];

/* ---------------- 11/04 批：11/03 盘后节目 ----------------
   水位线 2026-11-03；9 源全抓成功，共 9 条新条目，6 个观点入库，8 条/段丢弃：
   阳光财经 11/03 盘后（AMD 仅"盘后急涨"事实陈述、无观点；"大盘还要再跌9%"属
   第三方"砖家"且标题带问号质疑，未明确博主本人倾向）、NaNa 11/03（"选后真能暴涨？"
   无标的）、Selina 2 条（11/03 INTC"十年抄底还是深渊开始"、11/03 直播"选举后
   会大涨吗"均为设问式，未明确给出倾向）、老王 3 条（"利空出尽？""被错杀？"
   "能抱？能买？"均为提问句）、视野"横扫概率极高，AI承压"（所指标的与方向不明）。
   Kova Substack（最新 10/23）、投资TALK君（最新 11/01）、Money or Life（最新 11/02）
   无新文。 */
const BATCH_2026_11_04: SymbolViewGroup[] = [
  {
    symbol: 'AMD',
    label: '超威半导体',
    views: [
      {
        id: 'amd-shiye-1',
        blogger: '视野环球财经',
        stance: 'bullish',
        horizon: 'short',
        kind: 'view',
        headline: 'AMD 前瞻大好，但暗藏隐忧',
        reason:
          '他在 11/03 盘后节目的标题里形容 AMD 的前瞻大好，明显偏向看好一侧，同时用"暗藏隐忧"给出了保留。',
        caveat:
          '仅凭标题提炼：前瞻与隐忧的具体论证、他的反转条件要看正片；财报盘后节目的事件驱动短期信号。',
        source: '视野环球财经',
        published: '11/03（美东 11/03 盘后节目）',
        note: '原片：https://www.youtube.com/watch?v=IcDRffqDfTo',
      },
    ],
  },
  {
    symbol: 'PLTR',
    label: '帕兰蒂尔',
    views: [
      {
        id: 'pltr-shiye-1',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '增速放缓，估值高不可攀',
        reason:
          '他在同一期标题里指出 PLTR 增速放缓，同时形容价格高不可攀，指向短期偏空。',
        caveat:
          '仅凭标题提炼：他的数据口径与反转条件看正片；事件驱动的短期信号。',
        source: '视野环球财经',
        published: '11/03（美东 11/03 盘后节目）',
        note: '原片：https://www.youtube.com/watch?v=IcDRffqDfTo',
      },
    ],
  },
  {
    symbol: 'SOX',
    label: '费城半导体',
    views: [
      {
        id: 'sox-kova-4',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '继续做空半导体，方向维持不动',
        reason:
          '他在 11/03 直播标题里继续摆出三倍做空半导体的姿态，与 10/23 起披露的做空方向一致。',
        caveat:
          '仅凭标题提炼：杠杆做空的期限与转手条件看正片；三倍杠杆有衰减与逼空风险。',
        source: 'Kova动量交易',
        published: '11/03（中国直播）',
        note: '原片：https://www.youtube.com/watch?v=bvm6AXXGRuQ',
      },
      {
        id: 'sox-kova-4-pos',
        blogger: 'Kova动量交易',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：继续持有 3x 做空半导体',
        reason: '',
        caveat: '杠杆方向产品本身的衰减与反向挤压风险由产品承担，不是"稳赚"承诺。',
        source: 'Kova动量交易',
        published: '11/03（中国直播）',
        note: '原片：https://www.youtube.com/watch?v=bvm6AXXGRuQ',
      },
    ],
  },
  {
    symbol: 'SPX',
    label: '大盘',
    views: [
      {
        id: 'spx-kova-2',
        blogger: 'Kova动量交易',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: '三倍继续做空大盘',
        reason:
          '他在 11/03 直播标题里继续摆出三倍做空大盘的姿态，空头立场未变。',
        caveat:
          '仅凭标题提炼：做空期限与反转条件看正片；这是直播标题给出的短期判断。',
        source: 'Kova动量交易',
        published: '11/03（中国直播）',
        note: '原片：https://www.youtube.com/watch?v=bvm6AXXGRuQ',
      },
      {
        id: 'spx-kova-2-pos',
        blogger: 'Kova动量交易',
        stance: 'neutral',
        horizon: 'short',
        kind: 'position',
        headline: '已披露：继续持有 3x 做空大盘',
        reason: '',
        caveat: '杠杆方向产品本身的衰减与反向挤压风险由产品承担，不是"稳赚"承诺。',
        source: 'Kova动量交易',
        published: '11/03（中国直播）',
        note: '原片：https://www.youtube.com/watch?v=bvm6AXXGRuQ',
      },
    ],
  },
];

const BATCH_2026_11_03: SymbolViewGroup[] = [
  {
    symbol: 'AAPL',
    label: '苹果',
    views: [
      {
        id: 'aapl-shiye-1',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: 'AAPL 多个业务增速放缓',
        reason:
          '他在 11/02 盘后节目里把 AAPL 放在标题首条：多个业务的增速都在放缓，是当天看空的重点之一。',
        caveat:
          '仅凭标题提炼：具体的增速口径、对应段落与他的反转条件要看正片；这是事件驱动的短期信号。',
        source:
          '视野环球财经《美股 AAPL多个增速放缓！ORCL再融资，信贷雪上加霜！MRVL收购LITE，双方股东都不满意！…》',
        published: '11/02（美东 11/02 盘后节目）',
        note: '原片：https://www.youtube.com/watch?v=qcdt6yQKt_4',
      },
    ],
  },
  {
    symbol: 'ORCL',
    label: '甲骨文',
    views: [
      {
        id: 'orcl-shiye-1',
        blogger: '视野环球财经',
        stance: 'bearish',
        horizon: 'short',
        kind: 'view',
        headline: 'ORCL 再融资，信贷担忧加重',
        reason:
          '他在同一期里提到 ORCL 又要再融资，并形容当前的信贷环境是雪上加霜，指向债务成本的压力。',
        caveat:
          '仅凭标题提炼：融资规模、条款与他的完整逻辑看正片；事件驱动的短期信号。',
        source:
          '视野环球财经《美股 AAPL多个增速放缓！ORCL再融资，信贷雪上加霜！MRVL收购LITE，双方股东都不满意！…》',
        published: '11/02（美东 11/02 盘后节目）',
        note: '原片：https://www.youtube.com/watch?v=qcdt6yQKt_4',
      },
    ],
  },
  {
    symbol: 'MRVL',
    label: '迈威尔',
    views: [
      {
        id: 'mrvl-shiye-1',
        blogger: '视野环球财经',
        stance: 'cautious',
        horizon: 'short',
        kind: 'view',
        headline: 'MRVL 收购 LITE，两边股东都不买账',
        reason:
          '他报道 MRVL 对 LITE 的收购交易，特别点出双方股东都不满意——市场当下并不认可这笔交易。',
        caveat:
          '仅凭标题提炼：交易条款、他的时间轴判断看正片；收购宣布带来的短期谨慎，不涉及交易长期整合能否成功。',
        source:
          '视野环球财经《美股 AAPL多个增速放缓！ORCL再融资，信贷雪上加霜！MRVL收购LITE，双方股东都不满意！…》',
        published: '11/02（美东 11/02 盘后节目）',
        note: '原片：https://www.youtube.com/watch?v=qcdt6yQKt_4',
      },
    ],
  },
];

export const STREAMER_VIEW_HISTORY: DailyBatch[] = [
  { date: '2026-11-11', groups: BATCH_2026_11_11 },
  { date: '2026-11-08', groups: BATCH_2026_11_08 },
  { date: '2026-11-07', groups: BATCH_2026_11_07 },
  { date: '2026-11-06', groups: BATCH_2026_11_06 },
  { date: '2026-11-04', groups: BATCH_2026_11_04 },
  { date: '2026-11-03', groups: BATCH_2026_11_03 },
  { date: '2026-11-01', groups: BATCH_2026_11_01 },
  { date: '2026-10-30', groups: BATCH_2026_10_30 },
  { date: '2026-10-29', groups: BATCH_2026_10_29 },
  { date: '2026-10-28', groups: BATCH_2026_10_28 },
  { date: '2026-10-24', groups: BATCH_2026_10_24 },
  { date: '2026-10-23', groups: BATCH_2026_10_23 },
  { date: '2026-10-22', groups: BATCH_2026_10_22 },
  { date: '2026-10-21', groups: BATCH_2026_10_21 },
  { date: '2026-10-20', groups: BATCH_2026_10_20 },
  { date: '2026-10-18', groups: BATCH_2026_10_18 },
  { date: '2026-10-17', groups: BATCH_2026_10_17 },
  { date: '2026-10-16', groups: BATCH_2026_10_16 },
];

export const latestViewBatch = (): DailyBatch => STREAMER_VIEW_HISTORY[0];
