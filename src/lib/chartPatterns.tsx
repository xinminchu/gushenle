/**
 * 股民必备手册 · 图鉴库（静态数据 + SVG 现画，零图片资源）
 * 24 个图例 × 4 大主题：K线形态 / 均线系统 / 经典形态 / 量价分时
 * 每个图例：id / 主题 / 名称（正确答案）/ SVG 画法 / 大白话解析 / 难度
 * 增补图例：按同样结构追加一个对象即可，测验自动收录。
 */
import React from 'react';

export type ChartThemeKey = 'candle' | 'ma' | 'shape' | 'volume';

export interface ChartTheme {
  key: ChartThemeKey;
  name: string;
  emoji: string;
  desc: string;
}

export interface ChartPattern {
  id: string;
  theme: ChartThemeKey;
  name: string;
  art: () => React.ReactElement;
  explanation: string;
  difficulty: 1 | 2 | 3;
}

export const CHART_THEMES: ChartTheme[] = [
  { key: 'candle', name: 'K线形态', emoji: '🕯️', desc: '一根K线里的多空故事' },
  { key: 'ma', name: '均线系统', emoji: '📈', desc: '金叉死叉多头空头' },
  { key: 'shape', name: '经典形态', emoji: '🔷', desc: 'M头W底头肩箱体' },
  { key: 'volume', name: '量价分时', emoji: '🔊', desc: '量能配合与分时长相' },
];

/* ---------------- SVG 基础件（300×170，暗底网格，还原视频质感） ---------------- */

const RED = '#ef4444';
const GREEN = '#22c55e';
const AMBER = '#fbbf24';

function Grid() {
  return (
    <g stroke="#1e293b" strokeWidth={1}>
      {Array.from({ length: 7 }, (_, i) => (
        <line key={'v' + i} x1={30 + i * 40} y1={8} x2={30 + i * 40} y2={162} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={'h' + i} x1={10} y1={22 + i * 30} x2={290} y2={22 + i * 30} />
      ))}
    </g>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 300 170" className="w-full h-auto rounded-xl" role="img">
      <rect x={0} y={0} width={300} height={170} rx={12} fill="#0b1220" />
      <Grid />
      {children}
    </svg>
  );
}

function Candle({
  x,
  open,
  close,
  high,
  low,
  w = 16,
}: {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  w?: number;
}) {
  const bull = close <= open; // 屏幕坐标 y 越小价格越高
  const color = bull ? GREEN : RED; // 股神乐约定：绿涨红跌
  const top = Math.min(open, close);
  const bodyH = Math.max(Math.abs(close - open), 3);
  return (
    <g>
      <line x1={x} y1={high} x2={x} y2={low} stroke={color} strokeWidth={2.5} />
      <rect x={x - w / 2} y={top} width={w} height={bodyH} fill={color} rx={1.5} />
    </g>
  );
}

function P({
  pts,
  color = '#e2e8f0',
  width = 2.5,
  dash,
}: {
  pts: [number, number][];
  color?: string;
  width?: number;
  dash?: string;
}) {
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash}
    />
  );
}

function VolBars({ xs, hs, color }: { xs: number[]; hs: number[]; color: string }) {
  return (
    <g>
      <line x1={10} y1={160} x2={290} y2={160} stroke="#334155" strokeWidth={1} />
      {xs.map((x, i) => (
        <rect key={i} x={x - 11} y={160 - hs[i]} width={22} height={hs[i]} fill={color} opacity={0.85} rx={1.5} />
      ))}
    </g>
  );
}

const MA5C = '#fbbf24';
const MA10C = '#60a5fa';
const MA20C = '#c084fc';

function MaLabel({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <text x={x} y={y} fontSize={11} fontWeight={700} fill={color}>
      {text}
    </text>
  );
}

/* ---------------- 24 个图例 ---------------- */

