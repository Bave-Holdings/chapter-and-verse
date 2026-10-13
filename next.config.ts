import type { NextConfig } from "next";

const apiBaseUrl =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

// Range uploads return only after the complete PDF is transferred and inspected.
const apiProxyTimeout = Number(process.env.API_PROXY_TIMEOUT_MS ?? 300_000);
if (!Number.isSafeInteger(apiProxyTimeout) || apiProxyTimeout <= 0) {
  throw new Error("API_PROXY_TIMEOUT_MS must be a positive integer in milliseconds.");
}

const nextConfig: NextConfig = {
  experimental: {
    proxyTimeout: apiProxyTimeout,
    // Buffer complete PDF uploads (including multipart fields) through API rewrites.
    proxyClientMaxBodySize: "100mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBaseUrl}/api/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${apiBaseUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
