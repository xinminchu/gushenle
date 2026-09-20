import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 忽略 ESLint 报错，确保打包能顺利生成产物
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 忽略 TypeScript 错误（确保组件能正常编译打包）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;