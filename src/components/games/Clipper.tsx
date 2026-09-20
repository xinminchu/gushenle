'use client';

import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useLanguage } from '@/context/LanguageContext';

interface Bubble {
  id: number;
  text: string;
  x: number;
  y: number;
  vx: number; // X 轴移动速度
  vy: number; // Y 轴移动速度
  width: number;
  height: number;
  rotation: number;
  klineIsGreen1: boolean;
  klineIsGreen2: boolean;
}

export default function ClipperGame({ onFinish }: { onFinish?: () => void }) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slicedCount, setSlicedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameOver, setGameOver] = useState(false);
  const [speedLevel, setSpeedLevel] = useState<'slow' | 'normal' | 'fast'>('normal');

  const bubblesRef = useRef<Bubble[]>([]);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const speedMultipliers = {
    slow: 0.8,
    normal: 1.6,
    fast: 2.8,
  };

  const restartGame = () => {
    bubblesRef.current = [];
    trailRef.current = [];
    setSlicedCount(0);
    setTimeLeft(20);
    setGameOver(false);
  };

  // 生成从不同边缘发射的气泡
  useEffect(() => {
    if (gameOver) return;
    const intervalTime = speedLevel === 'fast' ? 450 : speedLevel === 'normal' ? 650 : 900;
    const emotionalWords = t('words') as string[];

    const interval = setInterval(() => {
      const text = emotionalWords[Math.floor(Math.random() * emotionalWords.length)];
      const baseSpeed = (Math.random() * 1.2 + 1) * speedMultipliers[speedLevel];
      
      const canvasWidth = 380;
      const canvasHeight = 420;

      // 随机选择 4 个起点边缘：0:下->上, 1:左->右, 2:右->左, 3:上->下
      const spawnSide = Math.floor(Math.random() * 4);
      let x = 0, y = 0, vx = 0, vy = 0;

      if (spawnSide === 0) { // 下边升起
        x = Math.random() * (canvasWidth - 120) + 60;
        y = canvasHeight + 40;
        vx = (Math.random() - 0.5) * 1.5;
        vy = -baseSpeed;
      } else if (spawnSide === 1) { // 左边飞入
        x = -70;
        y = Math.random() * (canvasHeight - 120) + 60;
        vx = baseSpeed;
        vy = (Math.random() - 0.5) * 1.5;
      } else if (spawnSide === 2) { // 右边飞入
        x = canvasWidth + 70;
        y = Math.random() * (canvasHeight - 120) + 60;
        vx = -baseSpeed;
        vy = (Math.random() - 0.5) * 1.5;
      } else { // 上边降下
        x = Math.random() * (canvasWidth - 120) + 60;
        y = -40;
        vx = (Math.random() - 0.5) * 1.5;
        vy = baseSpeed;
      }

      bubblesRef.current.push({
        id: Date.now() + Math.random(),
        text,
        x,
        y,
        vx,
        vy,
        width: 135,
        height: 55,
        rotation: (Math.random() - 0.5) * 0.4,
        klineIsGreen1: Math.random() > 0.4,
        klineIsGreen2: Math.random() > 0.5,
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [gameOver, speedLevel, t]);

  // 倒计时
  useEffect(() => {
    if (gameOver) return;
    if (timeLeft <= 0) {
      setGameOver(true);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, gameOver]);

  // Canvas 绘制与逐帧移动
  useEffect(() => {
    if (gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. 刀光轨迹
      if (trailRef.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
        for (let i = 1; i < trailRef.current.length; i++) {
          ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
        }
        ctx.stroke();
      }

      // 2. 更新位置并绘制气泡
      bubblesRef.current.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation);

        // A. 气泡外框底板
        ctx.beginPath();
        ctx.roundRect(-b.width / 2, -b.height / 2, b.width, b.height, 16);
        ctx.fillStyle = '#f0fdf4';
        ctx.shadowColor = 'rgba(16, 185, 129, 0.3)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#22c55e';
        ctx.stroke();

        ctx.shadowBlur = 0;

        // B. 左侧韭菜
        ctx.save();
        ctx.translate(-b.width / 2 + 18, 0);

        ctx.beginPath();
        ctx.ellipse(-6, 2, 4, 15, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#16a34a';
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(0, -2, 5, 19, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(6, 2, 4, 14, 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#4ade80';
        ctx.fill();

        ctx.fillStyle = '#a16207';
        ctx.fillRect(-8, 11, 16, 4);
        ctx.restore();

        // C. 右侧 K 线柱
        ctx.save();
        ctx.translate(b.width / 2 - 26, 0);

        const kColor1 = b.klineIsGreen1 ? '#22c55e' : '#ef4444';
        ctx.strokeStyle = kColor1;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, -13);
        ctx.lineTo(-8, 13);
        ctx.stroke();
        ctx.fillStyle = kColor1;
        ctx.fillRect(-12, -7, 8, 14);

        const kColor2 = b.klineIsGreen2 ? '#22c55e' : '#ef4444';
        ctx.strokeStyle = kColor2;
        ctx.beginPath();
        ctx.moveTo(8, -15);
        ctx.lineTo(8, 15);
        ctx.stroke();
        ctx.fillStyle = kColor2;
        ctx.fillRect(4, -9, 8, 16);

        ctx.restore();

        // D. 情绪文字
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.text, 2, 1);

        ctx.restore();
      });

      // 过滤完全移出屏幕视野的气泡
      bubblesRef.current = bubblesRef.current.filter((b) => {
        return (
          b.x > -100 &&
          b.x < canvas.width + 100 &&
          b.y > -100 &&
          b.y < canvas.height + 100
        );
      });

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [gameOver]);

  // 划线切割判定
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    trailRef.current.push({ x, y });
    if (trailRef.current.length > 8) trailRef.current.shift();

    bubblesRef.current = bubblesRef.current.filter((b) => {
      const inX = Math.abs(b.x - x) < b.width / 2 + 8;
      const inY = Math.abs(b.y - y) < b.height / 2 + 8;
      if (inX && inY) {
        setSlicedCount((prev) => prev + 1);
        return false;
      }
      return true;
    });
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 text-white rounded-2xl max-w-md mx-auto shadow-2xl border border-slate-800">
      <div className="flex justify-between items-center w-full mb-3 px-1">
        <span className="text-sm font-semibold text-emerald-400">{t('slicedCount')}: {slicedCount}</span>
        <span className="text-sm font-semibold text-amber-400">{t('timeLeft')}: {timeLeft}s</span>
      </div>

      <div className="flex items-center gap-2 mb-4 w-full justify-end text-xs">
        <span className="text-slate-400">{t('speedLabel')}:</span>
        {(['slow', 'normal', 'fast'] as const).map((level) => (
          <button
            key={level}
            onClick={() => {
              setSpeedLevel(level);
              restartGame();
            }}
            className={`px-2.5 py-1 rounded font-medium transition ${
              speedLevel === level
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {level === 'slow' ? t('speedSlow') : level === 'normal' ? t('speedNormal') : t('speedFast')}
          </button>
        ))}
      </div>

      {!gameOver ? (
        <canvas
          ref={canvasRef}
          width={380}
          height={420}
          onMouseMove={handleMouseMove}
          className="bg-slate-950 rounded-xl cursor-crosshair border border-slate-800 touch-none shadow-inner"
        />
      ) : (
        <div className="h-[420px] w-[380px] flex flex-col items-center justify-center text-center p-6 bg-slate-950 rounded-xl border border-emerald-500/30">
          <div className="text-5xl mb-4">🧘</div>
          <h3 className="text-xl font-bold text-emerald-400 mb-2">{t('calmTitle')}</h3>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed whitespace-pre-line">
            {t('calmDesc', { count: slicedCount })}
          </p>
          <div className="flex gap-3">
            <button
              onClick={restartGame}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg transition text-sm"
            >
              {t('playAgain')}
            </button>
            <button
              onClick={() => {
                restartGame();
                onFinish?.();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2 rounded-lg transition text-sm"
            >
              {t('returnDecision')}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3">{t('gameTip')}</p>
    </div>
  );
}