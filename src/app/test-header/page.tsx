'use client';

/**
 * 页头 slogan 摆放对比（临时调试页，选定后删除）
 * 四句 slogan：2 中文 + 2 英文，中英文常在；logo 恒为双语「股神乐 Gushenle」
 */

const ZH = ['快乐炒股 轻松投资', '不赌不堵 不气不弃'];
const EN = ['Trade happy, invest easy', 'No gamble, no tilt, no quit'];
const LOGO = '股神乐 Gushenle';

function Actions() {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button className="bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full">
        登录
      </button>
      <div className="flex bg-slate-800 border border-slate-700 rounded-full text-[10px] overflow-hidden">
        <span className="px-2 py-1 bg-slate-600 text-white font-bold">中</span>
        <span className="px-2 py-1 text-slate-400">EN</span>
      </div>
    </div>
  );
}

function Label({ v, name, desc }: { v: string; name: string; desc: string }) {
  return (
    <div className="px-4 pt-6 pb-2">
      <div className="text-sm font-bold text-amber-300">{v} · {name}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
  );
}

/** V0：现状——logo 左，slogan 右上，操作行右下 */
function V0() {
  return (
    <div className="bg-slate-950">
      <div className="p-4 pb-1 max-w-md mx-auto">
        <header className="flex justify-between items-start gap-2 pt-2">
          <h1 className="text-xl font-bold text-slate-100 whitespace-nowrap pt-1.5">{LOGO}</h1>
          <div className="flex flex-col items-end gap-1.5 min-w-0">
            <div className="text-right leading-tight">
              <p className="text-[10px] text-slate-400">{ZH[0]}</p>
              <p className="text-[10px] text-slate-500">{ZH[1]}</p>
              <p className="text-[10px] text-slate-500">{EN[0]}</p>
              <p className="text-[10px] text-slate-600">{EN[1]}</p>
            </div>
            <Actions />
          </div>
        </header>
      </div>
    </div>
  );
}

/** V1：logo 行干净；下方整幅横幅，居中，双语各一行 */
function V1() {
  return (
    <div className="bg-slate-950">
      <div className="px-4 pt-4 pb-1 max-w-md mx-auto">
        <header className="flex justify-between items-center gap-2">
          <h1 className="text-xl font-bold text-slate-100 whitespace-nowrap">{LOGO}</h1>
          <Actions />
        </header>
      </div>
      <div className="border-y border-slate-800/80 bg-slate-900/40">
        <div className="max-w-md mx-auto px-4 py-2 text-center leading-relaxed">
          <p className="text-[11px] text-slate-300">
            {ZH[0]} <span className="text-slate-600 mx-1">·</span> <span className="text-slate-400">{EN[0]}</span>
          </p>
          <p className="text-[11px] text-slate-300">
            {ZH[1]} <span className="text-slate-600 mx-1">·</span> <span className="text-slate-400">{EN[1]}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** V2：logo 行干净；下方横幅居中，四行分开（中文两行 + 英文两行） */
function V2() {
  return (
    <div className="bg-slate-950">
      <div className="px-4 pt-4 pb-1 max-w-md mx-auto">
        <header className="flex justify-between items-center gap-2">
          <h1 className="text-xl font-bold text-slate-100 whitespace-nowrap">{LOGO}</h1>
          <Actions />
        </header>
      </div>
      <div className="border-y border-slate-800/80 bg-slate-900/40">
        <div className="max-w-md mx-auto px-4 py-2 text-center leading-relaxed">
          <p className="text-[11px] text-slate-300">{ZH[0]}</p>
          <p className="text-[11px] text-slate-300">{ZH[1]}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{EN[0]}</p>
          <p className="text-[10px] text-slate-500">{EN[1]}</p>
        </div>
      </div>
    </div>
  );
}

/** V3：居中大气——logo 居中放大，slogan 居中其下，操作行绝对定位右上 */
function V3() {
  return (
    <div className="bg-slate-950 relative">
      <div className="max-w-md mx-auto px-4 pt-5 pb-3 text-center relative">
        <div className="absolute right-4 top-4">
          <Actions />
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-wide">{LOGO}</h1>
        <div className="mt-1.5 leading-relaxed">
          <p className="text-xs text-slate-300">
            {ZH[0]} <span className="text-slate-600 mx-1">·</span> <span className="text-slate-400">{EN[0]}</span>
          </p>
          <p className="text-xs text-slate-300">
            {ZH[1]} <span className="text-slate-600 mx-1">·</span> <span className="text-slate-400">{EN[1]}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TestHeaderPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className="text-lg font-bold">页头 slogan 摆放对比</h1>
        <p className="text-xs text-slate-400 mt-1">手机宽度（390px）下看哪个均衡、大气。logo 恒为双语「股神乐 Gushenle」。</p>
      </div>

      <Label v="V0" name="现状（右上小字）" desc="logo 左；四句 slogan 右上右对齐；操作行右下。供对照。" />
      <V0 />

      <Label v="V1" name="横幅居中 · 双语各一行" desc="logo 行只剩 logo + 登录/语言；下方整幅细横幅，两句 slogan 各占一行、中文在前英文在后。" />
      <V1 />

      <Label v="V2" name="横幅居中 · 四行分开" desc="同 V1 的横幅，但中文两行在上、英文两行在下，分开排。" />
      <V2 />

      <Label v="V3" name="居中大气" desc="logo 居中放大，slogan 居中两行在其下；登录/语言绝对定位右上。" />
      <V3 />
    </div>
  );
}
