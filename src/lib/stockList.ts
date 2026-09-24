/**
 * 全栈共用的股票名单库：代码 / 英文名 / 中文名 / 板块 / 主题。
 * 单一数据源：自选添加校验、中文名自动填充、以后做「发现股票」筛选都走这里。
 * 覆盖主流美股（科技/半导体/金融/消费/医疗/能源/工业/通信/中概/加密概念等约 170 只）。
 */

export interface StockInfo {
  code: string;
  en: string;
  zh: string;
  /** 板块 */
  sector: string;
  /** 主题，如 AI / 芯片 / 电动车 */
  themes: string[];
}

export const SECTORS = [
  '科技', '半导体', '金融', '消费', '医疗',
  '能源', '工业', '通信', '公用事业', '房地产', '原材料',
] as const;

export const STOCK_LIST: StockInfo[] = [
  // ---- 科技巨头 ----
  { code: 'AAPL', en: 'Apple', zh: '苹果', sector: '科技', themes: ['消费电子', 'AI'] },
  { code: 'MSFT', en: 'Microsoft', zh: '微软', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'ORCL', en: 'Oracle', zh: '甲骨文', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'CRM', en: 'Salesforce', zh: '赛富时', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'ADBE', en: 'Adobe', zh: 'Adobe', sector: '科技', themes: ['AI'] },
  { code: 'PLTR', en: 'Palantir', zh: 'Palantir', sector: '科技', themes: ['AI'] },
  { code: 'IBM', en: 'IBM', zh: 'IBM', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'CSCO', en: 'Cisco', zh: '思科', sector: '科技', themes: ['云计算'] },
  { code: 'DELL', en: 'Dell', zh: '戴尔', sector: '科技', themes: ['AI'] },
  { code: 'HPQ', en: 'HP', zh: '惠普', sector: '科技', themes: [] },
  { code: 'SMCI', en: 'Supermicro', zh: '超微电脑', sector: '科技', themes: ['AI'] },
  { code: 'ANET', en: 'Arista', zh: 'Arista', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'PANW', en: 'Palo Alto Networks', zh: '派拓网络', sector: '科技', themes: ['网络安全'] },
  { code: 'CRWD', en: 'CrowdStrike', zh: 'CrowdStrike', sector: '科技', themes: ['网络安全'] },
  { code: 'FTNT', en: 'Fortinet', zh: '飞塔', sector: '科技', themes: ['网络安全'] },
  { code: 'NOW', en: 'ServiceNow', zh: 'ServiceNow', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'SNOW', en: 'Snowflake', zh: 'Snowflake', sector: '科技', themes: ['云计算', 'AI'] },
  { code: 'DDOG', en: 'Datadog', zh: 'Datadog', sector: '科技', themes: ['云计算'] },
  { code: 'NET', en: 'Cloudflare', zh: 'Cloudflare', sector: '科技', themes: ['云计算', '网络安全'] },
  { code: 'TEAM', en: 'Atlassian', zh: 'Atlassian', sector: '科技', themes: [] },
  { code: 'WDAY', en: 'Workday', zh: 'Workday', sector: '科技', themes: ['云计算'] },
  { code: 'INTU', en: 'Intuit', zh: '直觉', sector: '科技', themes: ['金融科技'] },
  { code: 'SHOP', en: 'Shopify', zh: 'Shopify', sector: '科技', themes: ['电商'] },
  { code: 'UBER', en: 'Uber', zh: 'Uber', sector: '科技', themes: ['共享出行'] },
  { code: 'LYFT', en: 'Lyft', zh: 'Lyft', sector: '科技', themes: ['共享出行'] },
  { code: 'DASH', en: 'DoorDash', zh: 'DoorDash', sector: '科技', themes: [] },
  { code: 'ZM', en: 'Zoom', zh: 'Zoom', sector: '科技', themes: ['云计算'] },
  { code: 'DOCU', en: 'DocuSign', zh: 'DocuSign', sector: '科技', themes: [] },
  { code: 'OKTA', en: 'Okta', zh: 'Okta', sector: '科技', themes: ['网络安全'] },
  { code: 'ZS', en: 'Zscaler', zh: 'Zscaler', sector: '科技', themes: ['网络安全'] },
  { code: 'S', en: 'SentinelOne', zh: 'SentinelOne', sector: '科技', themes: ['网络安全'] },
  { code: 'ESTC', en: 'Elastic', zh: 'Elastic', sector: '科技', themes: ['云计算'] },
  { code: 'MDB', en: 'MongoDB', zh: 'MongoDB', sector: '科技', themes: ['云计算'] },
  { code: 'CFLT', en: 'Confluent', zh: 'Confluent', sector: '科技', themes: ['云计算'] },
  { code: 'PATH', en: 'UiPath', zh: 'UiPath', sector: '科技', themes: ['AI'] },
  { code: 'IOT', en: 'Samsara', zh: 'Samsara', sector: '科技', themes: [] },
  { code: 'STX', en: 'Seagate', zh: '希捷', sector: '科技', themes: [] },
  { code: 'WDC', en: 'Western Digital', zh: '西数', sector: '科技', themes: [] },
  { code: 'NTAP', en: 'NetApp', zh: 'NetApp', sector: '科技', themes: ['云计算'] },
  { code: 'ANSS', en: 'Ansys', zh: 'Ansys', sector: '科技', themes: [] },
  { code: 'ADSK', en: 'Autodesk', zh: 'Autodesk', sector: '科技', themes: [] },
  { code: 'KEYS', en: 'Keysight', zh: '是德', sector: '科技', themes: [] },
  { code: 'APP', en: 'AppLovin', zh: 'AppLovin', sector: '科技', themes: ['广告', 'AI'] },
  { code: 'TTD', en: 'Trade Desk', zh: 'Trade Desk', sector: '科技', themes: ['广告'] },
  { code: 'MGNI', en: 'Magnite', zh: 'Magnite', sector: '科技', themes: ['广告'] },
  { code: 'TOST', en: 'Toast', zh: 'Toast', sector: '科技', themes: ['金融科技'] },
  { code: 'BILL', en: 'Bill.com', zh: 'Bill', sector: '科技', themes: ['金融科技'] },
  { code: 'GLOB', en: 'Globant', zh: 'Globant', sector: '科技', themes: [] },
  { code: 'EPAM', en: 'EPAM', zh: 'EPAM', sector: '科技', themes: [] },
  { code: 'SOUN', en: 'SoundHound', zh: 'SoundHound', sector: '科技', themes: ['AI'] },
  { code: 'BBAI', en: 'BigBear.ai', zh: 'BigBear', sector: '科技', themes: ['AI'] },
  { code: 'AI', en: 'C3.ai', zh: 'C3 AI', sector: '科技', themes: ['AI'] },
  { code: 'MSTR', en: 'Strategy', zh: '微策略', sector: '科技', themes: ['加密'] },
  { code: 'MARA', en: 'MARA Holdings', zh: 'MARA', sector: '科技', themes: ['加密'] },
  { code: 'RIOT', en: 'Riot Platforms', zh: 'Riot', sector: '科技', themes: ['加密'] },
  { code: 'CLSK', en: 'CleanSpark', zh: 'CleanSpark', sector: '科技', themes: ['加密'] },
  { code: 'IREN', en: 'Iris Energy', zh: 'IREN', sector: '科技', themes: ['加密', 'AI'] },
  { code: 'HUT', en: 'Hut 8', zh: 'Hut8', sector: '科技', themes: ['加密'] },
  { code: 'BZ', en: 'BOSS Zhipin', zh: 'BOSS直聘', sector: '科技', themes: [] },
  // ---- 半导体 ----
  { code: 'NVDA', en: 'NVIDIA', zh: '英伟达', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'AVGO', en: 'Broadcom', zh: '博通', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'AMD', en: 'AMD', zh: '超微', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'INTC', en: 'Intel', zh: '英特尔', sector: '半导体', themes: ['芯片'] },
  { code: 'QCOM', en: 'Qualcomm', zh: '高通', sector: '半导体', themes: ['芯片'] },
  { code: 'TSM', en: 'TSMC', zh: '台积电', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'MU', en: 'Micron', zh: '美光', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'SKHY', en: 'SK Hynix', zh: 'SK海力士', sector: '半导体', themes: ['芯片'] },
  { code: 'ARM', en: 'Arm', zh: 'Arm', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'MRVL', en: 'Marvell', zh: '美满', sector: '半导体', themes: ['AI', '芯片'] },
  { code: 'LRCX', en: 'Lam Research', zh: '泛林', sector: '半导体', themes: ['芯片'] },
  { code: 'AMAT', en: 'Applied Materials', zh: '应用材料', sector: '半导体', themes: ['芯片'] },
  { code: 'KLAC', en: 'KLA', zh: 'KLA', sector: '半导体', themes: ['芯片'] },
  { code: 'ASML', en: 'ASML', zh: '阿斯麦', sector: '半导体', themes: ['芯片'] },
  { code: 'SNPS', en: 'Synopsys', zh: '新思', sector: '半导体', themes: ['芯片'] },
  { code: 'CDNS', en: 'Cadence', zh: '铿腾', sector: '半导体', themes: ['芯片'] },
  { code: 'GFS', en: 'GlobalFoundries', zh: '格芯', sector: '半导体', themes: ['芯片'] },
  { code: 'ON', en: 'ON Semiconductor', zh: '安森美', sector: '半导体', themes: ['芯片'] },
  { code: 'NXPI', en: 'NXP', zh: '恩智浦', sector: '半导体', themes: ['芯片'] },
  { code: 'TXN', en: 'Texas Instruments', zh: '德州仪器', sector: '半导体', themes: ['芯片'] },
  { code: 'ADI', en: 'Analog Devices', zh: '亚德诺', sector: '半导体', themes: ['芯片'] },
  { code: 'MPWR', en: 'Monolithic Power', zh: '芯源', sector: '半导体', themes: ['芯片'] },
  { code: 'TER', en: 'Teradyne', zh: '泰瑞达', sector: '半导体', themes: ['芯片'] },
  { code: 'ENTG', en: 'Entegris', zh: '英特格', sector: '半导体', themes: ['芯片'] },
  // ---- 通信传媒 ----
  { code: 'GOOGL', en: 'Alphabet', zh: '谷歌', sector: '通信', themes: ['AI', '云计算'] },
  { code: 'META', en: 'Meta', zh: 'Meta', sector: '通信', themes: ['社交', 'AI'] },
  { code: 'NFLX', en: 'Netflix', zh: '奈飞', sector: '通信', themes: ['流媒体'] },
  { code: 'DIS', en: 'Disney', zh: '迪士尼', sector: '通信', themes: ['流媒体'] },
  { code: 'WBD', en: 'Warner Bros Discovery', zh: '华纳兄弟', sector: '通信', themes: ['流媒体'] },
  { code: 'PARA', en: 'Paramount', zh: '派拉蒙', sector: '通信', themes: ['流媒体'] },
  { code: 'EA', en: 'Electronic Arts', zh: 'EA', sector: '通信', themes: ['游戏'] },
  { code: 'TTWO', en: 'Take-Two', zh: 'Take-Two', sector: '通信', themes: ['游戏'] },
  { code: 'RBLX', en: 'Roblox', zh: 'Roblox', sector: '通信', themes: ['游戏'] },
  { code: 'SPOT', en: 'Spotify', zh: 'Spotify', sector: '通信', themes: ['流媒体'] },
  { code: 'ROKU', en: 'Roku', zh: 'Roku', sector: '通信', themes: ['流媒体'] },
  { code: 'PINS', en: 'Pinterest', zh: 'Pinterest', sector: '通信', themes: ['社交'] },
  { code: 'SNAP', en: 'Snap', zh: 'Snap', sector: '通信', themes: ['社交'] },
  { code: 'T', en: 'AT&T', zh: 'AT&T', sector: '通信', themes: ['电信'] },
  { code: 'VZ', en: 'Verizon', zh: 'Verizon', sector: '通信', themes: ['电信'] },
  { code: 'TMUS', en: 'T-Mobile', zh: 'T-Mobile', sector: '通信', themes: ['电信'] },
  { code: 'NTES', en: 'NetEase', zh: '网易', sector: '通信', themes: ['游戏'] },
  { code: 'IQ', en: 'iQIYI', zh: '爱奇艺', sector: '通信', themes: ['流媒体'] },
  { code: 'BILI', en: 'Bilibili', zh: '哔哩哔哩', sector: '通信', themes: ['流媒体'] },
  { code: 'TME', en: 'Tencent Music', zh: '腾讯音乐', sector: '通信', themes: ['流媒体'] },
  // ---- 金融 ----
  { code: 'JPM', en: 'JPMorgan', zh: '摩根大通', sector: '金融', themes: [] },
  { code: 'BAC', en: 'Bank of America', zh: '美国银行', sector: '金融', themes: [] },
  { code: 'WFC', en: 'Wells Fargo', zh: '富国银行', sector: '金融', themes: [] },
  { code: 'C', en: 'Citigroup', zh: '花旗', sector: '金融', themes: [] },
  { code: 'GS', en: 'Goldman Sachs', zh: '高盛', sector: '金融', themes: [] },
  { code: 'MS', en: 'Morgan Stanley', zh: '摩根士丹利', sector: '金融', themes: [] },
  { code: 'AXP', en: 'American Express', zh: '美国运通', sector: '金融', themes: ['金融科技'] },
  { code: 'V', en: 'Visa', zh: 'Visa', sector: '金融', themes: ['金融科技'] },
  { code: 'MA', en: 'Mastercard', zh: '万事达', sector: '金融', themes: ['金融科技'] },
  { code: 'BLK', en: 'BlackRock', zh: '贝莱德', sector: '金融', themes: [] },
  { code: 'SCHW', en: 'Charles Schwab', zh: '嘉信', sector: '金融', themes: [] },
  { code: 'COIN', en: 'Coinbase', zh: 'Coinbase', sector: '金融', themes: ['加密'] },
  { code: 'HOOD', en: 'Robinhood', zh: 'Robinhood', sector: '金融', themes: ['金融科技', '加密'] },
  { code: 'AFRM', en: 'Affirm', zh: 'Affirm', sector: '金融', themes: ['金融科技'] },
  { code: 'SOFI', en: 'SoFi', zh: 'SoFi', sector: '金融', themes: ['金融科技'] },
  { code: 'SQ', en: 'Block', zh: 'Block', sector: '金融', themes: ['金融科技', '加密'] },
  { code: 'PYPL', en: 'PayPal', zh: 'PayPal', sector: '金融', themes: ['金融科技'] },
  { code: 'UPST', en: 'Upstart', zh: 'Upstart', sector: '金融', themes: ['AI', '金融科技'] },
  { code: 'LMND', en: 'Lemonade', zh: 'Lemonade', sector: '金融', themes: ['保险', 'AI'] },
  // ---- 消费 ----
  { code: 'AMZN', en: 'Amazon', zh: '亚马逊', sector: '消费', themes: ['电商', '云计算'] },
  { code: 'TSLA', en: 'Tesla', zh: '特斯拉', sector: '消费', themes: ['电动车', 'AI'] },
  { code: 'WMT', en: 'Walmart', zh: '沃尔玛', sector: '消费', themes: ['零售'] },
  { code: 'COST', en: 'Costco', zh: '好市多', sector: '消费', themes: ['零售'] },
  { code: 'TGT', en: 'Target', zh: '塔吉特', sector: '消费', themes: ['零售'] },
  { code: 'HD', en: 'Home Depot', zh: '家得宝', sector: '消费', themes: ['零售'] },
  { code: 'LOW', en: "Lowe's", zh: '劳氏', sector: '消费', themes: ['零售'] },
  { code: 'MCD', en: "McDonald's", zh: '麦当劳', sector: '消费', themes: ['餐饮'] },
  { code: 'SBUX', en: 'Starbucks', zh: '星巴克', sector: '消费', themes: ['餐饮'] },
  { code: 'NKE', en: 'Nike', zh: '耐克', sector: '消费', themes: ['服装'] },
  { code: 'LULU', en: 'Lululemon', zh: 'Lululemon', sector: '消费', themes: ['服装'] },
  { code: 'KO', en: 'Coca-Cola', zh: '可口可乐', sector: '消费', themes: ['饮料'] },
  { code: 'PEP', en: 'PepsiCo', zh: '百事', sector: '消费', themes: ['饮料'] },
  { code: 'PG', en: 'Procter & Gamble', zh: '宝洁', sector: '消费', themes: ['日化'] },
  { code: 'CL', en: 'Colgate', zh: '高露洁', sector: '消费', themes: ['日化'] },
  { code: 'UL', en: 'Unilever', zh: '联合利华', sector: '消费', themes: ['日化'] },
  { code: 'EL', en: 'Estee Lauder', zh: '雅诗兰黛', sector: '消费', themes: ['美妆'] },
  { code: 'MDLZ', en: 'Mondelez', zh: '亿滋', sector: '消费', themes: ['食品'] },
  { code: 'KHC', en: 'Kraft Heinz', zh: '卡夫亨氏', sector: '消费', themes: ['食品'] },
  { code: 'GIS', en: 'General Mills', zh: '通用磨坊', sector: '消费', themes: ['食品'] },
  { code: 'PM', en: 'Philip Morris', zh: '菲利普莫里斯', sector: '消费', themes: ['烟草'] },
  { code: 'ABNB', en: 'Airbnb', zh: 'Airbnb', sector: '消费', themes: ['旅游'] },
  { code: 'BKNG', en: 'Booking', zh: 'Booking', sector: '消费', themes: ['旅游'] },
  { code: 'RIVN', en: 'Rivian', zh: 'Rivian', sector: '消费', themes: ['电动车'] },
  { code: 'LCID', en: 'Lucid', zh: 'Lucid', sector: '消费', themes: ['电动车'] },
  { code: 'NIO', en: 'NIO', zh: '蔚来', sector: '消费', themes: ['电动车'] },
  { code: 'LI', en: 'Li Auto', zh: '理想', sector: '消费', themes: ['电动车'] },
  { code: 'XPEV', en: 'XPeng', zh: '小鹏', sector: '消费', themes: ['电动车'] },
  { code: 'PDD', en: 'Pinduoduo', zh: '拼多多', sector: '消费', themes: ['电商'] },
  { code: 'JD', en: 'JD.com', zh: '京东', sector: '消费', themes: ['电商'] },
  { code: 'YUMC', en: 'Yum China', zh: '百胜中国', sector: '消费', themes: ['餐饮'] },
  { code: 'TAL', en: 'TAL Education', zh: '好未来', sector: '消费', themes: ['教育'] },
  { code: 'EDU', en: 'New Oriental', zh: '新东方', sector: '消费', themes: ['教育'] },
  { code: 'VIPS', en: 'Vipshop', zh: '唯品会', sector: '消费', themes: ['电商'] },
  // ---- 医疗 ----
  { code: 'JNJ', en: 'Johnson & Johnson', zh: '强生', sector: '医疗', themes: ['医药'] },
  { code: 'LLY', en: 'Eli Lilly', zh: '礼来', sector: '医疗', themes: ['创新药'] },
  { code: 'UNH', en: 'UnitedHealth', zh: '联合健康', sector: '医疗', themes: ['保险'] },
  { code: 'PFE', en: 'Pfizer', zh: '辉瑞', sector: '医疗', themes: ['医药'] },
  { code: 'MRK', en: 'Merck', zh: '默克', sector: '医疗', themes: ['医药'] },
  { code: 'ABBV', en: 'AbbVie', zh: '艾伯维', sector: '医疗', themes: ['创新药'] },
  { code: 'TMO', en: 'Thermo Fisher', zh: '赛默飞', sector: '医疗', themes: ['医疗器械'] },
  { code: 'DHR', en: 'Danaher', zh: '丹纳赫', sector: '医疗', themes: ['医疗器械'] },
  { code: 'ABT', en: 'Abbott', zh: '雅培', sector: '医疗', themes: ['医疗器械'] },
  { code: 'MDT', en: 'Medtronic', zh: '美敦力', sector: '医疗', themes: ['医疗器械'] },
  { code: 'ISRG', en: 'Intuitive Surgical', zh: '直觉外科', sector: '医疗', themes: ['医疗器械'] },
  { code: 'SYK', en: 'Stryker', zh: '史赛克', sector: '医疗', themes: ['医疗器械'] },
  { code: 'GILD', en: 'Gilead', zh: '吉利德', sector: '医疗', themes: ['创新药'] },
  { code: 'AMGN', en: 'Amgen', zh: '安进', sector: '医疗', themes: ['创新药'] },
  { code: 'REGN', en: 'Regeneron', zh: '再生元', sector: '医疗', themes: ['创新药'] },
  { code: 'VRTX', en: 'Vertex', zh: 'Vertex', sector: '医疗', themes: ['创新药'] },
  { code: 'MRNA', en: 'Moderna', zh: 'Moderna', sector: '医疗', themes: ['创新药'] },
  { code: 'BIIB', en: 'Biogen', zh: '渤健', sector: '医疗', themes: ['创新药'] },
  { code: 'CVS', en: 'CVS Health', zh: 'CVS', sector: '医疗', themes: ['医药零售'] },
  { code: 'CI', en: 'Cigna', zh: '信诺', sector: '医疗', themes: ['保险'] },
  { code: 'HCA', en: 'HCA Healthcare', zh: 'HCA', sector: '医疗', themes: ['医院'] },
  // ---- 能源 ----
  { code: 'XOM', en: 'Exxon Mobil', zh: '埃克森美孚', sector: '能源', themes: ['石油'] },
  { code: 'CVX', en: 'Chevron', zh: '雪佛龙', sector: '能源', themes: ['石油'] },
  { code: 'COP', en: 'ConocoPhillips', zh: '康菲', sector: '能源', themes: ['石油'] },
  { code: 'EOG', en: 'EOG Resources', zh: 'EOG', sector: '能源', themes: ['石油'] },
  { code: 'SLB', en: 'Schlumberger', zh: '斯伦贝谢', sector: '能源', themes: ['油服'] },
  { code: 'OXY', en: 'Occidental', zh: '西方石油', sector: '能源', themes: ['石油'] },
  { code: 'MPC', en: 'Marathon Petroleum', zh: '马拉松石油', sector: '能源', themes: ['炼化'] },
  { code: 'PSX', en: 'Phillips 66', zh: '菲利普斯66', sector: '能源', themes: ['炼化'] },
  { code: 'ENPH', en: 'Enphase', zh: 'Enphase', sector: '能源', themes: ['新能源'] },
  { code: 'FSLR', en: 'First Solar', zh: 'First Solar', sector: '能源', themes: ['新能源'] },
  // ---- 工业 ----
  { code: 'BA', en: 'Boeing', zh: '波音', sector: '工业', themes: ['军工', '航空'] },
  { code: 'CAT', en: 'Caterpillar', zh: '卡特彼勒', sector: '工业', themes: ['机械'] },
  { code: 'DE', en: 'Deere', zh: '迪尔', sector: '工业', themes: ['机械'] },
  { code: 'GE', en: 'GE Aerospace', zh: 'GE航空', sector: '工业', themes: ['航空'] },
  { code: 'RKLB', en: 'Rocket Lab USA', zh: '火箭实验室', sector: '工业', themes: ['商业航天'] },
  { code: 'HON', en: 'Honeywell', zh: '霍尼韦尔', sector: '工业', themes: [] },
  { code: 'UPS', en: 'UPS', zh: 'UPS', sector: '工业', themes: ['物流'] },
  { code: 'FDX', en: 'FedEx', zh: '联邦快递', sector: '工业', themes: ['物流'] },
  { code: 'LMT', en: 'Lockheed Martin', zh: '洛克希德马丁', sector: '工业', themes: ['军工'] },
  { code: 'RTX', en: 'RTX', zh: '雷神', sector: '工业', themes: ['军工'] },
  { code: 'NOC', en: 'Northrop Grumman', zh: '诺格', sector: '工业', themes: ['军工'] },
  { code: 'GD', en: 'General Dynamics', zh: '通用动力', sector: '工业', themes: ['军工'] },
  { code: 'UNP', en: 'Union Pacific', zh: '联合太平洋', sector: '工业', themes: ['铁路'] },
  { code: 'DAL', en: 'Delta Air Lines', zh: '达美航空', sector: '工业', themes: ['航空'] },
  { code: 'UAL', en: 'United Airlines', zh: '美联航', sector: '工业', themes: ['航空'] },
  { code: 'QS', en: 'QuantumScape', zh: 'QuantumScape', sector: '工业', themes: ['新能源', '电池'] },
  // ---- 公用事业 / 房地产 / 原材料 ----
  { code: 'NEE', en: 'NextEra Energy', zh: '新纪元能源', sector: '公用事业', themes: ['新能源'] },
  { code: 'DUK', en: 'Duke Energy', zh: '杜克能源', sector: '公用事业', themes: [] },
  { code: 'SO', en: 'Southern Company', zh: '南方公司', sector: '公用事业', themes: [] },
  { code: 'AMT', en: 'American Tower', zh: '美国电塔', sector: '房地产', themes: [] },
  { code: 'PLD', en: 'Prologis', zh: '普洛斯', sector: '房地产', themes: ['物流'] },
  { code: 'EQIX', en: 'Equinix', zh: 'Equinix', sector: '房地产', themes: ['数据中心'] },
  { code: 'DLR', en: 'Digital Realty', zh: 'Digital Realty', sector: '房地产', themes: ['数据中心'] },
  { code: 'LIN', en: 'Linde', zh: '林德', sector: '原材料', themes: [] },
  { code: 'SHW', en: 'Sherwin-Williams', zh: '宣伟', sector: '原材料', themes: [] },
  { code: 'APD', en: 'Air Products', zh: '空气化工', sector: '原材料', themes: [] },
  { code: 'FCX', en: 'Freeport-McMoRan', zh: '自由港', sector: '原材料', themes: ['铜'] },
  { code: 'NEM', en: 'Newmont', zh: '纽蒙特', sector: '原材料', themes: ['黄金'] },
  { code: 'GOLD', en: 'Barrick', zh: 'Barrick', sector: '原材料', themes: ['黄金'] },
  // ---- 小众题材 ----
  { code: 'RCAT', en: 'Red Cat Holdings', zh: '红猫', sector: '工业', themes: ['无人机'] },
  { code: 'AVAV', en: 'AeroVironment', zh: '航境', sector: '工业', themes: ['无人机'] },
  { code: 'KTOS', en: 'Kratos Defense', zh: '克拉托斯', sector: '工业', themes: ['无人机'] },
  { code: 'ASTS', en: 'AST SpaceMobile', zh: '星空移动', sector: '通信', themes: ['太空'] },
  { code: 'LUNR', en: 'Intuitive Machines', zh: '直觉机器', sector: '工业', themes: ['太空'] },
  { code: 'IONQ', en: 'IonQ', zh: 'IonQ', sector: '科技', themes: ['量子'] },
  { code: 'RGTI', en: 'Rigetti Computing', zh: 'Rigetti', sector: '科技', themes: ['量子'] },
  { code: 'QBTS', en: 'D-Wave Quantum', zh: 'D-Wave', sector: '科技', themes: ['量子'] },
  { code: 'GME', en: 'GameStop', zh: '游戏驿站', sector: '消费', themes: ['Meme'] },
  { code: 'AMC', en: 'AMC Entertainment', zh: 'AMC院线', sector: '消费', themes: ['Meme'] },
  { code: 'DJT', en: 'Trump Media', zh: '特朗普媒体', sector: '通信', themes: ['Meme'] },
  { code: 'OKLO', en: 'Oklo', zh: 'Oklo', sector: '能源', themes: ['核能'] },
  { code: 'SMR', en: 'NuScale Power', zh: 'NuScale', sector: '能源', themes: ['核能'] },
  { code: 'JOBY', en: 'Joby Aviation', zh: 'Joby', sector: '工业', themes: ['eVTOL'] },
  { code: 'ACHR', en: 'Archer Aviation', zh: 'Archer', sector: '工业', themes: ['eVTOL'] },
  { code: 'MP', en: 'MP Materials', zh: 'MP材料', sector: '原材料', themes: ['稀土'] },
  { code: 'LAC', en: 'Lithium Americas', zh: '美洲锂业', sector: '原材料', themes: ['锂'] },
];

