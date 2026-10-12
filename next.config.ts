import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // The card link previews (lib/cards/og-image.tsx) read this font at run
  // time for shared collections, so ship it with those routes.
  outputFileTracingIncludes: {
    "/cards/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
