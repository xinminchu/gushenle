'use client';

import React, { useRef, useEffect, useState } from 'react';

interface ClipperGameProps {
  onFinish?: () => void;
}

interface Leek {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  isKLineUp: boolean;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

const LEEK_TEXTS = [
  '凭感觉买入', '割肉离场', '听小道消息', '追涨杀跌', 
  '满仓杠杆', '频繁交易', '恐慌抛售', '盲目抄底'
];

export default function ClipperGame({ onFinish }: ClipperGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [score, setScore] = useState(0);
  const [speedMode, setSpeedMode] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameActive, setGameActive] = useState(true);

  const leeksRef = useRef<Leek[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const isMouseDownRef = useRef(false);

  // 倒计时管理
  useEffect(() => {
    if (!gameActive) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameActive(false);
          if (onFinish) onFinish(); // 触发测试页面或外部的回调函数
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameActive, onFinish]);

  // 随机生成韭菜实体
  const spawnLeek = (canvasWidth: number, canvasHeight: number) => {
    const speedMultiplier = speedMode === 'slow' ? 0.8 : speedMode === 'fast' ? 2.2 : 1.4;
    const side = Math.floor(Math.random() * 4); // 0:下 1:上 2:左 3:右
    let x = 0, y = 0, vx = 0, vy = 0;

    if (side === 0) { // 下方飘升
      x = Math.random() * (canvasWidth - 80) + 40;
      y = canvasHeight + 20;
      vx = (Math.random() - 0.5) * 2;
      vy = -(Math.random() * 2 + 2) * speedMultiplier;
    } else if (side === 1) { // 上方落下
      x = Math.random() * (canvasWidth - 80) + 40;
      y = -20;
      vx = (Math.random() - 0.5) * 2;
      vy = (Math.random() * 2 + 2) * speedMultiplier;
    } else if (side === 2) { // 左侧滑出
      x = -20;
      y = Math.random() * (canvasHeight - 80) + 40;
      vx = (Math.random() * 2 + 2) * speedMultiplier;
      vy = (Math.random() - 0.5) * 2;
    } else { // 右侧滑出
      x = canvasWidth + 20;
      y = Math.random() * (canvasHeight - 80) + 40;
      vx = -(Math.random() * 2 + 2) * speedMultiplier;
      vy = (Math.random() - 0.5) * 2;
    }

    leeksRef.current.push({
      id: Date.now() + Math.random(),
      x,
      y,
      vx,
      vy,
      text: LEEK_TEXTS[Math.floor(Math.random() * LEEK_TEXTS.length)],
      isKLineUp: Math.random() > 0.5,
      size: 36
    });
  };

  // 渲染主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const now = Date.now();
      const width = canvas.width;
      const height = canvas.height;

      // 1. 清空画布
      ctx.clearRect(0, 0, width, height);

      // 维持场上 4~6 个韭菜气泡
      if (gameActive && leeksRef.current.length < 5 && Math.random() < 0.05) {
        spawnLeek(width, height);
      }

      // 2. 更新并绘制韭菜
      leeksRef.current.forEach((leek, index) => {
        leek.x += leek.vx;
        leek.y += leek.vy;

        ctx.save();
        ctx.translate(leek.x, leek.y);

        // 气泡卡片背景
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-60, -20, 120, 40, 10);
        ctx.fill();
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(leek.text, 5, 0);

        // K线红绿柱指示
        ctx.fillStyle = leek.isKLineUp ? '#ef4444' : '#22c55e';
        ctx.fillRect(48, -10, 4, 20);

        ctx.restore();

        // 超出屏幕边缘清除
        if (
          leek.x < -60 || leek.x > width + 60 ||
          leek.y < -60 || leek.y > height + 60
        ) {
          leeksRef.current.splice(index, 1);
        }
      });

      // 3. 绘制并消退切割轨迹线 (超过 150ms 自动消退，解决线段残留)
      trailRef.current = trailRef.current.filter((p) => now - p.time < 150);

      if (trailRef.current.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);

        for (let i = 1; i < trailRef.current.length; i++) {
          ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
        }

        ctx.strokeStyle = '#38bdf8'; // 飞刀青蓝荧光
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // 4. 切割碰撞判定
      if (trailRef.current.length >= 2 && gameActive) {
        const p2 = trailRef.current[trailRef.current.length - 1];

        leeksRef.current.forEach((leek, idx) => {
          const dist = Math.hypot(leek.x - p2.x, leek.y - p2.y);
          if (dist < 40) { // 命中切碎
            leeksRef.current.splice(idx, 1);
            setScore((s) => s + 1);
          }
        });
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [gameActive, speedMode]);

  // 动态计算尺寸，防止移动端超宽溢出
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(rect.width - 16, 380);
        canvasRef.current.width = size;
        canvasRef.current.height = size * 1.1;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 手势/指针划动处理
  const addPoint = (x: number, y: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = x - rect.left;
    const py = y - rect.top;
    trailRef.current.push({ x: px, y: py, time: Date.now() });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isMouseDownRef.current = true;
    addPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isMouseDownRef.current) return;
    addPoint(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  const restartGame = () => {
    setScore(0);
    setTimeLeft(20);
    setGameActive(true);
    leeksRef.current = [];
    trailRef.current = [];
  };

  return (
    <div ref={containerRef} className="w-full flex flex-col items-center select-none touch-none">
      {/* 顶部控制与指示 */}
      <div className="w-full bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-emerald-400 font-medium">🌱 已割韭菜: {score}</span>
          <span className="text-amber-400 font-medium">⏳ 倒计时: {timeLeft}s</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 px-1">
          <span>飘升速度:</span>
          <div className="flex gap-1">
            {(['slow', 'normal', 'fast'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSpeedMode(mode)}
                className={`px-2 py-0.5 rounded transition text-[10px] ${
                  speedMode === mode
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {mode === 'slow' ? '悠闲' : mode === 'normal' ? '标准' : '暴走'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 画布自适应容器 */}
      <div className="w-full flex justify-center items-center bg-slate-950 rounded-2xl p-2 border border-slate-800 shadow-inner relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="bg-slate-900 rounded-xl cursor-crosshair touch-none max-w-full"
        />

        {/* 结算弹窗 */}
        {!gameActive && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
            <div className="text-3xl mb-2">🧘‍♂️</div>
            <h3 className="text-lg font-bold text-emerald-400 mb-1">理性已回归！</h3>
            <p className="text-xs text-slate-300 mb-4">
              你成功切碎了 <span className="text-emerald-400 font-bold">{score}</span> 株冲动韭菜！<br />
              <span className="text-[10px] text-slate-400">“市场永远不缺机会，冷静才是最大的红利。”</span>
            </p>
            <button
              onClick={restartGame}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-lg transition"
            >
              🔄 再割一把
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 mt-2 text-center">
        手指/光标滑动割断韭菜气泡，冷静 20 秒
      </p>
    </div>
  );
}