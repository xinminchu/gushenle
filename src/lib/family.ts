import { supabase } from './supabase';
import { markUserDataDirty } from './userSync';

/** 资讯朋友圈数据层：帖子、点赞、持仓总览意愿投票 */

export interface FamilyPost {
  id: number;
  user_id: string;
  nickname: string;
  post_type: 'thesis' | 'sell' | 'lesson';
  symbol: string;
  content: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
}

/** 标的字段存的是逗号连接的多个代码（如 "NVDA,COIN"）；兼容老数据的单个代码 */
export function splitSymbols(symbol: string): string[] {
  return (symbol || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
}

/** 把用户输入（空格/逗号分隔）规范成逗号连接的多个代码 */
export function normalizeSymbols(raw: string): string {
  const codes = raw
    .toUpperCase()
    .split(/[\s,，、]+/)
    .map((s) => s.replace(/[^A-Z]/g, ''))
    .filter(Boolean);
  return [...new Set(codes)].slice(0, 8).join(',');
}

/** 回复 */
export interface FamilyReply {
  id: number;
  post_id: number;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
}

/** 一次查出这些帖子的全部回复（帖子列表小，一次全拿） */
export async function fetchReplies(postIds: number[]): Promise<FamilyReply[]> {
  if (postIds.length === 0) return [];
  const db = needDb();
  const { data, error } = await db
    .from('family_post_replies')
    .select('id,post_id,user_id,nickname,content,created_at')
    .in('post_id', postIds)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data || []) as FamilyReply[];
}

export async function createReply(input: {
  post_id: number;
  user_id: string;
  nickname: string;
  content: string;
}): Promise<void> {
  const db = needDb();
  const { error } = await db.from('family_post_replies').insert({
    post_id: input.post_id,
    user_id: input.user_id,
    nickname: input.nickname.slice(0, 12),
    content: input.content.trim().slice(0, 300),
  });
  if (error) throw error;
}

export async function deleteReply(id: number): Promise<void> {
  const db = needDb();
  const { error } = await db.from('family_post_replies').delete().eq('id', id);
  if (error) throw error;
}

/** 本人编辑帖子（内容/标的/类型；RLS 只允许改自己的） */
export async function updatePost(
  id: number,
  input: { content: string; symbol: string; post_type: 'thesis' | 'sell' | 'lesson' },
): Promise<void> {
  const db = needDb();
  const { error } = await db
    .from('family_posts')
    .update({
      content: input.content.trim().slice(0, 500),
      symbol: normalizeSymbols(input.symbol).slice(0, 80),
      post_type: input.post_type,
    })
    .eq('id', id);
  if (error) throw error;
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
  return '股友';
}

export const NICKNAME_EVENT = 'gushenle:nickname';

export function setNickname(name: string) {
  try {
    localStorage.setItem(NICK_KEY, name.trim().slice(0, 12));
    markUserDataDirty();
  } catch {}
  // 广播：顶栏、发帖表单、帖子列表等所有用昵称的地方一起更新
  try {
    window.dispatchEvent(new Event(NICKNAME_EVENT));
  } catch {}
}

/** 改昵称时同步更新自己所有帖子的署名，股友看到的也是新名字 */
export async function updateMyPostsNickname(userId: string, nickname: string): Promise<void> {
  const db = needDb();
  const { error } = await db
    .from('family_posts')
    .update({ nickname: nickname.slice(0, 12) })
    .eq('user_id', userId);
  if (error) throw error;
}

function needDb() {
  if (!supabase) throw new Error('朋友圈功能尚未配置');
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
  post_type: 'thesis' | 'sell' | 'lesson';
  symbol: string;
  content: string;
}): Promise<void> {
  const db = needDb();
  const { error } = await db.from('family_posts').insert({
    user_id: input.user_id,
    nickname: input.nickname.slice(0, 12),
    post_type: input.post_type,
    symbol: normalizeSymbols(input.symbol).slice(0, 80),
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

const SURVEY_LABEL_EN: Record<SurveyChoice, string> = {
  yes: 'Yes',
  maybe: 'Depends',
  no: 'No',
};

/** 调查选项标签：组件里用这个按语言取，SURVEY_LABEL 保留给旧引用 */
export function surveyLabel(choice: SurveyChoice, lang: 'zh' | 'hant' | 'en' = 'zh'): string {
  return lang === 'en' ? SURVEY_LABEL_EN[choice] : SURVEY_LABEL[choice];
}

export interface SurveyState {
  counts: Record<SurveyChoice, number>;
  total: number;
  myChoice: SurveyChoice | null;
}

const VOTER_KEY = 'gushenle:voter_key';

/** 游客投票身份：浏览器本地 UUID，一设备一票，可改 */
export function getVoterKey(): string {
  try {
    let k = localStorage.getItem(VOTER_KEY);
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem(VOTER_KEY, k);
    }
    return k;
  } catch {
    return 'session-' + Math.random().toString(36).slice(2);
  }
}

export interface VoterIdentity {
  userId?: string;
  voterKey?: string;
}

export async function getSurvey(
  myUserId: string | null,
  myVoterKey: string | null,
): Promise<SurveyState> {
  const db = needDb();
  const { data, error } = await db.from('family_survey_votes').select('choice,user_id,voter_key');
  if (error) throw error;
  const counts: Record<SurveyChoice, number> = { yes: 0, maybe: 0, no: 0 };
  let myChoice: SurveyChoice | null = null;
  for (const row of data || []) {
    const c = row.choice as SurveyChoice;
    if (c === 'yes' || c === 'maybe' || c === 'no') counts[c] += 1;
    if ((myUserId && row.user_id === myUserId) || (myVoterKey && row.voter_key === myVoterKey))
      myChoice = c;
  }
  return { counts, total: (data || []).length, myChoice };
}

export async function setSurveyVote(id: VoterIdentity, choice: SurveyChoice): Promise<void> {
  const db = needDb();
  const match = id.userId ? { col: 'user_id', val: id.userId } : { col: 'voter_key', val: id.voterKey! };
  // 先删旧票再投：一人（或一设备）一票，可改；避开部分唯一索引的 upsert 冲突判定
  const { error: delErr } = await db.from('family_survey_votes').delete().eq(match.col, match.val);
  if (delErr) throw delErr;
  const { error: insErr } = await db.from('family_survey_votes').insert({
    user_id: id.userId ?? null,
    voter_key: id.voterKey ?? null,
    choice,
    updated_at: new Date().toISOString(),
  });
  if (insErr) throw insErr;
}

/** x分钟前 / x小时前 / x天前（en: "N min ago / N hrs ago / N days ago"） */
export function relativeTime(iso: string, lang: 'zh' | 'hant' | 'en' = 'zh'): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const justNow = lang === 'en' ? 'just now' : '刚刚';
  if (diff < 0) return justNow;
  const m = Math.floor(diff / 60000);
  if (m < 1) return justNow;
  if (m < 60) return lang === 'en' ? `${m} min ago` : `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'en' ? `${h} hr${h > 1 ? 's' : ''} ago` : `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return lang === 'en' ? `${d} day${d > 1 ? 's' : ''} ago` : `${d}天前`;
  return new Date(t).toISOString().slice(0, 10);
}
