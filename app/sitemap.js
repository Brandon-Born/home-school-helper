import { getSiteUrl } from "../src/lib/seo.js";

const PUBLIC_PAGES = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 }
];

export default function sitemap() {
  const siteUrl = getSiteUrl();

  return PUBLIC_PAGES.map((page) => ({
    url: new URL(page.path, siteUrl).toString(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    lastModified: new Date()
  }));
}
