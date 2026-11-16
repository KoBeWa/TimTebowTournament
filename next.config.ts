import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // The matchup page is a static route per pairing; links keep the short URL with ?a=&b=
      {
        source: "/gamecenter/:season(\\d{4})/:week(\\d{1,2})",
        has: [
          { type: "query", key: "a", value: "(?<a>[^&]+)" },
          { type: "query", key: "b", value: "(?<b>[^&]+)" },
        ],
        destination: "/gamecenter/:season/:week/:a/:b",
      },
    ];
  },
};

export default nextConfig;
