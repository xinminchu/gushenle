'use client';

import React from 'react';

const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
    body {
      margin: 0; padding: 15px 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      min-height: 100vh; touch-action: manipulation;
    }
    .grid {
      display: grid; grid-template-columns: repeat(4, 70px); gap: 8px;
      background: #1e293b; padding: 12px; border-radius: 16px; margin-top: 10px;
    }
    .cell {
      width: 70px; height: 70px; background: #334155; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: bold; cursor: pointer; text-align: center;
      white-space: pre-line; transition: transform 0.15s, background 0.15s;
    }
    .cell.selected { border: 2px solid #38bdf8; background: #0284c7; transform: scale(0.95); }
    .fact-box {
      margin-top: 15px; width: 304px; min-height: 60px; background: #10172a;
      border: 1px solid #334155; padding: 10px 14px; border-radius: 10px;
      font-size: 13px; color: #cbd5e1; text-align: center; display: flex; align-items: center; justify-content: center;
    }
    .btn-restart {
      margin-top: 15px; background: #334155; color: #38bdf8; border: 1px solid #38bdf8;
      padding: 8px 24px; border-radius: 20px; font-weight: bold; font-size: 14px; cursor: pointer;
    }
  </style>
</head>
<body>
  <div style="font-size:16px; font-weight:bold; color:#4ade80;">美股巨头 4x4 配对消除</div>
  <div class="grid" id="grid"></div>
  <div class="fact-box" id="factBox">💡 配对消除两个相同巨头，解锁冷知识！</div>
  <button class="btn-restart" onclick="initGame()">重新开始 🔄</button>

  <script>
    const techList = [
      { name: 'AAPL\\n苹果', fact: '💡 苹果公司最早的标志是牛顿坐在苹果树下的图画。' },
      { name: 'NVDA\\n英伟达', fact: '💡 英伟达名字源于拉丁语 "Invidia" (意为嫉妒/羡慕)。' },
      { name: 'TSLA\\n特斯拉', fact: '💡 马斯克并非特斯拉创始人，他是在 A 轮融资时加入的。' },
      { name: 'MSFT\\n微软', fact: '💡 微软创立之初名字带连字符："Micro-Soft"。' }
    ];

    let cards = [], selectedIndex = -1;
    const gridEl = document.getElementById('grid');
    const factBox = document.getElementById('factBox');

    function initGame() {
      cards = [];
      selectedIndex = -1;
      techList.forEach(item => {
        cards.push({ ...item, matched: false }, { ...item, matched: false });
        cards.push({ ...item, matched: false }, { ...item, matched: false });
      });
      cards.sort(() => Math.random() - 0.5);
      factBox.innerText = '💡 配对消除两个相同巨头，解锁冷知识！';
      render();
    }

    function render() {
      gridEl.innerHTML = '';
      cards.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cell' + (selectedIndex === index ? ' selected' : '');
        div.style.visibility = item.matched ? 'hidden' : 'visible';
        div.innerText = item.name;
        div.onclick = () => handleClick(index);
        gridEl.appendChild(div);
      });

      if (cards.length > 0 && cards.every(c => c.matched)) {
        factBox.innerHTML = '🎉 <b style="color:#4ade80">恭喜全部消除！完美通关！</b>';
      }
    }

    function handleClick(index) {
      if (cards[index].matched || index === selectedIndex) return;
      if (selectedIndex === -1) {
        selectedIndex = index;
      } else {
        if (cards[selectedIndex].name === cards[index].name) {
          cards[selectedIndex].matched = true;
          cards[index].matched = true;
          factBox.innerText = cards[index].fact;
          selectedIndex = -1;
        } else {
          selectedIndex = index;
        }
      }
      render();
    }

    initGame();
  </script>
</body>
</html>`;

export default function BigTechGame() {
  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[500px] border-0 rounded-2xl overflow-hidden"
      title="Big Tech Game"
    />
  );
}