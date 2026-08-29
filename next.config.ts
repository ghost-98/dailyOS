import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/**",
            protocol: "https",
          },
        ]
      : [],
  },
  reactStrictMode: true,
};

export default nextConfig;
