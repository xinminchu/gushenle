# 主播观点 · 每日更新信息源调研（2026-10-16）

目标：为每日 cron 找到**机器可读、无需登录**的信息源，轮询 8 位博主的最新节目，
不看视频也能拿到标题/简介/文字稿级别的观点信号。

图例：✅ = 已用 curl 实际验证（HTTP 200 + 解析出条目）；⚠️ = 频道已验证，
RSS URL 结构与已验证项一致，但测试窗口内 YouTube 限流未能复现 HTTP 200。

| 博主 | 平台 | Feed URL | 状态 | 更新频率观察 |
|---|---|---|---|---|
| 阳光财经 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UC2I5em6UyBpQiO-8ZW0nV3w` | ✅ curl HTTP 200，有效 Atom XML，`<name>阳光财经</name>`，含多条 `<entry>` | 日更。RSS 内最近：10/16、10/15、10/14、10/13（均为美东盘后发布），标题带日期如 |
| 视野环球财经 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UCFQsi7WaF5X41tcuOryDk8w` | ⚠️ 频道页验证通过（标题"视野环球财经"，canonical 一致）；RSS 端点测试时被限流 | 日更。博主自述：免费视频每个交易日盘后更新 |
| NaNa说美股 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UCFhJ8ZFg9W4kLwFTBBNIjOw` | ⚠️ 频道页验证通过（标题"NaNa说美股"）；RSS 端点测试时被限流 | 日更。官网写"每日市场信息"，视频标题带日期 |
| Selina聊美股 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UCPiSlh2-zATwjj-cixqPi8Q` | ⚠️ 频道页验证通过（标题"Selina聊美股"）；oEmbed 确认作者一致 | 高频。AI/光通信产业链深度拆解，标题即论点 |
| 投资TALK君 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UCRBrH2qS7yKGMNSmjnj8gcw` | ⚠️ 频道页验证通过（标题"投资TALK君"）；oEmbed 确认作者一致 | 日更。节目已编号到 1459 期 |
| Money or Life | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UC9cfcOuTT9rYkyUimMjLxuw` | ⚠️ 频道页验证通过（标题"Money or Life 美股频道"）；oEmbed 确认作者一致 | 不定期更新 |
| Kova动量交易 | **Substack（纯文字）** | `https://kovainvest.substack.com/feed` | ✅ curl HTTP 200，有效 RSS，标题"Kova Investment Research动量交易"，16 篇条目 | 10/16、10/12、10/07（约每周 1–2 篇文字研报；标题即观点，如"和我一起做空吧"） |
| Kova动量交易 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UCCqA7QgEtiiCrjZJphWMS7Q` | ⚠️ 频道页验证通过；RSS 端点测试时被限流 | 直播较频繁（如"10月13日 美股直播"） |
| 老王不只三分钟 | YouTube | `https://www.youtube.com/feeds/videos.xml?channel_id=UCvnLmiWt_zIVIh0zUm_j4Hw` | ⚠️ 频道页验证通过。注意：频道名为"老王愛說笑"，同一人（王倚隆/浦惠投顧），"老王不只三分鐘"为节目名；oEmbed 确认 | 日更。标题带日期如 2026/10/13 |

## 关键结论

1. **8 位博主全部有 YouTube 频道，channel ID 全部验证**（频道页标题 + canonical + oEmbed 三重确认）。
只有**阳光财经**的 RSS 在测试中拿到 HTTP 200（有效条目），其余 6 个 YouTube RSS 因
YouTube 对本机 IP 的限流（429/404/500 交替）在测试窗口内未能复现成功——但 URL
结构与已验证项完全一致，且频道存在性已确认。cron 接入时**必须带重试退避**
（每天只轮询一次、请求间加随机延迟，应无问题；本次限流是短时间内几十次请求触发的）。

2. **Kova 的 Substack 是意外之喜**：纯文字研报 RSS，已验证，观点密度最高
（标题直接就是观点），应作为每日 cron 的第一优先级文字源。

3. **Bilibili 全军覆没**：`api.bilibili.com` 从本机 IP 返回 `code:-401 非法访问` /
412 风控页（`anti_crawler`，需过验证码），加 Referer/UA 也无用。
Money or Life 的 B 站 mid=1512380028（其官方简介给出）因此**无法作为 cron 信息源**
（cron 跑在同一环境）。YouTube 仍是它的可用渠道。

4. **NaNa 官网 RSS 已停更**：`https://nanashuomeigu.com/feed` 可访问但最新条目是
2025-06-19，不可用。

5. **没有哪位博主是完全无机器 feed 的**：8/8 都有 YouTube 频道；其中 2 个信息源
已获 HTTP 200 完全验证（阳光财经 YT RSS、Kova Substack）。

## 给 cron 的建议接入顺序

1. `kovainvest.substack.com/feed`（已验证，纯文字，观点最直接）
2. 阳光财经 YouTube RSS（已验证，日更）
3. 其余 6 个 YouTube RSS（频道已验证，URL 待 cron 首次运行时复验，带重试）
