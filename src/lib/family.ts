import { supabase } from './supabase';

/** 家人分享圈数据层：帖子、点赞、持仓总览意愿投票 */

export interface FamilyPost {
  id: number;
  user_id: string;
  nickname: string;
  post_type: 'thesis' | 'lesson';
  symbol: string;
  content: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
}

const NICK_KEY = 'gushenle:nickname';

export function getNickname(fallbackEmail?: string | null): string {
  try {
    const saved = localStorage.getItem(NICK_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 12);
  } catch {}
  if (fallbackEmail) {
    const prefix = fallbackEmail.split('@')[0];
    if (prefix) return prefix.slice(0, 12);
  }
  return '家人';
}

export function setNickname(name: string) {
  try {
    localStorage.setItem(NICK_KEY, name.trim().slice(0, 12));
  } catch {}
}

function needDb() {
  if (!supabase) throw new Error('家人圈功能尚未配置');
  return supabase;
}

export async function fetchPosts(myUserId: string | null): Promise<FamilyPost[]> {
  const db = needDb();
  const { data: posts, error } = await db
    .from('family_posts')
    .select('id,user_id,nickname,post_type,symbol,content,created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const list = posts || [];
  const ids = list.map((p) => p.id);
  let likes: { post_id: number; user_id: string }[] = [];
  if (ids.length > 0) {
    const { data, error: likeErr } = await db
      .from('family_post_likes')
      .select('post_id,user_id')
      .in('post_id', ids);
    if (likeErr) throw likeErr;
    likes = data || [];
  }
  const countBy = new Map<number, number>();
  const likedSet = new Set<number>();
  for (const l of likes) {
    countBy.set(l.post_id, (countBy.get(l.post_id) || 0) + 1);
    if (myUserId && l.user_id === myUserId) likedSet.add(l.post_id);
  }
  return list.map((p) => ({
    ...p,
    like_count: countBy.get(p.id) || 0,
    liked_by_me: likedSet.has(p.id),
  }));
}

export async function createPost(input: {
  user_id: string;
  nickname: string;
  post_type: 'thesis' | 'lesson';
  symbol: string;
  content: string;
}): Promise<void> {
  const db = needDb();
  const { error } = await db.from('family_posts').insert({
    user_id: input.user_id,
    nickname: input.nickname.slice(0, 12),
    post_type: input.post_type,
    symbol: input.symbol.trim().toUpperCase().slice(0, 10),
    content: input.content.trim().slice(0, 500),
  });
  if (error) throw error;
}

export async function deletePost(id: number): Promise<void> {
  const db = needDb();
  const { error } = await db.from('family_posts').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleLike(
  postId: number,
  userId: string,
  liked: boolean,
): Promise<void> {
  const db = needDb();
  if (liked) {
    const { error } = await db
      .from('family_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await db
      .from('family_post_likes')
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export type SurveyChoice = 'yes' | 'maybe' | 'no';

export const SURVEY_LABEL: Record<SurveyChoice, string> = {
  yes: '愿意',
  maybe: '看情况',
  no: '不愿意',
};

export interface SurveyState {
  counts: Record<SurveyChoice, number>;
  total: number;
  myChoice: SurveyChoice | null;
}

export async function getSurvey(myUserId: string | null): Promise<SurveyState> {
  const db = needDb();
  // 只取 choice 列做统计，不拉 user_id
  const { data, error } = await db.from('family_survey_votes').select('choice,user_id');
  if (error) throw error;
  const counts: Record<SurveyChoice, number> = { yes: 0, maybe: 0, no: 0 };
  let myChoice: SurveyChoice | null = null;
  for (const row of data || []) {
    const c = row.choice as SurveyChoice;
    if (c === 'yes' || c === 'maybe' || c === 'no') counts[c] += 1;
    if (myUserId && row.user_id === myUserId) myChoice = c;
  }
  return { counts, total: (data || []).length, myChoice };
}

export async function setSurveyVote(userId: string, choice: SurveyChoice): Promise<void> {
  const db = needDb();
  const { error } = await db.from('family_survey_votes').upsert(
    { user_id: userId, choice, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

/** x分钟前 / x小时前 / x天前 */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 0) return '刚刚';
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  return new Date(t).toISOString().slice(0, 10);
}
