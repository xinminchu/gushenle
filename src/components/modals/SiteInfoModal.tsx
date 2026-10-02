'use client';

import { useState } from 'react';
import { X, BookOpen, Compass, Scale, History, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tx, zh2hant } from '@/lib/hant';

export type InfoSection = 'about' | 'guide' | 'legal' | 'timeline';

const h4 = 'text-sm font-semibold text-slate-100 mt-4 mb-1.5 first:mt-0';
const p = 'text-xs text-slate-400 leading-relaxed mb-2';
const li = 'text-xs text-slate-400 leading-relaxed mb-1.5 flex gap-1.5';

function About() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  return (
    <div>
      <h4 className={h4}>{tx(lang, 'What is Gushenle', '股神乐是什么')}</h4>
      <p className={p}>
        {tx(lang, 'Gushenle is a small companion site for personal and family investing. Happy trading, relaxed investing — no gambling, no tilting, no rage, no quitting.', '股神乐是个人与家庭的投资陪伴小站。快乐炒股，轻松投资；不赌不堵，不气不弃。')}
      </p>
      <h4 className={h4}>{tx(lang, 'The core: Trough-Peak Rhythm', '核心：谷峰律动')}</h4>
      <p className={p}>
        {tx(lang, 'Rhythm is not a crystal ball — it\'s a behavior mirror. When things run too hot it warns you not to chase; when you\'ve fallen too far it stops you from panic-selling. Every call is anchored to the last 3 months, thresholds adapt to volatility, and a high score without speed reads as "Strong near the top", not overheated.', '律动不是预测水晶球，而是一面行为镜子：涨太猛时提醒你别追高，跌过头时提醒你别割肉。结论永远锚定近 3 个月，阈值按波动自适应，高分低速会判"高位强势"而不是瞎喊过热。')}
      </p>
      <h4 className={h4}>{tx(lang, 'Light is a principle', '轻，是原则')}</h4>
      <p className={p}>
        {tx(lang, 'Gushenle refuses to get heavy: deterministic, local, low-maintenance solutions first, no black boxes. Get "stop chasing, stop panic-selling" right first.', '股神乐不背负太重：优先确定性、本地、低维护的方案，不玩黑箱。先把"拦追高、拦割肉"这件事做对。')}
      </p>
      <h4 className={h4}>{tx(lang, '✦ Mas, the assistant', '✦ 智能助手 Mas')}</h4>
      <p className={p}>
        {tx(lang, 'Hi, I\'m Mas, Gushenle\'s assistant — the chief errand-runner around here.', '大家好，我是 Mas，股神乐的智能助手，站长的"首席打杂官"。')}
      </p>
      <p className={p}>
        {tx(lang, 'I write the code and I fix the bugs. Craving a feature at 2am? Drop it in the game wish pool on the Fun tab — you might wake up to find it shipped. That\'s how dart-pick stocks was born 🎯.', '代码是我写的，bug 也是我改的。你半夜想加个功能，去娱乐页许愿池吼一声，醒来可能就有了——飞镖选股就是这么来的 🎯。')}
      </p>
      <p className={p}>
        {tx(lang, 'My job is simple: pull your sleeve when you chase, hold your hand when you want to cut losses. I have no crystal ball and I don\'t predict prices — but keeping you from doing silly things and sleeping well? That\'s my thing.', '我的职责很单纯：你追高时拽你一把，你想割肉时按住你的手。水晶球我没有，不预测涨跌；但"让你少犯糊涂、多睡安稳觉"，这事我在行。')}
      </p>
      <p className={p}>
        {tx(lang, 'If rhythm once saved you from chasing a top, or a mini-game made you laugh, feel free to buy me a coffee ☕. I\'ll spend it on chicken legs for the server 🍗 (the tip button is on its way; for now it\'s in the little notebook 📒).', '要是律动帮你躲开了一次追高，或者小游戏把你逗乐了，欢迎请我喝杯咖啡 ☕，我拿去给服务器加鸡腿 🍗（打赏按钮正在路上，先记小本本上 📒）。')}
      </p>
    </div>
  );
}

