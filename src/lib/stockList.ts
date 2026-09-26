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
  /** 一句话业务（第三期基础数据）：大白话讲这家公司是干什么的 */
  blurb?: string;
}

export const SECTORS = [
  '科技', '半导体', '金融', '消费', '医疗',
  '能源', '工业', '通信', '公用事业', '房地产', '原材料',
] as const;

export const STOCK_LIST: StockInfo[] = [
  // ---- 科技巨头 ----
  { code: 'AAPL', en: 'Apple', zh: '苹果', sector: '科技', themes: ['消费电子', 'AI'], blurb: '做iPhone、Mac和App Store的消费电子巨头，服务收入越赚越多' },
  { code: 'MSFT', en: 'Microsoft', zh: '微软', sector: '科技', themes: ['云计算', 'AI'], blurb: 'Windows和Office老本行，现在靠Azure云和AI赚钱' },
  { code: 'ORCL', en: 'Oracle', zh: '甲骨文', sector: '科技', themes: ['云计算', 'AI'], blurb: '老牌数据库公司，转型卖云服务和AI算力' },
  { code: 'CRM', en: 'Salesforce', zh: '赛富时', sector: '科技', themes: ['云计算', 'AI'], blurb: '卖客户管理软件的SaaS龙头' },
  { code: 'ADBE', en: 'Adobe', zh: 'Adobe', sector: '科技', themes: ['AI'], blurb: 'Photoshop和PDF那家，创意软件订阅收费' },
  { code: 'PLTR', en: 'Palantir', zh: 'Palantir', sector: '科技', themes: ['AI'], blurb: '给政府和大企业做数据分析平台，AI概念股' },
  { code: 'IBM', en: 'IBM', zh: 'IBM', sector: '科技', themes: ['云计算', 'AI'], blurb: '老牌IT服务公司，现在押注混合云和AI咨询' },
  { code: 'CSCO', en: 'Cisco', zh: '思科', sector: '科技', themes: ['云计算'], blurb: '卖网络设备（路由器交换机）的老牌厂商' },
  { code: 'DELL', en: 'Dell', zh: '戴尔', sector: '科技', themes: ['AI'], blurb: '卖服务器和PC，AI服务器是新增长点' },
  { code: 'HPQ', en: 'HP', zh: '惠普', sector: '科技', themes: [], blurb: '卖打印机和PC，靠耗材和订阅续命' },
  { code: 'SMCI', en: 'Supermicro', zh: '超微电脑', sector: '科技', themes: ['AI'], blurb: '组装AI服务器的，英伟达概念股，波动大' },
  { code: 'ANET', en: 'Arista', zh: 'Arista', sector: '科技', themes: ['云计算', 'AI'], blurb: '给数据中心做高速网络设备，AI算力受益' },
  { code: 'PANW', en: 'Palo Alto Networks', zh: '派拓网络', sector: '科技', themes: ['网络安全'], blurb: '网络安全龙头，卖防火墙和云安全' },
  { code: 'CRWD', en: 'CrowdStrike', zh: 'CrowdStrike', sector: '科技', themes: ['网络安全'], blurb: '云端终端安全，靠订阅增长' },
  { code: 'FTNT', en: 'Fortinet', zh: '飞塔', sector: '科技', themes: ['网络安全'], blurb: '卖防火墙硬件起家，网络安全老牌' },
  { code: 'NOW', en: 'ServiceNow', zh: 'ServiceNow', sector: '科技', themes: ['云计算', 'AI'], blurb: '企业IT工单和流程自动化的SaaS' },
  { code: 'SNOW', en: 'Snowflake', zh: 'Snowflake', sector: '科技', themes: ['云计算', 'AI'], blurb: '云上数据仓库，按用量收费' },
  { code: 'DDOG', en: 'Datadog', zh: 'Datadog', sector: '科技', themes: ['云计算'], blurb: '云监控告警，程序员用的看板' },
  { code: 'NET', en: 'Cloudflare', zh: 'Cloudflare', sector: '科技', themes: ['云计算', '网络安全'], blurb: 'CDN和网络安全，网站加速那家' },
  { code: 'TEAM', en: 'Atlassian', zh: 'Atlassian', sector: '科技', themes: [], blurb: 'Jira和Confluence，程序员协作工具' },
  { code: 'WDAY', en: 'Workday', zh: 'Workday', sector: '科技', themes: ['云计算'], blurb: '人力资源和财务SaaS' },
  { code: 'INTU', en: 'Intuit', zh: '直觉', sector: '科技', themes: ['金融科技'], blurb: 'TurboTax报税和QuickBooks记账' },
  { code: 'SHOP', en: 'Shopify', zh: 'Shopify', sector: '科技', themes: ['电商'], blurb: '帮小商家开网店的SaaS平台' },
  { code: 'UBER', en: 'Uber', zh: 'Uber', sector: '科技', themes: ['共享出行'], blurb: '网约车和外卖，全球最大出行平台' },
  { code: 'LYFT', en: 'Lyft', zh: 'Lyft', sector: '科技', themes: ['共享出行'], blurb: '网约车老二，Uber 之外的那个，主攻北美' },
  { code: 'DASH', en: 'DoorDash', zh: 'DoorDash', sector: '科技', themes: [], blurb: '美国外卖一哥，疫情时起飞的外卖平台' },
  { code: 'ZM', en: 'Zoom', zh: 'Zoom', sector: '科技', themes: ['云计算'], blurb: '视频会议，疫情红利后增长放缓' },
  { code: 'DOCU', en: 'DocuSign', zh: 'DocuSign', sector: '科技', themes: [], blurb: '电子签名，合同线上签' },
  { code: 'OKTA', en: 'Okta', zh: 'Okta', sector: '科技', themes: ['网络安全'], blurb: '企业统一登录和身份认证' },
  { code: 'ZS', en: 'Zscaler', zh: 'Zscaler', sector: '科技', themes: ['网络安全'], blurb: '零信任网络安全，云原生' },
  { code: 'S', en: 'SentinelOne', zh: 'SentinelOne', sector: '科技', themes: ['网络安全'], blurb: '终端安全（杀毒），CRWD的对手' },
  { code: 'ESTC', en: 'Elastic', zh: 'Elastic', sector: '科技', themes: ['云计算'], blurb: '开源搜索引擎Elasticsearch的商业公司' },
  { code: 'MDB', en: 'MongoDB', zh: 'MongoDB', sector: '科技', themes: ['云计算'], blurb: '开源文档数据库MongoDB的商业公司' },
  { code: 'CFLT', en: 'Confluent', zh: 'Confluent', sector: '科技', themes: ['云计算'], blurb: '实时数据流平台（Kafka生态）' },
  { code: 'PATH', en: 'UiPath', zh: 'UiPath', sector: '科技', themes: ['AI'], blurb: 'RPA机器人流程自动化，AI加持' },
  { code: 'IOT', en: 'Samsara', zh: 'Samsara', sector: '科技', themes: [], blurb: '车队和设备物联网管理' },
  { code: 'STX', en: 'Seagate', zh: '希捷', sector: '科技', themes: [], blurb: '机械硬盘两大巨头之一，数据中心的老供应商' },
  { code: 'WDC', en: 'Western Digital', zh: '西数', sector: '科技', themes: [], blurb: '硬盘和闪存（NAND）' },
  { code: 'NTAP', en: 'NetApp', zh: 'NetApp', sector: '科技', themes: ['云计算'], blurb: '企业级数据存储，混合云存储方案商' },
  { code: 'ANSS', en: 'Ansys', zh: 'Ansys', sector: '科技', themes: [], blurb: '工程仿真软件，造飞机汽车前先在它这儿模拟一遍' },
  { code: 'ADSK', en: 'Autodesk', zh: 'Autodesk', sector: '科技', themes: [], blurb: 'AutoCAD制图软件' },
  { code: 'KEYS', en: 'Keysight', zh: '是德', sector: '科技', themes: [], blurb: '电子测试仪器，芯片和通信设备出厂前都得过它这关' },
  { code: 'APP', en: 'AppLovin', zh: 'AppLovin', sector: '科技', themes: ['广告', 'AI'], blurb: '手游广告变现平台，AI投放' },
  { code: 'TTD', en: 'Trade Desk', zh: 'Trade Desk', sector: '科技', themes: ['广告'], blurb: '程序化广告买量平台，广告界的"自动下单机"' },
  { code: 'MGNI', en: 'Magnite', zh: 'Magnite', sector: '科技', themes: ['广告'], blurb: '广告供给端平台，帮媒体把广告位卖出价' },
  { code: 'TOST', en: 'Toast', zh: 'Toast', sector: '科技', themes: ['金融科技'], blurb: '餐厅点餐收银SaaS' },
  { code: 'BILL', en: 'Bill.com', zh: 'Bill', sector: '科技', themes: ['金融科技'], blurb: '中小企业账款自动化，发票报销线上化' },
  { code: 'GLOB', en: 'Globant', zh: 'Globant', sector: '科技', themes: [], blurb: '拉美 IT 外包咨询，帮大公司做数字化' },
  { code: 'EPAM', en: 'EPAM', zh: 'EPAM', sector: '科技', themes: [], blurb: '软件外包大厂，程序员人力银行' },
  { code: 'SOUN', en: 'SoundHound', zh: 'SoundHound', sector: '科技', themes: ['AI'], blurb: '语音AI（车载语音助手）' },
  { code: 'BBAI', en: 'BigBear.ai', zh: 'BigBear', sector: '科技', themes: ['AI'], blurb: '国防AI小盘股，波动极大' },
  { code: 'AI', en: 'C3.ai', zh: 'C3 AI', sector: '科技', themes: ['AI'], blurb: '企业AI应用平台，名字就叫AI' },
  { code: 'MSTR', en: 'Strategy', zh: '微策略', sector: '科技', themes: ['加密'], blurb: '囤比特币最多的上市公司，币价影子股' },
  { code: 'MARA', en: 'MARA Holdings', zh: 'MARA', sector: '科技', themes: ['加密'], blurb: '北美比特币矿企龙头，币价影子股，波动极大' },
  { code: 'RIOT', en: 'Riot Platforms', zh: 'Riot', sector: '科技', themes: ['加密'], blurb: '比特币矿企，德州大矿场' },
  { code: 'CLSK', en: 'CleanSpark', zh: 'CleanSpark', sector: '科技', themes: ['加密'], blurb: '比特币矿企，主打清洁能源' },
  { code: 'IREN', en: 'Iris Energy', zh: 'IREN', sector: '科技', themes: ['加密', 'AI'], blurb: '比特币挖矿加AI数据中心两条腿' },
  { code: 'HUT', en: 'Hut 8', zh: 'Hut8', sector: '科技', themes: ['加密'], blurb: '比特币矿企，加拿大起家' },
  { code: 'BZ', en: 'BOSS Zhipin', zh: 'BOSS直聘', sector: '科技', themes: [], blurb: 'BOSS直聘，线上招聘平台' },
  // ---- 半导体 ----
  { code: 'NVDA', en: 'NVIDIA', zh: '英伟达', sector: '半导体', themes: ['AI', '芯片'], blurb: 'AI芯片绝对龙头，GPU卖爆' },
  { code: 'AVGO', en: 'Broadcom', zh: '博通', sector: '半导体', themes: ['AI', '芯片'], blurb: '博通，网络芯片加VMware软件' },
  { code: 'AMD', en: 'AMD', zh: '超微', sector: '半导体', themes: ['AI', '芯片'], blurb: 'CPU和GPU老二，AI芯片追赶英伟达' },
  { code: 'INTC', en: 'Intel', zh: '英特尔', sector: '半导体', themes: ['芯片'], blurb: '老牌芯片巨头，转型代工进行中' },
  { code: 'QCOM', en: 'Qualcomm', zh: '高通', sector: '半导体', themes: ['芯片'], blurb: '手机芯片（骁龙）和专利授权' },
  { code: 'TSM', en: 'TSMC', zh: '台积电', sector: '半导体', themes: ['AI', '芯片'], blurb: '全球最大芯片代工厂，苹果英伟达都找它' },
  { code: 'MU', en: 'Micron', zh: '美光', sector: '半导体', themes: ['AI', '芯片'], blurb: '内存（DRAM和NAND）巨头，HBM受益' },
  { code: 'SKHY', en: 'SK Hynix', zh: 'SK海力士', sector: '半导体', themes: ['芯片'], blurb: '韩国存储芯片巨头，HBM龙头' },
  { code: 'SNDK', en: 'Sandisk Corporation', zh: '闪迪', sector: '半导体', themes: ['AI', '芯片'], blurb: '闪存（NAND）大厂，AI存储需求受益' },
  { code: 'ARM', en: 'Arm', zh: 'Arm', sector: '半导体', themes: ['AI', '芯片'], blurb: '芯片架构授权，手机芯片都用它' },
  { code: 'MRVL', en: 'Marvell', zh: '美满', sector: '半导体', themes: ['AI', '芯片'], blurb: '数据中心网络芯片，光模块 DSP 那家' },
  { code: 'LRCX', en: 'Lam Research', zh: '泛林', sector: '半导体', themes: ['芯片'], blurb: '半导体刻蚀机巨头，造芯片的关键设备商' },
  { code: 'AMAT', en: 'Applied Materials', zh: '应用材料', sector: '半导体', themes: ['芯片'], blurb: '半导体设备龙头（应用材料）' },
  { code: 'KLAC', en: 'KLA', zh: 'KLA', sector: '半导体', themes: ['芯片'], blurb: '芯片检测量测设备，晶圆厂的"质检员"' },
  { code: 'ASML', en: 'ASML', zh: '阿斯麦', sector: '半导体', themes: ['芯片'], blurb: '光刻机全球唯一，卡脖子那家' },
  { code: 'SNPS', en: 'Synopsys', zh: '新思', sector: '半导体', themes: ['芯片'], blurb: '芯片设计 EDA 软件，画芯片图纸的工具商' },
  { code: 'CDNS', en: 'Cadence', zh: '铿腾', sector: '半导体', themes: ['芯片'], blurb: '芯片设计EDA软件（铿腾）' },
  { code: 'GFS', en: 'GlobalFoundries', zh: '格芯', sector: '半导体', themes: ['芯片'], blurb: '美国本土芯片代工厂，格罗方德，成熟制程' },
  { code: 'ON', en: 'ON Semiconductor', zh: '安森美', sector: '半导体', themes: ['芯片'], blurb: '功率半导体（电动车和工业）' },
  { code: 'NXPI', en: 'NXP', zh: '恩智浦', sector: '半导体', themes: ['芯片'], blurb: '汽车和物联网芯片，车用半导体大户' },
  { code: 'TXN', en: 'Texas Instruments', zh: '德州仪器', sector: '半导体', themes: ['芯片'], blurb: '模拟芯片老牌，工业和汽车电子的隐形冠军' },
  { code: 'ADI', en: 'Analog Devices', zh: '亚德诺', sector: '半导体', themes: ['芯片'], blurb: '模拟芯片大厂，信号链芯片龙头' },
  { code: 'MPWR', en: 'Monolithic Power', zh: '芯源', sector: '半导体', themes: ['芯片'], blurb: '电源管理芯片，手机快充和服务器电源都用它' },
  { code: 'TER', en: 'Teradyne', zh: '泰瑞达', sector: '半导体', themes: ['芯片'], blurb: '芯片测试设备，芯片出厂前的"终考官"' },
  { code: 'ENTG', en: 'Entegris', zh: '英特格', sector: '半导体', themes: ['芯片'], blurb: '半导体材料（高纯化学品）' },
  // ---- 通信传媒 ----
  { code: 'GOOGL', en: 'Alphabet', zh: '谷歌', sector: '通信', themes: ['AI', '云计算'], blurb: '搜索加YouTube加安卓，广告印钞机，AI追赶中' },
  { code: 'META', en: 'Meta', zh: 'Meta', sector: '通信', themes: ['社交', 'AI'], blurb: 'Facebook、Instagram和WhatsApp，广告加AI' },
  { code: 'NFLX', en: 'Netflix', zh: '奈飞', sector: '通信', themes: ['流媒体'], blurb: '流媒体龙头，靠涨价和广告层赚钱' },
  { code: 'DIS', en: 'Disney', zh: '迪士尼', sector: '通信', themes: ['流媒体'], blurb: '迪士尼乐园加流媒体加IP' },
  { code: 'WBD', en: 'Warner Bros Discovery', zh: '华纳兄弟', sector: '通信', themes: ['流媒体'], blurb: '华纳兄弟加Discovery，流媒体整合中' },
  { code: 'PARA', en: 'Paramount', zh: '派拉蒙', sector: '通信', themes: ['流媒体'], blurb: '派拉蒙影业 + CBS 电视网，好莱坞老牌' },
  { code: 'EA', en: 'Electronic Arts', zh: 'EA', sector: '通信', themes: ['游戏'], blurb: 'FIFA和战地，体育游戏大厂' },
  { code: 'TTWO', en: 'Take-Two', zh: 'Take-Two', sector: '通信', themes: ['游戏'], blurb: 'GTA 母公司，游戏大厂，靠大作吃饭' },
  { code: 'RBLX', en: 'Roblox', zh: 'Roblox', sector: '通信', themes: ['游戏'], blurb: '小孩玩的3D沙盒游戏平台' },
  { code: 'SPOT', en: 'Spotify', zh: 'Spotify', sector: '通信', themes: ['流媒体'], blurb: '流媒体音乐一哥，全球最多人用的听歌 App' },
  { code: 'ROKU', en: 'Roku', zh: 'Roku', sector: '通信', themes: ['流媒体'], blurb: '电视棒和系统，靠广告赚钱' },
  { code: 'PINS', en: 'Pinterest', zh: 'Pinterest', sector: '通信', themes: ['社交'], blurb: '图片社交 Pinterest，靠广告变现，女性用户多' },
  { code: 'SNAP', en: 'Snap', zh: 'Snap', sector: '通信', themes: ['社交'], blurb: '阅后即焚，年轻用户多' },
  { code: 'T', en: 'AT&T', zh: 'AT&T', sector: '通信', themes: ['电信'], blurb: '美国电信老三（AT&T）' },
  { code: 'VZ', en: 'Verizon', zh: 'Verizon', sector: '通信', themes: ['电信'], blurb: '美国电信老大（Verizon）' },
  { code: 'TMUS', en: 'T-Mobile', zh: 'T-Mobile', sector: '通信', themes: ['电信'], blurb: '美国电信老二，增长最快' },
  { code: 'NTES', en: 'NetEase', zh: '网易', sector: '通信', themes: ['游戏'], blurb: '网易：游戏是现金牛，顺带做有道和云音乐' },
  { code: 'IQ', en: 'iQIYI', zh: '爱奇艺', sector: '通信', themes: ['流媒体'], blurb: '爱奇艺：长视频平台，百度系，靠会员和广告' },
  { code: 'BILI', en: 'Bilibili', zh: '哔哩哔哩', sector: '通信', themes: ['流媒体'], blurb: 'B站：年轻人社区，游戏和大会员是收入大头' },
  { code: 'TME', en: 'Tencent Music', zh: '腾讯音乐', sector: '通信', themes: ['流媒体'], blurb: 'QQ音乐加酷狗，腾讯音乐' },
  // ---- 金融 ----
  { code: 'JPM', en: 'JPMorgan', zh: '摩根大通', sector: '金融', themes: [], blurb: '美国最大银行（摩根大通）' },
  { code: 'BAC', en: 'Bank of America', zh: '美国银行', sector: '金融', themes: [], blurb: '美国第二大银行，巴菲特重仓过的老牌大行' },
  { code: 'WFC', en: 'Wells Fargo', zh: '富国银行', sector: '金融', themes: [], blurb: '富国银行：房贷和零售银行见长，老牌大行' },
  { code: 'C', en: 'Citigroup', zh: '花旗', sector: '金融', themes: [], blurb: '花旗：国际业务最多的美资大行' },
  { code: 'GS', en: 'Goldman Sachs', zh: '高盛', sector: '金融', themes: [], blurb: '高盛：投行之王，给大公司做并购上市' },
  { code: 'MS', en: 'Morgan Stanley', zh: '摩根士丹利', sector: '金融', themes: [], blurb: '大摩，投行加财富管理' },
  { code: 'AXP', en: 'American Express', zh: '美国运通', sector: '金融', themes: ['金融科技'], blurb: '美国运通，高端信用卡' },
  { code: 'V', en: 'Visa', zh: 'Visa', sector: '金融', themes: ['金融科技'], blurb: '全球最大卡组织，收过路费' },
  { code: 'MA', en: 'Mastercard', zh: '万事达', sector: '金融', themes: ['金融科技'], blurb: '万事达：银行卡组织老二，刷卡抽成的生意' },
  { code: 'BLK', en: 'BlackRock', zh: '贝莱德', sector: '金融', themes: [], blurb: '全球最大资管（贝莱德），ETF之王' },
  { code: 'SCHW', en: 'Charles Schwab', zh: '嘉信', sector: '金融', themes: [], blurb: '嘉信理财：美国散户券商一哥，管着万亿资产' },
  { code: 'COIN', en: 'Coinbase', zh: 'Coinbase', sector: '金融', themes: ['加密'], blurb: 'Coinbase：美国最大加密交易所，币圈"券商"' },
  { code: 'HOOD', en: 'Robinhood', zh: 'Robinhood', sector: '金融', themes: ['金融科技', '加密'], blurb: 'Robinhood：零佣金开山鼻祖，年轻人炒股第一站' },
  { code: 'AFRM', en: 'Affirm', zh: 'Affirm', sector: '金融', themes: ['金融科技'], blurb: '先买后付（BNPL）' },
  { code: 'SOFI', en: 'SoFi', zh: 'SoFi', sector: '金融', themes: ['金融科技'], blurb: '线上银行加贷款，年轻人多' },
  { code: 'SQ', en: 'Block', zh: 'Block', sector: '金融', themes: ['金融科技', '加密'], blurb: 'Block，Square收单加Cash App' },
  { code: 'PYPL', en: 'PayPal', zh: 'PayPal', sector: '金融', themes: ['金融科技'], blurb: 'PayPal，线上支付老牌' },
  { code: 'UPST', en: 'Upstart', zh: 'Upstart', sector: '金融', themes: ['AI', '金融科技'], blurb: 'Upstart：用 AI 给贷款做信用审核的金融科技' },
  { code: 'LMND', en: 'Lemonade', zh: 'Lemonade', sector: '金融', themes: ['保险', 'AI'], blurb: 'AI保险，租房险起家' },
  // ---- 消费 ----
  { code: 'AMZN', en: 'Amazon', zh: '亚马逊', sector: '消费', themes: ['电商', '云计算'], blurb: '电商加AWS云，两个印钞机' },
  { code: 'TSLA', en: 'Tesla', zh: '特斯拉', sector: '消费', themes: ['电动车', 'AI'], blurb: '电动车龙头，卖车加储能加机器人故事' },
  { code: 'WMT', en: 'Walmart', zh: '沃尔玛', sector: '消费', themes: ['零售'], blurb: '全球最大零售商（沃尔玛）' },
  { code: 'COST', en: 'Costco', zh: '好市多', sector: '消费', themes: ['零售'], blurb: '会员制仓储超市（好市多）' },
  { code: 'TGT', en: 'Target', zh: '塔吉特', sector: '消费', themes: ['零售'], blurb: '塔吉特：美国中产超市，红色 Logo 那个' },
  { code: 'HD', en: 'Home Depot', zh: '家得宝', sector: '消费', themes: ['零售'], blurb: '家得宝，家装建材零售' },
  { code: 'LOW', en: "Lowe's", zh: '劳氏', sector: '消费', themes: ['零售'], blurb: '美国家装建材零售巨头，家得宝的老对手' },
  { code: 'MCD', en: "McDonald's", zh: '麦当劳', sector: '消费', themes: ['餐饮'], blurb: '全球最大快餐连锁，金色拱门，靠加盟和地产收租赚钱' },
  { code: 'SBUX', en: 'Starbucks', zh: '星巴克', sector: '消费', themes: ['餐饮'], blurb: '星巴克：咖啡连锁，中国市场是第二增长曲线' },
  { code: 'NKE', en: 'Nike', zh: '耐克', sector: '消费', themes: ['服装'], blurb: '耐克：运动品牌一哥，鞋服加直营电商' },
  { code: 'LULU', en: 'Lululemon', zh: 'Lululemon', sector: '消费', themes: ['服装'], blurb: 'Lululemon：瑜伽服起家，中产衣柜收割机' },
  { code: 'KO', en: 'Coca-Cola', zh: '可口可乐', sector: '消费', themes: ['饮料'], blurb: '可口可乐：快乐水，股息贵族，巴菲特的心头好' },
  { code: 'PEP', en: 'PepsiCo', zh: '百事', sector: '消费', themes: ['饮料'], blurb: '百事可乐加零食（乐事）' },
  { code: 'PG', en: 'Procter & Gamble', zh: '宝洁', sector: '消费', themes: ['日化'], blurb: '宝洁：日化巨头，飘柔海飞丝汰渍都是它家的' },
  { code: 'CL', en: 'Colgate', zh: '高露洁', sector: '消费', themes: ['日化'], blurb: '高露洁：牙膏一哥，顺带做宠物食品（希尔斯）' },
  { code: 'UL', en: 'Unilever', zh: '联合利华', sector: '消费', themes: ['日化'], blurb: '联合利华：日化加食品，欧洲消费巨头' },
  { code: 'EL', en: 'Estee Lauder', zh: '雅诗兰黛', sector: '消费', themes: ['美妆'], blurb: '雅诗兰黛：高端美妆，中国市场波动大' },
  { code: 'MDLZ', en: 'Mondelez', zh: '亿滋', sector: '消费', themes: ['食品'], blurb: '亿滋：奥利奥和吉百利的母公司，零食巨头' },
  { code: 'KHC', en: 'Kraft Heinz', zh: '卡夫亨氏', sector: '消费', themes: ['食品'], blurb: '卡夫亨氏：番茄酱和奶酪，巴菲特参股的老牌食品' },
  { code: 'GIS', en: 'General Mills', zh: '通用磨坊', sector: '消费', themes: ['食品'], blurb: '通用磨坊（哈根达斯）' },
  { code: 'PM', en: 'Philip Morris', zh: '菲利普莫里斯', sector: '消费', themes: ['烟草'], blurb: '万宝路母公司，烟草加IQOS' },
  { code: 'ABNB', en: 'Airbnb', zh: 'Airbnb', sector: '消费', themes: ['旅游'], blurb: 'Airbnb：民宿短租平台，不拥有房子只做中介' },
  { code: 'BKNG', en: 'Booking', zh: 'Booking', sector: '消费', themes: ['旅游'], blurb: 'Booking，酒店预订龙头' },
  { code: 'RIVN', en: 'Rivian', zh: 'Rivian', sector: '消费', themes: ['电动车'], blurb: '电动皮卡（Rivian）' },
  { code: 'LCID', en: 'Lucid', zh: 'Lucid', sector: '消费', themes: ['电动车'], blurb: '豪华电动车（Lucid）' },
  { code: 'NIO', en: 'NIO', zh: '蔚来', sector: '消费', themes: ['电动车'], blurb: '蔚来：换电模式的新势力，高端电动车' },
  { code: 'LI', en: 'Li Auto', zh: '理想', sector: '消费', themes: ['电动车'], blurb: '理想：增程式 SUV，奶爸车代表，新势力里最会赚钱' },
  { code: 'XPEV', en: 'XPeng', zh: '小鹏', sector: '消费', themes: ['电动车'], blurb: '小鹏：智能驾驶最激进的新势力' },
  { code: 'PDD', en: 'Pinduoduo', zh: '拼多多', sector: '消费', themes: ['电商'], blurb: '拼多多：国内拼购加海外 Temu，电商黑马' },
  { code: 'JD', en: 'JD.com', zh: '京东', sector: '消费', themes: ['电商'], blurb: '京东：自营电商加物流，3C 起家' },
  { code: 'YUMC', en: 'Yum China', zh: '百胜中国', sector: '消费', themes: ['餐饮'], blurb: '肯德基必胜客中国运营商' },
  { code: 'TAL', en: 'TAL Education', zh: '好未来', sector: '消费', themes: ['教育'], blurb: '好未来，素质教育转型' },
  { code: 'EDU', en: 'New Oriental', zh: '新东方', sector: '消费', themes: ['教育'], blurb: '新东方，教培加直播带货' },
  { code: 'VIPS', en: 'Vipshop', zh: '唯品会', sector: '消费', themes: ['电商'], blurb: '唯品会：品牌特卖电商，尾货生意' },
  // ---- 医疗 ----
  { code: 'JNJ', en: 'Johnson & Johnson', zh: '强生', sector: '医疗', themes: ['医药'], blurb: '强生：医药加医疗器械，百年老店' },
  { code: 'LLY', en: 'Eli Lilly', zh: '礼来', sector: '医疗', themes: ['创新药'], blurb: '礼来，减肥药GLP-1龙头' },
  { code: 'UNH', en: 'UnitedHealth', zh: '联合健康', sector: '医疗', themes: ['保险'], blurb: '联合健康：美国最大商业医保，医疗界的巨无霸' },
  { code: 'PFE', en: 'Pfizer', zh: '辉瑞', sector: '医疗', themes: ['医药'], blurb: '辉瑞：新冠疫苗那家，制药巨头，专利悬崖是隐忧' },
  { code: 'MRK', en: 'Merck', zh: '默克', sector: '医疗', themes: ['医药'], blurb: '默克，K药（抗癌神药）' },
  { code: 'ABBV', en: 'AbbVie', zh: '艾伯维', sector: '医疗', themes: ['创新药'], blurb: '艾伯维，修美乐之后靠新药' },
  { code: 'TMO', en: 'Thermo Fisher', zh: '赛默飞', sector: '医疗', themes: ['医疗器械'], blurb: '赛默飞，实验室耗材仪器' },
  { code: 'DHR', en: 'Danaher', zh: '丹纳赫', sector: '医疗', themes: ['医疗器械'], blurb: '丹纳赫，生命科学工具' },
  { code: 'ABT', en: 'Abbott', zh: '雅培', sector: '医疗', themes: ['医疗器械'], blurb: '雅培，奶粉加血糖仪加支架' },
  { code: 'MDT', en: 'Medtronic', zh: '美敦力', sector: '医疗', themes: ['医疗器械'], blurb: '美敦力，医疗器械龙头' },
  { code: 'ISRG', en: 'Intuitive Surgical', zh: '直觉外科', sector: '医疗', themes: ['医疗器械'], blurb: '直觉外科：达芬奇手术机器人，微创手术的垄断者' },
  { code: 'SYK', en: 'Stryker', zh: '史赛克', sector: '医疗', themes: ['医疗器械'], blurb: '骨科器械（人工关节）' },
  { code: 'GILD', en: 'Gilead', zh: '吉利德', sector: '医疗', themes: ['创新药'], blurb: '吉利德，抗病毒（HIV和丙肝）' },
  { code: 'AMGN', en: 'Amgen', zh: '安进', sector: '医疗', themes: ['创新药'], blurb: '安进：生物药老牌，靠重磅炸弹药物续命' },
  { code: 'REGN', en: 'Regeneron', zh: '再生元', sector: '医疗', themes: ['创新药'], blurb: '再生元，眼科加免疫药' },
  { code: 'VRTX', en: 'Vertex', zh: 'Vertex', sector: '医疗', themes: ['创新药'], blurb: 'Vertex，囊性纤维化特效药' },
  { code: 'MRNA', en: 'Moderna', zh: 'Moderna', sector: '医疗', themes: ['创新药'], blurb: 'Moderna，mRNA疫苗' },
  { code: 'BIIB', en: 'Biogen', zh: '渤健', sector: '医疗', themes: ['创新药'], blurb: '渤健，阿尔茨海默药争议大' },
  { code: 'CVS', en: 'CVS Health', zh: 'CVS', sector: '医疗', themes: ['医药零售'], blurb: 'CVS：连锁药房加医保，医疗零售一体化' },
  { code: 'CI', en: 'Cigna', zh: '信诺', sector: '医疗', themes: ['保险'], blurb: '信诺：商业医保大户，企业团险见长' },
  { code: 'HCA', en: 'HCA Healthcare', zh: 'HCA', sector: '医疗', themes: ['医院'], blurb: 'HCA：美国最大连锁医院集团' },
  // ---- 能源 ----
  { code: 'XOM', en: 'Exxon Mobil', zh: '埃克森美孚', sector: '能源', themes: ['石油'], blurb: '埃克森美孚，石油巨头' },
  { code: 'CVX', en: 'Chevron', zh: '雪佛龙', sector: '能源', themes: ['石油'], blurb: '雪佛龙：石油巨头，埃克森之外的那个' },
  { code: 'COP', en: 'ConocoPhillips', zh: '康菲', sector: '能源', themes: ['石油'], blurb: '康菲石油：页岩油大户，纯上游油气' },
  { code: 'EOG', en: 'EOG Resources', zh: 'EOG', sector: '能源', themes: ['石油'], blurb: 'EOG：页岩油气，成本控制最好的页岩油商' },
  { code: 'SLB', en: 'Schlumberger', zh: '斯伦贝谢', sector: '能源', themes: ['油服'], blurb: '油服龙头（斯伦贝谢）' },
  { code: 'OXY', en: 'Occidental', zh: '西方石油', sector: '能源', themes: ['石油'], blurb: '西方石油，巴菲特重仓' },
  { code: 'MPC', en: 'Marathon Petroleum', zh: '马拉松石油', sector: '能源', themes: ['炼化'], blurb: '炼油厂（马拉松石油）' },
  { code: 'PSX', en: 'Phillips 66', zh: '菲利普斯66', sector: '能源', themes: ['炼化'], blurb: '菲利普斯66：炼油加加油站，下游炼化' },
  { code: 'ENPH', en: 'Enphase', zh: 'Enphase', sector: '能源', themes: ['新能源'], blurb: 'Enphase：户用光伏微型逆变器龙头' },
  { code: 'FSLR', en: 'First Solar', zh: 'First Solar', sector: '能源', themes: ['新能源'], blurb: 'First Solar：碲化镉薄膜光伏，美国光伏制造代表' },
  // ---- 工业 ----
  { code: 'BA', en: 'Boeing', zh: '波音', sector: '工业', themes: ['军工', '航空'], blurb: '波音，737和787' },
  { code: 'CAT', en: 'Caterpillar', zh: '卡特彼勒', sector: '工业', themes: ['机械'], blurb: '卡特彼勒，工程机械黄巨人' },
  { code: 'DE', en: 'Deere', zh: '迪尔', sector: '工业', themes: ['机械'], blurb: '约翰迪尔：农机一哥，绿色拖拉机那个' },
  { code: 'GE', en: 'GE Aerospace', zh: 'GE航空', sector: '工业', themes: ['航空'], blurb: 'GE航空，飞机发动机' },
  { code: 'RKLB', en: 'Rocket Lab USA', zh: '火箭实验室', sector: '工业', themes: ['商业航天'], blurb: '火箭实验室，小火箭发射加卫星' },
  { code: 'HON', en: 'Honeywell', zh: '霍尼韦尔', sector: '工业', themes: [], blurb: '霍尼韦尔，工业加航空电子' },
  { code: 'UPS', en: 'UPS', zh: 'UPS', sector: '工业', themes: ['物流'], blurb: 'UPS：快递巨头，棕色货车那个' },
  { code: 'FDX', en: 'FedEx', zh: '联邦快递', sector: '工业', themes: ['物流'], blurb: '联邦快递：隔夜快递的开创者，电商物流' },
  { code: 'LMT', en: 'Lockheed Martin', zh: '洛克希德马丁', sector: '工业', themes: ['军工'], blurb: '洛克希德马丁，F35' },
  { code: 'RTX', en: 'RTX', zh: '雷神', sector: '工业', themes: ['军工'], blurb: '雷神，导弹加普惠发动机' },
  { code: 'NOC', en: 'Northrop Grumman', zh: '诺格', sector: '工业', themes: ['军工'], blurb: '诺斯罗普：B-21 轰炸机制造商，军工隐形冠军' },
  { code: 'GD', en: 'General Dynamics', zh: '通用动力', sector: '工业', themes: ['军工'], blurb: '通用动力，坦克加公务机' },
  { code: 'UNP', en: 'Union Pacific', zh: '联合太平洋', sector: '工业', themes: ['铁路'], blurb: '联合太平洋，铁路货运' },
  { code: 'DAL', en: 'Delta Air Lines', zh: '达美航空', sector: '工业', themes: ['航空'], blurb: '达美航空：美国盈利能力最强的航司' },
  { code: 'UAL', en: 'United Airlines', zh: '美联航', sector: '工业', themes: ['航空'], blurb: '美联航：美国三大航之一，国际线见长' },
  { code: 'QS', en: 'QuantumScape', zh: 'QuantumScape', sector: '工业', themes: ['新能源', '电池'], blurb: 'QuantumScape，固态电池（大众合作）' },
  // ---- 公用事业 / 房地产 / 原材料 ----
  { code: 'NEE', en: 'NextEra Energy', zh: '新纪元能源', sector: '公用事业', themes: ['新能源'], blurb: '美国最大电力公司，风光装机多' },
  { code: 'DUK', en: 'Duke Energy', zh: '杜克能源', sector: '公用事业', themes: [], blurb: '杜克能源，东南部电力' },
  { code: 'SO', en: 'Southern Company', zh: '南方公司', sector: '公用事业', themes: [], blurb: '南方公司，电力加燃气' },
  { code: 'AMT', en: 'American Tower', zh: '美国电塔', sector: '房地产', themes: [], blurb: '美国电塔，通信铁塔REIT' },
  { code: 'PLD', en: 'Prologis', zh: '普洛斯', sector: '房地产', themes: ['物流'], blurb: '普洛斯，物流仓库REIT' },
  { code: 'EQIX', en: 'Equinix', zh: 'Equinix', sector: '房地产', themes: ['数据中心'], blurb: 'Equinix：数据中心 REIT，全球机房房东' },
  { code: 'DLR', en: 'Digital Realty', zh: 'Digital Realty', sector: '房地产', themes: ['数据中心'], blurb: 'Digital Realty：数据中心 REIT，机房房东老二' },
  { code: 'LIN', en: 'Linde', zh: '林德', sector: '原材料', themes: [], blurb: '林德：工业气体龙头，全球最大，涨价能力强' },
  { code: 'SHW', en: 'Sherwin-Williams', zh: '宣伟', sector: '原材料', themes: [], blurb: '宣伟：涂料一哥，油漆界的隐形冠军' },
  { code: 'APD', en: 'Air Products', zh: '空气化工', sector: '原材料', themes: [], blurb: '空气化工：工业气体三巨头之一' },
  { code: 'FCX', en: 'Freeport-McMoRan', zh: '自由港', sector: '原材料', themes: ['铜'], blurb: '自由港：铜矿巨头，吃 AI 数据中心用铜的逻辑' },
  { code: 'NEM', en: 'Newmont', zh: '纽蒙特', sector: '原材料', themes: ['黄金'], blurb: '纽蒙特：全球最大金矿商，金价影子股' },
  { code: 'GOLD', en: 'Barrick', zh: 'Barrick', sector: '原材料', themes: ['黄金'], blurb: 'Barrick，金矿' },
  // ---- 小众题材 ----
  { code: 'RCAT', en: 'Red Cat Holdings', zh: '红猫', sector: '工业', themes: ['无人机'], blurb: '红猫：军用小型无人机，俄乌战争概念' },
  { code: 'AVAV', en: 'AeroVironment', zh: '航境', sector: '工业', themes: ['无人机'], blurb: '航境，无人机（弹簧刀）' },
  { code: 'KTOS', en: 'Kratos Defense', zh: '克拉托斯', sector: '工业', themes: ['无人机'], blurb: '克拉托斯，无人机加高超音速' },
  { code: 'ASTS', en: 'AST SpaceMobile', zh: '星空移动', sector: '通信', themes: ['太空'], blurb: 'ASTS：天基手机直连卫星，手机直连卫星概念' },
  { code: 'LUNR', en: 'Intuitive Machines', zh: '直觉机器', sector: '工业', themes: ['太空'], blurb: '直觉机器，登月着陆器' },
  { code: 'SPCX', en: 'SpaceX', zh: '太空探索', sector: '工业', themes: ['太空'], blurb: 'SpaceX，星舰加星链' },
  { code: 'IONQ', en: 'IonQ', zh: 'IonQ', sector: '科技', themes: ['量子'], blurb: 'IonQ：离子阱量子计算机，量子概念龙头' },
  { code: 'RGTI', en: 'Rigetti Computing', zh: 'Rigetti', sector: '科技', themes: ['量子'], blurb: 'Rigetti：超导量子计算，量子概念小盘股' },
  { code: 'QBTS', en: 'D-Wave Quantum', zh: 'D-Wave', sector: '科技', themes: ['量子'], blurb: 'D-Wave，退火量子计算' },
  { code: 'GME', en: 'GameStop', zh: '游戏驿站', sector: '消费', themes: ['Meme'], blurb: '游戏驿站，meme股鼻祖' },
  { code: 'AMC', en: 'AMC Entertainment', zh: 'AMC院线', sector: '消费', themes: ['Meme'], blurb: 'AMC院线，meme股' },
  { code: 'DJT', en: 'Trump Media', zh: '特朗普媒体', sector: '通信', themes: ['Meme'], blurb: '特朗普媒体（Truth Social）' },
  { code: 'OKLO', en: 'Oklo', zh: 'Oklo', sector: '能源', themes: ['核能'], blurb: '小型核反应堆（SMR）概念股' },
  { code: 'SMR', en: 'NuScale Power', zh: 'NuScale', sector: '能源', themes: ['核能'], blurb: 'NuScale，小型模块化核反应堆' },
  { code: 'JOBY', en: 'Joby Aviation', zh: 'Joby', sector: '工业', themes: ['eVTOL'], blurb: 'Joby，电动飞行的士' },
  { code: 'ACHR', en: 'Archer Aviation', zh: 'Archer', sector: '工业', themes: ['eVTOL'], blurb: 'Archer，电动飞行的士' },
  { code: 'MP', en: 'MP Materials', zh: 'MP材料', sector: '原材料', themes: ['稀土'], blurb: '美国稀土矿（芒廷帕斯）' },
  { code: 'LAC', en: 'Lithium Americas', zh: '美洲锂业', sector: '原材料', themes: ['锂'], blurb: '美洲锂业，锂矿开发中' },
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
