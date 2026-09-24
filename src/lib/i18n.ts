/**
* 双语字典。中英切换：先覆盖"壳"（顶栏/底栏/登录弹窗），各 tab 正文后排期渐进接入。
* 另保留 /test 调试页用的旧 key，保证编译不断。
*/
export type Lang = 'zh' | 'en';

const zh = {
// —— 壳：顶栏 ——
appName: '股神乐 Gushenle',
tagline1: '快乐炒股 轻松投资',
tagline2: '不赌不堵 不气不弃',
login: '登录',
logoutConfirm: '退出登录？本地战绩不受影响。',
adminTools: '站长工具',
// —— 壳：底栏 ——
navToday: '今日',
navPortfolio: '持仓',
navMemory: '记忆',
navCommunity: '资讯',
navFun: '娱乐',
// —— 壳：登录弹窗 ——
loginTitle: '登录股神乐',
loginDesc: '输入邮箱，我们发一封登录邮件给你。游戏积分多设备同步。不登录也能玩。',
emailPlaceholder: '你的邮箱',
sending: '发送中…',
sendLink: '发送登录邮件',
sentTitle: '登录邮件已发出',
sentTo: '已发送到',
sentHint: '打开邮件，点里面的 Sign in 链接即可登录。',
resendIn: '重新发送 ({s}s)',
resend: '没收到？重新发送',
changeEmail: '换个邮箱',

// —— /test 调试页旧 key（保留） ——
title: '股神乐 (Gushenle)',
subtitle: '理性投资与情绪调节助手',
testConnection: '点击开始测试连通性',
testing: '测试运行中...',
supabaseDb: '1. Supabase 数据库',
geminiApi: '2. Gemini Flash API',
gameTitle: '🎮 沉思乐：',
slicedCount: '🌱 已割韭菜情绪',
timeLeft: '⏱️ 冷静倒计时',
speedLabel: '韭菜飘升速度',
speedSlow: '🐢 悠闲',
speedNormal: '🚶 标准',
speedFast: '⚡ 暴走',
calmTitle: '理性已回归！',
calmDesc: '你成功切碎了 {count} 株冲动韭菜！\n“市场永远不缺机会，冷静才是最大的红利。”',
playAgain: '🔄 再割一把',
returnDecision: '🚀 返回决策',
gameTip: '划动光标/手指割断韭菜气泡，冷静 20 秒',
};

export type Strings = typeof zh;

const en: Strings = {
// —— shell: header ——
appName: 'Gushenle',
tagline1: 'Trade happy, invest easy',
tagline2: 'No gamble, no tilt, no quit',
login: 'Sign in',
logoutConfirm: 'Sign out? Local game stats stay on this device.',
adminTools: 'Admin tools',
// —— shell: bottom nav ——
navToday: 'Today',
navPortfolio: 'Holdings',
navMemory: 'Memory',
navCommunity: 'News',
navFun: 'Fun',
// —— shell: login modal ——
loginTitle: 'Sign in to Gushenle',
loginDesc:
'Enter your email and we’ll send you a sign-in link. Syncs game scores across devices. No account needed to play.',
emailPlaceholder: 'Your email',
sending: 'Sending…',
sendLink: 'Send sign-in email',
sentTitle: 'Sign-in email sent',
sentTo: 'Sent to',
sentHint: 'Open the email and tap the Sign in link.',
resendIn: 'Resend ({s}s)',
resend: "Didn't get it? Resend",
changeEmail: 'Use a different email',

// —— legacy keys for /test debug page ——
title: 'Gushenle',
subtitle: 'Objective Rhythm Analysis & Emotional Regulation Companion',
testConnection: 'Run Connectivity Test',
testing: 'Testing...',
supabaseDb: '1. Supabase DB',
geminiApi: '2. Gemini Flash API',
gameTitle: '🎮 Meditation Zone: Clipper Party',
slicedCount: '🌱 FOMO Cleared',
timeLeft: '⏱️ Cool-down',
speedLabel: 'Rising Speed',
speedSlow: '🐢 Relaxed',
speedNormal: '🚶 Normal',
speedFast: '⚡ Rush',
calmTitle: 'Rationality Restored!',
calmDesc:
'You successfully cleared {count} impulsive thoughts!\n"The market never lacks opportunity; remaining calm is your true alpha."',
playAgain: '🔄 Play Again',
returnDecision: '🚀 Back to Dashboard',
gameTip: 'Slash floating FOMO bubbles to enter a 20s calm zone',
};

export const STRINGS: Record<Lang, Strings> = { zh, en};

export const LEGACY_WORDS: Record<Lang, string[]> = {
zh: ['追高梭哈', '听小道消息', '割肉离场', '加杠杆', '恐慌抛售', '凭感觉买入', '频繁交易', '盲目跟风'],
en: ['FOMO All-In', 'Rumor Trading', 'Panic Selling', 'Over-Leverage', 'Panic Dump', 'Gut-Buying', 'Over-Trading', 'Blind Herd'],
};
