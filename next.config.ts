import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in response headers.
  poweredByHeader: false,
  // Fail the production build on type errors instead of shipping them.
  typescript: { ignoreBuildErrors: false },
  // Placeholder photography hosts (swapped for Supabase Storage in production).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "flagcdn.com" },
      // Instagram CDN — thumbnails come from many regional subdomains.
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      // Supabase Storage — avatars bucket (migration 0032). Subdomain
      // is the project ref (e.g. lgdbcowtsasjyrzmylzv.supabase.co), so
      // wildcard captures any project we deploy against.
      { protocol: "https", hostname: "**.supabase.co" },
      // Google-hosted Place photos returned by the Partner Collection
      // ingest (the stays-photos bucket mirrors these, but raw rows can
      // still carry the original URL until the mirror job runs).
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      { protocol: "https", hostname: "**.ggpht.com" },
      // Google Street View thumbnails — Partner Collection ingest returns
      // these for venues that don't have a regular Place Photo. Same
      // trust class as the lh*.googleusercontent.com entries above.
      { protocol: "https", hostname: "streetviewpixels-pa.googleapis.com" },
    ],
  },
  // Security headers applied to every route.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
