import { supabase } from './supabase';
import { getNickname } from './family';

/**
 * 八个小游戏统一战绩：localStorage 为主，登录后镜像到 Supabase。
 *
 * localStorage key: gushenle:game_stats:v1
 * Supabase 表: game_stats(user_id, game_id, plays, total_score, best_score, banked)
 *
 * 同步策略：本地是展示真相源；登录后全量 upsert 覆盖云端。
 * 登录时云端与本地取大值合并再写回两端，多设备最终收敛且永不重复计数。
 */

export type GameId =
  | 'clipper'
  | 'cool30'
  | 'bigtech'
  | 'kline'
  | 'cutloss'
  | 'holdback'
  | 'newstrap'
  | 'dca'
  | 'dart'
  | 'mole'
  | 'encyclopedia'
  | 'wheel';

export interface GameStat {
  plays: number;
  totalScore: number;
  best: number;
  banked: number; // 仅 kline 有意义：历史已落袋积分
}

const KEY = 'gushenle:game_stats:v1';

export const GAME_NAMES: Record<GameId, string> = {
  clipper: '韭菜咯咯乐',
  cool30: '沉思撞球',
  bigtech: '美股巨头大乱斗',
  kline: '历史 K 线盲盒',
  cutloss: '割肉还是卧倒',
  holdback: '忍住别追高',
  newstrap: '消息面陷阱',
  dca: '定投 vs 梭哈',
  dart: '飞镖选股',
  mole: '高管打地鼠',
  encyclopedia: '股票大百科',
  wheel: '转转盘买股',
};

const emptyStat = (): GameStat => ({ plays: 0, totalScore: 0, best: 0, banked: 0 });

function blank(): Record<GameId, GameStat> {
  return {
    clipper: emptyStat(),
    cool30: emptyStat(),
    bigtech: emptyStat(),
    kline: emptyStat(),
    cutloss: emptyStat(),
    holdback: emptyStat(),
    newstrap: emptyStat(),
    dca: emptyStat(),
    dart: emptyStat(),
    mole: emptyStat(),
    encyclopedia: emptyStat(),
    wheel: emptyStat(),
  };
}

export function loadStats(): Record<GameId, GameStat> {
  const base = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const j = JSON.parse(raw) as Partial<Record<GameId, Partial<GameStat>>>;
    (Object.keys(base) as GameId[]).forEach((id) => {
      const s = j[id];
      if (s) {
        base[id] = {
          plays: s.plays || 0,
          totalScore: s.totalScore || 0,
          best: s.best || 0,
          banked: s.banked || 0,
        };
      }
    });
  } catch {
    /* 忽略损坏数据 */
  }
  return base;
}

function saveStats(s: Record<GameId, GameStat>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 忽略 */
  }
  // 登录状态下顺手镜像到云端（fire-and-forget）
  void pushStatsToCloud(s);
}

/** 一局结束：plays+1，总分累加，best 取大。用于 clipper / cool30 / bigtech。 */
export function recordPlay(id: GameId, score: number): void {
  if (id === 'kline') return;
  const s = loadStats();
  const g = s[id] ?? (s[id] = emptyStat());
  g.totalScore += Math.max(0, Math.round(score));
  if (score > g.best) g.best = Math.round(score);
  saveStats(s);
}

/** 打开一次游戏弹窗即记一次游玩（统一口径：玩了 N 次 = 打开次数）。 */
export function recordSession(id: GameId): void {
  const s = loadStats();
  const g = s[id] ?? (s[id] = emptyStat());
  g.plays += 1;
  saveStats(s);
}

/** kline 落袋：未落袋积分转入历史已落袋，同时计入累计和最佳单次。 */
export function recordBank(points: number): void {
  const p = Math.max(0, Math.round(points));
  if (p <= 0) return;
  const s = loadStats();
  const g = s.kline;
  g.banked += p;
  g.totalScore += p;
  if (p > g.best) g.best = p;
  saveStats(s);
}

export function getBanked(): number {
  return loadStats().kline.banked;
}

/** 把本地全量战绩 upsert 到云端（需登录）。 */
export async function pushStatsToCloud(
  s: Record<GameId, GameStat> = loadStats()
): Promise<void> {
  if (!supabase) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const nick = getNickname(user.email);
    const rows = (Object.keys(s) as GameId[]).map((id) => ({
      user_id: user.id,
      game_id: id,
      plays: s[id].plays,
      total_score: s[id].totalScore,
      best_score: s[id].best,
      banked: s[id].banked,
      display_name: nick,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('game_stats')
      .upsert(rows, { onConflict: 'user_id,game_id' });
    if (error) {
      // 015 迁移还没跑时 display_name 列不存在：去掉该列重试，战绩同步不断
      const fallback = rows.map(({ display_name: _dn, ...r }) => r);
      await supabase.from('game_stats').upsert(fallback, { onConflict: 'user_id,game_id' });
    }
  } catch {
    /* 网络失败就下次再说，本地不受影响 */
  }
}

/** 登录时调用：云端与本地取大值合并后写回两端，多设备最终收敛且永不重复计数。 */
export async function mergeCloudStats(): Promise<Record<GameId, GameStat>> {
  const local = loadStats();
  if (!supabase) return local;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return local;
    const { data, error } = await supabase.from('game_stats').select('*').eq('user_id', user.id);
    if (error || !data) return local;
    let changed = false;
    for (const row of data as Array<{
      game_id: string;
      plays: number;
      total_score: number;
      best_score: number;
      banked: number;
    }>) {
      const id = row.game_id as GameId;
      if (!local[id]) continue;
      const g = local[id];
      const np = Math.max(g.plays, row.plays || 0);
      const nt = Math.max(g.totalScore, row.total_score || 0);
      const nb = Math.max(g.banked, row.banked || 0);
      const nbest = Math.max(g.best, row.best_score || 0);
      if (np !== g.plays || nt !== g.totalScore || nb !== g.banked || nbest !== g.best) {
        g.plays = np;
        g.totalScore = nt;
        g.banked = nb;
        g.best = nbest;
        changed = true;
      }
    }
    if (changed) {
      try {
        localStorage.setItem(KEY, JSON.stringify(local));
      } catch {
        /* 忽略 */
      }
      await pushStatsToCloud(local);
    }
  } catch {
    /* 忽略 */
  }
  return local;
}
