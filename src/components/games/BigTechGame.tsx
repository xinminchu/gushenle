'use client';

import React from 'react';

const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .grid {
      display: grid; grid-template-columns: repeat(4, 75px); gap: 10px;
      background: #1e293b; padding: 15px; border-radius: 12px;
    }
    .cell {
      width: 75px; height: 75px; background: #334155; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: bold; cursor: pointer; user-select: none;
      transition: all 0.2s; text-align: center; white-space: pre-line;
    }
    .cell.selected { border: 2px solid #38bdf8; background: #475569; }
    .fact-box {
      margin-top: 15px; width: 310px; min-height: 50px; background: #10172a;
      border: 1px solid #334155; padding: 10px; border-radius: 8px;
      font-size: 13px; color: #cbd5e1; text-align: center;
    }
  </style>
</head>
<body>
  <h3 style="margin-bottom:10px; color:#4ade80;">美股巨头 4x4 矩阵消除</h3>
  <div class="grid" id="grid"></div>
  <div class="fact-box" id="factBox">点击两个相同的巨头图标进行消除，查看巨头冷知识！</div>

  <script>
    const techList = [
      { name: 'AAPL\\n苹果', fact: '💡 苹果公司最早的标志是牛顿坐在苹果树下的图案。' },
      { name: 'NVDA\\n英伟达', fact: '💡 英伟达最初的名字源于 "Invidia" (拉丁语: 嫉妒)。' },
      { name: 'TSLA\\n特斯拉', fact: '💡 特斯拉最初并非由马斯克创立，他是在 A 轮融资时加入的。' },
      { name: 'MSFT\\n微软', fact: '💡 微软成立之初的名字叫 "Micro-Soft" (带有连字符)。' }
    ];

    let cards = [];
    techList.forEach(item => {
      cards.push({ ...item }, { ...item });
      cards.push({ ...item }, { ...item });
    });
    cards.sort(() => Math.random() - 0.5);

    const gridEl = document.getElementById('grid');
    const factBox = document.getElementById('factBox');
    let selectedIndex = -1;

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

    render();
  </script>
</body>
</html>`;

export default function BigTechGame() {
  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[500px] border-0 rounded-xl"
      title="Big Tech Game"
    />
  );
}