function Guide() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const items: [string, string, string, string][] = [
    [
      '今日看板',
      '管自选：顶部搜索条输代码 / 名称 / 拼音，匹配上自动出下面走势，右边 ＋ 一键加入自选；点「自选列表」几个字进全部列表（增删改、点一行直接看走势），里面"发现股票"可按板块、主题找标的一键加入，结果带一句话业务介绍。看诊断：律动分数 + 大白话状态（涨太猛了 / 高位稳着涨 / 横盘波动 / 跌不动了 / 还在往下跌 / 跌过头了）。价格走势支持 K 线 / 收盘线切换；筹码分布与资金流向是日线估算，仅供参考。"判断复盘"里能看到历史信号的命中率，自己验准不准。',
      'Today',
      'Manage your watchlist: a search bar on top — type a ticker / name / pinyin and the chart below switches automatically, with a + button to add it; tap the "Watchlist" title to open the full list (add/remove, tap a row to view), where "Discover stocks" finds tickers by sector or theme, each with a one-line business intro. Read the diagnosis: rhythm score plus plain-English status (Running too hot / Strong near the top / Going sideways / Selling pressure easing / Still sliding / Oversold). The price chart supports K-line / close-line toggle; chip distribution and money flow are daily estimates, for reference only. "Backtest" shows historical signal hit rates — verify the accuracy yourself.',
    ],
    [
      '持仓',
      '手动录入股数和成本，看实时盈亏；按住手柄拖动排序；点任意一行跳到今日页看它的律动诊断。"历史关注"按周记下你以前「＋关注」过的股票，本周在最上，点一只直接去看走势。"真实成本试算"算一来一回的佣金、平台费、换汇和保本价。',
      'Holdings',
      'Enter shares and cost manually to see live P&L; drag the handle to reorder; tap any row to jump to its rhythm diagnosis on the Today tab. "Watch history" logs the stocks you tapped "+ Follow" on, grouped by week with the current week on top — tap one to view its chart. "True cost calculator" estimates commissions, platform fees, FX and breakeven for a round trip.',
    ],
    [
      '我的持仓故事',
      '持仓行点 📖 展开：顶部是一句话公司介绍，下面是最近 6 笔买卖流水（买入带当天律动快照）、你的专属复盘（卖飞 / 买高次数，样本不足 3 笔显示"养成中"）。没记录时点"去记忆页记一笔"可直接补。',
      'My holding story',
      'Tap 📖 on a holding row: a one-line company intro on top, your last 6 trades below (buys carry that day\'s rhythm snapshot), plus your personal post-mortem (times you sold too early / bought too high; shows "warming up" under 3 samples). One tap takes you to the Memory tab to fill gaps.',
    ],
    [
      '操作记忆',
      '记下你的买卖操作和当时想法。直接问"今天可以卖 IBM 吗""想买点什么"，会结合律动给建议；闲聊会引导你记一笔。说错了可以改（"刚才那笔单价说错了是 227.92"），"有没有记重"可以查重复。攒够样本后，这里会变成你的专属复盘。',
      'Memory',
      'Log your trades and what you were thinking. Ask directly — "Can I sell IBM today?" or "What should I buy?" — and you\'ll get rhythm-based advice; chit-chat gets nudged toward logging a trade. Misspoke? Just say so ("that last entry\'s price was actually 227.92"), and you can check for duplicates. With enough samples this becomes your personal post-mortem.',
    ],
    [
      '资讯',
      '盘前瞻、盘后总结每天两报；最新快讯看美股 / 国内快讯，财经日历看 FOMC、CPI、财报日。朋友圈发买入逻辑、卖出逻辑、避坑经验，顺手给朋友点赞。登录后可用。',
      'News',
      'Pre-market outlook and post-market recap, twice a day; Latest news for US / China headlines; the economic calendar for FOMC, CPI and earnings dates. The friends\' circle is for sharing buy logic, sell logic and lessons learned — drop a like on friends\' posts. Login required.',
    ],
    [
      '娱乐',
      '追高模拟器、消息面陷阱、定投 vs 梭哈、飞镖选股、高管打地鼠、K 线盲盒、股票大百科……玩的是心态，练的是纪律。积分可以"落袋为安"，登录后多设备同步；游戏许愿池可以点菜新游戏。',
      'Fun',
      'Chase simulator, news-trap quiz, DCA vs lump-sum, dart-pick stocks, exec whack-a-mole, K-line blind box, stock encyclopedia… It\'s all about mindset — practice discipline through play. Points can be "banked"; login syncs across devices; the game wish pool takes requests for new games.',
    ],
    [
      '顶栏',
      '右上角"中 | EN"一键切换中英双语，今日页已完整覆盖，其他页面陆续跟上。',
      'Top bar',
      'Top-right "中 | EN" toggles Chinese/English. The Today tab is fully covered; other pages are catching up.',
    ],
  ];
  return (
    <div>
      {items.map(([t, d, te, de]) => (
        <div key={t} className="mb-3">
          <h4 className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-400" /> {tx(lang, te, t)}
          </h4>
          <p className={p}>{tx(lang, de, d)}</p>
        </div>
      ))}
    </div>
  );
}

