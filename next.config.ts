import type { NextConfig } from "next";

const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  // Serve Firebase's auth helper from our own origin so Google sign-in works in
  // browsers that block third-party storage (Safari / installed iOS PWAs).
  // Only takes effect when NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is set to this app's domain.
  async rewrites() {
    if (!firebaseProjectId) return [];
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${firebaseProjectId}.firebaseapp.com/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${firebaseProjectId}.firebaseapp.com/__/firebase/:path*`,
      },
    ];
  },
};

export default nextConfig;
