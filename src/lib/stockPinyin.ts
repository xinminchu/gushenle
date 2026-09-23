/**
 * 股票拼音索引：中文名/中文别名 -> 拼音全拼 + 首字母。
 * 由 /tmp/gen_pinyin.mjs 一次性生成（pinyin-pro），提交后运行时零依赖。
 * 名单或别名有新增时，重新跑一遍脚本即可。
 */

export const STOCK_PINYIN: Record<string, { full: string; initials: string }> = {
  "AAPL": {
    "full": "pingguo",
    "initials": "pg"
  },
  "MSFT": {
    "full": "weiruan",
    "initials": "wr"
  },
  "ORCL": {
    "full": "jiaguwen",
    "initials": "jgw"
  },
  "CRM": {
    "full": "saifushi",
    "initials": "sfs"
  },
  "CSCO": {
    "full": "sike",
    "initials": "sk"
  },
  "DELL": {
    "full": "daier",
    "initials": "de"
  },
  "HPQ": {
    "full": "huipu",
    "initials": "hp"
  },
  "SMCI": {
    "full": "chaoweidiannao",
    "initials": "cwdn"
  },
  "PANW": {
    "full": "paituowangluo",
    "initials": "ptwl"
  },
  "FTNT": {
    "full": "feita",
    "initials": "ft"
  },
  "INTU": {
    "full": "zhijue",
    "initials": "zj"
  },
  "STX": {
    "full": "xijie",
    "initials": "xj"
  },
  "WDC": {
    "full": "xishu",
    "initials": "xs"
  },
  "KEYS": {
    "full": "shide",
    "initials": "sd"
  },
  "MSTR": {
    "full": "weicele",
    "initials": "wcl"
  },
  "BZ": {
    "full": "bosszhipin",
    "initials": "bzp"
  },
  "NVDA": {
    "full": "yingweida",
    "initials": "ywd"
  },
  "AVGO": {
    "full": "botong",
    "initials": "bt"
  },
  "AMD": {
    "full": "chaowei",
    "initials": "cw"
  },
  "INTC": {
    "full": "yingteer",
    "initials": "yte"
  },
  "QCOM": {
    "full": "gaotong",
    "initials": "gt"
  },
  "TSM": {
    "full": "taijidian",
    "initials": "tjd"
  },
  "MU": {
    "full": "meiguang",
    "initials": "mg"
  },
  "000660.KS": {
    "full": "skhailishi",
    "initials": "shls"
  },
  "MRVL": {
    "full": "meiman",
    "initials": "mm"
  },
  "LRCX": {
    "full": "fanlin",
    "initials": "fl"
  },
  "AMAT": {
    "full": "yingyongcailiao",
    "initials": "yycl"
  },
  "ASML": {
    "full": "asimai",
    "initials": "asm"
  },
  "SNPS": {
    "full": "xinsi",
    "initials": "xs"
  },
  "CDNS": {
    "full": "kengteng",
    "initials": "kt"
  },
  "GFS": {
    "full": "gexin",
    "initials": "gx"
  },
  "ON": {
    "full": "ansenmei",
    "initials": "asm"
  },
  "NXPI": {
    "full": "enzhipu",
    "initials": "ezp"
  },
  "TXN": {
    "full": "dezhouyiqi",
    "initials": "dzyq"
  },
  "ADI": {
    "full": "yadenuo",
    "initials": "ydn"
  },
  "MPWR": {
    "full": "xinyuan",
    "initials": "xy"
  },
  "TER": {
    "full": "tairuida",
    "initials": "trd"
  },
  "ENTG": {
    "full": "yingtege",
    "initials": "ytg"
  },
  "GOOGL": {
    "full": "guge",
    "initials": "gg"
  },
  "NFLX": {
    "full": "naifei",
    "initials": "nf"
  },
  "DIS": {
    "full": "dishini",
    "initials": "dsn"
  },
  "WBD": {
    "full": "huanaxiongdi",
    "initials": "hnxd"
  },
  "PARA": {
    "full": "pailameng",
    "initials": "plm"
  },
  "NTES": {
    "full": "wangyi",
    "initials": "wy"
  },
  "IQ": {
    "full": "aiqiyi",
    "initials": "aqy"
  },
  "BILI": {
    "full": "bilibili",
    "initials": "blbl"
  },
  "TME": {
    "full": "tengxunyinyue",
    "initials": "txyy"
  },
  "JPM": {
    "full": "mogendatong",
    "initials": "mgdt"
  },
  "BAC": {
    "full": "meiguoyinhang",
    "initials": "mgyh"
  },
  "WFC": {
    "full": "fuguoyinhang",
    "initials": "fgyh"
  },
  "C": {
    "full": "huaqi",
    "initials": "hq"
  },
  "GS": {
    "full": "gaosheng",
    "initials": "gs"
  },
  "MS": {
    "full": "mogenshidanli",
    "initials": "mgsdl"
  },
  "AXP": {
    "full": "meiguoyuntong",
    "initials": "mgyt"
  },
  "MA": {
    "full": "wanshida",
    "initials": "wsd"
  },
  "BLK": {
    "full": "beilaide",
    "initials": "bld"
  },
  "SCHW": {
    "full": "jiaxin",
    "initials": "jx"
  },
  "AMZN": {
    "full": "yamaxun",
    "initials": "ymx"
  },
  "TSLA": {
    "full": "tesila",
    "initials": "tsl"
  },
  "WMT": {
    "full": "woerma",
    "initials": "wem"
  },
  "COST": {
    "full": "haoshiduo",
    "initials": "hsd"
  },
  "TGT": {
    "full": "tajite",
    "initials": "tjt"
  },
  "HD": {
    "full": "jiadebao",
    "initials": "jdb"
  },
  "SBUX": {
    "full": "xingbake",
    "initials": "xbk"
  },
  "NKE": {
    "full": "naike",
    "initials": "nk"
  },
  "KO": {
    "full": "kekoukele",
    "initials": "kkkl"
  },
  "PEP": {
    "full": "baishi",
    "initials": "bs"
  },
  "PG": {
    "full": "baojie",
    "initials": "bj"
  },
  "CL": {
    "full": "gaolujie",
    "initials": "glj"
  },
  "UL": {
    "full": "lianhelihua",
    "initials": "lhlh"
  },
  "EL": {
    "full": "yashilandai",
    "initials": "ysld"
  },
  "MDLZ": {
    "full": "yizi",
    "initials": "yz"
  },
  "KHC": {
    "full": "kafuhengshi",
    "initials": "kfhs"
  },
  "GIS": {
    "full": "tongyongmofang",
    "initials": "tymf"
  },
  "PM": {
    "full": "feilipumolisi",
    "initials": "flpmls"
  },
  "NIO": {
    "full": "weilai",
    "initials": "wl"
  },
  "LI": {
    "full": "lixiang",
    "initials": "lx"
  },
  "XPEV": {
    "full": "xiaopeng",
    "initials": "xp"
  },
  "PDD": {
    "full": "pinduoduo",
    "initials": "pdd"
  },
  "JD": {
    "full": "jingdong",
    "initials": "jd"
  },
  "YUMC": {
    "full": "baishengzhongguo",
    "initials": "bszg"
  },
  "TAL": {
    "full": "haoweilai",
    "initials": "hwl"
  },
  "EDU": {
    "full": "xindongfang",
    "initials": "xdf"
  },
  "VIPS": {
    "full": "weipinhui",
    "initials": "wph"
  },
  "JNJ": {
    "full": "qiangsheng",
    "initials": "qs"
  },
  "LLY": {
    "full": "lilai",
    "initials": "ll"
  },
  "UNH": {
    "full": "lianhejiankang",
    "initials": "lhjk"
  },
  "PFE": {
    "full": "huirui",
    "initials": "hr"
  },
  "MRK": {
    "full": "moke",
    "initials": "mk"
  },
  "ABBV": {
    "full": "aibowei",
    "initials": "abw"
  },
  "TMO": {
    "full": "saimofei",
    "initials": "smf"
  },
  "DHR": {
    "full": "dannahe",
    "initials": "dnh"
  },
  "ABT": {
    "full": "yapei",
    "initials": "yp"
  },
  "MDT": {
    "full": "meidunli",
    "initials": "mdl"
  },
  "ISRG": {
    "full": "zhijuewaike",
    "initials": "zjwk"
  },
  "SYK": {
    "full": "shisaike",
    "initials": "ssk"
  },
  "GILD": {
    "full": "jilide",
    "initials": "jld"
  },
  "AMGN": {
    "full": "anjin",
    "initials": "aj"
  },
  "REGN": {
    "full": "zaishengyuan",
    "initials": "zsy"
  },
  "BIIB": {
    "full": "bojian",
    "initials": "bj"
  },
  "CI": {
    "full": "xinnuo",
    "initials": "xn"
  },
  "XOM": {
    "full": "aikesenmeifu",
    "initials": "aksmf"
  },
  "CVX": {
    "full": "xuefolong",
    "initials": "xfl"
  },
  "COP": {
    "full": "kangfei",
    "initials": "kf"
  },
  "SLB": {
    "full": "silunbeixie",
    "initials": "slbx"
  },
  "OXY": {
    "full": "xifangshiyou",
    "initials": "xfsy"
  },
  "MPC": {
    "full": "malasongshiyou",
    "initials": "mlssy"
  },
  "PSX": {
    "full": "feilipusi",
    "initials": "flps"
  },
  "BA": {
    "full": "boyin",
    "initials": "by"
  },
  "CAT": {
    "full": "katebile",
    "initials": "ktbl"
  },
  "DE": {
    "full": "dier",
    "initials": "de"
  },
  "GE": {
    "full": "gehangkong",
    "initials": "ghk"
  },
  "RKLB": {
    "full": "huojianshiyanshi",
    "initials": "hjsys"
  },
  "HON": {
    "full": "huoniweier",
    "initials": "hnwe"
  },
  "FDX": {
    "full": "lianbangkuaidi",
    "initials": "lbkd"
  },
  "LMT": {
    "full": "luokexidemading",
    "initials": "lkxdmd"
  },
  "RTX": {
    "full": "leishen",
    "initials": "ls"
  },
  "NOC": {
    "full": "nuoge",
    "initials": "ng"
  },
  "GD": {
    "full": "tongyongdongli",
    "initials": "tydl"
  },
  "UNP": {
    "full": "lianhetaipingyang",
    "initials": "lhtpy"
  },
  "DAL": {
    "full": "dameihangkong",
    "initials": "dmhk"
  },
  "UAL": {
    "full": "meilianhang",
    "initials": "mlh"
  },
  "NEE": {
    "full": "xinjiyuannengyuan",
    "initials": "xjyny"
  },
  "DUK": {
    "full": "dukenengyuan",
    "initials": "dkny"
  },
  "SO": {
    "full": "nanfanggongsi",
    "initials": "nfgs"
  },
  "AMT": {
    "full": "meiguodianta",
    "initials": "mgdt"
  },
  "PLD": {
    "full": "puluosi",
    "initials": "pls"
  },
  "LIN": {
    "full": "linde",
    "initials": "ld"
  },
  "SHW": {
    "full": "xuanwei",
    "initials": "xw"
  },
  "APD": {
    "full": "kongqihuagong",
    "initials": "kqhg"
  },
  "FCX": {
    "full": "ziyougang",
    "initials": "zyg"
  },
  "NEM": {
    "full": "niumengte",
    "initials": "nmt"
  }
};

