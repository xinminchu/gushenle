# 股神乐 · 盘前早报信息源调研报告（存档）

- 原报告：ChatGPT 调研模块交付，2026-10-20，Sam 以 docx 转交（原件 `workspace/user/files/Gushenle_Market_Sources_Report.docx`）。
- 验收：Mas 对照 chusets 任务简报逐项核对合格；抽查 Marketaux 与 FMP 官方价格页，数字与再发布限制表述与原文一致（2026-10-20）。
- 用途：`tasks/ready/2026-10-19-mas-gushenle-morning-briefing.md`（盘前早报实作）数据源选型依据。
- 注意：报告自述未注册供应商账号、未做带密钥实测、无商用合同报价；接入时逐源实测。

研究范围：隔夜要闻、盘前异动、今日日历、情绪市况｜面向中文公众网站。

## 执行摘要

推荐分层架构：新闻聚合 API 与美国官方 RSS 提供事实线索；官方发布日历提供事件时间；授权行情供应商提供盘前交易和指数值。免费试用与可公开再发布是两项不同权利。

统一时间：纽约时间 ET（夏令 EDT=UTC−4，冬令 EST=UTC−5）；芝加哥 CT 比 ET 晚 1 小时。美股常规开盘 09:30 ET / 08:30 CT。"连续/事件驱动"不表示固定准点。所有报价需同时记录 observation_time、provider_timestamp、retrieved_at 与 delay_status。

## 一、隔夜要闻

1. **Marketaux**（全球财经新闻聚合）https://www.marketaux.com/documentation — 持续收录，API 日期用 UTC，未披露入库滞后 SLA。免费 100 请求/日、每次最多 3 篇；Basic $29/月（按月）。官方 REST JSON。聚合源非原始机构；仅摘要/链接，全文另谈；中文改写需回链及核验。[S1–S2 已核查]
2. **Federal Reserve** https://www.federalreserve.gov/feeds/feeds.htm — 事件驱动，公告时间 ET。免费，官方 RSS。一手政策证据，覆盖面仅限美联储。[S3 已核查]
3. **SEC** https://www.sec.gov/about/rss-feeds — 事件驱动；结构化申报 RSS 工作日 06:00–22:00 EST 每 10 分钟更新（官方表述）。免费，RSS + EDGAR 接口。监管/披露一手源；无重要性排序；遵守请求速率。[S4 已核查]
4. **Financial Modeling Prep** https://site.financialmodelingprep.com/pricing-plans — 新闻事件驱动，延迟未保证。Basic 免费但新闻入口权限有限；Starter $19/月（年付折算）。REST。Starter 明列 Financial Market News；个人方案不可直接认定允许公开展示/转售。[S5 已核查]
5. **Trading Economics** https://tradingeconomics.com/api/pricing.aspx — 事件驱动。Standard $199/月（按月），试用周 $49。REST + 部分流式。跨国宏观覆盖好；贵；新闻解释与实际公告需区分。[S6 已核查]

## 二、盘前异动

1. **Massive（原 Polygon）** Stocks Snapshot https://massive.com/pricing?product=stocks — 交易时段持续变动；Starter 延迟 15 分钟；盘前口径（ET 04:00 起）需按交易所与供应商核验。免费 Basic 无 Snapshot；Starter $29/月、Advanced $199/月（个人按月）。REST/WebSocket。结构化价格量适合筛异动；"原因"须另配公告/新闻；商业展示单独询价。[S7 已核查]
2. **FMP** — 盘前行情及权限依端点；未核实免费实时盘前覆盖。免费 250 请求/天（基础数据）；Starter $19 / Premium $49（年付折算个人价）。REST。可交叉连新闻；免费额度≠实时盘口；显示与再分发需协议。[S5 已核查]
3. **Alpha Vantage** Top Gainers/Losers https://www.alphavantage.co/documentation/ — 默认每日收盘后更新；实时/15 分钟延迟属付费 entitlement。免费 key 有限额度，高级价格需询价。REST。**默认榜单不是盘前榜**，仅作交叉比对/候选池。[S8 已核查]
4. **Nasdaq Pre-Market Activity 网页** https://www.nasdaq.com/market-activity/pre-market — 盘前动态更新，SLA 未核查。网页免费浏览；API/商业费用未核实。仅人工交叉核验；页面内部请求不算授权 API，不进自动生产链。[候选，授权未核验]

## 三、今日日历

1. **Alpha Vantage Earnings Calendar** — 滚动未来 3/6/12 月预测财报日期。免费端点存在，额度/商用依套餐。REST + CSV 下载。日期会变；缺具体时点须标注。[S8]
2. **BLS 发布日历** https://www.bls.gov/schedule/news_release/bls.ics — 关键报告常 08:30 ET；日历通常提前至少一周更新。免费，官方 .ics。CPI/就业权威时间源；不含财报/IPO；日期可临时更改。[S9]
3. **BEA 发布日程** https://www.bea.gov/news/schedule/ — GDP/PCE 等多在 08:30 ET。免费，网页日程（解析中难度，无稳定日历 API）。公告值与修订值要区分。[S10]
4. **Trading Economics Economic Calendar API** https://docs.tradingeconomics.com/economic_calendar/ — 动态更新，时间按国家时区需规范化为 ET。Standard $199/月、专业版 $399/月。REST/iCalendar/WebSocket。含 Actual/Previous/Consensus；一致预期非官方事实需注明。[S6,S11]
5. **FMP Corporate Calendars** — 滚动更新。Premium $49/月（年付折算）明列 Corporate Calendars。REST。IPO 字段覆盖、缺失率、商用权限须实测。[S5]

