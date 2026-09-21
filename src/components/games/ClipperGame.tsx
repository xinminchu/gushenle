'use client';

import React from 'react';

const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0; padding: 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; overflow: hidden; touch-action: none;
    }
    .hud { position: absolute; top: 15px; left: 20px; font-size: 18px; font-weight: bold; z-index: 10; color: #4ade80; }
    canvas { background: #111827; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); cursor: crosshair; }
  </style>
</head>
<body>
  <div class="hud" id="hud">得分: 0 | 倒计时: 30s</div>
  <canvas id="canvas" width="380" height="600"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const hud = document.getElementById('hud');

    let score = 0;
    let timeLeft = 30;
    let gameOver = false;
    const wordsList = ['追高', '梭哈', '抄底', '杠杆', '爆仓', 'FOMO', '盲目听信', '凭感觉', '情绪化'];

    class Target {
      constructor() {
        this.text = wordsList[Math.floor(Math.random() * wordsList.length)];
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = canvas.height + 30;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = -(Math.random() * 4 + 10);
        this.gravity = 0.25;
        this.radius = 40;
        this.sliced = false;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
      }
      draw() {
        if (this.sliced) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
      }
    }

    let targets = [];
    let trail = [];

    setInterval(() => {
      if (!gameOver && targets.length < 5) {
        targets.push(new Target());
      }
    }, 800);

    const timer = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
      } else {
        gameOver = true;
        clearInterval(timer);
      }
    }, 1000);

    function addPoint(x, y) {
      trail.push({ x, y, time: Date.now() });
      targets.forEach(t => {
        if (!t.sliced && Math.hypot(t.x - x, t.y - y) < t.radius) {
          t.sliced = true;
          score += 10;
        }
      });
    }

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      addPoint(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('touchmove', (e) => {
      const rect = canvas.getBoundingClientRect();
      addPoint(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
    });

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      targets.forEach((t, index) => {
        t.update();
        t.draw();
        if (t.y > canvas.height + 50) targets.splice(index, 1);
      });

      const now = Date.now();
      trail = trail.filter(p => now - p.time < 150);
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (!gameOver) {
        hud.innerText = \`得分: \${score} | 倒计时: \${timeLeft}s\`;
      } else {
        hud.innerText = \`🎉 时间到！最终得分: \${score} (点击屏幕重新开始)\`;
      }
      requestAnimationFrame(animate);
    }

    canvas.addEventListener('click', () => {
      if (gameOver) {
        score = 0; timeLeft = 30; gameOver = false; targets = [];
      }
    });

    animate();
  </script>
</body>
</html>`;

export default function ClipperGame() {
  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-[650px] border-0 rounded-xl"
      title="Clipper Game"
    />
  );
}