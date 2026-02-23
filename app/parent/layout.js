import { buildNoIndexMetadata } from "../../src/lib/seo.js";

export const metadata = buildNoIndexMetadata({
  title: "Parent Console | Homeschool Sidekick",
  description: "Secure parent console for managing homeschool tutoring sessions."
});

export default function ParentRouteLayout({ children }) {
  return children;
}
