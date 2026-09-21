<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>历史 K 线盲盒</title>
  <style>
    body {
      margin: 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #1e293b; padding: 20px; border-radius: 12px;
      width: 340px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    canvas { background: #0f172a; border-radius: 8px; margin: 15px 0; }
    .btn-group { display: flex; gap: 10px; justify-content: center; }
    button {
      flex: 1; padding: 12px; font-size: 16px; font-weight: bold; border: none;
      border-radius: 8px; cursor: pointer; transition: 0.2s;
    }
    .btn-up { background: #22c55e; color: white; }
    .btn-down { background: #ef4444; color: white; }
    .btn-next { background: #3b82f6; color: white; width: 100%; margin-top: 10px; }
    .result { margin-top: 12px; font-weight: bold; min-height: 24px; }
  </style>
</head>
<body>

  <div class="card">
    <h3 style="margin:0 0 5px; color:#f59e0b;">历史 K 线盲盒</h3>
    <p style="font-size:12px; color:#94a3b8; margin:0;">看图盲猜后续走势，测试投资定力！</p>

    <canvas id="canvas" width="300" height="180"></canvas>

    <div class="btn-group" id="btnGroup">
      <button class="btn-up" onclick="guess(true)">📈 看涨</button>
      <button class="btn-down" onclick="guess(false)">📉 看跌</button>
    </div>

    <button class="btn-next" id="nextBtn" style="display:none;" onclick="loadNewCase()">下一局</button>
    <div class="result" id="result"></div>
  </div>

<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const resultEl = document.getElementById('result');
const btnGroup = document.getElementById('btnGroup');
const nextBtn = document.getElementById('nextBtn');

let klines = [];
let isAnswered = false;

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
  const count = showAll ? klines.length : 15; // 盲盒默认只显示前 15 根 K 线
  const barWidth = 12;
  const gap = 6;

  for (let i = 0; i < count; i++) {
    let k = klines[i];
    let x = 15 + i * (barWidth + gap);
    let isUp = k.close >= k.open;

    // 缩放计算 Y 轴
    let yOpen = 150 - (k.open - 80) * 2;
    let yClose = 150 - (k.close - 80) * 2;
    let yHigh = 150 - (k.high - 80) * 2;
    let yLow = 150 - (k.low - 80) * 2;

    ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
    ctx.fillStyle = isUp ? '#22c55e' : '#ef4444';

    // 影线
    ctx.beginPath();
    ctx.moveTo(x + barWidth / 2, yHigh);
    ctx.lineTo(x + barWidth / 2, yLow);
    ctx.stroke();

    // 实体
    ctx.fillRect(x, Math.min(yOpen, yClose), barWidth, Math.abs(yClose - yOpen) || 2);
  }
}

function guess(userGuessUp) {
  if (isAnswered) return;
  isAnswered = true;

  // 判断后续第 16-20 根的整体趋势
  let isActualUp = klines[19].close >= klines[14].close;
  
  drawChart(true); // 揭晓剩余 K 线

  if (userGuessUp === isActualUp) {
    resultEl.innerText = '🎯 猜对了！心理定力极佳！';
    resultEl.style.color = '#22c55e';
  } else {
    resultEl.innerText = '❌ 猜错了！市场走势出乎意料。';
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
</html>