/** 代码 -> 股票信息 */
const BY_CODE = new Map(STOCK_LIST.map((s) => [s.code, s]));

/** 常见输错 -> 正确代码（TESLA/APPLE/INTEL 这种） */
export const CODE_CORRECTIONS: Record<string, string> = {
  'TESLA': 'TSLA',
  'APPLE': 'AAPL',
  'INTEL': 'INTC',
  'GOOGLE': 'GOOGL',
  'AMAZON': 'AMZN',
  'FACEBOOK': 'META',
  'NETFLIX': 'NFLX',
  'MICROSOFT': 'MSFT',
  'NVIDIA': 'NVDA',
  'COINBASE': 'COIN',
  'WALMART': 'WMT',
  'DISNEY': 'DIS',
  'TESLA MOTORS': 'TSLA',
  'APPL': 'AAPL',
  'TESL': 'TSLA',
  'AMZON': 'AMZN',
  // 000660.KS（韩股韩元计价）已切换为 SKHY（纳斯达克 ADR，美元计价）：老自选自动迁移
  '000660.KS': 'SKHY',
};

export function findStock(code: string): StockInfo | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

import { STOCK_PINYIN } from './stockPinyin';

/**
 * 联想建议：代码前缀优先，其次英文名/中文名/拼音包含。
 * 用于「是不是想找 XXX？」提示，最多返回 3 个。
 */
