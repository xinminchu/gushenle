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
      position: absolute; top: 12px; left: 16px; right: 16px;
      display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;
      z-index: 10; color: #4ade80; background: rgba(15, 23, 42, 0.7);
      padding: 8px 16px; border-radius: 20px; backdrop-filter: blur(4px);
    }
    canvas { background: #111827; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); cursor: crosshair; touch-action: none; }
    
    /* 结算弹窗 */
    .overlay {
      position: absolute; inset: 0; background: rgba(11, 15, 25, 0.9);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 20; opacity: 0; pointer-events: none; transition: opacity 0.3s;
    }
    .overlay.show { opacity: 1; pointer-events: auto; }
    .overlay-title { font-size: 24px; font-weight: bold; color: #f59e0b; margin-bottom: 10px; }
    .overlay-score { font-size: 40px; font-weight: 800; color: #4ade80; margin-bottom: 20px; }
    .btn-retry {
      background: linear-gradient(135deg, #22c55e, #16a34a); color: white;
      border: none; padding: 12px 32px; font-size: 16px; font-weight: bold;
      border-radius: 24px; cursor: pointer; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
    }
    .btn-retry:active { transform: scale(0.96); }
  </style>
</head>
<body>
  <div class="hud">
    <span id="scoreText">得分: 0</span>
    <span id="timeText">倒计时: 30s</span>
  </div>
  <canvas id="canvas" width="350" height="520"></canvas>

  <div class="overlay" id="overlay">
    <div class="overlay-title">🎉 挑战结束</div>
    <div style="color: #94a3b8; font-size: 14px; margin-bottom: 5px;">本局斩获韭菜得分</div>
    <div class="overlay-score" id="finalScore">0</div>
    <button class="btn-retry" onclick="resetGame()">再来一次 🔄</button>
  </div>

  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const scoreText = document.getElementById('scoreText');
    const timeText = document.getElementById('timeText');
    const overlay = document.getElementById('overlay');
    const finalScore = document.getElementById('finalScore');

    let score = 0, timeLeft = 30, gameOver = false, timer = null;
    const wordsList = ['追高', '梭哈', '抄底', '杠杆', '爆仓', 'FOMO', '听信内幕', '凭感觉', '情绪化'];

    class Target {
      constructor() {
        this.text = wordsList[Math.floor(Math.random() * wordsList.length)];
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = canvas.height + 30;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = -(Math.random() * 3 + 9);
        this.gravity = 0.22;
        this.radius = 36;
        this.sliced = false;
      }
      update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; }
      draw() {
        if (this.sliced) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
      }
    }

    let targets = [], trail = [];

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          timeText.innerText = \`倒计时: \${timeLeft}s\`;
        } else {
          endGame();
        }
      }, 1000);
    }

    function endGame() {
      gameOver = true;
      clearInterval(timer);
      finalScore.innerText = score;
      overlay.classList.add('show');
    }

    function resetGame() {
      score = 0; timeLeft = 30; gameOver = false; targets = []; trail = [];
      scoreText.innerText = "得分: 0";
      timeText.innerText = "倒计时: 30s";
      overlay.classList.remove('show');
      startTimer();
    }

    setInterval(() => {
      if (!gameOver && targets.length < 4) targets.push(new Target());
    }, 700);

    function addPoint(x, y) {
      if (gameOver) return;
      trail.push({ x, y, time: Date.now() });
      targets.forEach(t => {
        if (!t.sliced && Math.hypot(t.x - x, t.y - y) < t.radius) {
          t.sliced = true;
          score += 10;
          scoreText.innerText = \`得分: \${score}\`;
        }
      });
    }

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      addPoint(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      addPoint(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
    }, { passive: false });

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      targets.forEach((t, index) => {
        t.update(); t.draw();
        if (t.y > canvas.height + 50) targets.splice(index, 1);
      });

      const now = Date.now();
      trail = trail.filter(p => now - p.time < 120);
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      requestAnimationFrame(animate);
    }

    startTimer();
    animate();
  </script>
</body>
</html>`;

export default function ClipperGame() {
  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[560px] border-0 rounded-2xl overflow-hidden"
      title="Clipper Game"
    />
  );
}