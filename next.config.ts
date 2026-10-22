import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 브라우저 자동화 라이브러리는 번들하지 않고 Node에서 그대로 불러온다.
  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;
