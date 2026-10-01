/**
 * 用户数据云同步：持仓 / 自选 / 资金账户 / 昵称，一用户一行存 public.user_data。
 *
 * 原则：
 * - 本地优先：没登录、没跑 035 迁移、网络失败，全部静默降级，app 照常用 localStorage。
 * - 空值保护：本地和云端都没有数据时不推送空值，避免新设备用空数据覆盖老设备。
 * - 冲突时后写赢（last-write-wins），按 updated_at 比。两台设备同时改，时间晚的生效。
 * - 采用云端数据后派发 SYNC_EVENT，UI 层监听后重载。
 */
'use client';

import { supabase } from './supabase';

const POS_KEY = 'gushenle:positions:v1';
const WATCHLIST_KEY = 'gushenle:watchlist:v1';
const ACCOUNT_KEY = 'gushenle:account:v1';
const NICK_KEY = 'gushenle:nickname';
const TS_KEY = 'gushenle:user_data_updated_at';
const BASELINE_KEY = 'gushenle:user_data_baseline';

/** 采用云端数据后派发，UI 监听后重载本地状态 */
export const SYNC_EVENT = 'gushenle:user-data-synced';
/** 昵称广播事件（与 family.ts 共用同一个字符串，避免循环引用） */
const NICKNAME_EVENT = 'gushenle:nickname';

const SKEW_MS = 2000;
const PUSH_DEBOUNCE_MS = 1500;

export interface LocalUserData {
  positions: unknown;
  watchlist: unknown;
  account: unknown;
  nickname: string;
  updatedAt: number;
}

interface CloudRow {
  positions: unknown;
  watchlist: unknown;
  account: unknown;
  nickname: string;
  updated_at: string;
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 本地是否有"值得同步"的数据：默认自选/空持仓不算 */
export function localHasData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pos = safeParse(localStorage.getItem(POS_KEY));
    if (Array.isArray(pos) && pos.length > 0) return true;
    const wl = safeParse(localStorage.getItem(WATCHLIST_KEY)) as {
      items?: unknown[];
      customized?: unknown;
    } | null;
    if (wl && wl.customized && Array.isArray(wl.items) && wl.items.length > 0) return true;
    const acc = safeParse(localStorage.getItem(ACCOUNT_KEY)) as {
      brokerage?: unknown;
      capital?: unknown;
    } | null;
    if (acc && typeof acc.brokerage === 'string' && Number(acc.capital) > 0) return true;
    if (localStorage.getItem(NICK_KEY)) return true;
  } catch {
    /* 忽略 */
  }
  return false;
}

export function readLocalBlob(): LocalUserData {
  if (typeof window === 'undefined') {
    return { positions: [], watchlist: {}, account: null, nickname: '', updatedAt: 0 };
  }
  let updatedAt = 0;
  try {
    updatedAt = Number(localStorage.getItem(TS_KEY)) || 0;
  } catch {
    /* 忽略 */
  }
  return {
    positions: safeParse(localStorage.getItem(POS_KEY)) ?? [],
    watchlist: safeParse(localStorage.getItem(WATCHLIST_KEY)) ?? {},
    account: safeParse(localStorage.getItem(ACCOUNT_KEY)),
    nickname: (() => {
      try {
        return localStorage.getItem(NICK_KEY) || '';
      } catch {
        return '';
      }
    })(),
    updatedAt,
  };
}

function writeLocalBlob(row: CloudRow): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(row.positions ?? []));
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(row.watchlist ?? {}));
    if (row.account && typeof row.account === 'object') {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(row.account));
    } else {
      localStorage.removeItem(ACCOUNT_KEY);
    }
    if (row.nickname) {
      localStorage.setItem(NICK_KEY, String(row.nickname).slice(0, 12));
    } else {
      localStorage.removeItem(NICK_KEY);
    }
    const ts = Date.parse(row.updated_at) || Date.now();
    localStorage.setItem(TS_KEY, String(ts));
    localStorage.setItem(BASELINE_KEY, '1');
  } catch {
    /* 忽略 */
  }
  try {
    window.dispatchEvent(new Event(NICKNAME_EVENT));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    /* 忽略 */
  }
}

function hasBaseline(): boolean {
  try {
    return localStorage.getItem(BASELINE_KEY) === '1';
  } catch {
    return false;
  }
}

function setBaseline(): void {
  try {
    localStorage.setItem(BASELINE_KEY, '1');
  } catch {
    /* 忽略 */
  }
}

async function fetchCloudRow(userId: string): Promise<CloudRow | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('positions,watchlist,account,nickname,updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CloudRow;
  } catch {
    // 035 迁移没跑、网络失败：当作没有云端数据，本地照常工作
    return null;
  }
}

async function pushNow(userId: string, blob: LocalUserData): Promise<void> {
  if (!supabase) return;
  try {
    const ts = blob.updatedAt > 0 ? blob.updatedAt : Date.now();
    const { error } = await supabase.from('user_data').upsert(
      {
        user_id: userId,
        positions: blob.positions ?? [],
        watchlist: blob.watchlist ?? {},
        account: blob.account ?? {},
        nickname: blob.nickname ?? '',
        updated_at: new Date(ts).toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (!error) setBaseline();
  } catch {
    /* 网络失败就下次再说，本地不受影响 */
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 本地数据变了（持仓/自选/资金/昵称的保存函数里调用）：
 * 刷新本地时间戳，防抖 1.5s 后推送云端。没登录就只记时间戳。
 */
export function markUserDataDirty(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TS_KEY, String(Date.now()));
  } catch {
    /* 忽略 */
  }
  if (!supabase) return;
  const sb = supabase; // 闭包内 TS 无法保持上行的非空收窄，抓一个局部常量
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    try {
      // 基线之前且本地没数据：不推送空值（防止新设备覆盖老设备）
      if (!hasBaseline() && !localHasData()) return;
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      await pushNow(user.id, readLocalBlob());
    } catch {
      /* 忽略 */
    }
  }, PUSH_DEBOUNCE_MS);
}

/**
 * 登录成功 / 打开 app 时调用：云端与本地合并。
 * - 云端没有、本地有 → 推送本地上云
 * - 本地没有（或全新）、云端有 → 采用云端
 * - 都有 → 时间戳新的赢
 */
export async function mergeUserData(): Promise<void> {
  if (!supabase || typeof window === 'undefined') return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const cloud = await fetchCloudRow(user.id);
    const local = readLocalBlob();
    const lEmpty = !localHasData();
    const baseline = hasBaseline();

    if (!cloud) {
      if (!baseline && lEmpty) {
        // 全新设备、两边都没数据：只记基线，不推送空值
        setBaseline();
        return;
      }
      // 云端没有行：本地有数据就推上去（没基线的空本地不推）
      if (!lEmpty || baseline) {
        await pushNow(user.id, local);
      } else {
        setBaseline();
      }
      return;
    }

    const cts = Date.parse(cloud.updated_at) || 0;
    const lts = local.updatedAt || 0;
    if (!baseline && lEmpty) {
      // 新设备首次登录：直接采用云端
      writeLocalBlob(cloud);
      return;
    }
    if (cts > lts + SKEW_MS) {
      writeLocalBlob(cloud);
    } else if (lts > cts + SKEW_MS) {
      await pushNow(user.id, local);
    } else {
      setBaseline();
    }
  } catch {
    /* 忽略：本地照常工作 */
  }
}
