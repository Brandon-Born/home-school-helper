import { getSiteUrl } from "../src/lib/seo.js";

const PUBLIC_PAGES = [
  { path: "/", changeFrequency: "weekly", priority: 1.0, lastModified: "2026-02-23" },
  { path: "/guides", changeFrequency: "weekly", priority: 0.88, lastModified: "2026-02-23" },
  { path: "/ai-tutor-for-homeschool", changeFrequency: "weekly", priority: 0.85, lastModified: "2026-02-23" },
  { path: "/voice-tutor-for-kids", changeFrequency: "weekly", priority: 0.82, lastModified: "2026-02-23" },
  { path: "/math-help-for-homeschool", changeFrequency: "weekly", priority: 0.81, lastModified: "2026-02-23" },
  { path: "/about", changeFrequency: "monthly", priority: 0.7, lastModified: "2026-02-23" },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6, lastModified: "2026-02-23" },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5, lastModified: "2026-02-23" }
];

export default function sitemap() {
  const siteUrl = getSiteUrl();

  return PUBLIC_PAGES.map((page) => ({
    url: new URL(page.path, siteUrl).toString(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    lastModified: page.lastModified
  }));
}