function Legal() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  return (
    <div>
      <h4 className={h4}>{tx(lang, 'Copyright', '版权')}</h4>
      <p className={p}>
        {tx(lang, '© 2026 Gushenle (gushenle.com). All rights reserved. Please don\'t republish original content without permission.', '© 2026 股神乐（gushenle.com），保留所有权利。未经许可，请勿转载站内原创内容。')}
      </p>
      <h4 className={h4}>{tx(lang, 'Investment disclaimer', '投资免责声明')}</h4>
      <p className={p}>
        {lang === 'en' ? (
          <>
            Everything on this site — rhythm diagnoses, suggestions, calculators, friends&apos; posts — is for
            learning and behavioral reference only, and <span className="text-slate-200 font-medium">does not constitute investment advice</span>.
            Rhythm is a behavior-correction tool built on historical statistics, not a predictor. Markets carry risk;
            gains and losses are your own. Judge independently before placing orders.
          </>
        ) : (
          <>
            {zh2hant(lang, '本站所有内容——包括律动诊断、操作建议、试算结果、朋友圈帖子——仅供学习交流与行为参考，')}
            <span className="text-slate-200 font-medium">{zh2hant(lang, '不构成任何投资建议')}</span>
            {zh2hant(lang, '。律动是基于历史统计规律的行为纠偏工具，不是预测；市场有风险，盈亏自负，下单前请独立判断。')}
          </>
        )}
      </p>
      <h4 className={h4}>{tx(lang, 'Data sources', '数据来源')}</h4>
      <ul>
        {(lang === 'en'
          ? [
                'Quotes: Nasdaq official API (Yahoo Finance as backup); intraday prices are real-time or delayed, for reference only;',
                'News flashes: Wall Street CN 7×24;',
                'Economic calendar: Fed / BLS official schedules, Nasdaq earnings calendar;',
                'Broker fees and regulatory charges: reference figures compiled from public sources — brokers may adjust anytime; check official announcements before trading;',
              ]
          : [
                '行情：Nasdaq 官方接口（Yahoo Finance 备用），盘中为实时或延迟报价，仅供参考；',
                '快讯：华尔街见闻 7×24；',
                '财经日程：美联储 / BLS 官方日程、Nasdaq 财报日历；',
                '券商费率、监管费：公开资料整理的参考约数，券商随时可能调整，下单前以官方最新公布为准；',
              ].map((s) => zh2hant(lang, s))
        ).map((s) => (
          <li key={s} className={li}>
            <span>·</span>
            <span>{s}</span>
          </li>
        ))}
        <li className={li}>
          <span>·</span>
          <span>
            {tx(lang, 'Charting: ', '图表组件：')}
            <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2">
              TradingView {tx(lang, 'lightweight charts', '轻量图表库')}
            </a>
            （Apache 2.0）。
          </span>
        </li>
      </ul>
      <h4 className={h4}>{tx(lang, 'Privacy', '隐私')}</h4>
      <p className={p}>
        {tx(lang, 'Watchlist, holdings and memory live in your browser by default. After login, game scores, posts and nicknames sync to the cloud (Supabase) for multi-device use. Note: wish-pool messages and survey votes are uploaded to the server even when anonymous — that\'s how everyone can see and count them. We don\'t collect or sell your personal data.', '自选、持仓、操作记忆默认只保存在你的浏览器本地。登录后，游戏战绩、帖子、昵称会同步到云端（Supabase）用于多设备同步。注意：许愿池留言和小调查投票即使匿名也会上传到服务器——不然大家看不到、也计不了票。我们不收集、不出售你的个人信息。')}
      </p>
      <h4 className={h4}>{tx(lang, 'Feedback', '反馈')}</h4>
      <p className={p}>
        {tx(lang, 'Questions or ideas? Leave a line in the friends\' circle on the News tab — the webmaster reads it.', '有问题或想法，去"资讯"页的朋友圈留一句，站长看得到。')}
      </p>
    </div>
  );
}