export const CHART_PATTERNS: ChartPattern[] = [
  // ---- K线形态 ----
  {
    id: 'long-upper',
    theme: 'candle',
    name: '长上影线',
    art: () => (
      <Frame>
        <Candle x={150} open={122} close={106} high={28} low={128} />
      </Frame>
    ),
    explanation:
      '价格往上冲的时候，上方突然杀出抛盘，硬生生把价格砸了下来——说明上方压力很大，别追高，最好观望等回调。',
    difficulty: 1,
  },
  {
    id: 'long-lower',
    theme: 'candle',
    name: '长下影线',
    art: () => (
      <Frame>
        <Candle x={150} open={62} close={46} high={40} low={142} />
      </Frame>
    ),
    explanation:
      '价格往下跌到低位时，底下有资金疯狂接盘，又把价格拉了回来——说明下方有人护盘，是常见的见底信号之一。',
    difficulty: 1,
  },
  {
    id: 'bare-bull',
    theme: 'candle',
    name: '光头大阳线',
    art: () => (
      <Frame>
        <Candle x={150} open={132} close={38} high={38} low={132} w={26} />
      </Frame>
    ),
    explanation:
      '没有上影线，开盘就是最低、收盘就是最高——买方力量完全碾压卖方，上涨一气呵成没遇到像样抵抗，多头强势的表现。',
    difficulty: 1,
  },
  {
    id: 'bare-bear',
    theme: 'candle',
    name: '光头大阴线',
    art: () => (
      <Frame>
        <Candle x={150} open={38} close={132} high={38} low={132} w={26} />
      </Frame>
    ),
    explanation:
      '没有下影线，开盘就是最高、收盘就是最低——卖方一路碾压，几乎没遇到买盘抵抗，空头强势，持有的话要当心。',
    difficulty: 2,
  },
  {
    id: 'doji',
    theme: 'candle',
    name: '十字星',
    art: () => (
      <Frame>
        <Candle x={150} open={86} close={82} high={34} low={136} />
      </Frame>
    ),
    explanation:
      '实体小到几乎看不见，上下影线都不短——多空厮杀一整天谁也没赢，方向完全不明。最聪明的办法：观望，等方向明确再动手。',
    difficulty: 1,
  },
  {
    id: 't-line',
    theme: 'candle',
    name: 'T字线',
    art: () => (
      <Frame>
        <Candle x={150} open={54} close={57} high={54} low={140} w={34} />
      </Frame>
    ),
    explanation:
      '开盘≈收盘≈最高价，拖着一条长下影线——盘中被砸下去又被强势拉回，底下有人护盘，是偏强的信号。',
    difficulty: 2,
  },
  {
    id: 'inv-t',
    theme: 'candle',
    name: '倒T字线',
    art: () => (
      <Frame>
        <Candle x={150} open={113} close={116} high={30} low={116} w={34} />
      </Frame>
    ),
    explanation:
      '开盘≈收盘≈最低价，拖着一条长上影线——冲高被砸回原地，上方抛压沉重，是偏弱的信号。',
    difficulty: 2,
  },
  {
    id: 'gap-up',
    theme: 'candle',
    name: '跳空缺口',
    art: () => (
      <Frame>
        <Candle x={105} open={118} close={100} high={96} low={122} />
        <Candle x={195} open={78} close={58} high={54} low={82} />
        <line x1={138} y1={96} x2={162} y2={96} stroke={AMBER} strokeWidth={1.5} strokeDasharray="5 4" />
        <line x1={138} y1={82} x2={162} y2={82} stroke={AMBER} strokeWidth={1.5} strokeDasharray="5 4" />
        <line x1={150} y1={82} x2={150} y2={96} stroke={AMBER} strokeWidth={1.5} />
      </Frame>
    ),
    explanation:
      '今天开盘直接跳过昨天的价格区间，中间留下一段没有成交的空白——情绪强烈时常见，缺口附近常有支撑或压力作用。',
    difficulty: 2,
  },
  {
    id: 'morning-star',
    theme: 'candle',
    name: '早晨之星',
    art: () => (
      <Frame>
        <Candle x={75} open={52} close={108} high={48} low={112} w={20} />
        <Candle x={150} open={118} close={112} high={104} low={128} w={12} />
        <Candle x={225} open={112} close={58} high={54} low={116} w={20} />
      </Frame>
    ),
    explanation:
      '大阴线 + 小星线 + 大阳线三连击——空头最后的挣扎之后多头接管，是教科书级的底部反转组合。',
    difficulty: 3,
  },
  // ---- 均线系统 ----
  {
    id: 'golden-cross',
    theme: 'ma',
    name: '金叉',
    art: () => (
      <Frame>
        <P pts={[[10, 102], [100, 100], [150, 99], [200, 98], [290, 96]]} color={MA20C} />
        <P pts={[[10, 142], [60, 136], [110, 120], [150, 99], [200, 78], [290, 58]]} color={MA5C} />
        <circle cx={150} cy={99} r={5} fill="none" stroke="#fff" strokeWidth={2} />
        <MaLabel x={252} y={50} text="MA5" color={MA5C} />
        <MaLabel x={248} y={112} text="MA20" color={MA20C} />
      </Frame>
    ),
    explanation:
      '短期均线自下而上穿过长期均线——短期成本超过长期成本，是走强的信号之一。但别单看金叉就追高，还得看位置。',
    difficulty: 1,
  },
  {
    id: 'death-cross',
    theme: 'ma',
    name: '死叉',
    art: () => (
      <Frame>
        <P pts={[[10, 68], [100, 70], [150, 71], [200, 72], [290, 74]]} color={MA20C} />
        <P pts={[[10, 28], [60, 34], [110, 50], [150, 71], [200, 92], [290, 112]]} color={MA5C} />
        <circle cx={150} cy={71} r={5} fill="none" stroke="#fff" strokeWidth={2} />
        <MaLabel x={252} y={106} text="MA5" color={MA5C} />
        <MaLabel x={248} y={60} text="MA20" color={MA20C} />
      </Frame>
    ),
    explanation:
      '短期均线自上而下穿过长期均线——短期成本跌破长期成本，是走弱的信号之一，持有的话要提高警惕。',
    difficulty: 1,
  },
  {
    id: 'bull-align',
    theme: 'ma',
    name: '多头排列',
    art: () => (
      <Frame>
        <P pts={[[10, 120], [150, 80], [290, 40]]} color={MA5C} width={3} />
        <P pts={[[10, 132], [150, 102], [290, 72]]} color={MA10C} width={3} />
        <P pts={[[10, 144], [150, 124], [290, 104]]} color={MA20C} width={3} />
        <MaLabel x={252} y={34} text="MA5" color={MA5C} />
        <MaLabel x={248} y={66} text="MA10" color={MA10C} />
        <MaLabel x={248} y={98} text="MA20" color={MA20C} />
      </Frame>
    ),
    explanation:
      '短中长期均线自上而下依次排开、齐头向上——典型的多头趋势，回调到均线附近常常有支撑。',
    difficulty: 2,
  },
  {
    id: 'bear-align',
    theme: 'ma',
    name: '空头排列',
    art: () => (
      <Frame>
        <P pts={[[10, 40], [150, 70], [290, 100]]} color={MA20C} width={3} />
        <P pts={[[10, 52], [150, 92], [290, 132]]} color={MA10C} width={3} />
        <P pts={[[10, 64], [150, 114], [290, 158]]} color={MA5C} width={3} />
        <MaLabel x={248} y={94} text="MA20" color={MA20C} />
        <MaLabel x={248} y={126} text="MA10" color={MA10C} />
        <MaLabel x={252} y={152} text="MA5" color={MA5C} />
      </Frame>
    ),
    explanation:
      '均线按长期到短期自上而下排开、齐头向下——典型的空头趋势，反弹到均线附近常常遇到压力。',
    difficulty: 2,
  },
  // ---- 经典形态 ----
  {
    id: 'double-top',
    theme: 'shape',
    name: '双顶（M头）',
    art: () => (
      <Frame>
        <P pts={[[15, 118], [70, 55], [120, 95], [175, 55], [225, 100], [258, 122], [290, 138]]} width={3} />
        <P pts={[[55, 95], [240, 95]]} color={AMBER} width={1.5} dash="7 5" />
      </Frame>
    ),
    explanation:
      '两次冲高都在同一个位置被打下来，走出M形——虚线是颈线，一旦跌破，M头成立，是常见的顶部形态。',
    difficulty: 2,
  },
  {
    id: 'double-bottom',
    theme: 'shape',
    name: '双底（W底）',
    art: () => (
      <Frame>
        <P pts={[[15, 52], [70, 115], [120, 75], [175, 115], [225, 70], [258, 50], [290, 36]]} width={3} />
        <P pts={[[55, 75], [240, 75]]} color={AMBER} width={1.5} dash="7 5" />
      </Frame>
    ),
    explanation:
      '两次探底都在同一个位置被拉起来，走出W形——虚线是颈线，一旦突破，W底成立，是常见的底部形态。',
    difficulty: 2,
  },
  {
    id: 'head-shoulders',
    theme: 'shape',
    name: '头肩顶',
    art: () => (
      <Frame>
        <P pts={[[15, 115], [55, 70], [95, 100], [150, 42], [205, 100], [245, 70], [290, 120]]} width={3} />
        <P pts={[[40, 100], [262, 100]]} color={AMBER} width={1.5} dash="7 5" />
      </Frame>
    ),
    explanation:
      '左肩-头-右肩，中间那个最高——跌破颈线（虚线）后头部确立，是力度比较强的顶部反转形态。',
    difficulty: 3,
  },
  {
    id: 'up-trend',
    theme: 'shape',
    name: '上升趋势线',
    art: () => (
      <Frame>
        <P pts={[[15, 135], [65, 105], [95, 120], [145, 90], [175, 105], [225, 75], [275, 50]]} width={3} />
        <P pts={[[10, 140], [285, 84]]} color={AMBER} width={2} />
      </Frame>
    ),
    explanation:
      '把一个个抬高的低点连起来——只要价格不跌破这条线，上升趋势就还完好；一旦跌破，趋势转弱。',
    difficulty: 1,
  },
  {
    id: 'down-trend',
    theme: 'shape',
    name: '下降趋势线',
    art: () => (
      <Frame>
        <P pts={[[15, 35], [65, 65], [95, 50], [145, 80], [175, 65], [225, 95], [275, 120]]} width={3} />
        <P pts={[[10, 30], [285, 86]]} color={AMBER} width={2} />
      </Frame>
    ),
    explanation:
      '把一个个降低的高点连起来——只要价格不突破这条线，反弹都先按压力看；一旦突破，趋势可能扭转。',
    difficulty: 1,
  },
  {
    id: 'box',
    theme: 'shape',
    name: '箱体震荡',
    art: () => (
      <Frame>
        <P pts={[[15, 55], [285, 55]]} color={AMBER} width={2} />
        <P pts={[[15, 115], [285, 115]]} color={AMBER} width={2} />
        <P pts={[[15, 100], [60, 60], [110, 110], [160, 60], [210, 110], [260, 65], [285, 92]]} width={2.5} />
      </Frame>
    ),
    explanation:
      '价格在上下两条水平线之间来回跑——没方向时就是这德行，突破上沿或跌破下沿才算选了方向。',
    difficulty: 2,
  },
  // ---- 量价分时 ----
  {
    id: 'vol-up',
    theme: 'volume',
    name: '放量上涨',
    art: () => (
      <Frame>
        <Candle x={70} open={118} close={102} high={98} low={122} />
        <Candle x={150} open={102} close={84} high={80} low={106} />
        <Candle x={230} open={84} close={64} high={60} low={88} />
        <VolBars xs={[70, 150, 230]} hs={[16, 30, 46]} color={GREEN} />
      </Frame>
    ),
    explanation:
      '价格往上走，成交量一根比一根高——真金白银的买盘在推，这种上涨更可信。',
    difficulty: 1,
  },
  {
    id: 'vol-shrink',
    theme: 'volume',
    name: '缩量上涨',
    art: () => (
      <Frame>
        <Candle x={70} open={118} close={102} high={98} low={122} />
        <Candle x={150} open={102} close={84} high={80} low={106} />
        <Candle x={230} open={84} close={64} high={60} low={88} />
        <VolBars xs={[70, 150, 230]} hs={[46, 30, 16]} color={GREEN} />
      </Frame>
    ),
    explanation:
      '价格在涨，成交量却越来越小——没人跟风接力，遇到抛压容易一日游，追高要谨慎。',
    difficulty: 2,
  },
  {
    id: 'vol-down',
    theme: 'volume',
    name: '放量下跌',
    art: () => (
      <Frame>
        <Candle x={70} open={64} close={82} high={60} low={86} />
        <Candle x={150} open={82} close={100} high={78} low={104} />
        <Candle x={230} open={100} close={120} high={96} low={124} />
        <VolBars xs={[70, 150, 230]} hs={[16, 30, 46]} color={RED} />
      </Frame>
    ),
    explanation:
      '价格往下跌，成交量还放大——恐慌盘在涌出，杀跌动能强，这时候别急着接飞刀。',
    difficulty: 2,
  },
  {
    id: 'limit-up',
    theme: 'volume',
    name: '涨停分时',
    art: () => (
      <Frame>
        <P pts={[[15, 112], [80, 110], [110, 108], [148, 46], [285, 46]]} color={RED} width={3} />
        <P pts={[[15, 112], [285, 112]]} color="#475569" width={1} dash="6 5" />
      </Frame>
    ),
    explanation:
      '开盘后直线拉升，然后横在顶部一动不动——全天封死涨停，多头完全控盘的分时长相。',
    difficulty: 1,
  },
  {
    id: 'spike-fall',
    theme: 'volume',
    name: '冲高回落',
    art: () => (
      <Frame>
        <P pts={[[15, 112], [90, 106], [132, 48], [172, 60], [230, 102], [285, 110]]} color={RED} width={3} />
        <P pts={[[15, 112], [285, 112]]} color="#475569" width={1} dash="6 5" />
      </Frame>
    ),
    explanation:
      '盘中猛冲一波又悉数跌回来——追进去的人全天站岗，是经典的"骗炮"分时，看到长上影线那天往往就是它。',
    difficulty: 2,
  },
];

export function patternById(id: string): ChartPattern | undefined {
  return CHART_PATTERNS.find((p) => p.id === id);
}
