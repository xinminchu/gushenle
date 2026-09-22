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

    .toolbar { margin-top: 10px; z-index: 10; }
    .btn-words {
      background: rgba(30, 41, 59, 0.9); color: #93c5fd; border: 1px solid #334155;
      padding: 8px 18px; font-size: 14px; font-weight: bold; border-radius: 20px; cursor: pointer;
    }
    .btn-words:active { transform: scale(0.96); }

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

    /* 自定义词面板 */
    .panel {
      position: absolute; top: 50%; left: 50%; width: 300px; max-width: 86%;
      transform: translate(-50%, -50%) scale(0.95);
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      padding: 16px; z-index: 30; opacity: 0; pointer-events: none; transition: all 0.25s;
      box-shadow: 0 12px 32px rgba(0,0,0,0.6);
    }
    .panel.show { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
    .panel-title { font-size: 16px; font-weight: bold; color: #93c5fd; margin-bottom: 10px; text-align: center; }
    .panel-row { display: flex; gap: 8px; }
    #wordInput {
      flex: 1; background: #0f172a; border: 1px solid #334155; color: #fff;
      border-radius: 10px; padding: 8px 10px; font-size: 14px; outline: none;
      user-select: text; -webkit-user-select: text; min-width: 0;
    }
    .btn-add {
      background: #22c55e; color: #fff; border: none; border-radius: 10px;
      padding: 8px 14px; font-size: 14px; font-weight: bold; cursor: pointer; flex-shrink: 0;
    }
    .btn-add:active { transform: scale(0.95); }
    .word-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; max-height: 150px; overflow-y: auto; }
    .chip { font-size: 12px; padding: 4px 8px; border-radius: 12px; background: #334155; color: #cbd5e1; }
    .chip.default { opacity: 0.45; }
    .chip.user { background: #065f46; color: #a7f3d0; }
    .chip.user b { cursor: pointer; margin-left: 2px; color: #f87171; font-weight: bold; }
    .panel-hint { font-size: 11px; color: #64748b; text-align: center; margin-bottom: 10px; }
    .btn-close {
      width: 100%; background: #334155; color: #e2e8f0; border: none;
      padding: 10px; font-size: 14px; font-weight: bold; border-radius: 12px; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="hud">
    <span id="scoreText">得分: 0</span>
    <span id="timeText">倒计时: 30s</span>
  </div>
  <canvas id="canvas" width="350" height="520"></canvas>
  <div class="toolbar">
    <button class="btn-words" onclick="togglePanel(true)">✏️ 自定义词</button>
  </div>

  <div class="panel" id="wordPanel">
    <div class="panel-title">✏️ 自定义冲动词</div>
    <div class="panel-row">
      <input id="wordInput" placeholder="输入你的冲动词，如：熬夜看盘" maxlength="8" />
      <button class="btn-add" onclick="addUserWord()">添加</button>
    </div>
    <div class="word-list" id="wordList"></div>
    <div class="panel-hint">灰色是默认词（不可删）；绿色是你的词，点 × 可删</div>
    <button class="btn-close" onclick="togglePanel(false)">关闭</button>
  </div>

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
    const wordPanel = document.getElementById('wordPanel');
    const wordInput = document.getElementById('wordInput');
    const wordList = document.getElementById('wordList');

    const DEFAULT_WORDS = ['追高','梭哈','抄底','杠杆','爆仓','FOMO','听内幕','凭感觉','情绪化','满仓','摊平加仓','频繁交易','听大V','All in','借钱炒股','追涨杀跌','重仓一只','短线神话','一夜暴富','死扛','割肉','踏空焦虑','别人涨我慌','杀跌'];
    const STORE_KEY = 'gushenle:clipper:words:v1';
    let userWords = [];
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) userWords = arr.filter(function(w){ return typeof w === 'string' && w.trim(); }).slice(0, 50);
    } catch (e) { userWords = []; }
    function saveUserWords() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(userWords)); } catch (e) {}
    }
    function wordPool() { return DEFAULT_WORDS.concat(userWords); }

    let score = 0, timeLeft = 30, gameOver = false, paused = false, timer = null;
    const SHAPES = ['circle', 'square', 'diamond', 'star'];

    function starPath(x, y, r, rot) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = rot + i * Math.PI / 5 - Math.PI / 2;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    class Target {
      constructor() {
        const pool = wordPool();
        this.text = pool[Math.floor(Math.random() * pool.length)];
        this.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        this.r = 46;
        this.sliced = false;
        // 八方飞入：随机选一条边，沿边随机位置，朝屏幕内侧 ±40° 飞入
        const speed = 3 + Math.random() * 3;
        const spread = 40 * Math.PI / 180;
        const edge = Math.floor(Math.random() * 4);
        let base;
        if (edge === 0) {          // 上边 → 朝下飞
          this.x = 60 + Math.random() * (canvas.width - 120); this.y = -60; base = Math.PI / 2;
        } else if (edge === 1) {   // 下边 → 朝上飞
          this.x = 60 + Math.random() * (canvas.width - 120); this.y = canvas.height + 60; base = -Math.PI / 2;
        } else if (edge === 2) {   // 左边 → 朝右飞
          this.x = -60; this.y = 80 + Math.random() * (canvas.height - 160); base = 0;
        } else {                   // 右边 → 朝左飞
          this.x = canvas.width + 60; this.y = 80 + Math.random() * (canvas.height - 160); base = Math.PI;
        }
        const a = base + (Math.random() * 2 - 1) * spread;
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;
        this.gravity = 0.05;
        this.rot = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.06;
      }
      update() {
        this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.rot += this.spin;
      }
      hit(px, py) {
        const dx = px - this.x, dy = py - this.y;
        if (this.shape === 'circle' || this.shape === 'star') return dx * dx + dy * dy < this.r * this.r;
        if (this.shape === 'square') return Math.abs(dx) < this.r && Math.abs(dy) < this.r;
        return Math.abs(dx) + Math.abs(dy) < this.r; // diamond
      }
      draw() {
        if (this.sliced) return;
        ctx.save();
        if (this.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        } else if (this.shape === 'square') {
          ctx.beginPath();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.rot);
          ctx.rect(-this.r, -this.r, this.r * 2, this.r * 2);
        } else if (this.shape === 'diamond') {
          const c = Math.cos(this.rot), s = Math.sin(this.rot);
          const pts = [[0, -this.r], [this.r, 0], [0, this.r], [-this.r, 0]];
          ctx.beginPath();
          pts.forEach(function(p, i) {
            const px = this.x + p[0] * c - p[1] * s;
            const py = this.y + p[0] * s + p[1] * c;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }, this);
          ctx.closePath();
        } else {
          starPath(this.x, this.y, this.r, this.rot);
        }
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
      }
    }

    let targets = [], trail = [], particles = [];

    function burst(x, y) {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
        particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 });
      }
    }

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(() => {
        if (paused) return;
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
      score = 0; timeLeft = 30; gameOver = false; targets = []; trail = []; particles = [];
      scoreText.innerText = "得分: 0";
      timeText.innerText = "倒计时: 30s";
      overlay.classList.remove('show');
      startTimer();
    }

    setInterval(() => {
      if (!gameOver && !paused && targets.length < 5) targets.push(new Target());
    }, 600);

    function addPoint(x, y) {
      if (gameOver || paused) return;
      trail.push({ x, y, time: Date.now() });
      targets.forEach(t => {
        if (!t.sliced && t.hit(x, y)) {
          t.sliced = true;
          burst(t.x, t.y);
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

    // ---- 自定义词面板 ----
    function togglePanel(open) {
      paused = open;
      wordPanel.classList.toggle('show', open);
      if (open) { renderWordList(); setTimeout(() => wordInput.focus(), 300); }
    }

    function renderWordList() {
      wordList.innerHTML = '';
      DEFAULT_WORDS.forEach(function(w) {
        const s = document.createElement('span');
        s.className = 'chip default';
        s.textContent = w;
        wordList.appendChild(s);
      });
      userWords.forEach(function(w, i) {
        const s = document.createElement('span');
        s.className = 'chip user';
        s.textContent = w + ' ';
        const b = document.createElement('b');
        b.textContent = '×';
        b.onclick = function() { userWords.splice(i, 1); saveUserWords(); renderWordList(); };
        s.appendChild(b);
        wordList.appendChild(s);
      });
      if (userWords.length === 0) {
        const hint = document.createElement('span');
        hint.style.cssText = 'font-size:12px;color:#64748b;';
        hint.textContent = '还没有自定义词，上面输入框添加一个吧';
        wordList.appendChild(hint);
      }
    }

    function addUserWord() {
      const w = wordInput.value.trim();
      if (!w) return;
      if (wordPool().indexOf(w) !== -1) { wordInput.value = ''; return; }
      userWords.push(w);
      saveUserWords();
      wordInput.value = '';
      renderWordList();
    }
    wordInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addUserWord();
    });

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!paused) {
        targets.forEach(t => t.update());
        particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.04; });
        particles = particles.filter(p => p.life > 0);
      }
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.draw();
        if (t.x < -70 || t.x > canvas.width + 70 || t.y < -70 || t.y > canvas.height + 70) targets.splice(i, 1);
      }

      // 切中粒子闪光
      particles.forEach(p => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

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
      className="w-full h-[620px] border-0 rounded-2xl overflow-hidden"
      title="Clipper Game"
    />
  );
}
