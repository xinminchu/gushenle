'use client';

/**
 * 券商截图批量导入：在记忆页选多张交易历史截图 -> Gemini vision 识别
 * -> 预览勾选 -> 批量记入操作记录，并按日期从旧到新同步到持仓（买入加权成本，卖出扣减股数）。
 * 已存在于操作记录的交易自动去重（不重复记）。
 * 例外：已存在、但从未同步到持仓的记录会单独标出（「已存在 · 未同步到持仓」），
 * 勾选后只补同步、不重复记账——流水与持仓是两本账，去重不能默认"已同步"。
 */
import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, XCircle, Upload } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import { loadOperations } from '@/lib/operations';
import { loadAccount, adjustmentsTotal, todayStr } from '@/lib/account';
import { loadPositions } from '@/lib/positions';
import {
  saveSnapshot,
  latestSnapshot,
  reconcileBookVsSnapshot,
  fmtUsd,
  type AccountSnapshot,
  type ReconLine,
} from '@/lib/accountSnapshot';
import { saveOperationAndSync, applyOperationToPositions, lastSyncAt, markSynced } from '@/lib/positions';

interface ScannedOp {
  date: string;
  symbol: string;
  action: 'buy' | 'sell';
  qty: number;
  price: number;
  checked: boolean;
  dup: boolean;
  /** 已存在、且同步日志里没有它的同步记录：可勾选只补同步，不重复记账 */
  dupUnsynced?: boolean;
  /** 已存在时对应操作记录的 id（补同步用） */
  dupOpId?: string;
}

type Phase = 'idle' | 'working' | 'preview' | 'snapshot-preview' | 'done';

/** 余额快照（服务端已清洗）：日期可改，保存后才落盘 */
interface ScannedSnapshot {
  date: string;
  broker: string;
  marginBalance: number | null;
  cashSweep: number | null;
  cashBalance: number | null;
  longStockValue: number | null;
  marginEquity: number | null;
  maintenanceRequirement: number | null;
  availableFunds: number | null;
  saved: boolean;
}

const SNAPSHOT_FIELDS: { key: keyof Omit<ScannedSnapshot, 'date' | 'broker' | 'saved'>; en: string; zh: string }[] = [
  { key: 'marginBalance', en: 'Margin Balance', zh: '保证金余额' },
  { key: 'cashSweep', en: 'Cash & Sweep Vehicle', zh: '现金及归集' },
  { key: 'cashBalance', en: 'Cash Balance', zh: '现金余额' },
  { key: 'longStockValue', en: 'Long Stock Value', zh: '持仓市值' },
  { key: 'marginEquity', en: 'Margin Equity', zh: '净值' },
  { key: 'maintenanceRequirement', en: 'Maintenance Requirement', zh: '维持要求' },
  { key: 'availableFunds', en: 'Available Funds For Trading', zh: '可用资金' },
];

/**
 * 账面现金 = 投入本金 − 持仓总成本 + 已实现盈亏 + 非交易现金项
 * （与持仓页 cashValue 同口径；只随买卖与现金项变，不随涨跌变）
 */
function bookCashNow(): number | null {
  const a = loadAccount();
  if (!a) return null;
  const cost = loadPositions().reduce((s, p) => s + p.shares * p.avgCost, 0);
  return Math.round((a.capital - cost + (a.realized ?? 0) + adjustmentsTotal(a)) * 100) / 100;
}

const CHUNK = 4;
const REQUEST_TIMEOUT_MS = 55000;

/**
 * 永远不把原生错误英文直接甩给用户。
 * 背景：iOS Safari 的 Response.json() 解析失败时抛的是
 * "The string did not match the expected pattern."（Chrome 会说 Unexpected token），
 * 根因通常是服务端超时/413 返回了 HTML 错误页。
 */
function friendlyError(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return '识别超时了：试试一次少选几张图片，或等网络好一点再试。';
  }
  if (e instanceof Error) {
    const m = e.message || '';
    if (e.name === 'SyntaxError' || /did not match the expected pattern/i.test(m)) {
      return '网络返回异常（可能是识别超时），请重试；如果反复出现，试试一次只选 1–2 张。';
    }
    if (/failed to fetch|load failed|networkerror/i.test(m)) {
      return '网络连接失败，请检查网络后重试。';
    }
    // 服务端已做过友好化，直接透出（都是中文短句）
    return m;
  }
  return '识别失败，请重试。';
}

