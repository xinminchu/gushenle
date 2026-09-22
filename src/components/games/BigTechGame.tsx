'use client';

import React, { useMemo } from 'react';

/* ---------- 数据源：自选列表 ---------- */
const WATCH_KEY = 'gushenle:watchlist:v1';
const DEFAULT_WATCH = [
  { symbol: 'AAPL', name: '苹果' },
  { symbol: 'NVDA', name: '英伟达' },
  { symbol: 'MSFT', name: '微软' },
  { symbol: 'TSLA', name: '特斯拉' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'MSTR', name: '微策略' },
  { symbol: 'GOOGL', name: '谷歌' },
  { symbol: 'META', name: 'Meta' },
];

const SECTOR_OF: Record<string, string> = {
  AAPL: '科技', MSFT: '科技', NVDA: '科技', GOOGL: '科技', META: '科技', AMD: '科技',
  AMZN: '科技消费', NFLX: '科技消费',
  TSLA: '汽车科技',
  COIN: '加密概念', MSTR: '加密概念',
};
const SECTOR_COLOR: Record<string, string> = {
  '科技': '#1d4ed8',
  '科技消费': '#7c3aed',
  '汽车科技': '#ea580c',
  '加密概念': '#ca8a04',
  '未分类': '#475569',
};

/* ---------- 冷知识库：每只 2~3 条真实有趣 ---------- */
const FACTS: Record<string, string[]> = {
  AAPL: [
    '苹果最初的 Logo 是牛顿坐在苹果树下的繁复插画，乔布斯嫌太复杂才换成被咬一口的苹果。',
    '苹果账上现金最多时超过 2000 亿美元，比很多国家的全部外汇储备还多。',
    '第一代 iPhone 发布时没有 App Store，甚至不支持复制粘贴。',
  ],
  NVDA: [
    '英伟达的名字来自拉丁语 Invidia（嫉妒），Logo 上那只"眼睛"其实是字母 e 的变形。',
    '英伟达在 1999 年发明了 GPU 这个词，创业初期曾因押错方向差点破产。',
    '黄仁勋最爱在 Denny\'s 连锁餐厅谈生意，皮衣之下是连锁快餐的灵魂。',
  ],
  MSFT: [
    '微软最初叫 Micro-Soft，中间带连字符，后来才去掉。',
    '微软的第一桶金来自给 IBM 写 DOS 系统，而那套系统其实是花 5 万美元买来的。',
    '比尔·盖茨 19 岁辍学，微软的第一个产品是给 Altair 电脑写的 BASIC 解释器。',
  ],
  TSLA: [
    '马斯克并不是特斯拉创始人，他是在 A 轮融资时加入、后来才成为 CEO 的。',
    '特斯拉第一款车 Roadster 的底盘来自莲花 Elise 跑车。',
    '特斯拉曾靠卖碳积分大赚，有一年靠这个赚的钱比卖车本身还多。',
  ],
  COIN: [
    'Coinbase 是第一家在纳斯达克直接上市（DPO）的大型加密交易所。',
    '创始人 Brian Armstrong 创业前在 Airbnb 当工程师。',
    'Coinbase 上市首日估值一度超过 1000 亿美元，超过很多传统券商。',
  ],
  MSTR: [
    '微策略原本是家做商业智能软件的公司，后来靠大举买入比特币出名。',
    'Michael Saylor 曾在一天之内让公司买入数亿美元比特币，被称为"比特币传教士"。',
    '微策略的股票常被当作"比特币影子股"，波动经常比比特币本身还大。',
  ],
  GOOGL: [
    'Google 的名字来自数学术语 Googol（10 的 100 次方），注册域名时拼错了将错就错。',
    '谷歌的第一台服务器机架是用乐高积木搭起来的。',
    '谷歌每天处理超过 80 亿次搜索，平均每人每天被谷歌"读心"好几次。',
  ],
  META: [
    'Facebook 最初只对哈佛学生开放，名字来自哈佛新生的花名册"Face Book"。',
    '扎克伯格 2006 年拒绝了雅虎 10 亿美元的收购报价，当时他才 22 岁。',
    'Meta 的蓝色 Logo 是因为扎克伯格是红绿色盲，蓝色是他看得最清楚的颜色。',
  ],
  AMZN: [
    '亚马逊最早叫 Cadabra（像咒语 Abracadabra），律师听成 Cadaver（尸体）才改名。',
    '亚马逊 Logo 上从 A 到 Z 的箭头，寓意"什么都卖"。',
    '贝佐斯创业初期自己当客服，办公室的桌子是拿旧门板搭的。',
  ],
  AMD: [
    'AMD 和英特尔是"兄弟公司"，创始人都来自仙童半导体。',
    'AMD 曾长期给英特尔做"备胎"供应商，后来靠锐龙系列翻身。',
    'AMD 是 Advanced Micro Devices（超威半导体）的缩写。',
  ],
  NFLX: [
    '网飞最初是 DVD 邮寄租赁，据说灵感来自创始人租碟逾期被罚 40 美元。',
    '百视达 2000 年曾有机会花 5000 万美元收购网飞，结果拒绝了。',
    '网飞用户每天观看时长超过 2.5 亿小时，熬夜冠军制造机。',
  ],
};
const GENERIC_FACTS = [
  '美股有"圣诞老人行情"：圣诞节前后 7 个交易日大概率上涨。',
  '"五月卖出"（Sell in May）是华尔街流传百年的季节性谚语。',
  '复利被称为世界第八大奇迹：年化 20% 坚持 20 年，1 万能变 38 万。',
  '诺贝尔奖得主卡尼曼证明：亏 1 万的痛苦，需要赚 2 万才能抚平。',
  '巴菲特 90% 的财富是在 50 岁之后赚到的，时间是最好的杠杆。',
  '2000 年科技泡沫破裂后，纳斯达克指数曾跌去 78%，用了 15 年才回本。',
];