export const ALIAS_PINYIN: Record<string, { full: string; initials: string }> = {
  "苹果": {
    "full": "pingguo",
    "initials": "pg"
  },
  "微软": {
    "full": "weiruan",
    "initials": "wr"
  },
  "英伟达": {
    "full": "yingweida",
    "initials": "ywd"
  },
  "英伟达公司": {
    "full": "yingweidagongsi",
    "initials": "ywdgs"
  },
  "特斯拉": {
    "full": "tesila",
    "initials": "tsl"
  },
  "英特尔": {
    "full": "yingteer",
    "initials": "yte"
  },
  "谷歌": {
    "full": "guge",
    "initials": "gg"
  },
  "字母表": {
    "full": "zimubiao",
    "initials": "zmb"
  },
  "亚马逊": {
    "full": "yamaxun",
    "initials": "ymx"
  },
  "脸书": {
    "full": "lianshu",
    "initials": "ls"
  },
  "奈飞": {
    "full": "naifei",
    "initials": "nf"
  },
  "网飞": {
    "full": "wangfei",
    "initials": "wf"
  },
  "超微": {
    "full": "chaowei",
    "initials": "cw"
  },
  "高通": {
    "full": "gaotong",
    "initials": "gt"
  },
  "博通": {
    "full": "botong",
    "initials": "bt"
  },
  "台积电": {
    "full": "taijidian",
    "initials": "tjd"
  },
  "阿里": {
    "full": "ali",
    "initials": "al"
  },
  "阿里巴巴": {
    "full": "alibaba",
    "initials": "albb"
  },
  "美光": {
    "full": "meiguang",
    "initials": "mg"
  },
  "币基": {
    "full": "biji",
    "initials": "bj"
  },
  "微策略": {
    "full": "weicele",
    "initials": "wcl"
  },
  "甲骨文": {
    "full": "jiaguwen",
    "initials": "jgw"
  },
  "奥多比": {
    "full": "aoduobi",
    "initials": "adb"
  },
  "赛富时": {
    "full": "saifushi",
    "initials": "sfs"
  },
  "拼多多": {
    "full": "pinduoduo",
    "initials": "pdd"
  },
  "京东": {
    "full": "jingdong",
    "initials": "jd"
  },
  "百度": {
    "full": "baidu",
    "initials": "bd"
  },
  "帕兰提尔": {
    "full": "palantier",
    "initials": "plte"
  },
  "超微电脑": {
    "full": "chaoweidiannao",
    "initials": "cwdn"
  },
  "戴尔": {
    "full": "daier",
    "initials": "de"
  },
  "惠普": {
    "full": "huipu",
    "initials": "hp"
  },
  "思科": {
    "full": "sike",
    "initials": "sk"
  },
  "奈飞公司": {
    "full": "naifeigongsi",
    "initials": "nfgs"
  },
  "沃尔玛": {
    "full": "woerma",
    "initials": "wem"
  },
  "可口可乐": {
    "full": "kekoukele",
    "initials": "kkkl"
  },
  "小火箭": {
    "full": "xiaohuojian",
    "initials": "xhj"
  },
  "火箭实验室": {
    "full": "huojianshiyanshi",
    "initials": "hjsys"
  },
  "海力士": {
    "full": "hailishi",
    "initials": "hls"
  },
  "sk海力士": {
    "full": "skhailishi",
    "initials": "shls"
  },
  "茅台": {
    "full": "maotai",
    "initials": "mt"
  }
};
