/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode catches potential issues during development
  reactStrictMode: true,

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevents the page from being embedded in an iframe (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing responses
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Controls referrer information sent when navigating
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content Security Policy – adjust 'connect-src' to your API domain in production
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-*' needed by Next.js dev; tighten in prod
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}`,
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
