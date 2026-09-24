import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 英雄榜：GET 返回全站游戏统计 + 排行。
 * 走 service_role 聚合，user_id 不出内网；display_name 为 NULL 时显示"股友"。
 * 015 迁移没跑（无 display_name 列）时降级：昵称全显示"股友"，榜单照常。
 * service_role 没配时返回 ok:false，前端自动隐藏榜单。
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function svc() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !key) return null;
  return createClient(URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface Row {
  user_id: string;
  game_id: string;
  plays: number;
  total_score: number;
  best_score: number;
  display_name?: string | null;
}

async function fetchRows(s: NonNullable<ReturnType<typeof svc>>): Promise<Row[] | null> {
  // 先带 display_name 查；列不存在（015 没跑）就降级裸查
  const full = await s
    .from('game_stats')
    .select('user_id, game_id, plays, total_score, best_score, display_name');
  if (!full.error) return full.data as Row[];
  const bare = await s
    .from('game_stats')
    .select('user_id, game_id, plays, total_score, best_score');
  if (bare.error) return null;
  return bare.data as Row[];
}

export async function GET() {
  try {
    const s = svc();
    if (!s) return NextResponse.json({ ok: false });
    const rows = await fetchRows(s);
    if (!rows) return NextResponse.json({ ok: false });

    let totalPlays = 0;
    let totalScore = 0;
    const perUser = new Map<string, { name: string; plays: number; score: number }>();
    const perGame = new Map<string, Array<{ name: string; best: number; plays: number }>>();

    for (const r of rows) {
      const name = r.display_name || '股友';
      totalPlays += r.plays || 0;
      totalScore += r.total_score || 0;
      const u = perUser.get(r.user_id) || { name, plays: 0, score: 0 };
      if (u.name === '股友' && name !== '股友') u.name = name;
      u.plays += r.plays || 0;
      u.score += r.total_score || 0;
      perUser.set(r.user_id, u);
      if (!perGame.has(r.game_id)) perGame.set(r.game_id, []);
      perGame.get(r.game_id)!.push({ name, best: r.best_score || 0, plays: r.plays || 0 });
    }

    const globalTop = [...perUser.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    const perGameTop: Record<string, Array<{ name: string; best: number; plays: number }>> = {};
    for (const [gid, arr] of perGame) {
      perGameTop[gid] = arr.sort((a, b) => b.best - a.best).slice(0, 10);
    }

    return NextResponse.json({
      ok: true,
      totals: { plays: totalPlays, players: perUser.size, score: totalScore },
      globalTop,
      perGame: perGameTop,
    });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
