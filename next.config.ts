import type { NextConfig } from "next";

// 작품 이미지 원본은 내 PC(Cloudflare Tunnel 너머)에 있습니다.
// Vercel 이 원본을 받아 크기를 줄이고 캐시하므로 12MB 짜리가 방문자에게 그대로 나가지 않습니다.
const apiBase =
  process.env.NEXT_PUBLIC_ATELIER_API_BASE ?? "https://api.saegimai.com";

function pattern(base: string) {
  const u = new URL(base);
  return {
    protocol: u.protocol.replace(":", "") as "http" | "https",
    hostname: u.hostname,
    port: u.port,
    pathname: "/media/**",
  };
}

const patterns = [pattern(apiBase)];
if (!apiBase.includes("127.0.0.1") && !apiBase.includes("localhost")) {
  patterns.push(pattern("http://127.0.0.1:8787"));
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: patterns,
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