function readWatchlist(): { symbol: string; name: string }[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return DEFAULT_WATCH;
    const j = JSON.parse(raw);
    const items = Array.isArray(j?.items) ? j.items : [];
    const cleaned = items
      .filter((it: unknown) => it && typeof (it as { symbol?: unknown }).symbol === 'string')
      .map((it: { symbol: string; name?: string }) => ({
        symbol: it.symbol.toUpperCase(),
        name: it.name || it.symbol.toUpperCase(),
      }));
    return cleaned.length > 0 ? cleaned : DEFAULT_WATCH;
  } catch {
    return DEFAULT_WATCH;
  }
}

type StockPayload = { symbol: string; name: string; sector: string; color: string; facts: string[] };

function buildPayload(): StockPayload[] {
  const list = readWatchlist();
  const picked = list.slice(0, 8).map((it) => ({ ...it }));
  // 不足 8 只用默认补齐
  for (const d of DEFAULT_WATCH) {
    if (picked.length >= 8) break;
    if (!picked.some((p) => p.symbol === d.symbol)) picked.push({ ...d });
  }
  return picked.map((it) => {
    const sector = SECTOR_OF[it.symbol] || '未分类';
    return {
      symbol: it.symbol,
      name: it.name,
      sector,
      color: SECTOR_COLOR[sector],
      facts: FACTS[it.symbol] || GENERIC_FACTS,
    };
  });
}

