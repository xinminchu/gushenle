import warnings
warnings.filterwarnings('ignore')

from fastapi import FastAPI
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="谷峰模型 API")

@app.get("/api/v1/rhythm_stocks")
def get_rhythm_stocks():
    stock_pool = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AMD", "QQQ", "SPY"]
    
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        # 批量一次性拉取所有股票数据，大幅提升速度，避免 Vercel 10 秒超时
        df_all = yf.download(
            tickers=" ".join(stock_pool),
            start=start_date.strftime('%Y-%m-%d'),
            end=end_date.strftime('%Y-%m-%d'),
            group_by='ticker',
            progress=False
        )

        results = []
        for ticker in stock_pool:
            try:
                # 兼容多股票数据切片
                if len(stock_pool) > 1:
                    if ticker not in df_all or df_all[ticker].dropna().empty:
                        continue
                    df = df_all[ticker].copy().dropna()
                else:
                    df = df_all.copy().dropna()

                if df.empty or len(df) < 60:
                    continue

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

                results.append({
                    "ticker": ticker,
                    "close": round(close_price, 2),
                    "change_pct": round(float((latest['Close'] - prev['Close']) / prev['Close'] * 100), 2),
                    "ma20": round(ma20, 2),
                    "ma60": round(ma60, 2),
                    "rsi": round(rsi, 2),
                    "rhythm_score": rhythm_score,
                    "status": status,
                    "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
            except Exception as inner_e:
                print(f"Error processing {ticker}: {inner_e}")
                continue

        results = sorted(results, key=lambda x: x["rhythm_score"], reverse=True)
        return {"code": 200, "message": "success", "total": len(results), "data": results}

    except Exception as e:
        print(f"Global download error: {e}")
        return {"code": 500, "message": str(e), "total": 0, "data": []}