async function compressImage(file: File): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 不可用');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob) throw new Error('图片压缩失败');
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as number[]);
  }
  return { data: btoa(binary), mimeType: 'image/jpeg' };
}

const dupKey = (o: { symbol: string; date: string; action: string; qty: number; price: number }) =>
  `${o.symbol}|${o.date}|${o.action}|${o.qty}|${o.price}`;

type TradeFields = { symbol: string; date: string; action: string; qty: number; price: number };

/**
 * 近似同一笔（五项全等之外的兜底）：同一笔交易在不同券商页面里日期会差几天
 * （成交日 vs 结算日），识别价格也会差 1–2 分——实测 MU 卖出已记为
 * 2026-11-10 / $696.39，新截图识别成 11-09 / $696.38，全等匹配漏掉，
 * 被当成新记录默认勾选。全等之外再判：代码/方向/股数全同、价格差 ≤ $0.025
 * （约 2 分，留浮点余量）、日期差 ≤ 4 天（覆盖周末+假日的结算日偏移）。
 */
const sameTradeNear = (a: TradeFields, b: TradeFields): boolean => {
  if (a.symbol !== b.symbol || a.action !== b.action || a.qty !== b.qty) return false;
  if (Math.abs(a.price - b.price) > 0.025) return false;
  const ta = Date.parse(a.date);
  const tb = Date.parse(b.date);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) / 86400000 <= 4;
};