export function suggestStocks(input: string, limit = 3): StockInfo[] {
  const q = input.trim().toUpperCase();
  if (!q) return [];
  const qLower = input.trim().toLowerCase().replace(/\s+/g, '');
  const codeHit: StockInfo[] = [];
  const nameHit: StockInfo[] = [];
  for (const s of STOCK_LIST) {
    if (s.code.startsWith(q)) codeHit.push(s);
    else if (
      s.en.toLowerCase().includes(qLower) ||
      s.zh.includes(input.trim()) ||
      STOCK_PINYIN[s.code]?.full.includes(qLower) ||
      STOCK_PINYIN[s.code]?.initials.startsWith(qLower)
    )
      nameHit.push(s);
    if (codeHit.length + nameHit.length >= limit * 2) break;
  }
  return [...codeHit, ...nameHit].slice(0, limit);
}

/** 全部主题（去重，供筛选器用） */
export function allThemes(): string[] {
  const set = new Set<string>();
  for (const s of STOCK_LIST) for (const t of s.themes) set.add(t);
  return [...set].sort();
}

/** 按板块/主题筛选，供「发现股票」用 */
export function filterStocks(sector?: string, theme?: string): StockInfo[] {
  return STOCK_LIST.filter(
    (s) =>
      (!sector || s.sector === sector) &&
      (!theme || s.themes.includes(theme)),
  );
}
