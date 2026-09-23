'use client';

import { useState } from 'react';
import { X, BookOpen, Compass, Scale, History, Sparkles } from 'lucide-react';

export type InfoSection = 'about' | 'guide' | 'legal' | 'timeline';

const SECTIONS: { id: InfoSection; label: string; icon: React.ReactNode }[] = [
  { id: 'about', label: '简介', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'guide', label: '用法', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'legal', label: '版权与法律', icon: <Scale className="w-3.5 h-3.5" /> },
  { id: 'timeline', label: '时间轴', icon: <History className="w-3.5 h-3.5" /> },
];

const h4 = 'text-sm font-semibold text-slate-100 mt-4 mb-1.5 first:mt-0';
const p = 'text-xs text-slate-400 leading-relaxed mb-2';
const li = 'text-xs text-slate-400 leading-relaxed mb-1.5 flex gap-1.5';

function About() {
  return (
    <div>
      <h4 className={h4}>股神乐是什么</h4>
      <p className={p}>
        股神乐是个人与家庭的投资陪伴小站。快乐炒股，轻松投资；不赌不堵，不气不弃。
      </p>
      <h4 className={h4}>核心：谷峰律动</h4>
      <p className={p}>
        律动不是预测水晶球，而是一面行为镜子：涨太猛时提醒你别追高，跌过头时提醒你别割肉。
        结论永远锚定近 3 个月，阈值按波动自适应，高分低速会判"高位强势"而不是瞎喊过热。
      </p>
      <h4 className={h4}>轻，是原则</h4>
      <p className={p}>
        股神乐不背负太重：优先确定性、本地、低维护的方案，不玩黑箱。先把"拦追高、拦割肉"这件事做对。
      </p>
    </div>
  );
}

function Guide() {
  const items: [string, string][] = [
    ['今日看板', '管自选：管理自选增删改，"发现股票"可按板块、主题找标的一键加入。看诊断：律动分数 + 大白话状态（涨太猛了 / 高位稳着涨 / 横盘波动 / 跌不动了 / 还在往下跌 / 跌过头了）。价格走势支持 K 线 / 收盘线切换。"判断复盘"里能看到历史信号的命中率，自己验准不准。'],
    ['持仓', '手动录入股数和成本，看实时盈亏；按住手柄拖动排序；点任意一行跳到今日页看它的律动诊断。"真实成本试算"算一来一回的佣金、平台费、换汇和保本价。'],
    ['操作记忆', '记下你的买卖操作和当时想法。直接问"今天可以卖 IBM 吗""想买点什么"，会结合律动给建议；闲聊会引导你记一笔。攒够样本后，这里会变成你的专属复盘。'],
    ['家人', '今日大事看美股 / 国内快讯，财经日历看 FOMC、CPI、财报日。分享圈发买入逻辑、避坑经验，顺手给家人点赞。登录后可用。'],
    ['娱乐', '割韭菜咯咯乐、30 秒冷静屋、美股巨头大乱斗、K 线盲盒——玩的是心态，练的是纪律。积分可以"落袋为安"，登录后多设备同步。'],
  ];
  return (
    <div>
      {items.map(([t, d]) => (
        <div key={t} className="mb-3">
          <h4 className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-400" /> {t}
          </h4>
          <p className={p}>{d}</p>
        </div>
      ))}
    </div>
  );
}

function Legal() {
  return (
    <div>
      <h4 className={h4}>版权</h4>
      <p className={p}>© 2026 股神乐（gushenle.com），保留所有权利。未经许可，请勿转载站内原创内容。</p>
      <h4 className={h4}>投资免责声明</h4>
      <p className={p}>
        本站所有内容——包括律动诊断、操作建议、试算结果、分享圈帖子——仅供学习交流与行为参考，
        <span className="text-slate-200 font-medium">不构成任何投资建议</span>。
        律动是基于历史统计规律的行为纠偏工具，不是预测；市场有风险，盈亏自负，下单前请独立判断。
      </p>
      <h4 className={h4}>数据来源</h4>
      <ul>
        <li className={li}><span>·</span><span>行情：Nasdaq 官方接口（Yahoo Finance 备用），盘中为实时或延迟报价，仅供参考；</span></li>
        <li className={li}><span>·</span><span>快讯：华尔街见闻 7×24；</span></li>
        <li className={li}><span>·</span><span>财经日程：美联储 / BLS 官方日程、Nasdaq 财报日历；</span></li>
        <li className={li}><span>·</span><span>券商费率、监管费：公开资料整理的参考约数，券商随时可能调整，下单前以官方最新公布为准。</span></li>
      </ul>
      <h4 className={h4}>隐私</h4>
      <p className={p}>
        自选、持仓、操作记忆默认只保存在你的浏览器本地。登录后，游戏战绩、帖子、昵称会同步到云端（Supabase）用于多设备同步。
        我们不收集、不出售你的个人信息。
      </p>
      <h4 className={h4}>反馈</h4>
      <p className={p}>有问题或想法，去"家人"页的分享圈留一句，站长看得到。</p>
    </div>
  );
}

function Timeline() {
  const events: [string, string, string][] = [
    ['2026-08-20', 'PIIS 思路初成型', '第一版 Personal Investment Intelligent System（个人投资智能系统）项目思路浮现、初成型。'],
    ['2026-08-22', '股神乐品牌诞生', '股神乐品牌名诞生，gushenle.com 域名注册成功。'],
    ['2026-09-20', '原型诞生', '第一版想法和原型，股神乐有了雏形。'],
    ['2026-09-22', '正式上线', 'www.gushenle.com 首版发布。谷峰律动 v2：结论锚定近 3 月、波动自适应阈值、"判断复盘"上线；自选体系确立；四个小游戏上线。'],
    ['2026-09-23', '账号与家人', 'Supabase 邮箱登录、游戏战绩云同步；家人页换真内容：分享圈、今日大事、财经日历；盘中实时股价；股票名单库与发现股票；操作记忆 AI 建议；真实成本试算器。'],
    ['2026-09-23', 'GSL 1.0 Beta', '服务功能基本齐备，Beta 版成功上线。快乐炒股，轻松投资。🎉'],
    ['2026-09-23', '搜得更快、看得更远', '发现股票支持拼音搜索（pg→苹果）、昵称别名（小火箭→RKLB、海力士→000660.KS）、打错自动纠正；韩股接入 Naver 真实行情，韩元价格本地化显示；修复中文输入法组词 bug。'],
  ];
  return (
    <div className="relative pl-5">
      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-700" />
      {events.map(([date, title, desc]) => (
        <div key={date + title} className="relative mb-5 last:mb-0">
          <div className="absolute -left-5 top-1 w-[11px] h-[11px] rounded-full bg-blue-500 border-2 border-slate-900" />
          <div className="text-[10px] text-slate-500">{date}</div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <p className={p}>{desc}</p>
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
  const titles: Record<InfoSection, string> = {
    about: '关于股神乐',
    guide: '用法指南',
    legal: '版权与法律',
    timeline: '版本时间轴',
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
          {SECTIONS.map((s) => (
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