export default function ScreenshotImport({ onImported }: { onImported: () => void }) {
  const { lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState('');
  const [ops, setOps] = useState<ScannedOp[]>([]);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [result, setResult] = useState('');
  // 余额快照：同一批里可能既有 History 又有余额页，交易预览先攒着
  const [snaps, setSnaps] = useState<ScannedSnapshot[]>([]);
  const [pendingOps, setPendingOps] = useState<ScannedOp[]>([]);
  // 账实核对结果（保存快照 / 导入交易后算）：差额必须亮出来，不许静默通过
  const [reconLines, setReconLines] = useState<ReconLine[]>([]);
  const [reconDate, setReconDate] = useState('');

  const startPick = () => {
    setError('');
    setNotices([]);
    setResult('');
    setReconLines([]);
    setReconDate('');
    fileRef.current?.click();
  };

  /**
   * 去重：跟已有操作记录比。注意"记录已存在"不等于"已同步到持仓"——
   * 流水和持仓是两本账，一条记录可能只进了流水、从未动过持仓。
   * 这种记录单独标出，可勾选只补同步（不重复记账）。
   */
  const enterTradePreview = (list: ScannedOp[]) => {
    const existingOps: (TradeFields & { id: string })[] = loadOperations().map((r) => ({
      id: r.id,
      symbol: r.symbol,
      date: r.date,
      action: r.action,
      qty: r.qty ?? 0,
      price: r.price,
    }));
    const seenOps: TradeFields[] = [];
    const seenBefore = (o: TradeFields) =>
      seenOps.some((s) => dupKey(s) === dupKey(o) || sameTradeNear(s, o));
    for (const o of list) {
      const ex = existingOps.find((r) => dupKey(r) === dupKey(o) || sameTradeNear(r, o));
      if (ex) {
        o.dup = true;
        o.checked = false;
        o.dupOpId = ex.id;
        // 只有第一次出现才可补同步；同一批里重复出现的是纯重复。
        // lastSyncAt 为空也可能是同步日志被裁剪（只留最近 200 条）的老记录，
        // 所以补同步默认不勾选，由用户逐笔确认。
        if (!seenBefore(o) && lastSyncAt(ex.id) === null) o.dupUnsynced = true;
      } else if (seenBefore(o)) {
        o.dup = true;
        o.checked = false;
      }
      seenOps.push(o);
    }
    // 按日期倒序
    list.sort((a, b) => b.date.localeCompare(a.date));
    setOps(list);
    setPhase('preview');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhase('working');
    setError('');
    setNotices([]);
    setOps([]);
    setSnaps([]);
    setPendingOps([]);
    setReconLines([]);
    setReconDate('');
    try {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (list.length === 0) throw new Error(tx(lang, 'No images selected', '没有选中图片'));
      setProgress(tx(lang, `Compressing ${list.length} images…`, `压缩 ${list.length} 张图片…`));
      const compressed = [];
      for (const f of list) compressed.push(await compressImage(f));

      const all: ScannedOp[] = [];
      const allSnaps: ScannedSnapshot[] = [];
      const failedBatches: number[] = [];
      const allNotices: string[] = [];
      for (let i = 0; i < compressed.length; i += CHUNK) {
        const chunk = compressed.slice(i, i + CHUNK);
        // 单批 payload 过大（Vercel 请求体上限）时提前拦下，给明确指引而不是等 413
        const payloadBytes = chunk.reduce((n, c) => n + c.data.length, 0);
        if (payloadBytes > 3_000_000) {
          throw new Error(
            tx(
              lang,
              'Images too large — pick fewer at a time',
              '图片太大：一次少选几张再试（建议一次 2 张）',
            ),
          );
        }
        setProgress(
          tx(
            lang,
            `Recognizing ${Math.min(i + CHUNK, compressed.length)}/${compressed.length}…`,
            `识别中 ${Math.min(i + CHUNK, compressed.length)}/${compressed.length}…`,
          ),
        );
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        let j: any;
        try {
          const res = await fetch('/api/operations/import-scan', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ images: chunk }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            // 先尝试读 JSON 错误体（no_key / too_many 这类业务错误）
            let bj: any = null;
            try {
              bj = await res.json();
            } catch {
              /* HTML 错误页，走友好映射 */
            }
            if (bj && bj.ok === false) {
              if (bj.error === 'no_key') throw new Error(bj.message);
              throw new Error(bj.message || tx(lang, 'Recognition failed', '识别失败'));
            }
            throw new Error(
              tx(lang, `Server busy (HTTP ${res.status}) — try again`, `服务器忙（${res.status}），请重试`),
            );
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) {
            throw new Error(tx(lang, 'Bad server response — try again', '服务器返回异常，请重试'));
          }
          try {
            j = await res.json();
          } catch (e) {
            throw e instanceof DOMException ? e : new Error('json_parse_failed');
          }
        } finally {
          clearTimeout(timer);
        }
        if (!j.ok) {
          if (j.error === 'no_key') throw new Error(j.message);
          throw new Error(j.message || tx(lang, 'Recognition failed', '识别失败'));
        }
        for (const o of j.operations || []) {
          all.push({ ...o, checked: true, dup: false });
        }
        for (const s of j.snapshots || []) {
          allSnaps.push({
            date:
              typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : todayStr(),
            broker: typeof s.broker === 'string' && s.broker ? s.broker : 'Schwab',
            marginBalance: s.marginBalance ?? null,
            cashSweep: s.cashSweep ?? null,
            cashBalance: s.cashBalance ?? null,
            longStockValue: s.longStockValue ?? null,
            marginEquity: s.marginEquity ?? null,
            maintenanceRequirement: s.maintenanceRequirement ?? null,
            availableFunds: s.availableFunds ?? null,
            saved: false,
          });
        }
        for (const n of j.notices || []) {
          if (typeof n === 'string' && n && !allNotices.includes(n)) allNotices.push(n);
        }
        if (j.failed && j.failed.length > 0) failedBatches.push(i / CHUNK + 1);
      }
      setNotices(allNotices);
      if (all.length === 0 && allSnaps.length === 0) {
        if (allNotices.length > 0) {
          // 识别成功但无交易（截图不是 History 页）：只展示指引，不抛错
          setPhase('idle');
          return;
        }
        throw new Error(
          tx(lang, 'No trades recognized — try clearer screenshots', '没识别出交易记录，换更清晰的截图试试'),
        );
      }
      if (failedBatches.length > 0) {
        setError(
          tx(
            lang,
            `Batch ${failedBatches.join(',')} partially failed — some images skipped`,
            `第 ${failedBatches.join('、')} 批部分失败，有图片被跳过`,
          ),
        );
      }
      if (allSnaps.length > 0) {
        // 余额快照先预览保存；同一批里的交易攒着，点「继续」再进交易预览
        setSnaps(allSnaps);
        setPendingOps(all);
        setPhase('snapshot-preview');
        return;
      }
      enterTradePreview(all);
    } catch (e) {
      setError(friendlyError(e));
      setPhase('idle');
    }
  };

  const toggle = (i: number) => {
    setOps((prev) => prev.map((o, idx) => (idx === i ? { ...o, checked: !o.checked } : o)));
  };

  /** 保存一张余额快照，并立刻拿它跟账面现金核对一次 */
  const saveOneSnapshot = (i: number) => {
    const s = snaps[i];
    if (!s || s.saved) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
      setError(tx(lang, 'Snapshot date format is off', '快照日期格式不对'));
      return;
    }
    const saved: AccountSnapshot = saveSnapshot({
      date: s.date,
      broker: s.broker,
      marginBalance: s.marginBalance,
      cashSweep: s.cashSweep,
      cashBalance: s.cashBalance,
      longStockValue: s.longStockValue,
      marginEquity: s.marginEquity,
      maintenanceRequirement: s.maintenanceRequirement,
      availableFunds: s.availableFunds,
    });
    setSnaps((prev) => prev.map((x, idx) => (idx === i ? { ...x, saved: true } : x)));
    const recon = reconcileBookVsSnapshot({
      bookCash: bookCashNow(),
      bookLongValue: null, // 这里没有行情，持仓市值留到持仓页核对
      snapshot: saved,
    });
    if (!recon.noSnapshot) {
      setReconLines(recon.lines);
      setReconDate(saved.date);
    }
  };

  /** 快照预览的「继续」：有交易待导入就进交易预览，否则回待机 */
  const continueFromSnapshots = () => {
    if (pendingOps.length > 0) {
      enterTradePreview(pendingOps);
      setPendingOps([]);
    } else {
      setPhase('done');
      setResult(
        tx(lang, 'Snapshot saved ✓', '快照已保存 ✓'),
      );
      setSnaps([]);
    }
  };

  const confirmImport = () => {
    // 按日期从旧到新同步：同一只股票先买后卖，卖出才不会因持仓不足失败。
    // 未同步的重复记录（dupUnsynced）只补同步、不重复记账。
    const picked = ops
      .filter((o) => o.checked && (!o.dup || o.dupUnsynced))
      .sort((a, b) => a.date.localeCompare(b.date));
    const synced: string[] = [];
    const resynced: string[] = [];
    const failed: string[] = [];
    for (const o of picked) {
      if (o.dup && o.dupUnsynced && o.dupOpId) {
        const r = applyOperationToPositions({
          symbol: o.symbol,
          action: o.action,
          price: o.price,
          qty: o.qty,
          date: o.date,
        });
        if (r.ok) {
          markSynced(o.dupOpId);
          resynced.push(r.msg);
        } else {
          failed.push(r.msg);
        }
        continue;
      }
      const { syncMsg, syncOk } = saveOperationAndSync({
        symbol: o.symbol,
        action: o.action,
        price: o.price,
        qty: o.qty,
        date: o.date,
        source: 'import',
        thesis: tx(lang, 'Imported from brokerage screenshot', '券商截图导入'),
      });
      if (syncMsg) (syncOk ? synced : failed).push(syncMsg);
    }
    onImported();
    const importedCount = picked.filter((o) => !o.dup).length;
    const syncLine =
      synced.length > 0
        ? tx(lang, `Holdings synced: ${synced.join('；')}`, `持仓已同步：${synced.join('；')}`)
        : '';
    const resyncLine =
      resynced.length > 0
        ? tx(
            lang,
            `Resynced ${resynced.length}: ${resynced.join('；')}`,
            `补同步 ${resynced.length} 笔：${resynced.join('；')}`,
          )
        : '';
    const failLine =
      failed.length > 0
        ? tx(
            lang,
            `${failed.length} could not sync to holdings: ${failed.join('；')} — tap "Sync to holdings" on the entry in Memory to retry.`,
            `${failed.length} 笔没能同步到持仓：${failed.join('；')}——可去记忆页点这条记录下的「同步到持仓」再试。`,
          )
        : '';
    const inner = [syncLine, resyncLine].filter(Boolean).join('；');
    const head =
      importedCount > 0
        ? tx(lang, `Imported ${importedCount} trades ✓`, `已导入 ${importedCount} 笔 ✓`)
        : tx(lang, 'Nothing new to import ✓', '没有新交易导入 ✓');
    setResult(
      tx(
        lang,
        `${head}${inner ? ` (${inner})` : ''}${failLine ? ` ${failLine}` : ''}`,
        `${head}${inner ? `（${inner}）` : ''}${failLine ? ` ${failLine}` : ''}`,
      ),
    );
    // 导入交易后账实核对：最新快照 vs 账面现金，有差额必须亮出来
    const snap = latestSnapshot();
    const recon = reconcileBookVsSnapshot({
      bookCash: bookCashNow(),
      bookLongValue: null, // 这里没有行情，持仓市值留到持仓页核对
      snapshot: snap,
    });
    if (!recon.noSnapshot) {
      setReconLines(recon.lines);
      setReconDate(snap?.date ?? '');
    }
    setPhase('done');
    setOps([]);
  };

  const reset = () => {
    setPhase('idle');
    setOps([]);
    setSnaps([]);
    setPendingOps([]);
    setError('');
    setNotices([]);
    setResult('');
    setReconLines([]);
    setReconDate('');
    setProgress('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-semibold text-slate-100">
          {tx(lang, 'Import from screenshots', '截图导入')}
        </span>
        <span className="text-[10px] text-slate-500">
          {tx(lang, 'Webull / brokerage history', '券商 History 截图')}
        </span>
      </div>

      {phase === 'idle' && (
        <>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {tx(
              lang,
              'Pick your brokerage history screenshots — trades are recognized, you review, then import. Journal/transfer rows are skipped automatically. A Balances / Account Summary screenshot saves an account-truth snapshot instead.',
              '选券商 History 截图——自动识别交易，你过目后再导入。Journal 转仓、资金划转会自动跳过。余额截图（Account Summary / Balances 页）会存为账户真相快照。',
            )}
          </p>
          <button
            onClick={startPick}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> {tx(lang, 'Pick screenshots', '选择截图（可多选）')}
          </button>
        </>
      )}

      {phase === 'working' && (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
          <span className="text-xs text-slate-300">{progress}</span>
        </div>
      )}

      {phase === 'snapshot-preview' && (
        <>
          <p className="text-[11px] text-slate-400">
            {tx(
              lang,
              `Recognized ${snaps.length} balance snapshot${snaps.length > 1 ? 's' : ''} — check the numbers and the date, then save:`,
              `识别出 ${snaps.length} 张余额快照——核对数字和日期，确认后保存：`,
            )}
          </p>
          {snaps.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-100">{s.broker}</span>
                <span className="text-[11px] text-slate-400">{tx(lang, 'Snapshot date', '快照日期')}</span>
                <input
                  type="date"
                  value={s.date}
                  disabled={s.saved}
                  onChange={(e) =>
                    setSnaps((prev) => prev.map((x, idx) => (idx === i ? { ...x, date: e.target.value } : x)))
                  }
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                />
                {s.saved && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {tx(lang, 'Saved ✓', '已保存 ✓')}
                  </span>
                )}
              </div>
              <table className="w-full text-[11px]">
                <tbody>
                  {SNAPSHOT_FIELDS.map((f) => (
                    <tr key={f.key} className="border-t border-slate-800/60">
                      <td className="py-1 pr-2 text-slate-400">{tx(lang, f.en, f.zh)}</td>
                      <td className="py-1 text-right text-slate-100 tabular-nums">
                        {s[f.key] == null ? '—' : fmtUsd(s[f.key] as number)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!s.saved && (
                <button
                  onClick={() => saveOneSnapshot(i)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {tx(lang, 'Save snapshot', '保存快照')}
                </button>
              )}
            </div>
          ))}
          {reconLines.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 space-y-1">
              <div className="text-[11px] font-medium text-slate-400">
                {tx(lang, 'Book vs snapshot', '账实核对')}
                {reconDate ? `（${reconDate}）` : ''}
              </div>
              {reconLines.map((l, i) => (
                <p
                  key={i}
                  className={`text-[11px] leading-relaxed ${l.flagged ? 'text-amber-300' : 'text-emerald-300'}`}
                >
                  {l.flagged ? '⚠️ ' : '✓ '}
                  {tx(lang, l.en, l.zh)}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> {tx(lang, 'Cancel', '取消')}
            </button>
            <button
              onClick={continueFromSnapshots}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs py-2 rounded-lg font-medium"
            >
              {pendingOps.length > 0
                ? tx(lang, 'Continue to trades', '继续看交易')
                : tx(lang, 'Done', '完成')}
            </button>
          </div>
        </>
      )}

      {phase === 'preview' && (
        <>
          <p className="text-[11px] text-slate-400">
            {tx(
              lang,
              `Recognized ${ops.length} — uncheck anything wrong, then import:`,
              `识别出 ${ops.length} 笔——不对的取消勾选，确认后导入：`,
            )}
          </p>
          {ops.some((o) => o.dupUnsynced) && (
            <p className="text-[11px] text-amber-300 leading-relaxed">
              {tx(
                lang,
                'Some entries already exist but were never synced to holdings — check them to sync only, without duplicating the journal.',
                '有几笔记录已存在、但从未同步到持仓——勾选可只补同步，不会重复记账。',
              )}
            </p>
          )}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-slate-400">
                  <th className="py-1.5 px-2 text-left w-8"></th>
                  <th className="py-1.5 px-1 text-left">{tx(lang, 'Date', '日期')}</th>
                  <th className="py-1.5 px-1 text-left">{tx(lang, 'Sym', '代码')}</th>
                  <th className="py-1.5 px-1 text-left">{tx(lang, 'Side', '方向')}</th>
                  <th className="py-1.5 px-1 text-right">{tx(lang, 'Qty', '数量')}</th>
                  <th className="py-1.5 px-1 text-right">{tx(lang, 'Price', '价格')}</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((o, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-800 ${
                      o.dupUnsynced ? 'bg-amber-950/40' : o.dup ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="py-1.5 px-2">
                      <input
                        type="checkbox"
                        checked={o.checked}
                        disabled={o.dup && !o.dupUnsynced}
                        onChange={() => toggle(i)}
                        className="w-3.5 h-3.5 accent-emerald-500"
                      />
                    </td>
                    <td className="py-1.5 px-1 text-slate-300 tabular-nums">{o.date.slice(5)}</td>
                    <td className="py-1.5 px-1 text-slate-100 font-semibold">{o.symbol}</td>
                    <td className={`py-1.5 px-1 ${o.action === 'buy' ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {o.action === 'buy' ? tx(lang, 'Buy', '买入') : tx(lang, 'Sell', '卖出')}
                      {o.dup && (
                        <span className="text-slate-500"> · {tx(lang, 'dup', '已存在')}</span>
                      )}
                      {o.dupUnsynced && (
                        <span className="text-amber-300">
                          {' '}
                          · {tx(lang, 'not synced to holdings', '未同步到持仓')}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-1 text-right text-slate-300 tabular-nums">{o.qty}</td>
                    <td className="py-1.5 px-1 text-right text-slate-300 tabular-nums">${o.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> {tx(lang, 'Cancel', '取消')}
            </button>
            <button
              onClick={confirmImport}
              disabled={!ops.some((o) => o.checked && (!o.dup || o.dupUnsynced))}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />{' '}
              {tx(lang, 'Import selected', '导入选中')} (
              {ops.filter((o) => o.checked && (!o.dup || o.dupUnsynced)).length})
            </button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="flex-1 text-xs text-slate-200 leading-relaxed">{result}</p>
            <button onClick={reset} className="text-[11px] text-sky-400 font-medium shrink-0">
              {tx(lang, 'Import more', '继续导入')}
            </button>
          </div>
          {reconLines.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 space-y-1">
              <div className="text-[11px] font-medium text-slate-400">
                {tx(lang, 'Book vs snapshot', '账实核对')}
                {reconDate ? `（${reconDate}）` : ''}
              </div>
              {reconLines.map((l, i) => (
                <p
                  key={i}
                  className={`text-[11px] leading-relaxed ${l.flagged ? 'text-amber-300' : 'text-emerald-300'}`}
                >
                  {l.flagged ? '⚠️ ' : '✓ '}
                  {tx(lang, l.en, l.zh)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && phase !== 'working' && (
        <p className="text-[11px] text-amber-300 leading-relaxed">⚠️ {error}</p>
      )}

      {notices.length > 0 && phase !== 'working' && (
        <div className="space-y-2">
          {notices.map((n, i) => (
            <p key={i} className="text-[11px] text-sky-300 leading-relaxed bg-sky-950/60 border border-sky-800 rounded-lg p-2">
              💡 {n}
            </p>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
