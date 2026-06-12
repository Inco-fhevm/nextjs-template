import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project so Next.js doesn't infer a
  // parent directory when other lockfiles exist higher up the tree.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
