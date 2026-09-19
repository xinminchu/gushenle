import warnings
warnings.filterwarnings('ignore')

from fastapi import FastAPI
from typing import List, Optional
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="谷峰模型 API")

def calculate_rhythm_data(ticker: str):
    """
    抓取单个股票的历史数据并计算谷峰律动指标
    """
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        df = yf.download(ticker, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
        
        if df.empty or len(df) < 60:
            return None

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df['MA20'] = df['Close'].rolling(window=20).mean()
        df['MA60'] = df['Close'].rolling(window=60).mean()
        
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))

        latest = df.iloc[-1]
        prev = df.iloc[-2]
        
        close_price = float(latest['Close'])
        ma20 = float(latest['MA20'])
        ma60 = float(latest['MA60'])
        rsi = float(latest['RSI'])
        
        # 计算律动得分 (0-100)
        rhythm_score = 50
        if close_price > ma20: rhythm_score += 15
        if ma20 > ma60: rhythm_score += 15
        if 40 <= rsi <= 65: rhythm_score += 20
        elif rsi < 30: rhythm_score += 10
        
        status = "观察区"
        if rhythm_score >= 80:
            status = "主升律动"
        elif rhythm_score >= 65:
            status = "蓄势准备"
        elif rhythm_score <= 40:
            status = "调整阶段"

        return {
            "ticker": ticker,
            "close": round(close_price, 2),
            "change_pct": round(float((latest['Close'] - prev['Close']) / prev['Close'] * 100), 2),
            "ma20": round(ma20, 2),
            "ma60": round(ma60, 2),
            "rsi": round(rsi, 2),
            "rhythm_score": rhythm_score,
            "status": status,
            "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        print(f"Error calculating {ticker}: {e}")
        return None

@app.get("/api/v1/rhythm_stocks")
def get_rhythm_stocks():
    stock_pool = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AMD", "QQQ", "SPY"]
    results = []
    for ticker in stock_pool:
        res = calculate_rhythm_data(ticker)
        if res:
            results.append(res)
    results = sorted(results, key=lambda x: x["rhythm_score"], reverse=True)
    return {"code": 200, "message": "success", "total": len(results), "data": results}