export default function BigTechGame() {
  const htmlContent = useMemo(() => {
    const stocks = buildPayload();
    const stocksJson = JSON.stringify(stocks);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
    body {
      margin: 0; padding: 14px 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      min-height: 100vh; touch-action: manipulation;
    }
    .title { font-size: 16px; font-weight: bold; color: #4ade80; }
    .hud {
      margin-top: 8px; font-size: 12px; color: #94a3b8;
      background: #10172a; border: 1px solid #334155; border-radius: 20px;
      padding: 5px 14px;
    }
    .hud b { color: #e2e8f0; }
    .grid {
      display: grid; grid-template-columns: repeat(4, 74px); gap: 8px;
      background: #1e293b; padding: 12px; border-radius: 16px; margin-top: 10px;
    }
    .cell {
      width: 74px; height: 74px; border-radius: 10px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; text-align: center; line-height: 1.25;
      transition: transform 0.15s, filter 0.15s;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .cell:active { transform: scale(0.93); }
    .cell .sym { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.85); }
    .cell .nm { font-size: 14px; font-weight: 800; color: #fff; margin: 1px 0; }
    .cell .sec { font-size: 9px; color: rgba(255,255,255,0.65); }
    .cell.selected { outline: 3px solid #38bdf8; outline-offset: -1px; filter: brightness(1.25); }
    .fact-box {
      margin-top: 12px; width: 344px; min-height: 64px; background: #10172a;
      border: 1px solid #334155; padding: 10px 14px; border-radius: 10px;
      font-size: 13px; color: #cbd5e1; text-align: center; display: flex; align-items: center; justify-content: center;
      line-height: 1.5;
    }
    .btn-restart {
      margin-top: 12px; background: #334155; color: #38bdf8; border: 1px solid #38bdf8;
      padding: 8px 24px; border-radius: 20px; font-weight: bold; font-size: 14px; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="title">美股巨头 4x4 配对消除</div>
  <div class="hud" id="hud"></div>
  <div class="grid" id="grid"></div>
  <div class="fact-box" id="factBox">💡 配对消除两个相同股票，解锁冷知识！</div>
  <button class="btn-restart" onclick="initGame()">重新开始 🔄</button>

  <script>
    var STOCKS = ${stocksJson};

    var cards = [], selectedIndex = -1, round = 1, attempts = 0, matched = 0;
    var shownFacts = {};
    var gridEl = document.getElementById('grid');
    var factBox = document.getElementById('factBox');
    var hudEl = document.getElementById('hud');

    function updateHud() {
      var pct = attempts === 0 ? 100 : Math.round((matched / attempts) * 100);
      hudEl.innerHTML = '第 <b>' + round + '</b> 轮 · 尝试 <b>' + attempts + '</b> 次 · 成功率 <b>' + pct + '%</b>';
    }

    function initGame() {
      cards = [];
      selectedIndex = -1;
      attempts = 0;
      matched = 0;
      shownFacts = {};
      STOCKS.forEach(function (s) {
        cards.push({ s: s, done: false }, { s: s, done: false });
      });
      cards.sort(function () { return Math.random() - 0.5; });
      factBox.innerText = '💡 配对消除两个相同股票，解锁冷知识！';
      updateHud();
      render();
    }

    function render() {
      gridEl.innerHTML = '';
      cards.forEach(function (c, index) {
        var div = document.createElement('div');
        div.className = 'cell' + (selectedIndex === index ? ' selected' : '');
        div.style.background = c.s.done;
        div.style.visibility = c.done ? 'hidden' : 'visible';
        div.innerHTML =
          '<div class="sym">' + c.s.symbol + '</div>' +
          '<div class="nm">' + c.s.name + '</div>' +
          '<div class="sec">' + c.s.sector + '</div>';
        div.onclick = function () { handleClick(index); };
        gridEl.appendChild(div);
      });
    }

    function pickFact(stock) {
      var key = stock.symbol;
      var pool = stock.facts.filter(function (f) { return !shownFacts[key + '|' + f]; });
      if (pool.length === 0) {
        // 本轮该股票的冷知识展示完了，重置本股票的展示记录
        Object.keys(shownFacts).forEach(function (k) {
          if (k.indexOf(key + '|') === 0) delete shownFacts[k];
        });
        pool = stock.facts;
      }
      var f = pool[Math.floor(Math.random() * pool.length)];
      shownFacts[key + '|' + f] = true;
      return f;
    }

    function handleClick(index) {
      if (cards[index].done || index === selectedIndex) return;
      if (selectedIndex === -1) {
        selectedIndex = index;
      } else {
        attempts++;
        if (cards[selectedIndex].s.symbol === cards[index].s.symbol) {
          cards[selectedIndex].done = true;
          cards[index].done = true;
          matched++;
          factBox.innerText = '💡 ' + pickFact(cards[index].s);
          selectedIndex = -1;
        } else {
          selectedIndex = index;
        }
      }
      updateHud();
      render();

      if (cards.length > 0 && cards.every(function (c) { return c.done; })) {
        factBox.innerHTML = '🎉 <b style="color:#4ade80">第 ' + round + ' 轮通关！</b> 新一轮即将开始…';
        setTimeout(function () {
          round++;
          initGame();
        }, 1200);
      }
    }

    initGame();
  </script>
</body>
</html>`;
  }, []);

  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[560px] border-0 rounded-2xl overflow-hidden"
      title="美股巨头大乱斗"
    />
  );
}
