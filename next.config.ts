import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in response headers.
  poweredByHeader: false,
  // Fail the production build on type errors instead of shipping them.
  typescript: { ignoreBuildErrors: false },
  // Raise the server-actions body cap from the 1 MB default. The
  // data-quality correction-file upload ships the full scraper-format
  // CSV (23 cols × hundreds of rows) and quietly 413'd at 1 MB. 4 MB
  // is well under Vercel's serverless request cap and covers a
  // single-chunk upload of a few thousand rows; the client also
  // chunks at 500 rows/call as the real defence, so this is just a
  // headroom safety net.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // Placeholder photography hosts (swapped for Supabase Storage in production).
  //
  // `unoptimized` is flipped on in dev so the VS Code embedded "Simple
  // Browser" can render <Image> components — the dev `/_next/image`
  // optimizer endpoint hangs there because Simple Browser doesn't speak
  // the modern accept/headers Next expects. Production on Vercel still
  // gets full image optimization (resize, AVIF/WebP, caching).
  images: {
    unoptimized: process.env.NODE_ENV === "development",
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
      // Google static CDN — ssl.gstatic.com (default reviewer avatars,
      // business default images) and maps.gstatic.com (map tiles,
      // marker icons). Wildcard avoids the one-hostname-at-a-time
      // whack-a-mole as the ingest surfaces new gstatic subdomains.
      { protocol: "https", hostname: "**.gstatic.com" },
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