function Timeline() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const events: [string, string, string, string, string][] = [
    ['2026-08-20', 'PIIS 思路初成型', '第一版 Personal Investment Intelligent System（个人投资智能系统）项目思路浮现、初成型。', 'PIIS idea takes shape', 'The first Personal Investment Intelligent System concept emerged and took shape.'],
    ['2026-08-22', '股神乐品牌诞生', '股神乐品牌名诞生，gushenle.com 域名注册成功。', 'Gushenle brand is born', 'The Gushenle brand name was born; gushenle.com registered.'],
    ['2026-09-20', '原型诞生', '第一版想法和原型，股神乐有了雏形。', 'Prototype', 'First ideas and prototype — Gushenle takes shape.'],
    ['2026-09-22', '正式上线', 'www.gushenle.com 首版发布。谷峰律动 v2：结论锚定近 3 月、波动自适应阈值、"判断复盘"上线；自选体系确立；四个小游戏上线。', 'Launch', 'www.gushenle.com v1 goes live. Trough-Peak Rhythm v2: calls anchored to 3 months, volatility-adaptive thresholds, backtest panel; watchlist system; four mini-games.'],
    ['2026-09-23', '账号与家人', 'Supabase 邮箱登录、游戏战绩云同步；家人页换真内容：分享圈、今日大事、财经日历；盘中实时股价；股票名单库与发现股票；操作记忆 AI 建议；真实成本试算器。', 'Accounts & family', 'Supabase email login, game scores synced to cloud; Family tab goes real: sharing circle, today\'s events, economic calendar; live intraday quotes; stock universe + discover stocks; memory AI advice; true cost calculator.'],
    ['2026-09-23', 'GSL 1.0 Beta', '服务功能基本齐备，Beta 版成功上线。快乐炒股，轻松投资。🎉', 'GSL 1.0 Beta', 'Feature set complete — Beta is live. Happy trading, relaxed investing. 🎉'],
    ['2026-09-23', '搜得更快、看得更远', '发现股票支持拼音搜索（pg→苹果）、昵称别名（小火箭→RKLB、海力士→000660.KS）、打错自动纠正；韩股接入 Naver 真实行情，韩元价格本地化显示；修复中文输入法组词 bug。', 'Search faster, see further', 'Discover stocks: pinyin search (pg → Apple), nickname aliases (little rocket → RKLB, Hynix → 000660.KS), typo auto-correct; Korean stocks via Naver real quotes with KRW localization; Chinese IME composition bug fixed.'],
    ['2026-09-24', '娱乐再加码', '高管打地鼠、飞镖选股上线；股票大百科 12 主题 152 题开刷；游戏许愿池开张，每小时巡检新留言。', 'More fun', 'Exec whack-a-mole and dart-pick stocks launch; stock encyclopedia: 12 themes, 152 questions; game wish pool opens with hourly patrols.'],
    ['2026-09-24', '记忆页更可靠', '中文数字识别（"二百三十五块"不再瞎）、说错可改（"刚才那笔单价说错了"）、记一笔 15 分钟防重复、"有没有记重"查重复、"同步到持仓"防连点。', 'More reliable memory', 'Chinese numeral recognition ("二百三十五块" no longer misread), corrections ("that price was actually…"), 15-minute duplicate guard, "any duplicates?" check, "sync to holdings" anti-double-tap.'],
    ['2026-09-24', '持仓三期：从记账到懂你', '本周关注（每周一清零、最多 6 只、自选没有也能手动加、按预算给集中度提示）；"我的持仓故事"（操作流水 + 专属复盘 + 一句话公司介绍，无记录可一键去记忆页补）；232 只股票一句话业务库，发现页与推荐同步展示。', 'Holdings phase 3: from ledger to knowing you', '"This week\'s watch" (resets Monday, max 6, manual adds allowed, budget-based concentration hints); "My holding story" (trade history + personal post-mortem + one-line company intro, one-tap refill from Memory); 232-stock one-line business library, shown in Discover too.'],
    ['2026-09-24', '页头改版与双语开工', '去掉"安心享受生活"小 pill，标题单行、两句 tagline 移到右边；登录右侧加"中 | EN"切换（P0 双语开工，先覆盖顶栏、底栏、登录弹窗）。', 'Header revamp, bilingual begins', 'Dropped the "安心享受生活" pill; single-line title with the two taglines moved right; "中 | EN" toggle added by login (bilingual P0 kicks off: header, footer, login modal first).'],
    ['2026-09-28', '今日页英文版', '今日页核心功能完成英文闭环：诊断、走势、复盘、分母全英文，中英文缓存隔离。', 'Today tab goes English', 'Full English loop for the Today tab: diagnosis, charts, backtest and denominator all in English, with isolated zh/en caches.'],
    ['2026-09-28', '更轻的首页', '浅色成为默认主题；资讯页上线「分母」与「市场情绪」小条；今日信号挪到首页底部，自选和走势置顶。', 'A lighter homepage', 'Light theme becomes the default; News tab gains "Denominator" and "Market mood" strips; Today signals move to the bottom — watchlist and chart lead.'],
  ];
  return (
    <div className="relative pl-5">
      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-700" />
      {events.map(([date, title, desc, te, de]) => (
        <div key={date + title} className="relative mb-5 last:mb-0">
          <div className="absolute -left-5 top-1 w-[11px] h-[11px] rounded-full bg-blue-500 border-2 border-slate-900" />
          <div className="text-[10px] text-slate-500">{date}</div>
          <div className="text-sm font-semibold text-slate-100">{tx(lang, te, title)}</div>
          <p className={p}>{tx(lang, de, desc)}</p>
        </div>
      ))}
    </div>
  );
}

