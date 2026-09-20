import { NextResponse } from 'next/server';

export async function GET() {
  // 生成/获取近 30 天的 K 线收盘价数据
  const mockPrices = [
    100, 102, 105, 103, 98, 95, 97, 104, 110, 108, 
    115, 112, 106, 102, 105, 111, 118, 114, 109, 113,
    120, 122, 117, 115, 119, 125, 121, 116, 118, 124
  ];

  return NextResponse.json({
    symbol: 'GUSHEN30',
    name: '股神情绪指数',
    data: mockPrices
  });
}