import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '股神乐 (Gushenle) - 个人与家庭投资伴侣',
  description: '快乐炒股，轻松投资。不赌，不堵。',
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
      <body className="bg-slate-950 text-slate-100 antialiased select-none min-h-screen">
        {children}
      </body>
    </html>
  );
}