import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

export const metadata: Metadata = {
  title: '股神乐 (Gushenle) - 个人与家庭投资伴侣',
  description: '快乐炒股 轻松投资，不赌不堵 不气不弃',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '股神乐',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 禁用页面缩放，提供类原生 App 体验
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      {/* 启动探针（ES5 写法，老 Safari 也能解析）：React 8 秒内没挂载且抓到报错，
          或 25 秒还没挂载，就弹横幅说明原因（主因多为系统太老），并附第一条错误原文 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){window.__gsl_boot={errors:[]};function pushErr(m){if(window.__gsl_boot.errors.length<5){try{window.__gsl_boot.errors.push(String(m).slice(0,200))}catch(e){}}}window.addEventListener('error',function(e){pushErr(e.message||e.error)},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason;pushErr('promise: '+(r&&(r.message||r)||r))});function showBanner(withErr){if(document.getElementById('gsl-boot-fail'))return;var d=document.createElement('div');d.id='gsl-boot-fail';d.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#7f1d1d;color:#fff;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.7;box-shadow:0 8px 30px rgba(0,0,0,.5)';var html='页面没能正常启动，按钮会点不动。<br>请把 iPhone 系统升级到最新版（设置 → 通用 → 软件更新）后再打开。';var err=withErr&&window.__gsl_boot.errors[0];if(err){html+='<br><span style="opacity:.75;font-size:11px">错误信息：'+String(err).replace(/</g,'&lt;')+'</span>'}html+='<br><span id="gsl-boot-ok" style="display:inline-block;margin-top:6px;padding:4px 14px;border:1px solid rgba(255,255,255,.5);border-radius:999px;font-size:12px">知道了</span>';d.innerHTML=html;document.body.appendChild(d);document.getElementById('gsl-boot-ok').onclick=function(){d.parentNode.removeChild(d)}}setTimeout(function(){if(!window.__gsl_alive&&window.__gsl_boot.errors.length)showBanner(true)},8000);setTimeout(function(){if(!window.__gsl_alive)showBanner(false)},25000);})();`,
        }}
      />
      <body className="bg-slate-950 text-slate-100 antialiased select-none min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  );
}