import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["91.215.137.210", "127.0.0.1", "localhost"],
  serverExternalPackages: ["@napi-rs/canvas"],
  // Сжатие ответов (gzip) — крупный выигрыш по трафику для тяжёлых JSON (конфиг, заявки).
  compress: true,
}

export default nextConfig
