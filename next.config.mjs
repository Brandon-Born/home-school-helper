/** @type {import('next').NextConfig} */
function buildConnectSrc() {
  const values = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co"
  ];

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (supabaseUrl) {
    try {
      const { origin, protocol, host } = new URL(supabaseUrl);
      values.push(origin);
      if (protocol === "https:") {
        values.push(`wss://${host}`);
      }
    } catch {
      // Ignore malformed runtime env values.
    }
  }

  return [...new Set(values)].join(" ");
}

function buildContentSecurityPolicy({ isProduction }) {
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: data: blob:",
    `connect-src ${buildConnectSrc()}`,
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];

  return directives.join("; ");
}

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
    const hstsValue = isProduction
      ? "max-age=31536000; includeSubDomains; preload"
      : "max-age=0";

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy({ isProduction })
          },
          {
            key: "Strict-Transport-Security",
            value: hstsValue
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self)"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
