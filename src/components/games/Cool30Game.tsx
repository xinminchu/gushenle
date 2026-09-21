<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>沉思撞球 30 秒</title>
  <style>
    body {
      margin: 0; background: #0b0f19; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .hud { margin-bottom: 10px; font-size: 16px; font-weight: bold; color: #38bdf8; }
    canvas { background: #1e293b; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); cursor: crosshair; }
  </style>
</head>
<body>

  <div class="hud" id="hud">消除砖块: 0 | 剩余时间: 30s</div>
  <canvas id="canvas" width="380" height="550"></canvas>

<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');

let score = 0;
let timeLeft = 30;
let gameOver = false;

// 挡板
const paddle = { x: 140, y: 500, w: 100, h: 12, speed: 8 };
// 小球
const ball = { x: 190, y: 480, r: 8, vx: 4, vy: -4 };

// 砖块生成
const rows = 4, cols = 5;
const brickW = 65, brickH = 25, padding = 8, offsetTop = 40, offsetLeft = 12;
let bricks = [];

function initBricks() {
  bricks = [];
  for (let r = 0; r < rows; r++) {
    bricks[r] = [];
    for (let c = 0; c < cols; c++) {
      bricks[r][c] = { x: 0, y: 0, status: 1 };
    }
  }
}
initBricks();

// 鼠标/手指控制挡板
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  paddle.x = e.clientX - rect.left - paddle.w / 2;
});

canvas.addEventListener('touchmove', (e) => {
  const rect = canvas.getBoundingClientRect();
  paddle.x = e.touches[0].clientX - rect.left - paddle.w / 2;
});

// 30秒倒计时
const timer = setInterval(() => {
  if (timeLeft > 0) {
    timeLeft--;
  } else {
    gameOver = true;
    clearInterval(timer);
  }
}, 1000);

function update() {
  if (gameOver) return;

  // 1. 小球移动
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 墙壁反弹
  if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.vx *= -1;
  if (ball.y - ball.r < 0) ball.vy *= -1;

  // 触底重置小球
  if (ball.y + ball.r > canvas.height) {
    ball.x = 190; ball.y = 480; ball.vx = 4; ball.vy = -4;
  }

  // 2. 挡板碰撞
  if (ball.y + ball.r >= paddle.y && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
    ball.vy = -Math.abs(ball.vy);
  }

  // 3. 砖块碰撞
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
        }
      }
    }
  }

  // 所有砖块打完自动重置砖块
  if (bricks.every(row => row.every(b => b.status === 0))) {
    initBricks();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制挡板
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  // 绘制小球
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 绘制砖块
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

  if (!gameOver) {
    hud.innerText = `消除砖块: ${score} | 剩余时间: ${timeLeft}s`;
  } else {
    hud.innerText = `🎉 时间到！共消除 ${score} 块障碍`;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
</script>
</body>
</html>