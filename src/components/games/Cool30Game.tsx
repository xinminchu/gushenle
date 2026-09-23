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
      margin: 0; padding: 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; overflow: hidden; touch-action: none; overscroll-behavior: none;
    }
    .hud {
      margin-bottom: 10px; display: flex; justify-content: space-between; width: 340px;
      font-size: 14px; font-weight: bold; color: #38bdf8;
    }
    canvas { background: #1e293b; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); touch-action: none; }

    .overlay {
      position: absolute; inset: 0; background: rgba(11, 15, 25, 0.92);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 20; opacity: 0; pointer-events: none; transition: opacity 0.3s;
    }
    .overlay.show { opacity: 1; pointer-events: auto; }
    .overlay-title { font-size: 24px; font-weight: bold; color: #f59e0b; margin-bottom: 8px; }
    .overlay-score { font-size: 36px; font-weight: 800; color: #38bdf8; margin-bottom: 20px; }
    .btn-retry {
      background: linear-gradient(135deg, #0284c7, #0369a1); color: white;
      border: none; padding: 12px 32px; font-size: 16px; font-weight: bold;
      border-radius: 24px; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
    }
  </style>
</head>
<body>
  <div class="hud">
    <span id="scoreText">消除障碍: 0</span>
    <span id="timeText">剩余时间: 30s</span>
  </div>
  <canvas id="canvas" width="340" height="460"></canvas>

  <div class="overlay" id="overlay">
    <div class="overlay-title">⌛ 30秒解压结束</div>
    <div style="color: #94a3b8; font-size: 14px; margin-bottom: 5px;">成功消除风险砖块</div>
    <div class="overlay-score" id="finalScore">0 块</div>
    <button class="btn-retry" onclick="resetGame()">再清一次 🔄</button>
  </div>

  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const scoreText = document.getElementById('scoreText');
    const timeText = document.getElementById('timeText');
    const overlay = document.getElementById('overlay');
    const finalScore = document.getElementById('finalScore');

    let score = 0, timeLeft = 30, gameOver = false, timer = null;
    const paddle = { x: 120, y: 420, w: 90, h: 10 };
    const ball = { x: 170, y: 400, r: 7, vx: 3.5, vy: -3.5 };

    const rows = 4, cols = 5;
    const brickW = 58, brickH = 22, padding = 8, offsetTop = 30, offsetLeft = 11;
    const ROW_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e']; // 红→橙→黄→绿：从冲动到冷静
    const WORDS20 = ['追高','梭哈','FOMO','杠杆','抄底','满仓','听消息','情绪化','All in','踏空','死扛','频繁交易','追涨','杀跌','借钱','内幕','短线','暴富','焦虑','从众'];
    let bricks = [], brickWords = [], floaters = [];

    function shuffled(a) {
      const r = a.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = r[i]; r[i] = r[j]; r[j] = t;
      }
      return r;
    }

    function initBricks() {
      brickWords = shuffled(WORDS20);
      bricks = [];
      for (let r = 0; r < rows; r++) {
        bricks[r] = [];
        for (let c = 0; c < cols; c++) bricks[r][c] = { x: 0, y: 0, status: 1 };
      }
    }

    // 挡板反弹时：把之前撞掉的砖块补满（词重新打乱），30 秒内砖块无限续上
    function refillBricks() {
      let missing = false;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (bricks[r][c].status === 0) { bricks[r][c].status = 1; missing = true; }
      if (missing) brickWords = shuffled(WORDS20);
    }

    function movePaddle(clientX) {
      const rect = canvas.getBoundingClientRect();
      paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, clientX - rect.left - paddle.w / 2));
    }

    canvas.addEventListener('mousemove', (e) => movePaddle(e.clientX));
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      movePaddle(e.touches[0].clientX);
    }, { passive: false });

    function resetBall() {
      ball.x = 170; ball.y = 400; ball.vx = 3.5; ball.vy = -3.5;
    }

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          timeText.innerText = \`剩余时间: \${timeLeft}s\`;
        } else {
          gameOver = true;
          clearInterval(timer);
          finalScore.innerText = score + ' 块';
          overlay.classList.add('show');
          window.parent.postMessage({ type: 'gushenle-game-event', game: 'cool30', score: score }, '*');
        }
      }, 1000);
    }

    function resetGame() {
      score = 0; timeLeft = 30; gameOver = false; floaters = [];
      resetBall();
      scoreText.innerText = "消除障碍: 0";
      timeText.innerText = "剩余时间: 30s";
      initBricks();
      overlay.classList.remove('show');
      startTimer();
    }

    function update() {
      if (gameOver) return;
      ball.x += ball.vx; ball.y += ball.vy;

      // 左右墙、顶墙：标准反弹（含位置修正防卡墙）
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      else if (ball.x + ball.r > canvas.width) { ball.x = canvas.width - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

      // 掉出底边：重置到挡板上方
      if (ball.y - ball.r > canvas.height) {
        resetBall();
        return;
      }

      // 挡板碰撞：仅当球正在下落、球底部落在挡板顶面附近、横向重叠时才反弹
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 8 &&
          ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
        ball.y = paddle.y - ball.r - 1; // 防粘连
        const speed = Math.hypot(ball.vx, ball.vy);
        const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const c = Math.max(-1, Math.min(1, rel));
        ball.vx = c * 6; // 中间衰减、边缘加大，最多 ±6
        ball.vy = -Math.sqrt(Math.max(speed * speed - ball.vx * ball.vx, 4)); // 保持球速，vy 至少为 2
        refillBricks(); // 挡板反弹：补满之前撞掉的砖块
      }

      // 砖块碰撞：按 x/y 轴侵入量，侵入小的轴翻转对应速度分量
      outer:
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const b = bricks[r][c];
          if (b.status !== 1) continue;
          const bx = offsetLeft + c * (brickW + padding);
          const by = offsetTop + r * (brickH + padding);
          b.x = bx; b.y = by;
          const overlapX = Math.min(ball.x + ball.r, bx + brickW) - Math.max(ball.x - ball.r, bx);
          const overlapY = Math.min(ball.y + ball.r, by + brickH) - Math.max(ball.y - ball.r, by);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              ball.vx *= -1;
              ball.x += (ball.x < bx + brickW / 2 ? -overlapX : overlapX);
            } else {
              ball.vy *= -1;
              ball.y += (ball.y < by + brickH / 2 ? -overlapY : overlapY);
            }
            b.status = 0;
            score++;
            floaters.push({ x: bx + brickW / 2, y: by, born: Date.now() });
            scoreText.innerText = \`消除障碍: \${score}\`;
            break outer; // 一帧只处理一块，避免乱跳
          }
        }
      }
      // 砖块清空自动补满（词重新打乱）
      if (bricks.every(row => row.every(b => b.status === 0))) initBricks();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 挡板
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

      // 球
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 砖块：按行渐变色 + 冲动词
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (bricks[r][c].status === 1) {
            const bx = offsetLeft + c * (brickW + padding);
            const by = offsetTop + r * (brickH + padding);
            ctx.fillStyle = ROW_COLORS[r];
            ctx.fillRect(bx, by, brickW, brickH);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(brickWords[r * cols + c], bx + brickW / 2, by + brickH / 2 + 1);
          }
        }
      }

      // "+1 斩心魔" 飘字
      const now = Date.now();
      floaters = floaters.filter(f => now - f.born < 600);
      floaters.forEach(f => {
        const t = (now - f.born) / 600;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('+1 斩心魔', f.x, f.y - t * 30);
      });
      ctx.globalAlpha = 1;
    }

    function loop() {
      update(); draw();
      requestAnimationFrame(loop);
    }

    initBricks();
    startTimer();
    loop();
  </script>
</body>
</html>`;

export default function Cool30Game() {
  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[520px] border-0 rounded-2xl overflow-hidden"
      title="Cool 30 Game"
    />
  );
}
