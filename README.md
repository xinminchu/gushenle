# 📈 谷峰模型 (Peak-Trough Cycle Model) - 美股律动看板

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://gushenle.com)
[![Python](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **极简、实时、无数据库依赖的美股量化律动分析看板。**  
> 实时捕捉美股核心标的（如 NVDA, AAPL, TSLA 等）的趋势阶段与动能评分，帮助投资者在复杂的波动中把握“谷”与“峰”的律动节奏。

在线体验：👉 **[https://gushenle.com](https://gushenle.com)**

---

## ✨ 项目亮点 (Key Features)

- ⚡ **秒级加载**：基于 Vercel Serverless 与 FastAPI 高性能异步架构，实时抓取 Yahoo Finance 最新行情。
- 📊 **谷峰律动评分 (0-100)**：结合 MA20/MA60 均线系统与 14 日 RSI 相对强弱指标，量化股票当前处于的趋势阶段。
- 📱 **移动端极佳体验**：响应式暗黑模式 UI，专为手机/移动端阅读优化，即开即用。
- 🛡️ **极简无库设计**：零数据库依赖，纯轻量计算，维护成本几乎为零。

---

## 🎯 算法逻辑 (Model Architecture)

**谷峰模型**通过多维度的技术指标叠加，自动输出综合“律动得分”与“阶段状态”：

| 指标维度 | 评估条件 | 得分权重 |
| :--- | :--- | :--- |
| **短期趋势** | 现价突破 20 日均线 (Close > MA20) | **+15 分** |
| **中期趋势** | 20 日均线上穿 60 日均线 (MA20 > MA60 多头排列) | **+15 分** |
| **动能区间** | RSI 处于健康蓄势区 (40 <= RSI <= 65) | **+20 分** |
| **超跌反弹** | RSI 处于严重超卖区 (RSI < 30) | **+10 分** |

### 阶段状态划分：
- 🟢 **主升律动** (Score ≥ 80)：多头趋势强劲，主升浪启动状态。
- 🟡 **蓄势准备** (65 ≤ Score < 80)：趋势整理完成，具备上攻动能。
- ⚪ **观察区** (40 < Score < 65)：无明显趋势或处于窄幅震荡。
- 🔴 **调整阶段** (Score ≤ 40)：均线压制或处于弱势回调中。

---

## 🛠️ 技术栈 (Tech Stack)

- **Frontend**: Single Page HTML5 / CSS3 (CSS Grid & Flexbox) / Native Fetch API
- **Backend**: Python 3.10+, FastAPI, `yfinance`, `pandas`, `numpy`
- **Deployment**: Vercel Serverless Architecture

---

## 📁 项目目录结构

```text
gushenle/
├── api/
│   └── index.py        # FastAPI 后端路由与谷峰算法计算核心
├── public/
│   └── index.html      # 前端移动端适配看板页面
├── requirements.txt    # Python 运行依赖
├── vercel.json         # Vercel Serverless 路径重写与构建配置
└── README.md           # 项目文档
