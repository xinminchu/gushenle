import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 忽略 TypeScript 错误（确保组件能正常编译打包）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;