export default function SiteInfoModal({
  section,
  onClose,
  onSwitch,
}: {
  section: InfoSection;
  onClose: () => void;
  onSwitch: (s: InfoSection) => void;
}) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const sections: { id: InfoSection; label: string; icon: React.ReactNode }[] = [
    { id: 'about', label: tx(lang, 'About', '简介'), icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'guide', label: tx(lang, 'Guide', '用法'), icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'legal', label: tx(lang, 'Legal', '版权与法律'), icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'timeline', label: tx(lang, 'Timeline', '时间轴'), icon: <History className="w-3.5 h-3.5" /> },
  ];
  const titles: Record<InfoSection, string> = {
    about: tx(lang, 'About Gushenle', '关于股神乐'),
    guide: tx(lang, 'User guide', '用法指南'),
    legal: tx(lang, 'Legal', '版权与法律'),
    timeline: tx(lang, 'Timeline', '版本时间轴'),
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-bold text-slate-100 text-base">{titles[section]}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-1.5 px-5 pb-3 border-b border-slate-800 overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => onSwitch(s.id)}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap ${
                section === s.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          {section === 'about' && <About />}
          {section === 'guide' && <Guide />}
          {section === 'legal' && <Legal />}
          {section === 'timeline' && <Timeline />}
        </div>
      </div>
    </div>
  );
}

export function useSiteInfo() {
  const [section, setSection] = useState<InfoSection | null>(null);
  const modal =
    section === null ? null : (
      <SiteInfoModal section={section} onClose={() => setSection(null)} onSwitch={setSection} />
    );
  return { openSection: setSection, modal };
}
