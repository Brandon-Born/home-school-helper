import { getSiteUrl } from "../src/lib/seo.js";

export default function robots() {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/callback"]
      }
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl.origin
  };
}