## 四、情绪市况（只摆事实，不打分、不预测、不荐股）

1. **Massive 指数 API** https://massive.com/pricing?product=indices — Starter 延迟 15 分钟。Basic 免费 EOD；Indices Starter $49/月、Advanced $99/月。REST/WebSocket。需核对 ticker 是否含 VIX、CME 期货；指数≠期货。[S12]
2. **FRED VIXCLS** https://fred.stlouisfed.org/series/VIXCLS — 每日收盘值，入库时间不固定。API 免费，第三方数据再利用权需核对。仅"最近交易日 VIX 收盘"，非盘前实时；Cboe 原始数据有版权声明。[S13,S14]
3. **Cboe VIX 官方页** https://www.cboe.com/delayedquote/default.aspx — 网页延迟报价。定义权威；**严禁从公共页面抓取后发布**；自动化/商用需询价。[S15]
4. **CME Group** https://www.cmegroup.com/market-data.html — ES/NQ/YM 期货一手市场，近 24h 连续。公开延迟网页可看；实时 API/展示许可按合同。须明确合约月份与主力滚动；不能用股票指数替代期货。[候选，合同价格未核实]
5. **NYSE/Nasdaq 市场宽度** https://www.nyse.com/market-data — 涨跌家数常规时段更新，盘前口径另议。公开页可浏览；API/再分发按协议。须注明证券池/时段/是否含 ETF；昨日广度不得冒充今日盘前广度。[候选，字段/许可待验]

## 五、推荐组合（每栏一主一备）

| 栏目 | 首选 | 备选 | 理由与限制 |
| --- | --- | --- | --- |
| 隔夜要闻 | Marketaux API | 美联储 RSS + SEC RSS | 跨市场检索/URL/UTC 时间；官方源一手确认。免费版每次 3 篇，仅够 MVP 小流量。 |
| 盘前异动 | Massive Stocks Snapshot（取得商用许可后） | FMP 行情 API（取得展示许可后） | 结构化筛选基础；价格与原因分别采集审核；免费套餐不足以做稳定盘前榜。 |
| 今日日历 | Alpha Vantage Earnings Calendar + BLS ICS（联合主源） | Trading Economics Economic Calendar API | 单源覆盖不了财报+宏观+IPO；免费联合源做基础版；TE 不替代财报/IPO 服务。 |
| 情绪市况 | Massive Indices API + FRED VIXCLS（仅收盘） | Cboe/CME 持牌数据 | 免费可可靠发布"上一交易日 VIX 收盘"；盘前实时 VIX/期货须可展示的商业授权。涨跌家数只显示匹配时段数据。 |

## 六、核心缺陷与上线前验收

1. 免费获取 ≠ 免费商用再发布：须书面确认 display/redistribution 权利、缓存保留、署名与限额。
2. 延迟与实时不得混排成同一时点；盘前榜标识 04:00–09:30 ET、最后成交时间与成交量门槛。
3. 异动"原因"是证据连接问题：只接受带时间戳的一手公告或可信报道；无法证实写"原因未确认"，不由模型臆断。
4. IPO 日历尚无已核验的免费稳定官方 API；上线前单独确认 Nasdaq/NYSE 上市事件状态调整。
5. 涨跌家数须定义证券池、时段与取数时间；无盘前广度不得以旧数据不标识替代。
6. 运行监测：采集成功率、延迟分布、重复事件率、错误匹配率、交易日与 DST 切换、失败降级与原链接留存。

## 七、核验范围与未核实事项

依据 2026-10-20 前可访问的公开官网文档与价格页核查；未注册供应商账号、未执行带密钥 API 测试、未取得商业合同。各源的实时延迟 SLA、行业许可证条款、字段覆盖、IPO/盘前广度可用性均不视为已验证。价格为官网当时个人/标准公开价，不能视为股神乐商用报价。

## 官方参考来源

S1 https://www.marketaux.com/documentation ｜ S2 https://www.marketaux.com/pricing ｜ S3 https://www.federalreserve.gov/feeds/feeds.htm ｜ S4 https://www.sec.gov/data-research/structured-data/structured-disclosure-rss-feeds ｜ S5 https://site.financialmodelingprep.com/pricing-plans ｜ S6 https://tradingeconomics.com/api/pricing.aspx ｜ S7 https://massive.com/pricing?product=stocks ｜ S8 https://www.alphavantage.co/documentation/ ｜ S9 https://www.bls.gov/schedule/news_release/empSit.htm ｜ S10 https://www.bea.gov/news/schedule/ ｜ S11 https://docs.tradingeconomics.com/economic_calendar/ ｜ S12 https://massive.com/pricing?product=indices ｜ S13 https://fred.stlouisfed.org/series/VIXCLS ｜ S14 https://fred.stlouisfed.org/docs/api/fred/overview.html ｜ S15 https://www.cboe.com/delayedquote/default.aspx
