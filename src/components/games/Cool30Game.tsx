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
    let bricks = [];

    function initBricks() {
      bricks = [];
      for (let r = 0; r < rows; r++) {
        bricks[r] = [];
        for (let c = 0; c < cols; c++) bricks[r][c] = { x: 0, y: 0, status: 1 };
      }
    }

    function movePaddle(clientX) {
      const rect = canvas.getBoundingClientRect();
      paddle.x = clientX - rect.left - paddle.w / 2;
    }

    canvas.addEventListener('mousemove', (e) => movePaddle(e.clientX));
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      movePaddle(e.touches[0].clientX);
    }, { passive: false });

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
        }
      }, 1000);
    }

    function resetGame() {
      score = 0; timeLeft = 30; gameOver = false;
      ball.x = 170; ball.y = 400; ball.vx = 3.5; ball.vy = -3.5;
      scoreText.innerText = "消除障碍: 0";
      timeText.innerText = "剩余时间: 30s";
      initBricks();
      overlay.classList.remove('show');
      startTimer();
    }

    function update() {
      if (gameOver) return;
      ball.x += ball.vx; ball.y += ball.vy;

      if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.vx *= -1;
      if (ball.y - ball.r < 0) ball.vy *= -1;

      if (ball.y + ball.r > canvas.height) {
        ball.x = 170; ball.y = 400; ball.vx = 3.5; ball.vy = -3.5;
      }

      if (ball.y + ball.r >= paddle.y && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
        ball.vy = -Math.abs(ball.vy);
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let b = bricks[r][c];
          if (b.status === 1) {
            let bx = offsetLeft + c * (brickW + padding);
            let by = offsetTop + r * (brickH + padding);
            b.x = bx; b.y = by;

            if (ball.x > bx && ball.x < bx + brickW && ball.y > by && ball.y < by + brickH) {
              ball.vy *= -1;
              b.status = 0;
              score++;
              scoreText.innerText = \`消除障碍: \${score}\`;
            }
          }
        }
      }
      if (bricks.every(row => row.every(b => b.status === 0))) initBricks();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (bricks[r][c].status === 1) {
            let bx = offsetLeft + c * (brickW + padding);
            let by = offsetTop + r * (brickH + padding);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(bx, by, brickW, brickH);
          }
        }
      }
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