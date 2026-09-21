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
      margin: 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; overflow: hidden; touch-action: manipulation;
    }
    .card {
      background: #1e293b; padding: 20px; border-radius: 16px;
      width: 330px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    canvas { background: #0f172a; border-radius: 10px; margin: 15px 0; }
    .btn-group { display: flex; gap: 10px; justify-content: center; }
    button {
      flex: 1; padding: 12px; font-size: 15px; font-weight: bold; border: none;
      border-radius: 10px; cursor: pointer; transition: 0.15s;
    }
    .btn-up { background: #22c55e; color: white; }
    .btn-down { background: #ef4444; color: white; }
    .btn-next { background: #3b82f6; color: white; width: 100%; margin-top: 10px; display: none; }
    .result { margin-top: 10px; font-weight: bold; min-height: 24px; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 18px; font-weight: bold; color:#f59e0b;">历史 K 线盲盒</div>
    <div style="font-size:12px; color:#94a3b8; margin-top:3px;">盲猜第 20 根 K 线涨跌，测试定力</div>
    <canvas id="canvas" width="290" height="170"></canvas>
    <div class="btn-group" id="btnGroup">
      <button class="btn-up" onclick="guess(true)">📈 看涨</button>
      <button class="btn-down" onclick="guess(false)">📉 看跌</button>
    </div>
    <button class="btn-next" id="nextBtn" onclick="loadNewCase()">再试一局 🔄</button>
    <div class="result" id="result"></div>
  </div>

  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const resultEl = document.getElementById('result');
    const btnGroup = document.getElementById('btnGroup');
    const nextBtn = document.getElementById('nextBtn');

    let klines = [], isAnswered = false;

    function generateData() {
      klines = [];
      let price = 100;
      for (let i = 0; i < 20; i++) {
        let change = (Math.random() - 0.48) * 5;
        let open = price;
        let close = price + change;
        let high = Math.max(open, close) + Math.random() * 2;
        let low = Math.min(open, close) - Math.random() * 2;
        klines.push({ open, close, high, low });
        price = close;
      }
    }

    function drawChart(showAll = false) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const count = showAll ? 20 : 15;
      const barWidth = 10, gap = 4;

      for (let i = 0; i < count; i++) {
        let k = klines[i];
        let x = 10 + i * (barWidth + gap);
        let isUp = k.close >= k.open;

        let yOpen = 140 - (k.open - 80) * 1.8;
        let yClose = 140 - (k.close - 80) * 1.8;
        let yHigh = 140 - (k.high - 80) * 1.8;
        let yLow = 140 - (k.low - 80) * 1.8;

        ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
        ctx.fillStyle = isUp ? '#22c55e' : '#ef4444';

        ctx.beginPath();
        ctx.moveTo(x + barWidth / 2, yHigh);
        ctx.lineTo(x + barWidth / 2, yLow);
        ctx.stroke();

        ctx.fillRect(x, Math.min(yOpen, yClose), barWidth, Math.abs(yClose - yOpen) || 2);
      }
    }

    function guess(userGuessUp) {
      if (isAnswered) return;
      isAnswered = true;

      let isActualUp = klines[19].close >= klines[14].close;
      drawChart(true);

      if (userGuessUp === isActualUp) {
        resultEl.innerText = '🎯 猜对了！交易直觉极佳！';
        resultEl.style.color = '#22c55e';
      } else {
        resultEl.innerText = '❌ 猜错了！走势反转出乎意料。';
        resultEl.style.color = '#ef4444';
      }

      btnGroup.style.display = 'none';
      nextBtn.style.display = 'block';
    }

    function loadNewCase() {
      isAnswered = false;
      resultEl.innerText = '';
      btnGroup.style.display = 'flex';
      nextBtn.style.display = 'none';
      generateData();
      drawChart(false);
    }

    loadNewCase();
  </script>
</body>
</html>`;

export default function KLineBoxGame() {
  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[430px] border-0 rounded-2xl overflow-hidden"
      title="KLine Box Game"
    />
  );
}