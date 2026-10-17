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

/* ---------------- 每日更新：观点留痕 ----------------
   STREAMER_VIEW_HISTORY 按日期倒序，最新在前。
   每日 cron 的唯一写操作：在数组最前面插入一个新 DailyBatch。
   只增不改：历史 batch 一旦发布不再修改（留痕回看靠它）。
   新 batch 的 groups 复用上面的 SymbolViewGroup 结构；
   倾向四档词表 + 强制期限标签 + 判断/持仓分开 + 注明来源，
   与首期 batch 同一套纪律。 */
export const STREAMER_VIEW_HISTORY: DailyBatch[] = [
  { date: '2026-10-16', groups: BATCH_2026_10_16 },
];

export const latestViewBatch = (): DailyBatch => STREAMER_VIEW_HISTORY[0];
