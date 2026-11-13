// 经验语录：民间流传的交易老话，纯分享、非建议。
// 只收真实流传的谚语/格言：出处明确的标出处（巴菲特等），不明确的统一标「民间股谚/经验」，不编造。
export interface Saying {
  zh: string;
  en: string;
  fromZh: string;
  fromEn: string;
}

export const SAYINGS: Saying[] = [
  {
    zh: '早盘大涨要高抛，早盘大跌要低吸；下午大涨不追高，下午大跌看次日。',
    en: 'A big morning pop is for trimming, a big morning drop is for nibbling. A late-day surge is not for chasing; a late-day slide — wait for tomorrow.',
    fromZh: '盘口谚语',
    fromEn: 'Intraday folk rhyme',
  },
  {
    zh: '会买的是徒弟，会卖的是师傅，会空仓的是祖师爷。',
    en: 'Buying makes you an apprentice, selling makes you a master — and sitting in cash makes you a grandmaster.',
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '阴线买入，阳线卖出；不追高，不杀跌。',
    en: 'Buy the down candle, sell the up candle. Never chase highs, never dump the lows.',
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '天量见天价，地量见地价；量在价先。',
    en: 'Climax volume marks the top, dried-up volume marks the bottom — volume leads price.',
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '横有多长，竖有多高。',
    en: 'The longer the base, the higher the climb.',
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '牛市不言顶，熊市不言底。',
    en: "Never call a bull market's top; never call a bear market's bottom.",
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '利好出尽是利空，利空出尽是利好。',
    en: 'Good news fully priced in turns bearish; bad news fully priced in turns bullish.',
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '反弹不是底，是底不反弹。',
    en: "A bounce is not a bottom — real bottoms don't bounce.",
    fromZh: '民间股谚',
    fromEn: 'Folk saying',
  },
  {
    zh: '五穷六绝七翻身。',
    en: 'May is poor, June is desperate, July turns around.',
    fromZh: '港股谚语',
    fromEn: 'Hong Kong market saying',
  },
  {
    zh: '截断亏损，让利润奔跑。',
    en: 'Cut losses short and let profits run.',
    fromZh: '交易格言',
    fromEn: 'Trading maxim',
  },
  {
    zh: '别人贪婪时我恐惧，别人恐惧时我贪婪。',
    en: 'Be fearful when others are greedy, and greedy when others are fearful.',
    fromZh: '巴菲特',
    fromEn: 'Warren Buffett',
  },
  {
    zh: '投资第一条：不要亏损；第二条：不要忘记第一条。',
    en: 'Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1.',
    fromZh: '巴菲特',
    fromEn: 'Warren Buffett',
  },
  {
    zh: '市场永远是对的，先学会认错。',
    en: "The market is always right — learn to admit you're wrong first.",
    fromZh: '民间经验',
    fromEn: 'Trading-room wisdom',
  },
  {
    zh: '仓位决定心态，心态决定操作。',
    en: 'Position size shapes your mindset; mindset shapes your trades.',
    fromZh: '民间经验',
    fromEn: 'Trading-room wisdom',
  },
  {
    zh: '先为不可胜，以待敌之可胜。',
    en: 'First make yourself unbeatable, then wait for the opponent to beat itself.',
    fromZh: '《孙子兵法》',
    fromEn: 'Sun Tzu, The Art of War',
  },
  {
    zh: '贪字多一点，就成了贫。',
    en: "In Chinese, the character for 'greed' is one small stroke away from 'poverty'.",
    fromZh: '民间老话',
    fromEn: 'Folk saying',
  },
];
