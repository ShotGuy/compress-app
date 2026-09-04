import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed strict COOP/COEP headers because we are using single-threaded FFmpeg 
  // which does not require SharedArrayBuffer. This prevents require-corp from blocking unpkg.
};

export default nextConfig;
