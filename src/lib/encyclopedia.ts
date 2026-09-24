import { supabase } from './supabase';
import {
  ENCYCLOPEDIA_QUESTIONS,
  type EncyclopediaPurpose,
  type EncyclopediaQuestion,
  type EncyclopediaThemeKey,
} from './encyclopediaBank';

/**
 * 股票大百科玩法层辅助：抽题 / 收藏 / 修改建议。
 * 收藏：游客走 localStorage，登录用户同步云端 encyclopedia_favorites。
 * 建议：登录用户写 encyclopedia_suggestions，游客/表不存在时只留本地。
 * 所有云操作都带降级：表没建好也不影响本地玩。
 */

export const PRAISES = [
  '漂亮！就是这个感觉 👏',
  '对啦，股神气质初显 ✨',
  '没错，知识点 +1 🧠',
  '稳！继续保持 🔥',
  '答对啦，给你点赞 👍',
  '可以，这题没难住你 😎',
];

export const LETTERS = ['A', 'B', 'C', 'D'];

/** Fisher-Yates 洗牌 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPool(
  theme: EncyclopediaThemeKey | 'all',
  purpose: EncyclopediaPurpose | 'all'
): EncyclopediaQuestion[] {
  return ENCYCLOPEDIA_QUESTIONS.filter(
    (q) =>
      (theme === 'all' || q.theme === theme) && (purpose === 'all' || q.purpose === purpose)
  );
}

export function getQuestion(id: string): EncyclopediaQuestion | undefined {
  return ENCYCLOPEDIA_QUESTIONS.find((q) => q.id === id);
}

/** 多选题判定：选中集合与答案集合完全一致 */
export function isMultiCorrect(q: EncyclopediaQuestion, selected: number[]): boolean {
  if (selected.length !== q.answer.length) return false;
  return q.answer.every((a) => selected.includes(a));
}

/* ---------------- 我的知识库（收藏） ---------------- */

const FAV_KEY = 'gushenle:encyclopedia_favorites:v1';

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    /* 忽略 */
  }
  void pushFavoritesToCloud(ids);
}

export function toggleFavorite(id: string): string[] {
  const cur = loadFavorites();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  saveFavorites(next);
  return next;
}

/** 本地收藏镜像到云端（需登录；fire-and-forget） */
export async function pushFavoritesToCloud(ids: string[] = loadFavorites()): Promise<void> {
  if (!supabase) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // 先清后写：收藏是集合语义，全量覆盖最简单且幂等
    await supabase.from('encyclopedia_favorites').delete().eq('user_id', user.id);
    if (ids.length === 0) return;
    const rows = ids.map((question_id) => ({ user_id: user.id, question_id }));
    await supabase.from('encyclopedia_favorites').insert(rows);
  } catch {
    /* 表没建好就下次再说，本地不受影响 */
  }
}

/** 登录时调用：云端与本地取并集合并后写回两端 */
export async function mergeCloudFavorites(): Promise<string[]> {
  const local = loadFavorites();
  if (!supabase) return local;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return local;
    const { data, error } = await supabase
      .from('encyclopedia_favorites')
      .select('question_id')
      .eq('user_id', user.id);
    if (error || !data) return local;
    const cloudIds = (data as Array<{ question_id: string }>).map((r) => r.question_id);
    const merged = [...new Set([...local, ...cloudIds])];
    if (merged.length !== local.length) {
      saveFavorites(merged);
      return merged;
    }
    return local;
  } catch {
    return local;
  }
}

/* ---------------- 修改建议 ---------------- */

const SUGGEST_KEY = 'gushenle:encyclopedia_suggestions:v1';

export interface SuggestionInput {
  questionId: string;
  questionSnapshot: string;
  suggestion: string;
  nickname: string;
}

/** 提交修改建议：登录用户写云表（失败则留本地），游客只留本地 */
export async function submitSuggestion(input: SuggestionInput): Promise<'cloud' | 'local'> {
  // 本地永远记一笔（队列作用：断网/表没建也不丢）
  try {
    const raw = localStorage.getItem(SUGGEST_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
    arr.push({ ...input, created_at: new Date().toISOString() });
    localStorage.setItem(SUGGEST_KEY, JSON.stringify(arr));
  } catch {
    /* 忽略 */
  }
  if (!supabase) return 'local';
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('encyclopedia_suggestions').insert({
      user_id: user ? user.id : null,
      nickname: input.nickname || '匿名股友',
      question_id: input.questionId,
      question_snapshot: input.questionSnapshot.slice(0, 200),
      suggestion: input.suggestion,
    });
    return error ? 'local' : 'cloud';
  } catch {
    return 'local';
  }
}
